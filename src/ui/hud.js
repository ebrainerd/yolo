/**
 * HUD / UI for Neon Nocturne.
 *
 * Surfaces: start gate, crosshair, interaction prompt, dialogue panel,
 * health, ammo, hit marker, kill toast, score, damage vignette, death overlay.
 */

export function createHUD(uiRoot) {
  /** @type {HTMLElement | null} */
  let overlay = null;
  /** @type {HTMLElement | null} */
  let crosshair = null;
  /** @type {HTMLElement | null} */
  let promptEl = null;
  /** @type {HTMLElement | null} */
  let dialogueEl = null;
  /** @type {HTMLElement | null} */
  let dialogueName = null;
  /** @type {HTMLElement | null} */
  let dialogueText = null;
  /** @type {HTMLElement | null} */
  let healthEl = null;
  /** @type {HTMLElement | null} */
  let healthFill = null;
  /** @type {HTMLElement | null} */
  let healthValue = null;
  /** @type {HTMLElement | null} */
  let ammoEl = null;
  /** @type {HTMLElement | null} */
  let killToast = null;
  /** @type {HTMLElement | null} */
  let scoreEl = null;
  /** @type {HTMLElement | null} */
  let vignetteEl = null;
  /** @type {HTMLElement | null} */
  let deathEl = null;
  /** @type {HTMLElement | null} */
  let deathCta = null;

  let started = false;
  let dialogueVisible = false;
  let score = 0;
  /** @type {(() => void) | null} */
  let respawnCallback = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let hitMarkerTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let killToastTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let vignetteTimer = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount() {
    uiRoot.innerHTML = '';
    uiRoot.classList.add('hud');

    crosshair = el('div', 'hud-crosshair');
    crosshair.setAttribute('aria-hidden', 'true');
    crosshair.append(el('span', 'hud-crosshair__h'), el('span', 'hud-crosshair__v'));
    uiRoot.appendChild(crosshair);

    promptEl = el('div', 'hud-prompt');
    promptEl.setAttribute('role', 'status');
    promptEl.hidden = true;
    uiRoot.appendChild(promptEl);

    dialogueEl = el('aside', 'hud-dialogue');
    dialogueEl.setAttribute('role', 'dialog');
    dialogueEl.setAttribute('aria-live', 'polite');
    dialogueEl.hidden = true;

    dialogueName = el('p', 'hud-dialogue__name');
    dialogueText = el('p', 'hud-dialogue__text');
    const hint = el('p', 'hud-dialogue__hint', 'Press E to continue');

    dialogueEl.append(dialogueName, dialogueText, hint);
    uiRoot.appendChild(dialogueEl);

    healthEl = el('div', 'hud-health');
    healthEl.setAttribute('aria-label', 'Health');
    const healthTrack = el('div', 'hud-health__track');
    healthFill = el('div', 'hud-health__fill');
    healthTrack.appendChild(healthFill);
    healthValue = el('span', 'hud-health__value', '100');
    healthEl.append(healthTrack, healthValue);
    uiRoot.appendChild(healthEl);

    ammoEl = el('div', 'hud-ammo');
    ammoEl.setAttribute('aria-label', 'Ammo');
    ammoEl.textContent = '18 | 72';
    uiRoot.appendChild(ammoEl);

    killToast = el('div', 'hud-kill');
    killToast.setAttribute('role', 'status');
    killToast.setAttribute('aria-live', 'polite');
    uiRoot.appendChild(killToast);

    scoreEl = el('div', 'hud-score');
    scoreEl.setAttribute('aria-label', 'Score');
    scoreEl.textContent = '0';
    uiRoot.appendChild(scoreEl);

    vignetteEl = el('div', 'hud-vignette');
    vignetteEl.setAttribute('aria-hidden', 'true');
    uiRoot.appendChild(vignetteEl);

    deathEl = el('div', 'hud-death');
    deathEl.setAttribute('role', 'dialog');
    deathEl.setAttribute('aria-modal', 'true');
    deathEl.setAttribute('aria-label', 'Down');
    deathEl.hidden = true;
    const deathTitle = el('p', 'hud-death__title', 'DOWN');
    deathCta = el('button', 'hud-death__cta', 'Click to respawn');
    deathCta.type = 'button';
    deathEl.append(deathTitle, deathCta);
    uiRoot.appendChild(deathEl);

    deathCta.addEventListener('click', () => {
      const cb = respawnCallback;
      respawnCallback = null;
      if (deathEl) {
        deathEl.classList.remove('hud-death--visible');
        deathEl.hidden = true;
      }
      cb?.();
    });
  }

  function showStartOverlay(onStart) {
    if (!uiRoot) return;

    overlay = el('div', 'hud-start');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Neon Nocturne');

    const glow = el('div', 'hud-start__glow');
    glow.setAttribute('aria-hidden', 'true');

    const content = el('div', 'hud-start__content');
    const brand = el('h1', 'hud-start__brand', 'Neon Nocturne');
    const tagline = el(
      'p',
      'hud-start__tagline',
      'A night city that never sleeps — talk to philosophers, shoot hostiles, leave no answers.',
    );
    const cta = el('button', 'hud-start__cta', 'Click to enter');
    cta.type = 'button';

    content.append(brand, tagline, cta);
    overlay.append(glow, content);
    uiRoot.appendChild(overlay);

    const enter = () => {
      if (started) return;
      started = true;
      cta.removeEventListener('click', enter);
      overlay?.classList.add('hud-start--leaving');

      const finish = () => {
        overlay?.remove();
        overlay = null;
        uiRoot.classList.add('hud--live');
        onStart?.();
      };

      window.setTimeout(finish, 420);
    };

    cta.addEventListener('click', enter);
  }

  function setPrompt(text) {
    if (!promptEl) return;
    if (text == null || text === '') {
      promptEl.hidden = true;
      promptEl.textContent = '';
      promptEl.classList.remove('hud-prompt--visible');
      return;
    }
    promptEl.textContent = text;
    promptEl.hidden = false;
    // Force reflow so the enter transition can replay when text changes
    promptEl.classList.remove('hud-prompt--visible');
    void promptEl.offsetWidth;
    promptEl.classList.add('hud-prompt--visible');
  }

  function showDialogue(name, text) {
    if (!dialogueEl || !dialogueName || !dialogueText) return;
    dialogueName.textContent = name;
    dialogueText.textContent = text;
    dialogueEl.hidden = false;
    dialogueVisible = true;
    requestAnimationFrame(() => {
      dialogueEl?.classList.add('hud-dialogue--visible');
    });
  }

  function hideDialogue() {
    if (!dialogueEl) return;
    dialogueVisible = false;
    dialogueEl.classList.remove('hud-dialogue--visible');
    const onEnd = (event) => {
      if (event.propertyName !== 'opacity') return;
      if (dialogueVisible) return;
      dialogueEl.hidden = true;
      if (dialogueName) dialogueName.textContent = '';
      if (dialogueText) dialogueText.textContent = '';
      dialogueEl.removeEventListener('transitionend', onEnd);
    };
    dialogueEl.addEventListener('transitionend', onEnd);
    // Fallback if transitionend does not fire
    window.setTimeout(() => {
      if (!dialogueVisible && dialogueEl) {
        dialogueEl.hidden = true;
      }
    }, 400);
  }

  function setHealth(current, max) {
    if (!healthFill || !healthValue) return;
    const safeMax = Math.max(1, Number(max) || 100);
    const safeCurrent = Math.max(0, Math.min(safeMax, Number(current) || 0));
    const pct = (safeCurrent / safeMax) * 100;
    healthFill.style.width = `${pct}%`;
    healthValue.textContent = String(Math.round(safeCurrent));
    healthEl?.classList.toggle('hud-health--low', pct <= 30);
  }

  function setAmmo(mag, reserve) {
    if (!ammoEl) return;
    const m = Math.max(0, Math.round(Number(mag) || 0));
    const r = Math.max(0, Math.round(Number(reserve) || 0));
    ammoEl.textContent = `${m} | ${r}`;
    ammoEl.classList.toggle('hud-ammo--empty', m === 0);
  }

  function showHitMarker() {
    if (!crosshair) return;
    crosshair.classList.remove('hud-crosshair--hit');
    void crosshair.offsetWidth;
    crosshair.classList.add('hud-crosshair--hit');
    if (hitMarkerTimer != null) window.clearTimeout(hitMarkerTimer);
    hitMarkerTimer = window.setTimeout(() => {
      crosshair?.classList.remove('hud-crosshair--hit');
      hitMarkerTimer = null;
    }, 120);
  }

  function onShot({ hit } = {}) {
    if (hit) showHitMarker();
  }

  function onKill(name) {
    if (!killToast) return;
    const label = name ? `${name} — down` : 'Hostile — down';
    killToast.textContent = label;
    killToast.classList.remove('hud-kill--visible');
    void killToast.offsetWidth;
    killToast.classList.add('hud-kill--visible');
    if (killToastTimer != null) window.clearTimeout(killToastTimer);
    killToastTimer = window.setTimeout(() => {
      killToast?.classList.remove('hud-kill--visible');
      killToastTimer = null;
    }, 1600);
  }

  function addScore(points) {
    score += Number(points) || 0;
    if (scoreEl) scoreEl.textContent = String(score);
  }

  function onPlayerHit(_amount) {
    if (!vignetteEl) return;
    vignetteEl.classList.remove('hud-vignette--flash');
    void vignetteEl.offsetWidth;
    vignetteEl.classList.add('hud-vignette--flash');
    if (vignetteTimer != null) window.clearTimeout(vignetteTimer);
    vignetteTimer = window.setTimeout(() => {
      vignetteEl?.classList.remove('hud-vignette--flash');
      vignetteTimer = null;
    }, 280);
  }

  function onPlayerDeath(onRespawn) {
    respawnCallback = typeof onRespawn === 'function' ? onRespawn : null;
    if (!deathEl) return;
    deathEl.hidden = false;
    requestAnimationFrame(() => {
      deathEl?.classList.add('hud-death--visible');
    });
  }

  function onPlayerRespawn() {
    respawnCallback = null;
    if (!deathEl) return;
    deathEl.classList.remove('hud-death--visible');
    deathEl.hidden = true;
  }

  function update() {
    // Reserved for minor HUD sync; NPC system drives prompt/dialogue.
  }

  function onResize() {
    // Layout is CSS-driven; no imperative resize work needed.
  }

  return {
    mount,
    showStartOverlay,
    setPrompt,
    showDialogue,
    hideDialogue,
    setHealth,
    setAmmo,
    showHitMarker,
    onShot,
    onKill,
    addScore,
    onPlayerHit,
    onPlayerDeath,
    onPlayerRespawn,
    update,
    onResize,
  };
}
