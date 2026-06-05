/**
 * Entry point — boot the Game, mount canvas + UI (TDD §2.1).
 */
import { Game } from './Game.js';

const game = new Game();
game.installHarness(); // window.__game for deterministic E2E/manual testing
game.boot().catch((err) => {
  console.error('Boot failed:', err);
  const content = document.getElementById('screen-content');
  if (content) {
    content.innerHTML = `<h1>BOOT ERROR</h1><p>${err?.message ?? err}</p>
      <p class="hint">Check the console for details.</p>`;
  }
});
