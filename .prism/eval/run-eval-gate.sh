#!/usr/bin/env bash
# PRISM D1 Velocity -- Eval Gate
# Usage: ./run-eval-gate.sh <rubric-path> [base-ref]
# Exit code: 0 = pass, 1 = fail, 2 = error

set -euo pipefail

# Debug mode: set DEBUG=1 to enable verbose logging
DEBUG="${DEBUG:-0}"

debug() {
  if [ "$DEBUG" = "1" ]; then
    echo "[DEBUG] $*" >&2
  fi
}

RUBRIC_PATH="${1:-.prism/eval/api-rubric.json}"
BASE_REF="${2:-HEAD~1}"
JUDGE_MODEL="anthropic.claude-3-haiku-20240307-v1:0"

# Resolve rubric to absolute path before we cd to repo root
RUBRIC_PATH=$(realpath "$RUBRIC_PATH")
debug "Resolved rubric path: $RUBRIC_PATH"

debug "Rubric path: $RUBRIC_PATH"
debug "Base ref: $BASE_REF"
debug "Judge model: $JUDGE_MODEL"

GLOBAL_THRESHOLD=$(jq -r '.global_threshold' "$RUBRIC_PATH")
debug "Global threshold: $GLOBAL_THRESHOLD"

echo "=== PRISM Eval Gate ==="
echo "Rubric: $RUBRIC_PATH | Judge: $JUDGE_MODEL | Threshold: $GLOBAL_THRESHOLD"

# Ensure we're running from the repo root
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
debug "Working directory: $REPO_ROOT"

# Get changed TypeScript files (exclude tests)
debug "Running: git diff --name-only $BASE_REF HEAD -- '*.ts' '*.tsx'"
CHANGED_FILES=$(git diff --name-only "$BASE_REF" HEAD -- '*.ts' '*.tsx' \
  | grep -v '.test.' | grep -v '.spec.' || true)

if [ -z "$CHANGED_FILES" ]; then
  echo "No TypeScript source files changed. Eval gate: SKIP"
  exit 0
fi

debug "Changed files:"
debug "$CHANGED_FILES"
echo "Files to evaluate: $(echo "$CHANGED_FILES" | wc -l | tr -d ' ')"

# Collect file contents
CODE_CONTENT=""
for FILE in $CHANGED_FILES; do
  if [ -f "$FILE" ]; then
    debug "Reading: $FILE"
    CODE_CONTENT="${CODE_CONTENT}
--- FILE: ${FILE} ---
$(cat "$FILE")"
  else
    debug "File not found (deleted?): $FILE"
  fi
done

debug "Total code content length: ${#CODE_CONTENT} chars"

# Find the relevant spec from recent commit trailers
SPEC_REF=$(git log "$BASE_REF"..HEAD --format='%(trailers:key=Spec,valueonly)' \
  | head -1 | tr -d '[:space:]' || true)
SPEC_CONTENT=""
if [ -n "$SPEC_REF" ] && [ -f "$SPEC_REF" ]; then
  debug "Spec found: $SPEC_REF"
  SPEC_CONTENT=$(cat "$SPEC_REF")
else
  debug "No spec found (ref='$SPEC_REF')"
fi

# Build the evaluation prompt
RUBRIC_TEXT=$(jq -r '.criteria[] | "- \(.name) [\(.weight)]: \(.description)\n  Scoring: \(.scoring)\n  Threshold: \(.threshold)"' "$RUBRIC_PATH")
debug "Rubric criteria loaded"

EVAL_PROMPT="You are a code quality evaluator. Evaluate the following code against the rubric.

## Spec
${SPEC_CONTENT:-No spec provided. Evaluate based on code quality criteria only.}

## Code Under Evaluation
${CODE_CONTENT}

## Rubric
${RUBRIC_TEXT}

Respond in this exact JSON format:
{\"evaluations\": [{\"criterion\": \"<name>\", \"score\": <0.0-1.0>, \"rationale\": \"<brief>\"}]}"

debug "Prompt length: ${#EVAL_PROMPT} chars"

# Call Bedrock
debug "Invoking Bedrock model: $JUDGE_MODEL"
BEDROCK_BODY=$(jq -n --arg p "$EVAL_PROMPT" \
  '{anthropic_version:"bedrock-2023-05-31",max_tokens:2000,messages:[{role:"user",content:$p}]}')
debug "Request body length: ${#BEDROCK_BODY} chars"

BODY_FILE=$(mktemp /tmp/prism-eval-body-XXXXXX.json)
RESP_FILE=$(mktemp /tmp/prism-eval-resp-XXXXXX.json)
echo "$BEDROCK_BODY" > "$BODY_FILE"
debug "Body written to: $BODY_FILE"

aws bedrock-runtime invoke-model \
  --model-id "$JUDGE_MODEL" \
  --content-type "application/json" \
  --accept "application/json" \
  --body "fileb://$BODY_FILE" \
  "$RESP_FILE" 2>&1 || {
    echo "ERROR: Bedrock invoke-model failed:" >&2
    cat "$RESP_FILE" 2>/dev/null >&2
    rm -f "$BODY_FILE" "$RESP_FILE"
    exit 2
  }

RESPONSE=$(cat "$RESP_FILE")
rm -f "$BODY_FILE" "$RESP_FILE"

debug "Raw response length: ${#RESPONSE} chars"
debug "Raw response (first 500 chars): ${RESPONSE:0:500}"

EVAL_JSON=$(echo "$RESPONSE" | jq -r '.content[0].text' 2>/dev/null | sed -n '/^{/,/^}/p') || true

if [ -z "$EVAL_JSON" ]; then
  echo "ERROR: Failed to extract evaluation JSON from model response" >&2
  debug "Full response: $RESPONSE"
  exit 2
fi

debug "Eval JSON: $EVAL_JSON"

# Print results
echo ""
echo "$EVAL_JSON" | jq -r '.evaluations[] | "\(.criterion): \(.score) — \(.rationale)"'

# Calculate weighted score and gate
OVERALL=$(echo "$EVAL_JSON" | jq --argjson rubric "$(cat "$RUBRIC_PATH")" '
  [.evaluations[] as $e |
    ($rubric.criteria[] | select(.name == $e.criterion)) as $c |
    ($e.score * $c.weight)
  ] | add // 0')

debug "Calculated overall score: $OVERALL"

echo ""
printf "Overall: %.3f (threshold: %s)\n" "$OVERALL" "$GLOBAL_THRESHOLD"

if (( $(echo "$OVERALL < $GLOBAL_THRESHOLD" | bc -l) )); then
  echo "EVAL GATE: FAIL"
  exit 1
else
  echo "EVAL GATE: PASS"
  exit 0
fi
