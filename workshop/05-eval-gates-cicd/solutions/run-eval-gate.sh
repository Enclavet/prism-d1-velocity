#!/usr/bin/env bash
# PRISM D1 Velocity -- Eval Gate (Reference Implementation)
# Evaluates changed files against the rubric using Bedrock (Claude Haiku as judge).
#
# Usage: ./run-eval-gate.sh <rubric-path> [base-ref]
# Exit code: 0 = pass, 1 = fail, 2 = error

set -euo pipefail

RUBRIC_PATH="${1:-.prism/eval/api-rubric.json}"
BASE_REF="${2:-HEAD~1}"
JUDGE_MODEL="anthropic.claude-haiku-3-20250307"
GLOBAL_THRESHOLD=$(jq -r '.global_threshold' "$RUBRIC_PATH")

echo "=== PRISM Eval Gate ==="
echo "Rubric: $RUBRIC_PATH"
echo "Judge model: $JUDGE_MODEL"
echo "Global threshold: $GLOBAL_THRESHOLD"
echo "Comparing against: $BASE_REF"
echo ""

# Get changed TypeScript source files (exclude tests)
CHANGED_FILES=$(git diff --name-only "$BASE_REF" HEAD -- '*.ts' '*.tsx' | grep -v '.test.' | grep -v '.spec.' || true)

if [ -z "$CHANGED_FILES" ]; then
  echo "No TypeScript source files changed. Eval gate: SKIP"
  exit 0
fi

echo "Files to evaluate:"
echo "$CHANGED_FILES" | sed 's/^/  /'
echo ""

# Collect file contents
CODE_CONTENT=""
for FILE in $CHANGED_FILES; do
  if [ -f "$FILE" ]; then
    CODE_CONTENT="${CODE_CONTENT}
--- FILE: ${FILE} ---
$(cat "$FILE")
"
  fi
done

# Find the relevant spec
SPEC_REF=$(git log "$BASE_REF"..HEAD --format='%(trailers:key=Spec,valueonly)' | head -1 | tr -d '[:space:]')
SPEC_CONTENT=""
if [ -n "$SPEC_REF" ] && [ -f "$SPEC_REF" ]; then
  SPEC_CONTENT=$(cat "$SPEC_REF")
  echo "Spec found: $SPEC_REF"
else
  echo "No spec reference found. Evaluating code quality only."
fi

# Build rubric text
RUBRIC_TEXT=$(jq -r '.criteria[] | "- \(.name) [weight=\(.weight), threshold=\(.threshold)]: \(.description)\n  Scoring: \(.scoring)"' "$RUBRIC_PATH")

# Build evaluation prompt
EVAL_PROMPT=$(cat <<PROMPT_EOF
You are a code quality evaluator for the PRISM D1 Velocity framework. Your job is to evaluate generated code against a rubric.

## Spec
${SPEC_CONTENT:-"No spec provided. For criteria that reference a spec, score 0.0 and note the missing spec in your rationale."}

## Code Under Evaluation
${CODE_CONTENT}

## Evaluation Rubric
${RUBRIC_TEXT}

## Instructions
For each criterion in the rubric:
1. Analyze the code against the criterion's description
2. Apply the scoring method described
3. Assign a score from 0.0 to 1.0
4. Write a 1-2 sentence rationale

You MUST evaluate every criterion listed. Respond with ONLY this JSON (no markdown, no explanation):
{
  "evaluations": [
    {
      "criterion": "<exact criterion name>",
      "score": <number 0.0 to 1.0>,
      "rationale": "<1-2 sentences>"
    }
  ]
}
PROMPT_EOF
)

# Call Bedrock
echo "Calling Bedrock evaluation (model: $JUDGE_MODEL)..."

BODY=$(jq -n \
  --arg prompt "$EVAL_PROMPT" \
  '{
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2000,
    temperature: 0.0,
    messages: [{role: "user", content: $prompt}]
  }')

RESPONSE=$(aws bedrock-runtime invoke-model \
  --model-id "$JUDGE_MODEL" \
  --content-type "application/json" \
  --accept "application/json" \
  --body "$BODY" \
  /dev/stdout 2>/dev/null)

EVAL_TEXT=$(echo "$RESPONSE" | jq -r '.content[0].text')

# Parse the JSON response (handle markdown code blocks)
EVAL_JSON=$(echo "$EVAL_TEXT" | python3 -c "
import sys, json, re
text = sys.stdin.read()
# Try direct parse
try:
    obj = json.loads(text)
    print(json.dumps(obj))
    sys.exit(0)
except json.JSONDecodeError:
    pass
# Try extracting from code block
match = re.search(r'\{[\s\S]*\}', text)
if match:
    try:
        obj = json.loads(match.group())
        print(json.dumps(obj))
        sys.exit(0)
    except json.JSONDecodeError:
        pass
print('{}', file=sys.stderr)
sys.exit(1)
" 2>/dev/null)

if [ -z "$EVAL_JSON" ] || [ "$EVAL_JSON" = "{}" ]; then
  echo "ERROR: Could not parse evaluation response"
  echo "Raw response:"
  echo "$EVAL_TEXT"
  exit 2
fi

# Display results
echo ""
echo "=== Evaluation Results ==="
echo ""

ANY_FAIL=false

echo "$EVAL_JSON" | jq -r '.evaluations[] | "\(.criterion)|\(.score)|\(.rationale)"' | while IFS='|' read -r CRITERION SCORE RATIONALE; do
  THRESHOLD=$(jq -r --arg name "$CRITERION" '.criteria[] | select(.name == $name) | .threshold // 0' "$RUBRIC_PATH")
  WEIGHT=$(jq -r --arg name "$CRITERION" '.criteria[] | select(.name == $name) | .weight // 0' "$RUBRIC_PATH")

  PASS_FAIL="PASS"
  if (( $(echo "$SCORE < $THRESHOLD" | bc -l) )); then
    PASS_FAIL="FAIL"
  fi

  printf "  %-35s Score: %.2f  Threshold: %.2f  [%s]\n" "$CRITERION" "$SCORE" "$THRESHOLD" "$PASS_FAIL"
  echo "    Rationale: $RATIONALE"
  echo ""
done

# Calculate overall weighted score
OVERALL=$(echo "$EVAL_JSON" | jq --slurpfile rubric "$RUBRIC_PATH" '
  [.evaluations[] as $eval |
    ($rubric[0].criteria[] | select(.name == $eval.criterion)) as $crit |
    ($eval.score * $crit.weight)
  ] | add // 0
')

echo "---"
printf "Overall weighted score: %.3f (threshold: %s)\n" "$OVERALL" "$GLOBAL_THRESHOLD"
echo ""

# Check per-criterion thresholds
CRITERIA_FAIL=$(echo "$EVAL_JSON" | jq --slurpfile rubric "$RUBRIC_PATH" '
  [.evaluations[] as $eval |
    ($rubric[0].criteria[] | select(.name == $eval.criterion)) as $crit |
    select($eval.score < $crit.threshold) |
    $eval.criterion
  ] | length
')

if (( $(echo "$OVERALL < $GLOBAL_THRESHOLD" | bc -l) )) || [ "$CRITERIA_FAIL" -gt 0 ]; then
  echo "EVAL GATE: FAIL"
  if [ "$CRITERIA_FAIL" -gt 0 ]; then
    echo "$CRITERIA_FAIL criterion/criteria below their individual thresholds."
  fi
  echo "Review the scores above and address failing criteria."
  exit 1
else
  echo "EVAL GATE: PASS"
  exit 0
fi
