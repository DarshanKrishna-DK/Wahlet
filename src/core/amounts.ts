import { formatUnits } from 'viem';
import { decimals, type Asset } from './config.js';

export function atomic(value: string, asset: Asset): bigint {
  const precision = decimals(asset);
  if (typeof value !== 'string' || !new RegExp(`^(?:0|[1-9][0-9]{0,30})(?:\\.[0-9]{1,${precision}})?$`).test(value)) throw new Error(`Enter a positive ${asset} amount with at most ${precision} decimal places`);
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, '0'));
  if (result <= 0n) throw new Error('Amount must be greater than zero');
  return result;
}
export const display = (value: bigint | string, asset: Asset) => formatUnits(BigInt(value), decimals(asset));
