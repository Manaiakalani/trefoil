import { chromium } from 'playwright';

const url = process.env.SMOKE_URL || 'http://127.0.0.1:4173/';
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const text = m.text();
  if (text.includes("directive 'frame-ancestors' is ignored")) return;
  errors.push(text);
});

await page.goto(url, { waitUntil: 'networkidle' });
if (await page.locator('#film').count()) errors.push('film element should not exist');
if (await page.locator('video').count()) errors.push('video element should not exist');
await page.waitForSelector('#stage', { state: 'visible', timeout: 20000 });
await page.waitForTimeout(600);
const canvas = await page.locator('#stage').isVisible();
if (!canvas) errors.push('stage canvas not visible');

await page.click('#knot-eight');
await page.waitForTimeout(500);
if ((await page.locator('#knot-eight').getAttribute('aria-selected')) !== 'true') {
  errors.push('eight knot not selected');
}

await page.click('#sub-word');
await page.waitForTimeout(400);
await page.fill('#word-input', 'ok');
await page.waitForTimeout(800);

if (!(await page.locator('#copy').isVisible())) errors.push('copy link missing');
if (!(await page.locator('#save-menu').count())) errors.push('save menu missing');

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('smoke ok');
