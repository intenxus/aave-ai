#!/usr/bin/env ts-node
/**
 * AAVE V3 Borrow Quote Script
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

export interface BorrowQuote {
  token: string;
  tokenSymbol: string;
  apyVariable: string;
  apyStable?: string;
  stableBorrowEnabled: boolean;
  availableLiquidity: string;
  ltv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  borrowingEnabled: boolean;
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

export async function getBorrowQuote(tokenAddress: string, chainId: number): Promise<BorrowQuote> {
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

  const symbol = (await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'symbol',
  })) as string;

  const RAY = 10n ** 27n;
  const totalAToken = reserveData[2];
  const totalStableDebt = reserveData[3];
  const totalVariableDebt = reserveData[4];
  const totalDebt = totalStableDebt + totalVariableDebt;
  const availableLiquidity = totalAToken > totalDebt ? totalAToken - totalDebt : 0n;

  const variableApr = Number(reserveData[6]) / Number(RAY);
  const apyVariable = (Math.pow(1 + variableApr / 31536000, 31536000) - 1) * 100;

  let apyStable: string | undefined;
  if (Boolean(reserveConfig[7])) {
    const stableApr = Number(reserveData[7]) / Number(RAY);
    apyStable = ((Math.pow(1 + stableApr / 31536000, 31536000) - 1) * 100).toFixed(4);
  }

  return {
    token: tokenAddress,
    tokenSymbol: symbol,
    apyVariable: apyVariable.toFixed(4),
    apyStable,
    stableBorrowEnabled: Boolean(reserveConfig[7]),
    availableLiquidity: availableLiquidity.toString(),
    ltv: Number(reserveConfig[1]) / 100,
    liquidationThreshold: Number(reserveConfig[2]) / 100,
    liquidationBonus: Number(reserveConfig[3]) / 100,
    borrowingEnabled: Boolean(reserveConfig[6]),
    isActive: Boolean(reserveConfig[8]),
    isFrozen: Boolean(reserveConfig[9]),
    decimals: Number(reserveConfig[0]),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: ts-node scripts/quote-borrow.ts <tokenAddress> <chainId>');
    console.error('Example: ts-node scripts/quote-borrow.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 1');
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

  getBorrowQuote(tokenAddress, chainId)
    .then((quote) => {
      console.log(JSON.stringify(quote, null, 2));
    })
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
