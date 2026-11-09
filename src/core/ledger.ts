import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { atomic, display } from './amounts.js';
import { stateDir, type Asset } from './config.js';

export type OperationState = 'reserved' | 'authorized' | 'submitted' | 'confirmed' | 'delivered' | 'failed' | 'expired';
export type Operation = { id: string; fingerprint: string; asset: Asset; amount: string; recipient: string; kind: string; state: OperationState; created: string; settled: string | null; hash: string | null; raw: string | null; expires: number | null; detail: string; error: string | null };
export type Policy = { WBT: { perCall: string; perDay: string }; USDT: { perCall: string; perDay: string }; allowedOrigins: string[]; paused: boolean };

export class Ledger {
  readonly db: DatabaseSync;
  constructor(directory = stateDir) {
    mkdirSync(directory, { recursive: true });
    this.db = new DatabaseSync(join(directory, 'wahlet.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, asset TEXT NOT NULL, amount TEXT NOT NULL, recipient TEXT NOT NULL, kind TEXT NOT NULL, state TEXT NOT NULL, created TEXT NOT NULL, settled TEXT, hash TEXT, raw TEXT, expires INTEGER, detail TEXT NOT NULL DEFAULT '{}', error TEXT);
      CREATE INDEX IF NOT EXISTS operations_state ON operations(state);`);
  }
  policy(): Policy {
    const saved = this.db.prepare("SELECT value FROM settings WHERE key='policy'").get() as { value: string } | undefined;
    return saved ? JSON.parse(saved.value) : { WBT: { perCall: process.env.WAHLET_MAX_WBT_CALL ?? '0.01', perDay: process.env.WAHLET_MAX_WBT_DAY ?? '0.05' }, USDT: { perCall: process.env.WAHLET_MAX_USDT_CALL ?? '0.10', perDay: process.env.WAHLET_MAX_USDT_DAY ?? '2.00' }, allowedOrigins: (process.env.WAHLET_ALLOWED_ORIGINS ?? 'http://127.0.0.1:4021').split(',').filter(Boolean), paused: false };
  }
  savePolicy(policy: Policy) {
    for (const asset of ['WBT', 'USDT'] as const) if (atomic(policy[asset].perCall, asset) > atomic(policy[asset].perDay, asset)) throw new Error('Per-payment limit cannot exceed the daily limit');
    for (const origin of policy.allowedOrigins) { const u = new URL(origin); if (u.origin !== origin || !['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error('Use exact HTTP origins without paths or credentials'); }
    this.db.prepare("INSERT INTO settings VALUES('policy', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(policy));
  }
  get(id: string): Operation | undefined { return this.db.prepare('SELECT * FROM operations WHERE id=?').get(id) as Operation | undefined; }
  all(): Operation[] { return this.db.prepare('SELECT * FROM operations ORDER BY created DESC LIMIT 250').all() as Operation[]; }
  pending(): Operation[] { return this.db.prepare("SELECT * FROM operations WHERE state IN ('reserved','authorized','submitted')").all() as Operation[]; }
  usage(asset: Asset, now = new Date()): { settled: bigint; committed: bigint } {
    const day = now.toISOString().slice(0, 10);
    const rows = this.db.prepare('SELECT amount,state,settled FROM operations WHERE asset=?').all(asset) as Pick<Operation, 'amount' | 'state' | 'settled'>[];
    return rows.reduce((sum, row) => { if (['reserved', 'authorized', 'submitted'].includes(row.state)) sum.committed += BigInt(row.amount); else if (['confirmed', 'delivered'].includes(row.state) && row.settled?.startsWith(day)) sum.settled += BigInt(row.amount); return sum; }, { settled: 0n, committed: 0n });
  }
  reserve(input: { id: string; fingerprint: string; asset: Asset; amount: bigint; recipient: string; kind: string }): Operation {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.get(input.id);
      if (existing) { if (existing.fingerprint !== input.fingerprint) throw new Error('Operation ID already belongs to a different payment'); this.db.exec('COMMIT'); return existing; }
      const policy = this.policy();
      const approval = input.kind === 'approval' && input.amount === 0n;
      if (policy.paused && !approval) throw new Error('Payments are paused by the owner');
      if (!approval && (input.amount <= 0n || input.amount > atomic(policy[input.asset].perCall, input.asset))) throw new Error('Payment exceeds the per-payment limit');
      const usage = this.usage(input.asset);
      if (usage.settled + usage.committed + input.amount > atomic(policy[input.asset].perDay, input.asset)) throw new Error('Payment exceeds remaining daily capacity');
      this.db.prepare("INSERT INTO operations(id,fingerprint,asset,amount,recipient,kind,state,created) VALUES(?,?,?,?,?,?,'reserved',?)").run(input.id, input.fingerprint, input.asset, input.amount.toString(), input.recipient, input.kind, new Date().toISOString());
      this.db.exec('COMMIT');
      return this.get(input.id)!;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  update(id: string, state: OperationState, fields: Partial<Pick<Operation, 'hash' | 'raw' | 'expires' | 'detail' | 'error'>> = {}) {
    const op = this.get(id); if (!op) throw new Error('Unknown operation');
    if (op.state === 'delivered' || (op.state === 'confirmed' && state !== 'delivered')) return;
    const settled = ['confirmed', 'delivered'].includes(state) ? op.settled ?? new Date().toISOString() : op.settled;
    this.db.prepare('UPDATE operations SET state=?,settled=?,hash=?,raw=?,expires=?,detail=?,error=? WHERE id=?').run(state, settled, fields.hash ?? op.hash, fields.raw ?? op.raw, fields.expires ?? op.expires, fields.detail ?? op.detail, fields.error ?? op.error, id);
  }
  report() {
    return { policy: this.policy(), usage: Object.fromEntries((['WBT', 'USDT'] as const).map(asset => { const usage = this.usage(asset); const remaining = atomic(this.policy()[asset].perDay, asset) - usage.settled - usage.committed; return [asset, { settled: display(usage.settled, asset), committed: display(usage.committed, asset), remaining: display(remaining > 0n ? remaining : 0n, asset) }]; })), operations: this.all().map(({ raw, detail, ...op }) => ({ ...op, amount: display(op.amount, op.asset), detail: JSON.parse(detail) })) };
  }
}
