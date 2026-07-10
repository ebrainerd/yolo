/**
 * City world module — IMPLEMENT THIS FILE.
 *
 * Export: createWorld(scene) -> {
 *   colliders: Array<{ minX, maxX, minZ, maxZ }>,  // AABB footprints for buildings
 *   walkableBounds: { minX, maxX, minZ, maxZ },
 *   getGroundHeight(x, z): number,                 // usually 0
 *   update?(dt, elapsed, player): void,            // neon flicker / ambient motion
 * }
 *
 * Requirements:
 * - Night-time neon city: grid of streets + buildings with glowing windows/signs
 * - Street lamps with point lights along roads
 * - Dark wet-looking asphalt ground with subtle grid/road markings
 * - Ambient + hemisphere lighting for night mood (deep blue, cyan/magenta neon accents)
 * - Fog already set on scene; keep colors cohesive
 * - Populate colliders for solid buildings so the player can't walk through them
 * - Leave open plazas / sidewalks for NPC placement
 * - City roughly 80x80 to 120x120 units centered near origin
 */

import * as THREE from 'three';

export function createWorld(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x0a0c14, roughness: 0.1, metalness: 0.8 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const hemi = new THREE.HemisphereLight(0x1a2040, 0x050508, 0.45);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x102030, 0.25);
  scene.add(ambient);

  return {
    colliders: [],
    walkableBounds: { minX: -48, maxX: 48, minZ: -48, maxZ: 48 },
    getGroundHeight() {
      return 0;
    },
    update() {},
  };
}
