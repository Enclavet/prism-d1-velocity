# Exercise 2: First AI-Assisted Commit with AI Origin Trailer

**Time:** 10 minutes

## Objective

Use Claude Code to implement the health check endpoint from your spec, commit it, and inspect the AI origin metadata in the git log.

## Steps

### Step 1: Implement the spec with Claude Code

```bash
cd prism-d1-sample-app

claude "Implement the health check endpoint per the spec in specs/health-check.md. \
Create the route handler and register it with the Express app."
```

Review the code Claude Code produces. It should:
- Create a route handler at `/health`
- Return `{ status: "ok", uptime: <seconds>, timestamp: <ISO 8601> }`
- Match the acceptance criteria in the spec

### Step 2: Review the changes

```bash
git diff
```

Check that the implementation matches the spec. If it doesn't, iterate:

```bash
claude "The health endpoint is missing the uptime field. Fix it per the spec."
```

### Step 3: Run tests (if Claude Code generated them)

```bash
npm test
```

### Step 4: Stage and commit with AI origin metadata

Claude Code can create the commit for you with proper metadata:

```bash
claude "Commit the health check implementation. Use conventional commit format, \
reference the spec file, and include the AI origin trailer."
```

Alternatively, commit manually with the trailer:

```bash
git add src/routes/health.ts src/routes/health.test.ts
git commit -m "feat(api): add health check endpoint

Implements GET /health returning service status with uptime and timestamp.

Spec: specs/health-check.md
AI-Origin: claude-code
AI-Model: anthropic.claude-sonnet-4-20250514
AI-Confidence: implementation"
```

### Step 5: Inspect the commit metadata

```bash
# View the full commit with trailers
git log -1 --format=full

# Extract just the trailers
git log -1 --format='%(trailers)'

# Extract a specific trailer value
git log -1 --format='%(trailers:key=AI-Origin,valueonly)'
```

**Expected output:**

```
AI-Origin: claude-code
AI-Model: anthropic.claude-sonnet-4-20250514
AI-Confidence: implementation
Spec: specs/health-check.md
```

### Step 6: Compare with a human commit

Make a small manual edit (e.g., fix a typo in a comment) and commit it without AI:

```bash
# Edit a file manually
git add -p
git commit -m "docs: fix typo in health check comment

AI-Origin: human"
```

Now compare both commits:

```bash
git log -2 --format='%h %s | AI-Origin: %(trailers:key=AI-Origin,valueonly)'
```

## Verification

You've completed this exercise when:
- [ ] Health check endpoint is implemented and committed
- [ ] `git log -1 --format='%(trailers)'` shows AI-Origin, AI-Model, and AI-Confidence trailers
- [ ] You can distinguish AI-assisted from human commits in the git log
- [ ] The implementation matches the spec's acceptance criteria

## What Just Happened

You made your first tracked AI-assisted commit. The trailers you added are just strings in git right now -- they don't go anywhere automatically. In Module 03, we'll install git hooks that:
1. Auto-detect AI-assisted commits and add trailers automatically
2. Emit the trailer data as structured metrics to your AWS pipeline

For now, the important thing is understanding what data you'll be capturing.
