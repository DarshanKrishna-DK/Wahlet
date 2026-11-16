export function message(error: unknown): string {
  const source = error instanceof Error ? error.message : 'The operation failed';
  return source.replace(/https?:\/\/[^\s<>"']+/gi, '[endpoint]')
    .replace(/0x[0-9a-f]{64,}/gi, '[redacted signing data]')
    .replace(/(?:Bearer\s+|(?:password|token|secret|authorization|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '[redacted credential]')
    .split(/\n(?:Request|Details|Version|URL|Body|Raw|Data|Arguments|Contract Call)/i)[0].slice(0, 450);
}

export function failure(error: unknown) {
  const text = message(error);
  const code = /unlock|password|signer/i.test(text) ? 'WALLET_LOCKED'
    : /origin|private or reserved|HTTPS|redirect/i.test(text) ? 'RESOURCE_NOT_APPROVED'
    : /limit|budget|paused|capacity|ceiling/i.test(text) ? 'POLICY_REJECTED'
    : /allowance|Approve a bounded/i.test(text) ? 'ALLOWANCE_REQUIRED'
    : /chain|network|metadata/i.test(text) ? 'NETWORK_UNAVAILABLE'
    : /pending|unresolved|timeout|timed out|fetch failed|settlement/i.test(text) ? 'PAYMENT_UNCERTAIN'
    : /Operation ID|operation.*another|operation.*different/i.test(text) ? 'OPERATION_CONFLICT'
    : /balance|Insufficient/i.test(text) ? 'INSUFFICIENT_FUNDS' : 'REQUEST_REJECTED';
  return { code, message: text, retry: code === 'PAYMENT_UNCERTAIN' ? 'Inspect the receipt and retry with the same operation ID.' : 'Resolve the reported condition before retrying. Keep the same operation ID for an existing payment.' };
}
