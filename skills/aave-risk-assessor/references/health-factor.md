# Health Factor Calculation

## Overview

Health Factor (HF) is a numeric representation of the safety of a user's AAVE position. It indicates how close a user is to being liquidated. A Health Factor above 1 means the position is safe; below 1 means the position can be liquidated.

## Formula

```
HF = (Σ Collateral_i × LiquidationThreshold_i) / TotalDebt
```

Where:
- **Collateral_i**: The value of collateral asset `i` in the base currency (USD)
- **LiquidationThreshold_i**: The liquidation threshold for asset `i` (expressed as a percentage)
- **TotalDebt**: The total debt value in the base currency (USD)

## Detailed Calculation Steps

### Step 1: Calculate Weighted Collateral Value

For each collateral asset the user has supplied:

1. Get the user's aToken balance for the asset
2. Get the current asset price from the AAVE Oracle
3. Calculate collateral value: `CollateralValue = aTokenBalance × AssetPrice`
4. Get the asset's liquidation threshold from reserve configuration
5. Calculate weighted collateral: `WeightedCollateral = CollateralValue × LiquidationThreshold`

### Step 2: Calculate Total Debt

For each borrowed asset:

1. Get the user's stable debt token balance (if any)
2. Get the user's variable debt token balance (if any)
3. Get the current asset price from the AAVE Oracle
4. Calculate debt value: `DebtValue = (StableDebt + VariableDebt) × AssetPrice`
5. Sum all debt values across assets

### Step 3: Compute Health Factor

```
HealthFactor = TotalWeightedCollateral / TotalDebt
```

If `TotalDebt == 0`, Health Factor is considered infinite (or a very large number like `type(uint256).max`).

## Contract Method

### Pool.getUserAccountData()

The easiest way to get the Health Factor is to call the Pool contract directly:

```solidity
function getUserAccountData(address user)
    external
    view
    returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    );
```

**Return Values:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `totalCollateralBase` | uint256 | Total collateral of the user in the base currency (USD) |
| `totalDebtBase` | uint256 | Total debt of the user in the base currency (USD) |
| `availableBorrowsBase` | uint256 | Borrowing power left in the base currency |
| `currentLiquidationThreshold` | uint256 | Weighted average liquidation threshold across all collateral |
| `ltv` | uint256 | Weighted average loan-to-value ratio |
| `healthFactor` | uint256 | Current health factor (scaled by 1e18) |

**Contract Addresses:**
- Ethereum: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
- Arbitrum: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`

## Code Examples

### TypeScript/Viem Example

```typescript
import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet, arbitrum } from 'viem/chains';

const POOL_ADDRESSES = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',    // Ethereum
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'  // Arbitrum
};

const poolAbi = parseAbi([
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
]);

async function getHealthFactor(
  userAddress: string,
  chainId: 1 | 42161
) {
  const client = createPublicClient({
    chain: chainId === 1 ? mainnet : arbitrum,
    transport: http()
  });

  const result = await client.readContract({
    address: POOL_ADDRESSES[chainId],
    abi: poolAbi,
    functionName: 'getUserAccountData',
    args: [userAddress as `0x${string}`]
  });

  // Health factor is returned scaled by 1e18
  const healthFactor = Number(result.healthFactor) / 1e18;
  const totalCollateralUSD = Number(result.totalCollateralBase) / 1e8;
  const totalDebtUSD = Number(result.totalDebtBase) / 1e8;

  return {
    healthFactor,
    totalCollateralUSD,
    totalDebtUSD,
    availableBorrowsUSD: Number(result.availableBorrowsBase) / 1e8,
    currentLiquidationThreshold: Number(result.currentLiquidationThreshold) / 10000, // basis points to percentage
    ltv: Number(result.ltv) / 10000
  };
}

// Usage
const userData = await getHealthFactor('0x...', 1);
console.log(`Health Factor: ${userData.healthFactor}`);
console.log(`Total Collateral: $${userData.totalCollateralUSD}`);
console.log(`Total Debt: $${userData.totalDebtUSD}`);
```

### Python/Web3 Example

```python
from web3 import Web3

POOL_ADDRESSES = {
    1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',    # Ethereum
    42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'  # Arbitrum
}

POOL_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getUserAccountData",
        "outputs": [
            {"internalType": "uint256", "name": "totalCollateralBase", "type": "uint256"},
            {"internalType": "uint256", "name": "totalDebtBase", "type": "uint256"},
            {"internalType": "uint256", "name": "availableBorrowsBase", "type": "uint256"},
            {"internalType": "uint256", "name": "currentLiquidationThreshold", "type": "uint256"},
            {"internalType": "uint256", "name": "ltv", "type": "uint256"},
            {"internalType": "uint256", "name": "healthFactor", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

def get_health_factor(user_address: str, chain_id: int, rpc_url: str):
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    pool = w3.eth.contract(
        address=POOL_ADDRESSES[chain_id],
        abi=POOL_ABI
    )

    result = pool.functions.getUserAccountData(user_address).call()

    return {
        'health_factor': result[5] / 1e18,
        'total_collateral_usd': result[0] / 1e8,
        'total_debt_usd': result[1] / 1e8,
        'available_borrows_usd': result[2] / 1e8,
        'liquidation_threshold': result[3] / 10000,
        'ltv': result[4] / 10000
    }

# Usage
data = get_health_factor('0x...', 1, 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY')
print(f"Health Factor: {data['health_factor']}")
```

### Cast (Foundry) CLI Example

```bash
# Ethereum Mainnet
cast call 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 \
  "getUserAccountData(address)(uint256,uint256,uint256,uint256,uint256,uint256)" \
  0xUSER_ADDRESS \
  --rpc-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Arbitrum
cast call 0x794a61358D6845594F94dc1DB02A252b5b4814aD \
  "getUserAccountData(address)(uint256,uint256,uint256,uint256,uint256,uint256)" \
  0xUSER_ADDRESS \
  --rpc-url https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
```

## Manual Calculation (Advanced)

If you need to calculate Health Factor manually (e.g., for simulation purposes):

```typescript
async function calculateHealthFactorManually(
  userAddress: string,
  poolAddress: string,
  uiPoolDataProviderAddress: string
) {
  // 1. Get all reserves
  const reserves = await getReservesData(uiPoolDataProviderAddress);

  let totalWeightedCollateral = 0;
  let totalDebt = 0;

  for (const reserve of reserves) {
    // 2. Get user's reserve data
    const userReserve = await getUserReserveData(poolAddress, reserve.underlyingAsset, userAddress);

    // 3. Calculate collateral contribution
    if (userReserve.scaledATokenBalance > 0) {
      const collateralValue = userReserve.scaledATokenBalance * reserve.price;
      const weightedCollateral = collateralValue * (reserve.liquidationThreshold / 10000);
      totalWeightedCollateral += weightedCollateral;
    }

    // 4. Calculate debt contribution
    const stableDebt = userReserve.stableBorrowBalance;
    const variableDebt = userReserve.scaledVariableDebt;
    const totalAssetDebt = (stableDebt + variableDebt) * reserve.price;
    totalDebt += totalAssetDebt;
  }

  // 5. Calculate HF
  const healthFactor = totalDebt > 0 ? totalWeightedCollateral / totalDebt : Infinity;

  return {
    healthFactor,
    totalWeightedCollateral,
    totalDebt
  };
}
```

## Important Notes

1. **Scaling Factor**: Health Factor is returned scaled by `1e18`. Divide by `1e18` to get the human-readable value.

2. **Base Currency**: `totalCollateralBase`, `totalDebtBase`, and `availableBorrowsBase` are denominated in the base currency (USD) with 8 decimal places.

3. **LTV vs Liquidation Threshold**:
   - **LTV (Loan-to-Value)**: Determines how much you can borrow against your collateral
   - **Liquidation Threshold**: The threshold at which your position becomes eligible for liquidation

4. **eMode Impact**: When a user enables eMode (Efficiency Mode), the effective LTV and liquidation threshold may be higher for correlated assets.

5. **Precision Loss**: Due to integer arithmetic in Solidity, there may be small rounding differences between manual calculations and contract-returned values.

## References

- [AAVE V3 Documentation - Liquidations](https://docs.aave.com/developers/guides/liquidations)
- [AAVE V3 Documentation - User Account Data](https://docs.aave.com/developers/core-contracts/pool#getuseraccountdata)
- AAVE V3 Core Contracts: `/Users/caoxiangrui/Desktop/external/aave_skill/aave-v3-core/contracts/interfaces/IPool.sol`
