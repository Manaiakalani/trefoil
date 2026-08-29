import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import fit from './fit.json';

const DURATION = fit.duration || 22.883333;

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
  // Spend more of the loop in orange–red, matching the source film.
  const warped = h < 0.2 ? h * 0.7 : 0.14 + (h - 0.2) * 1.075;
  return out.setHSL(warped % 1, sat, lit);
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
  let knotMesh = null;

  function paintColors() {
    const uv = knotMesh.geometry.attributes.uv;
    const colors = knotMesh.geometry.attributes.color;
    for (let i = 0; i < uv.count; i++) {
      candyColor(uv.getX(i), CONFIG.hueOffset, CONFIG.sat, CONFIG.lit, _col);
      colors.setXYZ(i, _col.r, _col.g, _col.b);
    }
    colors.needsUpdate = true;
  }

  function makeKnot() {
    if (knotMesh) {
      knotGroup.remove(knotMesh);
      knotMesh.geometry.dispose();
      knotMesh.material.dispose();
    }
    const geo = new THREE.TubeGeometry(
      new WikiTrefoil(),
      CONFIG.tubularSegments,
      CONFIG.tube,
      CONFIG.radialSegments,
      true
    );
    geo.center();
    geo.computeVertexNormals();
    geo.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(geo.attributes.uv.count * 3), 3)
    );
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
    knotMesh = new THREE.Mesh(geo, mat);
    knotGroup.add(knotMesh);
    knotGroup.scale.setScalar(CONFIG.groupScale);
    paintColors();
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
  const curve = new WikiTrefoil();

  function updateGlow() {
    const ctx = glowCtx;
    const W = glowCanvas.width;
    const H = glowCanvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    knotGroup.updateMatrixWorld(true);
    const N = 48;
    const span = 8.5;
    let cx = 0;
    let cz = 0;
    let lowR = 0;
    let lowG = 0;
    let lowB = 0;
    let lowW = 0;
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    },
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
      updateGlow();
      renderer.render(scene, camera);
    },
  };
}
