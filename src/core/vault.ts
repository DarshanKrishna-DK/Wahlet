import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { stateDir } from './config.js';
import type { Hex } from 'viem';

export class Vault {
  private key: Hex | undefined;
  private readonly file: string;
  private readonly identityFile: string;
  constructor(role: 'agent' | 'merchant' = 'agent') {
    this.file = join(stateDir, `${role}.vault.json`);
    this.identityFile = join(stateDir, `${role}.identity.json`);
    const variable = role === 'agent' ? 'WAHLET_PRIVATE_KEY' : 'WAHLET_MERCHANT_PRIVATE_KEY';
    if (process.env[variable]) {
      const value = process.env[variable] as Hex;
      const address = privateKeyToAccount(value).address;
      delete process.env[variable];
      const prior = this.address;
      if (prior && prior !== address) throw new Error('Signer identity differs from this state directory. Use a separate state directory for a different signer');
      this.key = value;
      if (!existsSync(this.identityFile)) writeFileSync(this.identityFile, JSON.stringify({ address }), { mode: 0o600, flag: 'wx' });
    }
  }
  get configured() { return !!this.key || existsSync(this.file) || existsSync(this.identityFile); }
  get unlocked() { return !!this.key; }
  get address(): string | null { return this.key ? privateKeyToAccount(this.key).address : existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')).address : existsSync(this.identityFile) ? JSON.parse(readFileSync(this.identityFile, 'utf8')).address : null; }
  account() { if (!this.key) throw new Error('Unlock the dedicated agent wallet in the local console'); return privateKeyToAccount(this.key); }
  create(password: string) {
    if (this.configured) throw new Error('An agent wallet already exists');
    if (password.length < 12 || password.length > 256) throw new Error('Use a password between 12 and 256 characters');
    const key = generatePrivateKey(), salt = randomBytes(32), iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv);
    const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
    writeFileSync(this.file, JSON.stringify({ version: 1, address: privateKeyToAccount(key).address, salt: salt.toString('hex'), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('hex') }), { mode: 0o600, flag: 'wx' });
    this.key = key;
  }
  unlock(password: string) {
    if (!existsSync(this.file) && existsSync(this.identityFile)) throw new Error('This signer was supplied through the environment. Restart the daemon with the same signer to unlock it');
    try { const data = JSON.parse(readFileSync(this.file, 'utf8')); const cipher = createDecipheriv('aes-256-gcm', scryptSync(password, Buffer.from(data.salt, 'hex'), 32), Buffer.from(data.iv, 'hex')); cipher.setAuthTag(Buffer.from(data.tag, 'hex')); const key = Buffer.concat([cipher.update(Buffer.from(data.ciphertext, 'hex')), cipher.final()]).toString('utf8') as Hex; if (privateKeyToAccount(key).address !== data.address) throw new Error(); this.key = key; } catch { throw new Error('Unable to unlock this wallet. Check the password and vault file.'); }
  }
  lock() { this.key = undefined; }
}
