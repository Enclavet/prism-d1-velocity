# Metric Hooks

Git hooks for local metric collection in the PRISM D1 Velocity workflow. These hooks automatically tag commits with AI origin metadata and emit metric events.

## What the Hooks Do

| Hook | When It Runs | What It Does |
|---|---|---|
| `prepare-commit-msg` | Before commit message editor opens | Detects AI tool usage, adds `AI-Origin`, `AI-Tool`, `AI-Model`, and `Spec-Ref` trailers |
| `post-commit` | After a successful commit | Reads trailers, calculates diff stats, emits `prism.d1.commit` event, stores local metric |
| `post-merge` | After a successful merge/pull | Calculates merge lead time and AI ratio, emits `prism.d1.pr` event |

## Installation

### Quick Install

```bash
cd your-repo
chmod +x path/to/bootstrapper/metric-hooks/install.sh
path/to/bootstrapper/metric-hooks/install.sh
```

### Non-Interactive Install

```bash
path/to/bootstrapper/metric-hooks/install.sh --team-id my-team
```

### Manual Install

```bash
cp metric-hooks/prepare-commit-msg .git/hooks/
cp metric-hooks/post-commit .git/hooks/
cp metric-hooks/post-merge .git/hooks/
chmod +x .git/hooks/prepare-commit-msg .git/hooks/post-commit .git/hooks/post-merge
mkdir -p .prism/metrics
cp metric-hooks/config.json.template .prism/config.json
# Edit .prism/config.json with your team_id and repo name
```

### Uninstall

```bash
path/to/bootstrapper/metric-hooks/install.sh --uninstall
```

## Prerequisites

- **jq** — Required for JSON processing in hooks.
  - macOS: `brew install jq`
  - Linux: `sudo apt install jq`

- **AWS CLI v2** — Required for EventBridge emission (optional; hooks work without it in local-only mode).
  - Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

## Configuration

The hooks read from `.prism/config.json`:

```json
{
  "team_id": "your-team",
  "repo": "your-repo",
  "event_bus": "prism-d1-metrics",
  "aws_region": "us-west-2",
  "emit_to_eventbridge": true,
  "store_local": true,
  "prism_level": 2
}
```

| Field | Description |
|---|---|
| `team_id` | Your team identifier for metric attribution |
| `repo` | Repository name |
| `event_bus` | EventBridge custom bus name |
| `aws_region` | AWS region for EventBridge |
| `emit_to_eventbridge` | Set to `false` to disable EventBridge emission |
| `store_local` | Set to `false` to disable local metric storage |
| `prism_level` | Your team's PRISM maturity level (1-5) |

## How AI Detection Works

The `prepare-commit-msg` hook checks for AI tool involvement in this order:

1. **Environment variables**: Claude Code sets `CLAUDE_CODE` or `CLAUDE_SESSION_ID`; Kiro sets `KIRO_SESSION`; Q Developer sets `Q_DEVELOPER_SESSION`.
2. **Commit message content**: Checks for "Co-Authored-By: Claude" or similar markers.
3. **Default**: If no AI indicators are found, the commit is tagged as `AI-Origin: human`.

### Trailer Format

```
feat: add order creation endpoint

AI-Origin: ai-assisted
AI-Tool: claude-code
AI-Model: anthropic.claude-sonnet-4-20250514
Spec-Ref: specs/create-order-endpoint.md
```

## Local Metrics

When `store_local` is `true`, metrics are saved as JSON files in `.prism/metrics/`:

```
.prism/
  config.json
  metrics/
    commit-1713000000-12345.json
    merge-1713000100-12346.json
  eval-results/
    eval-1713000200-12347.json
```

These files are gitignored by default (the installer adds them to `.gitignore`).

## Performance

The hooks are designed to be lightweight:

- `prepare-commit-msg`: < 100ms (environment variable checks, file reads)
- `post-commit`: < 500ms (diff stats + async EventBridge call)
- `post-merge`: < 500ms (git log analysis + async EventBridge call)

EventBridge calls are made in background subshells (`&`) so they never block the git operation.

## Safety

The hooks follow these safety rules:

- **Never block a commit or merge.** All hooks exit 0 even if metric emission fails.
- **Non-destructive.** Hooks only append trailers and emit events; they never modify code.
- **Async network calls.** EventBridge emission runs in the background.
- **Graceful degradation.** Missing `jq`, `aws`, or config file will not break the hook.

## Troubleshooting

| Issue | Solution |
|---|---|
| Trailers not appearing | Verify the hook is in `.git/hooks/prepare-commit-msg` and is executable |
| "jq: command not found" in hook output | Install jq: `brew install jq` or `sudo apt install jq` |
| EventBridge events not arriving | Check AWS credentials: `aws sts get-caller-identity` |
| Metrics not stored locally | Verify `.prism/metrics/` directory exists and is writable |
| Hook conflicts with existing hooks | The installer backs up existing hooks as `<hook>.pre-prism` |
| Want to disable EventBridge | Set `emit_to_eventbridge` to `false` in `.prism/config.json` |
