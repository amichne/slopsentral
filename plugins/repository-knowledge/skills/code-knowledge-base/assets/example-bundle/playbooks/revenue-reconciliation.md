---
type: Playbook
title: Revenue reconciliation
description: Month-end steps to reconcile gross revenue against the finance ledger.
tags: [finance, close, playbook]
timestamp: 2026-05-15T00:00:00Z
---

# Revenue reconciliation

Month-end close procedure to reconcile reported revenue against the finance ledger.

## Steps

1. Freeze new writes to [orders](/tables/orders.md) for the period.
2. Compute [gross revenue](/metrics/gross-revenue.md) for the month.
3. Subtract refunds and chargebacks to get net revenue.
4. Compare net revenue against the finance ledger; investigate any delta over $100.
5. Sign off and unfreeze writes.

## Related

* [Orders](/tables/orders.md)
* [Customers](/tables/customers.md)
* [Gross revenue](/metrics/gross-revenue.md)
