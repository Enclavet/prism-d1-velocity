# Exercise 1: Create a Bedrock Evaluation Rubric

**Time:** 10 minutes

## Objective

Create an evaluation rubric for the sample-app's API endpoints. This rubric defines what "good" looks like and becomes the criteria the eval gate checks against.

## Steps

### Step 1: Understand the rubric format

A PRISM eval rubric is a JSON file with this structure:

```json
{
  "rubric_name": "string",
  "description": "string",
  "criteria": [
    {
      "name": "string",
      "description": "What this criterion checks",
      "scoring": "How to score from 0.0 to 1.0",
      "threshold": 0.0-1.0,
      "weight": 0.0-1.0
    }
  ]
}
```

- **threshold** -- Minimum score for this criterion to pass (per-criterion gate)
- **weight** -- How much this criterion contributes to the overall score (weights should sum to 1.0)
- The **overall gate** passes if the weighted average score >= global threshold AND all per-criterion thresholds are met

### Step 2: Create the rubric file

```bash
cd prism-d1-sample-app
mkdir -p .prism/eval
```

Create `.prism/eval/api-rubric.json`:

```json
{
  "rubric_name": "api_spec_compliance",
  "description": "Evaluates whether API endpoint implementations match their specs",
  "global_threshold": 0.8,
  "criteria": [
    {
      "name": "acceptance_criteria_coverage",
      "description": "Every acceptance criterion in the spec must have a corresponding implementation. Check each Given/When/Then statement and verify the code handles that exact scenario.",
      "scoring": "Count the acceptance criteria in the spec. For each one, determine if the code implements it (1) or not (0). Score = implemented / total. Example: 4 out of 5 ACs implemented = 0.8",
      "threshold": 1.0,
      "weight": 0.35
    },
    {
      "name": "api_contract_fidelity",
      "description": "The implemented endpoint must match the spec's API contract exactly: correct HTTP method, path, request body schema, response body schema, and status codes.",
      "scoring": "Check 5 elements: method, path, request schema, response schema, status codes. Score 0.2 for each correct element. Partial matches (e.g., extra fields in response) score 0.1.",
      "threshold": 0.8,
      "weight": 0.25
    },
    {
      "name": "error_handling",
      "description": "All error cases defined in the spec must be handled with the correct HTTP status code and response format (RFC 7807 Problem Details).",
      "scoring": "For each error case in the spec, check: (a) is it handled? (b) correct status code? (c) Problem Details format? Score = correct_checks / (total_error_cases * 3)",
      "threshold": 0.7,
      "weight": 0.20
    },
    {
      "name": "no_hallucinated_dependencies",
      "description": "The code must not import modules, call functions, or reference APIs that do not exist in the project. Every import must resolve to a real file or installed package.",
      "scoring": "Binary: 1.0 if all imports and function calls reference real modules/packages, 0.0 if any hallucinated dependency is found.",
      "threshold": 1.0,
      "weight": 0.10
    },
    {
      "name": "type_safety",
      "description": "The code must use proper TypeScript types. No 'any' types, no type assertions without justification, all function parameters and return types annotated.",
      "scoring": "Count type violations: any usage, missing annotations, unsafe assertions. Score = max(0, 1.0 - (violations * 0.1))",
      "threshold": 0.8,
      "weight": 0.10
    }
  ]
}
```

### Step 3: Customize for your context

Review the rubric and adjust:

- **If your team prioritizes correctness over coverage:** increase `acceptance_criteria_coverage` weight
- **If you've seen hallucination issues:** increase `no_hallucinated_dependencies` weight
- **If your API serves external consumers:** add a criterion for backward compatibility
- **If you have a specific coding standard:** add a criterion for it

Add at least one custom criterion relevant to your team's concerns:

```json
{
  "name": "your_custom_criterion",
  "description": "What matters to YOUR team",
  "scoring": "How you'd evaluate it",
  "threshold": 0.7,
  "weight": 0.0
}
```

Set weight to 0.0 initially (informational only) and promote to a real weight once you've calibrated.

### Step 4: Validate the rubric

```bash
# Check it's valid JSON
cat .prism/eval/api-rubric.json | jq .

# Verify weights sum to ~1.0
cat .prism/eval/api-rubric.json | jq '[.criteria[].weight] | add'
```

## Verification

You've completed this exercise when:
- [ ] `.prism/eval/api-rubric.json` exists and is valid JSON
- [ ] The rubric has at least 5 criteria
- [ ] Weights sum to approximately 1.0
- [ ] Each criterion has a clear scoring description that a judge model can follow
- [ ] Thresholds are set (you can adjust them later based on calibration)
