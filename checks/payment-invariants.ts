import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Ledger } from '../src/core/ledger.js';
import { atomic } from '../src/core/amounts.js';
import { validateUrl } from '../src/core/safe-fetch.js';

const directory = mkdtempSync(join(tmpdir(), 'wahlet-invariants-'));
const ledger = new Ledger(directory);
let checks = 0;
function check(name: string, action: ()=>void) { action(); checks++; process.stdout.write(`PASS ${name}\n`); }
try {
 ledger.savePolicy({WBT:{perCall:'0.01',perDay:'0.02'},USDT:{perCall:'0.1',perDay:'0.2'},allowedOrigins:['https://example.com'],paused:false});
 check('amount precision is exact and excess precision fails',()=>{assert.equal(atomic('0.000001','USDT'),1n);assert.equal(atomic('0.000000000000000001','WBT'),1n);for(const amount of ['0.0000001','1e-6','-1','NaN','0','01']) assert.throws(()=>atomic(amount,'USDT'));});
 const id=randomUUID();
 const input={id,fingerprint:'same',asset:'USDT' as const,amount:100000n,recipient:'recipient',kind:'transfer'};
 check('same ID reserves only once and cannot be rebound',()=>{ledger.reserve(input);ledger.reserve(input);assert.equal(ledger.usage('USDT').committed,100000n);assert.throws(()=>ledger.reserve({...input,fingerprint:'different'}));});
 check('outstanding authorizations survive midnight',()=>{ledger.update(id,'authorized');ledger.db.prepare('UPDATE operations SET created=? WHERE id=?').run('2000-01-01T00:00:00.000Z',id);assert.equal(ledger.usage('USDT',new Date('2030-01-01')).committed,100000n);});
 check('a second database connection cannot bypass the aggregate cap',()=>{const second=new Ledger(directory);try{second.reserve({...input,id:randomUUID(),fingerprint:'second'});assert.throws(()=>ledger.reserve({...input,id:randomUUID(),fingerprint:'third',amount:1n}));assert.equal(second.usage('USDT').committed,200000n);}finally{second.db.close();}});
 check('failed reservations release capacity',()=>{ledger.update(id,'failed');assert.equal(ledger.usage('USDT').committed,100000n);});
 check('current settlements count and old settlements do not',()=>{ledger.update(id,'confirmed');assert.equal(ledger.usage('USDT').settled,100000n);assert.equal(ledger.usage('USDT',new Date('2030-01-01')).settled,0n);});
 check('pause blocks new payments',()=>{ledger.savePolicy({...ledger.policy(),paused:true});assert.throws(()=>ledger.reserve({...input,id:randomUUID(),fingerprint:'paused',amount:1n}));});
 check('approval bookkeeping does not invent token transfers',()=>{ledger.reserve({...input,id:randomUUID(),fingerprint:'revoke',asset:'WBT',kind:'approval',amount:0n});assert.equal(ledger.usage('WBT').committed,0n);});
 check('URL policy blocks private literals, credentials, fragments, and unapproved origins',()=>{for(const url of ['https://127.0.0.1','https://169.254.169.254','https://[::1]','https://user:pass@example.com','https://example.com/#fragment']) assert.throws(()=>validateUrl(url,[new URL(url).origin]));assert.throws(()=>validateUrl('https://other.example',['https://example.com']));assert.equal(validateUrl('https://example.com/path',['https://example.com']).url.pathname,'/path');});
 process.stdout.write(`${checks} focused checks passed. No network or payment was executed.\n`);
} finally {ledger.db.close();rmSync(directory,{recursive:true,force:true});}
