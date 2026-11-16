#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createPublicClient, erc20Abi, http } from 'viem';
import { chain, USDT, PERMIT2, EXACT_PROXY, rpcUrl, projectRoot, stateDir } from '../core/config.js';
import { openConsole } from './console.js';
import { message } from '../core/errors.js';

const version = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).version as string;
const command = process.argv[2] ?? 'mcp';
const help = `Wahlet ${version}: local Whitechain Sepolia wallet\n\nwahlet serve              Start the wallet service\nwahlet console            Open the private owner console\nwahlet mcp                Run the stdio MCP client (default)\nwahlet facilitator        Start the configured facilitator\nwahlet config [client]    Print configuration for claude, cursor, codex, or chatgpt\nwahlet doctor [--offline] Inspect installation and read-only network readiness\nwahlet --version          Print the installed version\n\nNode.js 24 or newer is required. Mainnet is disabled. Never share the state directory or owner link.\n`;

function configuration(client: string) {
  const entry = resolve(projectRoot, 'dist/cli/index.js');
  const server = { command: process.execPath, args: [entry, 'mcp'], env: { WAHLET_STATE_DIR: stateDir } };
  if (client === 'codex') {
    process.stdout.write(`[mcp_servers.wahlet]\ncommand = ${JSON.stringify(server.command)}\nargs = ${JSON.stringify(server.args)}\n\n[mcp_servers.wahlet.env]\nWAHLET_STATE_DIR = ${JSON.stringify(stateDir)}\n`);
  } else if (client === 'chatgpt') {
    process.stdout.write('ChatGPT requires an authorized private MCP tunnel. A local path alone does not connect ChatGPT. Expose the stdio MCP process, never the owner console.\nhttps://developers.openai.com/api/docs/guides/secure-mcp-tunnels\n');
    process.stdout.write(JSON.stringify(server, null, 2) + '\n');
  } else if (['claude', 'cursor', 'other'].includes(client)) {
    process.stdout.write(JSON.stringify({ mcpServers: { wahlet: server } }, null, 2) + '\n');
  } else throw new Error('Choose claude, cursor, codex, or chatgpt. Configuration is printed only; merge it with existing client settings.');
}

async function doctor(offline: boolean) {
  const checks: { name: string; ok: boolean; detail: string }[] = [
    { name: 'runtime', ok: Number(process.versions.node.split('.')[0]) >= 24, detail: process.versions.node },
    { name: 'website', ok: existsSync(resolve(projectRoot, 'apps/web/dist/index.html')), detail: 'Built local console assets' },
    { name: 'state', ok: true, detail: stateDir },
    { name: 'network-policy', ok: chain.id === 1874, detail: `${chain.name}, chain ${chain.id}; mainnet disabled` },
  ];
  if (!offline) {
    try {
      const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 8000, retryCount: 0 }) });
      const chainId = await client.getChainId();
      checks.push({ name: 'rpc-chain', ok: chainId === 1874, detail: `Reported chain ${chainId}` });
      if (chainId === 1874) {
        const [decimals, permit2, proxy] = await Promise.all([
          client.readContract({ address: USDT, abi: erc20Abi, functionName: 'decimals' }),
          client.getCode({ address: PERMIT2 }), client.getCode({ address: EXACT_PROXY }),
        ]);
        checks.push({ name: 'test-usdt', ok: decimals === 6, detail: `${USDT}, ${decimals} decimals` });
        checks.push({ name: 'settlement-contracts', ok: Boolean(permit2 && permit2 !== '0x' && proxy && proxy !== '0x'), detail: 'Canonical Permit2 and exact proxy bytecode present' });
      }
    } catch { checks.push({ name: 'rpc', ok: false, detail: 'Network readiness could not be verified. Check connectivity and WAHLET_RPC_URL, then retry.' }); }
  }
  process.stdout.write(JSON.stringify({ product: 'Wahlet', version, mode: offline ? 'offline' : 'read-only network check', ready: checks.every(check => check.ok), checks }, null, 2) + '\n');
  if (checks.some(check => !check.ok)) process.exitCode = 1;
}

try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Wahlet requires Node.js 24 or newer.');
  switch (command) {
    case 'serve': await import('../local/server.js'); break;
    case 'mcp': await import('../mcp/index.js'); break;
    case 'facilitator': await import('../facilitator/index.js'); break;
    case 'console': openConsole(); break;
    case 'config': configuration(process.argv[3] ?? 'claude'); break;
    case 'doctor': await doctor(process.argv.includes('--offline')); break;
    case '--version': case '-v': process.stdout.write(version + '\n'); break;
    case '--help': case '-h': case 'help': process.stdout.write(help); break;
    default: throw new Error('Unknown command. Run wahlet help for supported commands.');
  }
} catch (error) {
  process.stderr.write(message(error) + '\n');
  process.exitCode = 1;
}
