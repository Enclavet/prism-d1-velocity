# Exercise 3: Configure GitHub Actions Metric Emission

**Time:** 10 minutes

## Objective

Add a GitHub Actions workflow that extracts AI origin trailers from commits and emits them as structured events to Amazon EventBridge on every push to `main`.

## Steps

### Step 1: Create the workflow directory

```bash
cd prism-d1-sample-app
mkdir -p .github/workflows
```

### Step 2: Create the workflow file

Create `.github/workflows/prism-metrics.yml`:

```yaml
name: PRISM AI Metrics

on:
  push:
    branches: [main]
  pull_request:
    types: [closed]
    branches: [main]

permissions:
  id-token: write   # For OIDC auth with AWS
  contents: read

jobs:
  emit-metrics:
    runs-on: ubuntu-latest
    if: >
      github.event_name == 'push' ||
      (github.event_name == 'pull_request' && github.event.pull_request.merged == true)

    steps:
      - name: Checkout with full history
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Need full history for trailer extraction

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.PRISM_METRICS_ROLE_ARN }}
          aws-region: us-west-2

      - name: Install jq
        run: sudo apt-get install -y jq

      - name: Extract commit metrics and emit to EventBridge
        env:
          EVENT_BUS_NAME: ${{ vars.PRISM_EVENT_BUS_NAME || 'prism-metrics' }}
          REPO_NAME: ${{ github.repository }}
        run: |
          # Determine commit range
          if [ "${{ github.event_name }}" = "push" ]; then
            # On push, process commits in this push
            BEFORE="${{ github.event.before }}"
            AFTER="${{ github.event.after }}"

            # Handle first push (no previous commit)
            if [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
              COMMITS=$(git rev-list "$AFTER" --max-count=20)
            else
              COMMITS=$(git rev-list "$BEFORE".."$AFTER")
            fi
          else
            # On merged PR, process all commits in the PR
            COMMITS=$(git rev-list "${{ github.event.pull_request.base.sha }}"..HEAD)
          fi

          # Process each commit
          ENTRIES="[]"
          for COMMIT in $COMMITS; do
            # Extract trailer values
            AI_ORIGIN=$(git log -1 --format='%(trailers:key=AI-Origin,valueonly)' "$COMMIT" | tr -d '[:space:]')
            AI_MODEL=$(git log -1 --format='%(trailers:key=AI-Model,valueonly)' "$COMMIT" | tr -d '[:space:]')
            AI_CONFIDENCE=$(git log -1 --format='%(trailers:key=AI-Confidence,valueonly)' "$COMMIT" | tr -d '[:space:]')
            SPEC_REF=$(git log -1 --format='%(trailers:key=Spec,valueonly)' "$COMMIT" | tr -d '[:space:]')
            AUTHOR=$(git log -1 --format='%ae' "$COMMIT")
            COMMIT_DATE=$(git log -1 --format='%aI' "$COMMIT")
            SUBJECT=$(git log -1 --format='%s' "$COMMIT")

            # Count changes
            FILES_CHANGED=$(git diff-tree --no-commit-id --name-only -r "$COMMIT" | wc -l | tr -d '[:space:]')
            LINES_ADDED=$(git diff-tree --no-commit-id --numstat -r "$COMMIT" | awk '{sum += $1} END {print sum+0}')
            LINES_REMOVED=$(git diff-tree --no-commit-id --numstat -r "$COMMIT" | awk '{sum += $2} END {print sum+0}')

            # Default AI-Origin to "unknown" if missing
            AI_ORIGIN="${AI_ORIGIN:-unknown}"

            # Build EventBridge entry
            DETAIL=$(jq -n \
              --arg commit "$COMMIT" \
              --arg author "$AUTHOR" \
              --arg date "$COMMIT_DATE" \
              --arg subject "$SUBJECT" \
              --arg repo "$REPO_NAME" \
              --arg branch "${{ github.ref_name }}" \
              --arg ai_origin "$AI_ORIGIN" \
              --arg ai_model "$AI_MODEL" \
              --arg ai_confidence "$AI_CONFIDENCE" \
              --arg spec_ref "$SPEC_REF" \
              --argjson files_changed "$FILES_CHANGED" \
              --argjson lines_added "$LINES_ADDED" \
              --argjson lines_removed "$LINES_REMOVED" \
              '{
                commit: $commit,
                author: $author,
                date: $date,
                subject: $subject,
                repo: $repo,
                branch: $branch,
                ai_origin: $ai_origin,
                ai_model: $ai_model,
                ai_confidence: $ai_confidence,
                spec_ref: $spec_ref,
                files_changed: $files_changed,
                lines_added: $lines_added,
                lines_removed: $lines_removed
              }')

            ENTRY=$(jq -n \
              --arg source "prism.d1.velocity" \
              --arg detail_type "CommitMetric" \
              --arg bus "$EVENT_BUS_NAME" \
              --arg detail "$DETAIL" \
              '{
                Source: $source,
                DetailType: $detail_type,
                EventBusName: $bus,
                Detail: $detail
              }')

            ENTRIES=$(echo "$ENTRIES" | jq --argjson entry "$ENTRY" '. + [$entry]')

            echo "Processed commit $COMMIT: AI-Origin=$AI_ORIGIN"
          done

          # Emit to EventBridge (batch of up to 10 entries at a time)
          TOTAL=$(echo "$ENTRIES" | jq length)
          echo "Emitting $TOTAL commit metrics to EventBridge..."

          for i in $(seq 0 9 $((TOTAL - 1))); do
            BATCH=$(echo "$ENTRIES" | jq ".[$i:$((i+10))]")
            aws events put-events --entries "$BATCH"
          done

          echo "Done. $TOTAL metrics emitted."

      - name: Emit PR-level metrics (on merge only)
        if: github.event_name == 'pull_request'
        env:
          EVENT_BUS_NAME: ${{ vars.PRISM_EVENT_BUS_NAME || 'prism-metrics' }}
        run: |
          PR_NUMBER="${{ github.event.pull_request.number }}"
          PR_TITLE="${{ github.event.pull_request.title }}"
          PR_AUTHOR="${{ github.event.pull_request.user.login }}"
          PR_CREATED="${{ github.event.pull_request.created_at }}"
          PR_MERGED="${{ github.event.pull_request.merged_at }}"

          # Calculate PR lead time (created to merged)
          CREATED_TS=$(date -d "$PR_CREATED" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$PR_CREATED" +%s)
          MERGED_TS=$(date -d "$PR_MERGED" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$PR_MERGED" +%s)
          LEAD_TIME_SECONDS=$((MERGED_TS - CREATED_TS))

          # Count AI vs human commits in the PR
          TOTAL_COMMITS=$(git rev-list "${{ github.event.pull_request.base.sha }}"..HEAD | wc -l | tr -d '[:space:]')
          AI_COMMITS=$(git log "${{ github.event.pull_request.base.sha }}"..HEAD --format='%(trailers:key=AI-Origin,valueonly)' | grep -c "claude-code" || true)

          AI_RATIO=0
          if [ "$TOTAL_COMMITS" -gt 0 ]; then
            AI_RATIO=$(echo "scale=4; $AI_COMMITS / $TOTAL_COMMITS" | bc)
          fi

          DETAIL=$(jq -n \
            --argjson pr_number "$PR_NUMBER" \
            --arg pr_title "$PR_TITLE" \
            --arg pr_author "$PR_AUTHOR" \
            --arg repo "${{ github.repository }}" \
            --argjson lead_time_seconds "$LEAD_TIME_SECONDS" \
            --argjson total_commits "$TOTAL_COMMITS" \
            --argjson ai_commits "$AI_COMMITS" \
            --arg ai_ratio "$AI_RATIO" \
            '{
              pr_number: $pr_number,
              pr_title: $pr_title,
              pr_author: $pr_author,
              repo: $repo,
              lead_time_seconds: $lead_time_seconds,
              total_commits: $total_commits,
              ai_commits: $ai_commits,
              ai_contribution_ratio: ($ai_ratio | tonumber)
            }')

          aws events put-events --entries "[{
            \"Source\": \"prism.d1.velocity\",
            \"DetailType\": \"PRMetric\",
            \"EventBusName\": \"$EVENT_BUS_NAME\",
            \"Detail\": $(echo "$DETAIL" | jq -Rs .)
          }]"

          echo "PR #$PR_NUMBER metrics emitted. Lead time: ${LEAD_TIME_SECONDS}s, AI ratio: $AI_RATIO"
```

### Step 3: Understand the workflow

Walk through what happens:

1. **Trigger:** Runs on push to `main` or when a PR merges into `main`
2. **Checkout with full history:** We need `fetch-depth: 0` to access all commits and their trailers
3. **AWS auth:** Uses OIDC to assume an IAM role that can write to EventBridge
4. **Commit-level metrics:** For each commit in the push, extract trailers and emit a `CommitMetric` event
5. **PR-level metrics:** On merged PRs, calculate lead time and AI contribution ratio, emit a `PRMetric` event

### Step 4: Dry-run the extraction locally

You can test the extraction logic without pushing to GitHub:

```bash
# Simulate the extraction for your last 3 commits
for COMMIT in $(git rev-list HEAD~3..HEAD); do
  AI_ORIGIN=$(git log -1 --format='%(trailers:key=AI-Origin,valueonly)' "$COMMIT" | tr -d '[:space:]')
  SUBJECT=$(git log -1 --format='%s' "$COMMIT")
  echo "$COMMIT | $SUBJECT | AI-Origin: ${AI_ORIGIN:-unknown}"
done
```

### Step 5: Commit the workflow

```bash
git add .github/workflows/prism-metrics.yml
git commit -m "ci: add PRISM AI metrics emission workflow

Extracts AI origin trailers from commits and emits to EventBridge
on push to main and PR merge."
```

## Verification

You've completed this exercise when:
- [ ] `.github/workflows/prism-metrics.yml` exists and is valid YAML
- [ ] The local dry-run correctly extracts AI-Origin from your 3 test commits
- [ ] You understand the difference between commit-level and PR-level metrics
- [ ] The workflow is committed to your repo

## What's Next

When this workflow runs in CI, the EventBridge events it emits are captured by rules that write to Timestream. In Module 05, you'll deploy the dashboards that query Timestream and visualize these metrics. The pipeline is:

```
Git Trailers --> GitHub Actions --> EventBridge --> Timestream --> Dashboard
     ^                                                              |
     |                                                              |
  (Module 03)                                               (Module 05)
```
