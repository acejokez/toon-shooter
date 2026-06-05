/**
 * ScoreSystem — distance, kill streak, and this-run currency (TDD §6.3).
 * Listens on the EventBus; streak resets on bear-trap or taking damage (PRD).
 */
import { CONFIG } from '../config/constants.js';
import { Events } from '../core/events.js';

export class ScoreSystem {
  /** @param {import('../core/events.js').EventBus} bus */
  constructor(bus) {
    this.bus = bus;
    this.reset();

    this._subs = [
      bus.on(Events.ENEMY_KILLED, () => this._onKill()),
      bus.on(Events.PICKUP_SCRAP, (e) => (this.scrap += e.amount)),
      bus.on(Events.STREAK_BREAK, () => (this.streak = 0)),
      bus.on(Events.PLAYER_HIT, (e) => {
        if (e.breakStreak) this.streak = 0;
      }),
    ];
  }

  reset() {
    this.distanceUnits = 0;
    this.streak = 0;
    this.scrap = 0;
  }

  _onKill() {
    this.streak += 1;
    this.scrap += CONFIG.SCRAP_PER_KILL;
  }

  /** Accumulate distance from scrolled world units (real time). */
  addDistance(units) {
    this.distanceUnits += units;
  }

  get meters() {
    return this.distanceUnits * CONFIG.METERS_PER_UNIT;
  }

  dispose() {
    for (const off of this._subs) off();
  }
}
