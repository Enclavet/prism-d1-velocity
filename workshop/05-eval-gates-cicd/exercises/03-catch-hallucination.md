# Exercise 3: Catch a Hallucinated API Call

**Time:** 10 minutes

## Objective

Deliberately introduce a hallucinated dependency into the codebase and watch the eval gate catch it. This demonstrates why eval gates exist and what they catch that unit tests miss.

## Steps

### Step 1: Introduce a hallucinated import

Create a new file that imports a module that does not exist in the project:

```bash
cd prism-d1-sample-app

cat > src/routes/analytics.ts << 'HALLUCINATION'
/**
 * Analytics route handler.
 * @route GET /analytics/summary
 */
import { Router, Request, Response } from "express";
import { AnalyticsEngine } from "../lib/analytics-engine";  // THIS DOES NOT EXIST
import { aggregateMetrics } from "../lib/metric-aggregator";  // THIS DOES NOT EXIST

const router = Router();

router.get("/analytics/summary", async (_req: Request, res: Response) => {
  const engine = new AnalyticsEngine({
    provider: "custom",
    region: "us-west-2",
  });

  const metrics = await aggregateMetrics({
    timeRange: "7d",
    dimensions: ["team", "repo"],
  });

  const summary = await engine.generateSummary(metrics);

  res.status(200).json({
    summary,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
HALLUCINATION
```

This code:
- Imports `AnalyticsEngine` from `../lib/analytics-engine` -- **does not exist**
- Imports `aggregateMetrics` from `../lib/metric-aggregator` -- **does not exist**
- Calls `engine.generateSummary()` -- **hallucinated method**
- Would compile in a loose TypeScript setup but fail at runtime

### Step 2: Notice what traditional checks miss

```bash
# The file has valid syntax
npx tsc --noEmit src/routes/analytics.ts 2>&1 || true
# TypeScript catches the missing imports, good.
# But what if someone stubbed out empty files to make it compile?

# Create stubs to make TypeScript happy
mkdir -p src/lib

cat > src/lib/analytics-engine.ts << 'STUB'
export class AnalyticsEngine {
  constructor(_config: any) {}
  async generateSummary(_data: any): Promise<string> {
    // TODO: implement
    return "";
  }
}
STUB

cat > src/lib/metric-aggregator.ts << 'STUB'
export async function aggregateMetrics(_options: any): Promise<any[]> {
  // TODO: implement
  return [];
}
STUB
```

Now it compiles. A basic CI pipeline would pass. But the code is meaningless -- it calls stub functions that return empty values.

### Step 3: Run the eval gate

First, stage and commit so the eval gate has a diff to evaluate:

```bash
git add src/routes/analytics.ts src/lib/analytics-engine.ts src/lib/metric-aggregator.ts
git commit -m "feat(analytics): add analytics summary endpoint

AI-Origin: claude-code
AI-Confidence: implementation"
```

Now run the eval gate:

```bash
.prism/eval/run-eval-gate.sh .prism/eval/api-rubric.json HEAD~1
```

### Step 4: Review the eval gate output

**Expected result: FAIL**

The eval gate should flag several issues:

```
=== Evaluation Results ===

  acceptance_criteria_coverage         Score: 0.00  Threshold: 1.00  [FAIL]
    Rationale: No spec exists for an analytics endpoint. Zero acceptance
    criteria can be verified.

  api_contract_fidelity                Score: 0.00  Threshold: 0.80  [FAIL]
    Rationale: No spec defines the API contract for /analytics/summary.
    Cannot verify method, path, or response schema against a spec.

  error_handling                       Score: 0.00  Threshold: 0.70  [FAIL]
    Rationale: No error handling implemented. The endpoint has no try/catch,
    no validation, and no defined error responses.

  no_hallucinated_dependencies         Score: 0.00  Threshold: 1.00  [FAIL]
    Rationale: analytics-engine.ts and metric-aggregator.ts are stub files
    with no real implementation. They return empty values and use 'any' types.

  type_safety                          Score: 0.20  Threshold: 0.80  [FAIL]
    Rationale: Multiple 'any' types used in constructors and function
    parameters. No proper interfaces defined.

---
Overall weighted score: 0.020 (threshold: 0.8)

EVAL GATE: FAIL
```

### Step 5: Understand what the eval gate caught

| Issue | Caught by unit tests? | Caught by TypeScript? | Caught by eval gate? |
|-------|----------------------|----------------------|---------------------|
| Missing spec | No | No | Yes |
| Stub implementations | No | No | Yes |
| `any` types | No | Only in strict mode | Yes |
| No error handling | Only if you wrote error tests | No | Yes |
| No real business logic | No | No | Yes |

The eval gate provides a **semantic quality check** that traditional tooling misses. It asks "does this code actually do something meaningful?" rather than just "does this code compile and pass the tests someone wrote?"

### Step 6: Clean up

Revert the hallucinated code:

```bash
git revert HEAD --no-edit
```

## Key Takeaway

AI-generated code that compiles and passes superficial tests is the most dangerous kind of technical debt. It looks right, it passes CI, and it ships -- until a customer hits the endpoint and gets an empty response. The eval gate is your safety net for catching this class of problem before it reaches production.

## Verification

You've completed this exercise when:
- [ ] You introduced hallucinated code that compiles
- [ ] The eval gate correctly identified it as FAIL
- [ ] You can explain why this code would pass traditional CI checks
- [ ] You reverted the hallucinated code
