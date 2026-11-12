---
type: Metric
title: Gross revenue
description: Summed order value over a time period, before refunds.
tags: [sales, revenue, finance]
timestamp: 2026-05-20T00:00:00Z
---

# Gross revenue

Total value of completed orders in a period, **before** refunds and adjustments.

## Definition

```sql
SELECT SUM(total_usd) AS gross_revenue
FROM `acme.sales.orders`
WHERE created_at BETWEEN @start AND @end
```

## Source

Computed from [orders](/tables/orders.md) (`total_usd`, `created_at`).

## Notes

For the net figure, subtract refunds during the
[revenue reconciliation](/playbooks/revenue-reconciliation.md) close. Revenue is recognized
per the finance team's policy.

# Citations

1. [Revenue recognition policy](/references/revenue-policy.md)
2. <https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions>
