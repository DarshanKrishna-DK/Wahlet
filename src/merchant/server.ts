import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createWalletClient, encodeFunctionData, http, keccak256, formatUnits, type Hex, type Address, type Abi } from 'viem';
import { ExactEvmScheme } from '@x402/evm/exact/facilitator';
import { toFacilitatorEvmSigner } from '@x402/evm';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { chain, USDT, rpcUrl, stateDir } from '../core/config.js';
import { publicClient, message } from '../core/wallet.js';
import { Vault } from '../core/vault.js';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { atomic } from '../core/amounts.js';
import { isDeepStrictEqual } from 'node:util';
import { resumeSettlement } from './recovery.js';

export function startMerchant(vault: Vault) {
  const db = new DatabaseSync(join(stateDir, 'merchant.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, raw TEXT, hash TEXT, proof TEXT, body TEXT); CREATE TABLE IF NOT EXISTS pending (id TEXT PRIMARY KEY, hash TEXT NOT NULL);');
  let serial: Promise<unknown> = Promise.resolve();
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
    if (req.headers.host !== '127.0.0.1:4021' || req.method !== 'GET' || !req.url || req.url.length > 2048) { res.writeHead(400).end(JSON.stringify({ error: 'Invalid request' })); return; }
    const task = async () => {
      if (req.url === '/health') { res.end(JSON.stringify({ product: 'Wahlet paid API', configured: vault.configured, unlocked: vault.unlocked, merchant: vault.address })); return; }
      if (req.url?.split('?')[0] !== '/premium/insight') { res.writeHead(404).end(JSON.stringify({ error: 'Resource not found' })); return; }
      if (!vault.address || !vault.unlocked) { res.writeHead(503).end(JSON.stringify({ error: 'Create and unlock the merchant wallet in the local console' })); return; }
      const resource = `http://127.0.0.1:4021${req.url}`;
      const requirements: PaymentRequirements = { scheme: 'exact', network: 'eip155:1874', amount: '1000', asset: USDT, payTo: vault.address, maxTimeoutSeconds: 120, extra: { assetTransferMethod: 'permit2' } };
      const challenge = { x402Version: 2, resource: { url: resource, description: 'A live Whitechain network insight with an onchain payment receipt', mimeType: 'application/json' }, accepts: [requirements] };
      const encoded = req.headers['payment-signature'];
      if (typeof encoded !== 'string') { res.setHeader('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(challenge)).toString('base64')); res.writeHead(402).end(JSON.stringify(challenge)); return; }
      if (encoded.length > 32000) throw new Error('Payment header exceeds the size limit');
      const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as PaymentPayload;
      if (payload.resource?.url !== resource || payload.x402Version !== 2 || !isDeepStrictEqual(payload.accepted, requirements)) throw new Error('Payment is not bound to this resource and price');
      const authorization = (payload.payload as { signature: string; permit2Authorization: { from: string; nonce: string } });
      const id = createHash('sha256').update(JSON.stringify({ from: authorization.permit2Authorization.from.toLowerCase(), nonce: authorization.permit2Authorization.nonce, signature: authorization.signature.toLowerCase() })).digest('hex');
      let entry = db.prepare('SELECT * FROM payments WHERE id=?').get(id) as { raw: Hex | null; hash: Hex | null; proof: string | null; body: string | null } | undefined;
      if (entry?.proof && entry.body) { res.setHeader('PAYMENT-RESPONSE', entry.proof); res.end(entry.body); return; }
      if (!entry) { db.prepare('INSERT INTO payments(id) VALUES(?)').run(id); entry = { raw: null, hash: null, proof: null, body: null }; }
      const account = vault.account(), wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
      const submit = async (to: Address, data: Hex) => {
        const old = db.prepare('SELECT raw,hash FROM payments WHERE id=?').get(id) as { raw: Hex | null; hash: Hex | null };
        if (old.raw && old.hash) { try { await publicClient.sendRawTransaction({ serializedTransaction: old.raw }); } catch { /* Reconcile the already persisted identical transaction. */ } return old.hash; }
        const unresolved = db.prepare('SELECT hash FROM payments WHERE hash IS NOT NULL AND proof IS NULL AND id != ?').all(id) as { hash: Hex }[];
        for (const prior of unresolved) {
          try { await publicClient.getTransactionReceipt({ hash: prior.hash }); }
          catch { throw new Error('A previous merchant transaction is unresolved. Retry its original request before starting another settlement'); }
        }
        if (await publicClient.getChainId() !== chain.id) throw new Error('Merchant RPC chain mismatch');
        const request = await wallet.prepareTransactionRequest({ account, to, data, chain });
        const fee = request.gas * (request.maxFeePerGas ?? request.gasPrice ?? 0n) + await publicClient.estimateL1Fee({ account, to, data });
        if (fee > atomic(process.env.WAHLET_MAX_GAS_WBT ?? '0.005', 'WBT')) throw new Error('Merchant gas ceiling exceeded');
        const raw = await wallet.signTransaction(request), hash = keccak256(raw);
        db.prepare('UPDATE payments SET raw=?,hash=? WHERE id=?').run(raw, hash, id);
        await publicClient.sendRawTransaction({ serializedTransaction: raw }); return hash;
      };
      const signer = toFacilitatorEvmSigner({
        address: account.address,
        readContract: args => publicClient.readContract(args as Parameters<typeof publicClient.readContract>[0]),
        verifyTypedData: args => publicClient.verifyTypedData(args as Parameters<typeof publicClient.verifyTypedData>[0]),
        getCode: args => publicClient.getCode(args),
        writeContract: args => submit(args.address, encodeFunctionData({ abi: args.abi as Abi, functionName: args.functionName, args: args.args })),
        sendTransaction: args => submit(args.to, args.data),
        waitForTransactionReceipt: async args => { const receipt = await publicClient.waitForTransactionReceipt({ hash: args.hash, timeout: 45000 }); return { status: receipt.status, logs: receipt.logs }; },
      });
      const facilitator = new ExactEvmScheme(signer, { pendingSettlementStore: { get: async key => (db.prepare('SELECT hash FROM pending WHERE id=?').get(key) as { hash: string } | undefined)?.hash, set: async (key, hash) => { db.prepare('INSERT INTO pending VALUES(?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash').run(key, hash); }, delete: async key => { db.prepare('DELETE FROM pending WHERE id=?').run(key); } } });
      let proof;
      if (entry.hash) { await resumeSettlement(publicClient, { raw: entry.raw, hash: entry.hash }); proof = { success: true, network: 'eip155:1874', transaction: entry.hash, payer: (payload.payload as { permit2Authorization: { from: string } }).permit2Authorization.from }; }
      else { const verification = await facilitator.verify(payload, requirements); if (!verification.isValid) throw new Error(`Payment verification failed: ${verification.invalidReason}`); proof = await facilitator.settle(payload, requirements); if (!proof.success) throw new Error(`Settlement pending or failed: ${proof.errorReason}`); }
      const block = await publicClient.getBlock();
      const body = JSON.stringify({ title: 'Whitechain network insight', chainId: chain.id, blockNumber: block.number.toString(), blockTime: new Date(Number(block.timestamp) * 1000).toISOString(), gasPriceGwei: formatUnits(await publicClient.getGasPrice(), 9), note: 'Live chain data delivered after USDT settlement', receipt: proof.transaction, merchant: account.address });
      const header = Buffer.from(JSON.stringify(proof)).toString('base64');
      db.prepare('UPDATE payments SET proof=?,body=? WHERE id=?').run(header, body, id);
      res.setHeader('PAYMENT-RESPONSE', header); res.end(body);
    };
    serial = serial.then(task, task).catch(error => { if (!res.headersSent) res.writeHead(400); if (!res.writableEnded) res.end(JSON.stringify({ error: message(error) })); });
  });
  server.listen(4021, '127.0.0.1');
  return server;
}
