# CLAUDE.md -- Reference Implementation

## Project Overview
This is the PRISM D1 sample application -- a TypeScript REST API built with
Express.js and deployed on AWS (Lambda + API Gateway via CDK). It demonstrates
AI-native development lifecycle practices for the D1 Velocity workshop.

## Development Workflow
- ALWAYS check /specs for an existing spec before implementing any feature
- If no spec exists for the requested feature, STOP and tell the developer
  to create a spec first. Do not proceed without a spec.
- Spec files use the Kiro format: requirements, acceptance criteria, design
  constraints, and API contract sections
- Implementation must satisfy ALL acceptance criteria in the spec -- no more, no less
- When the spec is ambiguous, ask for clarification rather than guessing

## Code Standards
- TypeScript strict mode is enabled -- never disable it
- No use of `any` type. Define interfaces in /src/models/ for all data shapes.
- All API route handlers must include JSDoc:
  ```typescript
  /**
   * @route GET /health
   * @param req - Express request
   * @returns 200 with HealthResponse
   */
  ```
- Error responses follow RFC 7807 Problem Details:
  ```json
  { "type": "about:blank", "title": "Not Found", "status": 404, "detail": "..." }
  ```
- Functions must be < 40 lines. Extract helpers if longer.
- No console.log in production code -- use the logger from /src/lib/logger.ts

## Testing
- Every new function needs a test in an adjacent `.test.ts` file
- Run all tests: `npm test`
- Run one file: `npx vitest run src/routes/health.test.ts`
- Tests must pass before committing
- Use vitest with `describe/it/expect` patterns (not jest globals)

## Git Commit Conventions
- Conventional commits: `feat|fix|docs|refactor|test(scope): description`
- Scope is the module name: `api`, `auth`, `db`, `infra`, `docs`
- Reference the spec in the commit body: `Spec: specs/<filename>.md`
- One logical change per commit -- do not bundle unrelated changes

## Dependencies
- Do not add new npm dependencies without explicit approval
- Prefer Node.js built-ins over third-party packages
- If a dependency is needed, check it's actively maintained (>100 weekly downloads, updated in last 6 months)

## Project Structure
```
/src
  /routes/      -- Express route handlers (one file per resource)
  /models/      -- TypeScript interfaces and types
  /middleware/   -- Express middleware (auth, error handling, logging)
  /lib/         -- Shared utilities (logger, config, validators)
/specs/         -- Feature specifications (Kiro format)
/tests/         -- Integration and E2E tests
/infra/         -- CDK infrastructure code
```
