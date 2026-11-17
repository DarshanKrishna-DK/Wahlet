import type { IncomingMessage } from 'node:http';

/** Read a request body as UTF-8 text, rejecting it once it exceeds the byte limit. */
export async function readBody(req: IncomingMessage, limit: number, tooLarge: string) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).byteLength;
    if (size > limit) throw new Error(tooLarge);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
