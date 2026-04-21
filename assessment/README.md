# PRISM D1: Velocity — Customer Qualification & Onboarding

> Artifact-level assessment — not a survey, a real score.

This directory contains the complete customer qualification and onboarding mechanism for the D1 Velocity pillar. It answers one question: **where does this startup stand on AI-DLC maturity, and what's the fastest path to Level 3+?**

**[Read the full Assessment Methodology Guide](ASSESSMENT-GUIDE.md)** — detailed documentation of how the scanner works, interview scoring rubrics, blended score formula, track routing logic, and report generation.

## Assessment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    QUALIFICATION                             │
│                                                              │
│  Customer Repo ──→ prism-scan CLI ──→ Scanner Score (0-100) │
│                          12 categories, real artifacts        │
│                                                              │
│  SA Interview ──→ Scoring Sheet ──→ Interview Score (0-100)  │
│                     20 questions, 6 sections                 │
│                                                              │
│  Org Readiness ──→ 5 binary factors ──→ Org Score (0-20)    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                     SCORING                                  │
│                                                              │
│  Blended = 40% Scanner + 40% Interview + 20% Org Readiness  │
│                         │                                    │
│                    PRISM D1 Level (L1.0 – L5.0)             │
│                         │                                    │
│                    Verdict:                                   │
│                    • READY_FOR_PILOT (≥L2.0, org≥12)        │
│                    • NEEDS_FOUNDATIONS (≥L1.5, org≥8)        │
│                    • NOT_QUALIFIED (below thresholds)         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    ONBOARDING                                │
│                                                              │
│  Track A: Foundations ──→ Modules 00-02, 2wk pre-work       │
│  Track B: Full Workshop ──→ All modules, 8-week pilot       │
│  Track C: Accelerated ──→ Modules 03-05, targeted gaps      │
│  Track D: Advanced ──→ Custom engagement, L4+ optimization   │
│                         │                                    │
│               Customer-Facing Report                         │
│               (HTML + Markdown + JSON)                       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Scan the customer's repo

```bash
cd scanner
npm install
npx ts-node src/index.ts --repo /path/to/customer/repo --verbose
npx ts-node src/index.ts --repo /path/to/customer/repo --output json --output-file ../reports/scan-result.json
```

### 2. Run the SA interview

Print [interview/scoring-sheet.md](interview/scoring-sheet.md) and follow [interview/interview-guide.md](interview/interview-guide.md).

### 3. Compute the assessment

```typescript
import { computeAssessment } from './scoring/scoring-model';

const result = computeAssessment({
  scannerScore: 48,
  interviewScore: 54,
  orgReadiness: {
    executiveSponsor: true,
    budgetAllocated: true,
    dedicatedOwner: true,
    awsRelationship: true,
    teamSizeAppropriate: true,
  },
  scannerCategories: [...],  // from scanner output
  interviewSections: [...],  // from scoring sheet
});
// → { blendedScore: 60.8, level: 'L2.5', verdict: 'READY_FOR_PILOT' }
```

### 4. Route to onboarding track

```typescript
import { routeOnboarding } from './onboarding/onboarding-router';

const plan = routeOnboarding(assessmentResult, customerInfo);
// → { track: 'B', workshopModules: [...], preWork: [...], milestones: [...] }
```

### 5. Generate the customer report

```typescript
import { generateReport } from './reports/report-generator';

const markdown = generateReport(fullAssessmentData, 'markdown');
const html = generateReport(fullAssessmentData, 'html');
```

## Directory Structure

```
assessment/
├── scanner/              # Automated repo scanner CLI (prism-scan)
│   └── src/
│       ├── scanners/     # 12 independent category scanners
│       ├── scoring.ts    # Score aggregation + level mapping
│       └── reporter.ts   # Console, JSON, Markdown output
│
├── interview/            # SA interview materials
│   ├── interview-guide.md    # 20 questions with scoring rubrics
│   ├── scoring-sheet.md      # Printable scoring sheet
│   └── pre-interview-checklist.md
│
├── scoring/              # Scoring model + qualification logic
│   ├── scoring-model.ts      # 40/40/20 weighted scoring
│   ├── level-definitions.ts  # L1.0-L5.0 with evidence + metrics
│   └── qualification-matrix.md
│
├── onboarding/           # Track assignment + onboarding plans
│   ├── tracks.md             # 4 tracks (A-D) defined
│   ├── onboarding-router.ts  # Deterministic track assignment
│   ├── email-templates.md    # 5 SA email templates
│   └── pre-work/             # Track-specific pre-work checklists
│
└── reports/              # Customer-facing report generation
    ├── report-generator.ts   # HTML, Markdown, JSON reports
    ├── templates/            # Report templates with radar charts
    └── sample-reports/       # 3 sample assessments (L1.5, L2.5, L3.5)
```

## Sample Reports

See `reports/sample-reports/` for realistic assessment examples. Each has JSON data, rendered HTML, and a print-ready PDF.

| Sample | Company | Level | Verdict | Track | PDF Report |
|--------|---------|-------|---------|-------|------------|
| [L1.5](reports/sample-reports/sample-l1.5-startup.json) | NovaPay (Series A, 6 eng) | L1.5 | NEEDS_FOUNDATIONS | A | [PDF](reports/sample-reports/pdf/novapay-l1.5-assessment.pdf) \| [HTML](reports/sample-reports/pdf/novapay-l1.5-assessment.html) |
| [L2.5](reports/sample-reports/sample-l2.5-startup.json) | Arcline Health (Series B, 14 eng) | L2.5 | READY_FOR_PILOT | B | [PDF](reports/sample-reports/pdf/arcline-health-l2.5-assessment.pdf) \| [HTML](reports/sample-reports/pdf/arcline-health-l2.5-assessment.html) |
| [L3.5](reports/sample-reports/sample-l3.5-startup.json) | Vectrix AI (Series C, 28 eng) | L3.5 | READY_FOR_PILOT | C | [PDF](reports/sample-reports/pdf/vectrix-ai-l3.5-assessment.pdf) \| [HTML](reports/sample-reports/pdf/vectrix-ai-l3.5-assessment.html) |

### Regenerating PDFs

```bash
cd assessment/reports
bash generate-pdfs.sh
```

Requires Google Chrome installed. HTML reports are generated by `generate-html.py` (pure Python), then converted to PDF via Chrome headless.
