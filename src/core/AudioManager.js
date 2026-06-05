/**
 * AudioManager — procedural WebAudio SFX (TDD §1: native Audio, no asset files).
 *
 * The asset pack ships no sounds, so every effect is synthesized from
 * oscillators + filtered noise with short envelopes. The AudioContext is
 * created lazily and only resumed on a user gesture (start button / first key),
 * satisfying browser autoplay policy. All play methods no-op until resumed, so
 * the deterministic test harness never throws.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._noiseBuf = null;
  }

  /** Create + resume the context (call from a user gesture). */
  resume() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        // Compressor prevents simultaneous sources (shotgun layers) from clipping
        // and adds natural punch to transients.
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 8;
        comp.ratio.value = 5;
        comp.attack.value = 0.002;
        comp.release.value = 0.1;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        this._noiseBuf = this._makeNoise();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.enabled = false;
    }
  }

  get _ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** A short pitched tone with an exponential decay envelope. */
  _tone(freq, dur, { type = 'square', gain = 0.3, glideTo = null, delay = 0 } = {}) {
    if (!this._ready) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A filtered noise burst (impacts / explosions / gunfire body). */
  _noise(dur, { gain = 0.3, freq = 1200, freqEnd = null, q = 0.7, type = 'bandpass', delay = 0 } = {}) {
    if (!this._ready) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t0);
    if (freqEnd) filt.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // --- effects ---

  jump() {
    this._tone(420, 0.18, { type: 'square', gain: 0.22, glideTo: 760 });
  }
  land() {
    this._noise(0.1, { gain: 0.25, freq: 220, type: 'lowpass' });
  }
  shoot(weapon = 'Pistol') {
    if (weapon === 'Shotgun') {
      // Sub-bass thump — the "chest punch" of a 12-gauge
      this._tone(72, 0.45, { type: 'sine', gain: 0.32, glideTo: 26 });
      // Main low boom, frequency sweeps downward as the blast dissipates
      this._noise(0.55, { gain: 0.38, freq: 260, freqEnd: 70, q: 0.5, type: 'lowpass' });
      // Mid scatter (pellets + gas turbulence)
      this._noise(0.22, { gain: 0.22, freq: 900, freqEnd: 300, q: 0.7, type: 'bandpass' });
      // Sharp initial muzzle crack — very brief, very bright
      this._noise(0.035, { gain: 0.42, freq: 4500, q: 0.5, type: 'highpass' });
    } else if (weapon === 'SMG') {
      // Tight muzzle crack — higher frequency than pistol, shorter decay
      this._noise(0.045, { gain: 0.3, freq: 3800, q: 0.5, type: 'highpass' });
      // Body — sweeps down fast, each shot sounds distinct at high fire rate
      this._noise(0.08, { gain: 0.22, freq: 1100, freqEnd: 380, q: 0.8, type: 'bandpass' });
      // Mechanical bolt click — the metallic cycling sound
      this._tone(260, 0.04, { type: 'square', gain: 0.09, glideTo: 140 });
    } else {
      // Pistol — sharp crack + mid report + low thump
      // High-freq pressure wave (the crack)
      this._noise(0.065, { gain: 0.38, freq: 3200, q: 0.5, type: 'highpass' });
      // Mid report body, sweeps down as the sound decays
      this._noise(0.22, { gain: 0.3, freq: 750, freqEnd: 180, q: 0.7, type: 'bandpass' });
      // Low thump from the gas expansion
      this._tone(105, 0.18, { type: 'sine', gain: 0.24, glideTo: 38 });
    }
  }
  enemyShoot() {
    // Distant crack — highpass cut above 2kHz fades quickly (air absorption)
    this._noise(0.06, { gain: 0.16, freq: 2200, q: 0.6, type: 'highpass' });
    this._noise(0.12, { gain: 0.12, freq: 500, freqEnd: 150, q: 0.8, type: 'bandpass' });
  }
  hit() {
    this._tone(200, 0.18, { type: 'sawtooth', gain: 0.3, glideTo: 70 });
    this._noise(0.12, { gain: 0.2, freq: 500, type: 'lowpass' });
  }
  explosion() {
    this._noise(0.5, { gain: 0.45, freq: 400, q: 0.5, type: 'lowpass' });
    this._tone(120, 0.4, { type: 'sawtooth', gain: 0.25, glideTo: 40 });
  }
  pickupHealth() {
    this._tone(660, 0.1, { type: 'sine', gain: 0.25 });
    this._tone(990, 0.14, { type: 'sine', gain: 0.22, delay: 0.08 });
  }
  pickupScrap() {
    this._tone(1180, 0.08, { type: 'square', gain: 0.18 });
  }
  kill() {
    this._tone(520, 0.08, { type: 'square', gain: 0.2, glideTo: 880 });
    this._tone(880, 0.1, { type: 'square', gain: 0.16, delay: 0.06 });
  }
  swap() {
    this._tone(500, 0.06, { type: 'triangle', gain: 0.16, glideTo: 700 });
  }
  death() {
    this._tone(440, 0.7, { type: 'sawtooth', gain: 0.3, glideTo: 60 });
    this._noise(0.6, { gain: 0.2, freq: 300, type: 'lowpass', delay: 0.05 });
  }
}
