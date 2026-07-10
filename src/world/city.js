/**
 * Neon Nocturne — procedural night city world (perf-tuned).
 *
 * Heavy PointLights + soft shadows made this unplayable. Neon is now mostly
 * emissive/unlit meshes; only a handful of real lights remain.
 */

import * as THREE from 'three';

const CYAN = 0x3de7ff;
const MAGENTA = 0xff3d9a;

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
  const size = 256;
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
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 14]);
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
  tex.anisotropy = 2;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function createSidewalkTexture() {
  const size = 64;
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
function createFacadeMaps(rng) {
  const w = 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const wallColors = ['#0c1018', '#10141c', '#0a0e14', '#121820'];
  ctx.fillStyle = wallColors[Math.floor(rng() * wallColors.length)];
  ctx.fillRect(0, 0, w, h);

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = w;
  emissiveCanvas.height = h;
  const ectx = emissiveCanvas.getContext('2d');
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  const cols = 3 + Math.floor(rng() * 2);
  const rows = 5 + Math.floor(rng() * 4);
  const padX = 6;
  const padY = 10;
  const gapX = 3;
  const gapY = 4;
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
      if (rng() < 0.35) continue;
      const px = padX + c * (winW + gapX);
      const py = padY + r * (winH + gapY);
      const pal = palettes[Math.floor(rng() * palettes.length)];
      const lit = 0.5 + rng() * 0.5;

      ctx.fillStyle = '#06080e';
      ctx.fillRect(px, py, winW, winH);
      ctx.fillStyle = pal[1];
      ctx.globalAlpha = lit * 0.9;
      ctx.fillRect(px + 1, py + 1, winW - 2, winH - 2);
      ctx.globalAlpha = 1;

      ectx.fillStyle = pal[0];
      ectx.globalAlpha = lit;
      ectx.fillRect(px + 1, py + 1, winW - 2, winH - 2);
      ectx.globalAlpha = 1;
    }
  }

  if (rng() < 0.55) {
    const color = rng() < 0.5 ? '#3de7ff' : '#ff3d9a';
    const sy = 20 + Math.floor(rng() * (h * 0.45));
    const sh = 6 + Math.floor(rng() * 6);
    const sx = 8 + Math.floor(rng() * 12);
    const sw = w - sx * 2;

    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, sw, sh);
    ectx.fillStyle = color;
    ectx.fillRect(sx, sy, sw, sh);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 1;

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 1;

  return { map, emissiveMap };
}

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
  const flickerMats = [];
  const flickerLights = [];

  // ── Lighting: keep this tiny. Neon comes from emissive meshes. ──
  const hemi = new THREE.HemisphereLight(0x2a3a5c, 0x05060a, 0.55);
  root.add(hemi);

  const ambient = new THREE.AmbientLight(0x142030, 0.35);
  root.add(ambient);

  const moon = new THREE.DirectionalLight(0x9ab0d0, 0.35);
  moon.position.set(-40, 80, 20);
  moon.castShadow = false;
  root.add(moon);

  // Two soft fills for cyan/magenta mood — not per-lamp lights.
  const cyanFill = new THREE.PointLight(CYAN, 1.1, 70, 2);
  cyanFill.position.set(-12, 14, 10);
  root.add(cyanFill);

  const magentaFill = new THREE.PointLight(MAGENTA, 0.9, 65, 2);
  magentaFill.position.set(16, 12, -14);
  root.add(magentaFill);

  const warmFill = new THREE.PointLight(0xffb070, 0.7, 55, 2);
  warmFill.position.set(0, 10, 0);
  root.add(warmFill);

  flickerLights.push(
    { light: cyanFill, base: 1.1, amp: 0.06, speed: 1.2, phase: 0.3 },
    { light: magentaFill, base: 0.9, amp: 0.07, speed: 1.5, phase: 1.1 },
    { light: warmFill, base: 0.7, amp: 0.05, speed: 0.9, phase: 2.0 },
  );

  // ── Ground ────────────────────────────────────────────────
  const asphaltTex = createAsphaltTexture();
  const groundMat = new THREE.MeshLambertMaterial({
    color: 0x0b0e16,
    map: asphaltTex,
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2, CITY_HALF * 2),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'asphalt';
  root.add(ground);

  const sidewalkTex = createSidewalkTexture();
  const sidewalkMat = new THREE.MeshLambertMaterial({
    color: 0x141820,
    map: sidewalkTex,
  });

  // One sidewalk slab per block instead of 4 ring pieces.
  const sidewalkGeo = new THREE.BoxGeometry(
    BLOCK + SIDEWALK * 2,
    0.08,
    BLOCK + SIDEWALK * 2,
  );

  const laneMat = new THREE.MeshBasicMaterial({
    color: 0x3a3420,
  });
  const laneGeoX = new THREE.BoxGeometry(CITY_HALF * 2 - 4, 0.02, 0.18);
  const laneGeoZ = new THREE.BoxGeometry(0.18, 0.02, CITY_HALF * 2 - 4);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const thinBoxGeo = new THREE.BoxGeometry(1, 1, 1);

  const roofMat = new THREE.MeshLambertMaterial({
    color: 0x0a0c12,
  });

  // Fewer unique facade textures
  const facadePool = [];
  const facadeRng = mulberry32(0xc1a55eed);
  for (let i = 0; i < 6; i++) {
    const { map, emissiveMap } = createFacadeMaps(facadeRng);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map,
      emissive: 0xffffff,
      emissiveMap,
      emissiveIntensity: 0.95,
    });
    facadePool.push(mat);
    flickerMats.push({
      mat,
      base: 0.95,
      amp: 0.06 + (i % 3) * 0.02,
      speed: 1.4 + (i % 4) * 0.3,
      phase: i * 0.7,
    });
  }

  const signMats = {
    cyan: new THREE.MeshBasicMaterial({ color: CYAN }),
    magenta: new THREE.MeshBasicMaterial({ color: MAGENTA }),
  };

  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.2, 5);
  poleGeo.translate(0, 2.1, 0);
  const armGeo = new THREE.BoxGeometry(1.1, 0.08, 0.08);
  const lampHeadGeo = new THREE.SphereGeometry(0.18, 6, 4);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x1a1e28 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffcc88 });

  const plazaMat = new THREE.MeshLambertMaterial({ color: 0x10141c });
  const plazaRingMat = new THREE.MeshBasicMaterial({ color: CYAN });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x0c1018 });

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
    const mesh = new THREE.Mesh(boxGeo, facade);
    mesh.position.set(x, 0, z);
    mesh.scale.set(w, h, d);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    root.add(mesh);

    const roof = new THREE.Mesh(thinBoxGeo, roofMat);
    roof.position.set(x, h + 0.05, z);
    roof.scale.set(w * 0.98, 0.12, d * 0.98);
    roof.matrixAutoUpdate = false;
    roof.updateMatrix();
    root.add(roof);

    addCollider(x - w * 0.5, x + w * 0.5, z - d * 0.5, z + d * 0.5);

    if (rng() < 0.4 && h > 6) {
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
      sign.matrixAutoUpdate = false;
      sign.updateMatrix();
      root.add(sign);
    }
  }

  function addSidewalkPad(b) {
    const m = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    m.position.set(b.cx, 0.04, b.cz);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    root.add(m);
  }

  function addPlazaDecor(ix, iz, rng) {
    const b = blockBounds(ix, iz);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK - 1, 0.06, BLOCK - 1),
      plazaMat,
    );
    pad.position.set(b.cx, 0.03, b.cz);
    pad.matrixAutoUpdate = false;
    pad.updateMatrix();
    root.add(pad);

    if (ix === 0 && iz === 0) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.08, 6, 24),
        plazaRingMat,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(b.cx, 0.12, b.cz);
      ring.matrixAutoUpdate = false;
      ring.updateMatrix();
      root.add(ring);

      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        const px = b.cx + Math.cos(ang) * 5.2;
        const pz = b.cz + Math.sin(ang) * 5.2;
        const planter = new THREE.Mesh(boxGeo, darkMat);
        planter.position.set(px, 0, pz);
        planter.scale.set(1.2, 0.7, 1.2);
        planter.matrixAutoUpdate = false;
        planter.updateMatrix();
        root.add(planter);
        addCollider(px - 0.6, px + 0.6, pz - 0.6, pz + 0.6);

        const glow = new THREE.Mesh(
          thinBoxGeo,
          rng() < 0.5 ? signMats.cyan : signMats.magenta,
        );
        glow.position.set(px, 0.72, pz);
        glow.scale.set(1.0, 0.08, 1.0);
        glow.matrixAutoUpdate = false;
        glow.updateMatrix();
        root.add(glow);
      }
    } else {
      const strip = new THREE.Mesh(
        thinBoxGeo,
        rng() < 0.5 ? signMats.cyan : signMats.magenta,
      );
      strip.position.set(b.cx, 0.08, b.cz);
      strip.scale.set(4 + rng() * 3, 0.05, 0.25);
      strip.rotation.y = rng() * Math.PI;
      strip.matrixAutoUpdate = false;
      strip.updateMatrix();
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
    lx.matrixAutoUpdate = false;
    lx.updateMatrix();
    root.add(lx);

    const lz = new THREE.Mesh(laneGeoX, laneMat);
    lz.position.set(0, 0.015, streetCenter);
    lz.matrixAutoUpdate = false;
    lz.updateMatrix();
    root.add(lz);
  }

  for (let ix = gridMin; ix <= gridMax; ix++) {
    for (let iz = gridMin; iz <= gridMax; iz++) {
      const b = blockBounds(ix, iz);
      const seed = ((ix + 5) * 31 + (iz + 5) * 17 + 99) | 0;
      const rng = mulberry32(seed ^ 0x9e3779b9);

      addSidewalkPad(b);

      if (isPlazaCell(ix, iz)) {
        addPlazaDecor(ix, iz, rng);
        continue;
      }

      const layoutRoll = rng();
      const buildings = [];

      if (layoutRoll < 0.28) {
        const margin = 1.1 + rng() * 0.6;
        buildings.push({
          x: b.cx + (rng() - 0.5) * 1.2,
          z: b.cz + (rng() - 0.5) * 1.2,
          w: BLOCK - margin * 2,
          d: BLOCK - margin * 2,
          h: 10 + rng() * 16,
        });
      } else if (layoutRoll < 0.62) {
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
          h: 6 + rng() * 12,
        });
        buildings.push({
          x: b.maxX - 1.1 - w2 * 0.5,
          z: b.cz + (rng() - 0.5) * 1.5,
          w: Math.max(3, w2),
          d: depth * (0.85 + rng() * 0.2),
          h: 5 + rng() * 10,
        });
      } else if (layoutRoll < 0.85) {
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
          h: 7 + rng() * 11,
        });
        buildings.push({
          x: b.cx + (rng() - 0.5) * 1.5,
          z: b.maxZ - 1.1 - d2 * 0.5,
          w: width * (0.85 + rng() * 0.2),
          d: Math.max(3, d2),
          h: 5 + rng() * 9,
        });
      } else {
        // Prefer 2 buildings over 4 for fewer draw calls
        const gap = 1.5;
        const hw = (BLOCK - 2.2 - gap) * 0.5;
        const hd = (BLOCK - 2.2 - gap) * 0.5;
        const ox = [-1, 1];
        const oz = [-1, 1];
        for (let i = 0; i < 2; i++) {
          buildings.push({
            x: b.cx + ox[i] * (gap * 0.5 + hw * 0.5),
            z: b.cz + oz[i] * (gap * 0.5 + hd * 0.5),
            w: hw * (0.85 + rng() * 0.2),
            d: hd * (0.85 + rng() * 0.2),
            h: 5 + rng() * 12,
          });
        }
      }

      for (const bld of buildings) {
        if (bld.w < 2.5 || bld.d < 2.5) continue;
        addBuilding(bld.x, bld.z, bld.w, bld.d, bld.h, rng);
      }
    }
  }

  // ── Street lamps: emissive heads only — NO PointLights ──
  const lampPositions = [];
  for (let i = gridMin; i <= gridMax + 1; i++) {
    const street = cellCenter(i) - CELL * 0.5;
    if (Math.abs(street) > CITY_HALF - 4) continue;

    for (let j = gridMin; j <= gridMax; j++) {
      const along = cellCenter(j);
      const offset = STREET * 0.35;
      lampPositions.push({ x: street - offset, z: along - BLOCK * 0.25 });
      lampPositions.push({ x: along - BLOCK * 0.25, z: street - offset });
    }
  }

  const used = new Set();
  const finalLamps = [];
  for (const p of lampPositions) {
    if (Math.abs(p.x) > WALK_HALF - 2 || Math.abs(p.z) > WALK_HALF - 2) continue;
    const key = `${p.x.toFixed(1)}_${p.z.toFixed(1)}`;
    if (used.has(key)) continue;
    if (hash2(Math.round(p.x), Math.round(p.z), 7) > 0.55) continue;
    used.add(key);
    finalLamps.push(p);
  }

  finalLamps.sort((a, b) => hash2(a.x, a.z, 3) - hash2(b.x, b.z, 3));
  const lampCount = Math.min(18, finalLamps.length);

  // Instanced poles / arms / heads to cut draw calls
  const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lampCount);
  const armMesh = new THREE.InstancedMesh(armGeo, poleMat, lampCount);
  const headMesh = new THREE.InstancedMesh(lampHeadGeo, lampGlowMat, lampCount);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < lampCount; i++) {
    const p = finalLamps[i];
    let rotY = 0;
    if (hash2(Math.round(p.x), Math.round(p.z), 11) > 0.5) rotY = Math.PI;
    else if (hash2(Math.round(p.x), Math.round(p.z), 13) > 0.5) rotY = Math.PI * 0.5;

    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, rotY, 0);
    dummy.updateMatrix();
    // arm local offset (0.45, 4.05, 0) baked via child-like transform
    const armDummy = new THREE.Object3D();
    armDummy.position.set(p.x, 0, p.z);
    armDummy.rotation.y = rotY;
    armDummy.updateMatrix();
    const localArm = new THREE.Object3D();
    localArm.position.set(0.45, 4.05, 0);
    localArm.updateMatrix();
    const armMat4 = new THREE.Matrix4().multiplyMatrices(armDummy.matrix, localArm.matrix);
    armMesh.setMatrixAt(i, armMat4);

    const localHead = new THREE.Object3D();
    localHead.position.set(0.95, 3.95, 0);
    localHead.updateMatrix();
    const headMat4 = new THREE.Matrix4().multiplyMatrices(armDummy.matrix, localHead.matrix);
    headMesh.setMatrixAt(i, headMat4);
  }

  poleMesh.instanceMatrix.needsUpdate = true;
  armMesh.instanceMatrix.needsUpdate = true;
  headMesh.instanceMatrix.needsUpdate = true;
  poleMesh.matrixAutoUpdate = false;
  armMesh.matrixAutoUpdate = false;
  headMesh.matrixAutoUpdate = false;
  root.add(poleMesh, armMesh, headMesh);

  // City-edge neon curb
  const curbMat = new THREE.MeshBasicMaterial({ color: CYAN });
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
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    root.add(m);
  }

  let flickerAcc = 0;

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
    update(dt, elapsed) {
      // Throttle flicker — materials don't need 60Hz updates
      flickerAcc += dt;
      if (flickerAcc < 1 / 20) return;
      flickerAcc = 0;

      for (let i = 0; i < flickerMats.length; i++) {
        const t = flickerMats[i];
        const n = Math.sin(elapsed * t.speed + t.phase);
        t.mat.emissiveIntensity = Math.max(0.4, t.base + n * t.amp);
      }
      for (let i = 0; i < flickerLights.length; i++) {
        const t = flickerLights[i];
        const n = Math.sin(elapsed * t.speed + t.phase);
        t.light.intensity = Math.max(0.2, t.base + n * t.amp);
      }
    },
  };
}
