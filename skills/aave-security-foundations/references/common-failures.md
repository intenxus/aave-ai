# Common Failures and Handling

## Allowance Insufficient

- Symptom: supply/repay reverts.
- Handling: run `execute-approve` first, then retry.

## Health Factor Too Low

- Symptom: withdraw path blocked by guard.
- Handling: repay debt or add collateral before withdrawing.

## Borrow Capacity Exhausted

- Symptom: borrow execution rejected pre-flight.
- Handling: reduce borrow amount or add collateral.

## RPC Timeout / Upstream Errors

- Symptom: read/estimate failures.
- Handling: retry with backoff; switch to reliable RPC endpoint.
