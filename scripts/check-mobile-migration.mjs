import { chromium, expect } from '@playwright/test';
const profile = process.argv[2];
if (!profile) throw new Error('Pass the isolated legacy test-browser profile path. Never use a real personal browser profile.');
const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 390, height: 844 } });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('http://127.0.0.1:8082/people');
  await expect(page.getByRole('button', { name: 'View Concurrent A', exact: true })).toBeVisible();
  const databases = await page.evaluate(async () => (await indexedDB.databases()).map((entry) => entry.name));
  expect(databases).toContain('gift-memory-mobile-web');
  const imported = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('gift-memory-mobile-web', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('values').objectStore('values').get('gift-memory-native-v1-personal');
      get.onsuccess = () => { resolve(JSON.parse(get.result).people.map((person) => person.displayName)); db.close(); };
      get.onerror = () => { reject(get.error); db.close(); };
    };
  }));
  expect(imported).toContain('Concurrent A');
  await page.reload();
  await expect(page.getByRole('button', { name: 'View Concurrent A', exact: true })).toBeVisible();
  console.log('PASS: the real legacy SQLite preview record was imported into IndexedDB and survived reload.');
} finally { await context.close(); }
