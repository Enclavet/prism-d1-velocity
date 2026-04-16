# Exercise 1: Create a CLAUDE.md for the Sample App

**Time:** 10 minutes

## Objective

Create a `CLAUDE.md` file in the sample-app root that enforces spec-driven development. Then verify it works by testing Claude Code's behavior with and without a spec.

## Steps

### Step 1: Navigate to the sample app

```bash
cd prism-d1-sample-app
```

### Step 2: Create CLAUDE.md

Create a file called `CLAUDE.md` at the project root with the following content. You can copy this as a starting point, then customize it:

```markdown
# CLAUDE.md

## Project Overview
This is the PRISM D1 sample application -- a TypeScript REST API
built with Express.js. It serves as the workshop project for
learning AI-native development lifecycle practices.

## Development Workflow
- ALWAYS check /specs for an existing spec before implementing any feature
- If no spec exists for the requested feature, STOP and create a spec first
- Spec files use the Kiro format (see /specs/template.md for reference)
- Do not implement beyond what the spec's acceptance criteria define

## Code Standards
- TypeScript strict mode (`strict: true` in tsconfig.json)
- No use of `any` type -- use proper interfaces
- All API endpoints must include JSDoc with @route, @param, and @returns
- Error responses follow RFC 7807 Problem Details format
- All new functions require unit tests in the adjacent `.test.ts` file

## Git Commit Conventions
- Use conventional commits: `feat|fix|docs|refactor|test(scope): description`
- Reference the spec file in the commit body: `Spec: specs/<filename>.md`
- Keep commits atomic -- one logical change per commit

## Testing
- Run tests with: `npm test`
- Run single test file: `npx vitest run <path>`
- All tests must pass before committing

## Project Structure
- `/src/routes/` -- API route handlers
- `/src/models/` -- Data models and interfaces
- `/src/middleware/` -- Express middleware
- `/specs/` -- Feature specifications (Kiro format)
- `/tests/` -- Integration tests
```

### Step 3: Create the specs directory and template

```bash
mkdir -p specs

cat > specs/template.md << 'EOF'
# Feature: [Feature Name]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Acceptance Criteria
- Given [context], when [action], then [expected result]
- Given [context], when [action], then [expected result]

## Design Constraints
- Constraint 1
- Constraint 2

## API Contract (if applicable)
- Method: GET|POST|PUT|DELETE
- Path: /api/v1/...
- Request body: { ... }
- Response: { ... }
EOF
```

### Step 4: Test the CLAUDE.md enforcement

Open Claude Code and ask it to implement something that has no spec:

```bash
claude "Add a user registration endpoint to the API"
```

**Expected behavior:** Claude Code should recognize there's no spec for user registration and either:
- Refuse to implement and suggest creating a spec first, OR
- Create a spec first before proceeding to implementation

If Claude Code immediately starts writing code without mentioning the spec requirement, refine your CLAUDE.md wording to be more explicit.

### Step 5: Test with a spec present

Create a simple spec:

```bash
cat > specs/health-check.md << 'EOF'
# Feature: Health Check Endpoint

## Requirements
- [ ] Provide a GET endpoint that returns service health status
- [ ] Include uptime and timestamp in the response
- [ ] Return HTTP 200 when healthy

## Acceptance Criteria
- Given the service is running, when GET /health is called, then return 200 with status "ok"
- Given the service is running, when GET /health is called, then include "uptime" in seconds
- Given the service is running, when GET /health is called, then include "timestamp" in ISO 8601

## Design Constraints
- No authentication required on this endpoint
- Response time must be < 50ms (no database calls)

## API Contract
- Method: GET
- Path: /health
- Response: `{ "status": "ok", "uptime": 1234, "timestamp": "2026-04-13T10:00:00Z" }`
EOF
```

Now ask Claude Code to implement it:

```bash
claude "Implement the health check endpoint per the spec in specs/health-check.md"
```

**Expected behavior:** Claude Code reads the spec, implements exactly what it describes, and references the spec in its output.

## Verification

You've completed this exercise when:
- [ ] `CLAUDE.md` exists at the project root
- [ ] `/specs/` directory exists with template.md and health-check.md
- [ ] Claude Code respects the spec-first rule (refuses or warns when no spec exists)
- [ ] Claude Code implements correctly when a spec is provided

## Discussion Point

After completing this exercise, consider: How would you customize CLAUDE.md for your actual team's codebase? What rules would be most valuable?
