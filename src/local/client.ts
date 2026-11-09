import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stateDir } from '../core/config.js';

export async function callDaemon(command: string, args: unknown = {}) {
  let connection: { url: string; token: string };
  try { connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8')); } catch { throw new Error('Start the Wahlet local daemon with npm start, then connect the MCP client'); }
  const url = new URL(connection.url);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') throw new Error('Invalid local daemon connection');
  const response = await fetch(`${url.origin}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` }, body: JSON.stringify({ command, args }), signal: AbortSignal.timeout(90000) });
  const result = await response.json() as { result?: unknown; error?: string };
  if (!response.ok || result.error) throw new Error(result.error ?? 'Local daemon failed');
  return result.result;
}
