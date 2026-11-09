import assert from 'node:assert/strict';
import { resumeSettlement } from '../src/merchant/recovery.js';
const hash='0x1234' as const, raw='0xabcd' as const;
let broadcast=false;
const receipt=await resumeSettlement({
 sendRawTransaction:async args=>{assert.equal(args.serializedTransaction,raw);broadcast=true;return hash;},
 waitForTransactionReceipt:async args=>{assert.ok(broadcast,'A persisted-but-unbroadcast settlement must be rebroadcast before waiting');assert.equal(args.hash,hash);return {status:'success'};},
},{raw,hash});
assert.equal(receipt.status,'success');
await assert.rejects(resumeSettlement({sendRawTransaction:async()=>{throw new Error('already known');},waitForTransactionReceipt:async()=>({status:'reverted'})},{raw,hash}),/reverted/);
console.log('PASS merchant crash-window recovery rebroadcasts identical bytes and rejects reverted receipts');
