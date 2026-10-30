import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { openQuota } from '../src/qloo/quota.server';
describe('single-instance production quota (synthetic, no network)', () => {
  it('charges conservatively, survives restart, and rolls at UTC midnight', () => {
    const dir = mkdtempSync(join(tmpdir(), 'temilo-quota-')); const path = join(dir, 'quota.json');
    let now = Date.parse('2026-10-30T17:00:00Z');
    try {
      let quota = openQuota(path, { daily: 4, minute: 4, now: () => now });
      expect(quota.reserve(3)).toBe('allowed'); expect(quota.reserve(1)).toBe('allowed'); expect(quota.reserve(1)).toBe('daily'); quota.close();
      quota = openQuota(path, { daily: 4, minute: 4, now: () => now }); expect(quota.reserve(1)).toBe('daily');
      now += 24 * 60 * 60 * 1000; expect(quota.reserve(1)).toBe('allowed'); quota.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('enforces one writer and retains its minute window across restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'temilo-quota-')); const path = join(dir, 'quota.json'); let now = Date.now();
    try {
      let quota = openQuota(path, { daily: 60, minute: 3, now: () => now }); expect(() => openQuota(path, { daily: 60, minute: 3 })).toThrow();
      expect(quota.reserve(3)).toBe('allowed'); quota.close(); quota = openQuota(path, { daily: 60, minute: 3, now: () => now });
      expect(quota.reserve(1)).toBe('minute'); now += 60_001; expect(quota.reserve(1)).toBe('allowed'); quota.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('fails closed on corrupted disk state and never erases it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'temilo-quota-')); const path = join(dir, 'quota.json');
    try { writeFileSync(path, 'corrupt fixture'); expect(() => openQuota(path, { daily: 60, minute: 12 })).toThrow(); expect(() => openQuota(path, { daily: 60, minute: 12 })).toThrow(); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
