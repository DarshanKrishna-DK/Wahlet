import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function preparePrivateDirectory(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') chmodSync(directory, 0o700);
}

export function protectPrivateFile(file: string) {
  if (process.platform !== 'win32' && existsSync(file)) chmodSync(file, 0o600);
}

export function openPrivateDatabase(file: string) {
  preparePrivateDirectory(dirname(file));
  for (const suffix of ['', '-wal', '-shm', '-journal']) protectPrivateFile(file + suffix);
  const priorMask = process.umask();
  try {
    // SQLite inherits this mode for its database and new journal files.
    if (process.platform !== 'win32') process.umask(priorMask | 0o077);
    return new DatabaseSync(file);
  } finally {
    if (process.platform !== 'win32') process.umask(priorMask);
  }
}
