import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '../.verify');
fs.mkdirSync(out, { recursive: true });
const errors = [];

const browser = await chromium.launch({ headless: true });

async function run(name, options, visit) {
  const page = await browser.newPage(options);
  page.on('pageerror', (e) => errors.push(`${name} ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name} ${m.text()}`);
  });
  await visit(page);
  await page.close();
}

await run('live-desktop', { viewport: { width: 1440, height: 900 } }, async (page) => {
  await page.goto('http://127.0.0.1:5173/?t=15.2', { waitUntil: 'networkidle' });
  await page.waitForSelector('#stage', { state: 'visible' });
  await page.waitForTimeout(800);
  const h1 = await page.locator('h1').textContent();
  const composer = await page.locator('#composer').isVisible();
  await page.screenshot({ path: path.join(out, 'polish-live-desktop.png') });
  fs.writeFileSync(path.join(out, 'polish-live.json'), JSON.stringify({ h1, composer }));
});

await run('word-desktop', { viewport: { width: 1440, height: 900 } }, async (page) => {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#stage', { state: 'visible' });
  await page.waitForTimeout(900);
  await page.click('#sub-word');
  await page.waitForTimeout(200);
  await page.fill('#word-input', 'loop');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, 'polish-word-desktop.png') });
});

await run(
  'mobile',
  { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  async (page) => {
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#stage', { state: 'visible' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, 'polish-live-mobile.png') });
    await page.click('#sub-word');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, 'polish-word-mobile.png') });
  }
);

await browser.close();
console.log(JSON.stringify({ errors }, null, 2));
if (errors.length) process.exit(1);
