# PRISM D1 CI Metadata Emitter

A GitHub Actions composite action that collects AI-DLC metrics from git history and CI context, then emits structured PRISM events to Amazon EventBridge.

## Prerequisites

- AWS account with an EventBridge bus named `prism-d1-metrics` (or custom name)
- GitHub OIDC configured for AWS authentication
- IAM role with `events:PutEvents` permission on the target bus
- `jq` and `bc` available in the runner (pre-installed on ubuntu runners)

## Usage

```yaml
name: Deploy
on:
  push:
    branches: [main]

permissions:
  id-token: write   # Required for OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      PRISM_AWS_ROLE_ARN: arn:aws:iam::123456789012:role/prism-d1-github-actions
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history needed for commit analysis

      - name: Deploy application
        run: ./deploy.sh

      - name: Emit PRISM metrics
        uses: ./collector/ci-metadata-emitter
        with:
          event-type: deploy
          team-id: my-team
          aws-region: us-west-2
          base-ref: origin/main
```

### Pull Request Workflow

```yaml
name: PR Metrics
on:
  pull_request:
    types: [closed]

jobs:
  metrics:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    env:
      PRISM_AWS_ROLE_ARN: arn:aws:iam::123456789012:role/prism-d1-github-actions
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Emit PR metrics
        uses: ./collector/ci-metadata-emitter
        with:
          event-type: pr
          team-id: my-team
          base-ref: ${{ github.event.pull_request.base.sha }}
```

## Inputs

| Input          | Required | Default           | Description                              |
|----------------|----------|-------------------|------------------------------------------|
| `event-type`   | Yes      | `deploy`          | Event type: `deploy` or `pr`             |
| `team-id`      | Yes      | —                 | PRISM team identifier                    |
| `aws-region`   | No       | `us-west-2`       | AWS region for EventBridge               |
| `event-bus-name` | No     | `prism-d1-metrics` | EventBridge bus name                    |
| `base-ref`     | No       | `origin/main`     | Base ref for commit range analysis       |

## Outputs

| Output              | Description                                   |
|---------------------|-----------------------------------------------|
| `events-emitted`    | Number of EventBridge events emitted           |
| `ai-to-merge-ratio` | Ratio of AI-origin commits to total commits   |

## What It Collects

The emitter analyzes commits between `base-ref` and HEAD to extract:

- **Commit count**: Total, AI-origin, and human commits
- **AI-Origin trailers**: Parses `AI-Origin: ai-generated|ai-assisted|human` from commit messages
- **AI-to-merge ratio**: Fraction of commits with AI origin trailers
- **Diff stats**: Files changed, lines inserted/deleted
- **Lead time** (PR events): Time from PR creation to merge
- **Workflow metadata**: Run ID, SHA, ref

## Event Schema

Events are emitted to EventBridge with source `prism.d1.velocity` and follow the PRISM metrics schema. See the root `CLAUDE.md` for the full schema reference.
