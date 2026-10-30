import { test, expect, type Page } from '@playwright/test';
import { demoSeed, demoReferenceTime } from '../../src/storage/demo-seed';
import { type Snapshot } from '../../src/domain/schemas';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true }).filter({ visible: true }).last();
const card = (page: Page) => page.getByTestId('birthday-current-card').filter({ visible: true }).last();

async function stored(page: Page, key = 'gift-memory-native-v1-personal'): Promise<string | null> {
  return page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gift-memory-mobile-web');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try { return await new Promise<string | null>((resolve, reject) => {
      const request = db.transaction('values').objectStore('values').get(key);
      request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error);
    }); } finally { db.close(); }
  }, key);
}
async function data(page: Page): Promise<Snapshot> { return JSON.parse((await stored(page))!); }
const record = (page: Page, id: string) => page.getByTestId(`gift-record-${id}`).filter({ visible: true }).last();

async function submitTogether(first: Page, second: Page, label: string) {
  // Hold the actual browser lock until both UI submissions are in flight. This
  // avoids the first tab's broadcast removing the other tab's already-open
  // confirmation before Playwright has dispatched its click.
  await first.evaluate(async () => {
    const control = window as Window & { r1Release?: () => void };
    let acquired!: () => void;
    const ready = new Promise<void>((resolve) => { acquired = resolve; });
    const release = new Promise<void>((resolve) => { control.r1Release = resolve; });
    void navigator.locks.request('gift-memory-mobile-web:gift-memory-native-v1-personal', async () => { acquired(); await release; });
    await ready;
  });
  try {
    await Promise.all([button(first, label).click(), button(second, label).click()]);
    await expect(button(first, 'Saving…')).toBeVisible();
    await expect(button(second, 'Saving…')).toBeVisible();
  } finally { await first.evaluate(() => { (window as Window & { r1Release?: () => void }).r1Release?.(); }); }
}

async function seed(page: Page, change: (snapshot: Snapshot) => void = () => {}) {
  const snapshot = demoSeed();
  snapshot.inventory[0] = { ...snapshot.inventory[0], unitCost: 20, currency: 'CNY' };
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
  await expect(card(page)).toContainText('AVERY');
  return snapshot;
}

test.beforeEach(async ({ page, context, request }) => {
  expect(await (await request.get('/api/taste/status')).json()).toEqual({ status: 'blocked', reason: 'missing_key' });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:8083' ? route.abort('blockedbyclient') : route.continue();
  });
  await page.clock.setFixedTime(new Date(demoReferenceTime));
});

test('birthday → stock check → saved plan → given → feedback → refresh → undo @r1', async ({ page }) => {
  const snapshot = await seed(page);
  await button(page, 'Prepare a gift →').click();
  await field(page, 'Gift note (optional)').fill('Wrap in blue paper.');
  await button(page, 'Check a gift →').click();
  expect(new URL(page.url()).searchParams.get('occasionId')).toBe(snapshot.occasions[0].id);
  await button(page, 'From your gift box (optional)').click(); await page.getByRole('radio', { name: 'Artisan tea set · 3 left', exact: true }).filter({ visible: true }).last().click();
  await button(page, 'Check against my records').click();
  await button(page, 'Prepare this gift →').click();
  await expect(button(page, 'Artisan tea set · 3 left')).toBeVisible();
  await expect(field(page, 'Gift title')).toHaveValue('Artisan tea set');
  await expect(field(page, 'Gift note (optional)')).toHaveValue('Wrap in blue paper.');
  await button(page, 'Save gift plan').click();
  await expect.poll(async () => (await data(page)).gifts.length).toBe(1);
  const plan = (await data(page)).gifts[0];
  expect(plan).toMatchObject({ itemSource: 'inventory', inventoryItemId: snapshot.inventory[0].id, occasionId: snapshot.occasions[0].id, occasionDate: '2026-11-08', status: 'planned' });
  expect((await data(page)).inventory[0].quantity).toBe(3);
  await record(page, plan.id).getByRole('button', { name: 'Confirm given', exact: true }).click();
  await button(page, 'Mark as given').click();
  await expect.poll(async () => (await data(page)).inventory[0].quantity).toBe(2);
  await field(page, 'Gift feedback (optional)').fill('They loved it.');
  await button(page, 'Save feedback').click();
  await expect.poll(async () => (await data(page)).gifts[0].feedback).toBe('They loved it.');
  await page.reload();
  await expect(record(page, plan.id)).toContainText('Wrap in blue paper.');
  await expect(field(page, 'Gift feedback (optional)')).toHaveValue('They loved it.');
  expect((await data(page)).gifts[0].note).toBe('Wrap in blue paper.');
  await mkdir('.local/r1-evidence', { recursive: true });
  await record(page, plan.id).screenshot({ path: '.local/r1-evidence/birthday-given-feedback.png' });
  await button(page, 'Undo gift').click();
  await button(page, 'Undo & restore').click();
  await expect.poll(async () => (await data(page)).inventory[0].quantity).toBe(3);
  await expect(record(page, plan.id)).toContainText('Cancelled');
  await expect(button(page, 'Undo gift')).toHaveCount(0);
});

test('changing a checked budget never leaves the old approval actionable @r1', async ({ page }) => {
  const snapshot = await seed(page);
  await page.goto(`/smart-gifting?personId=${snapshot.people[0].id}&task=check`);
  await button(page, 'From your gift box (optional)').click(); await page.getByRole('radio', { name: 'Artisan tea set · 3 left', exact: true }).filter({ visible: true }).last().click();
  await field(page, 'Budget (optional)').fill('50');
  await field(page, 'Budget currency').fill('CNY');
  await button(page, 'Check against my records').click();
  await expect(page.getByText(/Known · Within your entered budget/).filter({ visible: true }).last()).toBeVisible();
  await field(page, 'Budget (optional)').fill('10');
  await expect(page.getByText(/Known · Within your entered budget/).filter({ visible: true })).toHaveCount(0);
  await expect(button(page, 'Prepare this gift →')).toHaveCount(0);
});

test('anniversary and existing plan survive ideas/check navigation; external/experience never deduct @r1', async ({ page }) => {
  const occasionId = randomUUID();
  const snapshot = await seed(page, (value) => value.occasions.push({ id: occasionId, personId: value.people[0].id, type: 'anniversary', label: 'Anniversary', monthDay: '01-01', recurrence: 'annual', reminderDaysBefore: [60] }));
  await page.goto(`/gift-plan/${snapshot.people[0].id}?occasionId=${occasionId}&occasionDate=2027-01-01`);
  await field(page, 'Gift title').fill('A thoughtful external gift');
  await field(page, 'Gift note (optional)').fill('Keep this anniversary note.');
  await button(page, 'Find thoughtful gift ideas →').click();
  await expect(page.getByText('Preparing for 2027-01-01', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await button(page, 'Check a gift').click();
  await expect(field(page, 'Candidate gift')).toHaveValue('A thoughtful external gift');
  await button(page, 'Check against my records').click();
  await button(page, 'Prepare this gift →').click();
  await button(page, 'Save gift plan').click();
  await expect.poll(async () => (await data(page)).gifts.length).toBe(1);
  const id = (await data(page)).gifts[0].id;
  await field(page, 'Gift title').fill('An edited external gift');
  await button(page, 'Check a gift →').click();
  expect(new URL(page.url()).searchParams.get('planId')).toBe(id);
  await button(page, 'Return to gift plan').click();
  await button(page, 'Save gift plan').click();
  await expect.poll(async () => (await data(page)).gifts[0].giftTitle).toBe('An edited external gift');
  expect((await data(page)).gifts).toHaveLength(1);
  expect((await data(page)).gifts[0]).toMatchObject({ occasionId, occasionDate: '2027-01-01', note: 'Keep this anniversary note.' });
  await button(page, 'Confirm given').click(); await button(page, 'Mark as given').click();
  await button(page, 'Undo gift').click(); await button(page, 'Undo & restore').click();
  await button(page, 'Start a new gift plan').click();
  await page.getByRole('radio', { name: 'An experience', exact: true }).filter({ visible: true }).last().click(); await field(page, 'Gift title').fill('A museum afternoon');
  await button(page, 'Save gift plan').click();
  await expect.poll(async () => (await data(page)).gifts.length).toBe(2);
  await button(page, 'Confirm given').click(); await button(page, 'Mark as given').click();
  await button(page, 'Undo gift').click(); await button(page, 'Undo & restore').click();
  expect((await data(page)).inventory).toEqual(snapshot.inventory);
  expect((await data(page)).gifts.map((gift) => gift.itemSource)).toEqual(['external', 'experience']);
});

test('wish source survives smart roundtrip and remains in history after the wish is deleted @r1', async ({ page }) => {
  const snapshot = await seed(page);
  await page.goto(`/wishes/edit?id=${snapshot.wishes[0].id}`);
  await button(page, 'Prepare a gift from this wish →').click();
  await expect(field(page, 'Gift title')).toHaveValue(snapshot.wishes[0].title);
  await button(page, 'Find thoughtful gift ideas →').click();
  await button(page, 'Continue with a gift plan →').click();
  await button(page, 'Save gift plan').click();
  await expect.poll(async () => (await data(page)).gifts.length).toBe(1);
  const plan = (await data(page)).gifts[0];
  expect(plan.wishId).toBe(snapshot.wishes[0].id);
  await page.goto(`/wishes/edit?id=${snapshot.wishes[0].id}`);
  await button(page, 'Delete wish').click(); await button(page, 'Confirm deletion').click();
  await expect.poll(async () => (await data(page)).wishes.length).toBe(0);
  await page.goto(`/gift-plan/${plan.personId}?planId=${plan.id}`);
  await expect(record(page, plan.id)).toContainText(`Recorded wish: ${snapshot.wishes[0].title}`);
  await button(page, 'Save gift plan').click();
  expect((await data(page)).gifts[0].wishSnapshot?.title).toBe(snapshot.wishes[0].title);
});

test('legacy saved exploration carries frozen evidence into plan and completed history @r1', async ({ page }) => {
  const runId = randomUUID();
  const snapshot = await seed(page, (value) => value.tasteRuns.push({
    id: runId, personId: value.people[0].id, requestStatus: 'partial', inputSignals: [], createdAt: '2026-10-24T00:00:00.000Z',
    qlooEvidence: [{ entityId: 'synthetic-persistence-book', entityType: 'urn:entity:book', name: 'Synthetic fixture book', score: 0.5, scoreField: 'affinity' }],
    suggestions: [{ title: 'Synthetic fixture direction', rationale: 'Persistence test only; not a Qloo live result.', limitations: ['Synthetic test fixture'], evidenceEntityIds: ['synthetic-persistence-book'] }],
  }));
  await page.goto('/inspiration');
  await button(page, 'Add to a gift plan →').click();
  expect(page.url()).not.toContain('Synthetic%20fixture');
  await expect(field(page, 'Gift title')).toHaveValue('Synthetic fixture direction');
  await field(page, 'Gift title').fill('A custom edition');
  await button(page, 'Check a gift →').click();
  await button(page, 'Return to gift plan').click();
  await button(page, 'Save gift plan').click();
  await expect.poll(async () => (await data(page)).gifts.length).toBe(1);
  const gift = (await data(page)).gifts[0];
  expect(gift).toMatchObject({ tasteRunId: runId, suggestionId: 'legacy:0', tasteSnapshot: { evidence: [{ entityId: 'synthetic-persistence-book', score: 0.5, scoreField: 'affinity' }] } });
  await button(page, 'Confirm given').click(); await button(page, 'Mark as given').click();
  await page.reload();
  await expect(record(page, gift.id)).toContainText('Persistence test only; not a Qloo live result.');
  expect((await data(page)).wishes).toEqual(snapshot.wishes);
  expect((await data(page)).inventory).toEqual(snapshot.inventory);
});

test('name-only profile can add a leap birthday later; partial dates never save @r1', async ({ page }) => {
  await page.goto('/people/new');
  await field(page, 'Name').fill('No date yet');
  await field(page, 'Birth month').fill('2');
  await button(page, 'Save person').click();
  await expect(page.getByRole('alert').filter({ visible: true }).last()).toBeVisible();
  expect(await stored(page)).toBeNull();
  await field(page, 'Birth month').fill('');
  await button(page, 'Save person').click();
  await expect.poll(() => stored(page)).not.toBeNull();
  await expect.poll(async () => (await data(page)).people.length).toBe(1);
  const id = (await data(page)).people[0].id;
  expect((await data(page)).occasions).toEqual([]);
  await button(page, '+ Add a date').click();
  await field(page, 'Month').fill('2'); await field(page, 'Day').fill('29');
  await button(page, '60 days').click(); await button(page, 'Save date').click();
  await expect.poll(async () => (await data(page)).occasions.length).toBe(1);
  expect((await data(page)).occasions[0]).toMatchObject({ personId: id, monthDay: '02-29', reminderDaysBefore: [60] });
  await page.reload();
  await expect(page.getByText('No date yet', { exact: true }).filter({ visible: true }).last()).toBeVisible();
});

test('two real tabs compete for the last stock; repeated confirm and undo stay idempotent @r1', async ({ page, context }) => {
  const ids = [randomUUID(), randomUUID()];
  await seed(page, (value) => {
    value.inventory[0].quantity = 1;
    value.gifts = ids.map((id) => ({ id, operationId: id, personId: value.people[0].id, giftTitle: 'Last stock fixture', itemSource: 'inventory', inventoryItemId: value.inventory[0].id, quantity: 1, status: 'planned', createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z' }));
  });
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date(demoReferenceTime));
  await Promise.all([page.goto('/gifts'), other.goto('/gifts')]);
  await Promise.all([record(page, ids[0]).getByRole('button', { name: 'Confirm given', exact: true }).click(), record(other, ids[1]).getByRole('button', { name: 'Confirm given', exact: true }).click()]);
  await submitTogether(page, other, 'Mark as given');
  await expect.poll(async () => (await data(page)).gifts.filter((gift) => gift.status === 'given').length).toBe(1);
  expect((await data(page)).inventory[0].quantity).toBe(0);
  const winner = (await data(page)).gifts.find((gift) => gift.status === 'given')!;
  const loserPage = winner.id === ids[0] ? other : page;
  await expect(loserPage.getByText('Not enough stock. Your plan and inventory have been kept.', { exact: true })).toBeVisible();
  await button(loserPage, 'Cancel').click();
  await Promise.all([page.reload(), other.reload()]);
  await Promise.all([record(page, winner.id).getByRole('button', { name: 'Undo gift', exact: true }).click(), record(other, winner.id).getByRole('button', { name: 'Undo gift', exact: true }).click()]);
  await submitTogether(page, other, 'Undo & restore');
  await expect.poll(async () => (await data(page)).inventory[0].quantity).toBe(1);
  expect((await data(page)).gifts.filter((gift) => gift.status === 'cancelled')).toHaveLength(1);
  // A second pair of tabs confirming the SAME operation also deducts only once.
  await Promise.all([page.reload(), other.reload()]);
  const remaining = ids.find((id) => id !== winner.id)!;
  await Promise.all([record(page, remaining).getByRole('button', { name: 'Confirm given', exact: true }).click(), record(other, remaining).getByRole('button', { name: 'Confirm given', exact: true }).click()]);
  await submitTogether(page, other, 'Mark as given');
  await expect.poll(async () => (await data(page)).inventory[0].quantity).toBe(0);
  expect((await data(page)).gifts.filter((gift) => gift.status === 'given')).toHaveLength(1);
  await other.close();
});

test('another tab changing stock invalidates the current check @r1', async ({ page, context }) => {
  const snapshot = await seed(page);
  await page.goto(`/smart-gifting?personId=${snapshot.people[0].id}&task=check`);
  await button(page, 'From your gift box (optional)').click(); await page.getByRole('radio', { name: 'Artisan tea set · 3 left', exact: true }).filter({ visible: true }).last().click(); await button(page, 'Check against my records').click();
  await expect(button(page, 'Prepare this gift →')).toBeVisible();
  const other = await context.newPage();
  await other.goto(`/inventory/edit?id=${snapshot.inventory[0].id}`);
  await field(other, 'Quantity in stock').fill('0'); await button(other, 'Save item').click();
  await expect(page.getByText('Details or saved records changed. Check again before using these results.', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await expect(button(page, 'Prepare this gift →')).toHaveCount(0);
  await button(page, 'Check against my records').click();
  await expect(page.getByText(/insufficient stock/).filter({ visible: true }).last()).toBeVisible();
  await other.close();
});

test('failed writes retain form input and old snapshot; retry creates one record @r1', async ({ page }) => {
  const snapshot = await seed(page);
  const before = await stored(page);
  await page.goto('/people/new'); await field(page, 'Name').fill('Write failure fixture');
  await page.evaluate(() => {
    const control = window as Window & { r1FailWrite?: boolean }; control.r1FailWrite = true;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (control.r1FailWrite && key === 'gift-memory-native-v1-personal') throw new DOMException('Synthetic write failure', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await button(page, 'Save person').click();
  await expect(page.getByText('Synthetic write failure', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await expect(field(page, 'Name')).toHaveValue('Write failure fixture');
  expect(await stored(page)).toBe(before);
  expect(await stored(page, 'gift-memory-native-v1-personal-recovery-r1')).toBe(before);
  await page.evaluate(() => { (window as Window & { r1FailWrite?: boolean }).r1FailWrite = false; });
  await button(page, 'Save person').click();
  await expect.poll(async () => (await data(page)).people.length).toBe(snapshot.people.length + 1);
  expect((await data(page)).occasions).toEqual(snapshot.occasions);
});

test('initial read failure is not an empty space; stale refresh preserves edits until retry @r1', async ({ page }) => {
  const snapshot = await seed(page);
  const before = await stored(page);
  await page.addInitScript(() => {
    const control = window as Window & { r1FailRead?: boolean }; control.r1FailRead = true;
    const original = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function(key) {
      if (control.r1FailRead && key === 'gift-memory-native-v1-personal') throw new DOMException('Synthetic read failure', 'UnknownError');
      return original.call(this, key);
    };
  });
  await page.reload();
  await expect(page.getByText('Saved data could not be loaded', { exact: true })).toBeVisible();
  await expect(page.getByText('Start with someone special.', { exact: true })).toHaveCount(0);
  await expect(button(page, '+ Add a person')).toHaveCount(0);
  await page.evaluate(() => { (window as Window & { r1FailRead?: boolean }).r1FailRead = false; });
  await page.getByText('Tap to retry', { exact: true }).click();
  await expect(card(page)).toContainText('AVERY');
  expect(await stored(page)).toBe(before);
  // Client navigation keeps this loaded snapshot and form mounted during a refresh failure.
  await button(page, 'Prepare a gift →').click();
  await field(page, 'Gift note (optional)').fill('Keep my unsaved note.');
  await page.evaluate(() => {
    (window as Window & { r1FailRead?: boolean }).r1FailRead = true;
    const channel = new BroadcastChannel('gift-memory-mobile-web-changes'); channel.postMessage('changed'); channel.close();
  });
  await expect(page.getByText('Saved data could not be refreshed', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await expect(button(page, 'Save gift plan')).toHaveCount(0);
  await page.evaluate(() => { (window as Window & { r1FailRead?: boolean }).r1FailRead = false; });
  await page.getByText('Tap to retry', { exact: true }).filter({ visible: true }).last().click();
  await expect(field(page, 'Gift note (optional)')).toHaveValue('Keep my unsaved note.');
  expect((await data(page)).people).toEqual(snapshot.people);
  expect(await stored(page)).toBe(before);
});

test('expired draft and invalid occasion show explicit errors without saving a new task @r1', async ({ page }) => {
  const snapshot = await seed(page);
  await button(page, 'Prepare a gift →').click(); await button(page, 'Check a gift →').click();
  await page.reload();
  await expect(page.getByText(/unsaved draft has expired/).filter({ visible: true }).last()).toBeVisible();
  await expect(field(page, 'Candidate gift')).toHaveCount(0);
  await page.goto(`/gift-plan/${snapshot.people[0].id}?occasionId=${snapshot.occasions[1].id}`);
  await expect(page.getByText('This occasion is no longer available for this friend.', { exact: true })).toBeVisible();
  await expect(button(page, 'Save gift plan')).toHaveCount(0);
  expect((await data(page)).gifts).toEqual([]);
  await mkdir('.local/r1-evidence', { recursive: true });
  await writeFile('.local/r1-evidence/test-scene.json', JSON.stringify({ fictional: true, referenceTime: demoReferenceTime, origin: 'http://127.0.0.1:8083', upstreamRequests: 0, noUserBrowserStorage: true }, null, 2));
});
