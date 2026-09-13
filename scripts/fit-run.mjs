import { chromium } from '/tmp/rainbow-knot-replica/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const W = 400;
const H = 225;
const N = 46; // 2 fps, 22.88s
const FPS = 2;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.setDefaultTimeout(0);
page.on('pageerror', (e) => console.error('PAGEERROR', e));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE', m.text());
});

await page.goto(`http://127.0.0.1:8788/fit.html?w=${W}&h=${H}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

function frameUrl(i) {
  return `/frames/f_${String(i + 1).padStart(3, '0')}.jpg`;
}

console.log('load t=15 (frame 30)...');
const t15 = await page.evaluate(async (url) => {
  const tgt = await window.loadTarget(url);
  const seed = { x: 0.16, y: -0.14, z: 0.1 };
  const ts = window.searchTubeScale(tgt, seed.x, seed.y, seed.z);
  window.setTubeScale(ts.tube, ts.scale);
  const c1 = window.searchEuler(tgt, 6, seed.x, seed.y, seed.z, 22);
  const c4 = window.searchEuler(tgt, 2, c1.x, c1.y, c1.z, 8);
  const hue = window.searchHue(tgt, c4.x, c4.y, c4.z);
  return { ts, c1, c4, hue };
}, frameUrl(30));
console.log('t15', JSON.stringify(t15, null, 2));

const poses = new Array(N);
poses[30] = t15.c4;

async function refineAt(i, x0, y0, z0, step, span) {
  return page.evaluate(async ({ url, x0, y0, z0, step, span }) => {
    const tgt = await window.loadTarget(url);
    const a = window.searchEuler(tgt, step, x0, y0, z0, span);
    const b = window.searchEuler(tgt, Math.max(1, step / 2), a.x, a.y, a.z, Math.max(3, span / 2));
    return b;
  }, { url: frameUrl(i), x0, y0, z0, step, span });
}

console.log('track forward from 15...');
for (let i = 31; i < N; i++) {
  const p = poses[i - 1];
  poses[i] = await refineAt(i, p.x, p.y, p.z, 5, 18);
  console.log(i, (i / FPS).toFixed(1), poses[i].sil.toFixed(3), poses[i].mse.toFixed(0));
}
console.log('track backward from 15...');
for (let i = 29; i >= 0; i--) {
  const p = poses[i + 1];
  poses[i] = await refineAt(i, p.x, p.y, p.z, 5, 18);
  console.log(i, (i / FPS).toFixed(1), poses[i].sil.toFixed(3), poses[i].mse.toFixed(0));
}

const keys = poses.map((p, i) => ({
  t: i / FPS,
  e: [p.x, p.y, p.z],
  sil: p.sil,
  mse: p.mse,
}));

const out = {
  duration: 22.883333,
  tube: t15.ts.tube,
  groupScale: t15.ts.scale,
  hueOffset: t15.hue.h,
  keys,
};
fs.writeFileSync(path.join(root, 'src/fit.json'), JSON.stringify(out, null, 2));
console.log('wrote src/fit.json');
console.log('mean sil', keys.reduce((s, k) => s + k.sil, 0) / keys.length);

await page.evaluate(({ e, h, tube, scale }) => {
  window.setTubeScale(tube, scale);
  window.setHue(h);
  window.setEuler(e[0], e[1], e[2]);
}, { e: keys[0].e, h: t15.hue.h, tube: t15.ts.tube, scale: t15.ts.scale });
const shot0 = await page.evaluate(() => window.dataURL());
fs.writeFileSync(path.join('/tmp/knot-fit', 'fit_t00.jpg'), Buffer.from(shot0.split(',')[1], 'base64'));

await page.evaluate((e) => window.setEuler(e[0], e[1], e[2]), keys[10].e);
const shot5 = await page.evaluate(() => window.dataURL());
fs.writeFileSync(path.join('/tmp/knot-fit', 'fit_t05.jpg'), Buffer.from(shot5.split(',')[1], 'base64'));

await page.evaluate((e) => window.setEuler(e[0], e[1], e[2]), keys[30].e);
const shot15 = await page.evaluate(() => window.dataURL());
fs.writeFileSync(path.join('/tmp/knot-fit', 'fit_t15.jpg'), Buffer.from(shot15.split(',')[1], 'base64'));

await browser.close();
