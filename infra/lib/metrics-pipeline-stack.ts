import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export class MetricsPipelineStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly eventsTable: dynamodb.Table;
  public readonly metadataTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------
    // EventBridge custom event bus
    // -------------------------------------------------------
    this.eventBus = new events.EventBus(this, 'PrismMetricsBus', {
      eventBusName: 'prism-d1-metrics',
    });

    // -------------------------------------------------------
    // DynamoDB events table
    // -------------------------------------------------------
    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: 'prism-d1-events',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'by-detail-type',
      partitionKey: { name: 'detail_type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // -------------------------------------------------------
    // DynamoDB metadata table
    // -------------------------------------------------------
    this.metadataTable = new dynamodb.Table(this, 'TeamMetadataTable', {
      tableName: 'prism-team-metadata',
      partitionKey: { name: 'team_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // -------------------------------------------------------
    // Dead-letter queue for Lambda failures
    // -------------------------------------------------------
    const processorDlq = new sqs.Queue(this, 'MetricsProcessorDLQ', {
      queueName: 'prism-d1-metrics-processor-dlq',
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    // -------------------------------------------------------
    // Dead-letter queue for EventBridge rule delivery failures
    // -------------------------------------------------------
    const eventRuleDlq = new sqs.Queue(this, 'EventRuleDLQ', {
      queueName: 'prism-d1-event-rule-dlq',
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    // -------------------------------------------------------
    // Metrics processor Lambda
    // -------------------------------------------------------
    const metricsProcessor = new lambda.Function(this, 'MetricsProcessor', {
      functionName: 'prism-d1-metrics-processor',
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'metrics-processor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_24_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-dynamodb @aws-sdk/client-cloudwatch esbuild > /dev/null 2>&1',
              'npx esbuild metrics-processor.ts --bundle --platform=node --target=node22 --outfile=/asset-output/metrics-processor.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'metrics-processor.ts')} --bundle --platform=node --target=node22 --outfile=${path.join(outputDir, 'metrics-processor.js')} --external:@aws-sdk/*`,
                  { stdio: 'pipe' },
                );
                return true;
              } catch {
                return false;
              }
            },
          },
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      reservedConcurrentExecutions: 10,
      deadLetterQueue: processorDlq,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        METADATA_TABLE: this.metadataTable.tableName,
        METRIC_NAMESPACE: 'PRISM/D1/Velocity',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Processes PRISM D1 metric events from EventBridge into DynamoDB and CloudWatch',
    });

    // -------------------------------------------------------
    // IAM permissions for the processor
    // -------------------------------------------------------
    this.eventsTable.grantWriteData(metricsProcessor);
    this.metadataTable.grantWriteData(metricsProcessor);

    metricsProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'PRISM/D1/Velocity',
          },
        },
      }),
    );

    // cdk-nag: cloudwatch:PutMetricData does not support resource-level permissions
    NagSuppressions.addResourceSuppressions(
      metricsProcessor,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'cloudwatch:PutMetricData does not support resource-level permissions. ' +
            'Access is scoped via a cloudwatch:namespace condition key.',
        },
        {
          id: 'AwsSolutions-IAM4',
          reason:
            'AWSLambdaBasicExecutionRole is required for Lambda CloudWatch Logs access. ' +
            'This is the standard CDK-managed execution role.',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
        },
      ],
      true,
    );

    // cdk-nag: LogRetention custom resource uses CDK-managed IAM role with wildcards
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4',
        reason:
          'LogRetention custom resource Lambda uses AWSLambdaBasicExecutionRole, ' +
          'managed by CDK internals.',
        appliesTo: [
          'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'LogRetention custom resource requires wildcard permissions to manage log groups. ' +
          'This is a CDK-internal construct.',
        appliesTo: ['Resource::*'],
      },
    ]);

    // -------------------------------------------------------
    // EventBridge rules — one per detail-type category
    // -------------------------------------------------------
    const detailTypes = [
      'prism.d1.commit',
      'prism.d1.pr',
      'prism.d1.deploy',
      'prism.d1.eval',
      'prism.d1.incident',
      'prism.d1.assessment',
      'prism.d1.agent',
      'prism.d1.agent.eval',
    ];

    for (const detailType of detailTypes) {
      const ruleName = detailType.replace(/\./g, '-');
      new events.Rule(this, `Rule-${ruleName}`, {
        ruleName: `prism-d1-${ruleName}`,
        eventBus: this.eventBus,
        eventPattern: {
          source: ['prism.d1.velocity'],
          detailType: [detailType],
        },
        targets: [
          new targets.LambdaFunction(metricsProcessor, {
            deadLetterQueue: eventRuleDlq,
            retryAttempts: 2,
          }),
        ],
        description: `Routes ${detailType} events to the metrics processor`,
      });
    }

    // -------------------------------------------------------
    // cdk-nag: SQS DLQ queues don't themselves need DLQs
    // -------------------------------------------------------
    NagSuppressions.addResourceSuppressions(
      [processorDlq, eventRuleDlq],
      [
        {
          id: 'AwsSolutions-SQS3',
          reason: 'These are dead-letter queues themselves; a DLQ on a DLQ is not needed.',
        },
      ],
    );

    // -------------------------------------------------------
    // Outputs
    // -------------------------------------------------------
    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      description: 'PRISM D1 Metrics EventBridge bus ARN',
      exportName: 'PrismD1EventBusArn',
    });

    new cdk.CfnOutput(this, 'EventsTableName', {
      value: this.eventsTable.tableName,
      exportName: 'PrismD1EventsTable',
    });

    new cdk.CfnOutput(this, 'MetadataTableName', {
      value: this.metadataTable.tableName,
      exportName: 'PrismD1MetadataTable',
    });
  }
}
