# Exercise 2: Make 3 Types of Commits

**Time:** 10 minutes

## Objective

Make three commits with different AI involvement levels and verify that each one gets the correct metadata. This generates the test data you'll need for the dashboard in Module 05.

## Steps

### Commit 1: Human-Only

Write code by hand. No Claude Code, no AI autocomplete.

```bash
cd prism-d1-sample-app
```

Create a utility function manually:

```bash
cat > src/lib/format-date.ts << 'EOF'
/**
 * Formats a Date object as a human-readable string.
 * @param date - Date to format
 * @returns Formatted string like "Apr 13, 2026 10:30 AM"
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
EOF
```

Commit it manually:

```bash
git add src/lib/format-date.ts
git commit -m "feat(lib): add date formatting utility

Human-written utility for formatting dates in API responses."
```

Verify the trailer:

```bash
git log -1 --format='%(trailers)'
```

**Expected:**
```
AI-Origin: human
```

---

### Commit 2: AI-Assisted

You direct Claude Code, but you also make manual edits. This is the most common real-world pattern.

```bash
claude "Create a utility function in src/lib/slugify.ts that converts a string \
to a URL-safe slug. Handle unicode, strip special characters, collapse hyphens."
```

Now **manually edit** the file Claude Code created. Add a comment, change a variable name, fix something you don't like. The point is that both you and the AI contributed.

Commit with the `assisted` confidence level:

```bash
git add src/lib/slugify.ts
git commit -m "feat(lib): add string slugify utility

AI generated the initial implementation, human refined edge case handling.

AI-Origin: claude-code
AI-Confidence: assisted"
```

> Note: We manually set `AI-Confidence: assisted` here because the prepare-commit-msg hook defaults to `implementation`. When the commit message already contains `AI-Origin`, the hook doesn't override.

Verify:

```bash
git log -1 --format='%(trailers)'
```

**Expected:**
```
AI-Origin: claude-code
AI-Confidence: assisted
```

---

### Commit 3: AI-Generated

Claude Code does everything -- implementation and commit -- with no human edits.

```bash
claude "Create a utility function in src/lib/truncate.ts that truncates a string \
to a given length, adding '...' if truncated. Include a test file. Then commit \
with conventional commit format referencing no spec (this is a utility)."
```

Verify:

```bash
git log -1 --format='%(trailers)'
```

**Expected:**
```
AI-Origin: claude-code
AI-Model: anthropic.claude-sonnet-4-20250514
AI-Confidence: implementation
AI-Session: ses_xxxxxxxxxxxxxxxx
```

---

### Review All Three Commits

```bash
git log -3 --format='%h %-20s  AI-Origin: %(trailers:key=AI-Origin,valueonly)  Confidence: %(trailers:key=AI-Confidence,valueonly)'
```

**Expected output (your hashes will differ):**
```
abc1234 feat(lib): add strin  AI-Origin: claude-code  Confidence: implementation
def5678 feat(lib): add slugi  AI-Origin: claude-code  Confidence: assisted
ghi9012 feat(lib): add date   AI-Origin: human        Confidence:
```

### Review the Local Metrics Log

```bash
cat .git/prism-metrics.jsonl | jq -c '{commit_short, ai_origin, ai_confidence, files_changed}'
```

You should see 3 entries with distinct `ai_origin` and `ai_confidence` values.

## Verification

You've completed this exercise when:
- [ ] You have 3 new commits in your log
- [ ] Commit 1 has `AI-Origin: human`
- [ ] Commit 2 has `AI-Origin: claude-code` and `AI-Confidence: assisted`
- [ ] Commit 3 has `AI-Origin: claude-code` and `AI-Confidence: implementation`
- [ ] `.git/prism-metrics.jsonl` has 3 corresponding entries

## Why This Matters

Your dashboard in Module 05 will show AI Contribution Ratio as:
- (AI commits / total commits) * 100
- Broken down by confidence level: implementation vs. assisted vs. reviewed

The three commits you just made give the dashboard real data to display. In production, these accumulate over days and weeks, giving leadership visibility into how AI adoption is progressing.
