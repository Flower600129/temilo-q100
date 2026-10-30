import { test, expect, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { demoReferenceTime, demoSeed } from '../../src/storage/demo-seed';

const referenceTime = demoReferenceTime;
const evidence = '.local/r0-evidence';
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const tab = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).last();
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true }).filter({ visible: true }).last();
// Expo Router can retain previous screens in the DOM during navigation.
const currentCard = (page: Page) => page.getByTestId('birthday-current-card').filter({ visible: true }).last();

async function snapshot(page: Page, space: 'personal' | 'demo') {
  return page.evaluate(async (mode) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gift-memory-mobile-web');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string | null>((resolve, reject) => {
        const request = db.transaction('values').objectStore('values').get(`gift-memory-native-v1-${mode}`);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, space);
}

test.beforeEach(async ({ page, context, request }) => {
  // Refuse to drive a browser if the dedicated process can use live credentials.
  expect(await (await request.get('/api/taste/status')).json()).toEqual({ status: 'blocked', reason: 'missing_key' });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:8083'
      ? route.abort('blockedbyclient') : route.continue();
  });
  await page.clock.setFixedTime(new Date(referenceTime));
  await page.goto('/');
  await page.getByText('Start with someone special.', { exact: true }).waitFor();
  await mkdir(evidence, { recursive: true });
});

test('current App navigation and saved person survive refresh @baseline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const name of ['Home', 'Wishlist', 'Friends', 'Me']) await tab(page, name).click();
  await tab(page, 'Friends').click();
  await page.goto('/people/new');
  await field(page, 'Name').fill('R0 synthetic friend');
  await field(page, 'Birth month').fill('11');
  await field(page, 'Birth day').fill('8');
  await button(page, '30 days').click();
  await button(page, 'Save person').click();
  await page.getByText('R0 synthetic friend', { exact: true }).filter({ visible: true }).last().waitFor();
  const saved = await snapshot(page, 'personal');
  expect(saved).not.toBeNull();
  await page.reload();
  await page.getByText('R0 synthetic friend', { exact: true }).filter({ visible: true }).last().waitFor();
  expect(await snapshot(page, 'personal')).toBe(saved);
  await page.goto('/smart-gifting');
  await page.getByText('A little help, choosing well.', { exact: true }).waitFor();
  expect(errors).toEqual([]);
});

test('shared fictional demo is reproducible and preserves personal space @baseline @visual', async ({ page }, info) => {
  const before = await snapshot(page, 'personal');
  await tab(page, 'Me').click();
  await button(page, 'Data & help').click();
  await button(page, 'Explore demo').click();
  await page.getByText('Current space: fictional demo. 2 people saved.', { exact: true }).waitFor();
  const expected = demoSeed();
  expect(JSON.parse((await snapshot(page, 'demo'))!)).toEqual(expected);
  expect(await snapshot(page, 'personal')).toBe(before);
  await button(page, 'Reset fictional demo').click();
  await button(page, 'Reset demo').click();
  await page.getByText('Demo data has been restored.', { exact: true }).waitFor();
  await page.getByText('Reset demo?', { exact: true }).waitFor({ state: 'hidden' });
  expect(await snapshot(page, 'personal')).toBe(before);
  await tab(page, 'Home').click();
  await expect(currentCard(page)).toContainText('AVERY');
  await expect(currentCard(page)).toContainText('09');
  await expect(page.getByTestId('bottom-navigation').filter({ visible: true }).last().getByTestId('nav-home-filled')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (info.project.name === 'mobile') {
    const scrollHeight = await page.getByTestId('home-scroll').filter({ visible: true }).last().evaluate((element) => element.scrollHeight);
    const nav = await page.getByTestId('bottom-navigation').filter({ visible: true }).last().boundingBox();
    await page.setViewportSize({ width: 390, height: Math.ceil(scrollHeight + nav!.height) });
    await page.screenshot({ path: `${evidence}/r0-demo-home.png`, fullPage: true });
    await writeFile(`${evidence}/r0-demo-scene.json`, `${JSON.stringify({
      fictional: true, referenceTime, viewportWidth: 390, dataSource: 'src/storage/demo-seed.ts',
      people: expected.people.map((person) => person.displayName),
      visibleBirthdays: [{ name: 'Avery', days: 9 }],
      noPersonalFixtureInjection: true, qlooUpstreamRequests: 0,
    }, null, 2)}\n`);
  }
  await page.reload();
  await expect(currentCard(page)).toContainText('AVERY');
  expect(await snapshot(page, 'personal')).toBe(before);
});

test('isolated Qloo missing-key path rejects safely with minimal input @baseline', async ({ page }) => {
  await button(page, 'Explore fictional demo →').click();
  await page.goto('/smart-gifting');
  await button(page, 'Choose a friend').click();
  await page.getByRole('radio', { name: 'Avery · Friend', exact: true }).filter({ visible: true }).last().click();
  await field(page, 'Cultural interests to send').fill('Radiohead');
  await button(page, 'I confirm these are cultural interests and agree to query Qloo').click();
  const pending = page.waitForRequest((request) => request.url().endsWith('/api/taste/resolve') && request.method() === 'POST');
  await button(page, '1. Find verified entities').click();
  expect((await pending).postDataJSON()).toEqual({ interests: ['Radiohead'] });
  await page.getByText('Qloo is unavailable: the server key has not been configured. You can continue with wishes and your gift box.', { exact: true }).waitFor();
  expect(JSON.parse((await snapshot(page, 'demo'))!).tasteRuns).toEqual([]);
});

test('existing local gifting regression on isolated server @journey', async ({}, info) => {
  test.skip(info.project.name !== 'mobile');
  test.setTimeout(300_000);
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/check-temilo-web.mjs'], {
    cwd: process.cwd(), timeout: 280_000, maxBuffer: 1024 * 1024,
    env: { ...process.env, MOBILE_WEB_URL: 'http://127.0.0.1:8083', QLOO_API_KEY: '', QLOO_BASE_URL: '' },
  });
  console.log(stdout.trim());
});
