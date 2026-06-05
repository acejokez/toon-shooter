/**
 * Hud — in-run left overlay (TDD §8.1). Updated from syncUI() each frame, not
 * rebuilt. Also owns the cheap screen-FX overlays (flash + floating text).
 */
import { CONFIG } from '../config/constants.js';

export class Hud {
  constructor(root = document) {
    this.el = root.getElementById('hud');
    this.hpFill = root.getElementById('hp-fill');
    this.apFill = root.getElementById('ap-fill');
    this.distance = root.getElementById('stat-distance');
    this.streak = root.getElementById('stat-streak');
    this.scrap = root.getElementById('stat-scrap');
    this.weapon = root.getElementById('stat-weapon');
    this.flash = root.getElementById('flash-overlay');
    this.floatLayer = root.getElementById('float-layer');
  }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

  /** @param {object} s { hp, ap, meters, streak, scrap, weapon } */
  sync(s) {
    this.hpFill.style.width = `${Math.max(0, (s.hp / CONFIG.PLAYER_HP) * 100)}%`;
    this.apFill.style.width = `${Math.max(0, (s.ap / CONFIG.AP_MAX) * 100)}%`;
    this.distance.textContent = Math.floor(s.meters);
    this.streak.textContent = s.streak;
    this.scrap.textContent = s.scrap;
    this.weapon.textContent = s.weapon;
  }

  flashScreen(color, opacity = 0.3, duration = 0.12) {
    if (!this.flash) return;
    this.flash.style.backgroundColor = color;
    this.flash.style.opacity = String(opacity);
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => (this.flash.style.opacity = '0'), duration * 1000);
  }

  floatText(text, color = '#6fff7a', xPct = 45, yPct = 40) {
    if (!this.floatLayer) return;
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.color = color;
    el.style.left = `${xPct}%`;
    el.style.top = `${yPct}%`;
    el.style.fontSize = '1.3rem';
    el.style.textShadow = `0 0 10px ${color}`;
    this.floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }
}
