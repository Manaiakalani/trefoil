import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '../.verify');
fs.mkdirSync(out, { recursive: true });
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(out, 'subject-knot.png') });

await page.click('#sub-word');
await page.waitForTimeout(200);
await page.fill('#word-input', 'hello');
await page.waitForTimeout(800);
const asideWord = await page.locator('#aside').textContent();
const composerVisible = await page.locator('#composer').isVisible();
await page.screenshot({ path: path.join(out, 'subject-word.png') });

await page.click('#sub-mark');
await page.setInputFiles('#file', '/tmp/test-mark.png');
await page.waitForTimeout(800);
const asideMark = await page.locator('#aside').textContent();
await page.screenshot({ path: path.join(out, 'subject-mark.png') });

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
mobile.on('pageerror', (e) => errors.push('mobile ' + e));
await mobile.goto('http://127.0.0.1:5173/?subject=word&text=✦', { waitUntil: 'networkidle' });
await mobile.waitForTimeout(900);
await mobile.screenshot({ path: path.join(out, 'subject-mobile-word.png') });

await browser.close();
fs.writeFileSync(
  path.join(out, 'subject.json'),
  JSON.stringify({ asideWord, composerVisible, asideMark, errors }, null, 2)
);
console.log(JSON.stringify({ asideWord, composerVisible, asideMark, errors }, null, 2));
