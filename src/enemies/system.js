/**
 * Hostile enemy AI for Neon Nocturne FPS.
 */

import * as THREE from 'three';
import { createHostileDroneMesh } from './drone.js';

const ENEMY_COUNT = 12;
const CHASE_RANGE = 26;
const ATTACK_RANGE = 16;
const PATROL_SPEED = 1.6;
const CHASE_SPEED = 3.5;
const WAYPOINT_REACH = 0.4;
const WANDER_RADIUS = 5.5;
const ATTACK_COOLDOWN_MIN = 1.1;
const ATTACK_COOLDOWN_MAX = 1.4;
const ATTACK_DAMAGE_MIN = 8;
const ATTACK_DAMAGE_MAX = 12;
const HP_MIN = 45;
const HP_MAX = 60;
const RESPAWN_MIN = 5;
const RESPAWN_MAX = 7;
const PLAYER_SPAWN_X = 0;
const PLAYER_SPAWN_Z = 8;
// Must stay beyond ATTACK_RANGE so spawn is not a free-fire zone.
const SPAWN_CLEARANCE = 28;
const SCORE_PER_KILL = 100;

const ENEMY_NAMES = [
  'Null Warden',
  'Chrome Jackal',
  'Red Static',
  'Ash Reaper',
  'Volt Howler',
  'Crimson Relay',
  'Night Scalpel',
  'Iron Phantom',
  'Bleed Circuit',
  'Hex Runner',
  'Scar Beacon',
  'Doom Pulse',
];

/** Plaza / street spawn candidates away from player origin. */
const SPAWN_CANDIDATES = [
  { x: -18, z: -6 },
  { x: 18, z: -6 },
  { x: -28, z: 4 },
  { x: 28, z: 4 },
  { x: -16, z: -20 },
  { x: 16, z: 20 },
  { x: 0, z: -26 },
  { x: -24, z: 16 },
  { x: 24, z: -16 },
  { x: -10, z: -32 },
  { x: 10, z: 30 },
  { x: 32, z: 12 },
  { x: -32, z: -10 },
  { x: 6, z: -18 },
  { x: -6, z: 22 },
  { x: 20, z: 8 },
];

function pointInCollider(x, z, collider, padding = 0.7) {
  return (
    x >= collider.minX - padding &&
    x <= collider.maxX + padding &&
    z >= collider.minZ - padding &&
    z <= collider.maxZ + padding
  );
}

function isBlocked(x, z, world) {
  const colliders = world?.colliders ?? [];
  for (let i = 0; i < colliders.length; i++) {
    if (pointInCollider(x, z, colliders[i])) return true;
  }
  return false;
}

function clampToBounds(x, z, world) {
  const b = world?.walkableBounds ?? { minX: -48, maxX: 48, minZ: -48, maxZ: 48 };
  return {
    x: THREE.MathUtils.clamp(x, b.minX + 1.2, b.maxX - 1.2),
    z: THREE.MathUtils.clamp(z, b.minZ + 1.2, b.maxZ - 1.2),
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

function isFacingPlayer(mesh, px, pz, maxAngle = 0.85) {
  const dx = px - mesh.position.x;
  const dz = pz - mesh.position.z;
  if (dx * dx + dz * dz < 1e-4) return true;
  const targetYaw = Math.atan2(dx, dz);
  let delta = targetYaw - mesh.rotation.y;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta) <= maxAngle;
}

function pickSpawnPositions(world, count, avoidList = []) {
  const chosen = [];
  const shuffled = [...SPAWN_CANDIDATES].sort(() => Math.random() - 0.5);

  const tooCloseToAny = (x, z, minDist) => {
    if (distXZ(x, z, PLAYER_SPAWN_X, PLAYER_SPAWN_Z) < SPAWN_CLEARANCE) return true;
    for (let i = 0; i < chosen.length; i++) {
      if (distXZ(chosen[i].x, chosen[i].z, x, z) < minDist) return true;
    }
    for (let i = 0; i < avoidList.length; i++) {
      if (distXZ(avoidList[i].x, avoidList[i].z, x, z) < minDist) return true;
    }
    return false;
  };

  for (const spot of shuffled) {
    if (chosen.length >= count) break;
    const { x, z } = clampToBounds(spot.x, spot.z, world);
    if (isBlocked(x, z, world)) continue;
    if (tooCloseToAny(x, z, 5.5)) continue;
    chosen.push({ x, z });
  }

  let ring = 14;
  while (chosen.length < count && ring < 44) {
    for (let i = 0; i < 10 && chosen.length < count; i++) {
      const angle = (i / 10) * Math.PI * 2 + ring * 0.2;
      const x0 = Math.cos(angle) * ring;
      const z0 = Math.sin(angle) * ring + 2;
      const { x, z } = clampToBounds(x0, z0, world);
      if (isBlocked(x, z, world)) continue;
      if (tooCloseToAny(x, z, 5)) continue;
      chosen.push({ x, z });
    }
    ring += 3.5;
  }

  return chosen;
}

function randomNearbyWaypoint(enemy, world) {
  const home = enemy.home;
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.4 + Math.random() * WANDER_RADIUS;
    let x = home.x + Math.cos(angle) * radius;
    let z = home.z + Math.sin(angle) * radius;
    ({ x, z } = clampToBounds(x, z, world));
    if (!isBlocked(x, z, world)) return { x, z };
  }
  return { x: home.x, z: home.z };
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function moveToward(enemy, tx, tz, speed, dt, world) {
  const mesh = enemy.mesh;
  const dist = distXZ(mesh.position.x, mesh.position.z, tx, tz);
  if (dist < 1e-4) return false;

  const step = Math.min(speed * dt, dist);
  const nx = mesh.position.x + ((tx - mesh.position.x) / dist) * step;
  const nz = mesh.position.z + ((tz - mesh.position.z) / dist) * step;

  if (isBlocked(nx, nz, world)) {
    // Slide along axes if diagonal blocked
    if (!isBlocked(nx, mesh.position.z, world)) {
      mesh.position.x = nx;
    } else if (!isBlocked(mesh.position.x, nz, world)) {
      mesh.position.z = nz;
    } else {
      return false;
    }
  } else {
    mesh.position.x = nx;
    mesh.position.z = nz;
  }

  const clamped = clampToBounds(mesh.position.x, mesh.position.z, world);
  mesh.position.x = clamped.x;
  mesh.position.z = clamped.z;
  return true;
}

function applyHover(enemy, elapsed) {
  const mesh = enemy.mesh;
  const gy = mesh.userData.baseY;
  const bob = Math.sin(elapsed * 3.2 + enemy.phase) * 0.08;
  mesh.position.y = gy + bob;

  const ring = mesh.userData.ring;
  if (ring) ring.rotation.z = elapsed * 2.4 + enemy.phase;

  const fins = mesh.userData.fins;
  if (fins) {
    const flap = Math.sin(elapsed * 8 + enemy.phase) * 0.15;
    fins.left.rotation.z = 0.35 + flap;
    fins.right.rotation.z = -0.35 - flap;
  }
}

export function createEnemySystem(scene, world, player, hud) {
  const spawnSpots = pickSpawnPositions(world, ENEMY_COUNT);
  const enemies = [];

  for (let i = 0; i < ENEMY_COUNT; i++) {
    const spot = spawnSpots[i] ?? { x: 14 + (i % 4) * 4, z: -14 - Math.floor(i / 4) * 4 };
    const y = groundY(world, spot.x, spot.z);
    const mesh = createHostileDroneMesh(i);
    mesh.position.set(spot.x, y, spot.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.userData.baseY = y;
    mesh.scale.set(1, 1, 1);
    mesh.visible = true;
    scene.add(mesh);

    const maxHp = Math.round(randRange(HP_MIN, HP_MAX));
    enemies.push({
      id: `enemy-${i}`,
      name: ENEMY_NAMES[i % ENEMY_NAMES.length],
      mesh,
      position: mesh.position,
      hp: maxHp,
      maxHp,
      state: 'patrol',
      home: { x: spot.x, z: spot.z },
      waypoint: randomNearbyWaypoint(
        { home: { x: spot.x, z: spot.z } },
        world,
      ),
      // Long first cooldown so nothing opens up the instant the player enters.
      attackCooldown: randRange(2.5, 4),
      respawnTimer: 0,
      phase: Math.random() * Math.PI * 2,
      deathAnim: 0,
    });
  }

  function placeAt(enemy, x, z) {
    const gy = groundY(world, x, z);
    enemy.mesh.position.set(x, gy, z);
    enemy.mesh.userData.baseY = gy;
    enemy.home.x = x;
    enemy.home.z = z;
    enemy.waypoint = randomNearbyWaypoint(enemy, world);
  }

  function respawnEnemy(enemy) {
    const occupied = enemies
      .filter((e) => e !== enemy && e.state !== 'dead')
      .map((e) => ({ x: e.position.x, z: e.position.z }));
    const spots = pickSpawnPositions(world, 1, occupied);
    const spot = spots[0] ?? { x: 20, z: -20 };
    placeAt(enemy, spot.x, spot.z);

    enemy.hp = enemy.maxHp;
    enemy.state = 'patrol';
    enemy.attackCooldown = randRange(ATTACK_COOLDOWN_MIN, ATTACK_COOLDOWN_MAX);
    enemy.respawnTimer = 0;
    enemy.deathAnim = 0;
    enemy.mesh.scale.set(1, 1, 1);
    enemy.mesh.visible = true;
    enemy.mesh.rotation.y = Math.random() * Math.PI * 2;
  }

  function killEnemy(enemy) {
    if (enemy.state === 'dead') return false;
    enemy.state = 'dead';
    enemy.hp = 0;
    enemy.deathAnim = 0.45;
    enemy.respawnTimer = randRange(RESPAWN_MIN, RESPAWN_MAX);
    hud?.onKill?.(enemy.name);
    hud?.addScore?.(SCORE_PER_KILL);
    return true;
  }

  function damage(enemy, amount, hitPoint) {
    void hitPoint;
    if (!enemy || enemy.state === 'dead' || enemy.hp <= 0) return false;
    enemy.hp = Math.max(0, enemy.hp - amount);
    // Brief hit flash via scale pulse
    enemy.mesh.scale.setScalar(1.08);
    if (enemy.hp <= 0) {
      return killEnemy(enemy);
    }
    return false;
  }

  function getShootTargets() {
    const targets = [];
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.state === 'dead' || enemy.hp <= 0) continue;
      const object = enemy.mesh.userData.hitbox ?? enemy.mesh;
      targets.push({ enemy, object });
    }
    return targets;
  }

  function update(dt, elapsed, p = player) {
    const { x: px, z: pz } = playerXZ(p);
    const playerDead = !!p?.isDead;
    // No aggro / damage until the run has started (title screen / death unlock).
    const combatLive = !!p?.combatActive && !playerDead;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const mesh = enemy.mesh;
      const gy = groundY(world, mesh.position.x, mesh.position.z);
      mesh.userData.baseY = gy;

      if (enemy.state === 'dead') {
        if (enemy.deathAnim > 0) {
          enemy.deathAnim -= dt;
          const t = Math.max(0, enemy.deathAnim / 0.45);
          const s = Math.max(0.05, t);
          mesh.scale.set(s, s * 0.7, s);
          if (enemy.deathAnim <= 0) {
            mesh.visible = false;
            mesh.scale.set(1, 1, 1);
          }
        }
        enemy.respawnTimer -= dt;
        if (enemy.respawnTimer <= 0) {
          respawnEnemy(enemy);
        }
        continue;
      }

      // Ease hit pulse back
      if (mesh.scale.x > 1.001) {
        const s = THREE.MathUtils.lerp(mesh.scale.x, 1, Math.min(1, dt * 12));
        mesh.scale.setScalar(s);
      }

      const dPlayer = distXZ(mesh.position.x, mesh.position.z, px, pz);

      if (!combatLive) {
        // Idle patrol only while the player is on the title / dead screen.
        if (enemy.state !== 'patrol' && enemy.state !== 'dead') {
          enemy.state = 'patrol';
          enemy.waypoint = randomNearbyWaypoint(enemy, world);
        }
      } else if (dPlayer <= ATTACK_RANGE) {
        enemy.state = 'attack';
      } else if (dPlayer <= CHASE_RANGE) {
        enemy.state = 'chase';
      } else if (enemy.state !== 'patrol') {
        enemy.state = 'patrol';
        enemy.waypoint = randomNearbyWaypoint(enemy, world);
      }

      if (enemy.state === 'patrol') {
        if (!enemy.waypoint) {
          enemy.waypoint = randomNearbyWaypoint(enemy, world);
        }
        const wx = enemy.waypoint.x;
        const wz = enemy.waypoint.z;
        const dist = distXZ(mesh.position.x, mesh.position.z, wx, wz);
        if (dist <= WAYPOINT_REACH) {
          enemy.waypoint = randomNearbyWaypoint(enemy, world);
        } else {
          const ok = moveToward(enemy, wx, wz, PATROL_SPEED, dt, world);
          if (!ok) enemy.waypoint = randomNearbyWaypoint(enemy, world);
          faceToward(mesh, wx, wz, Math.min(1, dt * 5));
        }
        applyHover(enemy, elapsed);
        continue;
      }

      if (enemy.state === 'chase') {
        moveToward(enemy, px, pz, CHASE_SPEED, dt, world);
        faceToward(mesh, px, pz, Math.min(1, dt * 8));
        applyHover(enemy, elapsed);
        continue;
      }

      if (enemy.state === 'attack') {
        // Keep pressure — drift toward player while attacking
        if (dPlayer > 4) {
          moveToward(enemy, px, pz, CHASE_SPEED * 0.85, dt, world);
        }
        faceToward(mesh, px, pz, Math.min(1, dt * 10));
        applyHover(enemy, elapsed);

        if (!combatLive) {
          applyHover(enemy, elapsed);
          continue;
        }

        enemy.attackCooldown -= dt;
        if (
          enemy.attackCooldown <= 0 &&
          dPlayer <= ATTACK_RANGE &&
          isFacingPlayer(mesh, px, pz)
        ) {
          const dmg = Math.round(randRange(ATTACK_DAMAGE_MIN, ATTACK_DAMAGE_MAX));
          p.takeDamage?.(dmg);
          enemy.attackCooldown = randRange(ATTACK_COOLDOWN_MIN, ATTACK_COOLDOWN_MAX);
        } else if (enemy.attackCooldown <= 0) {
          // Retry soon if not facing / out of range briefly
          enemy.attackCooldown = 0.25;
        }
      }
    }
  }

  return {
    enemies,
    update,
    getShootTargets,
    damage,
  };
}
