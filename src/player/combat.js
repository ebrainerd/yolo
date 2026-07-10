/**
 * Player combat: health, damage, death/respawn.
 * Call after createPlayer + createHUD.
 */

export function attachCombat(player, hud) {
  const maxHealth = 100;
  let health = maxHealth;
  let isDead = false;
  let invuln = 0;
  let combatActive = false;
  const spawn = player.position.clone();

  player.maxHealth = maxHealth;

  Object.defineProperty(player, 'health', {
    configurable: true,
    get: () => health,
    set: (v) => {
      health = v;
    },
  });

  Object.defineProperty(player, 'isDead', {
    configurable: true,
    get: () => isDead,
  });

  Object.defineProperty(player, 'combatActive', {
    configurable: true,
    get: () => combatActive,
  });

  player.beginCombat = () => {
    combatActive = true;
    // Grace period so nearby drones cannot delete you on the first frame.
    invuln = Math.max(invuln, 3.5);
    if (!isDead) {
      health = maxHealth;
      hud?.setHealth?.(health, maxHealth);
      hud?.onPlayerRespawn?.();
    }
  };

  player.takeDamage = (amount) => {
    if (!combatActive || isDead || invuln > 0) return;
    health = Math.max(0, health - amount);
    hud?.setHealth?.(health, maxHealth);
    hud?.onPlayerHit?.(amount);
    if (health <= 0) {
      isDead = true;
      combatActive = false;
      if (typeof document !== 'undefined' && document.exitPointerLock) {
        document.exitPointerLock();
      }
      hud?.onPlayerDeath?.(() => {
        player.respawn();
      });
    }
  };

  player.heal = (amount) => {
    if (isDead) return;
    health = Math.min(maxHealth, health + amount);
    hud?.setHealth?.(health, maxHealth);
  };

  player.respawn = () => {
    health = maxHealth;
    isDead = false;
    combatActive = true;
    invuln = 3.5;
    player.position.copy(spawn);
    if (player.velocity) player.velocity.set(0, 0, 0);
    hud?.setHealth?.(health, maxHealth);
    hud?.onPlayerRespawn?.();
    player.lockPointer?.();
  };

  const prevUpdate = player.update.bind(player);
  player.update = (dt, world) => {
    if (invuln > 0) invuln = Math.max(0, invuln - dt);
    if (isDead) {
      if (player.velocity) {
        player.velocity.x = 0;
        player.velocity.z = 0;
      }
      prevUpdate(dt, world);
      if (player.velocity) {
        player.velocity.x = 0;
        player.velocity.z = 0;
      }
      player.position.x = spawn.x;
      player.position.z = spawn.z;
      return;
    }
    prevUpdate(dt, world);
  };

  hud?.setHealth?.(health, maxHealth);
  return player;
}
