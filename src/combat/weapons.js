/**
 * First-person weapons / hitscan shooting for Neon Nocturne.
 *
 * Export: createWeaponSystem(scene, camera, player, world, enemies, hud) -> {
 *   update(dt, elapsed): void,
 *   getAmmo(): { mag: number, reserve: number },
 *   dispose?(): void,
 * }
 */

import * as THREE from 'three';

const MAG_SIZE = 18;
const RESERVE_MAX = 72;
const FIRE_INTERVAL = 1 / 9; // ~9 rps
const RELOAD_TIME = 1.15;
const DAMAGE = 22;
const MUZZLE_FLASH_MS = 0.05;
const BUILDING_MIN_Y = 0;
const BUILDING_MAX_Y = 40;
const MAX_RANGE = 120;

const CYAN = 0x33f0ff;
const MAGENTA = 0xff2bd6;
const BODY = 0x1a1e2a;
const SLIDE = 0x2a3148;

/**
 * Ray vs axis-aligned box. Returns distance t along unit ray, or null.
 * @param {THREE.Vector3} origin
 * @param {THREE.Vector3} dir unit direction
 * @param {number} minX
 * @param {number} maxX
 * @param {number} minY
 * @param {number} maxY
 * @param {number} minZ
 * @param {number} maxZ
 */
function rayAabb(origin, dir, minX, maxX, minY, maxY, minZ, maxZ) {
  let tMin = 0;
  let tMax = MAX_RANGE;

  // X
  if (Math.abs(dir.x) < 1e-8) {
    if (origin.x < minX || origin.x > maxX) return null;
  } else {
    let t1 = (minX - origin.x) / dir.x;
    let t2 = (maxX - origin.x) / dir.x;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  // Y
  if (Math.abs(dir.y) < 1e-8) {
    if (origin.y < minY || origin.y > maxY) return null;
  } else {
    let t1 = (minY - origin.y) / dir.y;
    let t2 = (maxY - origin.y) / dir.y;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  // Z
  if (Math.abs(dir.z) < 1e-8) {
    if (origin.z < minZ || origin.z > maxZ) return null;
  } else {
    let t1 = (minZ - origin.z) / dir.z;
    let t2 = (maxZ - origin.z) / dir.z;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin >= 0 ? tMin : tMax >= 0 ? tMax : null;
}

function closestColliderHit(origin, dir, colliders) {
  let best = Infinity;
  if (!colliders) return best;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const t = rayAabb(
      origin,
      dir,
      c.minX,
      c.maxX,
      BUILDING_MIN_Y,
      BUILDING_MAX_Y,
      c.minZ,
      c.maxZ,
    );
    if (t != null && t < best) best = t;
  }
  return best;
}

function buildViewmodel() {
  const root = new THREE.Group();
  root.name = 'viewmodel';

  const bodyMat = new THREE.MeshLambertMaterial({ color: BODY });
  const slideMat = new THREE.MeshLambertMaterial({ color: SLIDE });
  const cyanMat = new THREE.MeshBasicMaterial({ color: CYAN });
  const magMat = new THREE.MeshBasicMaterial({ color: MAGENTA });

  // Receiver / body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.42), bodyMat);
  body.position.set(0, 0, -0.08);
  root.add(body);

  // Barrel
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.28), slideMat);
  barrel.position.set(0, 0.02, -0.38);
  root.add(barrel);

  // Mag well accent
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.1), magMat);
  mag.position.set(0, -0.12, 0.02);
  root.add(mag);

  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), bodyMat);
  grip.position.set(0, -0.16, 0.1);
  grip.rotation.x = 0.25;
  root.add(grip);

  // Cyan rail / neon strip
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.36), cyanMat);
  rail.position.set(0, 0.08, -0.12);
  root.add(rail);

  // Side neon accents
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.2), cyanMat);
  sideL.position.set(-0.065, 0.02, -0.1);
  root.add(sideL);
  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.2), magMat);
  sideR.position.set(0.065, 0.02, -0.1);
  root.add(sideR);

  // Muzzle flash (hidden by default)
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xaaffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), flashMat);
  flash.position.set(0, 0.02, -0.55);
  flash.visible = false;
  root.add(flash);

  // Rest pose: bottom-right of view
  root.position.set(0.28, -0.28, -0.45);
  root.rotation.set(0.04, 0.12, 0.04);

  return { root, flash, flashMat };
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {*} player
 * @param {*} world
 * @param {*} enemies
 * @param {*} hud
 */
export function createWeaponSystem(scene, camera, player, world, enemies, hud) {
  void scene;

  let mag = MAG_SIZE;
  let reserve = RESERVE_MAX;
  let fireCooldown = 0;
  let reloadTimer = 0;
  let reloading = false;
  let fireHeld = false;
  let flashTimer = 0;

  // Recoil offsets (applied on top of rest pose)
  let recoilKick = 0;
  let recoilYaw = 0;

  // Bob phase
  let bobPhase = 0;

  const { root: viewmodel, flash, flashMat } = buildViewmodel();
  const restPos = viewmodel.position.clone();
  const restRot = viewmodel.rotation.clone();
  camera.add(viewmodel);

  const raycaster = new THREE.Raycaster();
  raycaster.far = MAX_RANGE;

  const _origin = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _hitPoint = new THREE.Vector3();
  const _tmpMeshes = [];

  function syncAmmo() {
    hud?.setAmmo?.(mag, reserve);
  }

  syncAmmo();

  function tryReload() {
    if (reloading) return;
    if (mag >= MAG_SIZE) return;
    if (reserve <= 0) return;
    reloading = true;
    reloadTimer = RELOAD_TIME;
  }

  function finishReload() {
    const need = MAG_SIZE - mag;
    const take = Math.min(need, reserve);
    mag += take;
    reserve -= take;
    reloading = false;
    reloadTimer = 0;
    syncAmmo();
  }

  function fire() {
    if (reloading || mag <= 0) return;
    if (player.isDead) return;

    mag -= 1;
    syncAmmo();
    fireCooldown = FIRE_INTERVAL;

    // Recoil + muzzle flash
    recoilKick = 0.085;
    recoilYaw = (Math.random() - 0.5) * 0.04;
    flash.visible = true;
    flash.rotation.z = Math.random() * Math.PI;
    flash.scale.setScalar(0.85 + Math.random() * 0.4);
    flashMat.color.setHex(Math.random() > 0.35 ? 0xaaffff : 0xff88ee);
    flashTimer = MUZZLE_FLASH_MS;

    // Hitscan from camera look
    const originApi = player.getInteractionOrigin?.();
    if (originApi) {
      _origin.copy(originApi.position);
      _dir.copy(originApi.direction).normalize();
    } else {
      camera.getWorldPosition(_origin);
      camera.getWorldDirection(_dir);
    }

    raycaster.set(_origin, _dir);

    // Building block distance
    const wallDist = closestColliderHit(_origin, _dir, world?.colliders);

    // Enemy raycast
    const targets = enemies?.getShootTargets?.() ?? [];
    _tmpMeshes.length = 0;
    const meshToEnemy = new Map();
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const obj = t.object || t.mesh;
      if (!obj) continue;
      _tmpMeshes.push(obj);
      meshToEnemy.set(obj, t.enemy);
    }

    let hitEnemy = null;
    let hitDist = Infinity;
    let hitPoint = null;

    if (_tmpMeshes.length > 0) {
      const hits = raycaster.intersectObjects(_tmpMeshes, true);
      if (hits.length > 0) {
        const h = hits[0];
        // Walk up to find mapped root if child mesh was hit
        let obj = h.object;
        let enemy = meshToEnemy.get(obj);
        while (!enemy && obj.parent) {
          obj = obj.parent;
          enemy = meshToEnemy.get(obj);
        }
        if (enemy != null && h.distance < hitDist) {
          hitEnemy = enemy;
          hitDist = h.distance;
          hitPoint = h.point;
        }
      }
    }

    // Wall closer than enemy → miss
    if (hitEnemy && wallDist < hitDist) {
      hitEnemy = null;
      hitPoint = null;
    }

    if (hitEnemy) {
      _hitPoint.copy(hitPoint);
      enemies.damage(hitEnemy, DAMAGE, _hitPoint);
      hud?.showHitMarker?.();
      hud?.onShot?.({ hit: true });
    } else {
      hud?.onShot?.({ hit: false });
    }
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    fireHeld = true;
  }

  function onMouseUp(event) {
    if (event.button !== 0) return;
    fireHeld = false;
  }

  function onKeyDown(event) {
    if (!player.isLocked) return;
    if (event.code === 'KeyR') {
      event.preventDefault();
      tryReload();
    }
  }

  function onBlur() {
    fireHeld = false;
  }

  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', onBlur);

  function update(dt) {
    if (!player.isLocked) {
      fireHeld = false;
    }

    // Reload
    if (reloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) finishReload();
    }

    // Auto-fire while held
    if (fireCooldown > 0) fireCooldown -= dt;
    if (
      player.isLocked &&
      fireHeld &&
      !reloading &&
      mag > 0 &&
      fireCooldown <= 0 &&
      !player.isDead
    ) {
      fire();
    }

    // Empty mag + held → auto-reload when reserve available
    if (
      player.isLocked &&
      fireHeld &&
      !reloading &&
      mag <= 0 &&
      reserve > 0
    ) {
      tryReload();
    }

    // Muzzle flash
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flash.visible = false;
        flashTimer = 0;
      }
    }

    // Recoil recover
    recoilKick *= Math.exp(-14 * dt);
    recoilYaw *= Math.exp(-12 * dt);
    if (recoilKick < 0.0005) recoilKick = 0;
    if (Math.abs(recoilYaw) < 0.0005) recoilYaw = 0;

    // Gun bob from horizontal speed
    const vx = player.velocity?.x ?? 0;
    const vz = player.velocity?.z ?? 0;
    const speed = Math.hypot(vx, vz);
    const bobAmp = Math.min(speed / 9, 1) * 0.018;
    if (speed > 0.4) {
      bobPhase += dt * (8 + speed * 1.2);
    } else {
      bobPhase *= Math.exp(-6 * dt);
    }
    const bobY = Math.sin(bobPhase) * bobAmp;
    const bobX = Math.cos(bobPhase * 0.5) * bobAmp * 0.55;

    // Reload dip
    const reloadDip = reloading ? Math.sin((1 - reloadTimer / RELOAD_TIME) * Math.PI) * 0.12 : 0;

    viewmodel.position.set(
      restPos.x + bobX + recoilYaw * 0.3,
      restPos.y + bobY - recoilKick * 0.35 - reloadDip,
      restPos.z + recoilKick * 0.5,
    );
    viewmodel.rotation.set(
      restRot.x - recoilKick * 1.8 - reloadDip * 0.8,
      restRot.y + recoilYaw,
      restRot.z + recoilYaw * 0.5,
    );
  }

  function getAmmo() {
    return { mag, reserve };
  }

  function dispose() {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', onBlur);
    camera.remove(viewmodel);
    viewmodel.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  return { update, getAmmo, dispose };
}
