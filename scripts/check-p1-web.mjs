import { chromium, expect } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.MOBILE_WEB_URL ?? 'http://127.0.0.1:8082';
const profile = await mkdtemp(join(tmpdir(), 'gift-memory-p1-'));
let context; let page;
const errors = [];
const launch = () => chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
const button = (name) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const text = (name) => page.getByText(name, { exact: true }).filter({ visible: true }).last();
const field = (name) => page.getByRole('textbox', { name, exact: true }).filter({ visible: true }).last();
const link = (name) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).last();
async function open() {
  page = context.pages()[0] ?? await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-25T12:00:00+08:00') });
  await page.goto(baseUrl);
}
async function addDate(label, type, month, day, onceYear) {
  await button('+ Add a date').click();
  await button(type).click();
  await field('Occasion name').fill(label);
  if (onceYear) { await button('One time').click(); await field('Year').fill(onceYear); }
  await field('Month').fill(month); await field('Day').fill(day);
  if (label === 'Dinner') await field('In-app reminder days').fill('5');
  await button('Save date').click();
  await text(label).waitFor();
}
try {
  context = await launch(); await open();
  await text('Thoughtfulness starts with someone.').waitFor();
  await button('+ Add a person').click();
  await field('Name').fill('Alex Preview'); await field('Birth month').fill('11'); await field('Birth day').fill('08');
  await button('Save person').click(); await text('Alex Preview').waitFor();
  const personUrl = page.url();
  await button('Edit person').click();
  await field('Name').fill('Alex Chen'); await field('Relationship (optional)').fill('Friend');
  await field('Cultural interests (optional)').fill('Jane Austen, Chopin');
  await field('Avoid (optional)').fill('Perfume'); await field('Private notes (optional)').fill('Synthetic private note');
  await button('Save changes').click(); await text('Alex Chen').waitFor(); await text('Jane Austen · Chopin').waitFor();
  await addDate('Friendship day', 'Anniversary', '01', '01');
  await addDate('Dinner', 'Other', '10', '30', '2026');
  await button('Edit Birthday').click();
  await field('Month').fill('02'); await field('Day').fill('29'); await field('In-app reminder days').fill('7, 1, 7');
  await button('Save date').click(); await text('Remind in app: 7, 1 days before').waitFor();
  await text('February 29 is observed on February 28 in non-leap years.').waitFor();
  await button('+ Add a date').click(); await button('Other').click(); await button('One time').click();
  await field('Occasion name').fill('Invalid leap check'); await field('Month').fill('02'); await field('Day').fill('29'); await field('Year').fill('2027');
  await button('Save date').click(); await text('A one-time occasion needs a valid complete date.').waitFor();
  await button('← Back').click();
  await link('Home').click(); await text('days until Alex Chen’s dinner').waitFor();
  await text('Today’s reminders').waitFor(); await text('Alex Chen · Dinner · In 5 days').waitFor();
  await page.screenshot({ path: 'docs/evidence/p1-home.png', fullPage: true });
  await button('Prepare a gift').click(); await text('A little care for Alex Chen.').waitFor();
  await text('Interests: Jane Austen, Chopin').waitFor(); await text('Avoid: Perfume').waitFor();
  await page.screenshot({ path: 'docs/evidence/p1-preparation.png', fullPage: true });
  await page.goto(personUrl); await text('Alex Chen').waitFor();
  await page.reload(); await text('Synthetic private note').waitFor();
  await context.close(); context = await launch(); await open();
  await page.goto(personUrl); await text('Alex Chen').waitFor(); await text('Dinner').waitFor();
  console.log('PASS: create/edit person; annual and one-time dates; leap/reminder validation; preparation; full browser restart.');

  await link('About').click(); await button('Explore demo').click(); await text('Current space: fictional demo. 2 people saved.').waitFor();
  await page.reload(); await text('Current space: fictional demo. 2 people saved.').waitFor();
  await button('Reset fictional demo').click(); await button('Cancel').click();
  await button('Reset fictional demo').click(); await button('Reset demo').click(); await text('Demo data has been restored.').waitFor();
  await button('Personal space').click(); await text('Current space: personal. 1 people saved.').waitFor();
  await page.goto(personUrl); await button('Edit Dinner').click(); await button('Delete date').click(); await button('Cancel').click();
  await button('Delete date').click(); await button('Confirm deletion').click(); await expect(text('Dinner')).toHaveCount(0);
  await page.screenshot({ path: 'docs/evidence/p1-person.png', fullPage: true });
  for (const label of ['Birthday', 'Friendship day']) {
    await button(`Edit ${label}`).click(); await button('Delete date').click(); await button('Confirm deletion').click();
  }
  await text('No dates saved yet.').waitFor();
  await link('People').click(); await button('View Alex Chen').click();
  await text('Alex Chen').waitFor();
  await button('Delete person').click(); await button('Cancel').click(); await text('Alex Chen').waitFor();
  await button('Delete person').click(); await button('Confirm deletion').click(); await text('Saved people · 0').waitFor();
  await page.reload(); await text('Saved people · 0').waitFor();
  await button('+ Add a person').click();
  const second = await context.newPage();
  await second.goto(`${baseUrl}/people/new`);
  await field('Name').fill('Concurrent A'); await field('Birth month').fill('11'); await field('Birth day').fill('08');
  await second.getByRole('textbox', { name: 'Name', exact: true }).fill('Concurrent B');
  await second.getByRole('textbox', { name: 'Birth month' }).fill('12'); await second.getByRole('textbox', { name: 'Birth day' }).fill('01');
  await Promise.all([button('Save person').click(), second.getByRole('button', { name: 'Save person', exact: true }).click()]);
  await text('Concurrent A').waitFor(); await second.getByText('Concurrent B', { exact: true }).filter({ visible: true }).last().waitFor();
  await link('People').click(); await page.reload(); await text('Saved people · 2').waitFor();
  await button('View Concurrent A').waitFor(); await button('View Concurrent B').waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('Horizontal overflow at 390px.');
  await second.close();
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log('PASS: demo selection survives reload, reset confirmation works, personal/demo stay separate, date/person deletion confirms and persists.');
  console.log('PASS: people without dates stay visible, simultaneous additions from two browser tabs both persist, no horizontal overflow.');
} catch (error) {
  for (const [index, tab] of (context?.pages() ?? []).entries()) {
    console.error(`FAILURE TAB ${index}: ${(await tab.locator('body').innerText().catch(() => '')).slice(-3500)}`);
  }
  if (page && !page.isClosed()) await page.screenshot({ path: 'docs/evidence/p1-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally { await context?.close(); }
