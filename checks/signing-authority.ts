import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { Ledger } from '../src/core/ledger.js';

const directory = mkdtempSync(join(tmpdir(), 'wahlet-signing-'));
const ledger = new Ledger(directory);
const initial = { WBT: { perCall: '0.01', perDay: '0.05' }, USDT: { perCall: '0.1', perDay: '0.2' }, allowedOrigins: ['https://example.com'], paused: false };
try {
  ledger.savePolicy(initial);
  const operation = ledger.reserve({ id: randomUUID(), fingerprint: 'reserved-before-network-delay', asset: 'USDT', amount: 100000n, recipient: 'merchant', kind: 'x402' });
  ledger.assertSigningAllowed(operation);
  ledger.savePolicy({ ...initial, paused: true });
  assert.throws(() => ledger.assertSigningAllowed(operation), /paused/);
  ledger.savePolicy({ ...initial, USDT: { perCall: '0.05', perDay: '0.2' } });
  assert.throws(() => ledger.assertSigningAllowed(operation), /current per-payment limit/);
  ledger.savePolicy(initial);
  ledger.reserve({ id: randomUUID(), fingerprint: 'second', asset: 'USDT', amount: 100000n, recipient: 'merchant', kind: 'x402' });
  ledger.savePolicy({ ...initial, USDT: { perCall: '0.1', perDay: '0.1' } });
  assert.throws(() => ledger.assertSigningAllowed(operation), /current daily capacity/);
  ledger.savePolicy(initial);
  const approval = ledger.reserve({ id: randomUUID(), fingerprint: 'approval', asset: 'WBT', amount: 0n, recipient: 'permit2', kind: 'approval' });
  ledger.savePolicy({ ...initial, paused: true });
  assert.throws(() => ledger.assertSigningAllowed(approval), /paused/);
  ledger.assertSigningAllowed(approval, true);
  ledger.update(operation.id, 'failed');
  assert.throws(() => ledger.assertSigningAllowed(operation), /no longer awaiting/);
  console.log('PASS signing rechecks owner pause, reduced payment/daily limits, stale reservation state, and paused allowance revocation.');
} finally {
  ledger.db.close();
  rmSync(directory, { recursive: true, force: true });
}
