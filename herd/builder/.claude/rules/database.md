---
description: Database-change gotchas — migration and indexing pitfalls. Always loaded.
---

## Database Gotchas

- Adding NOT NULL column to table with existing rows: add as nullable first, backfill, then add constraint. One-step locks the table and fails on non-empty tables.
- Adding index on large table: use `CREATE INDEX CONCURRENTLY` (Postgres) or equivalent. Regular `CREATE INDEX` holds write lock for entire build.
- Every table gets `created_at TIMESTAMP NOT NULL DEFAULT NOW()` and `updated_at TIMESTAMP NOT NULL DEFAULT NOW()`. No exceptions.
- Every foreign key column needs its own index. Without it, ON DELETE CASCADE and JOINs scan the full table.
- Soft-delete (is_deleted/deleted_at) must pair with partial index: `WHERE deleted_at IS NULL`. Otherwise every active-record query does full scan.
- Migration files are append-only in production. Never edit an applied migration — write a new one.
