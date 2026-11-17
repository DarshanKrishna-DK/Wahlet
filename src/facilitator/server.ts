import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { USDT } from '../core/config.js';
import { failure } from '../core/errors.js';
import { readBody } from '../core/http.js';
import type { FacilitatorProvider } from './service.js';

export function facilitatorServer(provider: FacilitatorProvider, token: string, address: () => string | null) {
  if (token.length < 32) throw new Error('Use a facilitator API credential with at least 32 characters');
  let requests = 0, windowStart = Date.now();
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.headers.origin) { res.writeHead(403).end(JSON.stringify({ error: 'Merchant server authentication required' })); return; }
      if (req.method === 'GET' && req.url === '/health') { res.end(JSON.stringify({ product: 'Wahlet facilitator', network: 'eip155:1874', release: 'developer-preview', mainnet: false })); return; }
      if (req.method === 'GET' && req.url === '/supported') { res.end(JSON.stringify({ kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:1874', extra: { assetTransferMethod: 'permit2', asset: USDT } }], extensions: [], signers: { 'eip155:1874': address() ? [address()] : [] } })); return; }
      const bearer = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
      if (Buffer.byteLength(bearer) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(bearer), Buffer.from(token))) { res.writeHead(401).end(JSON.stringify({ error: 'Invalid merchant credential' })); return; }
      if (Date.now() - windowStart >= 60000) { requests = 0; windowStart = Date.now(); }
      if (++requests > 120) { res.setHeader('Retry-After', '60'); res.writeHead(429).end(JSON.stringify({ error: 'Rate limit exceeded' })); return; }
      if (req.method !== 'POST' || !['/verify', '/settle'].includes(req.url ?? '')) { res.writeHead(404).end(JSON.stringify({ error: 'Unknown facilitator route' })); return; }
      const body = await readBody(req, 32000, 'Payment body exceeds the size limit');
      const input = z.object({ x402Version: z.literal(2).optional(), paymentPayload: z.object({}).passthrough(), paymentRequirements: z.object({}).passthrough() }).parse(JSON.parse(body));
      const payload = input.paymentPayload as unknown as PaymentPayload, requirements = input.paymentRequirements as unknown as PaymentRequirements;
      res.end(JSON.stringify(req.url === '/verify' ? await provider.verify(payload, requirements) : await provider.settle(payload, requirements)));
    } catch (error) { if (!res.headersSent) res.writeHead(400); res.end(JSON.stringify({ error: failure(error) })); }
  });
  server.requestTimeout = 75000; server.headersTimeout = 10000; server.maxConnections = 32;
  return server;
}
