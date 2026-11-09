import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const {url,token}=JSON.parse(readFileSync('.local/connection.json','utf8'));
for(const path of ['/api/session','/api/state']) {const response=await fetch(url+path);assert.equal(response.status,401);}
console.log('PASS unauthenticated HTTP cannot retrieve owner authority or wallet state');
const agent=await fetch(url+'/api/command',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({command:'policy',args:{}})});
assert.equal(agent.status,400);assert.match((await agent.json()).error,/requires the local owner console/);
console.log('PASS agent capability cannot modify owner policy');
const origin=await fetch(url+'/api/state',{headers:{Authorization:`Bearer ${token}`,Origin:'https://untrusted.invalid'}});assert.equal(origin.status,400);
console.log('PASS untrusted browser origin is rejected');
const second=spawn(process.execPath,['dist/local/server.js'],{env:{...process.env,WAHLET_PORT:'4111'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let output='';second.stderr.on('data',data=>output+=data.toString());
const timer=setTimeout(()=>second.kill(),10000);
const code=await new Promise(resolve=>second.once('exit',resolve));clearTimeout(timer);
assert.notEqual(code,0);assert.match(output,/state directory is already owned/);
console.log('PASS a second daemon on another HTTP port cannot acquire the same state');
