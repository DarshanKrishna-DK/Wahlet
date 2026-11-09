import { encodeFunctionData, getAddress, type Hex } from 'viem';
import { x402ExactPermit2ProxyABI } from '@x402/evm';
import type { PaymentPayload } from '@x402/core/types';

export function settlementCall(payload: PaymentPayload): Hex {
  const signed = payload.payload as { signature: Hex; permit2Authorization: { permitted: { token: string; amount: string }; from: string; nonce: string; deadline: string; witness: { to: string; validAfter: string } } };
  const permit = signed.permit2Authorization;
  return encodeFunctionData({ abi: x402ExactPermit2ProxyABI, functionName: 'settle', args: [
    { permitted: { token: getAddress(permit.permitted.token), amount: BigInt(permit.permitted.amount) }, nonce: BigInt(permit.nonce), deadline: BigInt(permit.deadline) },
    getAddress(permit.from), { to: getAddress(permit.witness.to), validAfter: BigInt(permit.witness.validAfter) }, signed.signature,
  ] });
}

export function matchesSettlement(input: Hex, payload: PaymentPayload) {
  // The SDK may append attribution bytes after the complete ABI-encoded call.
  return input.toLowerCase().startsWith(settlementCall(payload).toLowerCase());
}
