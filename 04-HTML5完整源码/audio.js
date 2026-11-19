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
    this.feverMode = false;
    this.lastBounceAt = 0;

    // Bright C-major / Lydian pentatonic scale spanning 2+ octaves (Hz) for exhilarating combo climb
    this.scale = [
      523.25,  // C5
      587.33,  // D5
      659.25,  // E5
      783.99,  // G5
      880.0,   // A5
      1046.5,  // C6
      1174.66, // D6
      1318.51, // E6
      1567.98, // G6
      1760.0,  // A6
      2093.0,  // C7
      2349.32, // D7
      2637.02  // E7
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

  setFeverMode(active) {
    const next = !!active;
    if (this.feverMode === next) return;
    this.feverMode = next;
    if (this.bgmEnabled && !this.muted) {
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
    // Gentle waltz-like music box motif; speeds up & adds sparkle accents in Fever
    const melody = [
      523.25, 659.25, 783.99, 659.25, 880.0, 783.99,
      587.33, 659.25, 783.99, 1046.5, 880.0, 659.25,
      440.0, 523.25, 659.25, 587.33, 523.25, 392.0,
      440.0, 523.25, 659.25, 783.99, 587.33, 523.25
    ];
    const intervalMs = this.feverMode ? 330 : 520;
    this.bgmTimer = setInterval(() => {
      if (this.muted || !this.bgmEnabled) return;
      const ctx = this.ensureCtx();
      if (!ctx || ctx.state !== 'running') return;
      const freq = melody[this.bgmStep % melody.length];
      this.bgmStep++;
      const mainVol = this.feverMode ? 0.038 : 0.032;
      this._playTone(freq, 'sine', mainVol, this.feverMode ? 0.38 : 0.55, 0.008, freq * 0.998);
      if (this.feverMode && this.bgmStep % 2 === 0) {
        this._playTone(freq * 1.5, 'triangle', 0.018, 0.24, 0.006);
      }
      if (this.bgmStep % 6 === 1) {
        this._playTone(freq * 0.5, 'triangle', 0.022, 0.85, 0.015);
      }
    }, intervalMs);
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

  playDrop(isWildcard = false, isGolden = false) {
    if (isWildcard) {
      this._playTone(587.33, 'sine', 0.11, 0.14, 0.006, 880);
      setTimeout(() => this._playTone(1174.66, 'triangle', 0.09, 0.18, 0.006, 1567.98), 35);
      return;
    }
    if (isGolden) {
      this._playTone(460, 'sine', 0.11, 0.12, 0.005, 290);
      this._playTone(987.77, 'triangle', 0.075, 0.18, 0.006, 1318.51);
      return;
    }
    // Crisp tactile macaron pop + gentle drop whoosh
    this._playTone(430, 'sine', 0.11, 0.11, 0.005, 235);
    this._playTone(720, 'triangle', 0.045, 0.07, 0.004, 480);
  }

  playBounce(intensity = 0.4, tier = 3, hitGlass = false) {
    const now = performance.now();
    if (now - this.lastBounceAt < 45) return;
    this.lastBounceAt = now;
    const clamped = Math.max(0.08, Math.min(1, intensity));
    // Lighter small candies (T1..T3) sound brighter & crisper; heavy pastries (T7..T9) sound deeper & softer
    const baseFreqs = [0, 320, 255, 222, 198, 172, 154, 140, 120, 100];
    const base = baseFreqs[Math.max(1, Math.min(9, tier))] || 190;
    const vol = Math.min(0.095, 0.02 + clamped * 0.068);
    const dur = tier >= 7 ? 0.12 : tier <= 2 ? 0.072 : 0.092;
    const wave = tier <= 2 ? 'sine' : 'triangle';
    const f = base * (0.94 + clamped * 0.25);
    this._playTone(f, wave, vol, dur, 0.004, f * (tier >= 6 ? 0.64 : 0.78));

    // Subtle crisp glass rim resonance when a candy or tart shell taps the glass jar
    if (hitGlass && clamped > 0.2 && (tier === 1 || tier === 4 || tier === 7)) {
      this._playTone(f * 3.1, 'sine', vol * 0.26, 0.048, 0.002, f * 2.8);
    }
  }

  playTilt() {
    this._playTone(540, 'sine', 0.032, 0.045, 0.003, 620);
  }

  playMerge(tier, combo = 1, isCrit = false) {
    const idx = Math.min(this.scale.length - 1, Math.max(0, (tier - 1) + Math.min(6, combo - 1)));
    const base = this.scale[idx];
    // Layer 1: Warm elastic low-mid pop punch (upward pitch snap!)
    this._playTone(base * 0.48, 'sine', 0.15, 0.14, 0.005, base * 0.84);
    // Layer 2: Crisp marimba / bell fundamental
    this._playTone(base, 'triangle', 0.15, 0.29, 0.006, base * 1.015);
    // Layer 3: Upper fifth sparkle shimmer
    setTimeout(() => {
      this._playTone(base * 1.5, 'sine', 0.085, 0.25, 0.008);
    }, 28);
    // Combo escalation flourish
    if (combo >= 3) {
      setTimeout(() => {
        this._playTone(Math.min(3136, base * 2.0), 'sine', 0.075, 0.28, 0.008);
      }, 56);
    }
    if (combo >= 5 || isCrit) {
      setTimeout(() => {
        this._playTone(Math.min(3520, base * 2.5), 'triangle', 0.07, 0.32, 0.008);
      }, 86);
    }
  }

  playWildcard() {
    const notes = [587.33, 783.99, 987.77, 1174.66, 1567.98, 2093.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'sine', 0.11, 0.32, 0.006, f * 1.02);
      }, i * 36);
    });
  }

  playGoldenMerge() {
    this._playTone(1046.5, 'triangle', 0.13, 0.22, 0.005, 1318.51);
    setTimeout(() => this._playTone(1567.98, 'sine', 0.11, 0.28, 0.006, 2093.0), 42);
    setTimeout(() => this._playTone(2349.32, 'sine', 0.08, 0.26, 0.006), 88);
  }

  playCritJump() {
    const notes = [783.99, 1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'triangle', 0.11, 0.3, 0.006);
      }, i * 40);
    });
  }

  playBlessingReady() {
    this._playTone(1046.5, 'sine', 0.075, 0.18, 0.006);
    setTimeout(() => this._playTone(1318.51, 'sine', 0.075, 0.24, 0.008), 65);
  }

  playBlessingOpen() {
    const notes = [523.25, 659.25, 783.99, 987.77];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'sine', 0.095, 0.42, 0.012);
      }, i * 55);
    });
  }

  playBlessingPick() {
    this._playTone(659.25, 'triangle', 0.12, 0.18, 0.006);
    setTimeout(() => this._playTone(987.77, 'triangle', 0.12, 0.22, 0.006), 52);
    setTimeout(() => this._playTone(1318.51, 'sine', 0.11, 0.34, 0.008), 104);
  }

  playFeverExtend() {
    this._playTone(1046.5, 'sine', 0.09, 0.16, 0.005, 1318.51);
    setTimeout(() => this._playTone(1567.98, 'sine', 0.085, 0.2, 0.005), 45);
  }

  playSupernova() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'triangle', 0.12, 0.48, 0.01);
      }, i * 52);
    });
  }

  playOrderStamp() {
    this._playTone(880, 'sine', 0.1, 0.18, 0.006);
    setTimeout(() => this._playTone(1174.66, 'sine', 0.1, 0.22, 0.006), 58);
  }

  playOrderComplete() {
    const notes = [659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'triangle', 0.12, 0.34, 0.008);
      }, i * 62);
    });
  }

  playFeverStart() {
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'sine', 0.11, 0.42, 0.008);
      }, i * 44);
    });
  }

  playTool(kind) {
    if (kind === 'shake') {
      this._playTone(190, 'triangle', 0.12, 0.24, 0.01, 120);
      setTimeout(() => this._playTone(987.77, 'sine', 0.09, 0.28, 0.01), 40);
    } else if (kind === 'fork') {
      this._playTone(620, 'sine', 0.12, 0.14, 0.005, 980);
    } else if (kind === 'spoon') {
      this._playTone(784, 'sine', 0.11, 0.25, 0.01);
      setTimeout(() => this._playTone(1175, 'triangle', 0.12, 0.3, 0.01), 60);
    } else if (kind === 'swap') {
      this._playTone(480, 'sine', 0.08, 0.11, 0.005, 660);
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
