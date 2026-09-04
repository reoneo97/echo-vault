# SQL Indexes

An index is a data structure that improves the speed of data retrieval at the cost of additional storage and slower writes.

## B-Tree Index (default)

Most databases use a B-tree (balanced tree) by default. Supports:
- Equality: `WHERE id = 5`
- Range: `WHERE created_at > '2024-01-01'`
- Prefix matching: `WHERE name LIKE 'John%'`
- Sorting: `ORDER BY` can use the index to avoid a sort step

Not useful for: `WHERE name LIKE '%John'` (leading wildcard) or `WHERE lower(name) = 'john'` (function on column).

## Hash Index

Supports only equality lookups (`=`). Faster than B-tree for exact matches but cannot handle ranges or sorting. PostgreSQL supports hash indexes; MySQL uses them for MEMORY tables.

## Composite Indexes

An index on multiple columns `(a, b, c)` can be used for:
- Queries filtering on `a`
- Queries filtering on `a, b`
- Queries filtering on `a, b, c`

But **not** for queries filtering only on `b` or `c` — the leftmost prefix rule. Column order matters.

## Covering Index

A covering index includes all columns needed by a query, so the database can satisfy the query entirely from the index without reading the main table (heap). This is called an **index-only scan**.

## When Not to Index

- Small tables (full scan is faster)
- Columns with very low cardinality (e.g. boolean flags) — the index is rarely selective enough to help
- Tables with very high write volume — every write must also update all indexes

## Explain Plans

Use `EXPLAIN ANALYZE` (PostgreSQL) or `EXPLAIN` (MySQL) to see whether a query is using an index and what the estimated vs actual row counts are.
