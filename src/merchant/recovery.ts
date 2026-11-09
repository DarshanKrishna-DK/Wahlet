import type { Hex, TransactionReceipt } from 'viem';

type RecoveryClient = {
  sendRawTransaction(args: { serializedTransaction: Hex }): Promise<Hex>;
  waitForTransactionReceipt(args: { hash: Hex; timeout: number }): Promise<Pick<TransactionReceipt, 'status'>>;
};

export async function resumeSettlement(client: RecoveryClient, entry: { raw: Hex | null; hash: Hex }) {
  if (entry.raw) {
    try { await client.sendRawTransaction({ serializedTransaction: entry.raw }); }
    catch { /* Already-known submissions are reconciled by their exact saved hash. */ }
  }
  const receipt = await client.waitForTransactionReceipt({ hash: entry.hash, timeout: 45000 });
  if (receipt.status !== 'success') throw new Error('Previous settlement reverted');
  return receipt;
}
