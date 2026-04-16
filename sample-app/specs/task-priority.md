# Spec: Task Priority Levels

**Status**: Not implemented
**Author**: Workshop team
**Spec-Ref**: specs/task-priority.md

## Summary

Add priority levels to tasks so users can indicate urgency. Tasks can have a priority of `low`, `medium`, `high`, or `critical`. The API should support setting priority on create/update, filtering by priority, and sorting results by priority.

## Requirements

1. The `Task` type MUST include a `priority` field with values: `low`, `medium`, `high`, `critical`.
2. The API MUST default `priority` to `"medium"` when not provided on create.
3. The API MUST allow setting `priority` on task creation (POST /tasks).
4. The API MUST allow updating `priority` on task update (PUT /tasks/:id).
5. The API MUST validate that `priority` is one of the allowed values; return 400 for invalid values.
6. The API MUST support filtering by priority via `?priority=high` on GET /tasks.
7. The API MUST support sorting by priority via `?sort=priority` on GET /tasks (critical first, low last).
8. The API MUST support reverse sort via `?sort=priority&order=asc` (low first, critical last).
9. Existing tasks without a priority field MUST be treated as `"medium"`.
10. All existing tests MUST continue to pass without modification.

## Acceptance Criteria

### AC-1: Default priority on create
- **Given** a POST request to `/tasks` with `{ "title": "New task" }` (no priority)
- **When** the request is processed
- **Then** the created task has `priority: "medium"`

### AC-2: Set priority on create
- **Given** a POST request with `{ "title": "Urgent fix", "priority": "critical" }`
- **When** the request is processed
- **Then** the created task has `priority: "critical"`

### AC-3: Update priority
- **Given** a task exists with `priority: "low"`
- **When** a PUT request is made with `{ "priority": "high" }`
- **Then** the task's priority is updated to `"high"`

### AC-4: Validate priority
- **Given** a POST request with `{ "title": "Bad", "priority": "super-urgent" }`
- **When** the request is processed
- **Then** the response status is 400 with an error about invalid priority

### AC-5: Filter by priority
- **Given** 3 tasks: 1 high, 1 medium, 1 low
- **When** a GET request is made to `/tasks?priority=high`
- **Then** only the high-priority task is returned

### AC-6: Sort by priority descending (default)
- **Given** tasks with priorities: low, critical, medium
- **When** a GET request is made to `/tasks?sort=priority`
- **Then** tasks are returned in order: critical, medium, low

### AC-7: Sort by priority ascending
- **Given** tasks with priorities: low, critical, medium
- **When** a GET request is made to `/tasks?sort=priority&order=asc`
- **Then** tasks are returned in order: low, medium, critical

## Design Constraints

- Modify `src/types.ts` to add the `TaskPriority` type and update the `Task` interface
- Modify `src/routes/tasks.ts` to handle priority in CRUD and filtering/sorting
- Add new tests in `tests/tasks.test.ts` (do not break existing tests)
- No new dependencies

## API Contract

### POST /tasks (with priority)
**Request:**
```json
{
  "title": "Urgent fix",
  "priority": "critical"
}
```
**Response (201):**
```json
{
  "data": {
    "id": "...",
    "title": "Urgent fix",
    "priority": "critical",
    "status": "todo",
    ...
  }
}
```

### GET /tasks?priority=high&sort=priority&order=desc
**Response (200):**
```json
{
  "data": [
    { "id": "...", "priority": "critical", ... },
    { "id": "...", "priority": "high", ... }
  ],
  "count": 2
}
```

### Error Response (400):
```json
{
  "error": "priority must be one of: low, medium, high, critical"
}
```
