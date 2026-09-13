import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'docs/raw');
fs.mkdirSync(rawDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto('http://127.0.0.1:5173/?mode=film&t=2', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.click('#mode-live');
await page.waitForTimeout(900);
const box = await page.locator('#stage').boundingBox();
if (box) {
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.48;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 160, y - 40, { steps: 18 });
  await page.mouse.move(x + 40, y + 80, { steps: 16 });
  await page.mouse.up();
}
await page.waitForTimeout(400);
await page.click('#sub-word');
await page.waitForTimeout(250);
await page.fill('#word-input', '');
await page.type('#word-input', 'hello', { delay: 90 });
await page.waitForTimeout(1600);
await page.close();
await context.close();
await browser.close();

const webm = fs.readdirSync(rawDir).find((f) => f.endsWith('.webm'));
if (!webm) throw new Error('No webm recorded');
const input = path.join(rawDir, webm);
const gif = path.join(root, 'docs/demo.gif');
const result = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    input,
    '-t',
    '8',
    '-vf',
    'fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:reserve_transparent=0[p];[s1][p]paletteuse=dither=bayer',
    gif,
  ],
  { stdio: 'inherit' }
);
if (result.status !== 0) process.exit(result.status || 1);
const mb = (fs.statSync(gif).size / (1024 * 1024)).toFixed(2);
console.log('wrote', gif, mb, 'MB');
