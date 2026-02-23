import type { ExecutionAction, ExecutionReceipt, ExecutionResult, SupportedChainId } from './types';

export function successResult(
  action: ExecutionAction,
  chainId: SupportedChainId,
  token: string,
  amount: string,
  txHash: string,
  receipt: ExecutionReceipt,
  warnings: string[] = []
): ExecutionResult {
  return {
    ok: true,
    action,
    chainId,
    token,
    amount,
    txHash,
    receipt,
    warnings,
  };
}

export function dryRunResult(
  action: ExecutionAction,
  chainId: SupportedChainId,
  token: string,
  amount: string,
  warnings: string[] = []
): ExecutionResult {
  return {
    ok: true,
    action,
    chainId,
    token,
    amount,
    warnings,
  };
}

export function failureResult(
  action: ExecutionAction,
  chainId: SupportedChainId,
  token: string,
  amount: string,
  error: string,
  warnings: string[] = []
): ExecutionResult {
  return {
    ok: false,
    action,
    chainId,
    token,
    amount,
    warnings,
    error,
  };
}
