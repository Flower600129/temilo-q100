import { test, expect, chromium, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function addPerson(page: Page, name = 'Alex', month = '11', day = '8') {
  await page.goto('/people/new');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Birth month').selectOption(month);
  await page.getByLabel('Birth day').fill(day);
  await page.getByRole('button', { name: 'Save person' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+08:00')); });

test('add → birthday countdown → reload → reopen tab', async ({ page, context }) => {
  const browserErrors: string[] = []; page.on('pageerror', (error) => browserErrors.push(error.message));
  await addPerson(page);
  await expect(page.getByRole('heading', { name: 'Alex’s birthday' })).toBeVisible();
  await expect(page.locator('.countdown strong')).toHaveText('15');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Alex’s birthday' })).toBeVisible();
  const reopened = await context.newPage(); await reopened.goto('/people');
  await expect(reopened.getByRole('heading', { name: 'Alex', exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('invalid date is rejected and valid leap birthday is explained', async ({ page }) => {
  await page.goto('/people/new'); await page.getByLabel('Name', { exact: true }).fill('Leap friend');
  await page.getByLabel('Birth month').selectOption('02'); await page.getByLabel('Birth day').fill('30');
  await page.getByRole('button', { name: 'Save person' }).click();
  await expect(page.getByRole('form', { name: 'Add a person' }).getByRole('alert')).toContainText('valid birthday');
  await page.getByLabel('Birth day').fill('29'); await page.getByRole('button', { name: 'Save person' }).click();
  await expect(page.getByRole('heading', { name: 'Leap friend’s birthday' })).toBeVisible();
  await expect(page.getByText('February 29 birthdays are observed on February 28 in non-leap years.')).toBeVisible();
});

test('demo persists across refresh and reset never changes personal records', async ({ page }) => {
  await addPerson(page, 'Personal Alex');
  await page.getByRole('button', { name: 'Explore demo', exact: true }).first().click();
  await expect(page.getByText('Demo mode · fictional people and gifts')).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Avery’s birthday' })).toBeVisible();
  await addPerson(page, 'Demo-only person', '10', '25');
  await page.goto('/about'); await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await page.getByRole('group', { name: 'Confirm demo reset' }).getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByRole('group', { name: 'Confirm demo reset' })).toHaveCount(0);
  await expect(page.getByText('Demo reset. Your personal space is unchanged.', { exact: true })).toBeVisible();
  await page.goto('/people'); await expect(page.getByRole('heading', { name: 'Demo-only person', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to my space', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Personal Alex', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avery', exact: true })).toHaveCount(0);
});

test('storage write failure preserves the form and does not report success', async ({ page }) => {
  await page.goto('/people/new'); await expect(page.getByRole('button', { name: 'Save person' })).toBeEnabled();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(value, key) {
      if (this.name === 'occasions') throw new DOMException('Test-only failure', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page.getByLabel('Name', { exact: true }).fill('Unwritten person');
  await page.getByLabel('Birth month').selectOption('01'); await page.getByLabel('Birth day').fill('1');
  await page.getByRole('button', { name: 'Save person' }).click();
  await expect(page.getByRole('form', { name: 'Add a person' }).getByRole('alert')).toContainText('couldn’t save');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unwritten person');
  await page.goto('/people'); await expect(page.getByText('Your circle starts here.')).toBeVisible();
});

test('Qloo is honestly blocked and private profile fields are rejected', async ({ page, request }) => {
  await page.goto('/about'); await expect(page.getByText('Qloo unavailable', { exact: true })).toBeVisible();
  await expect(page.getByLabel('A public cultural interest')).toHaveCount(0);
  const response = await request.post('/api/taste/resolve', { data: { interests: ['Frédéric Chopin'] } });
  expect(response.status()).toBe(503); expect(await response.json()).toEqual({ status: 'unavailable', reason: 'missing_key' });
  const rejected = await request.post('/api/taste/resolve', { data: { interests: ['Frédéric Chopin'], displayName: 'Private Alex' } });
  expect(rejected.status()).toBe(400);
});

test('keyboard form use and pages fit the viewport', async ({ page }, testInfo) => {
  await page.goto('/people/new'); await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await page.keyboard.type('Keyboard Alex'); await page.keyboard.press('Tab');
  await expect(page.getByLabel('Birth month')).toBeFocused();
  await page.getByLabel('Birth month').selectOption('11'); await page.keyboard.press('Tab'); await page.keyboard.type('8');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Keyboard Alex’s birthday' })).toBeVisible();
  for (const path of ['/', '/people', '/people/new', '/about']) {
    await page.goto(path); await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Keyboard Alex’s birthday' })).toBeVisible();
  await page.screenshot({ path: `docs/evidence/p0-${testInfo.project.name}.png`, fullPage: true });
});

test('a second open tab sees committed changes', async ({ page, context }) => {
  await page.goto('/people'); await expect(page.getByText('Your circle starts here.')).toBeVisible();
  const second = await context.newPage(); await addPerson(second, 'Across tabs');
  await expect(page.getByRole('heading', { name: 'Across tabs', exact: true })).toBeVisible();
});

test('records survive a full browser restart with a persistent profile', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One persistent-profile restart is sufficient.');
  const profile = await mkdtemp(join(tmpdir(), 'gift-memory-p0-'));
  try {
    const first = await chromium.launchPersistentContext(profile, { baseURL: 'http://127.0.0.1:3100', headless: true });
    try { await addPerson(await first.newPage(), 'Restart Alex'); } finally { await first.close(); }
    const second = await chromium.launchPersistentContext(profile, { baseURL: 'http://127.0.0.1:3100', headless: true });
    try {
      const page = await second.newPage(); await page.goto('/people');
      await expect(page.getByRole('heading', { name: 'Restart Alex', exact: true })).toBeVisible();
    } finally { await second.close(); }
  } finally { await rm(profile, { recursive: true, force: true }); }
});
