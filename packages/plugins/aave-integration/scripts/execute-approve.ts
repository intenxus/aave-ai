#!/usr/bin/env ts-node
/**
 * AAVE V3 Approve Execution Script
 */

import { parseUnits } from 'viem';
import { erc20Abi } from '../lib/abis';
import { parseFlags, getStringArg, getOptionalStringArg, getOptionalBooleanArg } from '../lib/cli';
import { getAccount, getExecutionAddress, getPublicClient, getWalletClient } from '../lib/clients';
import { formatExecutionError } from '../lib/errors';
import { writeAndWait } from '../lib/execution';
import { getPoolAddress } from '../lib/pool';
import { dryRunResult, failureResult, successResult } from '../lib/result';
import { assertAddress, assertChainId, assertPositiveAmount, resolveToken } from '../lib/validation';
import { getTokenDecimals } from '../lib/erc20';
import type { ExecutionResult } from '../lib/types';

export async function executeApprove(argv = process.argv.slice(2)): Promise<ExecutionResult> {
  const flags = parseFlags(argv);
  const chainId = assertChainId(Number(getStringArg(flags, 'chainId')));
  const tokenInput = getStringArg(flags, 'token');
  const amount = assertPositiveAmount(getStringArg(flags, 'amount'));
  const accountArg = getOptionalStringArg(flags, 'account');
  const privateKey = getOptionalStringArg(flags, 'privateKey');
  const spenderArg = getOptionalStringArg(flags, 'spender');
  const dryRun = getOptionalBooleanArg(flags, 'dryRun');

  const publicClient = getPublicClient(chainId);
  const accountAddress = getExecutionAddress(privateKey, accountArg);

  const token = resolveToken(chainId, tokenInput);
  const decimals = token.decimals ?? (await getTokenDecimals(publicClient, token.address));
  const amountWei = parseUnits(amount, decimals);
  const spender = spenderArg ? assertAddress(spenderArg, 'spender') : await getPoolAddress(chainId);

  if (accountArg && accountArg.toLowerCase() !== accountAddress.toLowerCase()) {
    return failureResult('approve', chainId, token.address, amount, 'The --account does not match private key derived account.');
  }

  if (dryRun) {
    try {
      const gas = await publicClient.estimateContractGas({
        address: token.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amountWei],
        account: accountAddress,
      });
      return dryRunResult('approve', chainId, token.address, amount, [`dry-run`, `estimatedGas:${gas.toString()}`]);
    } catch (error) {
      return failureResult('approve', chainId, token.address, amount, formatExecutionError(error));
    }
  }

  try {
    const account = getAccount(privateKey);
    const walletClient = getWalletClient(chainId, account);
    const { txHash, receipt } = await writeAndWait({
      walletClient,
      publicClient,
      address: token.address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amountWei],
      account,
    });
    return successResult('approve', chainId, token.address, amount, txHash, receipt);
  } catch (error) {
    return failureResult('approve', chainId, token.address, amount, formatExecutionError(error));
  }
}

if (require.main === module) {
  executeApprove()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify(failureResult('approve', 1, '', '0', message), null, 2));
      process.exit(1);
    });
}
