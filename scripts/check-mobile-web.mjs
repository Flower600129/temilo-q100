import { chromium } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.MOBILE_WEB_URL ?? 'http://127.0.0.1:8082';
const profile = await mkdtemp(join(tmpdir(), 'gift-memory-mobile-web-'));
const name = 'P0 Browser Preview';
let context;

const launch = () => chromium.launchPersistentContext(profile, {
  headless: true,
  viewport: { width: 390, height: 844 },
});

try {
  context = await launch();
  let page = context.pages()[0] ?? await context.newPage();
  await page.goto(baseUrl);
  await page.getByText('Thoughtfulness starts with someone.').waitFor();
  await page.getByRole('button', { name: '+ Add a person' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('textbox', { name: 'Birth month' }).fill('12');
  await page.getByRole('textbox', { name: 'Birth day' }).fill('25');
  await page.getByRole('button', { name: 'Save person' }).click();
  await page.getByText(name, { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByText(`days until ${name}’s birthday`).filter({ visible: true }).first().waitFor();
  await page.screenshot({ path: 'docs/evidence/p0-native-web-preview.png', fullPage: true });

  await context.close();
  context = await launch();
  page = context.pages()[0] ?? await context.newPage();
  await page.goto(baseUrl);
  await page.getByText(`days until ${name}’s birthday`).filter({ visible: true }).first().waitFor();
  console.log('PASS: native-source web preview saves a person, shows the countdown, and retains it after browser restart.');
} finally {
  await context?.close();
}
