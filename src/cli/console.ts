import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { stateDir } from '../core/config.js';

export function openConsole() {
  let target: URL;
  try {
    const connection = JSON.parse(readFileSync(join(stateDir, 'owner-link.json'), 'utf8'));
    target = new URL(connection.url);
    if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.pathname !== '/console' || !/^#owner=[a-f0-9]{64}$/.test(target.hash)) throw new Error('Invalid connection');
  } catch {
    throw new Error('Start the wallet with wahlet serve, then run wahlet console in another terminal. Use the same WAHLET_STATE_DIR for both commands.');
  }
  const executable = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', target.href] : [target.href];
  const child = spawn(executable, args, { stdio: 'ignore', detached: true, windowsHide: true });
  child.on('error', () => { process.stderr.write('Unable to open the default browser. Start a browser and retry wahlet console.\n'); process.exitCode = 1; });
  child.unref();
  process.stdout.write('Opening the private owner console. Run this command again after a wallet restart.\n');
}
