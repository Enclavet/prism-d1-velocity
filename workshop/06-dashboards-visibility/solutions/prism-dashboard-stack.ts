/**
 * PRISM D1 Velocity -- Dashboard Stack (Reference Implementation)
 *
 * Deploys:
 * - Timestream database and table for metric storage
 * - EventBridge bus and rules for metric ingestion
 * - Lambda function to write events to Timestream
 * - CloudWatch dashboard with 6 AI-DORA metric panels
 * - CloudWatch alarms for key thresholds
 */

import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as timestream from "aws-cdk-lib/aws-timestream";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

export class PrismDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- Storage ----

    const database = new timestream.CfnDatabase(this, "PrismMetricsDb", {
      databaseName: "prism_metrics",
    });

    const table = new timestream.CfnTable(this, "PrismMetricsTable", {
      databaseName: database.databaseName!,
      tableName: "ai_dora_metrics",
      retentionProperties: {
        memoryStoreRetentionPeriodInHours: "24",
        magneticStoreRetentionPeriodInDays: "365",
      },
    });
    table.addDependency(database);

    // ---- Ingestion ----

    const metricBus = new events.EventBus(this, "PrismMetricBus", {
      eventBusName: "prism-metrics",
    });

    const writerFn = new lambda.Function(this, "MetricWriter", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        const { TimestreamWriteClient, WriteRecordsCommand } = require("@aws-sdk/client-timestream-write");
        const client = new TimestreamWriteClient({});

        exports.handler = async (event) => {
          const detail = typeof event.detail === "string" ? JSON.parse(event.detail) : event.detail;
          const detailType = event["detail-type"];
          const now = Date.now().toString();

          const dimensions = [
            { Name: "repo", Value: detail.repo || "unknown" },
            { Name: "author", Value: detail.author || detail.pr_author || "unknown" },
            { Name: "ai_origin", Value: detail.ai_origin || "unknown" },
            { Name: "branch", Value: detail.branch || "main" },
          ];

          const records = [];

          if (detailType === "CommitMetric") {
            records.push(
              { MeasureName: "lines_added", MeasureValue: String(detail.lines_added || 0), MeasureValueType: "BIGINT", Time: now, Dimensions: dimensions },
              { MeasureName: "lines_removed", MeasureValue: String(detail.lines_removed || 0), MeasureValueType: "BIGINT", Time: now, Dimensions: dimensions },
              { MeasureName: "files_changed", MeasureValue: String(detail.files_changed || 0), MeasureValueType: "BIGINT", Time: now, Dimensions: dimensions },
              { MeasureName: "commit_count", MeasureValue: "1", MeasureValueType: "BIGINT", Time: now, Dimensions: dimensions }
            );
          } else if (detailType === "PRMetric") {
            dimensions.push({ Name: "pr_number", Value: String(detail.pr_number) });
            records.push(
              { MeasureName: "lead_time_seconds", MeasureValue: String(detail.lead_time_seconds || 0), MeasureValueType: "BIGINT", Time: now, Dimensions: dimensions },
              { MeasureName: "ai_contribution_ratio", MeasureValue: String(detail.ai_contribution_ratio || 0), MeasureValueType: "DOUBLE", Time: now, Dimensions: dimensions }
            );
          } else if (detailType === "EvalGateResult") {
            dimensions.push({ Name: "rubric", Value: detail.rubric || "unknown" });
            records.push(
              { MeasureName: "eval_pass", MeasureValue: detail.result === "success" ? "1" : "0", MeasureValueType: "BIGINT", Time: now, Dimensions: dimensions }
            );
          }

          if (records.length > 0) {
            await client.send(new WriteRecordsCommand({
              DatabaseName: "prism_metrics",
              TableName: "ai_dora_metrics",
              Records: records,
            }));
            console.log("Wrote", records.length, "records for", detailType);
          }
        };
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
    });

    writerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["timestream:WriteRecords", "timestream:DescribeEndpoints"],
        resources: ["*"],
      })
    );

    new events.Rule(this, "PrismMetricRule", {
      eventBus: metricBus,
      eventPattern: { source: ["prism.d1.velocity"] },
      targets: [new targets.LambdaFunction(writerFn)],
    });

    // ---- Dashboard ----

    const dashboard = new cloudwatch.Dashboard(this, "PrismTeamDashboard", {
      dashboardName: "PRISM-D1-Team-Velocity",
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown:
          "# PRISM D1 Velocity -- Team Dashboard\n" +
          "AI-DORA Metrics | Real-time engineering velocity with AI contribution tracking\n\n" +
          "Data source: Timestream `prism_metrics.ai_dora_metrics` | " +
          "Updated on every push to main",
        width: 24,
        height: 2,
      })
    );

    // ---- Alarms ----

    const alertTopic = new sns.Topic(this, "PrismAlertTopic", {
      topicName: "prism-d1-alerts",
      displayName: "PRISM D1 Velocity Alerts",
    });

    // AI Acceptance Rate alarm
    new cloudwatch.Alarm(this, "AcceptanceRateLow", {
      alarmName: "PRISM-AI-Acceptance-Rate-Low",
      alarmDescription:
        "AI acceptance rate dropped below 70% over the last 6 hours",
      metric: new cloudwatch.Metric({
        namespace: "PRISM/D1/Velocity",
        metricName: "EvalGatePassRate",
        dimensionsMap: { Rubric: "api_spec_compliance" },
        statistic: "Average",
        period: cdk.Duration.hours(1),
      }),
      evaluationPeriods: 6,
      threshold: 0.7,
      comparisonOperator:
        cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Deploy frequency alarm
    new cloudwatch.Alarm(this, "DeployFrequencyLow", {
      alarmName: "PRISM-Deploy-Frequency-Anomaly",
      alarmDescription:
        "Deployment frequency dropped below 1 per day for 2 consecutive days",
      metric: new cloudwatch.Metric({
        namespace: "PRISM/D1/Velocity",
        metricName: "DeploymentCount",
        statistic: "Sum",
        period: cdk.Duration.days(1),
      }),
      evaluationPeriods: 2,
      threshold: 1,
      comparisonOperator:
        cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    // ---- Outputs ----

    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards/dashboard/PRISM-D1-Team-Velocity`,
    });

    new cdk.CfnOutput(this, "EventBusArn", {
      value: metricBus.eventBusArn,
    });

    new cdk.CfnOutput(this, "AlertTopicArn", {
      value: alertTopic.topicArn,
    });

    new cdk.CfnOutput(this, "TimestreamTable", {
      value: `${database.databaseName}.${table.tableName}`,
    });
  }
}
