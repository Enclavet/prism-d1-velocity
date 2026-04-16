#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# PRISM D1 Metrics Emitter
#
# Parses git log for AI-Origin trailers, calculates AI-to-merge ratio,
# and emits structured events to EventBridge.
#
# Required env vars:
#   PRISM_EVENT_TYPE   — "deploy" or "pr"
#   PRISM_TEAM_ID      — team identifier
#   PRISM_EVENT_BUS    — EventBridge bus name
#   PRISM_BASE_REF     — base ref for commit range (e.g., origin/main)
#   PRISM_REPO         — repository full name (owner/repo)
#   PRISM_SHA          — current commit SHA
# ---------------------------------------------------------------------------

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EVENTS_EMITTED=0

# ---------------------------------------------------------------------------
# Parse git log for AI-Origin trailers
# ---------------------------------------------------------------------------

echo "::group::Analyzing commits since ${PRISM_BASE_REF}"

# Get commits in this merge/push
COMMIT_LOG=$(git log "${PRISM_BASE_REF}..HEAD" --format="%H|%s|%b---COMMIT_END---" 2>/dev/null || echo "")

TOTAL_COMMITS=0
AI_COMMITS=0
AI_GENERATED_COMMITS=0
AI_ASSISTED_COMMITS=0
HUMAN_COMMITS=0

if [ -n "$COMMIT_LOG" ]; then
  while IFS= read -r -d '---COMMIT_END---' commit_block; do
    [ -z "$commit_block" ] && continue
    TOTAL_COMMITS=$((TOTAL_COMMITS + 1))

    # Check for AI-Origin trailer
    if echo "$commit_block" | grep -qi "AI-Origin: ai-generated"; then
      AI_GENERATED_COMMITS=$((AI_GENERATED_COMMITS + 1))
      AI_COMMITS=$((AI_COMMITS + 1))
    elif echo "$commit_block" | grep -qi "AI-Origin: ai-assisted"; then
      AI_ASSISTED_COMMITS=$((AI_ASSISTED_COMMITS + 1))
      AI_COMMITS=$((AI_COMMITS + 1))
    elif echo "$commit_block" | grep -qi "AI-Origin:"; then
      # Any other AI-Origin value counts as AI-assisted
      AI_ASSISTED_COMMITS=$((AI_ASSISTED_COMMITS + 1))
      AI_COMMITS=$((AI_COMMITS + 1))
    else
      HUMAN_COMMITS=$((HUMAN_COMMITS + 1))
    fi
  done <<< "$COMMIT_LOG"
fi

# Calculate AI-to-merge ratio
if [ "$TOTAL_COMMITS" -gt 0 ]; then
  AI_TO_MERGE_RATIO=$(echo "scale=4; $AI_COMMITS / $TOTAL_COMMITS" | bc)
else
  AI_TO_MERGE_RATIO="0"
fi

echo "Total commits: $TOTAL_COMMITS"
echo "AI commits: $AI_COMMITS (generated: $AI_GENERATED_COMMITS, assisted: $AI_ASSISTED_COMMITS)"
echo "Human commits: $HUMAN_COMMITS"
echo "AI-to-merge ratio: $AI_TO_MERGE_RATIO"

echo "::endgroup::"

# ---------------------------------------------------------------------------
# Determine AI origin for the overall merge
# ---------------------------------------------------------------------------

if [ "$AI_GENERATED_COMMITS" -gt 0 ] && [ "$HUMAN_COMMITS" -eq 0 ]; then
  OVERALL_ORIGIN="ai-generated"
elif [ "$AI_COMMITS" -gt 0 ]; then
  OVERALL_ORIGIN="ai-assisted"
else
  OVERALL_ORIGIN="human"
fi

# ---------------------------------------------------------------------------
# Get diff stats
# ---------------------------------------------------------------------------

DIFF_STAT=$(git diff --shortstat "${PRISM_BASE_REF}..HEAD" 2>/dev/null || echo "0 files changed")
FILES_CHANGED=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ files? changed' | grep -oE '[0-9]+' || echo "0")
INSERTIONS=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ insertions?' | grep -oE '[0-9]+' || echo "0")
DELETIONS=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ deletions?' | grep -oE '[0-9]+' || echo "0")
LINES_CHANGED=$((INSERTIONS + DELETIONS))

# ---------------------------------------------------------------------------
# Build and emit EventBridge event
# ---------------------------------------------------------------------------

DETAIL_TYPE="prism.d1.${PRISM_EVENT_TYPE}"

# Build the event detail JSON
EVENT_DETAIL=$(cat <<ENDJSON
{
  "team_id": "${PRISM_TEAM_ID}",
  "repo": "${PRISM_REPO}",
  "timestamp": "${TIMESTAMP}",
  "prism_level": null,
  "metric": {
    "name": "${PRISM_EVENT_TYPE}.completed",
    "value": 1,
    "unit": "count"
  },
  "ai_context": {
    "tool": "claude-code",
    "model": null,
    "origin": "${OVERALL_ORIGIN}"
  },
  "dora": {
    "deployment_frequency": ${PRISM_EVENT_TYPE:+null},
    "lead_time_seconds": null,
    "change_failure_rate": null,
    "mttr_seconds": null
  },
  "ai_dora": {
    "ai_acceptance_rate": null,
    "ai_to_merge_ratio": ${AI_TO_MERGE_RATIO},
    "spec_to_code_hours": null,
    "post_merge_defect_rate": null,
    "eval_gate_pass_rate": null,
    "ai_test_coverage_delta": null
  },
  "ci": {
    "sha": "${PRISM_SHA}",
    "ref": "${PRISM_REF:-}",
    "total_commits": ${TOTAL_COMMITS},
    "ai_commits": ${AI_COMMITS},
    "human_commits": ${HUMAN_COMMITS},
    "files_changed": ${FILES_CHANGED},
    "lines_changed": ${LINES_CHANGED},
    "workflow_run_id": "${PRISM_WORKFLOW_RUN_ID:-}"
  }
}
ENDJSON
)

echo "::group::Emitting EventBridge event"
echo "Detail type: ${DETAIL_TYPE}"
echo "Event bus: ${PRISM_EVENT_BUS}"

aws events put-events \
  --entries "[{
    \"Source\": \"prism.d1.velocity\",
    \"DetailType\": \"${DETAIL_TYPE}\",
    \"Detail\": $(echo "$EVENT_DETAIL" | jq -c . | jq -Rs .),
    \"EventBusName\": \"${PRISM_EVENT_BUS}\"
  }]" \
  --output json

EVENTS_EMITTED=$((EVENTS_EMITTED + 1))

# If this is a PR event with timing data, emit a lead-time metric too
if [ "${PRISM_EVENT_TYPE}" = "pr" ] && [ -n "${PRISM_PR_CREATED_AT:-}" ]; then
  PR_CREATED_EPOCH=$(date -d "${PRISM_PR_CREATED_AT}" +%s 2>/dev/null || date -jf "%Y-%m-%dT%H:%M:%SZ" "${PRISM_PR_CREATED_AT}" +%s 2>/dev/null || echo "0")
  NOW_EPOCH=$(date +%s)

  if [ "$PR_CREATED_EPOCH" -gt 0 ]; then
    LEAD_TIME_SECONDS=$((NOW_EPOCH - PR_CREATED_EPOCH))

    LEAD_TIME_DETAIL=$(cat <<ENDJSON2
{
  "team_id": "${PRISM_TEAM_ID}",
  "repo": "${PRISM_REPO}",
  "timestamp": "${TIMESTAMP}",
  "prism_level": null,
  "metric": {
    "name": "pr.lead_time",
    "value": ${LEAD_TIME_SECONDS},
    "unit": "seconds"
  },
  "ai_context": {
    "tool": "claude-code",
    "model": null,
    "origin": "${OVERALL_ORIGIN}"
  },
  "dora": {
    "deployment_frequency": null,
    "lead_time_seconds": ${LEAD_TIME_SECONDS},
    "change_failure_rate": null,
    "mttr_seconds": null
  },
  "ai_dora": {
    "ai_acceptance_rate": null,
    "ai_to_merge_ratio": ${AI_TO_MERGE_RATIO},
    "spec_to_code_hours": null,
    "post_merge_defect_rate": null,
    "eval_gate_pass_rate": null,
    "ai_test_coverage_delta": null
  }
}
ENDJSON2
)

    aws events put-events \
      --entries "[{
        \"Source\": \"prism.d1.velocity\",
        \"DetailType\": \"prism.d1.pr\",
        \"Detail\": $(echo "$LEAD_TIME_DETAIL" | jq -c . | jq -Rs .),
        \"EventBusName\": \"${PRISM_EVENT_BUS}\"
      }]" \
      --output json

    EVENTS_EMITTED=$((EVENTS_EMITTED + 1))
    echo "Emitted lead time metric: ${LEAD_TIME_SECONDS}s"
  fi
fi

echo "::endgroup::"

# ---------------------------------------------------------------------------
# Set outputs for GitHub Actions
# ---------------------------------------------------------------------------

echo "events_emitted=${EVENTS_EMITTED}" >> "$GITHUB_OUTPUT"
echo "ai_to_merge_ratio=${AI_TO_MERGE_RATIO}" >> "$GITHUB_OUTPUT"

echo "PRISM metrics emitted successfully (${EVENTS_EMITTED} events)"
