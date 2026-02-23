# AAVE V3 Token Address Book

## Overview
This document contains the token addresses and AAVE V3 reserve configurations for supported assets.

## Ethereum Mainnet (chainId: 1)

| Symbol | Address | Decimals | aToken Address | stableBorrowEnabled |
|--------|---------|----------|----------------|---------------------|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` | false |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 | `0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a` | false |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 | `0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8` | false |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | 8 | `0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8` | false |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 | `0x018008bfb33d285247A21d44E50697654f754e63` | true |

## Arbitrum (chainId: 42161)

| Symbol | Address | Decimals | aToken Address | stableBorrowEnabled |
|--------|---------|----------|----------------|---------------------|
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 | `0x724dc807b04555b71ed48a6896b6F41593b8C637` | false |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 | `0x6ab707Aca953eDAeFBc4fD23bA73294241490620` | false |
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | 18 | `0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8` | false |
| WBTC | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` | 8 | `0x078f358208685046a11C85e8ad32895DED33A249` | false |
| DAI | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | 18 | `0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE` | true |

## Token Details

### USDC (USD Coin)
- **Type**: Stablecoin
- **Ethereum**: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- **Arbitrum**: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
- **Note**: Native USDC on Arbitrum (not bridged)

### USDT (Tether)
- **Type**: Stablecoin
- **Ethereum**: 0xdAC17F958D2ee523a2206206994597C13D831ec7
- **Arbitrum**: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
- **stableBorrowEnabled**: false on both chains

### WETH (Wrapped Ether)
- **Type**: Wrapped Native Token
- **Ethereum**: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- **Arbitrum**: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
- **Note**: Used for ETH-denominated operations

### WBTC (Wrapped Bitcoin)
- **Type**: Wrapped Bitcoin
- **Ethereum**: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
- **Arbitrum**: 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f
- **Decimals**: 8

### DAI (Dai Stablecoin)
- **Type**: Decentralized Stablecoin
- **Ethereum**: 0x6B175474E89094C44Da98b954EedeAC495271d0F
- **Arbitrum**: 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1
- **stableBorrowEnabled**: true on both chains (only asset with stable borrow enabled)

## Important Notes

### stableBorrowEnabled
- Only **DAI** has `stableBorrowEnabled = true` on both chains
- USDC, USDT, WETH, and WBTC have `stableBorrowEnabled = false`
- When users request stable rate borrowing for non-supported assets, the system should:
  1. Automatically downgrade to variable rate (mode 2)
  2. Provide a clear message explaining the downgrade

### Interest Rate Mode Reference
- `1` = Stable rate (only available for DAI)
- `2` = Variable rate (default, available for all assets)

## Whitelist Policy

### First Batch (Current)
The following assets are supported in the first batch:
- USDC, USDT, WETH, WBTC, DAI

### Non-Whitelisted Assets
- **Read operations**: Allowed for market research and exploration
- **Write operations**: Not allowed in first version
- **Error message**: "⚠️ **Asset ${token} is not in the supported whitelist**. Only whitelisted assets are supported. Contact the team to extend the whitelist if needed."

## Extension Mechanism
New assets can be added via configuration PR:
1. Verify token contract on Etherscan/Arbiscan
2. Confirm aToken address from AAVE UI or official sources
3. Test stableBorrowEnabled flag
4. Submit PR with updated address book

## Verification Sources
- AAVE V3 Ethereum Market: https://app.aave.com/market/?marketName=proto_mainnet_v3
- AAVE V3 Arbitrum Market: https://app.aave.com/market/?marketName=proto_arbitrum_v3
- AAVE Documentation: https://docs.aave.com/developers/deployed-contracts/v3-mainnet
