# Exercise 2: Implement the Spec with Claude Code

**Time:** 10 minutes

## Objective

Feed your authentication spec to Claude Code, measure the implementation time, and validate the result against your acceptance criteria.

## Steps

### Step 1: Start your timer

We're measuring spec-to-code turnaround time. Start a stopwatch now.

### Step 2: Run Claude Code with the spec

```bash
cd prism-d1-sample-app

claude "Implement the user authentication feature per the spec in specs/user-auth.md. \
Create all necessary files: route handler, model interfaces, middleware, and tests."
```

Watch Claude Code work. Note:
- Does it read the spec first?
- Does it reference specific acceptance criteria?
- Does it create tests that map to your ACs?

### Step 3: Stop your timer when Claude Code finishes

Record your time: _______ minutes

### Step 4: Validate against acceptance criteria

Go through each acceptance criterion in your spec and check pass/fail:

```bash
# Run the tests Claude Code generated
npm test

# Start the server and test manually
npm run dev &

# Test: successful login
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' | jq .

# Test: invalid password
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "wrong"}' | jq .

# Test: non-existent user
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "nobody@example.com", "password": "password123"}' | jq .

# Test: missing fields
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

kill %1
```

### Step 5: Score your spec

For each acceptance criterion in your spec, mark:
- **PASS**: Implementation satisfies it correctly
- **FAIL**: Implementation doesn't match
- **MISSING**: Implementation doesn't address it at all (gap in your spec or Claude Code missed it)

```
AC #1 (successful login):  [ PASS / FAIL / MISSING ]
AC #2 (invalid password):  [ PASS / FAIL / MISSING ]
AC #3 (non-existent user): [ PASS / FAIL / MISSING ]
AC #4 (missing fields):    [ PASS / FAIL / MISSING ]
AC #5 (token expiration):  [ PASS / FAIL / MISSING ]
```

**AI First-Pass Acceptance Rate** = (PASS count) / (total ACs) * 100 = _____%

### Step 6: Commit with metadata

```bash
claude "Commit the auth implementation with conventional commit format. \
Reference specs/user-auth.md and include AI origin trailers."
```

## Discussion

Share your results with the group:
- What was your spec-to-code turnaround time?
- What was your first-pass acceptance rate?
- Which ACs failed? Was it a spec problem or an implementation problem?

> **Key insight:** Low acceptance rate usually means the spec was ambiguous, not that Claude Code is bad. If your AC says "handle errors properly" and Claude returns a 500 instead of a 401, the spec was the problem.

## Verification

You've completed this exercise when:
- [ ] Auth endpoint is implemented and running
- [ ] You've tested every acceptance criterion manually or with automated tests
- [ ] You've recorded your turnaround time and acceptance rate
- [ ] Changes are committed with AI origin trailers
