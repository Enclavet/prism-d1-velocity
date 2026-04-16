# Sample App — Claude Code Configuration

## Project Overview

This is a simple Task Management REST API used as the hands-on target for the PRISM D1 Velocity workshop. Participants use Claude Code to implement features against specs.

## Project Structure

```
sample-app/
  src/
    index.ts          — Express app entry point
    types.ts          — TypeScript interfaces
    routes/
      health.ts       — GET /health
      tasks.ts        — CRUD task endpoints
  tests/
    tasks.test.ts     — Jest test suite
  specs/
    task-api.md       — Existing API spec (implemented)
    task-search.md    — Search/filter spec (unimplemented — Exercise 2)
    task-priority.md  — Priority levels spec (unimplemented — Exercise 3)
```

## Development Rules

1. **Spec-driven development**: Before implementing any feature, read the corresponding spec in `specs/`. Never start coding without a spec.
2. **AI origin tagging**: Every commit must include a trailer: `AI-Origin: claude-code` or `AI-Origin: human`.
3. **Model reference**: Include `AI-Model: <model-id>` trailer in commits for AI-assisted work.
4. **Spec reference**: Include `Spec-Ref: specs/<name>.md` trailer linking the commit to its spec.
5. **Test-first**: Write or update tests before implementing features. Run `npm test` to validate.

## Conventions

- TypeScript strict mode
- Express.js with typed request/response handlers
- In-memory storage (no database) — use the `taskStore` Map in `routes/tasks.ts`
- HTTP status codes: 200 (ok), 201 (created), 400 (bad request), 404 (not found), 500 (server error)
- All responses are JSON with consistent shape: `{ data }` or `{ error: string }`
- UUIDs for task IDs (use `uuid` package)
- ISO 8601 timestamps for `createdAt` and `updatedAt`

## Model Inference

This project uses **Amazon Bedrock** for Claude model inference. When configuring Claude Code:
- Profile: Use the Bedrock-configured AWS profile
- Region: us-west-2 (or workshop-configured region)

## Metrics Schema Reference

Commits from this repo emit events to EventBridge following the PRISM schema:

```json
{
  "source": "prism.d1.velocity",
  "detail-type": "prism.d1.<commit|pr|deploy>",
  "detail": {
    "team_id": "string",
    "repo": "prism-d1-sample-app",
    "timestamp": "ISO8601",
    "ai_context": {
      "tool": "claude-code",
      "model": "string",
      "origin": "ai-assisted|ai-generated|human"
    }
  }
}
```

## Implementing a Spec

When asked to implement a feature:

1. Read the spec: `specs/<feature>.md`
2. Identify all numbered requirements and acceptance criteria
3. Write tests that cover each acceptance criterion
4. Implement the feature to pass all tests
5. Run `npm test` to verify
6. Commit with proper trailers:
   ```
   feat: <description>

   Spec-Ref: specs/<feature>.md
   AI-Origin: claude-code
   AI-Model: <model-id>
   ```
