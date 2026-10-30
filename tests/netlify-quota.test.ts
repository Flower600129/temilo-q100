import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NetlifyDB } from '@netlify/database-dev';
import { getDatabase, type DatabaseConnection } from '@netlify/database';
import { randomUUID } from 'node:crypto';
import { createSharedQuota } from '../netlify/lib/quota';

// Real local Postgres-compatible engine + actual pg client + committed SQL.
// This validates transactions and persistence; it is not hosted load evidence.
describe('Functions shared quota against isolated local SQL', () => {
  let engine: NetlifyDB; let database: DatabaseConnection; let connectionString: string;
  beforeAll(async () => {
    engine = new NetlifyDB({ logger: () => {} }); connectionString = await engine.start();
    await engine.applyMigrations('netlify/database/migrations');
    database = getDatabase({ connectionString });
  }, 30_000);
  afterAll(async () => { await database?.pool.end(); await engine?.stop(); });
  beforeEach(async () => {
    await database.pool.query("UPDATE temilo_qloo_quota SET day=to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD'), spent=0, recent='[]', leases='[]' WHERE id='shared'");
  });
  it('shares the weighted daily budget across new client instances and connections', async () => {
    let quota = createSharedQuota(database.pool, { daily: 4, minute: 4 });
    const first = await quota.reserve(3); expect(first.state).toBe('allowed');
    if (first.state === 'allowed') await quota.release(first.token);
    await database.pool.end(); database = getDatabase({ connectionString });
    quota = createSharedQuota(database.pool, { daily: 4, minute: 4 });
    expect((await quota.reserve(1)).state).toBe('allowed');
    expect((await quota.reserve(1)).state).toBe('daily');
    expect((await database.pool.query('SELECT spent FROM temilo_qloo_quota')).rows[0].spent).toBe(4);
  });
  it('caps two active operations globally and never refunds released or failed calls', async () => {
    const a = createSharedQuota(database.pool, { daily: 60, minute: 12 });
    const b = createSharedQuota(database.pool, { daily: 60, minute: 12 });
    const first = await a.reserve(3); const second = await b.reserve(1);
    expect([first.state, second.state]).toEqual(['allowed', 'allowed']);
    expect((await a.reserve(1)).state).toBe('busy');
    if (first.state === 'allowed') { await b.release(first.token); await b.release(first.token); }
    expect((await b.reserve(1)).state).toBe('allowed');
    expect((await database.pool.query('SELECT spent FROM temilo_qloo_quota')).rows[0].spent).toBe(5);
  });
  it('uses a persisted rolling minute and safely expires leases after crashes', async () => {
    const quota = createSharedQuota(database.pool, { daily: 60, minute: 3 });
    const first = await quota.reserve(3); if (first.state === 'allowed') await quota.release(first.token);
    expect((await createSharedQuota(database.pool, { daily: 60, minute: 3 }).reserve(1)).state).toBe('minute');
    const past = Date.now() - 91_000;
    await database.pool.query("UPDATE temilo_qloo_quota SET recent=$1::jsonb, leases=$2::jsonb", [JSON.stringify([{ at: past, units: 3 }]), JSON.stringify([{ token: randomUUID(), until: past }])]);
    expect((await quota.reserve(1)).state).toBe('allowed');
    expect((await database.pool.query('SELECT spent FROM temilo_qloo_quota')).rows[0].spent).toBe(4);
  });
  it('rolls the UTC day but keeps live leases, and fails closed on corrupt/missing state', async () => {
    const leases = [{ token: randomUUID(), until: Date.now() + 60_000 }, { token: randomUUID(), until: Date.now() + 60_000 }];
    await database.pool.query("UPDATE temilo_qloo_quota SET day='2020-01-01', spent=60, leases=$1::jsonb", [JSON.stringify(leases)]);
    const quota = createSharedQuota(database.pool, { daily: 60, minute: 12 });
    expect((await quota.reserve(1)).state).toBe('busy');
    await quota.release(leases[0].token); expect((await quota.reserve(1)).state).toBe('allowed');
    expect((await database.pool.query('SELECT spent FROM temilo_qloo_quota')).rows[0].spent).toBe(1);
    await database.pool.query("UPDATE temilo_qloo_quota SET recent='[{}]'");
    await expect(quota.reserve(1)).rejects.toThrow();
    await database.pool.query('DELETE FROM temilo_qloo_quota');
    await expect(quota.reserve(1)).rejects.toThrow();
  });
});
