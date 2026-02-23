#!/usr/bin/env ts-node
/**
 * AAVE V3 Withdraw Execution Script
 */

import { poolAbi } from '../lib/abis';
import { parseFlags, getStringArg, getOptionalStringArg, getOptionalBooleanArg } from '../lib/cli';
import { getAccount, getExecutionAddress, getPublicClient, getWalletClient } from '../lib/clients';
import { getTokenDecimals } from '../lib/erc20';
import { formatExecutionError } from '../lib/errors';
import { resolveOnBehalfOf, writeAndWait } from '../lib/execution';
import { getPoolAddress } from '../lib/pool';
import { dryRunResult, failureResult, successResult } from '../lib/result';
import { assertChainId, assertPositiveAmount, resolveToken, toAmountWei } from '../lib/validation';
import { getWithdrawQuote } from './quote-withdraw';
import type { ExecutionResult } from '../lib/types';

const HEALTH_FACTOR_GUARD = 1.05;

export async function executeWithdraw(argv = process.argv.slice(2)): Promise<ExecutionResult> {
  const flags = parseFlags(argv);
  const chainId = assertChainId(Number(getStringArg(flags, 'chainId')));
  const tokenInput = getStringArg(flags, 'token');
  const amount = assertPositiveAmount(getStringArg(flags, 'amount'));
  const accountArg = getOptionalStringArg(flags, 'account');
  const privateKey = getOptionalStringArg(flags, 'privateKey');
  const dryRun = getOptionalBooleanArg(flags, 'dryRun');

  const publicClient = getPublicClient(chainId);
  const accountAddress = getExecutionAddress(privateKey, accountArg);

  const onBehalfOf = resolveOnBehalfOf(accountAddress, accountArg);
  const poolAddress = await getPoolAddress(chainId);
  const token = resolveToken(chainId, tokenInput);
  const decimals = token.decimals ?? (await getTokenDecimals(publicClient, token.address));
  const amountWei = toAmountWei(amount, decimals);

  const quote = await getWithdrawQuote(token.address, onBehalfOf, chainId);
  const currentHf = quote.healthFactor === 'Infinity' ? Number.POSITIVE_INFINITY : Number(quote.healthFactor);
  const maxWithdrawable = BigInt(quote.maxWithdrawable);

  if (currentHf <= HEALTH_FACTOR_GUARD) {
    return failureResult(
      'withdraw',
      chainId,
      token.address,
      amount,
      `Health factor too low (${quote.healthFactor}). Minimum required: ${HEALTH_FACTOR_GUARD}.`
    );
  }

  if (amountWei > maxWithdrawable) {
    return failureResult('withdraw', chainId, token.address, amount, 'Requested amount exceeds max withdrawable for current position.', [
      `maxWithdrawable:${maxWithdrawable.toString()}`,
      `requested:${amountWei.toString()}`,
    ]);
  }

  if (dryRun) {
    try {
      const gas = await publicClient.estimateContractGas({
        address: poolAddress,
        abi: poolAbi,
        functionName: 'withdraw',
        args: [token.address, amountWei, onBehalfOf],
        account: accountAddress,
      });
      return dryRunResult('withdraw', chainId, token.address, amount, [`dry-run`, `estimatedGas:${gas.toString()}`]);
    } catch (error) {
      return failureResult('withdraw', chainId, token.address, amount, formatExecutionError(error));
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
      functionName: 'withdraw',
      args: [token.address, amountWei, onBehalfOf],
      account,
    });
    return successResult('withdraw', chainId, token.address, amount, txHash, receipt);
  } catch (error) {
    return failureResult('withdraw', chainId, token.address, amount, formatExecutionError(error));
  }
}

if (require.main === module) {
  executeWithdraw()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify(failureResult('withdraw', 1, '', '0', message), null, 2));
      process.exit(1);
    });
}
