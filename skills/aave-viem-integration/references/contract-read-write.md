# Contract Read/Write Pattern

1. Validate chain/token/account inputs.
2. Read preconditions (`balanceOf`, `allowance`, reserve flags, user account data).
3. Simulate or estimate gas before writes.
4. Send transaction with explicit account and chain.
5. Wait for receipt and return normalized JSON result.

Recommended return fields:
- `ok`
- `action`
- `chainId`
- `token`
- `amount`
- `txHash`
- `receipt`
- `warnings`
- `error`
