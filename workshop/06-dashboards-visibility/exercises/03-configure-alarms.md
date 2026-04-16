# Exercise 3: Configure Alarms for AI Metrics

**Time:** 5 minutes

## Objective

Create CloudWatch alarms that alert the team when AI acceptance rate drops or deployment patterns are anomalous.

## Steps

### Step 1: Create alarm for AI acceptance rate dropping below threshold

The AI acceptance rate is the percentage of eval gates that pass. A drop indicates the team is generating lower-quality AI code -- maybe someone started using Claude Code without specs, or a rubric needs tuning.

```bash
# Create the alarm via AWS CLI
aws cloudwatch put-metric-alarm \
  --alarm-name "PRISM-AI-Acceptance-Rate-Low" \
  --alarm-description "AI acceptance rate dropped below 70% over the last 6 hours" \
  --namespace "PRISM/D1/Velocity" \
  --metric-name "EvalGatePassRate" \
  --dimensions "Name=Rubric,Value=api_spec_compliance" \
  --statistic Average \
  --period 3600 \
  --evaluation-periods 6 \
  --threshold 0.70 \
  --comparison-operator LessThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "${SNS_TOPIC_ARN:-}" \
  --tags "Key=prism:pillar,Value=d1-velocity" "Key=prism:module,Value=dashboards"
```

> Note: Replace `${SNS_TOPIC_ARN}` with your notification topic ARN if you have one. If not, the alarm still triggers -- it just won't send a notification.

### Step 2: Create alarm for deployment frequency anomaly

This detects sudden drops in deployment frequency, which might indicate the pipeline is broken or the team is blocked.

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "PRISM-Deploy-Frequency-Anomaly" \
  --alarm-description "Deployment frequency dropped below 1 per day for 2 consecutive days" \
  --namespace "PRISM/D1/Velocity" \
  --metric-name "DeploymentCount" \
  --statistic Sum \
  --period 86400 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --treat-missing-data breaching \
  --alarm-actions "${SNS_TOPIC_ARN:-}" \
  --tags "Key=prism:pillar,Value=d1-velocity"
```

### Step 3: Create alarm for AI contribution ratio spike

A sudden jump in AI contribution ratio could mean an engineer is generating code faster than the team can review it. This isn't necessarily bad, but it warrants attention.

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "PRISM-AI-Contribution-Spike" \
  --alarm-description "AI contribution ratio exceeded 90% over 4 hours (potential review bottleneck)" \
  --namespace "PRISM/D1/Velocity" \
  --metric-name "AIContributionRatio" \
  --statistic Average \
  --period 3600 \
  --evaluation-periods 4 \
  --threshold 0.90 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "${SNS_TOPIC_ARN:-}" \
  --tags "Key=prism:pillar,Value=d1-velocity"
```

### Step 4: View alarms in the console

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix "PRISM" \
  --query "MetricAlarms[].{Name:AlarmName, State:StateValue, Threshold:Threshold}" \
  --output table
```

Expected output:
```
-----------------------------------------------------------
|                     DescribeAlarms                       |
+---------------------------------+--------+--------------+
|             Name                | State  |  Threshold   |
+---------------------------------+--------+--------------+
|  PRISM-AI-Acceptance-Rate-Low   |  OK    |  0.7         |
|  PRISM-AI-Contribution-Spike    |  OK    |  0.9         |
|  PRISM-Deploy-Frequency-Anomaly |  OK    |  1.0         |
+---------------------------------+--------+--------------+
```

### Step 5: Understand alert thresholds

| Alarm | Threshold | Why This Value |
|-------|-----------|---------------|
| Acceptance Rate Low | < 70% for 6h | Below 70% means more than 3 in 10 AI-generated changes fail quality checks. Short-term dips (1-2 hours) are normal during experimentation. 6 hours means it's a pattern, not noise. |
| Deploy Frequency Anomaly | < 1/day for 2 days | Most teams deploy multiple times per day. Zero deploys for 2 consecutive days likely means the pipeline is broken or the team is blocked. |
| AI Contribution Spike | > 90% for 4h | Very high AI contribution can indicate an engineer is auto-generating code faster than the team reviews it. 4 hours means it's sustained, not a single batch commit. |

### Calibration Guidance

These are starting thresholds for teams at PRISM L2-L2.5. Adjust after collecting 2-4 weeks of baseline data:

- **Lower the acceptance rate threshold** if your rubrics are strict (lots of false positives)
- **Raise it** once the team consistently hits 85%+
- **Deploy frequency** depends on your release process -- daily deploys is aggressive for some teams, conservative for others
- **Contribution spike** -- remove this alarm entirely if your team has strong async code review practices

## Verification

You've completed this exercise when:
- [ ] 3 CloudWatch alarms exist with `PRISM-` prefix
- [ ] All alarms show state `OK` (or `INSUFFICIENT_DATA` if no recent metrics)
- [ ] You understand when each alarm would fire and what action to take
- [ ] You know how to adjust thresholds after collecting baseline data
