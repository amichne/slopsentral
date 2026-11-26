---
type: BigQuery Table
title: Customers
description: One row per customer account.
resource: bigquery://acme/sales/customers
tags: [sales, customers]
timestamp: 2026-05-15T00:00:00Z
---

# Customers

One row per customer account. Part of the [sales dataset](/datasets/sales.md).

## Schema

| Column        | Type      | Description                       |
|---------------|-----------|-----------------------------------|
| `customer_id` | STRING    | Unique customer identifier.       |
| `email`       | STRING    | Contact email (hashed at rest).   |
| `country`     | STRING    | ISO 3166-1 alpha-2 country code.  |
| `created_at`  | TIMESTAMP | When the account was created.     |

Referenced by [orders](/tables/orders.md) via `customer_id`.
