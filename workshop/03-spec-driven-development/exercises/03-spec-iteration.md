# Exercise 3: Iterate on the Spec When Implementation Reveals Gaps

**Time:** 5 minutes

## Objective

Find a gap in your spec based on what Claude Code produced, update the spec, and re-implement. This is the "validate vs. ACs" feedback loop in action.

## Steps

### Step 1: Identify a gap

Look at your first-pass acceptance rate from Exercise 2. Pick one of these common gaps:

**Likely gaps in your spec:**
- What happens when the request Content-Type is not application/json?
- What's the exact JWT payload structure (sub, iat, exp, custom claims)?
- Is the email case-sensitive? (`Test@Example.com` vs `test@example.com`)
- What happens on concurrent login attempts from the same user?
- Does a failed login attempt increment a counter? Lock the account?

If all your ACs passed, deliberately add a new requirement:
- "The login response must include a `refreshToken` in addition to the access token"
- "Failed login attempts must be rate-limited to 5 per minute per email"

### Step 2: Update the spec

Open `specs/user-auth.md` and add:
1. A new **requirement** for the gap you identified
2. A new **acceptance criterion** in Given/When/Then format
3. Any **design constraints** the new requirement implies

Example addition:

```markdown
## Requirements
...
- [ ] Email matching must be case-insensitive

## Acceptance Criteria
...
- Given a user registered as "Test@Example.com", when POST /auth/login
  is called with email "test@example.com", then authentication succeeds
  and returns 200 with a valid token

## Design Constraints
...
- Normalize email to lowercase before lookup and storage
```

### Step 3: Re-implement with Claude Code

```bash
claude "The spec at specs/user-auth.md has been updated with a new requirement. \
Review the updated spec and modify the auth implementation to satisfy the new \
acceptance criteria. Run tests to verify."
```

### Step 4: Validate the new AC

Test the specific acceptance criterion you added:

```bash
npm run dev &

# Example: test case-insensitive email
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "TEST@EXAMPLE.COM", "password": "password123"}' | jq .

kill %1
```

### Step 5: Commit the iteration

```bash
claude "Commit the spec update and implementation changes. Conventional commit \
format, reference specs/user-auth.md, include AI origin trailers."
```

## Reflection

The spec iteration count for this feature is now **2** (original + this fix). In a real project, you want this number trending toward 1 as your team gets better at writing specs. High iteration counts mean your specs are leaving too much to interpretation.

## Verification

You've completed this exercise when:
- [ ] You identified at least one gap in your original spec
- [ ] The spec has been updated with new requirements and ACs
- [ ] Claude Code implemented the update
- [ ] The new AC passes validation
- [ ] Changes are committed with proper trailers
