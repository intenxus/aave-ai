import type { Account, PublicClient } from 'viem';
import { type WalletClient } from 'viem';
import { assertAddress } from './validation';
import type { ExecutionReceipt } from './types';

export function resolveOnBehalfOf(accountAddress: `0x${string}`, accountArg?: string): `0x${string}` {
  if (!accountArg) return accountAddress;
  return assertAddress(accountArg, 'account');
}

export async function writeAndWait(params: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  account: Account;
}): Promise<{ txHash: `0x${string}`; receipt: ExecutionReceipt }> {
  const txHash = await params.walletClient.writeContract({
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    account: params.account,
  } as never);

  const receipt = await params.publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    receipt: {
      status: receipt.status === 'success' ? 'success' : 'reverted',
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber.toString(),
      transactionHash: receipt.transactionHash,
    },
  };
}
