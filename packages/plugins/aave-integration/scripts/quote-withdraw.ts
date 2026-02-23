#!/usr/bin/env ts-node
/**
 * AAVE V3 Withdraw Quote Script
 */

import { createPublicClient, http } from 'viem';
import { mainnet, arbitrum } from 'viem/chains';

const POOL_ADDRESSES_PROVIDER: Record<number, `0x${string}`> = {
  1: '0x2f39d218133afab8f2b819b1066c7e434ad94e9e',
  42161: '0xa97684ead0e402dc232d5a977953df7ecbab3cdb',
};

const POOL_PROXY: Record<number, `0x${string}`> = {
  1: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
  42161: '0x794a61358d6845594f94dc1db02a252b5b4814ad',
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
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const POOL_ABI = [
  {
    name: 'getUserAccountData',
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
    ],
  },
] as const;

export interface WithdrawQuote {
  token: string;
  tokenSymbol: string;
  currentSupplied: string;
  maxWithdrawable: string;
  availableLiquidity: string;
  usageAsCollateralEnabled: boolean;
  isCollateral: boolean;
  healthFactor: string;
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

export async function getWithdrawQuote(
  tokenAddress: string,
  userAddress: string,
  chainId: number
): Promise<WithdrawQuote> {
  const chain = getChainConfig(chainId);
  const publicClient = createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  });

  const providerAddress = POOL_ADDRESSES_PROVIDER[chainId];
  const poolProxy = POOL_PROXY[chainId];
  if (!providerAddress || !poolProxy) {
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

  const aTokenBalance = (await publicClient.readContract({
    address: reserveTokens[0],
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress as `0x${string}`],
  })) as bigint;

  const accountData = (await publicClient.readContract({
    address: poolProxy,
    abi: POOL_ABI,
    functionName: 'getUserAccountData',
    args: [userAddress as `0x${string}`],
  })) as readonly bigint[];

  const totalDebtBase = accountData[1];
  const healthFactor = totalDebtBase > 0n ? Number(accountData[5]) / 1e18 : Infinity;

  let maxWithdrawable = aTokenBalance;
  if (totalDebtBase > 0n) {
    if (healthFactor <= 1) {
      maxWithdrawable = 0n;
    } else {
      const safetyFactor = Math.min(0.9, (healthFactor - 1) / healthFactor);
      maxWithdrawable = (aTokenBalance * BigInt(Math.floor(safetyFactor * 10000))) / 10000n;
    }
  }

  const totalAToken = reserveData[2];
  const totalDebt = reserveData[3] + reserveData[4];
  const availableLiquidity = totalAToken > totalDebt ? totalAToken - totalDebt : 0n;

  return {
    token: tokenAddress,
    tokenSymbol: symbol,
    currentSupplied: aTokenBalance.toString(),
    maxWithdrawable: maxWithdrawable.toString(),
    availableLiquidity: availableLiquidity.toString(),
    usageAsCollateralEnabled: Boolean(reserveConfig[5]),
    isCollateral: Boolean(reserveConfig[5]) && aTokenBalance > 0n,
    healthFactor: Number.isFinite(healthFactor) ? healthFactor.toFixed(4) : 'Infinity',
    decimals: Number(reserveConfig[0]),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: ts-node scripts/quote-withdraw.ts <tokenAddress> <userAddress> <chainId>');
    console.error('Example: ts-node scripts/quote-withdraw.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0x... 1');
    process.exit(1);
  }

  const [tokenAddress, userAddress, chainIdStr] = args;
  const chainId = parseInt(chainIdStr, 10);

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

  getWithdrawQuote(tokenAddress, userAddress, chainId)
    .then((quote) => {
      console.log(JSON.stringify(quote, null, 2));
    })
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
