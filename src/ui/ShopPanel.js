/**
 * ShopPanel — right dashboard: wallet, weapon loadout, per-weapon upgrades, and
 * perks (TDD §8.2, concept.png). Spending mutates the persisted record via
 * SaveManager and re-renders.
 */
import { WEAPONS, UPGRADES, upgradeCost } from '../config/weapons.js';

export class ShopPanel {
  /**
   * @param {import('../core/SaveManager.js').SaveManager} save
   * @param {HTMLElement} mount
   */
  constructor(save, mount = document.getElementById('shop-panel')) {
    this.save = save;
    this.mount = mount;
    this._selected = save.data.loadout[0];
  }

  render() {
    const d = this.save.data;
    this.mount.innerHTML = `
      <div class="dash-section">
        <h3>SCRAP</h3>
        <div class="wallet">⛃ ${d.currency}</div>
      </div>
      <div class="dash-section">
        <h3>LOADOUT</h3>
        <div class="dash-body" id="weapon-list"></div>
      </div>
      <div class="dash-section">
        <h3>WORKBENCH — ${this._selected}</h3>
        <div class="dash-body" id="upgrade-list"></div>
      </div>
      <div class="dash-section">
        <h3>CHARACTER</h3>
        <div class="dash-body">
          <div class="weapon-row"><span class="weapon-name">Scavenger</span><span class="lvl">ACTIVE</span></div>
          <div class="weapon-row"><span class="weapon-name">Hazmat</span><span class="lvl">LOCKED</span></div>
        </div>
      </div>
      <div class="dash-section">
        <h3>PERKS</h3>
        <div class="dash-body"><div class="hint">Earn scrap to unlock perks in a future patch.</div></div>
      </div>`;

    this._renderWeapons();
    this._renderUpgrades();
  }

  _renderWeapons() {
    const list = this.mount.querySelector('#weapon-list');
    list.innerHTML = '';
    for (const name of this.save.data.loadout) {
      const w = WEAPONS[name];
      const row = document.createElement('div');
      row.className = 'weapon-row' + (name === this._selected ? ' selected' : '');
      row.innerHTML = `
        <span class="weapon-name">${name}</span>
        <span class="lvl">DMG ${w.damage} · ROF ${w.fireRate}</span>`;
      row.onclick = () => {
        this._selected = name;
        this.render();
      };
      list.appendChild(row);
    }
  }

  _renderUpgrades() {
    const list = this.mount.querySelector('#upgrade-list');
    list.innerHTML = '';
    const rec = this.save.data.upgrades[this._selected] || { damageLvl: 0, fireRateLvl: 0 };

    for (const [key, def] of Object.entries(UPGRADES)) {
      const lvlKey = key + 'Lvl';
      const lvl = rec[lvlKey] || 0;
      const maxed = lvl >= def.maxLevel;
      const cost = upgradeCost(key, lvl);
      const afford = this.save.data.currency >= cost;

      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.innerHTML = `
        <span>${def.label} <span class="lvl">Lv ${lvl}/${def.maxLevel}</span></span>
        <button class="shop-btn" ${maxed || !afford ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `⛃ ${cost}`}
        </button>`;
      const btn = row.querySelector('button');
      if (!maxed) {
        btn.onclick = () => this._buy(this._selected, key, lvlKey, cost);
      }
      list.appendChild(row);
    }
  }

  _buy(weapon, key, lvlKey, cost) {
    if (!this.save.spendCurrency(cost)) return;
    const rec = this.save.data.upgrades[weapon] || { damageLvl: 0, fireRateLvl: 0 };
    rec[lvlKey] = (rec[lvlKey] || 0) + 1;
    this.save.data.upgrades[weapon] = rec;
    this.save.save();
    this.render();
  }
}
