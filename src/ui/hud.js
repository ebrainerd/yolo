/**
 * HUD / UI for Neon Nocturne.
 *
 * Surfaces: start gate, crosshair, interaction prompt, dialogue panel.
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

  let started = false;
  let dialogueVisible = false;

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
      'A night city that never sleeps — wander, listen, leave no answers.',
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
    update,
    onResize,
  };
}
