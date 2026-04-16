# Feature: [Data Model Name]

## Requirements
- [ ] Define the [Model] entity with fields: [list]
- [ ] Implement CRUD operations for [Model] via the service layer
- [ ] Validate all fields per the constraints below
- [ ] Support pagination for list queries (offset/limit)
- [ ] Support filtering by: [list filterable fields]
- [ ] Support sorting by: [list sortable fields], default: [field] [direction]
- [ ] Enforce uniqueness on: [list unique fields]
- [ ] Implement soft delete (set `deletedAt` rather than removing rows)

## Acceptance Criteria

### Create
- Given valid [Model] data, when `create([Model])` is called, then return the created entity with a generated UUID and timestamps
- Given [Model] data with a duplicate [unique field], when `create([Model])` is called, then throw a ConflictError with message "[field] already exists"
- Given [Model] data missing required field [field], when `create([Model])` is called, then throw a ValidationError listing the missing fields

### Read
- Given an existing [Model] ID, when `findById(id)` is called, then return the complete entity
- Given a non-existent ID, when `findById(id)` is called, then throw a NotFoundError
- Given a soft-deleted [Model] ID, when `findById(id)` is called, then throw a NotFoundError (soft-deleted records are excluded by default)

### List
- Given 25 [Model] records exist, when `list({ limit: 10, offset: 0 })` is called, then return the first 10 records and `{ total: 25, limit: 10, offset: 0 }`
- Given a filter `{ [field]: [value] }`, when `list({ filter })` is called, then return only matching records
- Given sort `{ field: "[field]", direction: "desc" }`, when `list({ sort })` is called, then return records in descending order by that field

### Update
- Given an existing [Model] ID and partial update data, when `update(id, data)` is called, then apply only the provided fields and update `updatedAt`
- Given a non-existent ID, when `update(id, data)` is called, then throw a NotFoundError

### Delete
- Given an existing [Model] ID, when `delete(id)` is called, then set `deletedAt` to current timestamp and return success
- Given a non-existent ID, when `delete(id)` is called, then throw a NotFoundError
- Given an already-deleted [Model] ID, when `delete(id)` is called, then throw a NotFoundError

## Design Constraints
- Use TypeScript interfaces for the model shape (no classes)
- Service layer is responsible for validation -- not the model
- All timestamps are UTC ISO 8601 strings
- IDs are UUIDs v4, generated server-side
- Pagination defaults: limit=20, offset=0, max limit=100
- Soft delete: set `deletedAt`, all queries filter `WHERE deletedAt IS NULL` by default
- Database: [DynamoDB single-table / PostgreSQL / in-memory Map for workshop]

## Schema

```typescript
interface [Model] {
  id: string;           // UUID v4, server-generated
  [field1]: string;     // required, max 255 chars, unique
  [field2]: number;     // required, positive integer
  [field3]?: string;    // optional, ISO 8601 datetime
  createdAt: string;    // ISO 8601, server-generated
  updatedAt: string;    // ISO 8601, server-managed
  deletedAt?: string;   // ISO 8601, null until soft-deleted
}

interface [Model]ListResult {
  items: [Model][];
  total: number;
  limit: number;
  offset: number;
}

interface [Model]Filter {
  [field1]?: string;
  [field2]?: number;
  createdAfter?: string;
  createdBefore?: string;
}

interface [Model]Sort {
  field: keyof Pick<[Model], "[field1]" | "[field2]" | "createdAt">;
  direction: "asc" | "desc";
}
```
