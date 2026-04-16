# GitHub Actions Workflows

Reusable GitHub Actions workflows for PRISM D1 Velocity metric collection.

## Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `prism-ai-metrics.yml` | PR merge to main | Calculates AI-to-merge ratio and lead time, emits `prism.d1.pr` and `prism.d1.deploy` events |
| `prism-eval-gate.yml` | PR open/update | Runs Bedrock Evaluation on AI-generated code, posts score as PR comment, blocks merge if below threshold |
| `prism-dora-weekly.yml` | Weekly (Monday 09:00 UTC) | Calculates all 4 DORA + 6 AI-DORA metrics, emits `prism.d1.assessment` event |

## Setup

### 1. Configure AWS OIDC

GitHub Actions uses OpenID Connect (OIDC) to assume an AWS IAM role — no long-lived access keys needed.

**In AWS:**

1. Create an OIDC identity provider for `token.actions.githubusercontent.com`.
2. Create an IAM role with a trust policy scoped to your repository:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {
         "Federated": "arn:aws:iam::ACCOUNT_ID::oidc-provider/token.actions.githubusercontent.com"
       },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
         },
         "StringLike": {
           "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
         }
       }
     }]
   }
   ```

3. Attach a policy with these permissions:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "events:PutEvents",
         "Resource": "arn:aws:events:us-west-2:ACCOUNT_ID:event-bus/prism-d1-metrics"
       },
       {
         "Effect": "Allow",
         "Action": "bedrock:InvokeModel",
         "Resource": "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-20250514"
       }
     ]
   }
   ```

### 2. Set Repository Variables

In your GitHub repository, go to Settings > Secrets and variables > Actions > Variables, and add:

| Variable | Value |
|---|---|
| `PRISM_TEAM_ID` | Your team identifier (e.g., `team-payments`) |
| `PRISM_AWS_ROLE_ARN` | The ARN of the IAM role created above |

### 3. Copy Workflows to Your Repo

```bash
mkdir -p .github/workflows
cp bootstrapper/github-workflows/prism-ai-metrics.yml .github/workflows/
cp bootstrapper/github-workflows/prism-eval-gate.yml .github/workflows/
cp bootstrapper/github-workflows/prism-dora-weekly.yml .github/workflows/
```

### 4. Copy Eval Harness (for eval-gate workflow)

```bash
cp -r bootstrapper/eval-harness/ eval-harness/
chmod +x eval-harness/run-eval.sh
```

## Customization

### Changing the branch

All workflows default to `main` and `master`. Edit the `branches` field in each workflow to match your default branch.

### Changing the AWS region

Replace `us-west-2` in the `aws-region` field and EventBridge commands.

### Adjusting the eval threshold

Edit `eval-harness/eval-config.json` to change the `pass_threshold`.

### Changing the weekly schedule

Edit the cron expression in `prism-dora-weekly.yml`. The default is Monday at 09:00 UTC.

```yaml
schedule:
  - cron: '0 9 * * 1'  # Monday 09:00 UTC
```

### Adding QuickSight dataset refresh

Add a step to the weekly workflow to trigger a QuickSight dataset refresh:

```yaml
- name: Refresh QuickSight dataset
  run: |
    aws quicksight create-ingestion \
      --aws-account-id "${{ secrets.AWS_ACCOUNT_ID }}" \
      --data-set-id "prism-d1-metrics-dataset" \
      --ingestion-id "weekly-$(date +%Y%m%d)" \
      --region us-west-2
```

## Events Emitted

| Event | Detail Type | Workflow |
|---|---|---|
| PR metrics | `prism.d1.pr` | `prism-ai-metrics.yml` |
| Deployment | `prism.d1.deploy` | `prism-ai-metrics.yml` |
| Eval result | `prism.d1.eval` | `prism-eval-gate.yml` |
| Weekly assessment | `prism.d1.assessment` | `prism-dora-weekly.yml` |

All events are sent to the `prism-d1-metrics` EventBridge bus with source `prism.d1.velocity`.

## Troubleshooting

| Issue | Solution |
|---|---|
| OIDC auth fails | Verify the trust policy `sub` condition matches your repo exactly |
| EventBridge put fails | Verify the IAM role has `events:PutEvents` on the correct bus ARN |
| Eval gate always skips | Ensure commits have `AI-Origin:` trailers (install the git hooks) |
| Weekly workflow not running | Check that the default branch has the workflow file; manually trigger with `workflow_dispatch` to test |
| Lead time is 0 | Ensure `fetch-depth: 0` is set in the checkout step |
