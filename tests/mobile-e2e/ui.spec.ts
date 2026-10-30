import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { demoSeed, demoReferenceTime } from '../../src/storage/demo-seed';
const evidence = '.local/q100/evidence/r2';
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true }).filter({ visible: true }).last();
const tab = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).last();
const card = (page: Page) => page.getByTestId('birthday-current-card').filter({ visible: true }).last();
async function seed(page: Page, count: number) {
  const snapshot = demoSeed(); snapshot.people = []; snapshot.occasions = []; snapshot.wishes = [];
  for (let i = 0; i < count; i++) {
    const id = randomUUID(); snapshot.people.push({ ...demoSeed().people[0], id, displayName: i ? `Synthetic friend ${i}` : 'Alexandra Long Family Name for Readability' });
    snapshot.occasions.push({ ...demoSeed().occasions[0], id: randomUUID(), personId: id, monthDay: i ? '11-08' : '10-30', reminderDaysBefore: [60] });
  }
  snapshot.people.push({ ...demoSeed().people[1], id: randomUUID(), displayName: 'No date yet' });
  await page.goto('/'); await page.getByText('Upcoming birthdays', { exact: true }).waitFor();
  await page.evaluate(async (value) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('gift-memory-mobile-web'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('values', 'readwrite'); tx.objectStore('values').put(JSON.stringify(value), 'gift-memory-native-v1-personal'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, snapshot); await page.reload(); return snapshot;
}
async function overflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${evidence}/${name}-first.png`, fullPage: true });
  const scroll = page.getByTestId('home-scroll').filter({ visible: true }).last();
  if (await scroll.count()) {
    const height = await scroll.evaluate(el => el.scrollHeight); const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width, height: height + 100 });
    await page.screenshot({ path: `${evidence}/${name}-full.png`, fullPage: true }); await page.setViewportSize(viewport);
  }
}
test.beforeEach(async ({ page, context, request }) => {
  expect(await (await request.get('/api/taste/status')).json()).toEqual({ status: 'blocked', reason: 'missing_key' });
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:8083' ? route.continue() : route.abort());
  await page.clock.setFixedTime(new Date(demoReferenceTime)); await mkdir(evidence, { recursive: true });
});
test('birthday counts, readable controls and layout at 320/390/430/1280 with 0/1/2/8 cards @r2', async ({ page, context }) => {
  test.setTimeout(180_000);
  const matrix = [];
  for (const count of [0, 1, 2, 8]) {
    const scenePage = count === 0 ? page : await context.newPage();
    await scenePage.clock.setFixedTime(new Date(demoReferenceTime)); await seed(scenePage, count);
    for (const width of [320, 390, 430, 1280]) {
      await scenePage.setViewportSize({ width, height: 844 }); await overflow(scenePage);
      if (count) {
        await expect(card(scenePage)).toContainText('Today');
        const prepare = card(scenePage).getByRole('button', { name: 'Prepare a gift →', exact: true });
        const box = await prepare.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(await prepare.locator('div').last().evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
      } else await expect(scenePage.getByText('A little time to breathe.', { exact: true })).toBeVisible();
      matrix.push({ count, width, noPageOverflow: true });
      if (width === 390) await capture(scenePage, `home-${count}-390`);
    }
    if (count > 1) { await button(scenePage, 'Next birthday').click(); await expect(card(scenePage)).toContainText('SYNTHETIC FRIEND 1'); await button(scenePage, 'Previous birthday').click(); await expect(card(scenePage)).toContainText('ALEXANDRA'); }
    if (scenePage !== page) await scenePage.close();
  }
  await writeFile(`${evidence}/matrix.json`, JSON.stringify({ fictional: true, referenceTime: demoReferenceTime, matrix, nativeKeyboardAndScreenReader: 'not tested' }, null, 2));
});
test('editor header save, validation, dirty back Cancel/discard and no-date persistence @r2', async ({ page }) => {
  await page.goto('/people'); await button(page, '+ Add a person').click();
  await button(page, 'Save person').click(); await expect(page.getByRole('alert').filter({ visible: true }).last()).toBeVisible();
  await field(page, 'Name').fill('Synthetic editor test'); await button(page, 'Back').click();
  await expect(page.getByText('Discard unsaved changes?', { exact: true })).toBeVisible(); await button(page, 'Cancel').click();
  await expect(page.getByText('Discard unsaved changes?', { exact: true })).toBeHidden();
  await expect(field(page, 'Name')).toHaveValue('Synthetic editor test');
  await capture(page, 'editor-390'); await button(page, 'Save person').click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/); await page.reload(); await expect(page.getByText('Synthetic editor test', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await page.goto('/people/new'); await field(page, 'Name').fill('Discard this person'); await button(page, 'Back').click(); await button(page, 'Discard & leave').click();
  await expect(field(page, 'Name')).toHaveCount(0); await expect(button(page, 'View Discard this person')).toHaveCount(0);
});
test('task tabs guard actual dirty input and saved lists retain filters on return @r2', async ({ page }) => {
  const scene = await seed(page, 1); await page.goto(`/smart-gifting?personId=${scene.people[0].id}`);
  await field(page, 'Cultural interests to send').fill('Unsaved public cultural text'); await tab(page, 'Friends').click();
  await expect(page.getByText('Discard unsaved changes?', { exact: true })).toBeVisible(); await button(page, 'Cancel').click();
  await expect(page.getByText('Discard unsaved changes?', { exact: true })).toBeHidden();
  await expect(field(page, 'Cultural interests to send')).toHaveValue('Unsaved public cultural text');
  await capture(page, 'gift-task-390'); await tab(page, 'Friends').click(); await button(page, 'Discard & leave').click();
  await field(page, 'Search people').fill('No date'); await expect(button(page, 'View No date yet')).toBeVisible();
  await tab(page, 'Me').click(); await tab(page, 'Friends').click(); await expect(field(page, 'Search people')).toHaveValue('No date');
});
test('browser Back protects wish edits and searchable pickers keep long lists compact @r2', async ({ page }) => {
  await seed(page, 8); await page.goto('/wishes'); await button(page, '+ Save a wish').click(); await field(page, 'Wish title').fill('Unsaved synthetic wish');
  await page.goBack(); await expect(page.getByText('Discard unsaved changes?', { exact: true })).toBeVisible(); await button(page, 'Cancel').click();
  await expect(page.getByText('Discard unsaved changes?', { exact: true })).toBeHidden();
  await expect(field(page, 'Wish title')).toHaveValue('Unsaved synthetic wish'); await button(page, 'For a friend').click(); await button(page, 'Choose a friend').click();
  await field(page, 'Search friends').fill('No date'); await page.getByRole('radio', { name: 'No date yet · Colleague', exact: true }).click();
  await expect(button(page, 'No date yet · Colleague')).toBeVisible(); await button(page, 'Save wish').click(); await expect(button(page, 'Open wish Unsaved synthetic wish')).toBeVisible();
  await expect(button(page, 'All friends')).toHaveCount(0); // One compact selected filter, not a wall of friend buttons.
  await overflow(page);
});
test('large text grows the birthday card and a short viewport keeps editor actions reachable @r2', async ({ page }) => {
  await seed(page, 2); await page.setViewportSize({ width: 390, height: 844 });
  const before = await card(page).boundingBox();
  // Synthetic browser text-scale stress, not a claim of a real device keyboard
  // or OS font-scale acceptance. Scale text and line boxes, keep touch targets.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('[dir="auto"]')) {
      if (element.children.length || element.closest('[aria-hidden="true"]')) continue;
      const style = getComputedStyle(element); const size = Number.parseFloat(style.fontSize); const height = Number.parseFloat(style.lineHeight);
      element.style.fontSize = `${size * 2}px`; if (Number.isFinite(height)) element.style.lineHeight = `${height * 2}px`;
    }
  });
  await expect.poll(async () => (await card(page).boundingBox())!.height).toBeGreaterThan(before!.height);
  await overflow(page); await capture(page, 'home-text-200-percent');
  const prepare = card(page).getByRole('button', { name: 'Prepare a gift →', exact: true });
  const action = await prepare.boundingBox(); const parent = await card(page).boundingBox();
  expect(action!.y + action!.height).toBeLessThanOrEqual(parent!.y + parent!.height + 1);
  await page.goto('/people/new'); await button(page, '+ Add relationship & interests').click();
  await page.setViewportSize({ width: 390, height: 450 }); await field(page, 'Private notes (optional)').focus();
  await field(page, 'Private notes (optional)').fill('Synthetic short-viewport input');
  await expect(button(page, 'Save person')).toBeInViewport();
  const input = await field(page, 'Private notes (optional)').boundingBox(); expect(input!.y).toBeGreaterThanOrEqual(64); expect(input!.y + input!.height).toBeLessThanOrEqual(450);
  await page.screenshot({ path: `${evidence}/editor-short-viewport.png`, fullPage: true });
});
test('an unsaved candidate carried by a task draft still guards leaving its review page @r2', async ({ page }) => {
  const scene = await seed(page, 1); await page.goto(`/smart-gifting?personId=${scene.people[0].id}&task=check`);
  await field(page, 'Candidate gift').fill('Unsaved synthetic candidate'); await button(page, 'Check against my records').click(); await button(page, 'Prepare this gift →').click();
  await tab(page, 'Me').click(); await expect(page.getByText('Discard unsaved changes?', { exact: true })).toBeVisible();
  await button(page, 'Cancel').click(); await expect(field(page, 'Gift title')).toHaveValue('Unsaved synthetic candidate');
});
test('directly loaded secondary pages return to their owning hierarchy without a navigation history @r2', async ({ page }) => {
  const scene = await seed(page, 1);
  await page.goto('/smart-gifting'); await button(page, 'Back').click(); await expect(page.getByText('Upcoming birthdays', { exact: true })).toBeVisible();
  const id = scene.people[0].id;
  await page.goto(`/people/${id}/edit`); await field(page, 'Name').waitFor(); await button(page, 'Back').click(); await expect(page).toHaveURL(new RegExp(`/people/${id}$`));
  await page.goto(`/gift-plan/${id}`); await button(page, 'Back').click(); await expect(page).toHaveURL(new RegExp(`/people/${id}$`));
});
