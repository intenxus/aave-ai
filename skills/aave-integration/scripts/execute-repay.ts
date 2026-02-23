#!/usr/bin/env ts-node
/**
 * AAVE V3 Repay Execution Script
 */

import { poolAbi } from '../lib/abis';
import { parseFlags, getStringArg, getOptionalStringArg, getOptionalBooleanArg } from '../lib/cli';
import { getAccount, getExecutionAddress, getPublicClient, getWalletClient } from '../lib/clients';
import { getAllowance, getTokenBalance, getTokenDecimals } from '../lib/erc20';
import { formatExecutionError } from '../lib/errors';
import { resolveOnBehalfOf, writeAndWait } from '../lib/execution';
import { getPoolAddress, getReserveTokens } from '../lib/pool';
import { dryRunResult, failureResult, successResult } from '../lib/result';
import { assertChainId, assertPositiveAmount, resolveToken, toAmountWei } from '../lib/validation';
import { debtTokenAbi } from '../lib/abis';
import type { ExecutionResult } from '../lib/types';

async function getRepayAmountWei(params: {
  max: boolean;
  amount: string;
  decimals: number;
  mode: 1 | 2;
  publicClient: ReturnType<typeof getPublicClient>;
  chainId: 1 | 42161;
  tokenAddress: `0x${string}`;
  user: `0x${string}`;
}): Promise<bigint> {
  if (!params.max) {
    return toAmountWei(params.amount, params.decimals);
  }

  const reserveTokens = await getReserveTokens(params.publicClient, params.chainId, params.tokenAddress);
  const debtToken = params.mode === 1 ? reserveTokens[1] : reserveTokens[2];
  if (debtToken === '0x0000000000000000000000000000000000000000') {
    return 0n;
  }

  return (await params.publicClient.readContract({
    address: debtToken,
    abi: debtTokenAbi,
    functionName: 'balanceOf',
    args: [params.user],
  })) as bigint;
}

export async function executeRepay(argv = process.argv.slice(2)): Promise<ExecutionResult> {
  const flags = parseFlags(argv);
  const chainId = assertChainId(Number(getStringArg(flags, 'chainId')));
  const tokenInput = getStringArg(flags, 'token');
  const amount = assertPositiveAmount(getStringArg(flags, 'amount', false) || '0.000001');
  const accountArg = getOptionalStringArg(flags, 'account');
  const privateKey = getOptionalStringArg(flags, 'privateKey');
  const dryRun = getOptionalBooleanArg(flags, 'dryRun');
  const max = getOptionalBooleanArg(flags, 'max');
  const mode = Number(getOptionalStringArg(flags, 'interestRateMode') ?? '2');

  if (mode !== 1 && mode !== 2) {
    throw new Error('Invalid interestRateMode. Use 1 (stable) or 2 (variable).');
  }

  const publicClient = getPublicClient(chainId);
  const accountAddress = getExecutionAddress(privateKey, accountArg);

  const onBehalfOf = resolveOnBehalfOf(accountAddress, accountArg);
  const poolAddress = await getPoolAddress(chainId);
  const token = resolveToken(chainId, tokenInput);
  const decimals = token.decimals ?? (await getTokenDecimals(publicClient, token.address));
  const amountWei = await getRepayAmountWei({
    max,
    amount,
    decimals,
    mode: mode as 1 | 2,
    publicClient,
    chainId,
    tokenAddress: token.address,
    user: onBehalfOf,
  });

  if (amountWei <= 0n) {
    return failureResult('repay', chainId, token.address, amount, 'Repay amount is zero. No debt found for selected mode.');
  }

  const [balance, allowance] = await Promise.all([
    getTokenBalance(publicClient, token.address, accountAddress),
    getAllowance(publicClient, token.address, accountAddress, poolAddress),
  ]);

  if (balance < amountWei) {
    return failureResult('repay', chainId, token.address, amount, 'Insufficient token balance for repay.');
  }

  if (allowance < amountWei) {
    return failureResult('repay', chainId, token.address, amount, 'Allowance insufficient. Run execute-approve first.', [
      `currentAllowance:${allowance.toString()}`,
      `requiredAllowance:${amountWei.toString()}`,
    ]);
  }

  if (dryRun) {
    try {
      const gas = await publicClient.estimateContractGas({
        address: poolAddress,
        abi: poolAbi,
        functionName: 'repay',
        args: [token.address, amountWei, BigInt(mode), onBehalfOf],
        account: accountAddress,
      });
      return dryRunResult('repay', chainId, token.address, max ? 'max' : amount, [`dry-run`, `estimatedGas:${gas.toString()}`]);
    } catch (error) {
      return failureResult('repay', chainId, token.address, max ? 'max' : amount, formatExecutionError(error));
    }
  }

  try {
    const account = getAccount(privateKey);
    const walletClient = getWalletClient(chainId, account);
    const { txHash, receipt } = await writeAndWait({
      walletClient,
      publicClient,
      address: poolAddress,
      abi: poolAbi,
      functionName: 'repay',
      args: [token.address, amountWei, BigInt(mode), onBehalfOf],
      account,
    });
    return successResult('repay', chainId, token.address, max ? 'max' : amount, txHash, receipt);
  } catch (error) {
    return failureResult('repay', chainId, token.address, max ? 'max' : amount, formatExecutionError(error));
  }
}

if (require.main === module) {
  executeRepay()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify(failureResult('repay', 1, '', '0', message), null, 2));
      process.exit(1);
    });
}
