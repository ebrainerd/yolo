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
 * Resolve circle-vs-AABB overlap on one axis only so the other axis can slide.
 * Returns the corrected coordinate for `axis`.
 */
function resolveAxis(x, z, radius, colliders, axis) {
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
    } else if (axis === 'x') {
      const penLeft = x - c.minX;
      const penRight = c.maxX - x;
      x = penLeft < penRight ? c.minX - radius : c.maxX + radius;
    } else {
      const penNear = z - c.minZ;
      const penFar = c.maxZ - z;
      z = penNear < penFar ? c.minZ - radius : c.maxZ + radius;
    }
  }
  return axis === 'x' ? x : z;
}

function clampToBounds(x, z, bounds, radius) {
  if (!bounds) return { x, z };
  return {
    x: Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, x)),
    z: Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, z)),
  };
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLCanvasElement} canvas
 * @param {{ colliders?: Array, walkableBounds?: object, getGroundHeight?: Function }} world
 */
export function createPlayer(camera, canvas, world) {
  const position = new THREE.Vector3(0, 0, 8);
  const velocity = new THREE.Vector3();
  const keys = new Set();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wishDir = new THREE.Vector3();
  const eyePosition = new THREE.Vector3();
  const lookDirection = new THREE.Vector3();

  let pitch = 0;
  let onGround = false;

  const spawnGround = world.getGroundHeight?.(position.x, position.z) ?? 0;
  position.y = spawnGround;
  camera.rotation.order = 'YXZ';

  const api = {
    position,
    velocity,
    yaw: 0,
    isLocked: false,

    lockPointer() {
      canvas.requestPointerLock?.();
    },

    update(dt, activeWorld) {
      const w = activeWorld || world;
      const colliders = w.colliders || [];
      const bounds = w.walkableBounds;

      const forwardInput =
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const rightInput =
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
        (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);

      const yaw = api.yaw;
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));

      wishDir.set(0, 0, 0);
      if (forwardInput !== 0 || rightInput !== 0) {
        wishDir
          .addScaledVector(forward, forwardInput)
          .addScaledVector(right, rightInput)
          .normalize();
      }

      const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
      velocity.x = wishDir.x * speed;
      velocity.z = wishDir.z * speed;

      if (onGround && keys.has('Space')) {
        velocity.y = JUMP_SPEED;
        onGround = false;
      }

      velocity.y -= GRAVITY * dt;

      // Move and resolve X, then Z — wall sliding without getting stuck on corners.
      let nextX = position.x + velocity.x * dt;
      let nextZ = position.z;
      nextX = resolveAxis(nextX, nextZ, PLAYER_RADIUS, colliders, 'x');

      nextZ = position.z + velocity.z * dt;
      nextZ = resolveAxis(nextX, nextZ, PLAYER_RADIUS, colliders, 'z');

      // Clean up residual corner overlap after both axes moved.
      nextX = resolveAxis(nextX, nextZ, PLAYER_RADIUS, colliders, 'x');
      nextZ = resolveAxis(nextX, nextZ, PLAYER_RADIUS, colliders, 'z');

      const clamped = clampToBounds(nextX, nextZ, bounds, PLAYER_RADIUS);
      position.x = clamped.x;
      position.z = clamped.z;

      position.y += velocity.y * dt;
      const groundY = w.getGroundHeight?.(position.x, position.z) ?? 0;

      if (position.y <= groundY + GROUND_SNAP && velocity.y <= 0) {
        position.y = groundY;
        velocity.y = 0;
        onGround = true;
      } else {
        onGround = false;
      }

      camera.position.set(position.x, position.y + EYE_HEIGHT, position.z);
      euler.set(pitch, api.yaw, 0);
      camera.quaternion.setFromEuler(euler);
    },

    getInteractionOrigin() {
      eyePosition.set(position.x, position.y + EYE_HEIGHT, position.z);
      lookDirection.set(0, 0, -1).applyQuaternion(camera.quaternion);
      return {
        position: eyePosition.clone(),
        direction: lookDirection.clone(),
      };
    },
  };

  function onPointerLockChange() {
    api.isLocked = document.pointerLockElement === canvas;
  }

  function onMouseMove(event) {
    if (!api.isLocked) return;
    api.yaw -= event.movementX * MOUSE_SENSITIVITY;
    pitch -= event.movementY * MOUSE_SENSITIVITY;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  }

  function onKeyDown(event) {
    keys.add(event.code);
    if (
      api.isLocked &&
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

  camera.position.set(position.x, position.y + EYE_HEIGHT, position.z);
  euler.set(pitch, api.yaw, 0);
  camera.quaternion.setFromEuler(euler);

  return api;
}
