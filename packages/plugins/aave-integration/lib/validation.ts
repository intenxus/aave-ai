import { parseUnits } from 'viem';
import { CHAIN_IDS, TOKENS } from './addresses';
import type { SupportedChainId } from './types';

export function assertAddress(address: string, field: string): `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid ${field}: ${address}`);
  }
  return address as `0x${string}`;
}

export function assertChainId(chainId: number): SupportedChainId {
  if (!CHAIN_IDS.includes(chainId as SupportedChainId)) {
    throw new Error(`Unsupported chainId: ${chainId}. Supported: 1, 42161`);
  }
  return chainId as SupportedChainId;
}

export function assertPositiveAmount(amount: string): string {
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amount)) {
    throw new Error(`Invalid amount format: ${amount}`);
  }
  if (Number(amount) <= 0) {
    throw new Error(`Amount must be positive: ${amount}`);
  }
  return amount;
}

export function resolveToken(chainId: SupportedChainId, tokenInput: string): { address: `0x${string}`; symbol: string; decimals?: number } {
  const normalized = tokenInput.toUpperCase();
  const tokenMap = TOKENS[chainId];
  if (tokenMap[normalized]) {
    return {
      address: tokenMap[normalized].address,
      symbol: normalized,
      decimals: tokenMap[normalized].decimals,
    };
  }
  return {
    address: assertAddress(tokenInput, 'token'),
    symbol: tokenInput,
  };
}

export function toAmountWei(amount: string, decimals: number): bigint {
  return parseUnits(assertPositiveAmount(amount), decimals);
}
