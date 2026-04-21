# PRISM D1 Velocity -- Assessment Reports

## Overview

The report generator produces customer-facing assessment readouts in three formats:

| Format | Use Case | File |
|--------|----------|------|
| Markdown | Email, Slack, GitHub | `.md` |
| JSON | Programmatic consumption, data pipelines | `.json` |
| HTML | Polished CTO-facing presentation | `.html` (single self-contained file) |

## Report Structure

Every report includes:

1. **Header** -- customer name, date, SA name, repository analyzed
2. **Executive Summary** -- PRISM D1 level, verdict, one-paragraph narrative
3. **Radar Chart** -- all 12 scanner categories visualized (ASCII for markdown, SVG for HTML)
4. **Category Breakdown** -- each scanner category with score, max, percentage, red/amber/green status
5. **Interview Summary** -- each of 6 sections with score and key findings
6. **Gap Analysis** -- top-5 gaps with specific remediation recommendations
7. **Strengths** -- top-3 strengths to build on
8. **Onboarding Recommendation** -- track assignment with rationale
9. **90-Day Roadmap** -- milestone table
10. **Appendix** -- full evidence list from scanner

## Usage

```typescript
import { generateReport } from './report-generator';

const { markdown, json, html } = generateReport(assessmentResult, customerInfo, onboardingPlan);

// Write outputs
fs.writeFileSync('report.md', markdown);
fs.writeFileSync('report.json', JSON.stringify(json, null, 2));
fs.writeFileSync('report.html', html);
```

## File Structure

```
reports/
  README.md                                  # This file
  report-generator.ts                        # Generator logic
  generate-html.py                           # HTML report generation (pure Python)
  generate-pdfs.sh                           # PDF conversion via Chrome headless
  templates/
    assessment-report.html                   # HTML template
    assessment-report.md                     # Markdown template
  sample-reports/
    sample-l1.5-startup.json                 # L1.5 sample (Track A)
    sample-l2.5-startup.json                 # L2.5 sample (Track B)
    sample-l3.5-startup.json                 # L3.5 sample (Track C)
```

## Design Principles

- **Self-contained HTML**: the HTML report uses inline CSS and inline SVG. No external dependencies. Open the file in any browser and it renders correctly.
- **Print-friendly**: the HTML report includes print CSS that produces clean A4/Letter output.
- **Professional tone**: these reports go to CTOs and VPs of Engineering. The language is direct, data-driven, and avoids jargon.
- **Deterministic**: the same assessment input always produces the same report.
