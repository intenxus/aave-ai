# Risk Thresholds and Asset Parameters

## Risk Level Thresholds

The following table defines risk levels based on Health Factor values:

| Health Factor | Risk Level | Description | Recommended Action |
|---------------|------------|-------------|-------------------|
| > 2.0 | Safe | Position is well-collateralized | Normal operation |
| 1.5 - 2.0 | Moderate | Position is healthy but monitor | Continue monitoring |
| 1.2 - 1.5 | High | Position is at risk | Consider adding collateral or repaying debt |
| 1.0 - 1.2 | Critical | Position is near liquidation | Urgent: Add collateral or repay immediately |
| < 1.0 | Liquidation | Position can be liquidated | Position is being or will be liquidated |

### Risk Level Implementation

```typescript
function getRiskLevel(healthFactor: number): RiskLevel {
  if (healthFactor > 2.0) return 'safe';
  if (healthFactor >= 1.5) return 'moderate';
  if (healthFactor >= 1.2) return 'high';
  if (healthFactor >= 1.0) return 'critical';
  return 'liquidation';
}

type RiskLevel = 'safe' | 'moderate' | 'high' | 'critical' | 'liquidation';

const riskLevelMessages: Record<RiskLevel, string> = {
  safe: 'Your position is well-collateralized.',
  moderate: 'Your position is healthy, but continue monitoring.',
  high: 'Your position is at risk. Consider adding collateral or repaying debt.',
  critical: 'Warning: Your position is near liquidation! Add collateral or repay immediately.',
  liquidation: 'Your position is eligible for liquidation.'
};
```

## Asset-Specific Risk Parameters

### Ethereum Mainnet (Chain ID: 1)

| Asset | LTV | Liquidation Threshold | Liquidation Penalty | eMode Category | Isolation Mode |
|-------|-----|----------------------|---------------------|----------------|----------------|
| USDC | 77% | 80% | 5% | 1 (Stablecoins) | No |
| USDT | 75% | 80% | 5% | 1 (Stablecoins) | No |
| DAI | 77% | 80% | 5% | 1 (Stablecoins) | No |
| WETH | 80% | 82.5% | 5% | 2 (ETH Correlated) | No |
| WBTC | 73% | 78% | 7.5% | None | No |
| wstETH | 79% | 80% | 5% | 2 (ETH Correlated) | No |
| LINK | 56% | 61% | 7.5% | None | No |
| AAVE | 66% | 73% | 7.5% | None | No |

### Arbitrum (Chain ID: 42161)

| Asset | LTV | Liquidation Threshold | Liquidation Penalty | eMode Category | Isolation Mode |
|-------|-----|----------------------|---------------------|----------------|----------------|
| USDC | 80% | 85% | 5% | 1 (Stablecoins) | No |
| USDT | 75% | 80% | 5% | 1 (Stablecoins) | No |
| DAI | 75% | 80% | 5% | 1 (Stablecoins) | No |
| WETH | 80% | 82.5% | 5% | 2 (ETH Correlated) | No |
| WBTC | 73% | 78% | 7.5% | None | No |
| wstETH | 80% | 82.5% | 5% | 2 (ETH Correlated) | No |
| ARB | 50% | 60% | 7.5% | None | Yes |
| LINK | 56% | 61% | 7.5% | None | No |

### Parameter Definitions

| Parameter | Description | Calculation |
|-----------|-------------|-------------|
| **LTV (Loan-to-Value)** | Maximum borrowing power of the collateral | `MaxBorrow = CollateralValue × LTV` |
| **Liquidation Threshold** | Threshold at which a position becomes eligible for liquidation | `LiquidationPoint = CollateralValue × LiquidationThreshold` |
| **Liquidation Penalty** | Bonus percentage liquidators receive when liquidating a position | `Bonus = DebtToCover × LiquidationPenalty` |
| **eMode Category** | Efficiency mode category for correlated assets | Higher LTV/LT for assets in same category |
| **Isolation Mode** | Whether the asset can only be borrowed in isolation | Limits total debt ceiling for the asset |

## eMode (Efficiency Mode) Risk Considerations

### eMode Categories

| Category ID | Name | Description | Max LTV | Liquidation Threshold |
|-------------|------|-------------|---------|----------------------|
| 0 | None | Default - No eMode | Asset-specific | Asset-specific |
| 1 | Stablecoins | USD-pegged stablecoins | 97% | 97.5% |
| 2 | ETH Correlated | ETH and ETH-pegged assets | 93% | 95% |

### eMode Risk Implications

1. **Higher Leverage**: eMode allows higher LTV (up to 97% for stablecoins), increasing liquidation risk
2. **Correlated Asset Risk**: Assets in the same eMode category are treated as correlated
3. **Category Exit Risk**: Exiting an eMode category may immediately lower your effective LTV

### eMode Health Factor Calculation

When eMode is enabled, the effective liquidation threshold is calculated using eMode parameters:

```typescript
// With eMode enabled
const effectiveLT = Math.min(
  userEModeCategory.liquidationThreshold,
  weightedAverageLTAcrossCollateral
);

// Health Factor uses the higher effective LT
const healthFactor = (totalCollateralBase * effectiveLT / 10000) / totalDebtBase;
```

## Risk Metrics Interface

```typescript
interface RiskAssessment {
  // Core metrics
  healthFactor: string;           // Current health factor (e.g., "1.85")
  maxLTV: string;                 // Maximum LTV allowed (e.g., "0.80")
  currentLTV: string;             // Current LTV ratio (e.g., "0.45")
  liquidationThreshold: string;   // Liquidation threshold (e.g., "0.825")
  liquidationPenalty: string;     // Liquidation penalty (e.g., "0.05")

  // eMode status
  eModeStatus: boolean;           // Whether eMode is enabled
  eModeCategory?: number;         // eMode category ID if enabled

  // Risk classification
  riskLevel: 'safe' | 'moderate' | 'high' | 'critical' | 'liquidation';

  // Additional metrics
  totalCollateralUSD: string;     // Total collateral value in USD
  totalDebtUSD: string;           // Total debt value in USD
  availableBorrowsUSD: string;    // Available borrowing power in USD
}
```

## Liquidation Scenarios

### Scenario 1: Price Drop Triggering Liquidation

```
Initial State:
- Collateral: 10 WETH @ $2000 = $20,000
- Debt: 10,000 USDC
- WETH Liquidation Threshold: 82.5%
- Health Factor: ($20,000 × 0.825) / $10,000 = 1.65

Price Drop Scenario:
- WETH price drops to $1200
- Collateral value: $12,000
- Health Factor: ($12,000 × 0.825) / $10,000 = 0.99

Result: Position is now eligible for liquidation
```

### Scenario 2: Borrowing Up to Limit

```
Initial State:
- Collateral: 10 WETH @ $2000 = $20,000
- WETH LTV: 80%
- Max borrow: $20,000 × 0.80 = $16,000

User borrows $15,000 USDC:
- Current LTV: $15,000 / $20,000 = 75%
- Health Factor: ($20,000 × 0.825) / $15,000 = 1.10 (Critical)

Small price drop (-10%):
- WETH @ $1800, Collateral = $18,000
- Health Factor: ($18,000 × 0.825) / $15,000 = 0.99 (Liquidation)
```

## Risk Alerts and Recommendations

### Safe Zone (HF > 2.0)
- Continue normal operations
- Can consider increasing leverage if desired

### Moderate Zone (1.5 - 2.0)
- Monitor position regularly
- Set price alerts for significant market moves

### High Risk Zone (1.2 - 1.5)
- Consider adding collateral
- Consider repaying portion of debt
- Reduce exposure to volatile assets

### Critical Zone (1.0 - 1.2)
- **Immediate action recommended**
- Add collateral immediately
- Repay debt to increase HF
- Consider partial withdrawal from other positions

### Liquidation Zone (HF < 1.0)
- Position can be liquidated by anyone
- Liquidators will repay debt and seize collateral plus penalty
- User receives any remaining collateral after liquidation

## References

- [AAVE V3 Risk Parameters](https://docs.aave.com/risk/asset-risk/risk-parameters)
- [AAVE V3 Liquidations](https://docs.aave.com/developers/guides/liquidations)
- [AAVE V3 eMode](https://docs.aave.com/faq/aave-v3-features#emode)
- AAVE V3 Core: `/Users/caoxiangrui/Desktop/external/aave_skill/aave-v3-core/contracts/protocol/libraries/configuration/ReserveConfiguration.sol`
