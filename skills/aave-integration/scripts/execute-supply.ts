#!/usr/bin/env ts-node
/**
 * AAVE V3 Supply Execution Script
 */

import { poolAbi } from '../lib/abis';
import { parseFlags, getStringArg, getOptionalStringArg, getOptionalBooleanArg } from '../lib/cli';
import { getAccount, getExecutionAddress, getPublicClient, getWalletClient } from '../lib/clients';
import { getAllowance, getTokenBalance, getTokenDecimals } from '../lib/erc20';
import { formatExecutionError } from '../lib/errors';
import { resolveOnBehalfOf, writeAndWait } from '../lib/execution';
import { getPoolAddress } from '../lib/pool';
import { dryRunResult, failureResult, successResult } from '../lib/result';
import { assertChainId, assertPositiveAmount, resolveToken, toAmountWei } from '../lib/validation';
import type { ExecutionResult } from '../lib/types';

export async function executeSupply(argv = process.argv.slice(2)): Promise<ExecutionResult> {
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

  const [balance, allowance] = await Promise.all([
    getTokenBalance(publicClient, token.address, accountAddress),
    getAllowance(publicClient, token.address, accountAddress, poolAddress),
  ]);

  if (balance < amountWei) {
    return failureResult('supply', chainId, token.address, amount, 'Insufficient token balance for supply.');
  }
  if (allowance < amountWei) {
    return failureResult('supply', chainId, token.address, amount, 'Allowance insufficient. Run execute-approve first.', [
      `currentAllowance:${allowance.toString()}`,
      `requiredAllowance:${amountWei.toString()}`,
    ]);
  }

  if (dryRun) {
    try {
      const gas = await publicClient.estimateContractGas({
        address: poolAddress,
        abi: poolAbi,
        functionName: 'supply',
        args: [token.address, amountWei, onBehalfOf, 0],
        account: accountAddress,
      });
      return dryRunResult('supply', chainId, token.address, amount, [`dry-run`, `estimatedGas:${gas.toString()}`]);
    } catch (error) {
      return failureResult('supply', chainId, token.address, amount, formatExecutionError(error));
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
      functionName: 'supply',
      args: [token.address, amountWei, onBehalfOf, 0],
      account,
    });
    return successResult('supply', chainId, token.address, amount, txHash, receipt);
  } catch (error) {
    return failureResult('supply', chainId, token.address, amount, formatExecutionError(error));
  }
}

if (require.main === module) {
  executeSupply()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify(failureResult('supply', 1, '', '0', message), null, 2));
      process.exit(1);
    });
}
