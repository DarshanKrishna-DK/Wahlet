import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import type { PaymentRequired, PaymentRequirements, PaymentPayload } from '@x402/core/types';
import { erc20Abi, getAddress, parseEventLogs, type Address, type Hex } from 'viem';
import { USDT, PERMIT2, EXACT_PROXY, rpcUrl, explorer } from './config.js';
import { display } from './amounts.js';
import { Wallet, fingerprint, publicClient } from './wallet.js';
import { safeFetch, validateUrl } from './safe-fetch.js';
import { matchesSettlement } from './settlement.js';

export class Payments {
  constructor(readonly wallet: Wallet) {
    wallet.ledger.db.exec('CREATE TABLE IF NOT EXISTS authorizations (id TEXT PRIMARY KEY, resource TEXT NOT NULL, payload TEXT NOT NULL, header TEXT NOT NULL)');
  }
  private saved(id: string) { return this.wallet.ledger.db.prepare('SELECT * FROM authorizations WHERE id=?').get(id) as { id: string; resource: string; payload: string; header: string } | undefined; }
  async authorize(id: string, challenge: PaymentRequired, resource: string) {
    return this.wallet.serial(async () => {
      validateUrl(resource, this.wallet.ledger.policy().allowedOrigins);
      if (challenge.x402Version !== 2 || challenge.resource?.url !== resource || challenge.accepts?.length !== 1) throw new Error('Expected one x402 v2 payment offer bound to this exact resource');
      const offer = challenge.accepts[0];
      if (offer.scheme !== 'exact' || offer.network !== 'eip155:1874' || getAddress(offer.asset) !== USDT || offer.extra?.assetTransferMethod !== 'permit2') throw new Error('Only official test USDT exact Permit2 payments on eip155:1874 are supported');
      if (typeof offer.amount !== 'string' || !/^[1-9][0-9]{0,30}$/.test(offer.amount) || !Number.isSafeInteger(offer.maxTimeoutSeconds) || offer.maxTimeoutSeconds < 1 || offer.maxTimeoutSeconds > 300) throw new Error('Invalid payment amount or authorization duration');
      const recipient = getAddress(offer.payTo), account = this.wallet.vault.account();
      if (/^0x0{40}$/i.test(recipient) || recipient === account.address) throw new Error('A distinct nonzero merchant is required');
      const amount = BigInt(offer.amount);
      await this.wallet.network(); await this.wallet.ensurePaymentContracts();
      const existing = this.saved(id);
      if (existing) { if (existing.resource !== resource || this.wallet.ledger.get(id)?.fingerprint !== fingerprint({ resource, offer })) throw new Error('Operation ID belongs to a different authorization'); return { header: JSON.parse(existing.header) as Record<string, string>, payload: JSON.parse(existing.payload) as PaymentPayload }; }
      const [allowance, balance] = await Promise.all([publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: 'allowance', args: [account.address, PERMIT2] }), publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })]);
      if (allowance < amount) throw new Error('Approve a bounded USDT allowance in the local console before paying for an API');
      if (balance < amount) throw new Error('Insufficient agent USDT balance');
      const operation = this.wallet.ledger.reserve({ id, fingerprint: fingerprint({ resource, offer }), asset: 'USDT', amount, recipient, kind: 'x402' });
      if (operation.state !== 'reserved') throw new Error('This operation already ended. Create a new operation ID to authorize another payment');
      const authorizationBlock = await publicClient.getBlock();
      const authorizedBlock = authorizationBlock.number.toString();
      try {
        // The ledger has approved and reserved this exact amount under owner policy.
        const client = new x402Client()
          .register('eip155:1874', new ExactEvmScheme(account, { rpcUrl }))
          .setSpendControls({ allowedAssets: [{ network: 'eip155:1874', asset: USDT, maxAmountPerPayment: amount.toString() }] });
        const httpClient = new x402HTTPClient(client);
        const payload = await httpClient.createPaymentPayload({ x402Version: 2, resource: challenge.resource, accepts: [offer] });
        const header = httpClient.encodePaymentSignatureHeader(payload);
        const permit = (payload.payload as { permit2Authorization?: { deadline: string; nonce: string; spender: string } }).permit2Authorization;
        if (!permit || getAddress(permit.spender) !== EXACT_PROXY) throw new Error('SDK returned an unexpected settlement spender');
        if (!/^[0-9]+$/.test(permit.deadline) || BigInt(permit.deadline) > authorizationBlock.timestamp + 330n || BigInt(permit.deadline) <= authorizationBlock.timestamp) throw new Error('Authorization deadline is outside the permitted chain-time window. Check the system clock');
        this.wallet.ledger.db.exec('BEGIN IMMEDIATE');
        try { this.wallet.ledger.db.prepare('INSERT INTO authorizations VALUES(?,?,?,?)').run(id, resource, JSON.stringify(payload), JSON.stringify(header)); this.wallet.ledger.update(id, 'authorized', { expires: Number(permit.deadline), detail: JSON.stringify({ resource, permitNonce: permit.nonce, from: account.address, authorizedBlock }) }); this.wallet.ledger.db.exec('COMMIT'); } catch (error) { this.wallet.ledger.db.exec('ROLLBACK'); throw error; }
        return { header, payload };
      } catch (error) { if (!this.saved(id)) this.wallet.ledger.update(id, 'failed', { error: 'Authorization was not produced or persisted' }); throw error; }
    });
  }
  async fetch(id: string, resource: string) {
    const origins = this.wallet.ledger.policy().allowedOrigins;
    const saved = this.saved(id);
    if (saved && saved.resource !== resource) throw new Error('Operation ID belongs to another resource');
    let header: Record<string, string>;
    if (saved) header = JSON.parse(saved.header);
    else {
      const first = await safeFetch(resource, origins);
      if (first.status !== 402) return { paid: false, ...first, body: first.body.slice(0, 16000) };
      const encoded = first.headers['payment-required'];
      const challenge = encoded ? JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) : JSON.parse(first.body);
      header = (await this.authorize(id, challenge, resource)).header;
    }
    const response = await safeFetch(resource, origins, header);
    const encoded = response.headers['payment-response'];
    if (!encoded) return { paid: false, state: this.wallet.ledger.get(id)?.state, status: response.status, body: response.body.slice(0, 16000), message: 'No settlement proof returned. Authorization remains reserved' };
    const proof = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as { success: boolean; network: string; transaction: string; payer: string };
    if (!proof.success || proof.network !== 'eip155:1874' || !/^0x[0-9a-fA-F]{64}$/.test(proof.transaction)) throw new Error('Merchant did not return a valid settlement receipt');
    const receipt = await publicClient.getTransactionReceipt({ hash: proof.transaction as Hex });
    const op = this.wallet.ledger.get(id)!;
    if (receipt.status !== 'success' || receipt.to?.toLowerCase() !== EXACT_PROXY.toLowerCase()) throw new Error('Settlement transaction did not execute through the expected proxy');
    const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: 'Transfer' });
    if (!transfers.some(event => event.address.toLowerCase() === USDT.toLowerCase() && event.args.from.toLowerCase() === this.wallet.vault.address?.toLowerCase() && event.args.to.toLowerCase() === op.recipient.toLowerCase() && event.args.value === BigInt(op.amount))) throw new Error('Settlement receipt does not match the authorized payment');
    const transaction = await publicClient.getTransaction({ hash: proof.transaction as Hex });
    const authorization = this.saved(id);
    if (!authorization || !matchesSettlement(transaction.input, JSON.parse(authorization.payload))) throw new Error('Settlement does not match the complete signed authorization');
    this.wallet.ledger.update(id, response.status >= 200 && response.status < 300 ? 'delivered' : 'confirmed', { hash: proof.transaction, detail: JSON.stringify({ ...JSON.parse(op.detail), blockNumber: receipt.blockNumber.toString(), resource, status: response.status }) });
    return { paid: true, amount: display(op.amount, 'USDT'), asset: 'USDT', transaction: proof.transaction, explorer: explorer(proof.transaction), status: response.status, body: response.body.slice(0, 16000) };
  }
  async reconcile() {
    for (const op of this.wallet.ledger.pending().filter(item => item.state === 'authorized')) {
      const detail = JSON.parse(op.detail) as { permitNonce: string; from: Address; authorizedBlock?: string; scannedThrough?: string };
      if (!detail.permitNonce) continue;
      const nonce = BigInt(detail.permitNonce);
      const snapshot = await publicClient.getBlock();
      const bitmap = await publicClient.readContract({ address: PERMIT2, abi: [{ type: 'function', name: 'nonceBitmap', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'wordPos', type: 'uint256' }], outputs: [{ type: 'uint256' }] }], functionName: 'nonceBitmap', args: [detail.from, nonce >> 8n], blockNumber: snapshot.number });
      const consumed = (bitmap & (1n << (nonce & 255n))) !== 0n;
      if (consumed && detail.authorizedBlock) {
        const saved = this.saved(op.id);
        if (!saved) continue;
        const latest = snapshot.number;
        const start = detail.scannedThrough ? BigInt(detail.scannedThrough) + 1n : BigInt(detail.authorizedBlock);
        const end = start + 1999n < latest ? start + 1999n : latest;
        if (start > end) continue;
        const logs = await publicClient.getContractEvents({ address: USDT, abi: erc20Abi, eventName: 'Transfer', args: { from: detail.from, to: op.recipient as Address }, fromBlock: start, toBlock: end });
        let matched = false;
        for (const log of logs) {
          if (log.args.value !== BigInt(op.amount) || !log.transactionHash) continue;
          const tx = await publicClient.getTransaction({ hash: log.transactionHash });
          if (tx.to?.toLowerCase() !== EXACT_PROXY.toLowerCase() || !matchesSettlement(tx.input, JSON.parse(saved.payload))) continue;
          const receipt = await publicClient.getTransactionReceipt({ hash: log.transactionHash });
          if (receipt.status !== 'success') continue;
          this.wallet.ledger.update(op.id, 'confirmed', { hash: log.transactionHash, detail: JSON.stringify({ ...detail, blockNumber: receipt.blockNumber.toString(), recovery: 'Settlement recovered from chain. Delivery not yet verified.' }) });
          matched = true; break;
        }
        if (!matched) this.wallet.ledger.update(op.id, 'authorized', { detail: JSON.stringify({ ...detail, scannedThrough: end.toString() }) });
      }
      else if (!consumed && op.expires && op.expires < Number(snapshot.timestamp)) this.wallet.ledger.update(op.id, 'expired');
    }
  }
}
