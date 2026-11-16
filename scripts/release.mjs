import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, '.local/releases');
mkdirSync(destination, { recursive: true });
if (!process.env.npm_execpath) throw new Error('Run this command with npm run release:pack.');
const output = execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--ignore-scripts', '--pack-destination', destination], { cwd: root, encoding: 'utf8', windowsHide: true });
const [packed] = JSON.parse(output);
const allowed = /^(?:package\.json|README\.md|RELEASE\.md|FACILITATOR\.md|LICENSE|licenses\/[^/]+|dist\/.+\.js|apps\/web\/dist\/.+)$/;
if (!packed.files.every(file => allowed.test(file.path) && !/(?:^|\/)(?:\.env(?:\.|$)|\.local|\.agents|\.codex|docs|node_modules)(?:\/|$)/.test(file.path))) throw new Error('Release contains an unexpected path. Do not publish it.');
const archive = join(destination, packed.filename);
const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync(join(destination, 'SHA256SUMS'), `${checksum}  ${packed.filename}\n`);
writeFileSync(join(destination, `${packed.filename}.manifest.json`), JSON.stringify({ name: packed.name, version: packed.version, filename: packed.filename, sha256: checksum, integrity: packed.integrity, files: packed.files.map(file => ({ path: file.path, size: file.size })) }, null, 2) + '\n');
process.stdout.write(`Created ${archive}\nSHA-256: ${checksum}\nIncludes ${packed.files.length} reviewed paths. No wallet state or planning files are included.\n`);
