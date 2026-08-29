import { createStudio } from './scene.js';

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

const params = new URLSearchParams(location.search);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const studio = createStudio(canvas);
const baseHue = studio.getHue();

const SPEEDS = [0.5, 1, 1.5];
const state = {
  mode: params.get('mode') === 'live' ? 'live' : 'film',
  playing: !reduceMotion,
  speed: Number(params.get('speed')) || 1,
  hue: params.has('hue') ? Number(params.get('hue')) : 0,
  scrubbing: false,
};

if (![0.5, 1, 1.5].includes(state.speed)) state.speed = 1;

function formatTime(t) {
  return t.toFixed(1).padStart(4, '0');
}

function duration() {
  return state.mode === 'film' ? film.duration || studio.duration : studio.duration;
}

function currentTime() {
  return state.mode === 'film' ? film.currentTime || 0 : studio.getTime();
}

function setTime(t) {
  const d = duration();
  const wrapped = ((t % d) + d) % d;
  film.currentTime = wrapped;
  studio.setTime(wrapped);
}

function setPlaying(next) {
  state.playing = next;
  playBtn.setAttribute('aria-pressed', String(next));
  playBtn.setAttribute('aria-label', next ? 'Pause' : 'Play');
  film.playbackRate = state.speed;
  if (state.mode === 'film') {
    if (next) film.play().catch(() => {});
    else film.pause();
  } else {
    film.pause();
  }
}

function setMode(mode) {
  state.mode = mode;
  const live = mode === 'live';
  film.hidden = live;
  canvas.hidden = !live;
  studio.resize();
  studio.setOrbit(live);
  modeFilm.setAttribute('aria-selected', String(!live));
  modeLive.setAttribute('aria-selected', String(live));
  document.body.dataset.mode = mode;
  if (live) {
    studio.setTime(film.currentTime || 0);
    studio.setHue(baseHue + state.hue);
    studio.resetView();
  } else {
    film.currentTime = studio.getTime();
    applyFilmHue();
  }
  setPlaying(state.playing);
  writeUrl();
}

function applyFilmHue() {
  const deg = Math.round(state.hue * 360);
  film.style.filter = deg ? `hue-rotate(${deg}deg)` : 'none';
}

function setHue(h) {
  state.hue = Math.min(1, Math.max(0, h));
  hue.value = String(Math.round(state.hue * 1000));
  if (state.mode === 'film') applyFilmHue();
  else studio.setHue(baseHue + state.hue);
}

function setSpeed(v) {
  state.speed = v;
  film.playbackRate = v;
  speedBtn.textContent = v === 1 ? '1×' : v === 0.5 ? '½×' : '1½×';
  speedBtn.setAttribute('aria-label', `Speed ${speedBtn.textContent}`);
  writeUrl();
}

function cycleSpeed() {
  const i = SPEEDS.indexOf(state.speed);
  setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
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
  history.replaceState(null, '', u);
}

function saveFrame() {
  const name = `trefoil-${state.mode}-${formatTime(currentTime()).replace('.', '-')}.png`;
  if (state.mode === 'live') {
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

playBtn.addEventListener('click', () => setPlaying(!state.playing));
modeFilm.addEventListener('click', () => setMode('film'));
modeLive.addEventListener('click', () => setMode('live'));
speedBtn.addEventListener('click', cycleSpeed);
shotBtn.addEventListener('click', saveFrame);
fullBtn.addEventListener('click', () => toggleFullscreen().catch(() => {}));
helpBtn.addEventListener('click', () => sheet.showModal());

scrub.addEventListener('pointerdown', () => {
  state.scrubbing = true;
});
scrub.addEventListener('pointerup', () => {
  state.scrubbing = false;
});
scrub.addEventListener('input', () => {
  const t = (Number(scrub.value) / 10000) * duration();
  setTime(t);
  timeEl.textContent = formatTime(currentTime());
});

hue.addEventListener('input', () => setHue(Number(hue.value) / 1000));

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const k = event.key;
  if (event.code === 'Space') {
    event.preventDefault();
    setPlaying(!state.playing);
  } else if (k === 'f' || k === 'F') setMode('film');
  else if (k === 'l' || k === 'L') setMode('live');
  else if (k === 'ArrowRight') setTime(currentTime() + 0.4);
  else if (k === 'ArrowLeft') setTime(currentTime() - 0.4);
  else if (k === ']' || k === '.') setHue(state.hue + 0.02);
  else if (k === '[' || k === ',') setHue(state.hue - 0.02);
  else if (k === '1') setSpeed(0.5);
  else if (k === '2') setSpeed(1);
  else if (k === '3') setSpeed(1.5);
  else if (k === 's' || k === 'S') saveFrame();
  else if (k === '0') studio.resetView();
  else if (k === 'h' || k === 'H') document.body.classList.toggle('clean');
  else if (k === '?' || k === '/') {
    event.preventDefault();
    sheet.open ? sheet.close() : sheet.showModal();
  }
});

window.addEventListener('resize', () => studio.resize());
new ResizeObserver(() => studio.resize()).observe(canvas);

film.addEventListener('loadedmetadata', () => {
  if (params.has('t')) setTime(Number(params.get('t')));
  syncScrub();
});

setHue(state.hue);
setSpeed(state.speed);
setMode(state.mode);
setPlaying(state.playing);

let last = performance.now();
let urlTick = 0;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'live') {
    studio.frame(dt, {
      playing: state.playing && !state.scrubbing,
      speed: state.speed,
    });
  } else if (!film.paused) {
    studio.setTime(film.currentTime);
  }
  syncScrub();
  urlTick += dt;
  if (urlTick > 1.5) {
    urlTick = 0;
    writeUrl();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
