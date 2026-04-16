# Exercise 1: Deploy the CloudWatch Team Dashboard

**Time:** 10 minutes

## Objective

Deploy the PRISM D1 Velocity CloudWatch dashboard that visualizes the 6 AI-DORA metrics from your team's commit and CI data.

## Steps

### Step 1: Navigate to the infrastructure directory

```bash
cd prism-d1-sample-app/infra
```

If the `infra` directory doesn't exist, create the CDK project:

```bash
mkdir -p infra && cd infra
npx cdk init app --language typescript
npm install @aws-cdk/aws-timestream-alpha @aws-cdk/aws-events-targets-alpha
```

### Step 2: Create the dashboard stack

Create `infra/lib/prism-dashboard-stack.ts`:

```typescript
import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as timestream from "aws-cdk-lib/aws-timestream";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class PrismDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Timestream database and table for metric storage
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

    // EventBridge rule to capture PRISM metrics
    const metricBus = new events.EventBus(this, "PrismMetricBus", {
      eventBusName: "prism-metrics",
    });

    // Lambda to write EventBridge events to Timestream
    const writerFn = new lambda.Function(this, "MetricWriter", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        const { TimestreamWriteClient, WriteRecordsCommand } = require("@aws-sdk/client-timestream-write");
        const client = new TimestreamWriteClient({});

        exports.handler = async (event) => {
          const detail = typeof event.detail === "string" ? JSON.parse(event.detail) : event.detail;
          const detailType = event["detail-type"];

          const dimensions = [
            { Name: "repo", Value: detail.repo || "unknown" },
            { Name: "author", Value: detail.author || detail.pr_author || "unknown" },
            { Name: "ai_origin", Value: detail.ai_origin || "unknown" },
            { Name: "branch", Value: detail.branch || "main" },
          ];

          const records = [];
          const now = Date.now().toString();

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
          }
        };
      `),
      timeout: cdk.Duration.seconds(30),
    });

    writerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["timestream:WriteRecords", "timestream:DescribeEndpoints"],
        resources: ["*"],
      })
    );

    // Route all PRISM events to the writer Lambda
    new events.Rule(this, "PrismMetricRule", {
      eventBus: metricBus,
      eventPattern: {
        source: ["prism.d1.velocity"],
      },
      targets: [new targets.LambdaFunction(writerFn)],
    });

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, "PrismTeamDashboard", {
      dashboardName: "PRISM-D1-Team-Velocity",
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // Row 1: Commit Activity
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# PRISM D1 Velocity -- Team Dashboard\nAI-DORA Metrics | Real-time engineering velocity with AI contribution tracking",
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.CustomWidget({
        functionArn: writerFn.functionArn,
        title: "AI Contribution Ratio (7d)",
        width: 8,
        height: 6,
      }),
      new cloudwatch.CustomWidget({
        functionArn: writerFn.functionArn,
        title: "AI Acceptance Rate (7d)",
        width: 8,
        height: 6,
      }),
      new cloudwatch.CustomWidget({
        functionArn: writerFn.functionArn,
        title: "Deployment Frequency (7d)",
        width: 8,
        height: 6,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.CustomWidget({
        functionArn: writerFn.functionArn,
        title: "Lead Time for Changes (7d)",
        width: 8,
        height: 6,
      }),
      new cloudwatch.CustomWidget({
        functionArn: writerFn.functionArn,
        title: "Commits by AI Origin",
        width: 8,
        height: 6,
      }),
      new cloudwatch.CustomWidget({
        functionArn: writerFn.functionArn,
        title: "Eval Gate Pass Rate (7d)",
        width: 8,
        height: 6,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards/dashboard/PRISM-D1-Team-Velocity`,
      description: "CloudWatch Dashboard URL",
    });

    new cdk.CfnOutput(this, "EventBusArn", {
      value: metricBus.eventBusArn,
      description: "EventBridge bus ARN for PRISM metrics",
    });

    new cdk.CfnOutput(this, "TimestreamDatabase", {
      value: database.databaseName!,
      description: "Timestream database name",
    });
  }
}
```

### Step 3: Update the CDK app entry point

Edit `infra/bin/infra.ts`:

```typescript
#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PrismDashboardStack } from "../lib/prism-dashboard-stack";

const app = new cdk.App();
new PrismDashboardStack(app, "PrismDashboardStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-west-2",
  },
});
```

### Step 4: Deploy

```bash
cd infra
npm install
npx cdk bootstrap   # Only needed once per account/region
npx cdk deploy PrismDashboardStack --require-approval never
```

Deployment takes 2-3 minutes. Note the outputs:
- **DashboardUrl** -- Open this in your browser
- **EventBusArn** -- Your CI workflow sends metrics here
- **TimestreamDatabase** -- Where metrics are stored

### Step 5: Open the dashboard

Open the DashboardUrl from the CDK output in your browser. You should see:
- 6 panels, mostly empty (we'll populate them in Exercise 2)
- The header text with the dashboard title
- Time range selector in the top right (set to 1 week)

## Verification

You've completed this exercise when:
- [ ] CDK deploy succeeded with no errors
- [ ] Dashboard URL opens in the CloudWatch console
- [ ] You can see all 6 metric panels (even if empty)
- [ ] EventBridge bus `prism-metrics` exists in your account
