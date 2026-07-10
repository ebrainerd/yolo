import * as THREE from 'three';

/**
 * Stylized low-poly humanoid (Lambert/Basic — cheap at night).
 */
export function createHumanoidMesh(clothingColor) {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: 0xc4a88a });
  const clothMat = new THREE.MeshLambertMaterial({
    color: clothingColor,
    emissive: clothingColor,
    emissiveIntensity: 0.45,
  });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1c28 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.28), clothMat);
  torso.position.y = 1.15;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  head.position.y = 1.58;
  root.add(head);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), clothMat);
  leftArm.position.set(-0.3, 1.12, 0);
  root.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), clothMat);
  rightArm.position.set(0.3, 1.12, 0);
  root.add(rightArm);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), darkMat);
  leftLeg.position.set(-0.12, 0.4, 0);
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), darkMat);
  rightLeg.position.set(0.12, 0.4, 0);
  root.add(rightLeg);

  root.userData.limbs = { leftArm, rightArm, leftLeg, rightLeg };
  return root;
}
