# Feature: [Integration Name] Integration

## Requirements
- [ ] Integrate with [external service/API] for [purpose]
- [ ] Implement a client wrapper in `/src/lib/[service]-client.ts`
- [ ] Handle authentication with [external service] using [method: API key / OAuth / IAM]
- [ ] Implement retry logic with exponential backoff for transient failures
- [ ] Implement circuit breaker to prevent cascading failures
- [ ] Cache responses where appropriate (TTL: [N] seconds)
- [ ] Emit structured logs for all external calls (request/response/latency)
- [ ] Provide a mock implementation for testing

## Acceptance Criteria

### Happy Path
- Given valid credentials and a healthy external service, when `[client].doThing(params)` is called, then return the parsed response within [N]ms
- Given a successful response, when the response matches the expected schema, then return a typed result (no `any`)
- Given a successful response, when caching is enabled, then subsequent calls within TTL return the cached result without hitting the external service

### Error Handling
- Given the external service returns HTTP 429 (rate limited), when the call is retried, then wait per the Retry-After header (or exponential backoff) up to 3 retries, then throw a RateLimitError
- Given the external service returns HTTP 500, when the call is retried, then retry up to 3 times with exponential backoff (1s, 2s, 4s), then throw a ServiceUnavailableError
- Given the external service is unreachable (timeout after [N]ms), when the call fails, then throw a TimeoutError without retrying (timeouts are not retriable)
- Given the circuit breaker has tripped (5 failures in 60 seconds), when any call is made, then throw a CircuitOpenError immediately without calling the external service
- Given the circuit breaker is open for 30 seconds, when the next call is made, then attempt a single probe call (half-open state)

### Authentication
- Given valid API credentials, when the client initializes, then authenticate and cache the auth token
- Given expired credentials, when a call returns 401, then refresh the credential and retry once
- Given invalid credentials, when a call returns 403, then throw an AuthenticationError (do not retry)

### Observability
- Given any external call, when the call completes (success or failure), then log: `{ service, method, path, statusCode, latencyMs, cached, retryCount }`
- Given a circuit breaker state change, when the state transitions, then log: `{ service, previousState, newState, reason }`

## Design Constraints
- Client must be injectable (constructor accepts config, not global state)
- All external calls must have a configurable timeout (default: [N]ms)
- Retry policy: exponential backoff with jitter, max 3 retries, max delay 10s
- Circuit breaker: trip after 5 failures in 60s, half-open after 30s
- Cache: in-memory LRU, max [N] entries, TTL [N]s, no cache on errors
- All types from the external API must be mapped to internal interfaces (do not leak external schemas)
- Mock implementation must implement the same interface for use in tests

## External API Reference

### Authentication
- Method: [Bearer token / API key in header / IAM SigV4]
- Endpoint: `https://api.example.com/v1/auth`

### Primary Endpoint
- **Method:** GET
- **URL:** `https://api.example.com/v1/[resource]`
- **Headers:**
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Query params:** `?param1=value&param2=value`
- **Response:**
```json
{
  "data": [
    {
      "id": "string",
      "attribute": "string"
    }
  ],
  "pagination": {
    "next": "string | null",
    "total": "number"
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

## Internal Interface

```typescript
interface [Service]Client {
  doThing(params: DoThingParams): Promise<DoThingResult>;
}

interface DoThingParams {
  // ...
}

interface DoThingResult {
  // Map from external schema to internal types
}

interface [Service]ClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;       // default: 5000
  retryAttempts: number;    // default: 3
  cacheTtlSeconds: number;  // default: 60
}
```
