# Clients and Transports

- Use `PublicClient` for reads (balances, reserve config, account data).
- Use `WalletClient` for writes (approve/supply/borrow/repay/withdraw).
- Prefer RPC env vars:
  - `ETHEREUM_RPC_URL`
  - `ARBITRUM_RPC_URL`
- Fallback RPC endpoints:
  - `https://ethereum.publicnode.com`
  - `https://arbitrum.publicnode.com`
