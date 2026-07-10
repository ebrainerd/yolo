/**
 * NPC system module — IMPLEMENT THIS FILE.
 *
 * Export: createNpcSystem(scene, world, player, hud) -> {
 *   npcs: Array<NPC>,
 *   update(dt, elapsed, player): void,
 *   getNearestInteractable(player): NPC | null,
 *   interact(npc): void,
 * }
 *
 * NPC shape:
 * {
 *   id, name, mesh, position,
 *   lines: string[],          // philosophical one-liners
 *   state: 'idle'|'talking'|'wander',
 * }
 *
 * Requirements:
 * - Spawn 6–10 stylized humanoid NPCs around plazas/sidewalks (avoid building colliders)
 * - Idle / wander along open ground; face player when talking
 * - Press E (when near + prompted by HUD) to talk
 * - Each talk picks a random philosophical line — absurd, earnest, unsolicited
 * - Call hud.showDialogue(name, text) / hud.hideDialogue()
 * - Call hud.setPrompt(text|null) when near an NPC
 * - Distinct neon-ish clothing colors so they read at night
 */

export function createNpcSystem(scene, world, player, hud) {
  void scene;
  void world;
  void player;
  void hud;

  return {
    npcs: [],
    update() {},
    getNearestInteractable() {
      return null;
    },
    interact() {},
  };
}
