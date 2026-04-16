# Spec: Task Search and Filtering

**Status**: Not implemented
**Author**: Workshop team
**Spec-Ref**: specs/task-search.md

## Summary

Extend the `GET /tasks` endpoint to support searching and filtering tasks by status, tag, and free-text query. This allows API consumers to find tasks without fetching the full list and filtering client-side.

## Requirements

1. The API MUST support filtering tasks by `status` via query parameter (e.g., `?status=todo`).
2. The API MUST support filtering tasks by `tag` via query parameter (e.g., `?tag=urgent`). A task matches if its `tags` array includes the value.
3. The API MUST support free-text search via `?q=<query>` that matches against `title` and `description` (case-insensitive substring match).
4. The API MUST support combining multiple filters with AND logic (e.g., `?status=todo&tag=urgent&q=deploy`).
5. The API MUST return an empty array (not an error) when no tasks match.
6. The API MUST return 400 if an invalid `status` value is provided as a filter.
7. The `count` field in the response MUST reflect the filtered count, not the total.
8. Existing behavior (GET /tasks with no query params) MUST remain unchanged.

## Acceptance Criteria

### AC-1: Filter by status
- **Given** 3 tasks exist: 2 with status `todo`, 1 with status `done`
- **When** a GET request is made to `/tasks?status=todo`
- **Then** the response contains 2 tasks and `count: 2`

### AC-2: Filter by tag
- **Given** 3 tasks exist: 1 tagged `["urgent"]`, 1 tagged `["backend"]`, 1 tagged `["urgent", "backend"]`
- **When** a GET request is made to `/tasks?tag=urgent`
- **Then** the response contains 2 tasks (the ones with the `urgent` tag)

### AC-3: Free-text search
- **Given** tasks with titles "Deploy service", "Write tests", "Deploy database"
- **When** a GET request is made to `/tasks?q=deploy`
- **Then** the response contains 2 tasks (case-insensitive match)

### AC-4: Combined filters
- **Given** multiple tasks with varying status, tags, and titles
- **When** a GET request is made to `/tasks?status=todo&q=deploy`
- **Then** only tasks matching ALL filters are returned

### AC-5: No matches
- **Given** tasks exist but none match the filter
- **When** a GET request is made to `/tasks?status=done`
- **Then** the response is `{ "data": [], "count": 0 }`

### AC-6: Invalid status filter
- **Given** any state
- **When** a GET request is made to `/tasks?status=invalid`
- **Then** the response status is 400 with an error message

## Design Constraints

- Modify the existing `GET /tasks` handler in `src/routes/tasks.ts`
- Use Express `req.query` for parameter access
- All filtering happens in-memory (iterate the task store)
- Do not add any new dependencies

## API Contract

### GET /tasks?status=todo&tag=urgent&q=deploy

**Query Parameters (all optional):**
| Param    | Type   | Description                           |
|----------|--------|---------------------------------------|
| `status` | string | Filter by task status                 |
| `tag`    | string | Filter by tag (exact match in array)  |
| `q`      | string | Free-text search on title/description |

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "title": "Deploy service",
      "status": "todo",
      "tags": ["urgent"],
      ...
    }
  ],
  "count": 1
}
```

**Response (400) — invalid status:**
```json
{
  "error": "Invalid status filter: must be one of: todo, in-progress, done"
}
```
