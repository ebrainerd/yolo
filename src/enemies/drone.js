import * as THREE from 'three';

/** Shared materials — few draws, no lights, no shadows. */
const MATS = {
  hull: new THREE.MeshLambertMaterial({
    color: 0x1a0a0c,
    emissive: 0x4a1018,
    emissiveIntensity: 0.55,
  }),
  armor: new THREE.MeshLambertMaterial({
    color: 0x2a1210,
    emissive: 0xc23a12,
    emissiveIntensity: 0.7,
  }),
  accent: new THREE.MeshLambertMaterial({
    color: 0x3a0808,
    emissive: 0xff2a1a,
    emissiveIntensity: 0.95,
  }),
  eye: new THREE.MeshBasicMaterial({ color: 0xff5533 }),
  ring: new THREE.MeshBasicMaterial({ color: 0xff8844 }),
};

const GEO = {
  body: new THREE.SphereGeometry(0.38, 8, 6),
  core: new THREE.BoxGeometry(0.55, 0.22, 0.4),
  fin: new THREE.BoxGeometry(0.12, 0.08, 0.35),
  eye: new THREE.SphereGeometry(0.12, 6, 4),
  ring: new THREE.TorusGeometry(0.42, 0.035, 4, 12),
  spike: new THREE.ConeGeometry(0.08, 0.22, 4),
};

/**
 * Low-poly hostile neon drone — clearly distinct from peaceful NPC humanoids.
 * Returns a Group; userData.hitbox is the torso/body mesh for raycasts.
 */
export function createHostileDroneMesh(variant = 0) {
  const root = new THREE.Group();
  const hullMat = MATS.hull;
  const armorMat = variant % 2 === 0 ? MATS.armor : MATS.accent;

  const body = new THREE.Mesh(GEO.body, hullMat);
  body.position.y = 1.15;
  body.scale.set(1, 0.85, 1.1);
  root.add(body);

  const core = new THREE.Mesh(GEO.core, armorMat);
  core.position.y = 1.05;
  root.add(core);

  const eye = new THREE.Mesh(GEO.eye, MATS.eye);
  eye.position.set(0, 1.2, 0.32);
  root.add(eye);

  const ring = new THREE.Mesh(GEO.ring, MATS.ring);
  ring.position.y = 0.95;
  ring.rotation.x = Math.PI / 2;
  root.add(ring);

  const leftFin = new THREE.Mesh(GEO.fin, armorMat);
  leftFin.position.set(-0.38, 1.1, -0.05);
  leftFin.rotation.z = 0.35;
  root.add(leftFin);

  const rightFin = new THREE.Mesh(GEO.fin, armorMat);
  rightFin.position.set(0.38, 1.1, -0.05);
  rightFin.rotation.z = -0.35;
  root.add(rightFin);

  const spike = new THREE.Mesh(GEO.spike, MATS.accent);
  spike.position.set(0, 1.48, 0);
  root.add(spike);

  // Hitbox = body sphere (good Raycaster target)
  root.userData.hitbox = body;
  root.userData.ring = ring;
  root.userData.eye = eye;
  root.userData.fins = { left: leftFin, right: rightFin };

  return root;
}
