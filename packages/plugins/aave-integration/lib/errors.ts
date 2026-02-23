export function formatExecutionError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('insufficient funds')) return 'Insufficient native token balance for gas.';
    if (error.message.includes('execution reverted')) return `Transaction reverted: ${error.message}`;
    if (error.message.includes('User rejected')) return 'Transaction rejected by user.';
    return error.message;
  }
  return String(error);
}
