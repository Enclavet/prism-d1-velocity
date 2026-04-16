# Feature: [API Endpoint Name]

## Requirements
- [ ] Provide a [METHOD] endpoint at [PATH]
- [ ] Accept [request body / query params] with the following fields: [list]
- [ ] Validate all input fields per the schema below
- [ ] Return [success response] on valid request
- [ ] Return appropriate error responses for: [list error cases]
- [ ] Require authentication via [Bearer token / API key / none]
- [ ] Log all requests to the application logger

## Acceptance Criteria
- Given a valid request with all required fields, when [METHOD] [PATH] is called, then return [STATUS] with the response schema below
- Given a request with missing required field "[FIELD]", when [METHOD] [PATH] is called, then return 400 with Problem Details: `{ "title": "Bad Request", "detail": "[FIELD] is required" }`
- Given a request with invalid [FIELD] format, when [METHOD] [PATH] is called, then return 422 with Problem Details describing the validation error
- Given an unauthenticated request (no/invalid token), when [METHOD] [PATH] is called, then return 401 with Problem Details: `{ "title": "Unauthorized" }`
- Given a valid request for a non-existent resource, when [METHOD] [PATH] is called, then return 404 with Problem Details
- Given a server error during processing, when [METHOD] [PATH] is called, then return 500 with Problem Details (no internal details leaked)

## Design Constraints
- Response time target: < [N]ms at p99
- No direct database queries in the route handler -- use the service layer
- All error responses must follow RFC 7807 Problem Details format
- Input validation must happen before any business logic
- [Rate limiting / caching / other cross-cutting concerns]

## API Contract

### Request
- **Method:** [GET | POST | PUT | PATCH | DELETE]
- **Path:** `/api/v1/[resource]`
- **Headers:**
  - `Content-Type: application/json` (for POST/PUT/PATCH)
  - `Authorization: Bearer <token>` (if authenticated)
- **Body:**
```json
{
  "field1": "string (required, max 255 chars)",
  "field2": "number (required, positive integer)",
  "field3": "string (optional, ISO 8601 datetime)"
}
```

### Success Response (200/201)
```json
{
  "id": "string (uuid)",
  "field1": "string",
  "field2": "number",
  "field3": "string | null",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)"
}
```

### Error Response (4xx/5xx)
```json
{
  "type": "about:blank",
  "title": "string (HTTP status text)",
  "status": "number (HTTP status code)",
  "detail": "string (human-readable explanation)",
  "instance": "string (request URI)"
}
```
