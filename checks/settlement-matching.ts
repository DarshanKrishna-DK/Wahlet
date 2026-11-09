import assert from 'node:assert/strict';
import { settlementCall, matchesSettlement } from '../src/core/settlement.js';
import type { PaymentPayload } from '@x402/core/types';
const payload={payload:{signature:`0x${'11'.repeat(65)}`,permit2Authorization:{permitted:{token:'0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7',amount:'1000'},from:'0x1111111111111111111111111111111111111111',nonce:'42',deadline:'2000000000',witness:{to:'0x2222222222222222222222222222222222222222',validAfter:'1999999900'}}}} as unknown as PaymentPayload;
const original=settlementCall(payload);
assert.equal(matchesSettlement(original,payload),true);
assert.equal(matchesSettlement(`${original}1234`,payload),true);
for(const field of ['recipient','amount','nonce','deadline','signature']) {
 const changed=structuredClone(payload) as any;
 const authorization=changed.payload.permit2Authorization;
 if(field==='recipient')authorization.witness.to='0x3333333333333333333333333333333333333333';
 if(field==='amount')authorization.permitted.amount='2000';
 if(field==='nonce')authorization.nonce='43';
 if(field==='deadline')authorization.deadline='2000000001';
 if(field==='signature')changed.payload.signature=`0x${'22'.repeat(65)}`;
 assert.equal(matchesSettlement(settlementCall(changed),payload),false,`Changed ${field} must not match the saved authorization`);
}
assert.equal(matchesSettlement(`0x${BigInt(42).toString(16).padStart(64,'0')}`,payload),false);
console.log('PASS settlement matching rejects altered recipient, amount, nonce, deadline, signature, and nonce-only bytes; complete matching SDK calls allow attribution suffixes.');
