# SQLite Read-Only Navigation

## Resolve and open

For a ready Kast workspace:

```bash
WORKSPACE_ROOT="$(pwd -P)"
SQLITE_READER="source/skills/sqlite-readonly-navigation/scripts/sqlite_readonly"
KAST_DATABASE="$(
  "$SQLITE_READER" \
    --kast-workspace "$WORKSPACE_ROOT" \
    --print-path
)"
test -f "$KAST_DATABASE"
```

Resolution requires managed exact-root readiness, verifies the workspace root
inside `workspace.json`, and uses the sibling `cache/source-index.db`. It does
not reconstruct a workspace hash or fall back to a configuration resolver that
may migrate legacy state.

When the runtime is unavailable, pass an explicit existing path. Resolve a
relative path only with `--workspace`.

## Navigate interactively

```bash
"$SQLITE_READER" --database "$KAST_DATABASE"
```

Useful SQLite shell commands and queries:

```sql
.databases
.tables
.schema

SELECT type, name, tbl_name
FROM sqlite_schema
WHERE name NOT LIKE 'sqlite_%'
ORDER BY type, name;

SELECT * FROM pragma_table_list
ORDER BY schema, name;

SELECT cid, name, type, "notnull", dflt_value, pk
FROM pragma_table_info('replace_with_discovered_table')
ORDER BY cid;

SELECT * FROM pragma_index_list('replace_with_discovered_table');
SELECT * FROM pragma_foreign_key_list('replace_with_discovered_table');
```

Do not assume a product schema version or graph generation. Discover the table
and columns first.

## Coherent snapshot

Keep related statements on one connection and inside one read transaction:

```bash
"$SQLITE_READER" --database "$KAST_DATABASE" <<'SQL'
BEGIN;
SELECT * FROM pragma_query_only;
SELECT * FROM pragma_database_list;
SELECT type, name
FROM sqlite_schema
WHERE name NOT LIKE 'sqlite_%'
ORDER BY type, name;
COMMIT;
SQL
```

For cache freshness experiments, read `PRAGMA main.data_version`, execute the
external workload, then read it again through the same still-open connection.
Do not compare values collected from separate SQLite processes.

## Query plans

```bash
"$SQLITE_READER" \
  --database "$KAST_DATABASE" \
  --query 'EXPLAIN QUERY PLAN SELECT ...;'
```

Report the exact query, bind-value shape, database generation, row counts,
indexes, and plan. A plan alone is not elapsed-time evidence.

## Kast-owned alternatives

Before raw SQL, inspect the live help for:

```bash
kast graph summary
"$KAST_CONTROL_BIN" developer inspect metrics --help
"$KAST_CONTROL_BIN" agent graph --help
```

Kast-owned graph and metrics commands validate schema and may apply repository
overlay semantics that a raw base-database query does not.
