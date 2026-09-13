import { chromium } from '/tmp/rainbow-knot-replica/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '../.verify');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];

async function run() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:5173/?mode=film', { waitUntil: 'networkidle' });
  await page.waitForSelector('#film');
  await page.waitForFunction(() => {
    const v = document.getElementById('film');
    return v && v.readyState >= 2;
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'film-desktop.png') });

  const filmHidden = await page.locator('#film').getAttribute('hidden');
  const t1 = await page.locator('#time').textContent();
  await page.waitForTimeout(1200);
  const t2 = await page.locator('#time').textContent();

  await page.click('#play');
  const paused = await page.getAttribute('#play', 'aria-label');
  const p1 = await page.locator('#time').textContent();
  await page.waitForTimeout(700);
  const p2 = await page.locator('#time').textContent();

  await page.click('#mode-live');
  await page.waitForTimeout(600);
  const liveHiddenFilm = await page.evaluate(() => document.getElementById('film').hidden);
  const liveCanvas = await page.evaluate(() => document.getElementById('stage').hidden);
  await page.screenshot({ path: path.join(out, 'live-desktop.png') });

  await page.click('#help');
  const dialogOpen = await page.evaluate(() => document.getElementById('sheet').open);
  await page.keyboard.press('Escape');

  await page.click('#mode-film');
  await page.fill('#hue', '300');
  await page.waitForTimeout(200);
  const filter = await page.evaluate(() => document.getElementById('film').style.filter);
  await page.screenshot({ path: path.join(out, 'film-hue.png') });

  fs.writeFileSync(
    path.join(out, 'desktop.json'),
    JSON.stringify({ t1, t2, paused, p1, p2, filmHidden, liveHiddenFilm, liveCanvas, dialogOpen, filter }, null, 2)
  );
  await page.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  mobile.on('pageerror', (e) => errors.push('mobile ' + e));
  await mobile.goto('http://127.0.0.1:5173/?mode=film', { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(900);
  await mobile.screenshot({ path: path.join(out, 'film-mobile.png') });
  await mobile.click('#mode-live');
  await mobile.waitForTimeout(500);
  await mobile.screenshot({ path: path.join(out, 'live-mobile.png') });
  await mobile.close();
}

await run();
await browser.close();
fs.writeFileSync(path.join(out, 'errors.json'), JSON.stringify(errors, null, 2));
console.log('errors', errors);
console.log(fs.readFileSync(path.join(out, 'desktop.json'), 'utf8'));
