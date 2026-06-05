/**
 * Menu — loading / start / game-over screens rendered into #screen (TDD §8).
 * Pure DOM; calls back into Game via the provided callbacks.
 */
export class Menu {
  constructor(root = document) {
    this.screen = root.getElementById('screen');
    this.content = root.getElementById('screen-content');
  }

  hide() { this.screen.classList.add('hidden'); }
  _show() { this.screen.classList.remove('hidden'); }

  showLoading() {
    this._show();
    this.content.innerHTML = `
      <h1>TOON SHOOTER</h1>
      <h2>Booting Pip-Systems…</h2>
      <div class="loading-bar"><div id="load-fill"></div></div>
      <p id="load-pct">0%</p>`;
    this.loadFill = document.getElementById('load-fill');
    this.loadPct = document.getElementById('load-pct');
  }

  setLoadProgress(t) {
    const pct = Math.round(t * 100);
    if (this.loadFill) this.loadFill.style.width = `${pct}%`;
    if (this.loadPct) this.loadPct.textContent = `${pct}%`;
  }

  /** @param {object} best { distance, streak } */
  showStart(best, onPlay) {
    this._show();
    this.content.innerHTML = `
      <h1>TOON SHOOTER</h1>
      <h2>Wasteland Sprint</h2>
      <p>Run right. Jump traps. Crouch barriers. Shoot hostiles.</p>
      <p>Spend scrap on the right to gear up between runs.</p>
      <p class="big">BEST: ${Math.floor(best.distance)}m · STREAK ${best.streak}</p>
      <button class="btn" id="play-btn">START RUN</button>`;
    document.getElementById('play-btn').onclick = onPlay;
  }

  /** @param {object} result { distance, streak, scrap } */
  showGameOver(result, best, onRetry) {
    this._show();
    this.content.innerHTML = `
      <h1>WASTED</h1>
      <h2>Run Complete</h2>
      <p class="big">TRAVELLED: ${Math.floor(result.distance)}m</p>
      <p>STREAK KILLS: ${result.streak}</p>
      <p>SCRAP EARNED: <span style="color:var(--amber)">${result.scrap}</span></p>
      <p>BEST: ${Math.floor(best.distance)}m</p>
      <button class="btn" id="retry-btn">UPGRADE & RETRY</button>`;
    document.getElementById('retry-btn').onclick = onRetry;
  }
}
