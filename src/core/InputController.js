/**
 * InputController — keyboard/mouse state with edge events (TDD §2, PRD §2.1).
 *
 * Exposes held state (`isCrouching`) plus per-frame edge queries
 * (`consumeJump()`, `consumeFire()`, `consumeWeaponSwap()`) that the Player
 * polls inside the fixed step. Edges are latched on the DOM event and cleared
 * when consumed, so a tap is never missed between frames.
 */
export class InputController {
  /** @param {HTMLElement} target element that receives mouse events (canvas container) */
  constructor(target) {
    this.target = target;

    this.isCrouching = false; // CTRL held
    this.isJumpHeld = false; // SPACE held (variable jump height)
    this._jumpQueued = false; // SPACE edge
    this._fireHeld = false; // MOUSE1 held (auto-fire weapons honor fireRate)
    this._weaponSwap = 0; // 1..3 latched, 0 = none
    this._enabled = true;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onContextMenu = (e) => e.preventDefault();
    this._onBlur = this._onBlur.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.target.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.target.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.target.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('blur', this._onBlur);
  }

  setEnabled(on) {
    this._enabled = on;
    if (!on) this._onBlur();
  }

  _onKeyDown(e) {
    if (!this._enabled) return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.isJumpHeld = true;
        if (!e.repeat) this._jumpQueued = true;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        e.preventDefault();
        this.isCrouching = true;
        break;
      case 'Digit1':
        this._weaponSwap = 1;
        break;
      case 'Digit2':
        this._weaponSwap = 2;
        break;
      case 'Digit3':
        this._weaponSwap = 3;
        break;
    }
  }

  _onKeyUp(e) {
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      this.isCrouching = false;
    } else if (e.code === 'Space') {
      this.isJumpHeld = false;
    }
  }

  _onMouseDown(e) {
    if (!this._enabled) return;
    if (e.button === 0) this._fireHeld = true;
  }

  _onMouseUp(e) {
    if (e.button === 0) this._fireHeld = false;
  }

  _onBlur() {
    this.isCrouching = false;
    this.isJumpHeld = false;
    this._fireHeld = false;
    this._jumpQueued = false;
    this._weaponSwap = 0;
  }

  // --- edge consumers (call once per fixed step) ---

  consumeJump() {
    if (this._jumpQueued) {
      this._jumpQueued = false;
      return true;
    }
    return false;
  }

  /** MOUSE1 is held-to-fire; firerate gating lives in the weapon. */
  get isFiring() {
    return this._fireHeld;
  }

  /** Returns 1..3 once when a swap key was pressed, else 0. */
  consumeWeaponSwap() {
    const s = this._weaponSwap;
    this._weaponSwap = 0;
    return s;
  }

  // --- test/debug injection (deterministic harness, TDD §11) ---
  queueJump() {
    this._jumpQueued = true;
    this.isJumpHeld = true; // simulate a held press for full jump height
  }
  setCrouch(on) {
    this.isCrouching = on;
  }
  setFiring(on) {
    this._fireHeld = on;
  }
  queueWeaponSwap(slot) {
    this._weaponSwap = slot;
  }
}
