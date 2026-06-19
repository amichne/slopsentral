---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: bigquery://acme/sales/orders
tags: [sales, orders]
timestamp: 2026-05-28T00:00:00Z
---

# Orders

One row per completed order. Part of the [sales dataset](/datasets/sales.md).

## Schema

| Column        | Type      | Description                              |
|---------------|-----------|------------------------------------------|
| `order_id`    | STRING    | Unique order identifier.                 |
| `customer_id` | STRING    | FK to [customers](/tables/customers.md). |
| `total_usd`   | NUMERIC   | Order total in USD.                      |
| `refund_usd`  | NUMERIC   | Refunded amount in USD, if any.          |
| `created_at`  | TIMESTAMP | When the order was placed.               |

Feeds the [gross revenue](/metrics/gross-revenue.md) metric.
