#!/usr/bin/env ts-node
/**
 * AAVE V3 APY Quote Script
 */

import { createPublicClient, http } from 'viem';
import { mainnet, arbitrum } from 'viem/chains';

const TOKENS: Record<number, Record<string, `0x${string}`>> = {
  1: {
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  },
  42161: {
    USDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    WBTC: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    DAI: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
  },
};

const POOL_ADDRESSES_PROVIDER: Record<number, `0x${string}`> = {
  1: '0x2f39d218133afab8f2b819b1066c7e434ad94e9e',
  42161: '0xa97684ead0e402dc232d5a977953df7ecbab3cdb',
};

const PROVIDER_ABI = [
  {
    name: 'getPoolDataProvider',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'getPriceOracle',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

const DATA_PROVIDER_ABI = [
  {
    name: 'getReserveData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint40' },
    ],
  },
  {
    name: 'getReserveConfigurationData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bool' },
      { type: 'bool' },
      { type: 'bool' },
      { type: 'bool' },
      { type: 'bool' },
    ],
  },
] as const;

const ORACLE_ABI = [
  {
    name: 'getAssetPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

interface ApyData {
  supplyApy: number;
  variableBorrowApy: number;
  stableBorrowApy: number;
  stableBorrowEnabled: boolean;
  utilization: number;
  availableLiquidityUSD: number;
  totalDebtUSD: number;
}

const RAY = BigInt(10) ** BigInt(27);

function rayToPercent(ray: bigint): number {
  return Number((ray * BigInt(10000)) / RAY) / 100;
}

function getRpcUrl(chainId: number): string {
  const envVar = chainId === 1 ? 'ETHEREUM_RPC_URL' : 'ARBITRUM_RPC_URL';
  const defaultRpc = chainId === 1 ? 'https://ethereum.publicnode.com' : 'https://arbitrum.publicnode.com';
  return process.env[envVar] || defaultRpc;
}

export async function getApyData(chainId: number): Promise<Record<string, ApyData>> {
  const tokens = TOKENS[chainId];
  const results: Record<string, ApyData> = {};

  const client = createPublicClient({
    chain: chainId === 1 ? mainnet : arbitrum,
    transport: http(getRpcUrl(chainId)),
  });

  const providerAddress = POOL_ADDRESSES_PROVIDER[chainId];
  if (!providerAddress || !tokens) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }

  const [poolDataProviderAddress, oracleAddress] = (await Promise.all([
    client.readContract({
      address: providerAddress,
      abi: PROVIDER_ABI,
      functionName: 'getPoolDataProvider',
    }),
    client.readContract({
      address: providerAddress,
      abi: PROVIDER_ABI,
      functionName: 'getPriceOracle',
    }),
  ])) as [`0x${string}`, `0x${string}`];

  for (const [symbol, address] of Object.entries(tokens)) {
    const [reserveData, reserveConfig, priceRaw] = (await Promise.all([
      client.readContract({
        address: poolDataProviderAddress,
        abi: DATA_PROVIDER_ABI,
        functionName: 'getReserveData',
        args: [address],
      }),
      client.readContract({
        address: poolDataProviderAddress,
        abi: DATA_PROVIDER_ABI,
        functionName: 'getReserveConfigurationData',
        args: [address],
      }),
      client.readContract({
        address: oracleAddress,
        abi: ORACLE_ABI,
        functionName: 'getAssetPrice',
        args: [address],
      }),
    ])) as [readonly bigint[], readonly (bigint | boolean)[], bigint];

    const decimals = Number(reserveConfig[0]);
    const price = Number(priceRaw) / 1e8;

    const totalAToken = reserveData[2];
    const totalStableDebt = reserveData[3];
    const totalVariableDebt = reserveData[4];
    const totalDebt = totalStableDebt + totalVariableDebt;
    const availableLiquidity = totalAToken > totalDebt ? totalAToken - totalDebt : 0n;

    const availableLiquidityUSD = Number(availableLiquidity) * price / (10 ** decimals);
    const totalDebtUSD = Number(totalDebt) * price / (10 ** decimals);
    const totalLiquidity = availableLiquidityUSD + totalDebtUSD;
    const utilization = totalLiquidity > 0 ? (totalDebtUSD / totalLiquidity) * 100 : 0;

    results[symbol] = {
      supplyApy: rayToPercent(reserveData[5]),
      variableBorrowApy: rayToPercent(reserveData[6]),
      stableBorrowApy: rayToPercent(reserveData[7]),
      stableBorrowEnabled: Boolean(reserveConfig[7]),
      utilization: Math.round(utilization * 100) / 100,
      availableLiquidityUSD: Math.round(availableLiquidityUSD * 100) / 100,
      totalDebtUSD: Math.round(totalDebtUSD * 100) / 100,
    };
  }

  return results;
}

async function main() {
  const chainId = parseInt(process.argv[2], 10);

  if (!chainId || ![1, 42161].includes(chainId)) {
    console.error('Usage: ts-node quote-apy.ts <chainId>');
    console.error('Supported chains: 1 (Ethereum), 42161 (Arbitrum)');
    process.exit(1);
  }

  const apyData = await getApyData(chainId);
  console.log(JSON.stringify(apyData, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
