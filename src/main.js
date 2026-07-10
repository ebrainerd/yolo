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

const hud = createHUD(uiRoot);
hud.mount();

function showBootError(err) {
  console.error('[Neon Nocturne]', err);
  const msg = (err && err.message) || String(err);
  const el = document.createElement('div');
  el.setAttribute('role', 'alert');
  el.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:2rem;background:#05060d;color:#e8f4ff;font-family:Space Grotesk,sans-serif;text-align:center';
  const wrap = document.createElement('div');
  wrap.style.maxWidth = '28rem';
  const title = document.createElement('p');
  title.style.cssText =
    'font-family:Orbitron,sans-serif;letter-spacing:.12em;margin-bottom:1rem;color:#ff3d9a';
  title.textContent = 'BOOT FAILED';
  const body = document.createElement('p');
  body.style.cssText = 'opacity:.85;line-height:1.5';
  body.textContent = msg;
  wrap.append(title, body);
  el.appendChild(wrap);
  document.body.appendChild(el);
}

/** @type {THREE.WebGLRenderer | null} */
let renderer = null;
/** @type {THREE.Scene | null} */
let scene = null;
/** @type {THREE.PerspectiveCamera | null} */
let camera = null;
/** @type {THREE.Clock | null} */
let clock = null;
let world = null;
let player = null;
let npcs = null;
let enemies = null;
let weapons = null;
let ready = false;
let bootFailed = false;

function initGame() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060d);
  scene.fog = new THREE.FogExp2(0x07091a, 0.022);

  camera = new THREE.PerspectiveCamera(
    75,
    Math.max(window.innerWidth, 1) / Math.max(window.innerHeight, 1),
    0.1,
    180,
  );
  // Camera must be in the scene graph so the viewmodel gun renders.
  scene.add(camera);

  clock = new THREE.Clock();

  world = createWorld(scene);
  player = attachCombat(createPlayer(camera, canvas, world), hud);
  npcs = createNpcSystem(scene, world, player, hud);
  enemies = createEnemySystem(scene, world, player, hud);
  weapons = createWeaponSystem(scene, camera, player, world, enemies, hud);
  ready = true;
}

function onResize() {
  if (!camera || !renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = Math.max(w, 1) / Math.max(h, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  hud.onResize?.(w, h);
}

window.addEventListener('resize', onResize);

function frame() {
  requestAnimationFrame(frame);
  if (bootFailed || !ready || !renderer || !scene || !camera || !player || !clock) return;

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  try {
    player.update(dt, world);
    npcs.update(dt, elapsed, player);
    enemies.update(dt, elapsed, player);
    weapons.update(dt, elapsed);
    world.update?.(dt, elapsed, player);
    hud.update?.(dt, player, npcs, enemies, weapons);
    renderer.render(scene, camera);
  } catch (err) {
    bootFailed = true;
    showBootError(err);
  }
}

// Show the branded gate BEFORE any 3D init. Previously enemies/weapons ran
// between mount() and showStartOverlay(), so a throw left a blank dark page.
hud.showStartOverlay(() => {
  if (!ready || !player) return;
  // Combat stays frozen until enter — otherwise drones kill you on the title screen.
  player.beginCombat?.();
  player.lockPointer();
});

try {
  initGame();
} catch (err) {
  bootFailed = true;
  showBootError(err);
}

requestAnimationFrame(frame);
