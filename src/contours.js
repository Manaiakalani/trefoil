import * as THREE from 'three';

function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, n = pts.length, j = n - 1; i < n; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function distToSeg(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let maxD = 0;
  let idx = 0;
  const a = pts[0];
  const b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i], a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const left = rdp(pts.slice(0, idx + 1), eps);
    const right = rdp(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

function centroid(pts) {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, pts.length);
  return { x: x / n, y: y / n };
}

function chaikin(pts, iters = 2) {
  let ring = pts;
  const closed =
    ring.length > 2 &&
    ring[0].x === ring[ring.length - 1].x &&
    ring[0].y === ring[ring.length - 1].y;
  if (closed) ring = ring.slice(0, -1);
  for (let k = 0; k < iters; k++) {
    const next = [];
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    ring = next;
  }
  ring.push({ ...ring[0] });
  return ring;
}

function maskFromImageData(imageData) {
  const { data, width, height } = imageData;
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      hasAlpha = true;
      break;
    }
  }
  const grid = new Uint8Array(width * height);
  let count = 0;
  for (let p = 0, i = 0; p < grid.length; p++, i += 4) {
    const on = hasAlpha
      ? data[i + 3] > 40
      : data[i] + data[i + 1] + data[i + 2] < 730;
    if (on) {
      grid[p] = 1;
      count++;
    }
  }
  if (count < 24) {
    grid.fill(1);
  }
  return { grid, width, height };
}

function downsample(grid, w, h, step) {
  const nw = Math.max(8, Math.floor(w / step));
  const nh = Math.max(8, Math.floor(h / step));
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      let on = 0;
      let n = 0;
      for (let dy = 0; dy < step; dy++) {
        for (let dx = 0; dx < step; dx++) {
          const sx = x * step + dx;
          const sy = y * step + dy;
          if (sx >= w || sy >= h) continue;
          n++;
          on += grid[sy * w + sx];
        }
      }
      out[y * nw + x] = on * 2 >= n ? 1 : 0;
    }
  }
  return { grid: out, width: nw, height: nh };
}

const EDGE = [
  [],
  [[2, 3]],
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [
    [0, 3],
    [1, 2],
  ],
  [[0, 2]],
  [[0, 3]],
  [[0, 3]],
  [[0, 2]],
  [
    [0, 1],
    [2, 3],
  ],
  [[0, 1]],
  [[1, 3]],
  [[1, 2]],
  [[2, 3]],
  [],
];

function lerp(a, b) {
  return (a + b) * 0.5;
}

function marchingLoops(grid, w, h) {
  const segs = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : grid[y * w + x]);
  const edgePoint = (x, y, e) => {
    if (e === 0) return { x: lerp(x, x + 1), y };
    if (e === 1) return { x: x + 1, y: lerp(y, y + 1) };
    if (e === 2) return { x: lerp(x, x + 1), y: y + 1 };
    return { x, y: lerp(y, y + 1) };
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bits =
        (at(x, y) << 3) | (at(x + 1, y) << 2) | (at(x + 1, y + 1) << 1) | at(x, y + 1);
      const edges = EDGE[bits];
      for (const pair of edges) {
        segs.push([edgePoint(x, y, pair[0]), edgePoint(x, y, pair[1])]);
      }
    }
  }

  const key = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const unused = new Map();
  segs.forEach((seg, i) => {
    const k0 = key(seg[0]);
    const k1 = key(seg[1]);
    if (!unused.has(k0)) unused.set(k0, []);
    if (!unused.has(k1)) unused.set(k1, []);
    unused.get(k0).push(i);
    unused.get(k1).push(i);
  });
  const taken = new Uint8Array(segs.length);
  const loops = [];

  function take(i, fromKey) {
    taken[i] = 1;
    const seg = segs[i];
    const k0 = key(seg[0]);
    const k1 = key(seg[1]);
    return fromKey === k0 ? { pt: seg[1], k: k1 } : { pt: seg[0], k: k0 };
  }

  for (let i = 0; i < segs.length; i++) {
    if (taken[i]) continue;
    const startK = key(segs[i][0]);
    const loop = [segs[i][0]];
    let cur = take(i, startK);
    loop.push(cur.pt);
    let guard = 0;
    while (cur.k !== startK && guard++ < segs.length + 2) {
      const opts = (unused.get(cur.k) || []).filter((idx) => !taken[idx]);
      if (!opts.length) break;
      cur = take(opts[0], cur.k);
      loop.push(cur.pt);
    }
    if (loop.length >= 8) loops.push(loop);
  }
  return loops;
}

function toShapes(loops, scaleX, scaleY, originX, originY) {
  const world = loops.map((pts) => {
    const mapped = pts.map((p) => ({
      x: (p.x - originX) * scaleX,
      y: -(p.y - originY) * scaleY,
    }));
    if (mapped.length > 2 && (mapped[0].x !== mapped[mapped.length - 1].x || mapped[0].y !== mapped[mapped.length - 1].y)) {
      mapped.push({ ...mapped[0] });
    }
    if (signedArea(mapped) < 0) mapped.reverse();
    const simplified = rdp(mapped, 1.4);
    return chaikin(simplified, 2);
  });

  const items = world
    .map((pts, i) => ({ i, pts, area: Math.abs(signedArea(pts)) }))
    .filter((item) => item.pts.length >= 4 && item.area > 0.002)
    .sort((a, b) => b.area - a.area);

  const parent = items.map(() => -1);
  for (let j = 0; j < items.length; j++) {
    let best = -1;
    let bestArea = Infinity;
    const sample = centroid(items[j].pts);
    for (let i = 0; i < items.length; i++) {
      if (i === j || items[i].area <= items[j].area) continue;
      if (pointInPoly(sample.x, sample.y, items[i].pts) && items[i].area < bestArea) {
        best = i;
        bestArea = items[i].area;
      }
    }
    parent[j] = best;
  }

  const depth = (idx) => {
    let d = 0;
    let p = parent[idx];
    while (p !== -1) {
      d++;
      p = parent[p];
    }
    return d;
  };

  const shapes = [];
  items.forEach((item, idx) => {
    if (depth(idx) % 2 !== 0) return;
    const shape = new THREE.Shape();
    item.pts.forEach((p, n) => {
      if (n === 0) shape.moveTo(p.x, p.y);
      else shape.lineTo(p.x, p.y);
    });
    shape.closePath();
    items.forEach((child, j) => {
      if (parent[j] === idx && depth(j) % 2 === 1) {
        const hole = new THREE.Path();
        const ring = child.pts.slice().reverse();
        ring.forEach((p, n) => {
          if (n === 0) hole.moveTo(p.x, p.y);
          else hole.lineTo(p.x, p.y);
        });
        hole.closePath();
        shape.holes.push(hole);
      }
    });
    shapes.push(shape);
  });
  return shapes;
}

export function shapesFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const { grid, width, height } = maskFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
  const step = Math.max(1, Math.round(Math.max(width, height) / 340));
  const small = downsample(grid, width, height, step);
  const loops = marchingLoops(small.grid, small.width, small.height);
  const sx = step;
  const sy = step;
  return toShapes(loops, sx, sy, 0, 0);
}

function scalePath(path, s, cx, cy) {
  for (const c of path.curves) {
    for (const key of ['v0', 'v1', 'v2', 'a', 'b']) {
      if (!c[key]) continue;
      c[key].x = (c[key].x - cx) * s;
      c[key].y = (c[key].y - cy) * s;
    }
  }
  if (path.currentPoint) {
    path.currentPoint.x = (path.currentPoint.x - cx) * s;
    path.currentPoint.y = (path.currentPoint.y - cy) * s;
  }
}

export function extrudeCandy(shapes, targetSize, tube) {
  const box = new THREE.Box2();
  for (const shape of shapes) {
    for (const p of shape.getPoints()) box.expandByPoint(p);
    for (const hole of shape.holes) {
      for (const p of hole.getPoints()) box.expandByPoint(p);
    }
  }
  const size = new THREE.Vector2();
  box.getSize(size);
  const center = new THREE.Vector2();
  box.getCenter(center);
  const s = targetSize / Math.max(size.x, size.y, 1e-6);
  for (const shape of shapes) {
    scalePath(shape, s, center.x, center.y);
    for (const hole of shape.holes) scalePath(hole, s, center.x, center.y);
  }

  const minDim = Math.max(size.x, size.y) * s;
  const knotDiameter = tube * 2 * 0.78;
  const bevel = Math.min(knotDiameter * 0.28, minDim * 0.045);
  const depth = Math.max(0.02, knotDiameter - 2 * bevel);

  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 1,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}
