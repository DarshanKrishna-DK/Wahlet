import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { formatUnits, type Hex } from 'viem';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { chain, USDT, stateDir } from '../core/config.js';
import { publicClient, message } from '../core/wallet.js';
import { Vault } from '../core/vault.js';
import { openPrivateDatabase } from '../core/storage.js';
import { SettlementService } from '../facilitator/service.js';
import { remoteFacilitator } from '../facilitator/client.js';
import { resumeSettlement } from './recovery.js';

export function startMerchant(vault: Vault) {
  const db = openPrivateDatabase(join(stateDir, 'merchant.sqlite'));
  // Preserve legacy settlement rows so upgrades can recover earlier requests.
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, raw TEXT, hash TEXT, proof TEXT, body TEXT);');
  const provider = process.env.WAHLET_FACILITATOR_URL ? remoteFacilitator(process.env.WAHLET_FACILITATOR_URL, process.env.WAHLET_FACILITATOR_API_KEY) : new SettlementService(vault, () => vault.address ? [vault.address] : []);
  let serial: Promise<unknown> = Promise.resolve();
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
    if (req.headers.host !== '127.0.0.1:4021' || req.method !== 'GET' || !req.url || req.url.length > 2048) { res.writeHead(400).end(JSON.stringify({ error: 'Invalid request' })); return; }
    const task = async () => {
      if (req.url === '/health') { res.end(JSON.stringify({ product: 'Wahlet sample paid API', scope: 'developer-preview', configured: vault.configured, unlocked: vault.unlocked, merchant: vault.address, facilitator: process.env.WAHLET_FACILITATOR_URL ? 'remote' : 'embedded' })); return; }
      if (req.url?.split('?')[0] !== '/premium/insight') { res.writeHead(404).end(JSON.stringify({ error: 'Resource not found' })); return; }
      if (!vault.address) { res.writeHead(503).end(JSON.stringify({ error: 'Configure the sample merchant in the local console' })); return; }
      const resource = `http://127.0.0.1:4021${req.url}`;
      const requirements: PaymentRequirements = { scheme: 'exact', network: 'eip155:1874', amount: '1000', asset: USDT, payTo: vault.address, maxTimeoutSeconds: 120, extra: { assetTransferMethod: 'permit2' } };
      const challenge = { x402Version: 2, resource: { url: resource, description: 'Live Whitechain insight from the included sample merchant', mimeType: 'application/json' }, accepts: [requirements] };
      const encoded = req.headers['payment-signature'];
      if (typeof encoded !== 'string') { res.setHeader('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(challenge)).toString('base64')); res.writeHead(402).end(JSON.stringify(challenge)); return; }
      if (encoded.length > 32000) throw new Error('Payment header exceeds the size limit');
      const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as PaymentPayload;
      if (payload.resource?.url !== resource || payload.x402Version !== 2 || !isDeepStrictEqual(payload.accepted, requirements)) throw new Error('Payment is not bound to this resource and price');
      const authorization = payload.payload as { signature: string; permit2Authorization: { from: string; nonce: string } };
      const id = createHash('sha256').update(JSON.stringify({ from: authorization.permit2Authorization.from.toLowerCase(), nonce: authorization.permit2Authorization.nonce, signature: authorization.signature.toLowerCase() })).digest('hex');
      const entry = db.prepare('SELECT * FROM payments WHERE id=?').get(id) as { raw: Hex | null; hash: Hex | null; proof: string | null; body: string | null } | undefined;
      if (entry?.proof && entry.body) { res.setHeader('PAYMENT-RESPONSE', entry.proof); res.end(entry.body); return; }
      let proof;
      if (entry?.proof) proof = JSON.parse(Buffer.from(entry.proof, 'base64').toString('utf8'));
      else if (entry?.hash) { await resumeSettlement(publicClient, { raw: entry.raw, hash: entry.hash }); proof = { success: true, network: 'eip155:1874', transaction: entry.hash, payer: authorization.permit2Authorization.from }; }
      else { proof = await provider.settle(payload, requirements); if (!proof.success) throw new Error(`Settlement pending or failed: ${proof.errorReason}`); }
      const header = Buffer.from(JSON.stringify(proof)).toString('base64');
      db.prepare('INSERT INTO payments(id,hash,proof) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,proof=excluded.proof').run(id, proof.transaction, header);
      res.setHeader('PAYMENT-RESPONSE', header);
      const block = await publicClient.getBlock();
      const body = JSON.stringify({ title: 'Whitechain network insight', chainId: chain.id, blockNumber: block.number.toString(), blockTime: new Date(Number(block.timestamp) * 1000).toISOString(), gasPriceGwei: formatUnits(await publicClient.getGasPrice(), 9), note: 'Live chain data delivered after USDT settlement', receipt: proof.transaction, merchant: vault.address });
      db.prepare('INSERT INTO payments(id,hash,proof,body) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,proof=excluded.proof,body=excluded.body').run(id, proof.transaction, header, body);
      res.setHeader('PAYMENT-RESPONSE', header); res.end(body);
    };
    serial = serial.then(task, task).catch(error => { if (!res.headersSent) res.writeHead(400); if (!res.writableEnded) res.end(JSON.stringify({ error: message(error) })); });
  });
  server.requestTimeout = 75000; server.headersTimeout = 10000;
  server.listen(4021, '127.0.0.1'); return server;
}
