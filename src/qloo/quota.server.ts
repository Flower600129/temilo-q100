import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
type Ledger = { day: string; spent: number; recent: { at: number; units: number }[] };
// Conservative upstream units: resolve reserves 3, explore 1. One Node process
// owns this durable ledger; a lock prevents accidentally sharing it with a
// second process. No IP, browser identity or cultural text is stored.
export function openQuota(path: string, options: { daily: number; minute: number; now?: () => number }) {
  if (![options.daily, options.minute].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Quota limits must be positive whole numbers.');
  const now = options.now ?? Date.now; const day = () => new Date(now()).toISOString().slice(0, 10);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const lock = `${path}.lock`; const fd = openSync(lock, 'wx', 0o600);
  let ledger: Ledger;
  try {
    writeFileSync(fd, String(process.pid));
    ledger = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { day: day(), spent: 0, recent: [] };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ledger.day) || !Number.isSafeInteger(ledger.spent) || ledger.spent < 0 || !Array.isArray(ledger.recent) || ledger.recent.some(r => !Number.isFinite(r.at) || !Number.isSafeInteger(r.units) || r.units < 1 || r.units > 3)) throw new Error('Invalid quota ledger.');
  } catch (error) { closeSync(fd); unlinkSync(lock); throw error; }
  let closed = false;
  return {
    reserve(units: number): 'allowed' | 'daily' | 'minute' {
      if (closed) throw new Error('Quota ledger is closed.');
      if (!Number.isSafeInteger(units) || units < 1 || units > 3) throw new Error('Invalid request cost.');
      if (ledger.day !== day()) ledger = { day: day(), spent: 0, recent: [] };
      ledger.recent = ledger.recent.filter(r => now() - r.at < 60_000);
      if (ledger.spent + units > options.daily) return 'daily';
      if (ledger.recent.reduce((sum, r) => sum + r.units, 0) + units > options.minute) return 'minute';
      const next = { ...ledger, spent: ledger.spent + units, recent: [...ledger.recent, { at: now(), units }] };
      const temp = `${path}.${process.pid}.tmp`; const output = openSync(temp, 'w', 0o600);
      try { writeFileSync(output, JSON.stringify(next)); fsyncSync(output); } finally { closeSync(output); }
      renameSync(temp, path); ledger = next; return 'allowed';
    },
    close() { if (!closed) { closed = true; closeSync(fd); unlinkSync(lock); } },
  };
}
