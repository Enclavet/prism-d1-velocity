# Bedrock Evaluation Harness

Run AI code evaluations using Amazon Bedrock and emit results as PRISM metrics.

## Prerequisites

- **AWS CLI v2** installed and configured with access to Bedrock.
- **jq** installed (`brew install jq` on macOS, `sudo apt install jq` on Linux).
- **Bedrock model access** enabled for `anthropic.claude-sonnet-4-20250514` in your target region.

## Quick Start

```bash
# Make the script executable
chmod +x run-eval.sh

# Run an evaluation
./run-eval.sh rubrics/code-quality.json path/to/your/code.ts
```

## Configuration

Edit `eval-config.json` to customize:

| Field | Description | Default |
|---|---|---|
| `pass_threshold` | Minimum score to pass (0-1) | `0.82` |
| `model_id` | Bedrock model for code generation | `anthropic.claude-sonnet-4-20250514` |
| `eval_model_id` | Bedrock model for evaluation | `anthropic.claude-sonnet-4-20250514` |
| `event_bus` | EventBridge bus name | `prism-d1-metrics` |
| `aws_region` | AWS region | `us-west-2` |
| `output_dir` | Local results directory | `.prism/eval-results` |
| `emit_to_eventbridge` | Send events to EventBridge | `true` |

## Rubrics

Three rubrics are included:

| Rubric | Use For |
|---|---|
| `rubrics/api-response-quality.json` | API endpoint implementations |
| `rubrics/code-quality.json` | General code quality |
| `rubrics/security-compliance.json` | Security-sensitive code |

### Rubric Structure

Each rubric contains weighted criteria scored 1-5. The overall score is a weighted average normalized to 0-1. A score >= `pass_threshold` is a pass.

### Creating Custom Rubrics

Copy an existing rubric and modify:

```bash
cp rubrics/code-quality.json rubrics/my-custom-rubric.json
# Edit criteria, weights, and scoring descriptions
```

## Usage

### Basic

```bash
./run-eval.sh rubrics/code-quality.json src/handler.ts
```

### Evaluate a directory

```bash
./run-eval.sh rubrics/api-response-quality.json src/api/
```

### Custom config

```bash
./run-eval.sh rubrics/code-quality.json src/handler.ts --config my-config.json
```

## Output

Results are saved to `.prism/eval-results/` as JSON files. Each result includes:

- Overall score and pass/fail status
- Per-criterion scores with reasoning
- Timestamp and eval ID

## EventBridge Events

On completion, the harness emits a `prism.d1.eval` event to the configured EventBridge bus:

```json
{
  "source": "prism.d1.velocity",
  "detail-type": "prism.d1.eval",
  "detail": {
    "team_id": "your-team",
    "repo": "your-repo",
    "metric": { "name": "eval_score", "value": 0.88, "unit": "score" },
    "eval": { "rubric": "code-quality", "result": "PASS", "score": 0.88 }
  }
}
```

## Integration with CI

The `prism-eval-gate.yml` GitHub workflow calls this script automatically on PRs. See `github-workflows/README.md` for setup.

## Troubleshooting

| Issue | Solution |
|---|---|
| `aws: command not found` | Install AWS CLI v2 |
| `jq: command not found` | Install jq |
| Bedrock invocation failed | Verify model access is enabled in your region |
| Score always 0 | Check that the Bedrock response is valid JSON |
| EventBridge emit failed | Verify the `prism-d1-metrics` bus exists and IAM permissions allow `events:PutEvents` |
