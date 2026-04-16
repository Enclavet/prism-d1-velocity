# Exercise 1: Install PRISM Git Hooks

**Time:** 10 minutes

## Objective

Install the PRISM git hooks in the sample-app repository so that every commit automatically gets tagged with AI origin metadata.

## Steps

### Step 1: Review the hook scripts

Before installing anything, read what the hooks do:

**prepare-commit-msg** -- Runs before you write the commit message. It detects whether the commit was authored by Claude Code and adds trailers to the commit message automatically.

**post-commit** -- Runs after the commit is recorded. It logs the commit metadata to a local JSON file for offline analysis.

### Step 2: Install the hooks

```bash
cd prism-d1-sample-app

# Copy the prepare-commit-msg hook
cp /path/to/workshop/04-instrumenting-ai-metrics/exercises/prepare-commit-msg .git/hooks/prepare-commit-msg
chmod +x .git/hooks/prepare-commit-msg

# Copy the post-commit hook
cp /path/to/workshop/04-instrumenting-ai-metrics/exercises/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

Adjust the path above to wherever you cloned the workshop repo.

### Step 3: Understand the detection logic

The prepare-commit-msg hook detects AI involvement by checking:

1. **Environment variable:** Is `CLAUDE_CODE_SESSION_ID` set? Claude Code sets this when it's running.
2. **Parent process:** Is the commit being made from within a Claude Code session?
3. **Manual override:** Does the commit message already contain an `AI-Origin:` trailer? If so, the hook respects it and doesn't override.

Detection result maps to:
- `CLAUDE_CODE_SESSION_ID` present --> `AI-Origin: claude-code`, `AI-Confidence: implementation`
- Neither detected --> `AI-Origin: human`
- Existing `AI-Origin:` trailer --> Keep as-is (allows `assisted` and `reviewed` values)

### Step 4: Test with a human commit

Make a small change and commit manually:

```bash
echo "// workshop test" >> src/index.ts
git add src/index.ts
git commit -m "test: verify human commit tagging"
```

Check the trailer:

```bash
git log -1 --format='%(trailers)'
```

**Expected output:**
```
AI-Origin: human
```

### Step 5: Test with a Claude Code commit

```bash
claude "Add a comment to the top of src/index.ts that says 'PRISM D1 Workshop' \
and commit it with message 'docs: add workshop header'"
```

Check the trailer:

```bash
git log -1 --format='%(trailers)'
```

**Expected output:**
```
AI-Origin: claude-code
AI-Model: anthropic.claude-sonnet-4-20250514
AI-Confidence: implementation
AI-Session: ses_xxxxxxxxxxxxxxxx
```

### Step 6: Check the local metric log

The post-commit hook writes to `.git/prism-metrics.jsonl`:

```bash
cat .git/prism-metrics.jsonl | jq .
```

Each line is a JSON object with the commit's metric data.

## Verification

You've completed this exercise when:
- [ ] Both hooks are installed in `.git/hooks/` and executable
- [ ] A manual commit gets `AI-Origin: human`
- [ ] A Claude Code commit gets `AI-Origin: claude-code` plus model/session trailers
- [ ] `.git/prism-metrics.jsonl` contains entries for both commits

## Troubleshooting

**Hook doesn't run:** Check `ls -la .git/hooks/prepare-commit-msg` -- it must be executable (`-rwxr-xr-x`).

**Trailers not appearing:** The hook modifies the commit message file. If you use `git commit -m "..."`, the hook appends trailers to the message. If you see no trailers, check if another hook is overwriting the message file.

**Wrong AI-Origin value:** The detection relies on `CLAUDE_CODE_SESSION_ID`. If Claude Code is configured differently, the env var name may differ. Check with `env | grep -i claude` inside a Claude Code session.
