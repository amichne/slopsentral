---
type: BigQuery Dataset
title: Sales
description: Core e-commerce sales data — orders and customers.
resource: bigquery://acme/sales
tags: [sales]
timestamp: 2026-05-15T00:00:00Z
---

# Sales

The core sales dataset for the ACME storefront — one source of truth for every order and
customer.

## Tables

* [Orders](/tables/orders.md) - one row per completed order
* [Customers](/tables/customers.md) - one row per customer

Downstream, this dataset powers the [gross revenue](/metrics/gross-revenue.md) metric.
