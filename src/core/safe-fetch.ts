import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { Agent, fetch } from 'undici';

const blocked = new BlockList();
for (const [ip, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['192.0.2.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(ip, bits, 'ipv4');

export function validateUrl(value: string, origins: string[]) {
  const url = new URL(value);
  if (url.username || url.password || url.hash) throw new Error('Resource URLs cannot contain credentials or fragments');
  if (!origins.includes(url.origin)) throw new Error('This resource origin is not approved in the owner policy');
  const demo = process.env.WAHLET_DEMO_LOCAL === 'true' && url.origin === 'http://127.0.0.1:4021';
  if (!demo && url.protocol !== 'https:') throw new Error('Paid requests require HTTPS');
  if (url.hostname.includes(':') || url.hostname.startsWith('[')) throw new Error('IPv6 literal resources are not supported');
  if (!demo && isIP(url.hostname) && blocked.check(url.hostname, 'ipv4')) throw new Error('Private or reserved network addresses are not allowed');
  return { url, demo };
}

export async function safeFetch(value: string, origins: string[], headers: Record<string, string> = {}) {
  const { url, demo } = validateUrl(value, origins);
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || (!demo && addresses.some(entry => blocked.check(entry.address, 'ipv4')))) throw new Error('The resource resolves to a private or reserved address');
  const agent = new Agent({ connect: { lookup: (_hostname, options, callback) => {
    if (options.all) callback(null, addresses); else callback(null, addresses[0].address, 4);
  } } });
  try {
    const response = await fetch(url, { dispatcher: agent, method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(60000) });
    if (response.status >= 300 && response.status < 400) throw new Error('Redirects are not followed for paid requests. Approve the final resource URL explicitly');
    const reader = response.body?.getReader(); let bytes = 0; const chunks: Uint8Array[] = [];
    if (reader) while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.byteLength; if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error('Resource response exceeds the 1 MiB limit'); } chunks.push(item.value); }
    return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body: Buffer.concat(chunks).toString('utf8') };
  } finally { await agent.close(); }
}
