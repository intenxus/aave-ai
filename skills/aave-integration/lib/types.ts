export type SupportedChainId = 1 | 42161;

export type ExecutionAction = 'approve' | 'supply' | 'borrow' | 'repay' | 'withdraw';

export interface ExecutionReceipt {
  status: 'success' | 'reverted';
  gasUsed: string;
  blockNumber: string;
  transactionHash: string;
}

export interface ExecutionResult {
  ok: boolean;
  action: ExecutionAction;
  chainId: SupportedChainId;
  token: string;
  amount: string;
  txHash?: string;
  receipt?: ExecutionReceipt;
  warnings: string[];
  error?: string;
}
