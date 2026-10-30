import { test, expect, type Page } from '@playwright/test';
import { demoSeed, demoReferenceTime } from '../../src/storage/demo-seed';
import { type Snapshot } from '../../src/domain/schemas';

// R3 workflow tests on the isolated blank-key 8083 server. Every Qloo response
// here is a synthetic route fixture — none of this is live evidence.
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true }).filter({ visible: true }).last();
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true }).filter({ visible: true }).last();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function data(page: Page): Promise<Snapshot> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gift-memory-mobile-web');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Snapshot>((resolve, reject) => {
        const request = db.transaction('values').objectStore('values').get('gift-memory-native-v1-personal');
        request.onsuccess = () => resolve(JSON.parse(request.result)); request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
}
async function seed(page: Page, change: (snapshot: Snapshot) => void = () => {}) {
  const snapshot = demoSeed();
  snapshot.inventory[0] = { ...snapshot.inventory[0], unitCost: 20, currency: 'CNY' };
  snapshot.wishes[0] = { ...snapshot.wishes[0], title: 'Artisan tea set' };
  change(snapshot);
  await page.goto('/');
  await page.getByText('Start with someone special.', { exact: true }).waitFor();
  await page.evaluate(async (value) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gift-memory-mobile-web');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('values', 'readwrite');
      transaction.objectStore('values').put(JSON.stringify(value), 'gift-memory-native-v1-personal');
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, snapshot);
  await page.reload();
  await page.getByTestId('birthday-current-card').filter({ visible: true }).last().waitFor();
  return snapshot;
}
const resolveFixture = (name: string, entityId: string, input: string) => ({ status: 'success', provider: 'Qloo', matches: [{ input, result: { status: 'success', provider: 'Qloo', requestedAt: '2026-10-30T12:00:00.000Z', entities: [{ entityId, name, entityType: 'urn:entity:artist' }], warnings: [] } }], unresolved: [] });

test.beforeEach(async ({ page, context, request }) => {
  expect(await (await request.get('/api/taste/status')).json()).toEqual({ status: 'blocked', reason: 'missing_key' });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:8083' ? route.abort('blockedbyclient') : route.continue();
  });
  await page.clock.setFixedTime(new Date(demoReferenceTime));
});

test('a wish with matching stock completes the whole task with zero Qloo requests @r3', async ({ page }) => {
  const upstream: string[] = [];
  await page.route('**/api/taste/*', (route) => { upstream.push(route.request().url()); return route.continue(); });
  await seed(page);
  const stored = await data(page);
  await page.goto(`/smart-gifting?personId=${stored.people[0].id}&occasionId=${stored.occasions[0].id}`);
  await expect(page.getByText('1 · RECIPIENT & OCCASION', { exact: true })).toBeVisible();
  await expect(page.getByText('2 · WHAT YOU ALREADY KNOW', { exact: true })).toBeVisible();
  await expect(page.getByText('3 · OPTIONAL CULTURAL EXPLORATION', { exact: true })).toBeVisible();
  await expect(page.getByText('Preparing for 2026-11-08', { exact: true })).toBeVisible();
  await expect(page.getByText('Their wish · in your gift box', { exact: true })).toBeVisible();
  await button(page, 'Artisan tea set').click();
  await expect(field(page, 'Candidate gift')).toHaveValue('Artisan tea set');
  await expect(button(page, 'Artisan tea set · 3 left')).toBeVisible();
  await button(page, 'Check against my records').click();
  await expect(page.getByText('Known · This title matches an active wish you recorded for them.').filter({ visible: true }).last()).toBeVisible();
  await button(page, 'Prepare this gift →').click();
  await button(page, 'Save gift plan').click();
  await expect.poll(async () => (await data(page)).gifts.length).toBe(1);
  const saved = await data(page);
  expect(saved.gifts[0]).toMatchObject({ giftTitle: 'Artisan tea set', itemSource: 'inventory', quantity: 1, wishId: saved.wishes[0].id, inventoryItemId: saved.inventory[0].id, occasionId: saved.occasions[0].id, occasionDate: '2026-11-08' });
  expect(saved.tasteRuns).toEqual([]);
  expect(upstream).toEqual([]);
});

test('changing signals while resolve is in flight never shows the stale result @r3', async ({ page }) => {
  await seed(page);
  const stored = await data(page);
  await page.goto(`/smart-gifting?personId=${stored.people[0].id}`);
  await field(page, 'Cultural interests to send').fill('Radiohead');
  await button(page, 'I confirm these are cultural interests and agree to query Qloo').click();
  let stale = true;
  await page.route('**/api/taste/resolve', async (route) => {
    if (stale) { await delay(1200); return route.fulfill({ json: resolveFixture('STALE FIXTURE ENTITY', '00000000-0000-4000-8000-0000000000b1', 'Radiohead') }); }
    return route.fulfill({ json: resolveFixture('FRESH FIXTURE ENTITY', '00000000-0000-4000-8000-0000000000b2', 'Fresh signal') });
  });
  await button(page, '1. Find verified entities').click();
  await field(page, 'Cultural interests to send').fill('Fresh signal');
  await page.waitForTimeout(1800);
  await expect(page.getByText('STALE FIXTURE ENTITY')).toHaveCount(0);
  await expect(button(page, '1. Find verified entities')).toBeEnabled();
  stale = false;
  await button(page, '1. Find verified entities').click();
  await expect(page.getByRole('radio', { name: 'FRESH FIXTURE ENTITY · artist', exact: true })).toBeVisible();
  await expect(page.getByText('STALE FIXTURE ENTITY')).toHaveCount(0);
});

test('changing signals after results clears them in the original result area @r3', async ({ page }) => {
  await seed(page);
  const stored = await data(page);
  await page.goto(`/smart-gifting?personId=${stored.people[0].id}`);
  await field(page, 'Cultural interests to send').fill('Radiohead');
  await button(page, 'I confirm these are cultural interests and agree to query Qloo').click();
  await page.route('**/api/taste/resolve', (route) => route.fulfill({ json: resolveFixture('FIRST FIXTURE ENTITY', '00000000-0000-4000-8000-0000000000b1', 'Radiohead') }));
  await button(page, '1. Find verified entities').click();
  await expect(page.getByRole('radio', { name: 'FIRST FIXTURE ENTITY · artist', exact: true })).toBeVisible();
  await field(page, 'Cultural interests to send').fill('Different interest');
  await expect(page.getByRole('radio', { name: 'FIRST FIXTURE ENTITY · artist', exact: true })).toHaveCount(0);
  await expect(page.getByText('Input changed. Previous results, if any, are no longer shown for this task.', { exact: true }).filter({ visible: true }).last()).toBeVisible();
});

test('explore failures keep the real reason and the manual path; nothing is fabricated @r3', async ({ page }) => {
  await seed(page);
  const stored = await data(page);
  await page.goto(`/smart-gifting?personId=${stored.people[0].id}`);
  await expect(page.getByText('Their wish · in your gift box', { exact: true })).toBeVisible();
  await field(page, 'Cultural interests to send').fill('Radiohead');
  await button(page, 'I confirm these are cultural interests and agree to query Qloo').click();
  await page.route('**/api/taste/resolve', (route) => route.fulfill({ json: resolveFixture('RATE LIMIT FIXTURE ARTIST', '00000000-0000-4000-8000-0000000000b1', 'Radiohead') }));
  await button(page, '1. Find verified entities').click();
  await page.getByRole('radio', { name: 'RATE LIMIT FIXTURE ARTIST · artist', exact: true }).click();
  await page.route('**/api/taste/explore', (route) => route.fulfill({ status: 429, json: { status: 'unavailable', reason: 'rate_limited' } }));
  await button(page, '3. Explore cultural connections').click();
  await expect(page.getByText('Qloo’s request limit was reached. Wait a little and retry.', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await expect(page.getByText('You can retry, choose another category, or continue manually with the wishes and stock above.', { exact: true })).toBeVisible();
  await expect(page.getByText('Directions to explore.')).toHaveCount(0);
  expect((await data(page)).tasteRuns).toEqual([]);
  await expect(page.getByRole('radio', { name: 'RATE LIMIT FIXTURE ARTIST · artist', exact: true })).toBeVisible();
});

test('unauthorized resolve shows the permission reason without polling or auto-retry @r3', async ({ page }) => {
  await seed(page);
  const stored = await data(page);
  await page.goto(`/smart-gifting?personId=${stored.people[0].id}`);
  await field(page, 'Cultural interests to send').fill('Radiohead');
  await button(page, 'I confirm these are cultural interests and agree to query Qloo').click();
  let calls = 0;
  await page.route('**/api/taste/resolve', (route) => { calls += 1; return route.fulfill({ status: 401, json: { status: 'unavailable', reason: 'unauthorized' } }); });
  await button(page, '1. Find verified entities').click();
  await expect(page.getByText('Qloo did not authorize this request. The server credentials need to be checked.', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(calls).toBe(1);
  expect((await data(page)).tasteRuns).toEqual([]);
});

test('missing cultural signals ask for input; person switch guards unsaved edits @r3', async ({ page }) => {
  await seed(page, (value) => { value.people[0] = { ...value.people[0], interests: [] }; });
  const stored = await data(page);
  await page.goto(`/smart-gifting?personId=${stored.people[0].id}`);
  await expect(button(page, 'Add interests on their profile →')).toBeVisible();
  await expect(page.getByText('No cultural interests are recorded for this friend yet. Add interests on their profile, or type a public artist, work or brand below.', { exact: true })).toBeVisible();
  await button(page, 'Change recipient: Avery · Friend').click();
  await field(page, 'Search friends').fill('Jor');
  await expect(radio(page, 'Avery · Friend')).toHaveCount(0);
  await radio(page, 'Jordan · Colleague').click();
  await expect(page.getByText('For Jordan', { exact: false }).filter({ visible: true }).last()).toBeVisible();
  await button(page, 'Check a gift').click();
  await field(page, 'Candidate gift').fill('Unsaved candidate edit');
  await button(page, 'Change recipient: Jordan · Colleague').click();
  await radio(page, 'Avery · Friend').click();
  await expect(page.getByText('Leave this gift task?', { exact: true })).toBeVisible();
  await button(page, 'Cancel').click();
  await expect(field(page, 'Candidate gift')).toHaveValue('Unsaved candidate edit');
  await button(page, 'Change recipient: Jordan · Colleague').click();
  await radio(page, 'Avery · Friend').click();
  await button(page, 'Discard & switch').click();
  await expect(page.getByText('For Avery', { exact: false }).filter({ visible: true }).last()).toBeVisible();
  expect((await data(page)).gifts).toEqual([]);
});

// Formal regressions for review A1–A4. Response gates prove that the facts
// actually change before a pending response is released.
const sharedEntityId = '00000000-0000-4000-8000-0000000000c1';
const bookFixture = { status: 'success', provider: 'Qloo', requestedAt: '2026-10-30T12:00:00.000Z', entities: [{ entityId: sharedEntityId, name: 'REVIEW FIXTURE BOOK', entityType: 'urn:entity:book', score: 0.42, scoreField: 'affinity' }], warnings: [] };
async function resolveReview(page: Page) {
  await seed(page);
  const stored = await data(page);
  await page.goto(`/smart-gifting?personId=${stored.people[0].id}`);
  await field(page, 'Cultural interests to send').fill('Radiohead');
  await button(page, 'I confirm these are cultural interests and agree to query Qloo').click();
  await page.route('**/api/taste/resolve', route => route.fulfill({ json: resolveFixture('REVIEW FIXTURE ARTIST', sharedEntityId, 'Radiohead') }));
  await button(page, '1. Find verified entities').click();
  await radio(page, 'REVIEW FIXTURE ARTIST · artist').click();
  return stored;
}
async function changeAvoid(page: Page, context: import('@playwright/test').BrowserContext, id: string) {
  const other = await context.newPage();
  await other.goto(`/people/${id}/edit`);
  await field(other, 'Avoid (optional)').fill('REVIEW FIXTURE BOOK');
  await button(other, 'Save changes').click();
  await expect(page.getByText('Avoid: REVIEW FIXTURE BOOK', { exact: true })).toBeVisible();
  await other.close();
}
test('pending exploration rejects new avoids from another real tab @r3', async ({ page, context }) => {
  const stored = await resolveReview(page);
  let release!: () => void; let arrived!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const waiting = new Promise<void>(r => { arrived = r; });
  await page.route('**/api/taste/explore', async route => { arrived(); await gate; await route.fulfill({ json: bookFixture }); });
  await button(page, '3. Explore cultural connections').click(); await waiting;
  await changeAvoid(page, context, stored.people[0].id);
  release();
  await expect(button(page, '3. Explore cultural connections')).toBeEnabled();
  await expect(page.getByText('An edition of REVIEW FIXTURE BOOK', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Saved records changed while exploring. Run the exploration again for current directions.', { exact: true })).toBeVisible();
});
test('displayed directions become unusable after avoid or stock changes @r3', async ({ page, context }) => {
  const stored = await resolveReview(page);
  await page.route('**/api/taste/explore', route => route.fulfill({ json: bookFixture }));
  await button(page, '3. Explore cultural connections').click();
  await expect(button(page, 'Use in a gift plan →')).toBeEnabled();
  await changeAvoid(page, context, stored.people[0].id);
  await expect(button(page, 'Use in a gift plan →')).toBeDisabled();
  await expect(button(page, 'Save this exploration')).toBeDisabled();
  expect((await data(page)).tasteRuns).toEqual([]);
});
test('pending exploration cannot re-offer a direction given in another tab @r3', async ({ page, context }) => {
  const stored = await resolveReview(page);
  let release!: () => void; let arrived!: () => void;
  const gate = new Promise<void>(r => { release = r; }); const waiting = new Promise<void>(r => { arrived = r; });
  await page.route('**/api/taste/explore', async route => { arrived(); await gate; await route.fulfill({ json: bookFixture }); });
  await button(page, '3. Explore cultural connections').click(); await waiting;
  const other = await context.newPage(); await other.goto(`/gift-plan/${stored.people[0].id}`);
  await field(other, 'Gift title').fill('An edition of REVIEW FIXTURE BOOK');
  await button(other, 'Save gift plan').click(); await button(other, 'Confirm given').click(); await button(other, 'Mark as given').click();
  await expect(page.getByText('Previously given (1)', { exact: true })).toBeVisible();
  release(); await expect(button(page, '3. Explore cultural connections')).toBeEnabled();
  await expect(button(page, 'Use in a gift plan →')).toHaveCount(0); await other.close();
});
test('late failure is discarded when cultural inputs change during the request @r3', async ({ page }) => {
  const stored = await seed(page); await page.goto(`/smart-gifting?personId=${stored.people[0].id}`);
  await field(page, 'Cultural interests to send').fill('Radiohead');
  await button(page, 'I confirm these are cultural interests and agree to query Qloo').click();
  let release!: () => void; let arrived!: () => void;
  const gate = new Promise<void>(r => { release = r; }); const waiting = new Promise<void>(r => { arrived = r; });
  await page.route('**/api/taste/resolve', async route => { arrived(); await gate; await route.fulfill({ status: 401, json: { status: 'unavailable', reason: 'unauthorized' } }); });
  await button(page, '1. Find verified entities').click(); await waiting;
  await field(page, 'Cultural interests to send').fill('Jane Austen'); release();
  await expect(button(page, '1. Find verified entities')).toBeEnabled();
  await expect(page.getByText('Qloo did not authorize this request. The server credentials need to be checked.', { exact: true })).toHaveCount(0);
});
test('pristine occasion context is clean; typed interests and occasion changes require discard @r3', async ({ page }) => {
  const stored = await seed(page);
  await page.goto(`/smart-gifting?personId=${stored.people[0].id}&occasionId=${stored.occasions[0].id}`);
  await button(page, 'Change recipient: Avery · Friend').click(); await radio(page, 'Jordan · Colleague').click();
  await expect(page.getByText('Leave this gift task?', { exact: true })).toHaveCount(0);
  await field(page, 'Cultural interests to send').fill('Unsaved cultural interest');
  await button(page, 'Change recipient: Jordan · Colleague').click(); await radio(page, 'Avery · Friend').click();
  await expect(page.getByText('Leave this gift task?', { exact: true })).toBeVisible(); await button(page, 'Cancel').click();
  await expect(field(page, 'Cultural interests to send')).toHaveValue('Unsaved cultural interest');
  await button(page, 'Change recipient: Jordan · Colleague').click(); await radio(page, 'Avery · Friend').click(); await button(page, 'Discard & switch').click();
  await page.getByText('Change occasion', { exact: true }).click();
  await radio(page, 'Birthday · Nov 8 · 2026-11-08').click();
  await button(page, 'Change recipient: Avery · Friend').click(); await radio(page, 'Jordan · Colleague').click();
  await expect(page.getByText('Leave this gift task?', { exact: true })).toBeVisible();
});
test('named radio groups support checked state, arrows and Space without changing other groups @r3', async ({ page }) => {
  const stored = await seed(page); await page.goto(`/gift-plan/${stored.people[0].id}`);
  const group = page.getByRole('radiogroup', { name: 'Gift source', exact: true }).filter({ visible: true }).last();
  const external = group.getByRole('radio', { name: 'Sourced elsewhere', exact: true });
  await expect(external).toBeChecked(); await external.focus(); await external.press('ArrowRight');
  await expect(group.getByRole('radio', { name: 'An experience', exact: true })).toBeChecked();
  await group.getByRole('radio', { name: 'From gift box', exact: true }).focus(); await page.keyboard.press('Space');
  await expect(group.getByRole('radio', { name: 'From gift box', exact: true })).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Occasion', exact: true }).filter({ visible: true }).last().getByRole('radio', { name: 'Just because · No specific occasion', exact: true })).toBeChecked();
});
test('same-ID artist and book survive explore, adoption, save, give and refreshed source history @r3', async ({ page }) => {
  await resolveReview(page);
  await page.route('**/api/taste/explore', route => route.fulfill({ json: bookFixture }));
  await button(page, '3. Explore cultural connections').click(); await button(page, 'Use in a gift plan →').click();
  await button(page, 'Save gift plan').click();
  await expect.poll(async () => (await data(page)).gifts.length).toBe(1);
  let stored = await data(page);
  expect(stored.tasteRuns).toHaveLength(1); expect(stored.gifts).toHaveLength(1);
  expect(stored.tasteRuns[0].inputSignals[0]).toMatchObject({ qlooEntityId: sharedEntityId, qlooEntityType: 'urn:entity:artist' });
  expect(stored.tasteRuns[0].qlooEvidence.map(e => e.entityType)).toEqual(['urn:entity:artist', 'urn:entity:book']);
  expect(stored.gifts[0].tasteSnapshot?.evidence.map(e => e.entityType)).toEqual(['urn:entity:artist', 'urn:entity:book']);
  expect(stored.gifts[0].suggestionId).toBe(`urn:entity:book:${sharedEntityId}`);
  await button(page, 'Confirm given').click(); await button(page, 'Mark as given').dblclick();
  await expect.poll(async () => (await data(page)).gifts[0].status).toBe('given');
  await page.reload(); await page.getByText('Saved source evidence', { exact: true }).click();
  await expect(page.getByText(`REVIEW FIXTURE ARTIST · urn:entity:artist · ${sharedEntityId}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`REVIEW FIXTURE BOOK · urn:entity:book · ${sharedEntityId} · affinity=0.42`, { exact: true })).toBeVisible();
  stored = await data(page); expect(stored.inventory[0].quantity).toBe(3); expect(stored.gifts).toHaveLength(1);
});
test('saving an exploration clears its dirty baseline without a false discard prompt @r3', async ({ page }) => {
  await resolveReview(page); await page.route('**/api/taste/explore', route => route.fulfill({ json: bookFixture }));
  await button(page, '3. Explore cultural connections').click(); await button(page, 'Save this exploration').click();
  await expect(button(page, 'Exploration saved')).toBeVisible();
  await button(page, 'Change recipient: Avery · Friend').click(); await radio(page, 'Jordan · Colleague').click();
  await expect(page.getByText('For Jordan', { exact: false }).filter({ visible: true }).last()).toBeVisible();
  await expect(page.getByText('Leave this gift task?', { exact: true })).toHaveCount(0);
  expect((await data(page)).tasteRuns).toHaveLength(1);
});
