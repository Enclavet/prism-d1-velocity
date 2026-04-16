#!/usr/bin/env bash
# PRISM D1 Velocity -- Sample Metric Data Generator
# Generates 7 days of realistic team commit, PR, and eval data
# and sends it to EventBridge for dashboard population.
#
# Usage:
#   ./generate-sample-data.sh                          # defaults
#   ./generate-sample-data.sh prism-d1-metrics us-west-2
#   AWS_REGION=us-west-2 ./generate-sample-data.sh

set -euo pipefail

EVENT_BUS="${1:-prism-d1-metrics}"
REGION="${2:-${AWS_REGION:-us-west-2}}"
TEAM_ID="${PRISM_TEAM_ID:-demo-team}"

echo "=== PRISM D1 Sample Data Generator ==="
echo "Event bus: $EVENT_BUS"
echo "Region:    $REGION"
echo "Team ID:   $TEAM_ID"
echo ""

# Verify AWS credentials
if ! aws sts get-caller-identity --region "$REGION" &>/dev/null; then
  echo "ERROR: AWS credentials not valid. Run 'aws configure' first."
  exit 1
fi

# Verify event bus exists
if ! aws events describe-event-bus --name "$EVENT_BUS" --region "$REGION" &>/dev/null; then
  echo "ERROR: Event bus '$EVENT_BUS' not found in $REGION."
  echo "Did you run 'npx cdk deploy --all' first?"
  exit 1
fi

# Team configuration
ENGINEERS=("alice" "bob" "carol" "dave" "eve")
REPOS=("prism-d1-sample-app" "frontend-web")
AI_ORIGINS=("human" "ai-assisted" "ai-generated" "ai-assisted")  # 75% AI
TOOLS=("claude-code" "claude-code" "kiro" "claude-code")

TOTAL_EVENTS=0

emit_event() {
  local DETAIL_TYPE="$1"
  local DETAIL="$2"

  aws events put-events \
    --region "$REGION" \
    --entries "[{
      \"Source\": \"prism.d1.velocity\",
      \"DetailType\": \"$DETAIL_TYPE\",
      \"EventBusName\": \"$EVENT_BUS\",
      \"Detail\": $(echo "$DETAIL" | jq -Rs .)
    }]" > /dev/null 2>&1

  ((TOTAL_EVENTS++))
}

# Generate 7 days of data
for DAY_OFFSET in $(seq 7 -1 1); do
  if [[ "$OSTYPE" == "darwin"* ]]; then
    DAY_DATE=$(date -v-"${DAY_OFFSET}d" +%Y-%m-%d)
    DAY_NAME=$(date -v-"${DAY_OFFSET}d" "+%A")
  else
    DAY_DATE=$(date -d "$DAY_OFFSET days ago" +%Y-%m-%d)
    DAY_NAME=$(date -d "$DAY_DATE" "+%A")
  fi

  # Weekend = less activity
  COMMITS_PER_DAY=$((RANDOM % 8 + 12))
  if [ "$DAY_NAME" = "Saturday" ] || [ "$DAY_NAME" = "Sunday" ]; then
    COMMITS_PER_DAY=$((RANDOM % 3 + 1))
  fi

  echo "Generating $COMMITS_PER_DAY events for $DAY_DATE ($DAY_NAME)..."

  # Day 4 is the "bad day" — new engineer using AI without specs
  IS_BAD_DAY=false
  if [ "$DAY_OFFSET" -eq 4 ]; then
    IS_BAD_DAY=true
    echo "  (Bad day scenario — high AI usage, low acceptance)"
  fi

  for COMMIT_NUM in $(seq 1 "$COMMITS_PER_DAY"); do
    ENGINEER=${ENGINEERS[$((RANDOM % ${#ENGINEERS[@]}))]}
    REPO=${REPOS[$((RANDOM % ${#REPOS[@]}))]}
    AI_ORIGIN=${AI_ORIGINS[$((RANDOM % ${#AI_ORIGINS[@]}))]}
    TOOL=${TOOLS[$((RANDOM % ${#TOOLS[@]}))]}

    if [ "$AI_ORIGIN" = "human" ]; then
      TOOL="n/a"
      MODEL="n/a"
    else
      MODEL="us.anthropic.claude-haiku-4-5-20251001-v1:0"
    fi

    # Bad day: eve uses AI for everything
    if [ "$IS_BAD_DAY" = true ] && [ "$ENGINEER" = "eve" ]; then
      AI_ORIGIN="ai-generated"
      TOOL="claude-code"
    fi

    LINES_CHANGED=$((RANDOM % 150 + 10))
    HOUR=$((RANDOM % 10 + 8))
    MINUTE=$((RANDOM % 60))
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $HOUR):$(printf '%02d' $MINUTE):00Z"

    # --- Emit prism.d1.commit ---
    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "$REPO" \
      --arg timestamp "$TIMESTAMP" \
      --arg ai_origin "$AI_ORIGIN" \
      --arg tool "$TOOL" \
      --arg model "$MODEL" \
      --argjson lines_changed "$LINES_CHANGED" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "commit", "value": 1, "unit": "count" },
        "ai_context": { "tool": $tool, "model": $model, "origin": $ai_origin },
        "dora": { "deployment_frequency": null, "lead_time_seconds": null },
        "ai_dora": { "ai_to_merge_ratio": (if $ai_origin != "human" then 1 else 0 end) }
      }')

    emit_event "prism.d1.commit" "$DETAIL"
  done

  # --- Generate 2-4 PR merges per day ---
  PR_COUNT=$((RANDOM % 3 + 2))
  if [ "$DAY_NAME" = "Saturday" ] || [ "$DAY_NAME" = "Sunday" ]; then
    PR_COUNT=$((RANDOM % 2))
  fi

  for PR_NUM in $(seq 1 "$PR_COUNT"); do
    ENGINEER=${ENGINEERS[$((RANDOM % ${#ENGINEERS[@]}))]}
    REPO=${REPOS[$((RANDOM % ${#REPOS[@]}))]}
    TOTAL_COMMITS=$((RANDOM % 5 + 2))
    AI_COMMITS=$((RANDOM % (TOTAL_COMMITS + 1)))

    if [ "$TOTAL_COMMITS" -gt 0 ]; then
      AI_RATIO=$(echo "scale=4; $AI_COMMITS / $TOTAL_COMMITS" | bc -l | sed 's/^\./0./')
    else
      AI_RATIO="0"
    fi

    # Lead time trending down over the week (AI improving velocity)
    BASE_LEAD_TIME=$((3600 * (DAY_OFFSET + 1)))
    LEAD_TIME=$((BASE_LEAD_TIME + RANDOM % 3600))
    LEAD_HOURS=$(echo "scale=2; $LEAD_TIME / 3600" | bc -l | sed 's/^\./0./')

    PR_NUMBER=$((100 + DAY_OFFSET * 10 + PR_NUM))
    HOUR=$((RANDOM % 10 + 8))
    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $HOUR):30:00Z"

    AI_ORIGIN="ai-assisted"
    if [ "$AI_COMMITS" -eq 0 ]; then AI_ORIGIN="human"; fi

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "$REPO" \
      --arg timestamp "$TIMESTAMP" \
      --argjson ai_ratio "$AI_RATIO" \
      --argjson total_commits "$TOTAL_COMMITS" \
      --argjson ai_commits "$AI_COMMITS" \
      --argjson lead_time_seconds "$LEAD_TIME" \
      --argjson lead_time_hours "$LEAD_HOURS" \
      --argjson pr_number "$PR_NUMBER" \
      --arg pr_author "$ENGINEER" \
      --arg ai_origin "$AI_ORIGIN" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "ai_to_merge_ratio", "value": $ai_ratio, "unit": "ratio" },
        "ai_context": { "tool": "github-actions", "model": "n/a", "origin": $ai_origin },
        "dora": { "lead_time_seconds": $lead_time_seconds, "lead_time_hours": $lead_time_hours },
        "ai_dora": {
          "ai_to_merge_ratio": $ai_ratio,
          "total_commits": $total_commits,
          "ai_commits": $ai_commits
        },
        "pr": { "number": $pr_number, "author": $pr_author }
      }')

    emit_event "prism.d1.pr" "$DETAIL"

    # --- Also emit a deploy event per merged PR ---
    DEPLOY_DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "$REPO" \
      --arg timestamp "$TIMESTAMP" \
      --argjson lead_time_hours "$LEAD_HOURS" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "deployment", "value": 1, "unit": "count" },
        "dora": { "deployment_frequency": 1, "lead_time_hours": $lead_time_hours }
      }')

    emit_event "prism.d1.deploy" "$DEPLOY_DETAIL"
  done

  # --- Generate eval gate results ---
  EVAL_COUNT=$((PR_COUNT))
  for EVAL_NUM in $(seq 1 "$EVAL_COUNT"); do
    REPO=${REPOS[$((RANDOM % ${#REPOS[@]}))]}
    PR_NUMBER=$((100 + DAY_OFFSET * 10 + EVAL_NUM))

    # Normal: 85-90% pass. Bad day: 50% pass
    SCORE="0.88"
    RESULT="PASS"
    if [ "$IS_BAD_DAY" = true ] && [ $((RANDOM % 2)) -eq 0 ]; then
      SCORE="0.62"
      RESULT="FAIL"
    elif [ $((RANDOM % 8)) -eq 0 ]; then
      SCORE="0.71"
      RESULT="FAIL"
    fi

    TIMESTAMP="${DAY_DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):45:00Z"

    DETAIL=$(jq -n \
      --arg team_id "$TEAM_ID" \
      --arg repo "$REPO" \
      --arg timestamp "$TIMESTAMP" \
      --argjson score "$SCORE" \
      --arg result "$RESULT" \
      --argjson pr_number "$PR_NUMBER" \
      '{
        "team_id": $team_id,
        "repo": $repo,
        "timestamp": $timestamp,
        "prism_level": 2,
        "metric": { "name": "eval_score", "value": $score, "unit": "score" },
        "ai_context": { "tool": "bedrock-eval", "model": "us.anthropic.claude-haiku-4-5-20251001-v1:0", "origin": "ai-generated" },
        "ai_dora": { "eval_gate_pass_rate": (if $result == "PASS" then 1 else 0 end) },
        "eval": { "result": $result, "pr_number": $pr_number }
      }')

    emit_event "prism.d1.eval" "$DETAIL"
  done
done

echo ""
echo "=== Generation Complete ==="
echo "Total events emitted: $TOTAL_EVENTS"
echo ""
echo "Open CloudWatch → Dashboards → PRISM-D1-Team-Velocity"
echo "Set time range to 'Last 1 week' for the best view."
