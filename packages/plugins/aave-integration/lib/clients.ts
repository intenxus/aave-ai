import { createPublicClient, createWalletClient, http, type Account, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, arbitrum } from 'viem/chains';
import type { SupportedChainId } from './types';
import { assertAddress } from './validation';

export function getRpcUrl(chainId: SupportedChainId): string {
  const envVar = chainId === 1 ? 'ETHEREUM_RPC_URL' : 'ARBITRUM_RPC_URL';
  const defaultRpc = chainId === 1 ? 'https://ethereum.publicnode.com' : 'https://arbitrum.publicnode.com';
  return process.env[envVar] || defaultRpc;
}

export function getChain(chainId: SupportedChainId) {
  return chainId === 1 ? mainnet : arbitrum;
}

export function getPublicClient(chainId: SupportedChainId): PublicClient {
  return createPublicClient({
    chain: getChain(chainId),
    transport: http(getRpcUrl(chainId)),
  });
}

export function getAccount(privateKey?: string): Account {
  const pk = privateKey ?? process.env.AAVE_EXEC_PRIVATE_KEY;
  if (!pk) {
    throw new Error('Missing private key. Set AAVE_EXEC_PRIVATE_KEY or pass --privateKey.');
  }
  const normalized = pk.startsWith('0x') ? pk : `0x${pk}`;
  return privateKeyToAccount(normalized as `0x${string}`);
}

export function getExecutionAddress(privateKey?: string, accountArg?: string): `0x${string}` {
  if (privateKey ?? process.env.AAVE_EXEC_PRIVATE_KEY) {
    return getAccount(privateKey).address;
  }
  if (accountArg) {
    return assertAddress(accountArg, 'account');
  }
  if (process.env.AAVE_EXEC_ACCOUNT) {
    return assertAddress(process.env.AAVE_EXEC_ACCOUNT, 'AAVE_EXEC_ACCOUNT');
  }
  throw new Error('Missing execution account. Provide --account or set AAVE_EXEC_ACCOUNT for dry-run.');
}

export function getWalletClient(chainId: SupportedChainId, account: Account): WalletClient {
  return createWalletClient({
    chain: getChain(chainId),
    transport: http(getRpcUrl(chainId)),
    account,
  });
}
