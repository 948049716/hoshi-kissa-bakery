/**
 * Procedural Web Audio API sound effects & cozy music-box ambience
 * for Hoshi Kissa: Starlight Patisserie. Zero external audio assets needed.
 */
class StarlightAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmEnabled = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.lastBounceAt = 0;

    // Cozy C-major / Lydian pentatonic scale (Hz)
    this.scale = [
      523.25, // C5
      587.33, // D5
      659.25, // E5
      783.99, // G5
      880.0,  // A5
      1046.5, // C6
      1174.66,// D6
      1318.51,// E6
      1567.98 // G6
    ];
  }

  ensureCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(mute) {
    this.muted = mute;
    if (mute) {
      this.stopBGM();
    } else if (this.bgmEnabled) {
      this.startBGM();
    }
  }

  toggleBGM() {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmEnabled && !this.muted) {
      this.ensureCtx();
      this.startBGM();
    } else {
      this.stopBGM();
    }
    return this.bgmEnabled;
  }

  startBGM() {
    this.stopBGM();
    if (this.muted || !this.bgmEnabled) return;
    // Gentle waltz-like music box motif
    const melody = [
      523.25, 659.25, 783.99, 659.25, 880.0, 783.99,
      587.33, 659.25, 783.99, 1046.5, 880.0, 659.25,
      440.0, 523.25, 659.25, 587.33, 523.25, 392.0,
      440.0, 523.25, 659.25, 783.99, 587.33, 523.25
    ];
    this.bgmTimer = setInterval(() => {
      if (this.muted || !this.bgmEnabled) return;
      const ctx = this.ensureCtx();
      if (!ctx || ctx.state !== 'running') return;
      const freq = melody[this.bgmStep % melody.length];
      this.bgmStep++;
      this._playTone(freq, 'sine', 0.032, 0.55, 0.008, freq * 0.998);
      if (this.bgmStep % 6 === 1) {
        this._playTone(freq * 0.5, 'triangle', 0.02, 0.9, 0.015);
      }
    }, 520);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  _playTone(freq, type, gainPeak, duration, attack = 0.01, endFreq = null) {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playDrop() {
    this._playTone(360, 'sine', 0.09, 0.14, 0.008, 220);
  }

  playBounce(intensity = 0.4, tier = 3, hitGlass = false) {
    const now = performance.now();
    if (now - this.lastBounceAt < 48) return;
    this.lastBounceAt = now;
    const clamped = Math.max(0.08, Math.min(1, intensity));
    // Lighter small candies (T1..T3) sound brighter & crisper; heavy pastries (T7..T9) sound deeper & softer
    const baseFreqs = [0, 310, 245, 215, 195, 168, 152, 138, 118, 98];
    const base = baseFreqs[Math.max(1, Math.min(9, tier))] || 185;
    const vol = Math.min(0.09, 0.018 + clamped * 0.062);
    const dur = tier >= 7 ? 0.125 : tier <= 2 ? 0.072 : 0.095;
    const wave = tier <= 2 ? 'sine' : 'triangle';
    const f = base * (0.94 + clamped * 0.24);
    this._playTone(f, wave, vol, dur, 0.004, f * (tier >= 6 ? 0.62 : 0.76));

    // Subtle crisp glass rim resonance when a candy or tart shell taps the glass jar
    if (hitGlass && clamped > 0.22 && (tier === 1 || tier === 4 || tier === 7)) {
      this._playTone(f * 3.1, 'sine', vol * 0.24, 0.045, 0.002, f * 2.8);
    }
  }

  playTilt() {
    this._playTone(540, 'sine', 0.032, 0.045, 0.003, 620);
  }

  playMerge(tier, combo = 1) {
    const idx = Math.min(this.scale.length - 1, (tier - 1) + Math.min(3, combo - 1));
    const base = this.scale[idx];
    // Warm squishy pop + sparkling chime harmonic
    this._playTone(base * 0.5, 'sine', 0.12, 0.16, 0.006, base * 0.75);
    this._playTone(base, 'triangle', 0.13, 0.28, 0.008, base * 1.01);
    setTimeout(() => {
      this._playTone(base * 1.5, 'sine', 0.075, 0.24, 0.01);
    }, 35);
  }

  playSupernova() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'triangle', 0.11, 0.45, 0.01);
      }, i * 55);
    });
  }

  playOrderStamp() {
    this._playTone(880, 'sine', 0.09, 0.18, 0.006);
    setTimeout(() => this._playTone(1174.66, 'sine', 0.09, 0.22, 0.006), 60);
  }

  playOrderComplete() {
    const notes = [659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'triangle', 0.11, 0.34, 0.008);
      }, i * 70);
    });
  }

  playFeverStart() {
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'sine', 0.1, 0.4, 0.01);
      }, i * 48);
    });
  }

  playTool(kind) {
    if (kind === 'shake') {
      this._playTone(190, 'triangle', 0.11, 0.24, 0.01, 120);
      setTimeout(() => this._playTone(987.77, 'sine', 0.08, 0.28, 0.01), 40);
    } else if (kind === 'fork') {
      this._playTone(620, 'sine', 0.11, 0.14, 0.005, 960);
    } else if (kind === 'spoon') {
      this._playTone(784, 'sine', 0.1, 0.25, 0.01);
      setTimeout(() => this._playTone(1175, 'triangle', 0.11, 0.3, 0.01), 65);
    } else if (kind === 'swap') {
      this._playTone(480, 'sine', 0.07, 0.11, 0.005, 640);
    }
  }

  playGameOver() {
    const notes = [523.25, 493.88, 440.0, 392.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'triangle', 0.09, 0.38, 0.015);
      }, i * 140);
    });
  }
}

window.StarlightAudio = StarlightAudio;
