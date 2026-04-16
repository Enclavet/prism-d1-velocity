# Exercise 3: Review Commit Metadata and Understand the Dashboard Feed

**Time:** 10 minutes

## Objective

Examine the metadata structure on your AI-assisted commits and understand how each field feeds the downstream PRISM dashboard (which we'll build in Modules 03-05).

## Steps

### Step 1: Inspect your commit history

```bash
cd prism-d1-sample-app

# Show all commits with their AI-Origin trailer
git log --format='%h %ai | %-20s | AI-Origin: %(trailers:key=AI-Origin,valueonly)' --no-walk --stdin <<< "$(git rev-list HEAD)"
```

Simpler version:

```bash
git log --all --format='%h %s [%(trailers:key=AI-Origin,valueonly)]'
```

### Step 2: Understand the trailer schema

Each AI-assisted commit should carry these trailers:

| Trailer | Values | Feeds Metric |
|---------|--------|-------------|
| `AI-Origin` | `claude-code`, `human`, `kiro` | AI Contribution Ratio |
| `AI-Model` | `anthropic.claude-sonnet-4-20250514`, etc. | Model Usage Distribution |
| `AI-Confidence` | `implementation`, `assisted`, `reviewed` | AI Autonomy Level |
| `AI-Session` | Session ID string | Session-to-Commit Traceability |
| `Spec` | `specs/<filename>.md` | Spec Coverage Ratio |

### Step 3: Calculate AI contribution ratio (manual)

Count your commits by origin:

```bash
# Total commits
TOTAL=$(git rev-list --count HEAD)

# AI-originated commits
AI_COUNT=$(git log --all --format='%(trailers:key=AI-Origin,valueonly)' | grep -c "claude-code" || true)

# Human commits
HUMAN_COUNT=$(git log --all --format='%(trailers:key=AI-Origin,valueonly)' | grep -c "human" || true)

echo "Total: $TOTAL | AI: $AI_COUNT | Human: $HUMAN_COUNT"
echo "AI Contribution Ratio: $(echo "scale=2; $AI_COUNT / $TOTAL * 100" | bc)%"
```

This is the manual version of what the PRISM pipeline does automatically. In Module 03, git hooks will emit this data as structured events.

### Step 4: Map trailer data to PRISM dashboard panels

Draw this mapping on paper or in your notes:

```
Developer Action          Git Trailer           Dashboard Metric
─────────────────────────────────────────────────────────────────
claude code implements    AI-Origin: claude-code  AI Contribution %
  a spec                 AI-Confidence: impl.    AI Autonomy Level
                         Spec: specs/foo.md      Spec Coverage %

Developer writes code    AI-Origin: human        Human Contribution %
  manually               (no AI-Confidence)

Claude Code reviews      AI-Origin: claude-code  AI Review Coverage %
  a PR                   AI-Confidence: reviewed

PR merges                (computed at CI time)   Deployment Frequency
                                                 Lead Time for Changes
```

### Step 5: Verify trailer extractability

The PRISM pipeline uses `git log --format='%(trailers)'` to extract metadata. Verify your trailers are parseable:

```bash
# Extract all trailers as key-value pairs
git log -1 --format='%(trailers:key,valueonly,separator=%x00)' | tr '\0' '\n'

# Verify JSON-compatible extraction
git log -1 --format='{
  "commit": "%H",
  "author": "%ae",
  "date": "%aI",
  "ai_origin": "%(trailers:key=AI-Origin,valueonly)",
  "ai_model": "%(trailers:key=AI-Model,valueonly)",
  "ai_confidence": "%(trailers:key=AI-Confidence,valueonly)",
  "spec": "%(trailers:key=Spec,valueonly)"
}'
```

The output should be valid JSON (or close to it). This is essentially what the post-commit hook in Module 03 will emit.

## Verification

You've completed this exercise when:
- [ ] You can extract AI-Origin from any commit using `git log --format`
- [ ] You understand which trailer maps to which dashboard metric
- [ ] You can produce a JSON-like payload from commit trailers
- [ ] You've calculated a manual AI contribution ratio from your commit history

## Key Takeaway

Every piece of dashboard data in Module 05 starts here -- as a trailer on a git commit. The entire PRISM metrics pipeline is built on this foundation. Get the trailers right and everything downstream works. Skip them and you're flying blind.
