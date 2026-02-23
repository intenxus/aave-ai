#!/usr/bin/env ts-node
/**
 * AAVE V3 Repay Quote Script
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

const DEBT_TOKEN_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export interface RepayQuote {
  token: string;
  tokenSymbol: string;
  currentDebtVariable: string;
  currentDebtStable: string;
  currentDebtTotal: string;
  interestRateMode: 1 | 2;
  stableBorrowRateEnabled: boolean;
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

export async function getRepayQuote(
  tokenAddress: string,
  userAddress: string,
  chainId: number,
  interestRateMode?: 1 | 2
): Promise<RepayQuote> {
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

  let stableDebt = 0n;
  if (reserveTokens[1] !== '0x0000000000000000000000000000000000000000') {
    stableDebt = (await publicClient.readContract({
      address: reserveTokens[1],
      abi: DEBT_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    })) as bigint;
  }

  let variableDebt = 0n;
  if (reserveTokens[2] !== '0x0000000000000000000000000000000000000000') {
    variableDebt = (await publicClient.readContract({
      address: reserveTokens[2],
      abi: DEBT_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    })) as bigint;
  }

  let finalMode: 1 | 2;
  if (interestRateMode !== undefined) {
    finalMode = interestRateMode;
  } else if (stableDebt > variableDebt) {
    finalMode = 1;
  } else {
    finalMode = 2;
  }

  return {
    token: tokenAddress,
    tokenSymbol: symbol,
    currentDebtVariable: variableDebt.toString(),
    currentDebtStable: stableDebt.toString(),
    currentDebtTotal: (variableDebt + stableDebt).toString(),
    interestRateMode: finalMode,
    stableBorrowRateEnabled: Boolean(reserveConfig[7]),
    decimals: Number(reserveConfig[0]),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: ts-node scripts/quote-repay.ts <tokenAddress> <userAddress> <chainId> [interestRateMode]');
    console.error('Example: ts-node scripts/quote-repay.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0x... 1 2');
    console.error('interestRateMode: 1=stable, 2=variable (default: 2)');
    process.exit(1);
  }

  const [tokenAddress, userAddress, chainIdStr, modeStr] = args;
  const chainId = parseInt(chainIdStr, 10);
  const mode = modeStr ? (parseInt(modeStr, 10) as 1 | 2) : undefined;

  if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
    console.error('Invalid token address format');
    process.exit(1);
  }

  if (!userAddress.startsWith('0x') || userAddress.length !== 42) {
    console.error('Invalid user address format');
    process.exit(1);
  }

  if (chainId !== 1 && chainId !== 42161) {
    console.error('Unsupported chainId. Use 1 (Ethereum) or 42161 (Arbitrum)');
    process.exit(1);
  }

  if (mode !== undefined && mode !== 1 && mode !== 2) {
    console.error('Invalid interestRateMode. Use 1 (stable) or 2 (variable)');
    process.exit(1);
  }

  getRepayQuote(tokenAddress, userAddress, chainId, mode)
    .then((quote) => {
      console.log(JSON.stringify(quote, null, 2));
    })
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
