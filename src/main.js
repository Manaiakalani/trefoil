const viewport = document.getElementById('viewport');
const film = document.getElementById('film');
const canvas = document.getElementById('stage');
const playBtn = document.getElementById('play');
const timeEl = document.getElementById('time');
const scrub = document.getElementById('scrub');
const hue = document.getElementById('hue');
const speedBtn = document.getElementById('speed');
const modeFilm = document.getElementById('mode-film');
const modeLive = document.getElementById('mode-live');
const shotBtn = document.getElementById('shot');
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

const params = new URLSearchParams(location.search);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEEDS = [0.5, 1, 1.5];
const ASIDES = {
  knot: 'one loop, three crossings',
  word: 'letters in candy',
  mark: 'a logo in candy',
};

const state = {
  mode: params.get('mode') === 'live' ? 'live' : 'film',
  playing: !reduceMotion,
  speed: Number(params.get('speed')) || 1,
  hue: params.has('hue') ? Number(params.get('hue')) : 0,
  subject: ['knot', 'word', 'mark'].includes(params.get('subject'))
    ? params.get('subject')
    : 'knot',
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

function formatTime(t) {
  return t.toFixed(1).padStart(4, '0');
}

function duration() {
  if (state.mode === 'film') return film.duration || 22.883333;
  return studio ? studio.duration : 22.883333;
}

function currentTime() {
  if (state.mode === 'film') return film.currentTime || 0;
  return studio ? studio.getTime() : 0;
}

function setTime(t) {
  const d = duration();
  const wrapped = ((t % d) + d) % d;
  film.currentTime = wrapped;
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
  film.playbackRate = state.speed;
  if (state.mode === 'film') {
    if (next) film.play().catch(() => {});
    else film.pause();
    stopLiveLoop();
  } else {
    film.pause();
    if (next) startLiveLoop();
    else stopLiveLoop();
  }
}

async function setMode(mode) {
  state.mode = mode;
  const live = mode === 'live';
  film.hidden = live;
  canvas.hidden = !live;
  document.body.dataset.mode = mode;
  modeFilm.setAttribute('aria-selected', String(!live));
  modeLive.setAttribute('aria-selected', String(live));
  if (live) {
    const s = await ensureStudio();
    s.resize();
    s.setOrbit(true);
    s.setTime(film.currentTime || 0);
    s.setHue(baseHue + state.hue);
    s.resetView();
  } else {
    if (studio) {
      studio.setOrbit(false);
      film.currentTime = studio.getTime();
    }
    applyFilmHue();
  }
  setPlaying(state.playing);
  syncComposer();
  writeUrl();
}

function applyFilmHue() {
  const deg = Math.round(state.hue * 360);
  film.style.filter = deg ? `hue-rotate(${deg}deg)` : 'none';
}

function setHue(h) {
  state.hue = Math.min(1, Math.max(0, h));
  hue.value = String(Math.round(state.hue * 1000));
  hue.setAttribute('aria-valuetext', `${Math.round(state.hue * 360)} degrees`);
  if (state.mode === 'film') applyFilmHue();
  else if (studio) studio.setHue(baseHue + state.hue);
}

function setSpeed(v) {
  state.speed = v;
  film.playbackRate = v;
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
  u.searchParams.set('mode', state.mode);
  u.searchParams.set('t', currentTime().toFixed(2));
  u.searchParams.set('hue', state.hue.toFixed(3));
  u.searchParams.set('speed', String(state.speed));
  u.searchParams.set('subject', state.subject);
  if (state.subject === 'word' && state.text) u.searchParams.set('text', state.text);
  else u.searchParams.delete('text');
  history.replaceState(null, '', u);
}

function syncComposer() {
  const live = state.mode === 'live';
  const showWord = live && state.subject === 'word';
  const showMark = live && state.subject === 'mark';
  composer.hidden = !(showWord || showMark);
  wordInput.hidden = !showWord;
  uploadLabel.hidden = !showMark;
  aside.textContent = ASIDES[state.subject];
  subKnot.setAttribute('aria-selected', String(state.subject === 'knot'));
  subWord.setAttribute('aria-selected', String(state.subject === 'word'));
  subMark.setAttribute('aria-selected', String(state.subject === 'mark'));
}

async function setSubject(kind, extra = {}) {
  state.subject = kind;
  if (typeof extra.text === 'string') state.text = extra.text;
  if (kind !== 'knot' && state.mode !== 'live') await setMode('live');
  else syncComposer();
  const s = await ensureStudio();
  try {
    await s.setSubject({ kind, text: state.text, file: extra.file });
  } catch (err) {
    uploadCopy.textContent = err.message || 'Could not use that file.';
    return;
  }
  uploadCopy.textContent =
    kind === 'mark' && extra.file ? extra.file.name : 'Drop a logo, or choose a file';
  writeUrl();
}

function saveFrame() {
  const name = `trefoil-${state.mode}-${formatTime(currentTime()).replace('.', '-')}.png`;
  if (state.mode === 'live' && studio) {
    download(studio.capture(), name);
    return;
  }
  const c = document.createElement('canvas');
  c.width = film.videoWidth || 1920;
  c.height = film.videoHeight || 1080;
  const ctx = c.getContext('2d');
  ctx.filter = film.style.filter || 'none';
  ctx.drawImage(film, 0, 0, c.width, c.height);
  download(c.toDataURL('image/png'), name);
}

function download(href, name) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
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

wordInput.addEventListener('input', () => {
  state.text = wordInput.value;
  window.clearTimeout(wordTimer);
  wordTimer = window.setTimeout(() => {
    setSubject('word', { text: state.text });
  }, 180);
});

subKnot.addEventListener('click', () => setSubject('knot'));
subWord.addEventListener('click', () => {
  setSubject('word', { text: state.text || wordInput.value });
  if (window.matchMedia('(pointer: fine)').matches) wordInput.focus();
});
subMark.addEventListener('click', () => setSubject('mark'));
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) setSubject('mark', { file });
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
  if (file) setSubject('mark', { file });
});

playBtn.addEventListener('click', () => setPlaying(!state.playing));
modeFilm.addEventListener('click', () => setMode('film'));
modeLive.addEventListener('click', () => setMode('live'));
speedBtn.addEventListener('click', cycleSpeed);
shotBtn.addEventListener('click', saveFrame);
fullBtn.addEventListener('click', () => toggleFullscreen().catch(() => {}));
helpBtn.addEventListener('click', () => sheet.showModal());
document.addEventListener('fullscreenchange', syncFullscreenLabel);

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
film.addEventListener('timeupdate', () => {
  if (state.mode === 'film') syncScrub();
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  const k = event.key;
  if (event.code === 'Space') {
    event.preventDefault();
    setPlaying(!state.playing);
  } else if (k === 'f' || k === 'F') setMode('film');
  else if (k === 'l' || k === 'L') setMode('live');
  else if (k === 'k' || k === 'K') setSubject('knot');
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
  else if (k === '0' && studio) studio.resetView();
  else if (k === 'h' || k === 'H') document.body.classList.toggle('clean');
  else if (k === '?' || k === '/') {
    event.preventDefault();
    sheet.open ? sheet.close() : sheet.showModal();
  }
});

film.addEventListener('loadedmetadata', () => {
  if (params.has('t')) setTime(Number(params.get('t')));
  syncScrub();
});

setHue(state.hue);
setSpeed(state.speed);
wordInput.value = state.text;
setMode(state.mode).then(() => {
  if (state.subject !== 'knot') setSubject(state.subject, { text: state.text });
  else syncComposer();
});
