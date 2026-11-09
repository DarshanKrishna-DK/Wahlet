import { createPublicClient, createWalletClient, http, erc20Abi, getAddress, keccak256, encodeFunctionData, parseEventLogs, type Address, type Hex, type TransactionReceipt } from 'viem';
import { publicActionsL2 } from 'viem/op-stack';
import { chain, rpcUrl, USDT, PERMIT2, EXACT_PROXY, explorer, type Asset } from './config.js';
import { atomic, display } from './amounts.js';
import { Ledger, type Operation } from './ledger.js';
import { Vault } from './vault.js';
import { createHash } from 'node:crypto';

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 15000, retryCount: 2 }) }).extend(publicActionsL2());
export const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class Wallet {
  readonly vault = new Vault();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly ledger: Ledger) {}
  serial<T>(action: () => Promise<T>): Promise<T> { const next = this.queue.then(action, action); this.queue = next.catch(() => {}); return next; }
  async network() {
    if (await publicClient.getChainId() !== chain.id) throw new Error('RPC chain mismatch. Expected Whitechain Sepolia 1874');
    const precision = await publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: 'decimals' });
    if (precision !== 6) throw new Error('USDT metadata changed. Payments are disabled until reviewed');
  }
  async balances() {
    await this.network(); const address = this.vault.address as Address | null;
    if (!address) return { address: null, WBT: null, USDT: null, chainId: chain.id };
    const [wbt, usdt, allowance] = await Promise.all([publicClient.getBalance({ address }), publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [address] }), publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: 'allowance', args: [address, PERMIT2] })]);
    return { address, WBT: display(wbt, 'WBT'), USDT: display(usdt, 'USDT'), allowance: display(allowance, 'USDT'), chainId: chain.id, explorer: `${chain.blockExplorers.default.url}/address/${address}` };
  }
  async ensurePaymentContracts() {
    for (const address of [PERMIT2, EXACT_PROXY]) if (!(await publicClient.getCode({ address }))) throw new Error('Required payment contract is unavailable on this network');
  }
  async transfer(input: { id: string; asset: Asset; amount: string; recipient: string }) {
    return this.serial(async () => {
      const recipient = getAddress(input.recipient); if (/^0x0{40}$/i.test(recipient)) throw new Error('Zero address is not a payment destination');
      const amount = atomic(input.amount, input.asset), account = this.vault.account();
      if (recipient === account.address) throw new Error('Choose a distinct recipient for this payment');
      await this.network();
      const op = this.ledger.reserve({ ...input, amount, recipient, kind: 'transfer', fingerprint: fingerprint({ asset: input.asset, amount: amount.toString(), recipient }) });
      if (op.state !== 'reserved') return this.result(op);
      try {
        const data = input.asset === 'USDT' ? encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, amount] }) : undefined;
        return await this.submit(op, input.asset === 'USDT' ? USDT : recipient, input.asset === 'WBT' ? amount : 0n, data);
      } catch (error) { if (this.ledger.get(input.id)?.state === 'reserved') this.ledger.update(input.id, 'failed', { error: message(error) }); throw error; }
    });
  }
  async approve(amountText: string, id: string) {
    return this.serial(async () => {
      await this.network(); await this.ensurePaymentContracts();
      const amount = amountText === '0' ? 0n : atomic(amountText, 'USDT');
      if (amount > atomic(this.ledger.policy().USDT.perDay, 'USDT')) throw new Error('Allowance cannot exceed the daily USDT limit');
      if (amount > 0n && this.ledger.policy().paused) throw new Error('Resume payments before increasing the allowance');
      const op = this.ledger.reserve({ id, asset: 'WBT', amount: 0n, recipient: PERMIT2, kind: 'approval', fingerprint: fingerprint({ approval: amount.toString() }) });
      if (op.state !== 'reserved') return this.result(op);
      try { return await this.submit(op, USDT, 0n, encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [PERMIT2, amount] })); } catch (error) { if (this.ledger.get(id)?.state === 'reserved') this.ledger.update(id, 'failed', { error: message(error) }); throw error; }
    });
  }
  private async submit(op: Operation, to: Address, value: bigint, data?: Hex) {
    const account = this.vault.account();
    const client = createWalletClient({ account, chain, transport: http(rpcUrl) });
    if (this.ledger.pending().some(item => item.id !== op.id && item.state === 'submitted')) throw new Error('A submitted transaction is still unresolved. Refresh its receipt before sending another payment');
    const request = await client.prepareTransactionRequest({ account, to, value, data, chain });
    const gas = request.gas * (request.maxFeePerGas ?? request.gasPrice ?? 0n);
    const l1Fee = await publicClient.estimateL1Fee({ account, to, value, data });
    const totalFee = gas + l1Fee;
    if (totalFee > atomic(process.env.WAHLET_MAX_GAS_WBT ?? '0.005', 'WBT')) throw new Error('Estimated fee exceeds the configured gas ceiling');
    const balance = await publicClient.getBalance({ address: account.address });
    if (balance < value + totalFee + atomic(process.env.WAHLET_GAS_RESERVE_WBT ?? '0.005', 'WBT')) throw new Error('Insufficient WBT after keeping the configured gas reserve');
    const raw = await client.signTransaction(request), hash = keccak256(raw);
    this.ledger.update(op.id, 'submitted', { raw, hash, detail: JSON.stringify({ estimatedFeeWBT: display(totalFee, 'WBT'), from: account.address }) });
    await publicClient.sendRawTransaction({ serializedTransaction: raw });
    try { const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 45000, confirmations: 1 }); this.acceptReceipt(this.ledger.get(op.id)!, receipt); } catch { /* Keep the durable submission reserved until receipt reconciliation. */ }
    return this.result(this.ledger.get(op.id)!);
  }
  acceptReceipt(op: Operation, receipt: TransactionReceipt) {
    if (receipt.status !== 'success') { this.ledger.update(op.id, 'failed', { error: 'Transaction reverted onchain' }); return; }
    if (op.kind === 'transfer' && op.asset === 'USDT') {
      const events = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: 'Transfer' });
      if (!events.some(event => event.address.toLowerCase() === USDT.toLowerCase() && event.args.from.toLowerCase() === this.vault.address?.toLowerCase() && event.args.to.toLowerCase() === op.recipient.toLowerCase() && event.args.value === BigInt(op.amount))) throw new Error('Receipt does not contain the expected USDT transfer');
    }
    this.ledger.update(op.id, 'confirmed', { detail: JSON.stringify({ ...JSON.parse(op.detail), blockNumber: receipt.blockNumber.toString(), gasUsed: receipt.gasUsed.toString(), confirmation: 'L2 inclusion. Ethereum finality is separate.' }) });
  }
  async reconcile() {
    await this.network();
    for (const op of this.ledger.pending()) {
      if (op.state === 'reserved') { this.ledger.update(op.id, 'failed', { error: 'Interrupted before signing. No transaction was authorized' }); continue; }
      if (op.state !== 'submitted' || !op.hash) continue;
      try { const receipt = await publicClient.getTransactionReceipt({ hash: op.hash as Hex }); this.acceptReceipt(op, receipt); }
      catch { if (op.raw) { try { await publicClient.sendRawTransaction({ serializedTransaction: op.raw as Hex }); } catch { /* A known or pending identical transaction remains reserved. */ } } }
    }
  }
  result(op: Operation) { const { raw, fingerprint: ignored, ...safe } = op; return { ...safe, amount: display(op.amount, op.asset), detail: JSON.parse(op.detail), explorer: op.hash ? explorer(op.hash) : null }; }
}
export function message(error: unknown) { return error instanceof Error ? error.message.slice(0, 450) : 'The operation failed'; }
