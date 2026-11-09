import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineChain, getAddress } from 'viem';
import { chainConfig } from 'viem/op-stack';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
config({ path: resolve(projectRoot, '.env'), quiet: true });

export const chain = defineChain({ ...chainConfig, blockTime: 1000, sourceId: 11155111, id: 1874, name: 'Whitechain Sepolia', nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.testnet.whitechain.io'] } }, blockExplorers: { default: { name: 'Whitechain Explorer', url: 'https://explorer.testnet.whitechain.io' } } });
export const USDT = getAddress('0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7');
export const PERMIT2 = getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3');
export const EXACT_PROXY = getAddress('0x402085c248EeA27D92E8b30b2C58ed07f9E20001');
export const stateDir = resolve(process.env.WAHLET_STATE_DIR ?? resolve(projectRoot, '.local'));
export const port = Number(process.env.WAHLET_PORT ?? 4100);
export const rpcUrl = process.env.WAHLET_RPC_URL ?? chain.rpcUrls.default.http[0];
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid WAHLET_PORT');
if (new URL(rpcUrl).protocol !== 'https:') throw new Error('RPC must use HTTPS');
export type Asset = 'WBT' | 'USDT';
export const decimals = (asset: Asset) => asset === 'WBT' ? 18 : 6;
export const explorer = (hash: string) => `${chain.blockExplorers.default.url}/tx/${hash}`;
