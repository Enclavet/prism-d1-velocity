# Exercise 1: Write a Spec for User Authentication

**Time:** 10 minutes

## Objective

Write a Kiro-format spec for a user authentication endpoint. This is a deliberately open-ended exercise -- the point is to practice translating a feature request into a spec that Claude Code can implement unambiguously.

## The Feature Request

> "We need users to be able to log in to the API. They'll send their email and password, get back a token they can use for subsequent requests. Handle the error cases properly."

That's it. That's what you'd get from a PM in Slack.

## Your Task

Create `specs/user-auth.md` in the sample-app repo using the Kiro spec format:

```bash
cd prism-d1-sample-app
```

Open your editor (Kiro or VS Code) and create `specs/user-auth.md` with these sections:

### Required Sections

1. **Feature name** -- clear, specific
2. **Requirements** -- numbered, independently testable
3. **Acceptance Criteria** -- Given/When/Then format, covering:
   - Successful login (happy path)
   - Invalid password
   - Non-existent user
   - Missing required fields
   - Token expiration behavior
4. **Design Constraints** -- answer these questions:
   - What password hashing algorithm?
   - What token format (JWT? opaque?)
   - What token lifetime?
   - Where is the user store? (in-memory for workshop purposes is fine)
5. **API Contract** -- method, path, request body schema, response schemas (success + error)

### Tips

- Be specific about HTTP status codes. "Return an error" is vague. "Return 401 with Problem Details" is implementable.
- Define the response shape exactly, including field names and types.
- Include edge cases you'd normally forget: What about rate limiting? What about SQL injection in the email field? You decide what's in scope.
- Think about what Claude Code would need to know to implement this without asking you a single question.

## Time Check

After 7 minutes, your instructor will show the reference spec. Don't look at solutions/ yet -- the exercise is in the writing, not the reading.

## Verification

You've completed this exercise when:
- [ ] `specs/user-auth.md` exists with all 5 sections
- [ ] Acceptance criteria cover at least happy path + 3 error cases
- [ ] API contract specifies exact request/response JSON schemas
- [ ] A teammate could read your spec and implement it without asking questions
