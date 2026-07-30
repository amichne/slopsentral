---
name: "sqlite-readonly-navigation"
description: "Open and navigate an existing SQLite database through a defensively read-only connection. Use for schema, table, index, foreign-key, generation, query-plan, and snapshot inspection, including resolving Kast's exact workspace source index from live readiness metadata; not for migrations, repair, VACUUM, checkpoints, backups, or any write."
---

# SQLite Read-Only Navigation

Prefer a product-owned typed query when one exists. Use raw SQLite to inspect
what that interface does not expose, after discovering schema rather than
assuming table or column names.

## Workflow

1. Identify an existing database explicitly, or resolve Kast's source index
   from exact-root managed readiness metadata.
2. Use `scripts/sqlite_readonly`. It requires an existing file and invokes the
   SQLite CLI with safe mode, read-only open flags, a busy timeout,
   `query_only=ON`, and `trusted_schema=OFF`.
3. Inspect `sqlite_schema` and table/index pragmas before writing a query.
4. Hold one read transaction for a coherent multi-query snapshot.
5. Use `EXPLAIN QUERY PLAN` before characterizing a slow query.
6. Keep one connection alive when comparing `PRAGMA main.data_version`;
   values are meaningful only relative to that connection.

## Commands

```bash
SQLITE_READER="source/skills/sqlite-readonly-navigation/scripts/sqlite_readonly"

"$SQLITE_READER" --kast-workspace "$WORKSPACE_ROOT" --print-path
"$SQLITE_READER" --database /absolute/path/to/database.db
"$SQLITE_READER" --database /absolute/path/to/database.db \
  --json \
  --query 'SELECT type, name FROM sqlite_schema ORDER BY type, name;'
```

An offline relative path must be anchored explicitly:

```bash
"$SQLITE_READER" \
  --workspace "$WORKSPACE_ROOT" \
  --database .state/cache.db
```

## Boundaries

- Never use `immutable=1` for a live WAL database; it can ignore current WAL
  state.
- Never run `VACUUM`, `REINDEX`, `ANALYZE`, `PRAGMA optimize`, checkpoints,
  `.dump`, `.backup`, `.save`, or writes through this skill.
- Never reproduce Kast workspace hashes. If exact-root managed metadata is not
  available, require an explicit existing database path.
- Kast repository overlays are combined by Kast's graph layer. Raw SQLite reads
  of the base database do not automatically apply overlay semantics.
- Use Kast for Kotlin and Gradle semantic claims.

## Reference Routing

Read [navigation.md](references/navigation.md) for schema discovery, coherent
snapshots, query plans, generation checks, and Kast-owned alternatives.

## Completion Criteria

- The database path is explicit and already exists.
- The connection is read-only at both open and SQLite query layers.
- Queries are based on discovered schema and use a coherent snapshot when
  multiple statements support one claim.
- No database, WAL, journal, or application metadata is created or modified.
