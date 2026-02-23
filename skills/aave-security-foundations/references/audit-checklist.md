# AAVE Script Audit Checklist

- Inputs are sanitized and validated before RPC/contract calls.
- Unsupported chain IDs are blocked.
- Token symbols resolve to chain-local address books.
- Amount parsing uses token decimals and rejects invalid precision.
- Borrow/withdraw paths include health-factor guardrails.
- Approvals are explicit (no hidden auto-approve in same call path).
- Execution outputs are normalized and machine-readable.
- Errors expose enough context for operators to remediate.
