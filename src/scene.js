import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import fit from './fit.json';
import { shapesFromCanvas, extrudeCandy } from './contours.js';

const DURATION = fit.duration || 22.883333;

function isCoarse() {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720;
}

const CONFIG = {
  tube: fit.tube ?? 0.3,
  tubularSegments: 400,
  radialSegments: 32,
  groupScale: fit.groupScale ?? 0.78,
  hueOffset: fit.hueOffset ?? 0.66,
  sat: 0.98,
  lit: 0.57,
  camY: 5.6,
  camZ: 26.5,
  fov: 22,
  floorY: -3.9,
};

class WikiTrefoil extends THREE.Curve {
  getPoint(t, target = new THREE.Vector3()) {
    const u = t * Math.PI * 2;
    return target.set(
      Math.sin(u) + 2 * Math.sin(2 * u),
      Math.cos(u) - 2 * Math.cos(2 * u),
      -Math.sin(3 * u)
    );
  }
}

function candyColor(u, offset, sat, lit, out) {
  let h = (u + offset) % 1;
  if (h < 0) h += 1;
  const warped = h < 0.2 ? h * 0.7 : 0.14 + (h - 0.2) * 1.075;
  return out.setHSL(warped % 1, sat, lit);
}

function wrapLines(text, maxChars) {
  const raw = text.trim() || 'Aa';
  const words = raw.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) line = next;
    else {
      if (line) lines.push(line);
      if (word.length > maxChars) {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        line = '';
      } else line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function isPictographic(text) {
  try {
    const compact = text.replace(/\s/g, '');
    return compact.length <= 8 && /\p{Extended_Pictographic}/u.test(compact);
  } catch {
    return false;
  }
}

export function createStudio(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setClearColor(0xffffff, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(CONFIG.fov, 16 / 9, 0.1, 100);
  camera.position.set(0, CONFIG.camY, CONFIG.camZ);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 14;
  controls.maxDistance = 42;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.rotateSpeed = 0.55;
  controls.target.set(0, 0.04, 0);
  controls.enabled = false;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.1;

  scene.add(new THREE.AmbientLight(0xffffff, 1.28));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffeef6, 0.72));
  const key = new THREE.DirectionalLight(0xffffff, 0.38);
  key.position.set(2.2, 8.5, 6.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff4ea, 0.22);
  fill.position.set(-6, 3.5, 2);
  scene.add(fill);

  const knotGroup = new THREE.Group();
  scene.add(knotGroup);

  const _col = new THREE.Color();
  let kind = 'knot';
  let wordText = 'Aa';
  let subjectGen = 0;
  const curve = new WikiTrefoil();

  function candyMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.56,
      metalness: 0,
      envMapIntensity: 0.12,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += vColor * 0.52;`
      );
    };
    return mat;
  }

  function paintMesh(mesh) {
    const geo = mesh.geometry;
    const count = geo.attributes.position.count;
    let colors = geo.attributes.color;
    if (!colors) {
      colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
      geo.setAttribute('color', colors);
    }
    if (mesh.userData.paint === 'uv' && geo.attributes.uv) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        candyColor(uv.getX(i), CONFIG.hueOffset, CONFIG.sat, CONFIG.lit, _col);
        colors.setXYZ(i, _col.r, _col.g, _col.b);
      }
    } else {
      geo.computeBoundingBox();
      const min = geo.boundingBox.min.x;
      const span = Math.max(1e-6, geo.boundingBox.max.x - min);
      const pos = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        candyColor((pos.getX(i) - min) / span, CONFIG.hueOffset, CONFIG.sat, CONFIG.lit, _col);
        colors.setXYZ(i, _col.r, _col.g, _col.b);
      }
    }
    colors.needsUpdate = true;
  }

  function paintColors() {
    knotGroup.traverse((obj) => {
      if (obj.isMesh && obj.userData.candy) paintMesh(obj);
    });
  }

  function disposeObject(obj) {
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (mat.map) mat.map.dispose();
          if (mat.emissiveMap && mat.emissiveMap !== mat.map) mat.emissiveMap.dispose();
          mat.dispose();
        }
      }
    });
  }

  function clearSubject() {
    const children = [...knotGroup.children];
    for (const child of children) {
      knotGroup.remove(child);
      disposeObject(child);
    }
  }

  function makeKnot() {
    const coarse = isCoarse();
    const geo = new THREE.TubeGeometry(
      curve,
      coarse ? 180 : CONFIG.tubularSegments,
      CONFIG.tube,
      coarse ? 16 : CONFIG.radialSegments,
      true
    );
    geo.center();
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, candyMaterial());
    mesh.userData.candy = true;
    mesh.userData.paint = 'uv';
    knotGroup.add(mesh);
    knotGroup.scale.setScalar(CONFIG.groupScale);
    paintColors();
  }

  function cropOpaque(src) {
    const sctx = src.getContext('2d');
    const img = sctx.getImageData(0, 0, src.width, src.height);
    let minX = src.width;
    let minY = src.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const a = img.data[(y * src.width + x) * 4 + 3];
        if (a < 40) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX <= minX || maxY <= minY) return src;
    const pad = 12;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(src.width, maxX + pad);
    maxY = Math.min(src.height, maxY + pad);
    const c = document.createElement('canvas');
    c.width = Math.max(8, maxX - minX);
    c.height = Math.max(8, maxY - minY);
    c.getContext('2d').drawImage(src, minX, minY, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  }

  function makeCast(canvas) {
    const shapes = shapesFromCanvas(canvas);
    if (!shapes.length) throw new Error('Could not read a shape from that.');
    const geo = extrudeCandy(shapes, 7.1, CONFIG.tube);
    const mesh = new THREE.Mesh(geo, candyMaterial());
    mesh.userData.candy = true;
    mesh.userData.paint = 'x';
    knotGroup.add(mesh);
    knotGroup.scale.setScalar(1);
    paintColors();
  }

  async function drawWordCanvas(text) {
    const lines = wrapLines(text, 14);
    const pictographic = isPictographic(text);
    const size = 1400;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const fontSize = pictographic
      ? Math.round(size * (lines.join('').length <= 2 ? 0.62 : 0.36))
      : Math.round(size * (lines.length > 1 ? 0.18 : 0.26));
    try {
      await document.fonts.load(`600 ${fontSize}px Syne`);
    } catch {
      /* system fallback is fine */
    }
    ctx.font = `600 ${fontSize}px Syne, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    const startY = size / 2 - ((lines.length - 1) * fontSize * 1.05) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, size / 2, startY + i * fontSize * 1.1, size * 0.92);
    });
    return cropOpaque(c);
  }

  async function canvasFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not read that image.'));
        image.src = url;
      });
      const max = 1200;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      const scale = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      return cropOpaque(c);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function setSubject({ kind: nextKind, text, file } = {}) {
    const gen = ++subjectGen;
    if (nextKind) kind = nextKind;
    if (typeof text === 'string') wordText = text;
    let canvas = null;
    if (kind === 'word') canvas = await drawWordCanvas(wordText);
    else if (kind === 'mark' && file) canvas = await canvasFromFile(file);
    else if (kind === 'mark') canvas = await drawWordCanvas('Mark');
    if (gen !== subjectGen) return;
    clearSubject();
    if (canvas) makeCast(canvas);
    else {
      kind = 'knot';
      makeKnot();
    }
    glowClock = 1;
  }

  makeKnot();

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 512;
  glowCanvas.height = 512;
  const glowCtx = glowCanvas.getContext('2d');
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = CONFIG.floorY;
  scene.add(glowPlane);

  const _p = new THREE.Vector3();
  const _box = new THREE.Box3();

  function updateGlow() {
    const ctx = glowCtx;
    const W = glowCanvas.width;
    const H = glowCanvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    knotGroup.updateMatrixWorld(true);
    const span = 8.5;
    let cx = 0;
    let cz = 0;
    let lowR = 0;
    let lowG = 0;
    let lowB = 0;
    let lowW = 0;
    if (kind === 'knot') {
      const N = 48;
      for (let i = 0; i < N; i++) {
        const t0 = i / N;
        curve.getPoint(t0, _p);
        _p.applyMatrix4(knotGroup.matrixWorld);
        const wgt = Math.max(0, 1.4 - _p.y);
        candyColor(t0, CONFIG.hueOffset, CONFIG.sat, CONFIG.lit, _col);
        lowR += _col.r * wgt;
        lowG += _col.g * wgt;
        lowB += _col.b * wgt;
        lowW += wgt;
        cx += _p.x;
        cz += _p.z;
      }
      cx = (cx / N / span + 0.5) * W;
      cz = (cz / N / span + 0.5) * H;
    } else {
      _box.setFromObject(knotGroup);
      _box.getCenter(_p);
      cx = (_p.x / span + 0.5) * W;
      cz = (_p.z / span + 0.5) * H;
      candyColor(0.08, CONFIG.hueOffset, CONFIG.sat, CONFIG.lit, _col);
      lowR = _col.r;
      lowG = _col.g;
      lowB = _col.b;
      lowW = 1;
    }
    const r = Math.round((lowW ? lowR / lowW : 1) * 255);
    const g = Math.round((lowW ? lowG / lowW : 0.7) * 255);
    const b = Math.round((lowW ? lowB / lowW : 0.85) * 255);
    const blob = (x, y, rad, rr, gg, bb, a0) => {
      const grd = ctx.createRadialGradient(x, y, 2, x, y, rad);
      grd.addColorStop(0, `rgba(${rr},${gg},${bb},${a0})`);
      grd.addColorStop(0.4, `rgba(${rr},${gg},${bb},${a0 * 0.32})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    };
    ctx.filter = 'blur(34px)';
    blob(cx, cz, 280, r, g, b, 0.38);
    blob(cx - 55, cz + 24, 220, 255, 168, 196, 0.22);
    blob(cx + 48, cz + 16, 210, 176, 196, 255, 0.2);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    glowTex.needsUpdate = true;
  }

  const _qa = new THREE.Quaternion();
  const _qb = new THREE.Quaternion();
  const _eul = new THREE.Euler();
  const keys = (fit.keys || []).map((k) => {
    _eul.set(k.e[0], k.e[1], k.e[2], 'XYZ');
    return { t: k.t, q: new THREE.Quaternion().setFromEuler(_eul) };
  });
  if (keys.length) {
    const q0 = keys[0].q.clone();
    keys.push({ t: DURATION, q: q0 });
  }

  let time = 0;
  let glowClock = 0;

  function applyPose(timeSec) {
    const t = ((timeSec % DURATION) + DURATION) % DURATION;
    time = t;
    if (!keys.length) return;
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
    knotGroup.quaternion.slerpQuaternions(_qa.copy(a.q), _qb.copy(b.q), u);
  }

  applyPose(0);
  updateGlow();

  function resize() {
    const w = canvas.clientWidth || 16;
    const h = canvas.clientHeight || 9;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const cap = isCoarse() ? 1.25 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
  }

  resize();

  const homePos = camera.position.clone();
  const homeTarget = controls.target.clone();

  return {
    duration: DURATION,
    getTime: () => time,
    setTime(t) {
      applyPose(t);
    },
    getHue: () => CONFIG.hueOffset,
    setHue(h) {
      CONFIG.hueOffset = h;
      paintColors();
      glowClock = 1;
    },
    getKind: () => kind,
    setSubject,
    setOrbit(on) {
      controls.enabled = on;
    },
    resetView() {
      camera.position.copy(homePos);
      controls.target.copy(homeTarget);
      controls.update();
    },
    capture() {
      renderer.render(scene, camera);
      return canvas.toDataURL('image/png');
    },
    resize,
    frame(dt, { playing, speed }) {
      if (playing) applyPose(time + dt * speed);
      controls.update();
      glowClock += dt;
      const hz = isCoarse() ? 12 : 20;
      if (glowClock >= 1 / hz) {
        glowClock = 0;
        updateGlow();
      }
      renderer.render(scene, camera);
    },
  };
}
