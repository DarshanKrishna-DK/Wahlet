// Read-only MCP smoke test: starts the built stdio server, lists its tools, and exits. It never calls a tool.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../dist/mcp/index.js', import.meta.url));
const client = new Client({ name: 'wahlet-smoke', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
const { tools } = await client.listTools();
await client.close();
const names = tools.map(tool => tool.name).sort();
const expected = ['check_balance', 'pay', 'request_funding', 'spending_report', 'transfer_usdt', 'transfer_wbt', 'x402_fetch'];
if (JSON.stringify(names) !== JSON.stringify(expected)) { console.error(`Unexpected tools: ${names.join(', ')}`); process.exit(1); }
console.log(`PASS MCP server lists ${names.length} tools: ${names.join(', ')}`);
