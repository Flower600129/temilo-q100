import { test, expect, type Page } from '@playwright/test';
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true }).filter({ visible: true }).last();
test('production routes, assets, refresh, saved plan and stock give/undo persist @production', async ({ page, context, request }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:8084' ? route.continue() : route.abort());
  for (const path of ['/', '/people', '/wishes', '/me', '/smart-gifting', '/people/new', '/inventory', '/about']) expect((await request.get(path)).status()).toBe(200);
  await page.goto('/about'); await button(page, 'Explore demo').click(); await page.goto('/');
  await expect(page.getByText('Upcoming birthdays', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready); expect(await page.evaluate(() => document.fonts.check('16px TEMILOEditorial'))).toBe(true);
  await page.getByTestId('birthday-current-card').filter({ visible: true }).last().getByRole('button', { name: 'Prepare a gift →', exact: true }).click();
  await page.getByRole('radio', { name: 'From gift box', exact: true }).filter({ visible: true }).last().click(); await button(page, 'From your gift box').click();
  await page.getByRole('radio', { name: 'Artisan tea set · 3 left', exact: true }).click(); await field(page, 'Gift note (optional)').fill('Synthetic production walkthrough');
  await button(page, 'Save gift plan').click(); await button(page, 'Confirm given').click(); await button(page, 'Mark as given').dblclick();
  await expect(page.getByText('Avery · Given', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await page.reload(); await expect(page.getByText('Synthetic production walkthrough', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  const savedURL = page.url(); await page.goto('/inventory'); await expect(page.getByText('2 left', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await page.goto(savedURL); await button(page, 'Undo gift').click(); await button(page, 'Undo & restore').dblclick();
  await expect(page.getByText('Avery · Cancelled', { exact: true }).filter({ visible: true }).last()).toBeVisible(); await page.goto('/inventory'); await expect(page.getByText('3 left', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('production APIs reject invalid origin, type, size and payload; blank key never fabricates @production', async ({ request }) => {
  expect(await (await request.get('/api/taste/status')).json()).toEqual({ status: 'blocked', reason: 'missing_key' });
  const source = { entityIds: ['70CAE5BF-2F4C-445C-A3E5-4EDACFC3591C'], targetCategory: 'urn:entity:book' };
  const search = await request.post('/api/taste/resolve', { data: { interests: ['Radiohead'] } }); expect(search.status()).toBe(503); expect((await search.json()).reason).toBe('missing_key');
  const explore = await request.post('/api/taste/explore', { data: source }); expect(explore.status()).toBe(503); expect((await explore.json()).reason).toBe('missing_key');
  expect((await request.post('/api/taste/explore', { data: { interests: ['Wrong contract'] } })).status()).toBe(400);
  expect((await request.post('/api/taste/resolve', { data: source })).status()).toBe(400);
  expect((await request.post('/api/taste/resolve', { data: { interests: ['Radiohead'], privateNote: 'Forbidden field fixture' } })).status()).toBe(400);
  expect((await request.post('/api/taste/resolve', { headers: { Origin: 'https://invalid.example' }, data: { interests: ['Radiohead'] } })).status()).toBe(403);
  expect((await request.post('/api/taste/resolve', { headers: { 'Content-Type': 'text/plain' }, data: '{}' })).status()).toBe(415);
  expect((await request.post('/api/taste/resolve', { data: { interests: ['x'.repeat(5000)] } })).status()).toBe(413);
  expect((await request.get('/api/taste/resolve')).status()).toBe(405);
  for (const path of ['/.env.local', '/server/_expo/routes.json', '/_expo/functions/api/taste/resolve+api.js.map']) expect((await request.get(path)).status()).toBe(404);
  expect((await request.get('/?bad=%E0%A4%A')).status()).toBe(400);
  expect((await request.get('/?bad=' + 'x'.repeat(2100))).status()).toBe(414);
});
test('the production shared quota rejects after a server restart without calling Qloo @production', async ({ request }) => {
  const { spawn } = await import('node:child_process'); const { mkdtemp, rm } = await import('node:fs/promises'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'temilo-production-quota-'));
  async function start() {
    const child = spawn(process.execPath, ['scripts/serve-production.mjs', '--test-server'], { cwd: process.cwd(), env: { ...process.env, PORT: '8085', TEMILO_BIND: '127.0.0.1', TEMILO_QUOTA_FILE: join(directory, 'quota.json'), TEMILO_QLOO_DAILY_UNITS: '3', TEMILO_QLOO_MINUTE_UNITS: '3' }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Owned quota test server did not start.')); }, 10_000);
      child.stdout.on('data', value => { if (String(value).includes('TEMILO production')) { clearTimeout(timer); resolve(); } });
      child.once('error', reject); child.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('Quota server refused startup; no unknown process was contacted.')); });
    }); return child;
  }
  async function stop(child: Awaited<ReturnType<typeof start>>) { const done = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGTERM'); await done; }
  try {
    let child = await start();
    try { const first = await request.post('http://127.0.0.1:8085/api/taste/resolve', { data: { interests: ['Public quota fixture'] } }); expect(first.status()).toBe(503); expect((await first.json()).reason).toBe('missing_key'); }
    finally { await stop(child); }
    child = await start();
    try { const next = await request.post('http://127.0.0.1:8085/api/taste/explore', { data: { entityIds: ['70CAE5BF-2F4C-445C-A3E5-4EDACFC3591C'], targetCategory: 'urn:entity:book' } }); expect(next.status()).toBe(429); expect((await next.json()).reason).toBe('quota_exhausted'); }
    finally { await stop(child); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('real synthetic legacy SQLite imports without deleting the original on the production build @production', async ({ page }) => {
  const { readFile, readdir } = await import('node:fs/promises'); const { demoSeed } = await import('../../src/storage/demo-seed');
  const directory = 'mobile/dist/web/client/_expo/static/js/web'; const entry = (await readdir(directory)).find(name => name.startsWith('entry-') && name.endsWith('.js'))!;
  const storageModule = (await readFile(`${directory}/${entry}`, 'utf8')).split('\n').find(line => line.includes("'ExpoSQLiteStorage'"));
  const moduleId = Number(storageModule?.match(/\},(\d+),\[[^\n]*\]\);$/)?.[1]); expect(Number.isInteger(moduleId)).toBe(true);
  await page.goto('/about'); await button(page, 'Explore demo').waitFor();
  const fixture = demoSeed(); fixture.people[0].displayName = 'Synthetic legacy import'; const raw = JSON.stringify(fixture);
  // Only this newly created synthetic context is prepared as an older browser.
  // The bundled SDK writes actual SQLite, rather than mocking a migrated read.
  await page.evaluate(async ({ moduleId, raw }) => {
    type Legacy = { setItem: (key: string, value: string) => Promise<void>; closeAsync: () => Promise<void> };
    const legacy = (globalThis as unknown as { __r: (id: number) => { default: Legacy } }).__r(moduleId).default;
    await legacy.setItem('gift-memory-native-v1-personal', raw); await legacy.closeAsync();
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('gift-memory-mobile-web'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('values', 'readwrite'); tx.objectStore('values').delete('legacy-sqlite-imported-v1'); tx.objectStore('values').delete('gift-memory-native-v1-personal'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { moduleId, raw });
  await page.reload(); await page.goto('/people'); await expect(button(page, 'View Synthetic legacy import')).toBeVisible();
  const original = await page.evaluate(async (moduleId) => {
    type Legacy = { getItem: (key: string) => Promise<string | null>; closeAsync: () => Promise<void> };
    const legacy = (globalThis as unknown as { __r: (id: number) => { default: Legacy } }).__r(moduleId).default;
    const value = await legacy.getItem('gift-memory-native-v1-personal'); await legacy.closeAsync(); return value;
  }, moduleId);
  expect(original).toBe(raw); await page.reload(); await expect(button(page, 'View Synthetic legacy import')).toBeVisible();
});
