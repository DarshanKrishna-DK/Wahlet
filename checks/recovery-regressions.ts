import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Ledger } from '../src/core/ledger.js';
import { Payments } from '../src/core/payments.js';
import { publicClient } from '../src/core/wallet.js';
import type { Wallet } from '../src/core/wallet.js';
import { USDT } from '../src/core/config.js';

const directory=mkdtempSync(join(tmpdir(),'wahlet-recovery-'));
const ledger=new Ledger(directory);
const account='0x1111111111111111111111111111111111111111';
const fakeWallet={ledger,serial:async(action:()=>Promise<unknown>)=>action()} as Wallet;
const payments=new Payments(fakeWallet);
try {
 ledger.savePolicy({WBT:{perCall:'0.01',perDay:'0.05'},USDT:{perCall:'0.1',perDay:'2'},allowedOrigins:['https://example.com'],paused:false});
 const challenge={x402Version:2,resource:{url:'https://example.com/data'},accepts:[{scheme:'exact',network:'eip155:1874',asset:USDT,amount:'1000',payTo:account,maxTimeoutSeconds:'120',extra:{assetTransferMethod:'permit2'}}]};
 await assert.rejects(payments.authorize(randomUUID(),challenge as never,challenge.resource.url),/Invalid payment amount or authorization duration/);
 console.log('PASS string authorization duration rejected before signer access');
 const id=randomUUID();
 ledger.reserve({id,fingerprint:'expiry',asset:'USDT',amount:1000n,recipient:account,kind:'x402'});
 ledger.update(id,'authorized',{expires:10,detail:JSON.stringify({permitNonce:'1',from:account,authorizedBlock:'5'})});
 const originalBlock=publicClient.getBlock, originalRead=publicClient.readContract;
 let blocks=0;
 Object.assign(publicClient,{getBlock:async()=>{blocks++;return {number:10n,timestamp:11n};},readContract:async(args:{blockNumber?:bigint})=>{assert.equal(args.blockNumber,10n,'Nonce bitmap must use the same block as the expiry timestamp');return 0n;}});
 try {await payments.reconcile();assert.equal(blocks,1);assert.equal(ledger.get(id)?.state,'expired');console.log('PASS expiry uses one pinned chain snapshot');} finally {Object.assign(publicClient,{getBlock:originalBlock,readContract:originalRead});}
 const completed=randomUUID();
 ledger.reserve({id:completed,fingerprint:'completed',asset:'USDT',amount:1000n,recipient:account,kind:'x402'});
 ledger.update(completed,'delivered');ledger.update(completed,'authorized');assert.equal(ledger.get(completed)?.state,'delivered');
 console.log('PASS stale reconciliation cannot downgrade delivered payment');
 console.log('3 review regressions passed without network or signing.');
} finally {ledger.db.close();rmSync(directory,{recursive:true,force:true});}
