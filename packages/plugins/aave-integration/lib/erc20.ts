import { erc20Abi } from './abis';
import type { PublicClient } from 'viem';

export async function getTokenDecimals(client: PublicClient, token: `0x${string}`): Promise<number> {
  const decimals = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  return Number(decimals);
}

export async function getTokenBalance(client: PublicClient, token: `0x${string}`, user: `0x${string}`): Promise<bigint> {
  return (await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [user],
  })) as bigint;
}

export async function getAllowance(
  client: PublicClient,
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`
): Promise<bigint> {
  return (await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  })) as bigint;
}
