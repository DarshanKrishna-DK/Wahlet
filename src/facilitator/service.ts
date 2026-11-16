import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { createWalletClient, encodeFunctionData, getAddress, http, keccak256, erc20Abi, type Address, type Hex, type Abi } from 'viem';
import { ExactEvmScheme } from '@x402/evm/exact/facilitator';
import { toFacilitatorEvmSigner } from '@x402/evm';
import type { PaymentPayload, PaymentRequirements, SettleResponse } from '@x402/core/types';
import { chain, USDT, rpcUrl, stateDir } from '../core/config.js';
import { publicClient } from '../core/wallet.js';
import { Vault } from '../core/vault.js';
import { atomic } from '../core/amounts.js';
import { resumeSettlement } from '../merchant/recovery.js';
import { openPrivateDatabase } from '../core/storage.js';

export interface FacilitatorProvider {
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}

export function validatePayment(payload: PaymentPayload, requirements: PaymentRequirements, recipients: string[]) {
  if (payload.x402Version !== 2 || !isDeepStrictEqual(payload.accepted, requirements)) throw new Error('Payment offer does not match the signed requirements');
  if (Object.keys(payload.extensions ?? {}).length || Object.keys(requirements.extra ?? {}).some(key => key !== 'assetTransferMethod')) throw new Error('Payment extensions are not supported by this facilitator');
  if (requirements.scheme !== 'exact' || requirements.network !== 'eip155:1874' || getAddress(requirements.asset) !== USDT || requirements.extra?.assetTransferMethod !== 'permit2') throw new Error('Only Whitechain Sepolia official USDT exact Permit2 is supported');
  if (!/^[1-9][0-9]{0,30}$/.test(requirements.amount) || BigInt(requirements.amount) > atomic(process.env.WAHLET_FACILITATOR_MAX_USDT ?? '2', 'USDT')) throw new Error('Facilitator payment limit exceeded');
  if (!Number.isInteger(requirements.maxTimeoutSeconds) || requirements.maxTimeoutSeconds < 1 || requirements.maxTimeoutSeconds > 300) throw new Error('Invalid authorization duration');
  const recipient = getAddress(requirements.payTo);
  if (!recipients.some(item => getAddress(item) === recipient) || /^0x0{40}$/i.test(recipient)) throw new Error('Merchant recipient is not registered with this facilitator');
  const auth = (payload.payload as { signature?: string; permit2Authorization?: { from?: string; nonce?: string } })?.permit2Authorization;
  if (!auth?.from || !auth.nonce || !/^[0-9]{1,78}$/.test(auth.nonce)) throw new Error('Invalid Permit2 authorization');
  const payer = getAddress(auth.from);
  if (payer === recipient) throw new Error('Payer and merchant must be distinct');
  return { payer, id: createHash('sha256').update(`${chain.id}:${payer.toLowerCase()}:${BigInt(auth.nonce)}`).digest('hex') };
}

export class SettlementService implements FacilitatorProvider {
  readonly db: DatabaseSync;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly vault: Vault, readonly recipients: () => string[], directory = stateDir) {
    this.db = openPrivateDatabase(join(directory, 'facilitator.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS settlements(id TEXT PRIMARY KEY, binding TEXT NOT NULL, raw TEXT, hash TEXT, proof TEXT, gas TEXT, day TEXT); CREATE TABLE IF NOT EXISTS pending(id TEXT PRIMARY KEY, hash TEXT NOT NULL)');
  }
  private serial<T>(action: () => Promise<T>) { const next = this.queue.then(action, action); this.queue = next.catch(() => {}); return next; }
  private async network() {
    if (await publicClient.getChainId() !== chain.id) throw new Error('Facilitator RPC chain mismatch');
    if (await publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: 'decimals' }) !== 6) throw new Error('Facilitator token metadata mismatch');
  }
  private scheme(id: string) {
    const account = this.vault.account(), wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
    const submit = async (to: Address, data: Hex) => {
      const old = this.db.prepare('SELECT raw,hash FROM settlements WHERE id=?').get(id) as { raw: Hex | null; hash: Hex | null };
      if (old.hash) { await resumeSettlement(publicClient, { raw: old.raw, hash: old.hash }); return old.hash; }
      const unresolved = this.db.prepare('SELECT hash FROM settlements WHERE hash IS NOT NULL AND proof IS NULL AND id != ?').all(id) as { hash: Hex }[];
      for (const prior of unresolved) { try { await publicClient.getTransactionReceipt({ hash: prior.hash }); } catch { throw new Error('Previous facilitator settlement is unresolved. Retry its original request'); } }
      await this.network();
      const request = await wallet.prepareTransactionRequest({ account, to, data, chain });
      const fee = request.gas * (request.maxFeePerGas ?? request.gasPrice ?? 0n) + await publicClient.estimateL1Fee({ account, to, data });
      if (fee > atomic(process.env.WAHLET_MAX_GAS_WBT ?? '0.005', 'WBT')) throw new Error('Facilitator gas ceiling exceeded');
      const day = new Date().toISOString().slice(0, 10);
      const spent = (this.db.prepare('SELECT gas FROM settlements WHERE day=?').all(day) as { gas: string }[]).reduce((sum, row) => sum + BigInt(row.gas ?? '0'), 0n);
      if (spent + fee > atomic(process.env.WAHLET_FACILITATOR_GAS_DAY_WBT ?? '0.05', 'WBT')) throw new Error('Facilitator daily gas budget exceeded');
      const raw = await wallet.signTransaction(request), hash = keccak256(raw);
      this.db.prepare('UPDATE settlements SET raw=?,hash=?,gas=?,day=? WHERE id=?').run(raw, hash, fee.toString(), day, id);
      await publicClient.sendRawTransaction({ serializedTransaction: raw }); return hash;
    };
    return new ExactEvmScheme(toFacilitatorEvmSigner({
      address: account.address,
      readContract: args => publicClient.readContract(args as Parameters<typeof publicClient.readContract>[0]),
      verifyTypedData: args => publicClient.verifyTypedData(args as Parameters<typeof publicClient.verifyTypedData>[0]),
      getCode: args => publicClient.getCode(args),
      writeContract: args => submit(args.address, encodeFunctionData({ abi: args.abi as Abi, functionName: args.functionName, args: args.args })),
      sendTransaction: args => submit(args.to, args.data),
      waitForTransactionReceipt: async args => { const receipt = await publicClient.waitForTransactionReceipt({ hash: args.hash, timeout: 45000 }); return { status: receipt.status, logs: receipt.logs }; },
    }), { pendingSettlementStore: {
      get: async key => (this.db.prepare('SELECT hash FROM pending WHERE id=?').get(key) as { hash: string } | undefined)?.hash,
      set: async (key, hash) => { this.db.prepare('INSERT INTO pending VALUES(?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash').run(key, hash); },
      delete: async key => { this.db.prepare('DELETE FROM pending WHERE id=?').run(key); },
    } });
  }
  async verify(payload: PaymentPayload, requirements: PaymentRequirements) {
    const { id } = validatePayment(payload, requirements, this.recipients());
    await this.network();
    return this.scheme(id).verify(payload, requirements);
  }
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    return this.serial(async () => {
      const { id, payer } = validatePayment(payload, requirements, this.recipients());
      // Equality binds a nonce to the original authorization, including recipient and resource.
      const binding = JSON.stringify({ payload, requirements });
      const entry = this.db.prepare('SELECT * FROM settlements WHERE id=?').get(id) as { binding: string; proof: string | null; raw: Hex | null; hash: Hex | null } | undefined;
      if (entry && !isDeepStrictEqual(JSON.parse(entry.binding), JSON.parse(binding))) throw new Error('Authorization nonce belongs to a different payment');
      if (entry?.proof) return JSON.parse(entry.proof) as SettleResponse;
      await this.network();
      let proof: SettleResponse;
      if (entry?.hash) { await resumeSettlement(publicClient, { raw: entry.raw, hash: entry.hash }); proof = { success: true, network: 'eip155:1874', transaction: entry.hash, payer }; }
      else {
        const scheme = this.scheme(id), verified = await scheme.verify(payload, requirements);
        if (!verified.isValid) return { success: false, network: 'eip155:1874', transaction: '', errorReason: verified.invalidReason ?? 'invalid_payment', payer };
        if (!entry) this.db.prepare('INSERT INTO settlements(id,binding) VALUES(?,?)').run(id, binding);
        proof = await scheme.settle(payload, requirements);
      }
      if (proof.success) this.db.prepare('UPDATE settlements SET proof=? WHERE id=?').run(JSON.stringify(proof), id);
      return proof;
    });
  }
}
