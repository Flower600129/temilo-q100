import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// A real SQL transaction and row lock serialize all Functions instances.
// Units are never refunded, including failed or interrupted upstream requests.
type Client = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
};
export type QuotaPool = { connect(): Promise<Client> };
export type Reservation = { state: 'allowed'; token: string } | { state: 'daily' | 'minute' | 'busy' };
export type SharedQuota = { reserve(units: number): Promise<Reservation>; release(token: string): Promise<void> };
const ledgerSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), spent: z.number().int().nonnegative(),
  recent: z.array(z.object({ at: z.number().int().nonnegative(), units: z.number().int().min(1).max(3) })).max(1000),
  leases: z.array(z.object({ token: z.string().uuid(), until: z.number().int().nonnegative() })).max(2),
});
export function createSharedQuota(pool: QuotaPool, limits: { daily: number; minute: number }): SharedQuota {
  if (![limits.daily, limits.minute].every(n => Number.isSafeInteger(n) && n > 0 && n <= 1000)) throw new Error('Invalid quota limits.');
  async function transaction<T>(action: (client: Client) => Promise<T>): Promise<T> {
    // A sleeping/unreachable DB must not leave an unguarded upstream request.
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = pool.connect().then(client => { if (expired) client.release(); return client; });
    const client = await Promise.race([pending, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error('Quota connection timed out.')); }, 4000);
    })]).finally(() => clearTimeout(timer));
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '4000ms'");
      await client.query("SET LOCAL lock_timeout = '3000ms'");
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (cause) {
      try { await client.query('ROLLBACK'); } catch { /* The caller fails closed. */ }
      throw cause;
    } finally { client.release(); }
  }
  return {
    async reserve(units) {
      if (!Number.isSafeInteger(units) || units < 1 || units > 3) throw new Error('Invalid request cost.');
      return transaction(async client => {
        const { rows } = await client.query("SELECT day, spent, recent, leases FROM temilo_qloo_quota WHERE id = 'shared' FOR UPDATE");
        const ledger = ledgerSchema.parse(rows[0]);
        // Read server time after acquiring the lock, across all cold starts.
        const time = await client.query('SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::text AS now');
        const now = Number(time.rows[0]?.now);
        if (!Number.isSafeInteger(now) || now <= 0) throw new Error('Invalid database time.');
        const day = new Date(now).toISOString().slice(0, 10);
        if (ledger.day > day) throw new Error('Quota clock moved backwards.');
        if (ledger.day !== day) { ledger.day = day; ledger.spent = 0; }
        ledger.recent = ledger.recent.filter(r => now - r.at < 60_000);
        ledger.leases = ledger.leases.filter(r => r.until > now);
        if (ledger.spent + units > limits.daily) return { state: 'daily' };
        if (ledger.recent.reduce((sum, r) => sum + r.units, 0) + units > limits.minute) return { state: 'minute' };
        if (ledger.leases.length >= 2) return { state: 'busy' };
        const token = randomUUID();
        ledger.spent += units; ledger.recent.push({ at: now, units });
        // Longer than the platform's 60s synchronous limit; crashes expire safely.
        ledger.leases.push({ token, until: now + 90_000 });
        await client.query("UPDATE temilo_qloo_quota SET day=$1, spent=$2, recent=$3::jsonb, leases=$4::jsonb WHERE id='shared'", [ledger.day, ledger.spent, JSON.stringify(ledger.recent), JSON.stringify(ledger.leases)]);
        return { state: 'allowed', token };
      });
    },
    async release(token) {
      if (!z.string().uuid().safeParse(token).success) throw new Error('Invalid lease token.');
      await transaction(async client => {
        const { rows } = await client.query("SELECT day, spent, recent, leases FROM temilo_qloo_quota WHERE id='shared' FOR UPDATE");
        const ledger = ledgerSchema.parse(rows[0]);
        await client.query("UPDATE temilo_qloo_quota SET leases=$1::jsonb WHERE id='shared'", [JSON.stringify(ledger.leases.filter(lease => lease.token !== token))]);
      });
    },
  };
}
