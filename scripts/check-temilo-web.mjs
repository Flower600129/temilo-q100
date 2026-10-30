import { chromium, expect } from '@playwright/test';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// This suite is intentionally offline. Refuse the key-enabled personal preview.
const base = process.env.MOBILE_WEB_URL ?? 'http://127.0.0.1:8083';
if (base !== 'http://127.0.0.1:8083') throw new Error('Run npm run test:temilo; this script only accepts the isolated 8083 test server.');
const preflight = await fetch(`${base}/api/taste/status`).then((response) => response.json());
if (preflight.reason !== 'missing_key') throw new Error('The isolated server must have Qloo disabled before any browser action.');
const evidence = '.local/r0-evidence/journey';
const profile = await mkdtemp(join(tmpdir(), 'temilo-acceptance-'));
await mkdir(evidence, { recursive: true });
let context; let page; const errors = []; const requests = [];
const button = (name) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).last();
const text = (name) => page.getByText(name, { exact: true }).filter({ visible: true }).last();
const field = (name) => page.getByRole('textbox', { name, exact: true }).filter({ visible: true }).last();
const tab = (name) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).last();
async function launch() {
  context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  page = context.pages()[0];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.url().includes('/api/taste/resolve') && request.method() === 'POST') requests.push(JSON.parse(request.postData())); });
  await page.clock.install({ time: new Date('2026-10-29T12:00:00+08:00') });
  await page.goto(base);
}
async function read(mode = 'personal') {
  return page.evaluate(async (space) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('gift-memory-mobile-web'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const data = await new Promise((resolve, reject) => { const request = db.transaction('values').objectStore('values').get(`gift-memory-native-v1-${space}`); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return data ? JSON.parse(data) : null;
  }, mode);
}
async function addPerson(name, month, day, lead) {
  await page.goto(`${base}/people/new`); await field('Name').fill(name); await field('Birth month').fill(month); await field('Birth day').fill(day);
  await button(`${lead} days`).click();
  if (name === 'Alex') { await button('+ Add relationship & interests').click(); await field('Cultural interests (optional)').fill('Jane Austen'); await field('Avoid (optional)').fill('Perfume'); await field('Private notes (optional)').fill('Synthetic private note, never send to Qloo.'); }
  await button('Save person').click(); await text(name).waitFor(); return page.url();
}
try {
  await launch(); await text('Start with someone special.').waitFor();
  for (const name of ['Home', 'Wishlist', 'Friends', 'Me']) await tab(name).waitFor();
  const navigation = page.getByTestId('bottom-navigation').filter({ visible: true }).last();
  await expect(navigation.getByTestId('nav-home-filled')).toBeVisible();
  await expect(navigation.getByTestId(/^nav-.+-outline$/)).toHaveCount(3);
  await page.screenshot({ path: `${evidence}/temilo-empty.png`, fullPage: true });
  const outsideUrl = await addPerson('Outside window', '8', '1', 7);
  await tab('Home').click(); await text('A little time to breathe.').waitFor();
  await expect(page.getByTestId('birthday-current-card').filter({ visible: true }).last()).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/temilo-no-reminders.png`, fullPage: true });
  await button('View friends →').click(); await button('View Outside window').click();
  await expect(navigation.getByTestId('nav-people-filled')).toBeVisible();
  await button('Delete person').click(); await button('Confirm deletion').click();
  await expect.poll(async () => (await read()).people.some((entry) => entry.id === outsideUrl.split('/').at(-1))).toBe(false);
  const alexUrl = await addPerson('Alex', '10', '31', 60);
  const alexId = alexUrl.split('/').at(-1);
  await button('+ Add a date').click(); await button('Anniversary').click(); await field('Occasion name').fill('Friendship day'); await field('Month').fill('12'); await field('Day').fill('12'); await button('60 days').click(); await button('Save date').click(); await text('Friendship day').waitFor();
  await addPerson('Mia', '11', '12', 30); await addPerson('Emma', '12', '12', 60);
  await tab('Home').click(); await text('Upcoming birthdays').waitFor();
  await expect(page.getByTestId('birthday-current-card').filter({ visible: true }).last()).toContainText('ALEX'); await button('Next birthday').click(); await expect(page.getByTestId('birthday-current-card').filter({ visible: true }).last()).toContainText('MIA'); await button('Previous birthday').click();
  await expect(page.getByTestId('birthday-current-card').filter({ visible: true }).last()).toContainText('ALEX');
  await page.clock.runFor(100);
  const card = await page.getByTestId('birthday-current-card').filter({ visible: true }).last().boundingBox();
  await page.mouse.move(card.x + card.width * 0.65, card.y + 110); await page.mouse.down();
  await page.mouse.move(card.x + card.width * 0.65 - 95, card.y + 111, { steps: 12 }); await page.mouse.up();
  await expect(page.getByTestId('birthday-current-card').filter({ visible: true }).last()).toContainText('MIA'); await button('Previous birthday').click();
  await page.screenshot({ path: `${evidence}/temilo-home.png`, fullPage: true });
  const data = await read(); expect(data.people).toHaveLength(3); expect(data.occasions.find((o) => o.personId === alexId && o.type === 'birthday').reminderDaysBefore).toEqual([60]);
  await tab('Wishlist').click(); await button('+ Save a wish').click(); await field('Wish title').fill('Tea set'); await button('For a friend').click(); await button('Choose a friend').click(); await page.getByRole('radio', { name: 'Alex', exact: true }).filter({ visible: true }).last().click();
  await field('Link (optional)').fill('https://example.com/tea'); await field('Source or private note (optional)').fill('Mentioned in conversation.'); await button('Save wish').click();
  await button('Friends’ wishes').click(); await button('Open wish Tea set').click(); await field('Wish title').waitFor(); await button('Fulfilled').click(); await button('Save wish').click();
  await expect.poll(async () => (await read()).wishes[0].status).toBe('fulfilled');
  await button('Fulfilled').click(); await button('Open wish Tea set').click(); await field('Wish title').waitFor(); await button('Want').click(); await button('Save wish').click();
  await expect.poll(async () => (await read()).wishes[0].status).toBe('active');
  await tab('Wishlist').click(); await button('My wishes').click(); await button('+ Save a wish').click();
  await field('Wish title').fill('A quiet morning'); await button('Archived').click(); await button('Save wish').click();
  await button('Open wish A quiet morning').click(); await field('Wish title').waitFor(); await field('Wish title').fill('Quiet morning walk'); await button('Save wish').click();
  await button('Open wish Quiet morning walk').click(); await field('Wish title').waitFor(); await button('Delete wish').click(); await button('Confirm deletion').click();
  await expect.poll(async () => (await read()).wishes.length).toBe(1);
  await tab('Me').click(); await button('My gift box').click(); await button('+ Add to gift box').click();
  await field('Gift name').fill('Tea set'); await field('Quantity in stock').fill('3'); await field('Storage location (optional)').fill('Top shelf'); await field('Unit cost (optional)').fill('20'); await field('Currency').fill('CNY');
  await button('Save item').click(); await text('3 left').waitFor();
  await page.screenshot({ path: `${evidence}/temilo-inventory.png`, fullPage: true });
  await tab('Friends').click(); await button('View Alex').click(); await button('Prepare a gift').click(); await text('Known wishes').waitFor();
  await page.getByRole('radio', { name: 'From gift box', exact: true }).filter({ visible: true }).last().click(); await button('From your gift box').click(); await page.getByRole('radio', { name: 'Tea set · 3 left', exact: true }).filter({ visible: true }).last().click(); await page.getByRole('radio', { name: 'Birthday · Oct 31', exact: true }).filter({ visible: true }).last().click(); await field('Gift quantity').fill('1'); await field('Gift note (optional)').fill('Keep this preparation note.'); await button('Save gift plan').click();
  await button('Confirm given').waitFor(); expect((await read()).inventory[0].quantity).toBe(3);
  await page.reload(); await button('Confirm given').waitFor(); await button('Confirm given').click(); await button('Mark as given').dblclick();
  await button('Undo gift').waitFor(); expect((await read()).inventory[0].quantity).toBe(2); expect((await read()).gifts).toHaveLength(1);
  // R1 keeps preparation notes and post-gift feedback independent.
  await field('Gift feedback (optional)').fill('Loved the tea.'); await button('Save feedback').click(); await text('Feedback saved').waitFor();
  expect((await read()).gifts[0]).toMatchObject({ note: 'Keep this preparation note.', feedback: 'Loved the tea.' });
  await page.screenshot({ path: `${evidence}/temilo-given.png`, fullPage: true });
  await button('Undo gift').click(); await button('Undo & restore').dblclick(); await text('Alex · Cancelled').waitFor(); expect((await read()).inventory[0].quantity).toBe(3);
  await page.goto(`${base}/inventory`); await button('Open item Tea set').click(); await field('Quantity in stock').fill('0'); await button('Save item').click(); await text('Out of stock').waitFor();
  await page.goto(`${base}/gift-plan/${alexId}`); await page.getByRole('radio', { name: 'From gift box', exact: true }).filter({ visible: true }).last().click(); await button('From your gift box').click(); await page.getByRole('radio', { name: 'Tea set · 0 left', exact: true }).filter({ visible: true }).last().click(); await button('Save gift plan').click(); await button('Confirm given').click(); await button('Mark as given').click();
  await text('Not enough stock. Your plan and inventory have been kept.').waitFor(); expect((await read()).inventory[0].quantity).toBe(0); expect((await read()).gifts.filter((g) => g.status === 'given')).toHaveLength(0); await button('Cancel').click();
  await tab('Home').click(); await button('Find gift ideas →').click(); await button('Choose a friend').click(); await page.getByRole('radio', { name: 'Alex', exact: true }).filter({ visible: true }).last().click();
  await button('I confirm these are cultural interests and agree to query Qloo').click(); await button('1. Find verified entities').click();
  const serverStatus = await (await page.request.get(`${base}/api/taste/status`)).json();
  if (serverStatus.reason === 'missing_key') await text('Qloo is unavailable: the server key has not been configured. You can continue with wishes and your gift box.').waitFor();
  else throw new Error('This acceptance script expects the known missing-key environment; perform live Qloo verification separately.');
  expect(requests).toHaveLength(1); expect(requests[0]).toEqual({ interests: ['Jane Austen'] }); expect((await read()).tasteRuns).toEqual([]);
  await page.screenshot({ path: `${evidence}/temilo-qloo-blocked.png`, fullPage: true });
  await button('Check a gift').click(); await field('Candidate gift').fill('Perfume'); await field('Known price (optional)').fill('10'); await field('Price currency').fill('USD'); await field('Budget (optional)').fill('100'); await field('Budget currency').fill('CNY'); await button('Check against my records').click();
  await text('Check carefully · Title contains an avoid keyword: Perfume.').waitFor(); await text('Unverified · Budget fit is unverified without a price and budget in the same currency.').waitFor();
  await page.screenshot({ path: `${evidence}/temilo-gift-check.png`, fullPage: true });
  const beforeDemo = await read(); await tab('Me').click(); await text('Discard unsaved changes?').waitFor(); await button('Discard & leave').click(); await button('Data & help').click(); await button('Explore demo').click(); await text('Current space: fictional demo. 2 people saved.').waitFor();
  expect(await read()).toEqual(beforeDemo); await page.reload(); await text('Current space: fictional demo. 2 people saved.').waitFor();
  await button('Reset fictional demo').click(); await button('Reset demo').click(); await text('Demo data has been restored.').waitFor(); expect(await read()).toEqual(beforeDemo);
  await context.close(); await launch(); await tab('Me').click(); await button('Data & help').click(); await text('Current space: fictional demo. 2 people saved.').waitFor(); await button('Personal space').click();
  expect(await read()).toEqual(beforeDemo); await tab('Home').click(); await text('Continue preparing').waitFor();
  await page.setViewportSize({ width: 390, height: 1700 });
  await page.screenshot({ path: `${evidence}/temilo-home-long.png`, fullPage: true });
  for (const width of [320, 360, 390, 520, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/wishes', '/people', '/me', '/inventory', '/smart-gifting']) {
      await page.goto(`${base}${route}`); await text(({ '/': 'Upcoming birthdays', '/wishes': 'Little wishes, kept close.', '/people': 'The people you care about.', '/me': 'A space for your thoughtfulness.', '/inventory': 'Your gift box.', '/smart-gifting': 'A little help, choosing well.' })[route]).waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${route} overflows at ${width}`).toBe(false);
    }
  }
  expect(errors).toEqual([]);
  console.log('PASS: four tabs with filled/outline states, honest no-reminder state, person + independent 30/60-day reminders, birthdays across months, carousel drag + arrows, own/friend wish CRUD/status, inventory, plan/give/double-submit/undo, zero-stock protection, private feedback, Qloo missing-key UI + minimal payload, local gift checks, demo isolation/reset, browser restart, 320–1280px routes.');
} catch (error) {
  if (page && !page.isClosed()) { console.error('Isolated journey failed at:', page.url()); await page.screenshot({ path: `${evidence}/temilo-failure.png`, fullPage: true }).catch(() => {}); }
  throw error;
} finally { await context?.close(); }
