const viewport = document.getElementById('viewport');
const canvas = document.getElementById('stage');
const poster = document.getElementById('poster');
const playBtn = document.getElementById('play');
const timeEl = document.getElementById('time');
const scrub = document.getElementById('scrub');
const hue = document.getElementById('hue');
const speedBtn = document.getElementById('speed');
const copyBtn = document.getElementById('copy');
const shotBtn = document.getElementById('shot');
const glbBtn = document.getElementById('export-glb');
const stlBtn = document.getElementById('export-stl');
const saveMenu = document.getElementById('save-menu');
const fullBtn = document.getElementById('full');
const helpBtn = document.getElementById('help');
const sheet = document.getElementById('sheet');
const aside = document.getElementById('aside');
const composer = document.getElementById('composer');
const wordInput = document.getElementById('word-input');
const uploadLabel = document.getElementById('upload-label');
const fileInput = document.getElementById('file');
const uploadCopy = document.getElementById('upload-copy');
const subKnot = document.getElementById('sub-knot');
const subWord = document.getElementById('sub-word');
const subMark = document.getElementById('sub-mark');
const families = document.getElementById('families');
const hint = document.getElementById('hint');

const params = new URLSearchParams(location.search);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEEDS = [0.5, 1, 1.5];
const KNOTS = ['trefoil', 'eight', 'cinq'];
const ASIDES = {
  trefoil: 'one loop, three crossings',
  eight: 'one loop, four crossings',
  cinq: 'one loop, five crossings',
  word: 'letters in candy',
  mark: 'a logo in candy',
};
const HINT_KEY = 'trefoil.hint.v1';

const state = {
  playing: !reduceMotion,
  speed: Number(params.get('speed')) || 1,
  hue: params.has('hue') ? Number(params.get('hue')) : 0,
  subject: ['knot', 'word', 'mark'].includes(params.get('subject'))
    ? params.get('subject')
    : 'knot',
  knot: KNOTS.includes(params.get('knot')) ? params.get('knot') : 'trefoil',
  text: params.get('text') || '',
  scrubbing: false,
};

if (!SPEEDS.includes(state.speed)) state.speed = 1;

let studio = null;
let studioPromise = null;
let baseHue = 0.66;
let raf = 0;
let last = 0;
let urlTick = 0;
let wordTimer = 0;
let copyTimer = 0;

const MAX_MARK_BYTES = 8 * 1024 * 1024;
const ALLOWED_MARK_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
const ALLOWED_MARK_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

function formatTime(t) {
  return t.toFixed(1).padStart(4, '0');
}

function duration() {
  return studio ? studio.duration : 22.883333;
}

function currentTime() {
  return studio ? studio.getTime() : 0;
}

function setTime(t) {
  const d = duration();
  const wrapped = ((t % d) + d) % d;
  if (studio) studio.setTime(wrapped);
}

async function ensureStudio() {
  if (studio) return studio;
  if (!studioPromise) {
    studioPromise = import('./scene.js').then(({ createStudio }) => {
      studio = createStudio(canvas);
      baseHue = studio.getHue();
      studio.resize();
      new ResizeObserver(() => studio.resize()).observe(canvas);
      return studio;
    });
  }
  return studioPromise;
}

function setPlaying(next) {
  state.playing = next;
  playBtn.setAttribute('aria-pressed', String(next));
  playBtn.setAttribute('aria-label', next ? 'Pause' : 'Play');
  if (next) startLiveLoop();
  else stopLiveLoop();
}

function setHue(h) {
  state.hue = Math.min(1, Math.max(0, h));
  hue.value = String(Math.round(state.hue * 1000));
  hue.setAttribute('aria-valuetext', `${Math.round(state.hue * 360)} degrees`);
  if (studio) studio.setHue(baseHue + state.hue);
}

function setSpeed(v) {
  state.speed = v;
  const label = v === 1 ? '1×' : v === 0.5 ? '½×' : '1½×';
  speedBtn.textContent = label;
  speedBtn.setAttribute('aria-label', `Speed ${label}`);
  writeUrl();
}

function cycleSpeed() {
  setSpeed(SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]);
}

function syncScrub() {
  const d = duration();
  const t = currentTime();
  if (!state.scrubbing && d) scrub.value = String(Math.round((t / d) * 10000));
  timeEl.textContent = formatTime(t);
}

function writeUrl() {
  const u = new URL(location.href);
  u.searchParams.set('t', currentTime().toFixed(2));
  u.searchParams.set('hue', state.hue.toFixed(3));
  u.searchParams.set('speed', String(state.speed));
  u.searchParams.set('subject', state.subject);
  if (state.subject === 'knot') u.searchParams.set('knot', state.knot);
  else u.searchParams.delete('knot');
  if (state.subject === 'word' && state.text) u.searchParams.set('text', state.text);
  else u.searchParams.delete('text');
  u.searchParams.delete('mode');
  history.replaceState(null, '', u);
}

function syncComposer() {
  const showWord = state.subject === 'word';
  const showMark = state.subject === 'mark';
  const showKnot = state.subject === 'knot';
  composer.hidden = !(showWord || showMark);
  wordInput.hidden = !showWord;
  uploadLabel.hidden = !showMark;
  families.hidden = !showKnot;
  aside.textContent = showKnot ? ASIDES[state.knot] : ASIDES[state.subject];
  subKnot.setAttribute('aria-selected', String(showKnot));
  subWord.setAttribute('aria-selected', String(showWord));
  subMark.setAttribute('aria-selected', String(showMark));
  for (const id of KNOTS) {
    const btn = document.getElementById(`knot-${id}`);
    if (btn) btn.setAttribute('aria-selected', String(showKnot && state.knot === id));
  }
}

async function setSubject(kind, extra = {}) {
  state.subject = kind;
  if (typeof extra.knot === 'string' && KNOTS.includes(extra.knot)) state.knot = extra.knot;
  if (typeof extra.text === 'string') state.text = extra.text;
  syncComposer();
  const s = await ensureStudio();
  try {
    await s.setSubject({
      kind,
      knot: state.knot,
      text: state.text,
      file: extra.file,
    });
  } catch (err) {
    uploadCopy.textContent = err.message || 'Could not use that file.';
    return;
  }
  uploadCopy.textContent =
    kind === 'mark' && extra.file ? extra.file.name : 'Drop a logo, or choose a file';
  writeUrl();
}

function saveFrame() {
  if (!studio) return;
  downloadHref(studio.capture(), `trefoil-${formatTime(currentTime()).replace('.', '-')}.png`);
  closeSaveMenu();
}

function downloadHref(href, name) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

function downloadBlob(blob, name) {
  const href = URL.createObjectURL(blob);
  downloadHref(href, name);
  window.setTimeout(() => URL.revokeObjectURL(href), 1500);
}

function closeSaveMenu() {
  if (saveMenu) saveMenu.open = false;
}

function stem() {
  const tag = state.subject === 'knot' ? state.knot : state.subject;
  return `trefoil-${tag}-${formatTime(currentTime()).replace('.', '-')}`;
}

async function exportModel(format) {
  if (!studio) return;
  closeSaveMenu();
  const object = studio.exportObject();
  try {
    if (format === 'glb') {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      const data = await new GLTFExporter().parseAsync(object, { binary: true });
      downloadBlob(new Blob([data], { type: 'model/gltf-binary' }), `${stem()}.glb`);
    } else {
      const { STLExporter } = await import('three/addons/exporters/STLExporter.js');
      const data = new STLExporter().parse(object, { binary: true });
      downloadBlob(new Blob([data], { type: 'model/stl' }), `${stem()}.stl`);
    }
  } catch (err) {
    console.error(err);
  }
}

async function copyLink() {
  writeUrl();
  const text = location.href;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  copyBtn.textContent = 'Copied';
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyBtn.textContent = 'Copy link';
  }, 1400);
}

function dismissHint() {
  if (!hint || hint.hidden) return;
  hint.hidden = true;
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* private mode */
  }
}

function showHint() {
  if (!hint) return;
  try {
    if (localStorage.getItem(HINT_KEY)) return;
  } catch {
    /* show anyway */
  }
  hint.hidden = false;
}

async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await viewport.requestFullscreen();
}

function syncFullscreenLabel() {
  fullBtn.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
}

function startLiveLoop() {
  if (raf || !studio) return;
  last = performance.now();
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    studio.frame(dt, {
      playing: state.playing && !state.scrubbing,
      speed: state.speed,
    });
    syncScrub();
    urlTick += dt;
    if (urlTick > 1.5) {
      urlTick = 0;
      writeUrl();
    }
  };
  raf = requestAnimationFrame(tick);
}

function stopLiveLoop() {
  if (!raf) return;
  cancelAnimationFrame(raf);
  raf = 0;
}

function assertMarkFile(file) {
  if (file.size > MAX_MARK_BYTES) {
    throw new Error('Use an image under 8 MB.');
  }
  const typed = file.type && ALLOWED_MARK_TYPES.has(file.type);
  const named = ALLOWED_MARK_EXT.test(file.name || '');
  if (!typed && !named) {
    throw new Error('Use a PNG, JPEG, WebP, SVG, or GIF.');
  }
}

wordInput.addEventListener('input', () => {
  state.text = wordInput.value;
  window.clearTimeout(wordTimer);
  wordTimer = window.setTimeout(() => {
    setSubject('word', { text: state.text });
  }, 180);
});

subKnot.addEventListener('click', () => setSubject('knot', { knot: state.knot }));
subWord.addEventListener('click', () => {
  setSubject('word', { text: state.text || wordInput.value });
  if (window.matchMedia('(pointer: fine)').matches) wordInput.focus();
});
subMark.addEventListener('click', () => setSubject('mark'));

for (const id of KNOTS) {
  const btn = document.getElementById(`knot-${id}`);
  if (!btn) continue;
  btn.addEventListener('click', () => setSubject('knot', { knot: id }));
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  try {
    assertMarkFile(file);
  } catch (err) {
    uploadCopy.textContent = err.message;
    fileInput.value = '';
    return;
  }
  setSubject('mark', { file });
});

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

viewport.addEventListener('dragover', (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  document.body.classList.add('dropping');
});
viewport.addEventListener('dragleave', (event) => {
  if (event.relatedTarget && viewport.contains(event.relatedTarget)) return;
  document.body.classList.remove('dropping');
});
viewport.addEventListener('drop', (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  document.body.classList.remove('dropping');
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (!file) return;
  try {
    assertMarkFile(file);
  } catch (err) {
    uploadCopy.textContent = err.message;
    return;
  }
  setSubject('mark', { file });
});

canvas.addEventListener('dblclick', () => {
  if (studio) studio.resetView();
});

playBtn.addEventListener('click', () => setPlaying(!state.playing));
speedBtn.addEventListener('click', cycleSpeed);
copyBtn.addEventListener('click', () => copyLink().catch(() => {}));
shotBtn.addEventListener('click', saveFrame);
glbBtn.addEventListener('click', () => exportModel('glb'));
stlBtn.addEventListener('click', () => exportModel('stl'));
fullBtn.addEventListener('click', () => toggleFullscreen().catch(() => {}));
helpBtn.addEventListener('click', () => {
  dismissHint();
  sheet.showModal();
});
hint?.addEventListener('click', dismissHint);
document.addEventListener('fullscreenchange', syncFullscreenLabel);

document.addEventListener('pointerdown', (event) => {
  if (saveMenu?.open && !saveMenu.contains(event.target)) closeSaveMenu();
});

scrub.addEventListener('pointerdown', (event) => {
  state.scrubbing = true;
  scrub.setPointerCapture(event.pointerId);
});
scrub.addEventListener('pointerup', () => {
  state.scrubbing = false;
});
scrub.addEventListener('pointercancel', () => {
  state.scrubbing = false;
});
scrub.addEventListener('input', () => {
  const t = (Number(scrub.value) / 10000) * duration();
  setTime(t);
  timeEl.textContent = formatTime(currentTime());
});

hue.addEventListener('input', () => setHue(Number(hue.value) / 1000));

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  const k = event.key;
  if (event.code === 'Space') {
    event.preventDefault();
    setPlaying(!state.playing);
  } else if (k === 'k' || k === 'K') setSubject('knot', { knot: state.knot });
  else if (k === 't' || k === 'T') setSubject('knot', { knot: 'trefoil' });
  else if (k === 'e' || k === 'E') setSubject('knot', { knot: 'eight' });
  else if (k === 'c' || k === 'C') setSubject('knot', { knot: 'cinq' });
  else if (k === 'w' || k === 'W') {
    setSubject('word', { text: state.text || wordInput.value });
    if (window.matchMedia('(pointer: fine)').matches) wordInput.focus();
  } else if (k === 'm' || k === 'M') setSubject('mark');
  else if (k === 'ArrowRight') setTime(currentTime() + 0.4);
  else if (k === 'ArrowLeft') setTime(currentTime() - 0.4);
  else if (k === ']' || k === '.') setHue(state.hue + 0.02);
  else if (k === '[' || k === ',') setHue(state.hue - 0.02);
  else if (k === '1') setSpeed(0.5);
  else if (k === '2') setSpeed(1);
  else if (k === '3') setSpeed(1.5);
  else if (k === 's' || k === 'S') saveFrame();
  else if (k === 'l' || k === 'L') copyLink().catch(() => {});
  else if (k === '0' && studio) studio.resetView();
  else if (k === 'h' || k === 'H') document.body.classList.toggle('clean');
  else if (k === '?' || k === '/') {
    event.preventDefault();
    dismissHint();
    sheet.open ? sheet.close() : sheet.showModal();
  }
});

setHue(state.hue);
setSpeed(state.speed);
wordInput.value = state.text;
syncComposer();

ensureStudio()
  .then((s) => {
    if (params.has('t')) s.setTime(Number(params.get('t')));
    s.setHue(baseHue + state.hue);
    if (state.subject !== 'knot' || state.knot !== 'trefoil') {
      return setSubject(state.subject, { knot: state.knot, text: state.text });
    }
  })
  .then(() => {
    if (poster) poster.hidden = true;
    canvas.hidden = false;
    if (studio) studio.resize();
    setPlaying(state.playing);
    syncScrub();
    showHint();
  });
