#!/usr/bin/env ts-node
/**
 * AAVE V3 Borrow Execution Script
 */

import { poolAbi } from '../lib/abis';
import { parseFlags, getStringArg, getOptionalStringArg, getOptionalBooleanArg } from '../lib/cli';
import { getAccount, getExecutionAddress, getPublicClient, getWalletClient } from '../lib/clients';
import { getTokenDecimals } from '../lib/erc20';
import { formatExecutionError } from '../lib/errors';
import { resolveOnBehalfOf, writeAndWait } from '../lib/execution';
import { getPoolAddress, getReserveConfig, getUserAccountData } from '../lib/pool';
import { dryRunResult, failureResult, successResult } from '../lib/result';
import { assertChainId, assertPositiveAmount, resolveToken, toAmountWei } from '../lib/validation';
import type { ExecutionResult } from '../lib/types';

export async function executeBorrow(argv = process.argv.slice(2)): Promise<ExecutionResult> {
  const flags = parseFlags(argv);
  const chainId = assertChainId(Number(getStringArg(flags, 'chainId')));
  const tokenInput = getStringArg(flags, 'token');
  const amount = assertPositiveAmount(getStringArg(flags, 'amount'));
  const accountArg = getOptionalStringArg(flags, 'account');
  const privateKey = getOptionalStringArg(flags, 'privateKey');
  const dryRun = getOptionalBooleanArg(flags, 'dryRun');
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
  const amountWei = toAmountWei(amount, decimals);

  const [reserveConfig, accountData] = await Promise.all([
    getReserveConfig(publicClient, chainId, token.address),
    getUserAccountData(publicClient, chainId, onBehalfOf),
  ]);

  if (!Boolean(reserveConfig[6])) {
    return failureResult('borrow', chainId, token.address, amount, 'Borrowing is disabled for this reserve.');
  }
  if (!Boolean(reserveConfig[8]) || Boolean(reserveConfig[9])) {
    return failureResult('borrow', chainId, token.address, amount, 'Reserve is inactive or frozen.');
  }

  if (mode === 1 && !Boolean(reserveConfig[7])) {
    return failureResult(
      'borrow',
      chainId,
      token.address,
      amount,
      'Stable borrow mode is not enabled for this asset. Use interestRateMode=2.'
    );
  }

  const availableBorrowsBase = accountData[2];
  if (availableBorrowsBase === 0n) {
    return failureResult('borrow', chainId, token.address, amount, 'No available borrow capacity.');
  }

  if (dryRun) {
    try {
      const gas = await publicClient.estimateContractGas({
        address: poolAddress,
        abi: poolAbi,
        functionName: 'borrow',
        args: [token.address, amountWei, BigInt(mode), 0, onBehalfOf],
        account: accountAddress,
      });
      return dryRunResult('borrow', chainId, token.address, amount, [`dry-run`, `estimatedGas:${gas.toString()}`]);
    } catch (error) {
      return failureResult('borrow', chainId, token.address, amount, formatExecutionError(error));
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
      functionName: 'borrow',
      args: [token.address, amountWei, BigInt(mode), 0, onBehalfOf],
      account,
    });
    return successResult('borrow', chainId, token.address, amount, txHash, receipt);
  } catch (error) {
    return failureResult('borrow', chainId, token.address, amount, formatExecutionError(error));
  }
}

if (require.main === module) {
  executeBorrow()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify(failureResult('borrow', 1, '', '0', message), null, 2));
      process.exit(1);
    });
}
