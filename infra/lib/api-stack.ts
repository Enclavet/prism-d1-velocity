import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  eventBus: events.EventBus;
  eventsTable: dynamodb.Table;
  metadataTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // -------------------------------------------------------
    // API handler Lambda
    // -------------------------------------------------------
    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      functionName: 'prism-d1-api-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'api-handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-eventbridge @aws-sdk/client-dynamodb esbuild > /dev/null 2>&1',
              'npx esbuild api-handler.ts --bundle --platform=node --target=node20 --outfile=/asset-output/api-handler.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'api-handler.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'api-handler.js')} --external:@aws-sdk/*`,
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
        EVENT_BUS_NAME: props.eventBus.eventBusName,
        EVENTS_TABLE: props.eventsTable.tableName,
        METADATA_TABLE: props.metadataTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Handles PRISM D1 Velocity API requests',
    });

    // -------------------------------------------------------
    // IAM permissions
    // -------------------------------------------------------
    props.eventBus.grantPutEventsTo(apiHandler);
    props.eventsTable.grantReadData(apiHandler);
    props.metadataTable.grantReadWriteData(apiHandler);

    // -------------------------------------------------------
    // API Gateway REST API
    // -------------------------------------------------------
    this.api = new apigateway.RestApi(this, 'PrismD1Api', {
      restApiName: 'PRISM D1 Velocity API',
      description: 'Metric ingestion and query API for PRISM D1 Velocity platform',
      deployOptions: {
        stageName: 'v1',
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Api-Key',
          'Authorization',
        ],
      },
    });

    // -------------------------------------------------------
    // API Key + Usage Plan
    // -------------------------------------------------------
    const apiKey = this.api.addApiKey('PrismD1ApiKey', {
      apiKeyName: 'prism-d1-velocity-key',
      description: 'API key for PRISM D1 Velocity metric ingestion',
    });

    const usagePlan = this.api.addUsagePlan('PrismD1UsagePlan', {
      name: 'prism-d1-standard',
      description: 'Standard usage plan for PRISM D1 API',
      throttle: {
        rateLimit: 50,
        burstLimit: 100,
      },
      quota: {
        limit: 100_000,
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({ stage: this.api.deploymentStage });

    // -------------------------------------------------------
    // Lambda integration
    // -------------------------------------------------------
    const lambdaIntegration = new apigateway.LambdaIntegration(apiHandler, {
      proxy: true,
    });

    // POST /metrics
    const metricsResource = this.api.root.addResource('metrics');
    metricsResource.addMethod('POST', lambdaIntegration, {
      apiKeyRequired: true,
    });

    // GET /metrics/{team_id}
    const teamMetricsResource = metricsResource.addResource('{team_id}');
    teamMetricsResource.addMethod('GET', lambdaIntegration, {
      apiKeyRequired: true,
    });

    // POST /assessment
    const assessmentResource = this.api.root.addResource('assessment');
    assessmentResource.addMethod('POST', lambdaIntegration, {
      apiKeyRequired: true,
    });

    // -------------------------------------------------------
    // Outputs
    // -------------------------------------------------------
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'PRISM D1 Velocity API endpoint',
      exportName: 'PrismD1ApiUrl',
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID (retrieve value from AWS Console or CLI)',
      exportName: 'PrismD1ApiKeyId',
    });
  }
}
