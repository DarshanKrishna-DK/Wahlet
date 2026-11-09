import assert from 'node:assert/strict';
import {publicClient} from '../src/core/wallet.js';
import {chain} from '../src/core/config.js';
const address=chain.contracts.gasPriceOracle.address;
assert.ok((await publicClient.getCode({address}))?.length>2,'Whitechain gas oracle must be deployed');
const fee=await publicClient.estimateL1Fee({account:'0x37DCdd0923a979140396754A16c538Ed9A1C0109',to:'0x4c180929dF49B7dEcb316221F3Be959b070E1a5B',value:10000000000000000n});
assert.ok(fee>=0n);console.log(JSON.stringify({oracle:address,estimatedL1FeeWei:fee.toString(),scope:'Read-only fee estimate. No transaction submitted.'}));
