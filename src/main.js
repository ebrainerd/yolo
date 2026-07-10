import * as THREE from 'three';
import { createWorld } from './world/city.js';
import { createPlayer } from './player/controls.js';
import { attachCombat } from './player/combat.js';
import { createNpcSystem } from './npc/system.js';
import { createEnemySystem } from './enemies/system.js';
import { createWeaponSystem } from './combat/weapons.js';
import { createHUD } from './ui/hud.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060d);
scene.fog = new THREE.FogExp2(0x07091a, 0.022);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  180,
);

const clock = new THREE.Clock();

const world = createWorld(scene);
const hud = createHUD(uiRoot);
hud.mount();

const player = attachCombat(createPlayer(camera, canvas, world), hud);
const npcs = createNpcSystem(scene, world, player, hud);
const enemies = createEnemySystem(scene, world, player, hud);
const weapons = createWeaponSystem(scene, camera, player, world, enemies, hud);

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  hud.onResize?.(w, h);
}

window.addEventListener('resize', onResize);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  player.update(dt, world);
  npcs.update(dt, elapsed, player);
  enemies.update(dt, elapsed, player);
  weapons.update(dt, elapsed);
  world.update?.(dt, elapsed, player);
  hud.update?.(dt, player, npcs, enemies, weapons);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

hud.showStartOverlay(() => {
  player.lockPointer();
});

requestAnimationFrame(frame);
