# PRISM D1 Velocity -- Scoring Methodology

## Overview

The PRISM D1 Velocity assessment produces a blended maturity score from three inputs:

| Input | Weight | Source | Scale |
|-------|--------|--------|-------|
| Automated Scanner | 40% | Repo analysis tool | 0-100 |
| SA Interview | 40% | Structured interview | 0-100 |
| Org Readiness | 20% | 5 binary criteria | 0-20 |

**Blended Score** = (Scanner x 0.4) + (Interview x 0.4) + (Org Readiness x 5 x 0.2)

The org readiness score (0-20 raw) is scaled to 0-100 before weighting, so each input contributes proportionally.

## PRISM D1 Levels

The blended score maps to a PRISM D1 level from L1.0 to L5.0 in 0.5 increments:

| Level | Blended Score Range | Description |
|-------|:-------------------:|-------------|
| L1.0 | 0-10 | No AI adoption |
| L1.5 | 11-20 | Early experimentation |
| L2.0 | 21-30 | Emerging standardization |
| L2.5 | 31-40 | Structured adoption |
| L3.0 | 41-50 | Integrated AI workflows |
| L3.5 | 51-60 | Measured and optimized |
| L4.0 | 61-70 | AI-native practices |
| L4.5 | 71-80 | Advanced AI-native |
| L5.0 | 81-100 | Industry-leading AI-native |

## Readiness Verdict

Based on the blended score and org readiness, the model produces a qualification verdict:

- **READY_FOR_PILOT**: Blended score >= 21 (L2.0+) AND org readiness >= 12/20
- **NEEDS_FOUNDATIONS**: Blended score >= 11 (L1.5+) AND org readiness >= 8/20
- **NOT_QUALIFIED**: Below both thresholds

## Files

| File | Description |
|------|-------------|
| `scoring-model.ts` | TypeScript scoring model implementation |
| `scoring-model.test.ts` | Jest test cases for the scoring model |
| `level-definitions.ts` | Detailed level definitions with observable evidence |
| `qualification-matrix.md` | Printable decision matrix for SAs |

## Usage

```bash
npm install
npx jest scoring-model.test.ts
```

The scoring model can be imported and used programmatically:

```typescript
import { computeAssessment } from './scoring-model';

const result = computeAssessment({
  scannerScore: 45,
  interviewScore: 38,
  orgReadiness: {
    executiveSponsor: true,
    budgetAllocated: true,
    dedicatedOwner: true,
    awsRelationship: true,
    appropriateTeamSize: true,
  },
});

console.log(result.level);    // "L3.0"
console.log(result.verdict);  // "READY_FOR_PILOT"
```
