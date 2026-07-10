/**
 * First-person player controls for Neon Nocturne.
 * Pointer-lock look, WASD + sprint/jump, gravity, AABB slide collision.
 */

import * as THREE from 'three';

const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const WALK_SPEED = 4.5;
const SPRINT_SPEED = 9;
const JUMP_SPEED = 7.5;
const GRAVITY = 22;
const GROUND_SNAP = 0.08;
const MOUSE_SENSITIVITY = 0.0022;
const PITCH_LIMIT = 1.4;

/**
 * Resolve circle (XZ) against AABB colliders, axis-separated for wall sliding.
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>} colliders
 * @param {'x'|'z'} axis
 */
function resolveColliders(x, z, radius, colliders, axis) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const nearestX = Math.max(c.minX, Math.min(x, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;

    if (distSq > 1e-10) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      if (axis === 'x') x += dx * push;
      else z += dz * push;
    } else {
      // Center inside AABB — push out along the shallowest axis for this pass
      const left = x - c.minX + radius;
      const right = c.maxX - x + radius;
      const near = z - c.minZ + radius;
      const far = c.maxZ - z + radius;
      if (axis === 'x') {
        x = left < right ? c.minX - radius : c.maxX + radius;
      } else {
        z = near < far ? c.minZ - radius : c.maxZ + radius;
      }
    }
  }
  return axis === 'x' ? x : z;
}

function clampToBounds(x, z, bounds, radius) {
  if (!bounds) return { x, z };
  const minX = bounds.minX + radius;
  const maxX = bounds.maxX - radius;
  const minZ = bounds.minZ + radius;
  const maxZ = bounds.maxZ - radius;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    z: Math.min(maxZ, Math.max(minZ, z)),
  };
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLCanvasElement} canvas
 * @param {{ colliders: Array, walkableBounds: object, getGroundHeight: Function }} world
 */
export function createPlayer(camera, canvas, world) {
  const position = new THREE.Vector3(0, 0, 8);
  const velocity = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  let isLocked = false;
  let onGround = false;

  const keys = new Set();
  const eyeOffset = new THREE.Vector3(0, EYE_HEIGHT, 0);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wishDir = new THREE.Vector3();
  const eyePosition = new THREE.Vector3();
  const lookDirection = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Seed height from world ground
  const spawnGround = world.getGroundHeight?.(position.x, position.z) ?? 0;
  position.y = spawnGround;
  camera.position.set(position.x, position.y + EYE_HEIGHT, position.z);
  camera.rotation.order = 'YXZ';

  function syncCamera() {
    camera.position.set(position.x, position.y + EYE_HEIGHT, position.z);
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);
  }

  function onPointerLockChange() {
    isLocked = document.pointerLockElement === canvas;
    api.isLocked = isLocked;
  }

  function onMouseMove(event) {
    if (!isLocked) return;
    yaw -= event.movementX * MOUSE_SENSITIVITY;
    pitch -= event.movementY * MOUSE_SENSITIVITY;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  }

  function onKeyDown(event) {
    keys.add(event.code);
    // Avoid page scroll / browser shortcuts while playing
    if (
      isLocked &&
      (event.code === 'Space' ||
        event.code === 'KeyW' ||
        event.code === 'KeyA' ||
        event.code === 'KeyS' ||
        event.code === 'KeyD' ||
        event.code.startsWith('Shift'))
    ) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
  }

  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  function isDown(code) {
    return keys.has(code);
  }

  function update(dt, activeWorld) {
    const w = activeWorld || world;
    const colliders = w.colliders || [];
    const bounds = w.walkableBounds;

    // Horizontal wish direction relative to yaw
    const forwardInput =
      (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) -
      (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0);
    const rightInput =
      (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) -
      (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0);

    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    wishDir.set(0, 0, 0);
    if (forwardInput !== 0 || rightInput !== 0) {
      wishDir
        .addScaledVector(forward, forwardInput)
        .addScaledVector(right, rightInput)
        .normalize();
    }

    const sprinting = isDown('ShiftLeft') || isDown('ShiftRight');
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;

    velocity.x = wishDir.x * speed;
    velocity.z = wishDir.z * speed;

    // Jump
    if (onGround && isDown('Space')) {
      velocity.y = JUMP_SPEED;
      onGround = false;
    }

    // Gravity
    velocity.y -= GRAVITY * dt;

    // Integrate X then resolve, then Z — enables wall sliding
    let nextX = position.x + velocity.x * dt;
    let nextZ = position.z;

    nextX = resolveColliders(nextX, nextZ, PLAYER_RADIUS, colliders, 'x');

    nextZ = position.z + velocity.z * dt;
    nextZ = resolveColliders(nextX, nextZ, PLAYER_RADIUS, colliders, 'z');

    const clamped = clampToBounds(nextX, nextZ, bounds, PLAYER_RADIUS);
    position.x = clamped.x;
    position.z = clamped.z;

    // Vertical + ground
    position.y += velocity.y * dt;
    const groundY = w.getGroundHeight?.(position.x, position.z) ?? 0;

    if (position.y <= groundY + GROUND_SNAP && velocity.y <= 0) {
      position.y = groundY;
      velocity.y = 0;
      onGround = true;
    } else {
      onGround = false;
    }

    api.yaw = yaw;
    syncCamera();
  }

  function getInteractionOrigin() {
    eyePosition.set(position.x, position.y + EYE_HEIGHT, position.z);
    lookDirection.set(0, 0, -1).applyQuaternion(camera.quaternion);
    return {
      position: eyePosition.clone(),
      direction: lookDirection.clone(),
    };
  }

  const api = {
    position,
    velocity,
    get yaw() {
      return yaw;
    },
    set yaw(v) {
      yaw = v;
    },
    isLocked: false,
    lockPointer() {
      canvas.requestPointerLock?.();
    },
    update,
    getInteractionOrigin,
  };

  // Keep eyeOffset referenced for clarity / future body mesh
  void eyeOffset;

  syncCamera();
  return api;
}
