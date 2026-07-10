/**
 * Neon Nocturne — procedural night city world.
 *
 * createWorld(scene) -> {
 *   colliders, walkableBounds, getGroundHeight(x, z), update(dt, elapsed, player)
 * }
 */

import * as THREE from 'three';

const CYAN = 0x3de7ff;
const MAGENTA = 0xff3d9a;
const WARM = 0xffb060;

const CITY_HALF = 50;
const WALK_HALF = 48;
const CELL = 20;
const BLOCK = 14;
const STREET = CELL - BLOCK; // 6
const SIDEWALK = 1.4;
const COLLIDER_INSET = 0.15;

function hash2(ix, iz, salt = 0) {
  let n = ix * 374761393 + iz * 668265263 + salt * 1274126177;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createAsphaltTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a0c12';
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.9));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 1.1));
  }
  ctx.putImageData(img, 0, 0);

  ctx.strokeStyle = 'rgba(55, 70, 90, 0.35)';
  ctx.lineWidth = 2;
  const step = size / 10;
  for (let i = 0; i <= 10; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(180, 170, 90, 0.22)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 18]);
  for (let i = 0; i <= 10; i++) {
    const p = i * step + step * 0.5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createSidewalkTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#12151e';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(40, 48, 62, 0.7)';
  ctx.lineWidth = 2;
  const tiles = 4;
  const t = size / tiles;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * t, 0);
    ctx.lineTo(i * t, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * t);
    ctx.lineTo(size, i * t);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas facade: dark wall + lit window grid + optional neon strip. */
function createFacadeMaps(rng, opts = {}) {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const wallColors = ['#0c1018', '#10141c', '#0a0e14', '#121820'];
  ctx.fillStyle = wallColors[Math.floor(rng() * wallColors.length)];
  ctx.fillRect(0, 0, w, h);

  // Slight vertical banding
  for (let x = 0; x < w; x += 16) {
    ctx.fillStyle = `rgba(255,255,255,${0.01 + rng() * 0.02})`;
    ctx.fillRect(x, 0, 1, h);
  }

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = w;
  emissiveCanvas.height = h;
  const ectx = emissiveCanvas.getContext('2d');
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  const cols = 3 + Math.floor(rng() * 3);
  const rows = 5 + Math.floor(rng() * 6);
  const padX = 10;
  const padY = 18;
  const gapX = 5;
  const gapY = 7;
  const usableW = w - padX * 2 - gapX * (cols - 1);
  const usableH = h - padY * 2 - gapY * (rows - 1);
  const winW = usableW / cols;
  const winH = usableH / rows;

  const palettes = [
    ['#3de7ff', '#1a8aaa'],
    ['#ff3d9a', '#aa2060'],
    ['#ffb060', '#aa7040'],
    ['#6ec8ff', '#3a70aa'],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.32) continue;
      const px = padX + c * (winW + gapX);
      const py = padY + r * (winH + gapY);
      const pal = palettes[Math.floor(rng() * palettes.length)];
      const lit = 0.45 + rng() * 0.55;

      ctx.fillStyle = '#06080e';
      ctx.fillRect(px, py, winW, winH);
      ctx.fillStyle = pal[1];
      ctx.globalAlpha = lit * 0.85;
      ctx.fillRect(px + 1, py + 1, winW - 2, winH - 2);
      ctx.globalAlpha = 1;

      ectx.fillStyle = pal[0];
      ectx.globalAlpha = lit;
      ectx.fillRect(px + 1, py + 1, winW - 2, winH - 2);
      ectx.globalAlpha = 1;
    }
  }

  // Neon sign strip
  if (opts.withSign !== false && rng() < 0.6) {
    const cyan = rng() < 0.5;
    const color = cyan ? '#3de7ff' : '#ff3d9a';
    const sy = 40 + Math.floor(rng() * (h * 0.45));
    const sh = 10 + Math.floor(rng() * 10);
    const sx = 12 + Math.floor(rng() * 20);
    const sw = w - sx * 2;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.globalAlpha = 1;

    ectx.fillStyle = color;
    ectx.fillRect(sx, sy, sw, sh);

    // Soft glow bleed
    ectx.globalAlpha = 0.35;
    ectx.fillRect(sx - 2, sy - 3, sw + 4, sh + 6);
    ectx.globalAlpha = 1;
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 4;

  return { map, emissiveMap, hasSign: true };
}

/** Open plaza cells — no solid buildings (NPC-friendly). */
function isPlazaCell(ix, iz) {
  if (ix === 0 && iz === 0) return true;
  if (ix === 0 && iz === 1) return true;
  if (ix === -1 && iz === 0) return true;
  if (ix === 2 && iz === -2) return true;
  if (ix === -2 && iz === 2) return true;
  return false;
}

function cellCenter(i) {
  return i * CELL;
}

function blockBounds(ix, iz) {
  const cx = cellCenter(ix);
  const cz = cellCenter(iz);
  const half = BLOCK * 0.5;
  return {
    minX: cx - half,
    maxX: cx + half,
    minZ: cz - half,
    maxZ: cz + half,
    cx,
    cz,
  };
}

export function createWorld(scene) {
  const root = new THREE.Group();
  root.name = 'city-world';
  scene.add(root);

  const colliders = [];
  const flickerTargets = [];

  // ── Lighting ──────────────────────────────────────────────
  const hemi = new THREE.HemisphereLight(0x1a2a48, 0x040508, 0.42);
  root.add(hemi);

  const ambient = new THREE.AmbientLight(0x0c1520, 0.22);
  root.add(ambient);

  const moon = new THREE.DirectionalLight(0x8aa0c8, 0.28);
  moon.position.set(-40, 80, 20);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 10;
  moon.shadow.camera.far = 160;
  moon.shadow.camera.left = -60;
  moon.shadow.camera.right = 60;
  moon.shadow.camera.top = 60;
  moon.shadow.camera.bottom = -60;
  moon.shadow.bias = -0.0008;
  root.add(moon);

  const cyanFill = new THREE.PointLight(CYAN, 0.55, 55, 2);
  cyanFill.position.set(-18, 10, 12);
  root.add(cyanFill);

  const magentaFill = new THREE.PointLight(MAGENTA, 0.45, 50, 2);
  magentaFill.position.set(22, 9, -16);
  root.add(magentaFill);

  flickerTargets.push(
    { light: cyanFill, base: 0.55, amp: 0.08, speed: 1.7, phase: 0.3 },
    { light: magentaFill, base: 0.45, amp: 0.1, speed: 2.1, phase: 1.1 },
  );

  // ── Ground ────────────────────────────────────────────────
  const asphaltTex = createAsphaltTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e16,
    map: asphaltTex,
    metalness: 0.85,
    roughness: 0.22,
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2, CITY_HALF * 2),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'asphalt';
  root.add(ground);

  const sidewalkTex = createSidewalkTexture();
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x141820,
    map: sidewalkTex,
    metalness: 0.35,
    roughness: 0.55,
  });
  const sidewalkGeoCache = new Map();
  function sidewalkGeo(w, d) {
    const key = `${w.toFixed(2)}_${d.toFixed(2)}`;
    let g = sidewalkGeoCache.get(key);
    if (!g) {
      g = new THREE.BoxGeometry(w, 0.08, d);
      sidewalkGeoCache.set(key, g);
    }
    return g;
  }

  const laneMat = new THREE.MeshStandardMaterial({
    color: 0x3a3420,
    emissive: 0x2a2410,
    emissiveIntensity: 0.15,
    metalness: 0.2,
    roughness: 0.7,
  });
  const laneGeoX = new THREE.BoxGeometry(CITY_HALF * 2 - 4, 0.02, 0.18);
  const laneGeoZ = new THREE.BoxGeometry(0.18, 0.02, CITY_HALF * 2 - 4);

  // ── Shared geometries ─────────────────────────────────────
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);

  const thinBoxGeo = new THREE.BoxGeometry(1, 1, 1);

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c12,
    metalness: 0.6,
    roughness: 0.45,
  });

  // Pool of reusable facade materials (limit unique textures)
  const facadePool = [];
  const facadeRng = mulberry32(0xc1a55eed);
  for (let i = 0; i < 12; i++) {
    const { map, emissiveMap } = createFacadeMaps(facadeRng);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      emissive: 0xffffff,
      emissiveMap,
      emissiveIntensity: 0.85,
      metalness: 0.35,
      roughness: 0.55,
    });
    facadePool.push(mat);
    flickerTargets.push({
      mat,
      base: 0.85,
      amp: 0.1 + (i % 4) * 0.03,
      speed: 1.8 + (i % 5) * 0.4,
      phase: i * 0.7,
    });
  }

  const signMats = {
    cyan: new THREE.MeshStandardMaterial({
      color: 0x061018,
      emissive: CYAN,
      emissiveIntensity: 1.4,
      metalness: 0.3,
      roughness: 0.35,
    }),
    magenta: new THREE.MeshStandardMaterial({
      color: 0x180610,
      emissive: MAGENTA,
      emissiveIntensity: 1.35,
      metalness: 0.3,
      roughness: 0.35,
    }),
  };
  Object.values(signMats).forEach((mat, i) => {
    flickerTargets.push({
      mat,
      base: mat.emissiveIntensity,
      amp: 0.28,
      speed: 3.2 + i * 0.5,
      phase: 2 + i,
    });
  });

  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6);
  poleGeo.translate(0, 2.1, 0);
  const armGeo = new THREE.BoxGeometry(1.1, 0.08, 0.08);
  const lampHeadGeo = new THREE.SphereGeometry(0.18, 8, 6);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e28,
    metalness: 0.7,
    roughness: 0.35,
  });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffcc88,
    emissive: 0xffaa55,
    emissiveIntensity: 1.1,
    metalness: 0.1,
    roughness: 0.4,
  });
  flickerTargets.push({
    mat: lampGlowMat,
    base: 1.1,
    amp: 0.08,
    speed: 0.9,
    phase: 0.5,
  });

  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0x10141c,
    metalness: 0.55,
    roughness: 0.4,
  });
  const plazaRingMat = new THREE.MeshStandardMaterial({
    color: 0x0a1820,
    emissive: CYAN,
    emissiveIntensity: 0.35,
    metalness: 0.4,
    roughness: 0.45,
  });
  flickerTargets.push({
    mat: plazaRingMat,
    base: 0.35,
    amp: 0.08,
    speed: 1.4,
    phase: 0.2,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0c1018,
    metalness: 0.45,
    roughness: 0.55,
  });

  let neonLightBudget = 10;

  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({
      minX: minX + COLLIDER_INSET,
      maxX: maxX - COLLIDER_INSET,
      minZ: minZ + COLLIDER_INSET,
      maxZ: maxZ - COLLIDER_INSET,
    });
  }

  function addBuilding(x, z, w, d, h, rng) {
    const facade = facadePool[Math.floor(rng() * facadePool.length)];
    // Box with same material on all sides — windows read on every face
    const mesh = new THREE.Mesh(boxGeo, facade);
    mesh.position.set(x, 0, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    // Flat dark roof cap
    const roof = new THREE.Mesh(thinBoxGeo, roofMat);
    roof.position.set(x, h + 0.05, z);
    roof.scale.set(w * 0.98, 0.12, d * 0.98);
    roof.receiveShadow = true;
    root.add(roof);

    addCollider(x - w * 0.5, x + w * 0.5, z - d * 0.5, z + d * 0.5);

    // Occasional protruding neon sign strip (mesh + optional PointLight)
    if (rng() < 0.48 && h > 6) {
      const cyanSign = rng() < 0.5;
      const sMat = cyanSign ? signMats.cyan : signMats.magenta;
      const face = Math.floor(rng() * 4);
      const signW = (face % 2 === 0 ? w : d) * (0.4 + rng() * 0.4);
      const signH = 0.5 + rng() * 0.4;
      const sign = new THREE.Mesh(thinBoxGeo, sMat);
      const y = 3 + rng() * Math.min(h * 0.4, 7);
      const push = (face % 2 === 0 ? d : w) * 0.5 + 0.08;

      if (face === 0) {
        sign.position.set(x, y, z + push);
        sign.scale.set(signW, signH, 0.12);
      } else if (face === 1) {
        sign.position.set(x, y, z - push);
        sign.scale.set(signW, signH, 0.12);
      } else if (face === 2) {
        sign.position.set(x + push, y, z);
        sign.scale.set(0.12, signH, signW);
      } else {
        sign.position.set(x - push, y, z);
        sign.scale.set(0.12, signH, signW);
      }
      root.add(sign);

      if (neonLightBudget > 0 && rng() < 0.4) {
        neonLightBudget -= 1;
        const color = cyanSign ? CYAN : MAGENTA;
        const pl = new THREE.PointLight(color, 0.85, 12, 2);
        pl.position.copy(sign.position);
        pl.position.y += 0.15;
        root.add(pl);
        flickerTargets.push({
          light: pl,
          base: 0.85,
          amp: 0.32,
          speed: 4 + rng() * 3,
          phase: rng() * Math.PI * 2,
        });
      }
    }
  }

  function addSidewalkRing(b) {
    const outer = BLOCK * 0.5 + SIDEWALK;
    const inner = BLOCK * 0.5;
    const t = SIDEWALK;
    const pieces = [
      { x: b.cx, z: b.cz + (inner + outer) * 0.5, w: outer * 2, d: t },
      { x: b.cx, z: b.cz - (inner + outer) * 0.5, w: outer * 2, d: t },
      { x: b.cx + (inner + outer) * 0.5, z: b.cz, w: t, d: BLOCK },
      { x: b.cx - (inner + outer) * 0.5, z: b.cz, w: t, d: BLOCK },
    ];
    for (const p of pieces) {
      const m = new THREE.Mesh(sidewalkGeo(p.w, p.d), sidewalkMat);
      m.position.set(p.x, 0.04, p.z);
      m.receiveShadow = true;
      root.add(m);
    }
  }

  function addPlazaDecor(ix, iz, rng) {
    const b = blockBounds(ix, iz);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK - 1, 0.06, BLOCK - 1),
      plazaMat,
    );
    pad.position.set(b.cx, 0.03, b.cz);
    pad.receiveShadow = true;
    root.add(pad);

    if (ix === 0 && iz === 0) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.08, 8, 32),
        plazaRingMat,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(b.cx, 0.12, b.cz);
      root.add(ring);

      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        const px = b.cx + Math.cos(ang) * 5.2;
        const pz = b.cz + Math.sin(ang) * 5.2;
        const planter = new THREE.Mesh(boxGeo, darkMat);
        planter.position.set(px, 0, pz);
        planter.scale.set(1.2, 0.7, 1.2);
        planter.castShadow = true;
        planter.receiveShadow = true;
        root.add(planter);
        addCollider(px - 0.6, px + 0.6, pz - 0.6, pz + 0.6);

        const glow = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.08, 1.0),
          rng() < 0.5 ? signMats.cyan : signMats.magenta,
        );
        glow.position.set(px, 0.72, pz);
        root.add(glow);
      }
    } else {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(4 + rng() * 3, 0.05, 0.25),
        rng() < 0.5 ? signMats.cyan : signMats.magenta,
      );
      strip.position.set(b.cx, 0.08, b.cz);
      strip.rotation.y = rng() * Math.PI;
      root.add(strip);
    }
  }

  // ── Build city grid ───────────────────────────────────────
  const gridMin = -2;
  const gridMax = 2;

  for (let i = gridMin; i <= gridMax + 1; i++) {
    const streetCenter = cellCenter(i) - CELL * 0.5;
    if (Math.abs(streetCenter) > CITY_HALF - 2) continue;

    const lx = new THREE.Mesh(laneGeoZ, laneMat);
    lx.position.set(streetCenter, 0.015, 0);
    root.add(lx);

    const lz = new THREE.Mesh(laneGeoX, laneMat);
    lz.position.set(0, 0.015, streetCenter);
    root.add(lz);
  }

  for (let ix = gridMin; ix <= gridMax; ix++) {
    for (let iz = gridMin; iz <= gridMax; iz++) {
      const b = blockBounds(ix, iz);
      const seed = ((ix + 5) * 31 + (iz + 5) * 17 + 99) | 0;
      const rng = mulberry32(seed ^ 0x9e3779b9);

      addSidewalkRing(b);

      if (isPlazaCell(ix, iz)) {
        addPlazaDecor(ix, iz, rng);
        continue;
      }

      const layoutRoll = rng();
      const buildings = [];

      if (layoutRoll < 0.22) {
        const margin = 1.1 + rng() * 0.6;
        buildings.push({
          x: b.cx + (rng() - 0.5) * 1.2,
          z: b.cz + (rng() - 0.5) * 1.2,
          w: BLOCK - margin * 2,
          d: BLOCK - margin * 2,
          h: 10 + rng() * 18,
        });
      } else if (layoutRoll < 0.55) {
        const gap = 1.6 + rng() * 0.8;
        const total = BLOCK - 2.2;
        const w1 = total * (0.4 + rng() * 0.2);
        const w2 = total - w1 - gap;
        const depth = BLOCK - 2.4 - rng() * 1.2;
        buildings.push({
          x: b.minX + 1.1 + w1 * 0.5,
          z: b.cz + (rng() - 0.5) * 1.5,
          w: w1,
          d: depth,
          h: 6 + rng() * 14,
        });
        buildings.push({
          x: b.maxX - 1.1 - w2 * 0.5,
          z: b.cz + (rng() - 0.5) * 1.5,
          w: Math.max(3, w2),
          d: depth * (0.85 + rng() * 0.2),
          h: 5 + rng() * 12,
        });
      } else if (layoutRoll < 0.78) {
        const gap = 1.6 + rng() * 0.8;
        const total = BLOCK - 2.2;
        const d1 = total * (0.4 + rng() * 0.2);
        const d2 = total - d1 - gap;
        const width = BLOCK - 2.4 - rng() * 1.2;
        buildings.push({
          x: b.cx + (rng() - 0.5) * 1.5,
          z: b.minZ + 1.1 + d1 * 0.5,
          w: width,
          d: d1,
          h: 7 + rng() * 13,
        });
        buildings.push({
          x: b.cx + (rng() - 0.5) * 1.5,
          z: b.maxZ - 1.1 - d2 * 0.5,
          w: width * (0.85 + rng() * 0.2),
          d: Math.max(3, d2),
          h: 5 + rng() * 11,
        });
      } else {
        const gap = 1.5;
        const hw = (BLOCK - 2.2 - gap) * 0.5;
        const hd = (BLOCK - 2.2 - gap) * 0.5;
        const ox = [-1, 1, -1, 1];
        const oz = [-1, -1, 1, 1];
        for (let i = 0; i < 4; i++) {
          if (rng() < 0.12) continue;
          buildings.push({
            x: b.cx + ox[i] * (gap * 0.5 + hw * 0.5),
            z: b.cz + oz[i] * (gap * 0.5 + hd * 0.5),
            w: hw * (0.85 + rng() * 0.2),
            d: hd * (0.85 + rng() * 0.2),
            h: 4 + rng() * 14,
          });
        }
      }

      for (const bld of buildings) {
        if (bld.w < 2.5 || bld.d < 2.5) continue;
        addBuilding(bld.x, bld.z, bld.w, bld.d, bld.h, rng);
      }
    }
  }

  // ── Street lamps ──────────────────────────────────────────
  const lampPositions = [];
  for (let i = gridMin; i <= gridMax + 1; i++) {
    const street = cellCenter(i) - CELL * 0.5;
    if (Math.abs(street) > CITY_HALF - 4) continue;

    for (let j = gridMin; j <= gridMax; j++) {
      const along = cellCenter(j);
      const offset = STREET * 0.35;
      lampPositions.push({ x: street - offset, z: along - BLOCK * 0.25 });
      lampPositions.push({ x: street + offset, z: along + BLOCK * 0.25 });
      lampPositions.push({ x: along - BLOCK * 0.25, z: street - offset });
      lampPositions.push({ x: along + BLOCK * 0.25, z: street + offset });
    }
  }

  const used = new Set();
  const finalLamps = [];
  for (const p of lampPositions) {
    if (Math.abs(p.x) > WALK_HALF - 2 || Math.abs(p.z) > WALK_HALF - 2) continue;
    const key = `${p.x.toFixed(1)}_${p.z.toFixed(1)}`;
    if (used.has(key)) continue;
    if (hash2(Math.round(p.x), Math.round(p.z), 7) > 0.38) continue;
    used.add(key);
    finalLamps.push(p);
  }

  finalLamps.sort((a, b) => hash2(a.x, a.z, 3) - hash2(b.x, b.z, 3));
  const lampCount = Math.min(30, finalLamps.length);

  for (let i = 0; i < lampCount; i++) {
    const p = finalLamps[i];
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);

    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(0.45, 4.05, 0);
    group.add(arm);

    const head = new THREE.Mesh(lampHeadGeo, lampGlowMat);
    head.position.set(0.95, 3.95, 0);
    group.add(head);

    if (hash2(Math.round(p.x), Math.round(p.z), 11) > 0.5) {
      group.rotation.y = Math.PI;
    } else if (hash2(Math.round(p.x), Math.round(p.z), 13) > 0.5) {
      group.rotation.y = Math.PI * 0.5;
    }

    const light = new THREE.PointLight(0xffc078, 1.15, 18, 2);
    light.position.copy(head.position);
    light.castShadow = i < 6;
    if (light.castShadow) {
      light.shadow.mapSize.set(256, 256);
      light.shadow.bias = -0.002;
    }
    group.add(light);

    flickerTargets.push({
      light,
      base: 1.15,
      amp: 0.12,
      speed: 1.2 + (i % 5) * 0.25,
      phase: i * 0.4,
    });

    root.add(group);
  }

  // City-edge neon curb
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x081018,
    emissive: CYAN,
    emissiveIntensity: 0.2,
    metalness: 0.5,
    roughness: 0.4,
  });
  flickerTargets.push({
    mat: curbMat,
    base: 0.2,
    amp: 0.05,
    speed: 0.7,
    phase: 0,
  });
  const edge = WALK_HALF + 0.5;
  const curbLen = edge * 2;
  const curbs = [
    { x: 0, z: edge, sx: curbLen, sz: 0.35 },
    { x: 0, z: -edge, sx: curbLen, sz: 0.35 },
    { x: edge, z: 0, sx: 0.35, sz: curbLen },
    { x: -edge, z: 0, sx: 0.35, sz: curbLen },
  ];
  for (const c of curbs) {
    const m = new THREE.Mesh(thinBoxGeo, curbMat);
    m.position.set(c.x, 0.15, c.z);
    m.scale.set(c.sx, 0.3, c.sz);
    root.add(m);
  }

  return {
    colliders,
    walkableBounds: {
      minX: -WALK_HALF,
      maxX: WALK_HALF,
      minZ: -WALK_HALF,
      maxZ: WALK_HALF,
    },
    getGroundHeight() {
      return 0;
    },
    update(_dt, elapsed) {
      for (const t of flickerTargets) {
        const n =
          Math.sin(elapsed * t.speed + t.phase) * 0.6 +
          Math.sin(elapsed * t.speed * 2.7 + t.phase * 1.3) * 0.3 +
          Math.sin(elapsed * t.speed * 5.1 + t.phase * 0.7) * 0.1;
        const v = t.base + n * t.amp;
        if (t.mat) t.mat.emissiveIntensity = Math.max(0.05, v);
        if (t.light) t.light.intensity = Math.max(0.05, v);
      }
    },
  };
}
