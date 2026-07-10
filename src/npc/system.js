/**
 * NPC system — stylized night-city wanderers with philosophical dialogue.
 */

import * as THREE from 'three';
import { NPC_PROFILES, PHILOSOPHY_LINES } from './philosophy.js';
import { createHumanoidMesh } from './humanoid.js';

const INTERACT_RANGE = 3;
const WANDER_SPEED = 0.85;
const WAYPOINT_REACH = 0.35;
const IDLE_MIN = 1.2;
const IDLE_MAX = 3.8;
const WANDER_RADIUS = 4.5;

/** Candidate plaza / sidewalk spawn spots away from player origin (~0, 0, 8). */
const SPAWN_CANDIDATES = [
  { x: -15, z: 0 },
  { x: 15, z: 0 },
  { x: -25, z: 0 },
  { x: 25, z: 0 },
  { x: -15, z: -18 },
  { x: 15, z: 18 },
  { x: 0, z: -22 },
  { x: -22, z: 14 },
  { x: 22, z: -14 },
  { x: -8, z: -30 },
  { x: 8, z: 28 },
  { x: 30, z: 10 },
];

function pointInCollider(x, z, collider, padding = 0.6) {
  return (
    x >= collider.minX - padding &&
    x <= collider.maxX + padding &&
    z >= collider.minZ - padding &&
    z <= collider.maxZ + padding
  );
}

function isBlocked(x, z, world) {
  const colliders = world?.colliders ?? [];
  for (const c of colliders) {
    if (pointInCollider(x, z, c)) return true;
  }
  return false;
}

function clampToBounds(x, z, world) {
  const b = world?.walkableBounds ?? { minX: -48, maxX: 48, minZ: -48, maxZ: 48 };
  return {
    x: THREE.MathUtils.clamp(x, b.minX + 1, b.maxX - 1),
    z: THREE.MathUtils.clamp(z, b.minZ + 1, b.maxZ - 1),
  };
}

function groundY(world, x, z) {
  return typeof world?.getGroundHeight === 'function' ? world.getGroundHeight(x, z) : 0;
}

function playerXZ(player) {
  if (typeof player.getInteractionOrigin === 'function') {
    const origin = player.getInteractionOrigin();
    if (origin?.position) {
      return { x: origin.position.x, z: origin.position.z };
    }
  }
  return { x: player.position.x, z: player.position.z };
}

function distXZ(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

function pickSpawnPositions(world, count) {
  const chosen = [];
  const shuffled = [...SPAWN_CANDIDATES].sort(() => Math.random() - 0.5);

  for (const spot of shuffled) {
    if (chosen.length >= count) break;
    const { x, z } = clampToBounds(spot.x, spot.z, world);
    if (isBlocked(x, z, world)) continue;
    if (distXZ(x, z, 0, 8) < 6) continue;
    const tooClose = chosen.some((p) => distXZ(p.x, p.z, x, z) < 6);
    if (tooClose) continue;
    chosen.push({ x, z });
  }

  // Fallback grid if colliders ate candidates
  let ring = 12;
  while (chosen.length < count && ring < 40) {
    for (let i = 0; i < 8 && chosen.length < count; i++) {
      const angle = (i / 8) * Math.PI * 2 + ring * 0.15;
      const x0 = Math.cos(angle) * ring;
      const z0 = Math.sin(angle) * ring;
      const { x, z } = clampToBounds(x0, z0, world);
      if (isBlocked(x, z, world)) continue;
      if (distXZ(x, z, 0, 8) < 6) continue;
      if (chosen.some((p) => distXZ(p.x, p.z, x, z) < 5)) continue;
      chosen.push({ x, z });
    }
    ring += 4;
  }

  return chosen;
}

function randomNearbyWaypoint(npc, world) {
  const home = npc.home;
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.2 + Math.random() * WANDER_RADIUS;
    let x = home.x + Math.cos(angle) * radius;
    let z = home.z + Math.sin(angle) * radius;
    ({ x, z } = clampToBounds(x, z, world));
    if (!isBlocked(x, z, world)) {
      return { x, z };
    }
  }
  return { x: home.x, z: home.z };
}

function faceToward(mesh, tx, tz, blend = 1) {
  const dx = tx - mesh.position.x;
  const dz = tz - mesh.position.z;
  if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
  const targetYaw = Math.atan2(dx, dz);
  const current = mesh.rotation.y;
  let delta = targetYaw - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  mesh.rotation.y = current + delta * THREE.MathUtils.clamp(blend, 0, 1);
}

function applyWalkCycle(mesh, phase, intensity) {
  const limbs = mesh.userData.limbs;
  if (!limbs) return;
  const swing = Math.sin(phase) * 0.45 * intensity;
  limbs.leftArm.rotation.x = swing;
  limbs.rightArm.rotation.x = -swing;
  limbs.leftLeg.rotation.x = -swing;
  limbs.rightLeg.rotation.x = swing;
  mesh.position.y = mesh.userData.baseY + Math.abs(Math.sin(phase)) * 0.04 * intensity;
}

function resetWalkCycle(mesh) {
  const limbs = mesh.userData.limbs;
  if (limbs) {
    limbs.leftArm.rotation.x = 0;
    limbs.rightArm.rotation.x = 0;
    limbs.leftLeg.rotation.x = 0;
    limbs.rightLeg.rotation.x = 0;
  }
  mesh.position.y = mesh.userData.baseY;
}

function pickLine(npc) {
  const pool =
    Array.isArray(npc.lines) && npc.lines.length > 0 ? npc.lines : PHILOSOPHY_LINES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function createNpcSystem(scene, world, player, hud) {
  const spawnSpots = pickSpawnPositions(world, NPC_PROFILES.length);
  const npcs = [];

  NPC_PROFILES.forEach((profile, index) => {
    const spot = spawnSpots[index] ?? { x: 10 + index * 3, z: -10 };
    const y = groundY(world, spot.x, spot.z);
    const mesh = createHumanoidMesh(profile.color);
    mesh.position.set(spot.x, y, spot.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.userData.baseY = y;
    scene.add(mesh);

    const npc = {
      id: `npc-${index}`,
      name: profile.name,
      mesh,
      position: mesh.position,
      lines: profile.lines,
      state: 'idle',
      home: { x: spot.x, z: spot.z },
      waypoint: null,
      idleTimer: IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN),
      walkPhase: Math.random() * Math.PI * 2,
    };
    npcs.push(npc);
  });

  let activeNpc = null;
  let lastPrompt = undefined;
  let eHeld = false;

  function setPrompt(text) {
    if (text === lastPrompt) return;
    lastPrompt = text;
    hud.setPrompt?.(text);
  }

  function dismissDialogue() {
    if (!activeNpc) return;
    hud.hideDialogue?.();
    if (activeNpc.state === 'talking') {
      activeNpc.state = 'idle';
      activeNpc.idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
      activeNpc.waypoint = null;
      resetWalkCycle(activeNpc.mesh);
    }
    activeNpc = null;
  }

  function getNearestInteractable(p = player) {
    const { x, z } = playerXZ(p);
    let best = null;
    let bestDist = INTERACT_RANGE;
    for (const npc of npcs) {
      const d = distXZ(npc.position.x, npc.position.z, x, z);
      if (d <= bestDist) {
        bestDist = d;
        best = npc;
      }
    }
    return best;
  }

  function interact(npc) {
    if (!npc) return;

    if (activeNpc === npc) {
      dismissDialogue();
      return;
    }

    if (activeNpc && activeNpc !== npc) {
      dismissDialogue();
    }

    const line = pickLine(npc);
    npc.state = 'talking';
    npc.waypoint = null;
    resetWalkCycle(npc.mesh);
    activeNpc = npc;

    const { x, z } = playerXZ(player);
    faceToward(npc.mesh, x, z, 1);
    hud.showDialogue?.(npc.name, line);
    setPrompt(null);
  }

  function onKeyDown(event) {
    if (event.code !== 'KeyE' || event.repeat) return;
    if (eHeld) return;
    eHeld = true;

    if (activeNpc) {
      const stillNear = getNearestInteractable(player) === activeNpc;
      if (!stillNear) {
        dismissDialogue();
        return;
      }
      interact(activeNpc);
      return;
    }

    const nearest = getNearestInteractable(player);
    if (nearest) interact(nearest);
  }

  function onKeyUp(event) {
    if (event.code === 'KeyE') eHeld = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function update(dt, elapsed, p = player) {
    const { x: px, z: pz } = playerXZ(p);

    if (activeNpc) {
      const d = distXZ(activeNpc.position.x, activeNpc.position.z, px, pz);
      if (d > INTERACT_RANGE + 0.75) {
        dismissDialogue();
      }
    }

    for (const npc of npcs) {
      const mesh = npc.mesh;
      const gy = groundY(world, mesh.position.x, mesh.position.z);
      mesh.userData.baseY = gy;

      if (npc.state === 'talking') {
        faceToward(mesh, px, pz, Math.min(1, dt * 8));
        resetWalkCycle(mesh);
        continue;
      }

      if (npc.state === 'idle') {
        npc.idleTimer -= dt;
        resetWalkCycle(mesh);
        if (npc.idleTimer <= 0) {
          npc.waypoint = randomNearbyWaypoint(npc, world);
          npc.state = 'wander';
        }
        continue;
      }

      if (npc.state === 'wander' && npc.waypoint) {
        const wx = npc.waypoint.x;
        const wz = npc.waypoint.z;
        const dist = distXZ(mesh.position.x, mesh.position.z, wx, wz);

        if (dist <= WAYPOINT_REACH) {
          npc.state = 'idle';
          npc.idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
          npc.waypoint = null;
          resetWalkCycle(mesh);
          continue;
        }

        const step = Math.min(WANDER_SPEED * dt, dist);
        const nx = mesh.position.x + ((wx - mesh.position.x) / dist) * step;
        const nz = mesh.position.z + ((wz - mesh.position.z) / dist) * step;

        if (isBlocked(nx, nz, world)) {
          npc.state = 'idle';
          npc.idleTimer = IDLE_MIN + Math.random() * 1.5;
          npc.waypoint = null;
          resetWalkCycle(mesh);
          continue;
        }

        mesh.position.x = nx;
        mesh.position.z = nz;
        faceToward(mesh, wx, wz, Math.min(1, dt * 6));
        npc.walkPhase += dt * 7;
        applyWalkCycle(mesh, npc.walkPhase, 1);
      }
    }

    const nearest = getNearestInteractable(p);
    if (activeNpc) {
      setPrompt(null);
    } else if (nearest) {
      setPrompt('Press E to talk');
    } else {
      setPrompt(null);
    }

    void elapsed;
  }

  return {
    npcs,
    update,
    getNearestInteractable,
    interact,
  };
}
