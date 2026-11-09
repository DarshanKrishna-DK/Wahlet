import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const client = new Client({name:'wahlet-acceptance-host',version:'1.0.0'});
const transport = new StdioClientTransport({command:process.execPath,args:['dist/mcp/index.js'],stderr:'pipe'});
const records=[];
try {
 await client.connect(transport);
 const listed=await client.listTools();
 assert.equal(listed.tools.length,7);
 records.push({step:'tools/list',tools:listed.tools.map(t=>t.name)});
 for(const name of ['check_balance','spending_report','request_funding']) {
  const result=await client.callTool({name,arguments:{}});
  assert.ok(!result.isError,`${name} must return a successful read`);
  records.push({tool:name,outcome:'successful read',structured:!!result.structuredContent});
 }
 const rejected=[
  {name:'transfer_wbt',arguments:{operation_id:randomUUID(),recipient:'0x1111111111111111111111111111111111111111',amount:'0'}},
  {name:'transfer_usdt',arguments:{operation_id:randomUUID(),recipient:'0x1111111111111111111111111111111111111111',amount:'0'}},
  {name:'pay',arguments:{operation_id:randomUUID(),resource:'https://unapproved.invalid',challenge:{}}},
  {name:'x402_fetch',arguments:{operation_id:randomUUID(),url:'http://169.254.169.254/latest/meta-data'}}
 ];
 for(const request of rejected) {
  const result=await client.callTool(request);assert.equal(result.isError,true,`${request.name} must reject the unsafe request`);
  records.push({tool:request.name,outcome:'expected rejection',result:result.structuredContent});
 }
 writeFileSync('.local/mcp-acceptance.json',JSON.stringify({at:new Date().toISOString(),host:'Official MCP SDK stdio client',scope:'Seven tools invoked. Reads and denied writes only. No funded positive payment acceptance.',records},null,2));
 console.log('MCP stdio handshake, seven-tool discovery, three successful reads, and four denied writes passed.');
} finally {await client.close();}
