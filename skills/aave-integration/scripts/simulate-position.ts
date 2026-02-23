#!/usr/bin/env ts-node
/**
 * AAVE V3 Position Simulator
 *
 * Simulates how supply/borrow/withdraw/repay actions would affect
 * a user's position (Health Factor, LTV, available borrows).
 *
 * Usage:
 *   ts-node simulate-position.ts <chainId> <userAddress> <action> <token> <amount>
 *
 * Examples:
 *   ts-node simulate-position.ts 1 0x... borrow USDC 1000
 *   ts-node simulate-position.ts 42161 0x... supply WETH 2.5
 *   ts-node simulate-position.ts 1 0x... repay DAI 500
 *   ts-node simulate-position.ts 42161 0x... withdraw USDC 100
 */

import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { mainnet, arbitrum } from 'viem/chains';

const POOL_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
};

const TOKENS: Record<number, Record<string, { address: `0x${string}`; decimals: number }>> = {
  1: {
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
    DAI: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  },
  42161: {
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
    WBTC: { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', decimals: 8 },
    DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
  },
};

const poolAbi = parseAbi([
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
]);

function getRpcUrl(chainId: number): string {
  const envVar = chainId === 1 ? 'ETHEREUM_RPC_URL' : 'ARBITRUM_RPC_URL';
  const defaultRpc =
    chainId === 1
      ? 'https://ethereum.publicnode.com'
      : 'https://arbitrum.publicnode.com';
  return process.env[envVar] || defaultRpc;
}

interface PositionData {
  totalCollateralUSD: number;
  totalDebtUSD: number;
  availableBorrowsUSD: number;
  liquidationThreshold: number;
  ltv: number;
  healthFactor: number;
}

interface SimulationResult {
  current: PositionData;
  simulated: PositionData;
  changes: {
    collateralChangeUSD: number;
    debtChangeUSD: number;
    healthFactorChange: number;
    availableBorrowsChangeUSD: number;
  };
  riskLevel: {
    before: string;
    after: string;
  };
}

function getRiskLevel(healthFactor: number): string {
  if (healthFactor > 2.0) return 'safe';
  if (healthFactor >= 1.5) return 'moderate';
  if (healthFactor >= 1.2) return 'high';
  if (healthFactor >= 1.0) return 'critical';
  return 'liquidation';
}

function getRiskEmoji(riskLevel: string): string {
  const emojis: Record<string, string> = {
    safe: '✅',
    moderate: 'ℹ️',
    high: '⚠️',
    critical: '🚨',
    liquidation: '❌',
  };
  return emojis[riskLevel] || '❓';
}

async function fetchAssetPrices(chainId: number): Promise<Record<string, number>> {
  // Fallback prices for simulation
  // In production, these should be fetched from a price oracle
  const fallbackPrices: Record<string, number> = {
    USDC: 1.0,
    USDT: 1.0,
    DAI: 1.0,
    WETH: 2000.0,
    WBTC: 40000.0,
  };

  const tokens = TOKENS[chainId];
  const prices: Record<string, number> = {};

  for (const [symbol] of Object.entries(tokens)) {
    prices[symbol] = fallbackPrices[symbol] || 1.0;
  }

  return prices;
}

async function getCurrentPosition(
  userAddress: `0x${string}`,
  chainId: number
): Promise<PositionData> {
  const client = createPublicClient({
    chain: chainId === 1 ? mainnet : arbitrum,
    transport: http(getRpcUrl(chainId)),
  });

  const data = await client.readContract({
    address: POOL_ADDRESSES[chainId],
    abi: poolAbi,
    functionName: 'getUserAccountData',
    args: [userAddress],
  });

  return {
    totalCollateralUSD: Number(data[0]) / 1e8,
    totalDebtUSD: Number(data[1]) / 1e8,
    availableBorrowsUSD: Number(data[2]) / 1e8,
    liquidationThreshold: Number(data[3]) / 10000,
    ltv: Number(data[4]) / 10000,
    healthFactor: data[1] > 0n ? Number(data[5]) / 1e18 : 999,
  };
}

function simulateAction(
  current: PositionData,
  action: string,
  token: string,
  amount: number,
  prices: Record<string, number>
): PositionData {
  const tokenPrice = prices[token] || 1.0;
  const amountUSD = amount * tokenPrice;

  let newCollateral = current.totalCollateralUSD;
  let newDebt = current.totalDebtUSD;
  let newLtv = current.ltv;
  let newLiquidationThreshold = current.liquidationThreshold;

  switch (action) {
    case 'supply':
      newCollateral += amountUSD;
      break;
    case 'withdraw':
      newCollateral = Math.max(0, newCollateral - amountUSD);
      break;
    case 'borrow':
      newDebt += amountUSD;
      break;
    case 'repay':
      newDebt = Math.max(0, newDebt - amountUSD);
      break;
  }

  // Recalculate LTV and Health Factor
  const newAvailableBorrows = newCollateral * newLtv - newDebt;

  // Health Factor = (Collateral * LiquidationThreshold) / Debt
  const newHealthFactor =
    newDebt > 0
      ? (newCollateral * newLiquidationThreshold) / newDebt
      : Infinity;

  return {
    totalCollateralUSD: newCollateral,
    totalDebtUSD: newDebt,
    availableBorrowsUSD: Math.max(0, newAvailableBorrows),
    liquidationThreshold: newLiquidationThreshold,
    ltv: newLtv,
    healthFactor: newHealthFactor > 999 ? 999 : newHealthFactor,
  };
}

export async function simulate(
  chainId: number,
  userAddress: `0x${string}`,
  action: string,
  token: string,
  amount: number
): Promise<SimulationResult> {
  const [current, prices] = await Promise.all([
    getCurrentPosition(userAddress, chainId),
    fetchAssetPrices(chainId),
  ]);

  const simulated = simulateAction(current, action, token, amount, prices);

  return {
    current,
    simulated,
    changes: {
      collateralChangeUSD: simulated.totalCollateralUSD - current.totalCollateralUSD,
      debtChangeUSD: simulated.totalDebtUSD - current.totalDebtUSD,
      healthFactorChange: simulated.healthFactor - current.healthFactor,
      availableBorrowsChangeUSD: simulated.availableBorrowsUSD - current.availableBorrowsUSD,
    },
    riskLevel: {
      before: getRiskLevel(current.healthFactor),
      after: getRiskLevel(simulated.healthFactor),
    },
  };
}

async function main() {
  const [chainIdStr, userAddress, action, token, amountStr] = process.argv.slice(2);
  const chainId = parseInt(chainIdStr, 10);
  const amount = parseFloat(amountStr);

  // Validation
  if (!chainId || ![1, 42161].includes(chainId)) {
    console.error('Error: chainId must be 1 (Ethereum) or 42161 (Arbitrum)');
    process.exit(1);
  }

  if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    console.error('Error: Invalid user address');
    process.exit(1);
  }

  if (!['supply', 'borrow', 'repay', 'withdraw'].includes(action)) {
    console.error('Error: action must be supply, borrow, repay, or withdraw');
    process.exit(1);
  }

  if (!TOKENS[chainId][token]) {
    console.error(`Error: ${token} not supported on chain ${chainId}`);
    process.exit(1);
  }

  if (isNaN(amount) || amount <= 0) {
    console.error('Error: amount must be a positive number');
    process.exit(1);
  }

  try {
    const result = await simulate(chainId, userAddress as `0x${string}`, action, token, amount);

    console.log('\n=== AAVE Position Simulation ===\n');

    console.log(`Action: ${action.toUpperCase()} ${amount} ${token}`);
    console.log(`Chain: ${chainId === 1 ? 'Ethereum' : 'Arbitrum'}`);
    console.log(`User: ${userAddress}\n`);

    console.log('Current Position:');
    console.log(`  Collateral: $${result.current.totalCollateralUSD.toFixed(2)}`);
    console.log(`  Debt: $${result.current.totalDebtUSD.toFixed(2)}`);
    console.log(`  Health Factor: ${result.current.healthFactor.toFixed(2)} ${getRiskEmoji(result.riskLevel.before)}`);
    console.log(`  Available to Borrow: $${result.current.availableBorrowsUSD.toFixed(2)}`);
    console.log(`  Risk Level: ${result.riskLevel.before.toUpperCase()}\n`);

    console.log('After Simulation:');
    console.log(`  Collateral: $${result.simulated.totalCollateralUSD.toFixed(2)} (${result.changes.collateralChangeUSD >= 0 ? '+' : ''}${result.changes.collateralChangeUSD.toFixed(2)})`);
    console.log(`  Debt: $${result.simulated.totalDebtUSD.toFixed(2)} (${result.changes.debtChangeUSD >= 0 ? '+' : ''}${result.changes.debtChangeUSD.toFixed(2)})`);
    console.log(`  Health Factor: ${result.simulated.healthFactor.toFixed(2)} ${getRiskEmoji(result.riskLevel.after)} (${result.changes.healthFactorChange >= 0 ? '+' : ''}${result.changes.healthFactorChange.toFixed(2)})`);
    console.log(`  Available to Borrow: $${result.simulated.availableBorrowsUSD.toFixed(2)} (${result.changes.availableBorrowsChangeUSD >= 0 ? '+' : ''}${result.changes.availableBorrowsChangeUSD.toFixed(2)})`);
    console.log(`  Risk Level: ${result.riskLevel.after.toUpperCase()}\n`);

    // Risk warnings
    if (result.riskLevel.after === 'critical' || result.riskLevel.after === 'liquidation') {
      console.log('🚨 WARNING: This action would put your position at CRITICAL RISK of liquidation!');
    } else if (result.riskLevel.after === 'high') {
      console.log('⚠️ CAUTION: This action would increase your risk level to HIGH.');
    }

    // Output JSON for programmatic use
    console.log('\n=== JSON Output ===');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Simulation error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
