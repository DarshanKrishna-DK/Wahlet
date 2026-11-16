import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPrivateDatabase, preparePrivateDirectory, protectPrivateFile } from '../src/core/storage.js';

const directory = mkdtempSync(join(tmpdir(), 'wahlet-storage-'));
const path = join(directory, 'private', 'ledger.sqlite');
const originalMask = process.umask();
try {
  preparePrivateDirectory(join(directory, 'private'));
  const db = openPrivateDatabase(path);
  try {
    assert.equal(process.umask(), originalMask, 'Opening storage must restore the caller umask');
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE proof (value TEXT); INSERT INTO proof VALUES (\'private\')');
    assert.equal(db.prepare('SELECT value FROM proof').get()?.value, 'private');
    if (process.platform !== 'win32') {
      assert.equal(statSync(join(directory, 'private')).mode & 0o777, 0o700);
      for (const file of [path, path + '-wal', path + '-shm']) {
        assert.ok(existsSync(file));
        assert.equal(statSync(file).mode & 0o077, 0, 'Financial state must not be readable by other POSIX users');
      }
      const oldFile = join(directory, 'legacy-secret');
      writeFileSync(oldFile, 'fixture', { mode: 0o644 });
      protectPrivateFile(oldFile);
      assert.equal(statSync(oldFile).mode & 0o777, 0o600);
    }
  } finally { db.close(); }
  assert.throws(() => openPrivateDatabase(join(path, 'not-a-directory.sqlite')));
  assert.equal(process.umask(), originalMask, 'A failed open must preserve the caller umask');
  console.log('PASS private SQLite storage, journal access, and umask restoration. POSIX permission assertions run on POSIX hosts; Windows uses owner-managed ACLs.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
