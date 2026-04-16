# Exercise 2: Add the Eval Gate to the GitHub Actions Workflow

**Time:** 10 minutes

## Objective

Add a CI step that runs Bedrock Evaluations against AI-generated code and fails the pipeline if the quality score is below threshold.

## Steps

### Step 1: Create the eval gate script

This script is what the CI workflow calls. It reads the rubric, constructs an evaluation prompt, calls Bedrock, and returns pass/fail.

Create `.prism/eval/run-eval-gate.sh`:

```bash
#!/usr/bin/env bash
# PRISM D1 Velocity -- Eval Gate
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

# Get changed TypeScript files
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

# Find the relevant spec (look for Spec trailer in recent commits)
SPEC_REF=$(git log "$BASE_REF"..HEAD --format='%(trailers:key=Spec,valueonly)' | head -1 | tr -d '[:space:]')
SPEC_CONTENT=""
if [ -n "$SPEC_REF" ] && [ -f "$SPEC_REF" ]; then
  SPEC_CONTENT=$(cat "$SPEC_REF")
  echo "Spec found: $SPEC_REF"
else
  echo "No spec reference found. Evaluating code quality only."
fi

# Build the evaluation prompt
RUBRIC_TEXT=$(jq -r '.criteria[] | "- \(.name) [\(.weight)]: \(.description)\n  Scoring: \(.scoring)\n  Threshold: \(.threshold)"' "$RUBRIC_PATH")

EVAL_PROMPT=$(cat <<PROMPT_EOF
You are a code quality evaluator. Evaluate the following code against the rubric criteria.

## Spec (if provided)
${SPEC_CONTENT:-"No spec provided. Evaluate based on code quality criteria only."}

## Code Under Evaluation
${CODE_CONTENT}

## Evaluation Rubric
${RUBRIC_TEXT}

## Instructions
For each criterion:
1. Analyze the code against the criterion's description and scoring method
2. Assign a score from 0.0 to 1.0 following the scoring guidance
3. Provide a brief rationale (1-2 sentences)

Respond in this exact JSON format:
{
  "evaluations": [
    {
      "criterion": "<criterion name>",
      "score": <0.0-1.0>,
      "rationale": "<brief explanation>"
    }
  ]
}
PROMPT_EOF
)

# Call Bedrock
echo "Calling Bedrock evaluation..."
RESPONSE=$(aws bedrock-runtime invoke-model \
  --model-id "$JUDGE_MODEL" \
  --content-type "application/json" \
  --accept "application/json" \
  --body "$(jq -n \
    --arg prompt "$EVAL_PROMPT" \
    '{
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      messages: [{role: "user", content: $prompt}]
    }')" \
  /dev/stdout 2>/dev/null)

# Extract the response text
EVAL_RESULT=$(echo "$RESPONSE" | jq -r '.content[0].text')

# Parse scores from the JSON response
echo ""
echo "=== Evaluation Results ==="
echo ""

# Extract the JSON from the response (it might be wrapped in markdown code blocks)
EVAL_JSON=$(echo "$EVAL_RESULT" | sed -n '/^{/,/^}/p' || echo "$EVAL_RESULT" | sed -n '/```json/,/```/p' | grep -v '```')

if [ -z "$EVAL_JSON" ]; then
  echo "ERROR: Could not parse evaluation response"
  echo "Raw response:"
  echo "$EVAL_RESULT"
  exit 2
fi

# Calculate weighted score
OVERALL_SCORE=0
ALL_PASS=true

echo "$EVAL_JSON" | jq -r '.evaluations[] | "\(.criterion)|\(.score)|\(.rationale)"' | while IFS='|' read -r CRITERION SCORE RATIONALE; do
  THRESHOLD=$(jq -r --arg name "$CRITERION" '.criteria[] | select(.name == $name) | .threshold' "$RUBRIC_PATH")
  WEIGHT=$(jq -r --arg name "$CRITERION" '.criteria[] | select(.name == $name) | .weight' "$RUBRIC_PATH")

  if [ -z "$THRESHOLD" ]; then
    THRESHOLD="0.0"
    WEIGHT="0.0"
  fi

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

# Final gate decision
if (( $(echo "$OVERALL < $GLOBAL_THRESHOLD" | bc -l) )); then
  echo "EVAL GATE: FAIL"
  echo "The AI-generated code does not meet quality thresholds."
  echo "Review the scores above and address failing criteria before merging."
  exit 1
else
  echo "EVAL GATE: PASS"
  exit 0
fi
```

```bash
chmod +x .prism/eval/run-eval-gate.sh
```

### Step 2: Add the eval gate to the GitHub Actions workflow

Create or update `.github/workflows/prism-eval-gate.yml`:

```yaml
name: PRISM Eval Gate

on:
  pull_request:
    branches: [main]
    paths:
      - 'src/**/*.ts'
      - 'src/**/*.tsx'

permissions:
  id-token: write
  contents: read
  pull-requests: write  # To post eval results as PR comment

jobs:
  eval-gate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.PRISM_METRICS_ROLE_ARN }}
          aws-region: us-west-2

      - name: Install dependencies
        run: |
          sudo apt-get install -y jq bc

      - name: Run eval gate
        id: eval
        run: |
          chmod +x .prism/eval/run-eval-gate.sh
          .prism/eval/run-eval-gate.sh .prism/eval/api-rubric.json origin/${{ github.base_ref }} 2>&1 | tee eval-output.txt
        continue-on-error: true

      - name: Post eval results as PR comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const output = fs.readFileSync('eval-output.txt', 'utf8');
            const status = '${{ steps.eval.outcome }}' === 'success' ? 'PASSED' : 'FAILED';

            const body = `## PRISM Eval Gate: ${status}

            \`\`\`
            ${output}
            \`\`\`

            ${status === 'FAILED' ? '> **Action required:** Fix the failing criteria before this PR can merge.' : '> All quality checks passed.'}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });

      - name: Emit eval metric to EventBridge
        if: always()
        env:
          EVENT_BUS_NAME: ${{ vars.PRISM_EVENT_BUS_NAME || 'prism-metrics' }}
        run: |
          RESULT="${{ steps.eval.outcome }}"
          DETAIL=$(jq -n \
            --arg repo "${{ github.repository }}" \
            --argjson pr "${{ github.event.pull_request.number }}" \
            --arg result "$RESULT" \
            --arg rubric "api_spec_compliance" \
            '{repo: $repo, pr_number: $pr, result: $result, rubric: $rubric}')

          aws events put-events --entries "[{
            \"Source\": \"prism.d1.velocity\",
            \"DetailType\": \"EvalGateResult\",
            \"EventBusName\": \"$EVENT_BUS_NAME\",
            \"Detail\": $(echo "$DETAIL" | jq -Rs .)
          }]"

      - name: Fail if eval gate failed
        if: steps.eval.outcome == 'failure'
        run: exit 1
```

### Step 3: Test the eval gate locally

```bash
# Run against your most recent commit
.prism/eval/run-eval-gate.sh .prism/eval/api-rubric.json HEAD~1
```

Review the output. You should see per-criterion scores and an overall pass/fail.

### Step 4: Commit the eval gate

```bash
git add .prism/eval/ .github/workflows/prism-eval-gate.yml
git commit -m "ci: add PRISM eval gate for AI-generated code quality

Runs Bedrock Evaluation (Claude Haiku as judge) against rubric on every PR.
Posts results as PR comment and emits metrics to EventBridge."
```

## Verification

You've completed this exercise when:
- [ ] `.prism/eval/run-eval-gate.sh` exists and is executable
- [ ] `.github/workflows/prism-eval-gate.yml` exists
- [ ] Local eval gate run produces per-criterion scores
- [ ] You understand the overall pass/fail logic (weighted average + per-criterion thresholds)
