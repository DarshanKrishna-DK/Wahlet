import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config } from 'dotenv';
const root = fileURLToPath(new URL('../', import.meta.url));
config({path: resolve(root, '.env'), quiet: true});
try {
  const directory = resolve(process.env.WAHLET_STATE_DIR ?? resolve(root, '.local'));
  const {url} = JSON.parse(readFileSync(resolve(directory, 'owner-link.json'), 'utf8'));
  const target = new URL(url);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.pathname !== '/console' || !/^#owner=[a-f0-9]{64}$/.test(target.hash)) throw new Error('Invalid console connection');
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', target.href] : [target.href];
  const child = spawn(command, args, {stdio:'ignore', detached:true, windowsHide:true});
  child.on('error', () => { process.stderr.write('Unable to open the default browser. Check the local browser installation.\n'); process.exitCode = 1; });
  child.unref();
  process.stdout.write('Opening the authorized local console. Keep this browser tab private.\n');
} catch {
  process.stderr.write('Start the Wahlet daemon first with npm start, then run npm run console.\n');
  process.exitCode = 1;
}
