import type { PublicClient } from 'viem';
import { dataProviderAbi, poolAbi, providerAbi } from './abis';
import { POOL_ADDRESSES_PROVIDER, POOL_PROXY } from './addresses';
import type { SupportedChainId } from './types';

export async function getPoolAddress(chainId: SupportedChainId): Promise<`0x${string}`> {
  return POOL_PROXY[chainId];
}

export async function getPoolDataProviderAddress(
  client: PublicClient,
  chainId: SupportedChainId
): Promise<`0x${string}`> {
  return (await client.readContract({
    address: POOL_ADDRESSES_PROVIDER[chainId],
    abi: providerAbi,
    functionName: 'getPoolDataProvider',
  })) as `0x${string}`;
}

export async function getReserveConfig(
  client: PublicClient,
  chainId: SupportedChainId,
  token: `0x${string}`
): Promise<readonly (bigint | boolean)[]> {
  const dataProvider = await getPoolDataProviderAddress(client, chainId);
  return (await client.readContract({
    address: dataProvider,
    abi: dataProviderAbi,
    functionName: 'getReserveConfigurationData',
    args: [token],
  })) as readonly (bigint | boolean)[];
}

export async function getReserveTokens(
  client: PublicClient,
  chainId: SupportedChainId,
  token: `0x${string}`
): Promise<readonly `0x${string}`[]> {
  const dataProvider = await getPoolDataProviderAddress(client, chainId);
  return (await client.readContract({
    address: dataProvider,
    abi: dataProviderAbi,
    functionName: 'getReserveTokensAddresses',
    args: [token],
  })) as readonly `0x${string}`[];
}

export async function getUserAccountData(
  client: PublicClient,
  chainId: SupportedChainId,
  user: `0x${string}`
): Promise<readonly bigint[]> {
  return (await client.readContract({
    address: POOL_PROXY[chainId],
    abi: poolAbi,
    functionName: 'getUserAccountData',
    args: [user],
  })) as readonly bigint[];
}
