#!/usr/bin/env ts-node
/**
 * AAVE V3 Supply Quote Script
 */

import { createPublicClient, http } from 'viem';
import { mainnet, arbitrum } from 'viem/chains';

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
  {
    name: 'getReserveTokensAddresses',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

export interface SupplyQuote {
  token: string;
  tokenSymbol: string;
  apy: string;
  aTokenAddress: string;
  usageRatio: string;
  availableLiquidity: string;
  isActive: boolean;
  isFrozen: boolean;
  decimals: number;
}

function getChainConfig(chainId: number) {
  switch (chainId) {
    case 1:
      return mainnet;
    case 42161:
      return arbitrum;
    default:
      throw new Error(`Unsupported chainId: ${chainId}. Supported: 1 (Ethereum), 42161 (Arbitrum)`);
  }
}

function getRpcUrl(chainId: number): string {
  const envVar = chainId === 1 ? 'ETHEREUM_RPC_URL' : 'ARBITRUM_RPC_URL';
  const defaultRpc = chainId === 1 ? 'https://ethereum.publicnode.com' : 'https://arbitrum.publicnode.com';
  return process.env[envVar] || defaultRpc;
}

export async function getSupplyQuote(tokenAddress: string, chainId: number): Promise<SupplyQuote> {
  const chain = getChainConfig(chainId);
  const publicClient = createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  });

  const providerAddress = POOL_ADDRESSES_PROVIDER[chainId];
  if (!providerAddress) {
    throw new Error(`No configuration for chainId: ${chainId}`);
  }

  const poolDataProviderAddress = (await publicClient.readContract({
    address: providerAddress,
    abi: PROVIDER_ABI,
    functionName: 'getPoolDataProvider',
  })) as `0x${string}`;

  const reserveData = (await publicClient.readContract({
    address: poolDataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: 'getReserveData',
    args: [tokenAddress as `0x${string}`],
  })) as readonly bigint[];

  const reserveConfig = (await publicClient.readContract({
    address: poolDataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: 'getReserveConfigurationData',
    args: [tokenAddress as `0x${string}`],
  })) as readonly (bigint | boolean)[];

  const reserveTokens = (await publicClient.readContract({
    address: poolDataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: 'getReserveTokensAddresses',
    args: [tokenAddress as `0x${string}`],
  })) as readonly `0x${string}`[];

  const symbol = (await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'symbol',
  })) as string;

  const RAY = 10n ** 27n;
  const liquidityRate = reserveData[5];
  const totalAToken = reserveData[2];
  const totalStableDebt = reserveData[3];
  const totalVariableDebt = reserveData[4];
  const totalDebt = totalStableDebt + totalVariableDebt;

  const apr = Number(liquidityRate) / Number(RAY);
  const apy = (Math.pow(1 + apr / 31536000, 31536000) - 1) * 100;

  const usageRatio = totalAToken > 0n ? (Number(totalDebt) / Number(totalAToken)) * 100 : 0;
  const availableLiquidity = totalAToken > totalDebt ? totalAToken - totalDebt : 0n;

  return {
    token: tokenAddress,
    tokenSymbol: symbol,
    apy: apy.toFixed(4),
    aTokenAddress: reserveTokens[0],
    usageRatio: usageRatio.toFixed(2),
    availableLiquidity: availableLiquidity.toString(),
    isActive: Boolean(reserveConfig[8]),
    isFrozen: Boolean(reserveConfig[9]),
    decimals: Number(reserveConfig[0]),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: ts-node scripts/quote-supply.ts <tokenAddress> <chainId>');
    console.error('Example: ts-node scripts/quote-supply.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 1');
    process.exit(1);
  }

  const [tokenAddress, chainIdStr] = args;
  const chainId = parseInt(chainIdStr, 10);

  if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
    console.error('Invalid token address format');
    process.exit(1);
  }

  if (chainId !== 1 && chainId !== 42161) {
    console.error('Unsupported chainId. Use 1 (Ethereum) or 42161 (Arbitrum)');
    process.exit(1);
  }

  getSupplyQuote(tokenAddress, chainId)
    .then((quote) => {
      console.log(JSON.stringify(quote, null, 2));
    })
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
