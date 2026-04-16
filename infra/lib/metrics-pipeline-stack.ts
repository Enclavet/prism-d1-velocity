import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

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
    // DynamoDB events table (replaces Timestream)
    // -------------------------------------------------------
    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: 'prism-d1-events',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl',
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
    });

    // -------------------------------------------------------
    // Metrics processor Lambda
    // -------------------------------------------------------
    const metricsProcessor = new lambda.Function(this, 'MetricsProcessor', {
      functionName: 'prism-d1-metrics-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'metrics-processor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-dynamodb @aws-sdk/client-cloudwatch esbuild > /dev/null 2>&1',
              'npx esbuild metrics-processor.ts --bundle --platform=node --target=node20 --outfile=/asset-output/metrics-processor.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              // Local bundling via esbuild if available
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'metrics-processor.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'metrics-processor.js')} --external:@aws-sdk/*`,
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
        targets: [new targets.LambdaFunction(metricsProcessor)],
        description: `Routes ${detailType} events to the metrics processor`,
      });
    }

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
