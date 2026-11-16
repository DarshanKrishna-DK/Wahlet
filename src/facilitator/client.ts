import type { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from '@x402/core/types';
import type { FacilitatorProvider } from './service.js';

export function remoteFacilitator(url: string, token?: string): FacilitatorProvider {
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.protocol !== 'https:' && parsed.origin !== 'http://127.0.0.1:4022')) throw new Error('Use an HTTPS facilitator URL or the local facilitator on port 4022');
  async function request<T>(route: string, paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements): Promise<T> {
    const response = await fetch(parsed.href.replace(/\/$/, '') + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }), redirect: 'error', signal: AbortSignal.timeout(60000) });
    const reader = response.body?.getReader(), chunks: Uint8Array[] = []; let size = 0;
    if (reader) while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 64000) { await reader.cancel(); throw new Error('Facilitator response exceeds the size limit'); } chunks.push(part.value); }
    if (!response.ok) throw new Error(`Facilitator request failed with HTTP ${response.status}. Retry the original payment after resolving the provider status`);
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  }
  return { verify: (payload, requirements) => request<VerifyResponse>('/verify', payload, requirements), settle: (payload, requirements) => request<SettleResponse>('/settle', payload, requirements) };
}
