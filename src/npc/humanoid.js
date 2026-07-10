import * as THREE from 'three';

/**
 * Build a stylized low-poly humanoid (head + torso + limbs).
 * Returns a Group with limb refs for a simple walk bob.
 */
export function createHumanoidMesh(clothingColor) {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc4a88a,
    roughness: 0.75,
    metalness: 0.05,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: clothingColor,
    emissive: clothingColor,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.25,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c28,
    roughness: 0.85,
    metalness: 0.1,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.28), clothMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  head.position.y = 1.58;
  head.castShadow = true;
  root.add(head);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), clothMat);
  leftArm.position.set(-0.3, 1.12, 0);
  leftArm.castShadow = true;
  root.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), clothMat);
  rightArm.position.set(0.3, 1.12, 0);
  rightArm.castShadow = true;
  root.add(rightArm);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), darkMat);
  leftLeg.position.set(-0.12, 0.4, 0);
  leftLeg.castShadow = true;
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), darkMat);
  rightLeg.position.set(0.12, 0.4, 0);
  rightLeg.castShadow = true;
  root.add(rightLeg);

  root.userData.limbs = { leftArm, rightArm, leftLeg, rightLeg };
  return root;
}
