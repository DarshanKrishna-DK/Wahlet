export function walletError(error: unknown, fallback: string): { message: string; reconnect: boolean } {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; message?: unknown } : {};
  if (value.code === 4100) return { message: 'Your browser wallet has not authorized this account for Wahlet. Reconnect the browser wallet, approve account access, then review funding again.', reconnect: true };
  if (value.code === 4001) return { message: 'You declined the wallet request. No new request will be sent automatically.', reconnect: false };
  if (value.code === -32002) return { message: 'A wallet request is already pending. Open your wallet extension to complete or reject it before trying again.', reconnect: false };
  return { message: typeof value.message === 'string' && value.message.trim() ? value.message : fallback, reconnect: false };
}
