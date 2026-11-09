import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer as createLockServer } from 'node:net';
import { z } from 'zod';
import { Ledger } from '../core/ledger.js';
import { Wallet, message } from '../core/wallet.js';
import { Payments } from '../core/payments.js';
import { Vault } from '../core/vault.js';
import { stateDir, projectRoot, port, chain, USDT } from '../core/config.js';
import { startMerchant } from '../merchant/server.js';

mkdirSync(stateDir, { recursive: true });
const canonicalState = realpathSync(stateDir);
const lockPort = 42000 + createHash('sha256').update(process.platform === 'win32' ? canonicalState.toLowerCase() : canonicalState).digest().readUInt16BE(0) % 20000;
const ownership = createLockServer(socket => socket.destroy());
await new Promise<void>((accept, reject) => { ownership.once('error', () => reject(new Error('This state directory is already owned, or its local ownership port is occupied. Close the other daemon before retrying.'))); ownership.listen({ host: '127.0.0.1', port: lockPort, exclusive: true }, accept); });
const ledger = new Ledger(), wallet = new Wallet(ledger), payments = new Payments(wallet), merchantVault = new Vault('merchant');
const ownerToken = randomBytes(32).toString('hex'), agentToken = randomBytes(32).toString('hex');
writeFileSync(join(stateDir, 'connection.json'), JSON.stringify({ url: `http://127.0.0.1:${port}`, token: agentToken }), { mode: 0o600 });
writeFileSync(join(stateDir, 'owner-link.json'), JSON.stringify({ url: `http://127.0.0.1:${port}/console#owner=${ownerToken}` }), { mode: 0o600 });
const validOrigin = (value: string) => [`http://127.0.0.1:${port}`, `http://localhost:${port}`, 'http://127.0.0.1:5173'].includes(value);
const equal = (value: string, expected: string) => value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
const operationId = z.string().uuid();
const amount = z.string().max(60);
const policySchema = z.object({ WBT: z.object({ perCall: amount, perDay: amount }), USDT: z.object({ perCall: amount, perDay: amount }), allowedOrigins: z.array(z.string().max(2048)).max(50), paused: z.boolean() });
const transferSchema = z.object({ id: operationId, asset: z.enum(['WBT', 'USDT']), amount, recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/) });
let unlockAttempts = 0, unlockWindow = Date.now();
async function state() { let balances: unknown, networkError: string | null = null; try { balances = await wallet.balances(); } catch (error) { networkError = message(error); balances = { address: wallet.vault.address, WBT: null, USDT: null }; } return { product: 'Wahlet', network: chain.name, chainId: chain.id, token: USDT, wallet: { configured: wallet.vault.configured, unlocked: wallet.vault.unlocked, address: wallet.vault.address }, merchant: { configured: merchantVault.configured, unlocked: merchantVault.unlocked, address: merchantVault.address, resource: 'http://127.0.0.1:4021/premium/insight' }, balances, networkError, ...ledger.report() }; }
async function command(name: string, args: unknown, owner: boolean) {
  if (['create_wallet', 'unlock', 'lock', 'create_merchant', 'unlock_merchant', 'policy', 'approve'].includes(name) && !owner) throw new Error('This operation requires the local owner console');
  switch (name) {
    case 'create_wallet': case 'unlock': case 'create_merchant': case 'unlock_merchant': {
      const input = z.object({ password: z.string().min(1).max(256) }).parse(args);
      if (Date.now() - unlockWindow > 60000) { unlockAttempts = 0; unlockWindow = Date.now(); } if (++unlockAttempts > 5) throw new Error('Too many unlock attempts. Wait one minute');
      const vault = name.includes('merchant') ? merchantVault : wallet.vault;
      if (name.startsWith('create')) vault.create(input.password); else vault.unlock(input.password);
      return { address: vault.address, unlocked: true };
    }
    case 'lock': wallet.vault.lock(); merchantVault.lock(); return { locked: true };
    case 'policy': ledger.savePolicy(policySchema.parse(args)); return ledger.report();
    case 'approve': { const input = z.object({ id: operationId, amount }).parse(args); return wallet.approve(input.amount, input.id); }
    case 'transfer': return wallet.transfer(transferSchema.parse(args));
    case 'balance': return wallet.balances();
    case 'spending_report': return ledger.report();
    case 'funding': return { chainId: 1874, agentAddress: wallet.vault.address, merchantAddress: merchantVault.address, faucet: 'https://faucet.testnet.whitechain.io', token: USDT, instructions: 'Claim test WBT, then check the faucet for official test USDT. Both identities need WBT; the agent also needs USDT. Tokens have no monetary value.' };
    case 'pay': { const input = z.object({ id: operationId, resource: z.string().url().max(2048), challenge: z.unknown() }).parse(args); return payments.authorize(input.id, input.challenge as Parameters<typeof payments.authorize>[1], input.resource); }
    case 'x402_fetch': { const input = z.object({ id: operationId, url: z.string().url().max(2048) }).parse(args); return payments.fetch(input.id, input.url); }
    case 'refresh': await wallet.serial(async () => { await wallet.reconcile(); await payments.reconcile(); }); return state();
    default: throw new Error('Unknown command');
  }
}
const webRoot = resolve(projectRoot, 'apps/web/dist');
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://rpc.testnet.whitechain.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host ?? '')) throw new Error('Invalid host');
    if (req.headers.origin && !validOrigin(req.headers.origin)) throw new Error('Untrusted origin');
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      const bearer = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const owner = equal(bearer, ownerToken);
      if (!owner && !equal(bearer, agentToken)) { res.writeHead(401).end(JSON.stringify({ error: 'Connect to the local daemon again' })); return; }
      if (url.pathname === '/api/state' && req.method === 'GET') { res.end(JSON.stringify(await state())); return; }
      if (url.pathname !== '/api/command' || req.method !== 'POST') { res.writeHead(404).end(JSON.stringify({ error: 'API route not found' })); return; }
      let body = ''; for await (const chunk of req) { body += chunk.toString(); if (Buffer.byteLength(body) > 64000) throw new Error('Command body exceeds the size limit'); }
      const input = z.object({ command: z.string(), args: z.unknown().optional() }).parse(JSON.parse(body));
      res.end(JSON.stringify({ result: await command(input.command, input.args ?? {}, owner) })); return;
    }
    if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405).end(); return; }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    let file = resolve(webRoot, relative || 'index.html');
    if (file !== webRoot && !file.startsWith(webRoot + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw new Error('Invalid path');
    if (!existsSync(file) || !extname(file)) file = join(webRoot, 'index.html');
    if (!existsSync(file)) { res.setHeader('Content-Type', 'text/plain'); res.writeHead(503).end('Build the website with npm run build, then open this page again.'); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
  } catch (error) { if (!res.headersSent) { res.setHeader('Content-Type', 'application/json'); res.writeHead(400); } res.end(JSON.stringify({ error: error instanceof z.ZodError ? 'Invalid command arguments' : message(error) })); }
});
server.requestTimeout = 90000;
server.headersTimeout = 15000;
server.listen(port, '127.0.0.1', () => process.stderr.write(`Wahlet local console: http://127.0.0.1:${port}/console\n`));
server.on('error', error => { process.stderr.write(message(error) + '\n'); process.exit(1); });
const merchant = startMerchant(merchantVault);
merchant.on('error', error => process.stderr.write('Paid API unavailable: ' + message(error) + '\n'));
void wallet.serial(async () => { try { await wallet.reconcile(); await payments.reconcile(); } catch (error) { process.stderr.write('Reconciliation pending: ' + message(error) + '\n'); } });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { wallet.vault.lock(); merchantVault.lock(); server.close(); merchant.close(); process.exit(0); });
