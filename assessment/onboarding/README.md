# PRISM D1 Velocity -- Onboarding

## Overview

After a startup completes the PRISM D1 Velocity assessment (automated scanner + SA interview), the onboarding system routes them into the right workshop track and generates a personalized engagement plan.

## How It Works

1. **Assessment completes** -- scanner scores, interview scores, and org-readiness factors are finalized.
2. **Blended score calculated** -- 40% scanner + 40% interview + 20% org readiness produces a PRISM D1 Level (L1.0--L5.0) and a verdict.
3. **Onboarding router** (`onboarding-router.ts`) maps the level and verdict to one of four tracks.
4. **Personalized plan** generated with workshop modules, pre-work, bootstrapper priorities, success metrics, and SA touchpoint cadence.
5. **Email templates** (`email-templates.md`) give SAs ready-to-send communications for each milestone.

## Tracks

| Track | Level Range | Verdict | Workshop Duration | Pilot |
|-------|-------------|---------|-------------------|-------|
| A -- Foundations | L1.0--L1.5 | NEEDS_FOUNDATIONS | 2-wk pre-work + 4 hr (Modules 00--02) | Re-assess at 4 wk |
| B -- Full Workshop | L2.0--L2.5 | READY_FOR_PILOT | 1-wk pre-work + 4 hr (all 6 modules) | 8-week pilot |
| C -- Accelerated | L3.0--L3.5 | READY_FOR_PILOT | 2 hr (Modules 03--05) | 8-week pilot |
| D -- Advanced Optimization | L4.0+ | READY_FOR_PILOT | Custom | Architecture review |

## File Structure

```
onboarding/
  README.md               # This file
  tracks.md               # Detailed track definitions
  onboarding-router.ts    # Deterministic routing logic
  email-templates.md      # SA email templates
  pre-work/
    track-a-prework.md    # Pre-work for Track A (Foundations)
    track-b-prework.md    # Pre-work for Track B (Full Workshop)
    track-c-prework.md    # Pre-work for Track C (Accelerated)
```

## Usage

```typescript
import { routeOnboarding } from './onboarding-router';

const plan = routeOnboarding(assessmentResult, customerInfo);
// Returns a fully typed OnboardingPlan with track, modules, pre-work, milestones, etc.
```

## Key Principles

- **Deterministic routing** -- identical inputs always produce the same track assignment and plan.
- **No wasted time** -- customers skip modules they have already mastered. Track C skips foundations; Track A skips advanced topics.
- **Measurable outcomes** -- every plan includes quantified success metrics and milestone dates.
- **SA-guided, not SA-dependent** -- the plan is detailed enough for a customer to self-serve, but SA touchpoints keep the engagement on rails.
