/**
 * StarlightAudio 2.0 — Cozy Procedural Music & SFX Engine
 * for Hoshi Kissa: Starlight Patisserie (星夜吃茶 · 喵呜甜品合合乐).
 *
 * Features:
 * - Zero external audio assets (100% self-contained Web Audio synthesis)
 * - Two full original Japanese café / Ghibli-inspired tracks in C major
 *   (harmonically matched with the C-major pentatonic merge/combo SFX):
 *     1. 'waltz' — 「星夜圆舞曲 · Starlight Waltz」 (3/4, 32-bar A-A'-B-C)
 *     2. 'bossa' — 「午夜吃茶波萨 · Midnight Kissa Bossa」 (4/4, 16-bar A-B + variation)
 * - Sample-accurate lookahead scheduler (immune to frame jitter / tab sleep bursts)
 * - Warm stereo wooden café reverb (generated IR Convolver) + stereo shimmer delay + compressor
 * - Adaptive real-time layers:
 *     * Fever mode: tempo lift, sparkling harp arpeggios, lively brush/shaker swing
 *     * Modal/Title muffle: smooth low-pass lounge warmth when overlays are open
 *     * Danger tension: subtle tempo urgency & soft heartbeat tick
 *     * Automatic ducking on major fanfares (Supernova, Order Complete, Game Over)
 * - Independent BGM & SFX toggles + browser autoplay unlock + visibility pause
 */
class StarlightAudio {
  constructor(opts = null) {
    const isFnFactory = opts && typeof opts.createAudioContext === "function";
    this.ctx = (opts && !isFnFactory && opts.createOscillator) ? opts : (opts && opts.ctx) || null;
    this._ctxFactory = isFnFactory ? opts.createAudioContext : null;
    this._externalCtx = !!this.ctx;

    // Independent BGM & SFX states (both ON by default for new players)
    this.sfxEnabled = true;
    this.bgmTrack = 'waltz'; // 'waltz' | 'bossa' | 'off'
    this.bgmEnabled = true;

    // Dynamic musical state
    this.feverMode = false;
    this.muffled = false;
    this.dangerLevel = 0; // 0..1
    this.tabHidden = false;

    // Scheduler state
    this._schedTimer = null;
    this._nextNoteTime = 0;
    this._stepIndex = 0;
    this._cycleCount = 0;
    this._isPlayingBGM = false;
    this._fadeInDone = false;
    this._duckUntil = 0;
    this._lastBounceAt = 0;

    // Audio graph nodes (initialized once per AudioContext)
    this._graphReady = false;
    this._masterComp = null;
    this._bgmDryGain = null;
    this._bgmToneFilter = null;
    this._bgmDuckGain = null;
    this._bgmMasterGain = null;
    this._reverbSend = null;
    this._delaySend = null;
    this._sfxBus = null;
    this._sfxReverbSend = null;
    this._noiseBuffer = null;
    this._htmlAudioUnlocked = false;
    this._silentAudioEl = null;
    this._gainBoostedAtRunning = false;

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

    // Track metadata & hand-crafted scores
    this.TRACKS = this._buildTracks();

    if (this.ctx) {
      this._initGraph(this.ctx);
    }
  }

  // Backward-compatible getter for legacy callers
  get muted() {
    return !this.sfxEnabled;
  }

  _midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _buildTracks() {
    // Track 1: 「星夜圆舞曲 · Starlight Waltz」 — 3/4 time (6 eighth-note steps/bar), 32 bars (A - A' - B - C)
    // Each melody entry is either null or [midiNote, durationInEighths, optionalVelocity]
    const waltzBars = [
      // Section A (0-7): Warm Ghibli patisserie invitation
      { bass: 48, chord: [52, 55, 59, 62], mel: [[76, 3], null, null, [79, 2], null, [81, 1]], pad: false }, // 0: Cmaj7
      { bass: 52, chord: [55, 59, 62, 67], mel: [[79, 4], null, null, null, [76, 1], [74, 1]], pad: false }, // 1: Em7
      { bass: 41, chord: [57, 60, 64, 67], mel: [[72, 3], null, null, [74, 2], null, [76, 1]], pad: false }, // 2: Fmaj7
      { bass: 40, chord: [55, 60, 64, 67], mel: [[79, 4.5], null, null, null, null, null], pad: false },     // 3: C/E
      { bass: 50, chord: [53, 57, 60, 64], mel: [[77, 3], null, null, [76, 2], null, [74, 1]], pad: false }, // 4: Dm9
      { bass: 43, chord: [53, 57, 59, 64], mel: [[76, 2], null, [74, 2], null, [71, 2], null], pad: false }, // 5: G13
      { bass: 48, chord: [52, 55, 59, 62], mel: [[72, 4], null, null, null, [74, 2], null], pad: false },    // 6: Cmaj7
      { bass: 43, chord: [53, 55, 59, 62], mel: [[76, 2], null, [74, 2], null, [67, 2], null], pad: false }, // 7: G7

      // Section A' (8-15): Bittersweet Japanese kissaten charm (A7 -> Dm9 -> Fm6 -> C/G)
      { bass: 48, chord: [52, 55, 59, 62], mel: [[76, 3], null, null, [79, 2], null, [81, 1]], pad: false }, // 8: Cmaj7
      { bass: 45, chord: [55, 61, 64, 67], mel: [[79, 3], null, null, [76, 2], null, [73, 1]], pad: false }, // 9: A7
      { bass: 50, chord: [53, 57, 60, 64], mel: [[74, 3], null, null, [77, 2], null, [81, 1]], pad: false }, // 10: Dm9
      { bass: 41, chord: [56, 60, 62, 67], mel: [[80, 3], null, null, [79, 2], null, [77, 1]], pad: true },  // 11: Fm6
      { bass: 43, chord: [52, 55, 60, 64], mel: [[76, 3], null, null, [79, 2], null, [84, 1]], pad: true },  // 12: C/G
      { bass: 43, chord: [53, 57, 59, 62], mel: [[83, 2], null, [81, 2], null, [79, 2], null], pad: false }, // 13: G9
      { bass: 48, chord: [52, 55, 59, 64], mel: [[76, 4], null, null, null, [72, 2], null], pad: false },    // 14: Cmaj7
      { bass: 48, chord: [52, 55, 58, 62], mel: [[74, 2], null, [76, 2], null, [79, 2], null], pad: false }, // 15: C9 -> Fmaj7

      // Section B (16-23): Starlight window chorus (warm pad blooms + lyrical soar)
      { bass: 41, chord: [57, 60, 64, 67], mel: [[81, 3], null, null, [84, 2], null, [83, 1]], pad: true },  // 16: Fmaj7
      { bass: 41, chord: [55, 59, 62, 67], mel: [[79, 4], null, null, null, [76, 2], null], pad: true },     // 17: G/F
      { bass: 40, chord: [55, 59, 62, 67], mel: [[79, 3], null, null, [83, 2], null, [81, 1]], pad: true },  // 18: Em7
      { bass: 45, chord: [55, 59, 60, 64], mel: [[76, 4.5], null, null, null, null, null], pad: true },      // 19: Am9
      { bass: 50, chord: [53, 57, 60, 64], mel: [[77, 2], null, [76, 2], null, [74, 2], null], pad: true },  // 20: Dm9
      { bass: 43, chord: [53, 57, 59, 64], mel: [[79, 3], null, null, [76, 2], null, [74, 1]], pad: true },  // 21: G13
      { bass: 48, chord: [52, 55, 59, 62], mel: [[76, 3], null, null, [79, 3], null, null], pad: true },     // 22: Cmaj7
      { bass: 40, chord: [56, 59, 62, 64], mel: [[80, 3], null, null, [83, 2], null, [81, 1]], pad: true },  // 23: E7 -> Am

      // Section C (24-31): Cat chef sugar twirl & dreamy turnaround home
      { bass: 45, chord: [55, 60, 64, 67], mel: [[84, 3], null, null, [83, 2], null, [81, 1]], pad: true },  // 24: Am7
      { bass: 50, chord: [54, 57, 60, 64], mel: [[79, 2], null, [78, 2], null, [81, 2], null], pad: true },  // 25: D9
      { bass: 41, chord: [57, 60, 64, 67], mel: [[79, 3], null, null, [76, 2], null, [72, 1]], pad: true },  // 26: Fmaj7
      { bass: 41, chord: [56, 60, 62, 67], mel: [[74, 3], null, null, [77, 2], null, [80, 1]], pad: true },  // 27: Fm6
      { bass: 40, chord: [55, 59, 62, 67], mel: [[79, 3], null, null, [76, 2], null, [74, 1]], pad: false }, // 28: Em7
      { bass: 45, chord: [55, 60, 64, 67], mel: [[72, 2], null, [74, 2], null, [76, 2], null], pad: false }, // 29: Am7
      { bass: 50, bass2: 43, chord: [53, 57, 60, 64], mel: [[77, 2], null, [76, 2], null, [74, 2], null], pad: false }, // 30: Dm9 -> G
      { bass: 48, chord: [52, 55, 59, 62], mel: [[72, 4], null, null, null, [74, 2], null], pad: false }     // 31: Cmaj9
    ];

    // Track 2: 「午夜吃茶波萨 · Midnight Kissa Bossa」 — 4/4 time (8 eighth-note steps/bar), 16 bars
    const bossaBars = [
      // Section A (0-7): Cozy rainy midnight kissaten
      { bass: 48, bassAlt: 43, chord: [52, 55, 59, 62], mel: [null, [76, 2], null, [79, 3], null, null, [74, 2], null], pad: false }, // 0: Cmaj9
      { bass: 48, bassAlt: 43, chord: [52, 55, 59, 62], mel: [[76, 3], null, null, [72, 2], null, [74, 3], null, null], pad: false }, // 1: Cmaj9
      { bass: 50, bassAlt: 45, chord: [53, 57, 60, 64], mel: [null, [77, 2], null, [76, 2], null, [72, 2], null, [74, 2]], pad: false }, // 2: Dm9
      { bass: 43, bassAlt: 50, chord: [53, 57, 59, 64], mel: [null, [76, 3], null, null, [74, 2], null, [71, 2], null], pad: false }, // 3: G13
      { bass: 40, bassAlt: 47, chord: [55, 59, 62, 67], mel: [[79, 3], null, null, [76, 2], null, [74, 3], null, null], pad: false }, // 4: Em7
      { bass: 45, bassAlt: 40, chord: [55, 61, 64, 69], mel: [[76, 2], null, [79, 3], null, null, [76, 2], null, [73, 1]], pad: false }, // 5: A7
      { bass: 50, bassAlt: 45, chord: [53, 57, 60, 64], mel: [[74, 3], null, null, [77, 2], null, [76, 3], null, null], pad: false }, // 6: Dm9
      { bass: 43, bassAlt: 50, chord: [53, 57, 59, 64], mel: [[74, 4], null, null, null, null, [71, 1], [72, 1], [74, 1]], pad: false }, // 7: G13

      // Section B (8-15): Warm coffee steam & starry night window
      { bass: 41, bassAlt: 48, chord: [57, 60, 64, 67], mel: [[76, 3], null, null, [79, 2], null, [81, 3], null, null], pad: true },  // 8: Fmaj9
      { bass: 41, bassAlt: 48, chord: [56, 60, 62, 67], mel: [[80, 3], null, null, [79, 2], null, [77, 3], null, null], pad: true },  // 9: Fm6
      { bass: 40, bassAlt: 47, chord: [55, 59, 62, 67], mel: [[76, 3], null, null, [79, 2], null, [83, 3], null, null], pad: true },  // 10: Em7
      { bass: 45, bassAlt: 40, chord: [55, 59, 60, 64], mel: [[81, 3], null, null, [79, 2], null, [76, 3], null, null], pad: true },  // 11: Am9
      { bass: 50, bassAlt: 45, chord: [53, 57, 60, 64], mel: [[77, 2], null, [76, 2], null, [74, 2], null, [72, 2], null], pad: true }, // 12: Dm9
      { bass: 43, bassAlt: 50, chord: [53, 57, 59, 64], mel: [[76, 3], null, null, [74, 2], null, [71, 3], null, null], pad: true },  // 13: G13
      { bass: 48, bassAlt: 43, chord: [52, 55, 59, 62], mel: [[72, 4], null, null, null, [74, 2], null, [76, 2], null], pad: false }, // 14: Cmaj9
      { bass: 50, bassAlt: 43, chord: [53, 57, 60, 64], mel: [[74, 4.5], null, null, null, null, null, null, null], pad: false }      // 15: Dm9 -> G13
    ];

    return {
      waltz: {
        id: 'waltz',
        label: '🎵 圆舞曲',
        title: '星夜圆舞曲 · Starlight Waltz',
        stepsPerBar: 6,
        bpmNormal: 114,
        bpmFever: 132,
        bars: waltzBars
      },
      bossa: {
        id: 'bossa',
        label: '☕ 吃茶爵士',
        title: '午夜吃茶波萨 · Midnight Kissa Bossa',
        stepsPerBar: 8,
        bpmNormal: 104,
        bpmFever: 122,
        bars: bossaBars
      }
    };
  }

  ensureCtx() {
    if (!this.ctx) {
      try {
        if (this._ctxFactory) {
          this.ctx = this._ctxFactory();
        } else if (typeof window !== "undefined") {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
      } catch (_) {}
      if (!this.ctx) return null;
    }
    if (!this._graphReady && this.ctx) {
      try {
        this._initGraph(this.ctx);
      } catch (_) {
        this._graphReady = false;
        return null;
      }
    }
    if (this.ctx && this.ctx.state && this.ctx.state !== 'running' && !this._externalCtx && typeof this.ctx.resume === 'function') {
      try {
        const res = this.ctx.resume();
        if (res && typeof res.then === 'function') {
          res.then(() => {
            if (!this.bgmEnabled || this.tabHidden) return;
            if (!this._isPlayingBGM) {
              this.startBGM();
            } else if (this._bgmMasterGain) {
              this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.28, false);
              this._gainBoostedAtRunning = true;
            }
          }).catch(() => {});
        }
      } catch (_) {}
    }
    return this.ctx;
  }

  _unlockMobileAudio(ctx) {
    if (!ctx || this._externalCtx) return;
    try {
      if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      }
    } catch (_) {}

    if (!this._htmlAudioUnlocked && typeof Audio !== 'undefined') {
      try {
        if (!this._silentAudioEl) {
          const el = new Audio(
            'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
          );
          el.setAttribute('playsinline', '');
          el.playsInline = true;
          el.volume = 0.01;
          this._silentAudioEl = el;
        }
        const p = this._silentAudioEl.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            this._htmlAudioUnlocked = true;
          }).catch(() => {});
        } else {
          this._htmlAudioUnlocked = true;
        }
      } catch (_) {}
    }
  }

  /**
   * Call on user gesture (touchend/click/keydown) to unlock Web Audio & smoothly start BGM if enabled.
   */
  unlock() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    this._unlockMobileAudio(ctx);
    if (this.bgmEnabled && !this.tabHidden) {
      if (!ctx.state || ctx.state === 'running') {
        if (!this._isPlayingBGM) {
          this.startBGM();
        } else if (this._bgmMasterGain && this._bgmMasterGain.gain.value < 0.01) {
          this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.25, false);
          this._gainBoostedAtRunning = true;
        }
      }
    }
  }

  _initGraph(ctx) {
    if (this._graphReady) return;
    this._graphReady = true;

    // 1. Gentle glue compressor (with GainNode fallback if createDynamicsCompressor unavailable)
    let comp = null;
    if (typeof ctx.createDynamicsCompressor === 'function') {
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 3.0;
      comp.attack.value = 0.008;
      comp.release.value = 0.22;
    } else {
      comp = ctx.createGain();
      comp.gain.value = 0.9;
    }
    comp.connect(ctx.destination);
    this._masterComp = comp;

    // 2. BGM Master Chain: Dry + Reverb + Shimmer Delay -> Warm Tone Filter -> Duck Gain -> Master Gain -> Comp
    const bgmMaster = ctx.createGain();
    bgmMaster.gain.value = 0.0001;
    bgmMaster.connect(comp);
    this._bgmMasterGain = bgmMaster;

    const bgmDuck = ctx.createGain();
    bgmDuck.gain.value = 1.0;
    bgmDuck.connect(bgmMaster);
    this._bgmDuckGain = bgmDuck;

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = this.muffled ? 580 : 12500;
    toneFilter.Q.value = -3.0;
    toneFilter.connect(bgmDuck);
    this._bgmToneFilter = toneFilter;

    const bgmDry = ctx.createGain();
    bgmDry.gain.value = 0.86;
    bgmDry.connect(toneFilter);
    this._bgmDryGain = bgmDry;

    // 3. Algorithmic Warm Wooden Café Reverb (Convolver on Web, Multi-Tap Delay Room on WeChat WebAudio)
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.32;
    let reverbEntry = null;
    if (typeof ctx.createConvolver === 'function') {
      const convolver = ctx.createConvolver();
      convolver.buffer = this._createCafeReverbIR(ctx, 1.65);
      const reverbLP = ctx.createBiquadFilter();
      reverbLP.type = 'lowpass';
      reverbLP.frequency.value = 3200;
      reverbSend.connect(convolver);
      convolver.connect(reverbLP);
      reverbLP.connect(toneFilter);
      reverbEntry = convolver;
    } else {
      // Pure Delay + Filter warm Schroeder wooden café room fallback (100% WeChat Mini Game supported)
      const revIn = ctx.createGain();
      revIn.gain.value = 0.65;
      const revLP = ctx.createBiquadFilter();
      revLP.type = 'lowpass';
      revLP.frequency.value = 2600;
      const taps = [0.029, 0.047, 0.071];
      taps.forEach((sec, idx) => {
        const dl = ctx.createDelay(0.5);
        dl.delayTime.value = sec;
        const fb = ctx.createGain();
        fb.gain.value = 0.34 - idx * 0.04;
        revIn.connect(dl);
        dl.connect(fb);
        fb.connect(revLP);
        dl.connect(revLP);
      });
      reverbSend.connect(revIn);
      revLP.connect(toneFilter);
      reverbEntry = revIn;
    }
    this._reverbSend = reverbSend;

    // 4. Subtle Warm Stereo Ping-Pong Shimmer Delay for celesta & harp sparkle
    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.16;
    const delayL = ctx.createDelay(1.0);
    const delayR = ctx.createDelay(1.0);
    delayL.delayTime.value = 0.28;
    delayR.delayTime.value = 0.42;
    const fbL = ctx.createGain();
    const fbR = ctx.createGain();
    fbL.gain.value = 0.2;
    fbR.gain.value = 0.2;
    const delayLP = ctx.createBiquadFilter();
    delayLP.type = 'lowpass';
    delayLP.frequency.value = 2400;

    delaySend.connect(delayLP);
    delayLP.connect(delayL);
    delayL.connect(fbL);
    fbL.connect(delayR);
    delayR.connect(fbR);
    fbR.connect(delayL);

    if (typeof ctx.createStereoPanner === 'function') {
      const panL = ctx.createStereoPanner();
      const panR = ctx.createStereoPanner();
      panL.pan.value = -0.45;
      panR.pan.value = 0.45;
      delayL.connect(panL);
      delayR.connect(panR);
      panL.connect(toneFilter);
      panR.connect(toneFilter);
    } else {
      delayL.connect(toneFilter);
      delayR.connect(toneFilter);
    }
    this._delaySend = delaySend;

    // 5. SFX Bus (clear headroom above BGM + subtle room cohesion)
    const sfxBus = ctx.createGain();
    sfxBus.gain.value = 1.0;
    sfxBus.connect(comp);
    this._sfxBus = sfxBus;

    const sfxRev = ctx.createGain();
    sfxRev.gain.value = 0.11;
    sfxBus.connect(sfxRev);
    if (reverbEntry) sfxRev.connect(reverbEntry);
    this._sfxReverbSend = sfxRev;

    // 6. Reusable noise buffer for jazz brushes, wood rim, flute breath, and shaker
    this._noiseBuffer = this._createNoiseBuffer(ctx, 1.0);
  }

  _createCafeReverbIR(ctx, durationSec) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const ir = ctx.createBuffer(2, length, rate);
    // Deterministic lightweight PRNG so reverb is consistent and free of sharp spikes
    let seed = 133742;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed / 4294967296) * 2 - 1;
    };

    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      let lp = 0;
      const damp = ch === 0 ? 0.24 : 0.27;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, 2.75);
        // Smooth early wooden room diffusion
        const raw = nextRand();
        lp = lp + damp * (raw - lp);
        // Gentle early reflection taps (18ms, 33ms, 51ms)
        let sample = lp * env * 0.52;
        if (i === Math.floor(rate * 0.018)) sample += (ch === 0 ? 0.35 : -0.25);
        if (i === Math.floor(rate * 0.033)) sample += (ch === 0 ? -0.22 : 0.3);
        if (i === Math.floor(rate * 0.051)) sample += (ch === 0 ? 0.18 : 0.16);
        data[i] = sample;
      }
    }
    return ir;
  }

  _createNoiseBuffer(ctx, durationSec) {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 987654321;
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      // Soft pink-ish coloration for silky jazz brushes
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.42) * 0.85));
    }
    return buf;
  }

  _targetBGMGain() {
    if (!this.bgmEnabled || this.tabHidden) return 0.0001;
    const base = this.feverMode ? 1.05 : 0.94;
    return this.muffled ? base * 0.76 : base;
  }

  _rampParam(param, target, timeSec = 0.35, exponential = true) {
    if (!this.ctx || !param) return;
    try {
      const now = this.ctx.currentTime;
      const safeCur = exponential ? Math.max(0.0001, param.value) : param.value;
      const safeTarget = exponential ? Math.max(0.0001, target) : target;
      param.cancelScheduledValues(now);
      param.setValueAtTime(safeCur, now);
      if (exponential) {
        param.exponentialRampToValueAtTime(safeTarget, now + Math.max(0.02, timeSec));
      } else {
        param.linearRampToValueAtTime(safeTarget, now + Math.max(0.02, timeSec));
      }
    } catch (_) {}
  }

  _duckBGM(factor = 0.64, holdSec = 0.55, releaseSec = 0.7) {
    if (!this.ctx || !this._bgmDuckGain || !this.bgmEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const cur = Math.max(0.05, this._bgmDuckGain.gain.value);
      this._bgmDuckGain.gain.cancelScheduledValues(now);
      this._bgmDuckGain.gain.setValueAtTime(cur, now);
      this._bgmDuckGain.gain.exponentialRampToValueAtTime(Math.max(0.15, factor), now + 0.08);
      this._bgmDuckGain.gain.setValueAtTime(Math.max(0.15, factor), now + 0.08 + holdSec);
      this._bgmDuckGain.gain.exponentialRampToValueAtTime(1.0, now + 0.08 + holdSec + releaseSec);
    } catch (_) {}
  }

  // ==================== Public State Controls ====================

  setSfxEnabled(enabled) {
    this.sfxEnabled = !!enabled;
  }

  // Legacy alias: toggles SFX only (never kills BGM unexpectedly)
  setMuted(mute) {
    this.sfxEnabled = !mute;
  }

  setBGMTrack(trackId) {
    const valid = trackId === 'waltz' || trackId === 'bossa' || trackId === 'off' ? trackId : 'waltz';
    const prevTrack = this.bgmTrack;
    this.bgmTrack = valid;
    this.bgmEnabled = valid !== 'off';

    if (!this.bgmEnabled) {
      this.stopBGM(true);
      return this.bgmTrack;
    }

    const ctx = this.ensureCtx();
    if (prevTrack !== valid) {
      this._stepIndex = 0;
      this._cycleCount = 0;
    }
    if (ctx && !this.tabHidden) {
      if (this._isPlayingBGM && prevTrack !== valid) {
        // Cross-fade seamlessly into the newly chosen track
        this._nextNoteTime = ctx.currentTime + 0.08;
        this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.45, true);
      } else {
        this.startBGM();
      }
    }
    return this.bgmTrack;
  }

  /**
   * Cycles background music cleanly: waltz -> bossa -> off -> waltz
   */
  cycleBGMTrack() {
    const order = ['waltz', 'bossa', 'off'];
    const idx = order.indexOf(this.bgmTrack);
    const next = order[(idx + 1) % order.length];
    return this.setBGMTrack(next);
  }

  /**
   * Quick toggle on/off (preserves last active track or defaults to waltz)
   */
  toggleBGM() {
    if (this.bgmEnabled) {
      this._lastActiveTrack = this.bgmTrack;
      this.setBGMTrack('off');
      return false;
    }
    this.setBGMTrack(this._lastActiveTrack || 'waltz');
    return true;
  }

  getTrackInfo() {
    if (!this.bgmEnabled || this.bgmTrack === 'off') {
      return { id: 'off', label: '🎵 音乐: 关', title: '已关闭' };
    }
    const t = this.TRACKS[this.bgmTrack] || this.TRACKS.waltz;
    return { id: t.id, label: t.label, title: t.title };
  }

  setFeverMode(active) {
    const next = !!active;
    if (this.feverMode === next) return;
    this.feverMode = next;
    if (this.ctx && this._bgmMasterGain && this.bgmEnabled && !this.tabHidden) {
      this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.45, true);
    }
  }

  setMuffled(muffled) {
    const next = !!muffled;
    if (this.muffled === next) return;
    this.muffled = next;
    if (this.ctx && this._bgmToneFilter && this._bgmMasterGain) {
      this._rampParam(this._bgmToneFilter.frequency, next ? 580 : 12500, 0.42, true);
      if (this.bgmEnabled && !this.tabHidden) {
        this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.42, true);
      }
    }
  }

  setDangerLevel(level) {
    this.dangerLevel = Math.max(0, Math.min(1, Number(level) || 0));
  }

  setTabHidden(hidden) {
    const next = !!hidden;
    if (this.tabHidden === next) return;
    this.tabHidden = next;
    if (next) {
      if (this._bgmMasterGain && this.ctx) {
        this._rampParam(this._bgmMasterGain.gain, 0.0001, 0.15, true);
      }
      if (this._schedTimer) {
        clearInterval(this._schedTimer);
        this._schedTimer = null;
      }
      this._isPlayingBGM = false;
    } else if (this.bgmEnabled && this.ctx && this.ctx.state === 'running') {
      this.startBGM();
    }
  }

  // ==================== Lookahead Music Scheduler ====================

  startBGM() {
    if (!this.bgmEnabled || this.bgmTrack === 'off' || this.tabHidden) return;
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      if (this._schedTimer) {
        clearInterval(this._schedTimer);
        this._schedTimer = null;
      }

      this._isPlayingBGM = true;
      this._nextNoteTime = ctx.currentTime + 0.08;
      this._gainBoostedAtRunning = ctx.state === 'running';

      // Smooth cozy fade-in so music blooms gently (linear ramp avoids mobile WebView exponential underflow)
      this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), this._fadeInDone ? 0.35 : 0.75, false);
      this._rampParam(this._bgmToneFilter.frequency, this.muffled ? 580 : 12500, 0.35, true);
      this._fadeInDone = true;

      this._schedTimer = setInterval(() => this._schedulerTick(), 35);
      this._schedulerTick();
    } catch (_) {}
  }

  stopBGM(fade = true) {
    if (this._schedTimer) {
      clearInterval(this._schedTimer);
      this._schedTimer = null;
    }
    this._isPlayingBGM = false;
    this._gainBoostedAtRunning = false;
    try {
      if (this.ctx && this._bgmMasterGain) {
        if (fade) {
          this._rampParam(this._bgmMasterGain.gain, 0.0001, 0.28, true);
        } else {
          this._bgmMasterGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this._bgmMasterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        }
      }
    } catch (_) {}
  }

  _currentStepDurationSec(track) {
    let bpm = this.feverMode ? track.bpmFever : track.bpmNormal;
    if (this.dangerLevel > 0.25) {
      const lift = this.feverMode ? 0.055 : 0.095;
      bpm *= 1 + (this.dangerLevel - 0.25) * lift;
    }
    // 1 step = 1 eighth note (half a quarter-note beat)
    return 60 / bpm / 2;
  }

  _schedulerTick() {
    if (!this.bgmEnabled || this.tabHidden || !this.ctx) return;
    try {
      if (!this._externalCtx && this.ctx.state && this.ctx.state !== 'running') return;

      if (!this._externalCtx && (!this._gainBoostedAtRunning || this._bgmMasterGain.gain.value < 0.01)) {
        this._gainBoostedAtRunning = true;
        this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.28, false);
      }

      const track = this.TRACKS[this.bgmTrack] || this.TRACKS.waltz;
      const now = this.ctx.currentTime;
      const lookahead = 0.14; // Schedule 140ms ahead on exact Web Audio clock

      // Recover cleanly if browser throttled background timers (prevent note bursts!)
      if (this._nextNoteTime < now - 0.25) {
        this._nextNoteTime = now + 0.06;
      }

      let guard = 0;
      while (this._nextNoteTime < now + lookahead && guard < 12) {
        this._scheduleTrackStep(track, this._stepIndex, this._nextNoteTime);
        const stepSec = this._currentStepDurationSec(track);
        this._nextNoteTime += stepSec;
        this._stepIndex++;
        const totalSteps = track.bars.length * track.stepsPerBar;
        if (this._stepIndex >= totalSteps) {
          this._stepIndex = 0;
          this._cycleCount++;
        }
        guard++;
      }
    } catch (_) {}
  }

  /**
   * Offline rendering helper for automated QA / spectral analysis (renders exact track on an OfflineAudioContext)
   */
  renderOfflineSchedule(durationSec, options = {}) {
    if (!this.ctx) return;
    if (options.track) this.bgmTrack = options.track;
    this.bgmEnabled = this.bgmTrack !== 'off';
    if (typeof options.fever === 'boolean') this.feverMode = options.fever;
    if (typeof options.muffled === 'boolean') this.muffled = options.muffled;

    this._initGraph(this.ctx);
    this._bgmMasterGain.gain.setValueAtTime(this._targetBGMGain(), 0);
    this._bgmToneFilter.frequency.setValueAtTime(this.muffled ? 580 : 12500, 0);

    const track = this.TRACKS[this.bgmTrack] || this.TRACKS.waltz;
    let t = 0.05;
    let step = 0;
    const totalSteps = track.bars.length * track.stepsPerBar;
    this._cycleCount = 0;

    while (t < durationSec - 0.1) {
      this._scheduleTrackStep(track, step, t);
      t += this._currentStepDurationSec(track);
      step++;
      if (step >= totalSteps) {
        step = 0;
        this._cycleCount++;
      }
    }
  }

  _scheduleTrackStep(track, globalStep, time) {
    const spb = track.stepsPerBar;
    const barIdx = Math.floor(globalStep / spb) % track.bars.length;
    const stepInBar = globalStep % spb;
    const bar = track.bars[barIdx];
    const stepSec = this._currentStepDurationSec(track);

    if (track.id === 'waltz') {
      this._scheduleWaltzStep(bar, barIdx, stepInBar, time, stepSec);
    } else {
      this._scheduleBossaStep(bar, barIdx, stepInBar, time, stepSec);
    }
  }

  _scheduleWaltzStep(bar, barIdx, s, time, stepSec) {
    const fever = this.feverMode;
    const beatSec = stepSec * 2;
    const secondCycle = this._cycleCount % 2 === 1;

    // 1. Warm Upright Bass (oom on beat 1; optional turn bass2 on beat 3)
    if (s === 0) {
      this._playBass(time, bar.bass, beatSec * 1.45, fever ? 0.34 : 0.30);
      this._playKick(time, fever ? 0.16 : 0.11);
    } else if (s === 4 && bar.bass2) {
      this._playBass(time, bar.bass2, beatSec * 0.95, 0.24);
    } else if (fever && s === 4 && barIdx % 2 === 1) {
      // Joyful walking-waltz fifth pickup in Fever!
      this._playBass(time, bar.bass + 7, beatSec * 0.8, 0.18);
    }

    // 2. Cozy Rhodes / Felt Café Piano Waltz Chords (oom-PAH-pah on beats 2 & 3)
    if (s === 2) {
      this._playRhodes(time + 0.004, bar.chord, beatSec * 0.92, fever ? 0.17 : 0.15, 0.016, -0.18);
      this._playBrush(time, fever ? 0.11 : 0.075, 0.09);
    } else if (s === 4) {
      this._playRhodes(time + 0.005, bar.chord, beatSec * 0.85, fever ? 0.14 : 0.115, 0.014, 0.16);
      this._playBrush(time, fever ? 0.095 : 0.055, 0.075);
    }

    // 3. Soft Starlight String Pad on lyrical chorus bars (B & C sections)
    if (s === 0 && (bar.pad || fever)) {
      const padNotes = [bar.chord[0] + 12, bar.chord[2] + 12];
      this._playPad(time, padNotes, beatSec * 2.9, fever ? 0.068 : 0.052);
    }

    // 4. Singing Celesta / Music Box Lead Melody
    const mel = bar.mel[s];
    if (mel) {
      const [midi, durSteps, velOverride] = mel;
      const durSec = Math.max(0.2, durSteps * stepSec * 0.96);
      // Natural waltz phrase expression (gentle lift on beat 1)
      const dyn = velOverride || (s === 0 ? 0.25 : s === 3 ? 0.22 : 0.19);
      const pan = Math.sin(barIdx * 0.7 + s * 0.4) * 0.22;
      this._playCelesta(time, midi, durSec, fever ? dyn * 1.08 : dyn, pan);
      // Warm flute-like double on chorus long notes or second cycle for musical evolution!
      if ((bar.pad || secondCycle) && durSteps >= 3 && s === 0) {
        this._playFluteVibe(time + 0.01, midi - 12, durSec * 0.92, 0.085, -pan * 0.7);
      }
    }

    // 5. Starlight Harp Twinkle Counter-Melody (gentle on chorus / Cycle 2, full carousel cascade in Fever!)
    if (fever) {
      // Sparkling consonant chord-tone arpeggio across beats!
      const arpNote = bar.chord[s % bar.chord.length] + (s >= 3 ? 24 : 12);
      const pan = (s % 2 === 0 ? -0.42 : 0.42);
      this._playHarp(time + 0.006, arpNote, stepSec * 2.1, s % 2 === 1 ? 0.105 : 0.075, pan);
      if (s === 1 || s === 3 || s === 5) {
        this._playShaker(time, 0.055);
      }
    } else if ((bar.pad || secondCycle) && (s === 2 || s === 5)) {
      const arpNote = bar.chord[(s === 2 ? 1 : 3) % bar.chord.length] + 12;
      this._playHarp(time + 0.008, arpNote, stepSec * 2.4, 0.068, s === 2 ? -0.35 : 0.35);
    }

    // 6. Subtle Danger Heartbeat Rim Tick when danger stack nears top
    if (!fever && this.dangerLevel > 0.35 && (s === 1 || s === 4)) {
      this._playRim(time, 0.045 * this.dangerLevel);
    }
  }

  _scheduleBossaStep(bar, barIdx, s, time, stepSec) {
    const fever = this.feverMode;
    const isEvenBar = barIdx % 2 === 0;
    const secondCycle = this._cycleCount % 2 === 1;

    // 1. Iconic Bossa Nova Upright Bass (1, and-of-2, 3, and-of-4)
    if (s === 0) {
      this._playBass(time, bar.bass, stepSec * 2.6, fever ? 0.34 : 0.30);
      this._playKick(time, fever ? 0.16 : 0.12);
    } else if (s === 3) {
      this._playBass(time, bar.bassAlt, stepSec * 0.9, 0.20);
    } else if (s === 4) {
      this._playBass(time, bar.bassAlt, stepSec * 2.4, fever ? 0.30 : 0.27);
      this._playKick(time, fever ? 0.13 : 0.09);
    } else if (s === 7) {
      this._playBass(time, bar.bass, stepSec * 0.9, 0.19);
    }

    // 2. Syncopated 2-Bar Bossa Clave Rhodes Comping
    const compHit = isEvenBar
      ? (s === 0 || s === 3 || s === 6)
      : (s === 1 || s === 4 || s === 7);
    if (compHit) {
      const accent = (s === 0 || s === 4) ? 0.165 : 0.135;
      const pan = (s % 2 === 0 ? -0.2 : 0.2);
      this._playRhodes(time + 0.004, bar.chord, stepSec * 2.2, fever ? accent * 1.1 : accent, 0.014, pan);
    }

    // 3. Wooden Clave Rim Click & Silky Café Shaker
    const rimHit = isEvenBar ? (s === 0 || s === 3 || s === 6) : (s === 2 || s === 5);
    if (rimHit) {
      this._playRim(time, fever ? 0.085 : 0.055);
    }
    this._playShaker(time, (s % 2 === 1 ? 0.048 : 0.028) * (fever ? 1.45 : 1.0));
    if (fever && (s === 2 || s === 6)) {
      this._playBrush(time, 0.075, 0.08);
    }

    // 4. Warm Midnight Lounge Pad on Section B
    if (s === 0 && (bar.pad || fever)) {
      this._playPad(time, [bar.chord[0] + 12, bar.chord[2] + 12], stepSec * 7.6, fever ? 0.062 : 0.048);
    }

    // 5. Velvety Café Flute / Vibraphone Lead Melody
    const mel = bar.mel[s];
    if (mel) {
      const [midi, durSteps, velOverride] = mel;
      const durSec = Math.max(0.22, durSteps * stepSec * 0.96);
      const dyn = velOverride || (s === 0 || s === 3 ? 0.24 : 0.20);
      const pan = Math.sin(barIdx * 0.9 + s * 0.3) * 0.2;
      this._playFluteVibe(time, midi, durSec, fever ? dyn * 1.06 : dyn, pan);
      // Soft celesta bell kiss on attacks in Section B, Cycle 2, or Fever!
      if (fever || bar.pad || secondCycle) {
        this._playCelesta(time + 0.004, midi, durSec * 0.72, fever ? 0.15 : 0.10, -pan * 0.6);
      }
    }

    // 6. Fever Starlight Harp Swing Sparkle
    if (fever && (s === 1 || s === 3 || s === 5 || s === 7)) {
      const arpNote = bar.chord[Math.floor(s / 2) % bar.chord.length] + 24;
      this._playHarp(time + 0.006, arpNote, stepSec * 1.9, 0.088, s % 4 === 1 ? -0.45 : 0.45);
    }

    // 7. Danger subtle pulse
    if (!fever && this.dangerLevel > 0.35 && s === 7) {
      this._playRim(time, 0.055 * this.dangerLevel);
    }
  }

  // ==================== Cozy Acoustic-Inspired Synth Voices ====================

  _connectToBGM(node, panVal = 0, reverbAmt = 0.28, delayAmt = 0.0) {
    const ctx = this.ctx;
    let out = node;
    if (panVal !== 0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.9, Math.min(0.9, panVal));
      node.connect(panner);
      out = panner;
    }
    out.connect(this._bgmDryGain);
    if (reverbAmt > 0 && this._reverbSend) {
      const send = ctx.createGain();
      send.gain.value = reverbAmt;
      out.connect(send);
      send.connect(this._reverbSend);
    }
    if (delayAmt > 0 && this._delaySend) {
      const dSend = ctx.createGain();
      dSend.gain.value = delayAmt;
      out.connect(dSend);
      dSend.connect(this._delaySend);
    }
  }

  /**
   * 1. Starlight Celesta / Music Box Bell — crystal-warm storybook patisserie melody
   */
  _playCelesta(time, midi, dur, vel = 0.22, pan = 0) {
    const ctx = this.ctx;
    const freq = this._midiToHz(midi);

    const out = ctx.createGain();
    out.gain.setValueAtTime(1.0, time);
    this._connectToBGM(out, pan, 0.42, 0.24);

    // Core warm sine fundamental
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq * 1.002, time);
    osc1.frequency.exponentialRampToValueAtTime(freq, time + 0.025);
    g1.gain.setValueAtTime(0.0001, time);
    g1.gain.linearRampToValueAtTime(vel, time + 0.009);
    g1.gain.exponentialRampToValueAtTime(vel * 0.38, time + dur * 0.45);
    g1.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.22);
    osc1.connect(g1);
    g1.connect(out);
    osc1.start(time);
    osc1.stop(time + dur + 0.25);

    // Celesta octave shimmer (2x harmonic, soft & rounded)
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, time);
    g2.gain.setValueAtTime(0.0001, time);
    g2.gain.linearRampToValueAtTime(vel * 0.22, time + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(dur * 0.72, 0.42));
    osc2.connect(g2);
    g2.connect(out);
    osc2.start(time);
    osc2.stop(time + Math.min(dur * 0.75, 0.46));

    // Tiny felt-hammer bell ping (4x harmonic, crisp 45ms sparkle)
    const osc3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 4.006, time);
    g3.gain.setValueAtTime(0.0001, time);
    g3.gain.linearRampToValueAtTime(vel * 0.065, time + 0.003);
    g3.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
    osc3.connect(g3);
    g3.connect(out);
    osc3.start(time);
    osc3.stop(time + 0.07);
  }

  /**
   * 2. Warm Felt Café Piano / Rhodes Chord — gently rolled like a real pianist's hand
   */
  _playRhodes(time, midiNotes, dur, vel = 0.15, spreadSec = 0.015, pan = 0) {
    const ctx = this.ctx;
    const perNoteVel = vel / Math.sqrt(Math.max(1, midiNotes.length));

    const chordFilter = ctx.createBiquadFilter();
    chordFilter.type = 'lowpass';
    chordFilter.frequency.setValueAtTime(2100, time);
    chordFilter.frequency.exponentialRampToValueAtTime(760, time + Math.min(dur, 0.55));
    chordFilter.Q.value = 0.5;
    this._connectToBGM(chordFilter, pan, 0.34, 0.0);

    midiNotes.forEach((midi, i) => {
      const t = time + i * spreadSec;
      const freq = this._midiToHz(midi);

      // Warm electric piano body
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(perNoteVel, t + 0.014);
      g.gain.exponentialRampToValueAtTime(perNoteVel * 0.48, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.14);
      osc.connect(g);
      g.connect(chordFilter);
      osc.start(t);
      osc.stop(t + dur + 0.18);

      // Gentle Rhodes bell-tine overtone
      const tine = ctx.createOscillator();
      const tg = ctx.createGain();
      tine.type = 'sine';
      tine.frequency.setValueAtTime(freq * 2, t);
      tg.gain.setValueAtTime(0.0001, t);
      tg.gain.linearRampToValueAtTime(perNoteVel * 0.24, t + 0.006);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.24, dur * 0.5));
      tine.connect(tg);
      tg.connect(chordFilter);
      tine.start(t);
      tine.stop(t + Math.min(0.28, dur * 0.55));
    });
  }

  /**
   * 3. Cozy Upright Pizzicato Bass — woody, round, tight low-end foundation
   */
  _playBass(time, midi, dur, vel = 0.28) {
    const ctx = this.ctx;
    const freq = this._midiToHz(midi);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(680, time);
    lp.frequency.exponentialRampToValueAtTime(220, time + Math.min(0.28, dur));
    lp.Q.value = 0.9;
    this._connectToBGM(lp, 0, 0.08, 0.0);

    // Warm plucked woody body
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 1.012, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.032);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.01);
    g.gain.exponentialRampToValueAtTime(vel * 0.52, time + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.08);
    osc.connect(g);
    g.connect(lp);
    osc.start(time);
    osc.stop(time + dur + 0.11);

    // Clean round sine sub reinforcement
    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq, time);
    sg.gain.setValueAtTime(0.0001, time);
    sg.gain.linearRampToValueAtTime(vel * 0.55, time + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.06);
    sub.connect(sg);
    sg.connect(lp);
    sub.start(time);
    sub.stop(time + dur + 0.09);
  }

  /**
   * 4. Velvety Café Flute / Soft Vibraphone — warm singing lead with gentle delayed vibrato
   */
  _playFluteVibe(time, midi, dur, vel = 0.22, pan = 0) {
    const ctx = this.ctx;
    const freq = this._midiToHz(midi);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, time);
    lp.Q.value = 0.5;
    this._connectToBGM(lp, pan, 0.45, 0.16);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, time);

    // Gentle expressive vibrato fading in on longer notes
    if (dur > 0.32) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5.1, time);
      lfoGain.gain.setValueAtTime(0.0001, time);
      lfoGain.gain.linearRampToValueAtTime(freq * 0.0045, time + Math.min(0.28, dur * 0.6));
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfoGain.connect(osc2.frequency);
      lfo.start(time);
      lfo.stop(time + dur + 0.2);
    }

    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, time);
    g1.gain.linearRampToValueAtTime(vel, time + 0.028);
    g1.gain.exponentialRampToValueAtTime(vel * 0.62, time + dur * 0.65);
    g1.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.18);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, time);
    g2.gain.linearRampToValueAtTime(vel * 0.24, time + 0.022);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.12);

    osc.connect(g1);
    osc2.connect(g2);
    g1.connect(lp);
    g2.connect(lp);
    osc.start(time);
    osc2.start(time);
    osc.stop(time + dur + 0.22);
    osc2.stop(time + dur + 0.16);
  }

  /**
   * 5. Starlight Harp Sparkle — twinkling stereo counter-arpeggio
   */
  _playHarp(time, midi, dur, vel = 0.09, pan = 0) {
    const ctx = this.ctx;
    const freq = this._midiToHz(midi);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4600, time);
    lp.frequency.exponentialRampToValueAtTime(1400, time + Math.min(dur, 0.45));
    this._connectToBGM(lp, pan, 0.5, 0.32);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.14);
    osc.connect(g);
    g.connect(lp);
    osc.start(time);
    osc.stop(time + dur + 0.18);
  }

  /**
   * 6. Warm Nocturnal String Pad — soft velvety bloom in Chorus/Section B
   */
  _playPad(time, midiNotes, dur, vel = 0.05) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1250, time);
    lp.Q.value = 0.5;
    this._connectToBGM(lp, 0, 0.55, 0.0);

    const perVel = vel / Math.max(1, midiNotes.length);
    midiNotes.forEach((midi, idx) => {
      const freq = this._midiToHz(midi);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      // Tiny chorus detune between voices for dreamy warmth
      osc.frequency.setValueAtTime(freq * (idx % 2 === 0 ? 0.9985 : 1.0015), time);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(perVel, time + Math.min(0.45, dur * 0.35));
      g.gain.setValueAtTime(perVel, time + dur * 0.72);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.35);
      osc.connect(g);
      g.connect(lp);
      osc.start(time);
      osc.stop(time + dur + 0.4);
    });
  }

  /**
   * 7. Acoustic Café Percussion (Jazz Brush, Felt Kick, Wood Rim, Starlight Shaker)
   */
  _playBrush(time, vel = 0.075, dur = 0.09) {
    if (!this._noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2900, time);
    bp.Q.value = 1.1;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(bp);
    bp.connect(g);
    this._connectToBGM(g, 0.12, 0.16, 0.0);
    src.start(time, (time * 3.7) % 0.6, dur + 0.02);
  }

  _playShaker(time, vel = 0.04) {
    if (!this._noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(5800, time);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);

    src.connect(hp);
    hp.connect(g);
    this._connectToBGM(g, -0.22, 0.12, 0.0);
    src.start(time, (time * 5.3) % 0.6, 0.05);
  }

  _playRim(time, vel = 0.06) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1240, time);
    osc.frequency.exponentialRampToValueAtTime(760, time + 0.022);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.032);
    osc.connect(g);
    this._connectToBGM(g, 0.25, 0.2, 0.0);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  _playKick(time, vel = 0.12) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(96, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.085);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    osc.connect(g);
    this._connectToBGM(g, 0, 0.04, 0.0);
    osc.start(time);
    osc.stop(time + 0.14);
  }

  // ==================== Tactile Game SFX (C-Major Harmonized) ====================

  _playTone(freq, type, gainPeak, duration, attack = 0.01, endFreq = null) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    try {
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
      gain.connect(this._sfxBus || ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (_) {}
  }

  /**
   * Warm café brass door-bell welcome chime when opening the patisserie
   */
  playStartCafe() {
    const notes = [659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'sine', 0.085, 0.42, 0.008);
      }, i * 68);
    });
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
    const now = Date.now();
    if (now - this._lastBounceAt < 45) return;
    this._lastBounceAt = now;
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
    this._duckBGM(0.55, 0.85, 0.9);
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
    this._duckBGM(0.68, 0.55, 0.65);
    const notes = [659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'triangle', 0.12, 0.34, 0.008);
      }, i * 62);
    });
  }

  playFeverStart() {
    this._duckBGM(0.68, 0.5, 0.6);
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
    this._duckBGM(0.42, 1.1, 1.1);
    const notes = [523.25, 493.88, 440.0, 392.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'triangle', 0.09, 0.38, 0.015);
      }, i * 140);
    });
  }

  /**
   * 3.0 Plan B SFX — 100% Web Audio C-Major Procedural Synthesis
   */
  playShopBuy() {
    // Crisp wooden café register brass ding + warm major chord confirmation
    this._playTone(1318.51, 'sine', 0.12, 0.28, 0.004);
    this._playTone(2637.02, 'sine', 0.045, 0.18, 0.003);
    setTimeout(() => {
      this._playTone(1046.5, 'triangle', 0.1, 0.32, 0.006);
      this._playTone(1567.98, 'sine', 0.095, 0.36, 0.006);
      this._playTone(2093.0, 'sine', 0.065, 0.38, 0.008);
    }, 68);
  }

  playPatronSelect() {
    // Playful soft cat-paw kneading two-syllable chirp
    this._playTone(587.33, 'sine', 0.09, 0.095, 0.005, 740);
    setTimeout(() => {
      this._playTone(880.0, 'triangle', 0.095, 0.14, 0.005, 1046.5);
    }, 58);
  }

  playEventStart(kind) {
    if (kind === 'meteor') {
      // Shimmering descending + ascending celesta/harp arpeggio
      const notes = [2093.0, 1760.0, 1567.98, 1318.51, 1567.98, 2093.0, 2637.02];
      notes.forEach((f, i) => {
        setTimeout(() => {
          this._playTone(f, 'sine', 0.085, 0.32, 0.005);
        }, i * 44);
      });
    } else if (kind === 'yarn') {
      // Playful mischievous cat meow pitch-glide synth
      this._playTone(620, 'triangle', 0.11, 0.13, 0.012, 920);
      setTimeout(() => {
        this._playTone(920, 'sine', 0.1, 0.19, 0.008, 520);
      }, 105);
      setTimeout(() => {
        this._playTone(783.99, 'sine', 0.065, 0.12, 0.006, 987.77);
      }, 240);
    } else if (kind === 'chime') {
      // Warm golden bakery oven brass bell harmonics
      this._playTone(783.99, 'sine', 0.12, 0.72, 0.006);
      this._playTone(1567.98, 'triangle', 0.07, 0.58, 0.005);
      this._playTone(2349.32, 'sine', 0.04, 0.38, 0.004);
      setTimeout(() => {
        this._playTone(1046.5, 'sine', 0.11, 0.76, 0.006);
        this._playTone(2093.0, 'sine', 0.055, 0.5, 0.004);
      }, 170);
    }
  }

  playYarnHit() {
    // Soft elastic wool thump + playful pluck
    this._playTone(260, 'sine', 0.14, 0.12, 0.004, 135);
    this._playTone(587.33, 'triangle', 0.075, 0.09, 0.004, 783.99);
  }

  playYarnBreak() {
    // Joyful crispy candy-confetti pop + sparkle celebration chord
    this._playTone(360, 'sine', 0.14, 0.1, 0.004, 760);
    const notes = [783.99, 1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, i % 2 === 0 ? 'triangle' : 'sine', 0.1, 0.3, 0.005);
      }, 24 + i * 38);
    });
  }

  playRushTick(urgent = false) {
    // Gentle wooden block tick for final 5s Rush countdown
    const f = urgent ? 1174.66 : 880.0;
    this._playTone(f, 'triangle', urgent ? 0.11 : 0.08, 0.075, 0.003, f * 0.86);
    if (urgent) {
      this._playTone(f * 1.5, 'sine', 0.05, 0.06, 0.002);
    }
  }

  playWindGust() {
    // Airy starlight gust sweeping away top treats in 90s Rush mode
    this._playTone(440, 'sine', 0.1, 0.24, 0.015, 880);
    setTimeout(() => this._playTone(659.25, 'triangle', 0.09, 0.22, 0.01, 1318.51), 60);
    if (this.sfxEnabled && this.ctx && this._noiseBuffer) {
      try {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(900, now);
        bp.frequency.exponentialRampToValueAtTime(2600, now + 0.26);
        bp.Q.value = 1.4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.11, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        src.connect(bp);
        bp.connect(g);
        g.connect(this._sfxBus || ctx.destination);
        src.start(now, 0, 0.35);
      } catch (_) {}
    }
  }

  playSlingStretch(power = 0.5) {
    const f = 340 + Math.max(0, Math.min(1, power)) * 320;
    this._playTone(f, 'sine', 0.036, 0.048, 0.003, f * 1.12);
  }

  playBankBounce(count = 1) {
    const base = count >= 2 ? 1318.51 : 1046.5;
    this._playTone(base, 'sine', 0.095, 0.13, 0.003, base * 1.15);
    this._playTone(base * 2.0, 'triangle', 0.04, 0.07, 0.002);
  }

  playServeBell() {
    // Classic brass patisserie service bell + bright ascending confirmation
    this._playTone(1567.98, 'sine', 0.13, 0.34, 0.003);
    this._playTone(3135.96, 'sine', 0.045, 0.18, 0.002);
    setTimeout(() => this._playTone(1318.51, 'triangle', 0.095, 0.22, 0.005), 55);
    setTimeout(() => this._playTone(1975.53, 'sine', 0.095, 0.28, 0.005), 110);
  }

  playCascadeHit(step = 1) {
    const scale = [659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98];
    const f = scale[Math.min(scale.length - 1, Math.max(0, step - 1))];
    this._playTone(f, 'triangle', 0.125, 0.24, 0.004, f * 1.04);
    this._playTone(f * 1.5, 'sine', 0.08, 0.22, 0.006);
  }

  playTraitTrigger(tier = 4) {
    if (tier === 4) {
      // Lemon fizz vaporize pop
      this._playTone(740, 'sine', 0.09, 0.11, 0.004, 1380);
      setTimeout(() => this._playTone(1174.66, 'triangle', 0.075, 0.14, 0.004, 1760), 45);
    } else if (tier === 5) {
      // Daifuku soft inward pull whoosh
      this._playTone(587.33, 'sine', 0.09, 0.22, 0.008, 392);
      setTimeout(() => this._playTone(783.99, 'sine', 0.075, 0.18, 0.006), 60);
    } else if (tier === 6) {
      // Caramel donut spin whirr
      this._playTone(440, 'triangle', 0.085, 0.18, 0.006, 880);
      setTimeout(() => this._playTone(659.25, 'sine', 0.07, 0.18, 0.006, 987.77), 55);
    } else if (tier === 8) {
      // Mont Blanc heavy hammer crush thump
      this._playTone(150, 'triangle', 0.16, 0.24, 0.004, 72);
      this._playTone(320, 'sine', 0.09, 0.16, 0.004, 180);
    } else {
      this._playTone(880, 'sine', 0.08, 0.18, 0.005, 1174.66);
    }
  }

  playChefSkill(patronId = 'mikan') {
    const chord =
      patronId === 'luna'
        ? [587.33, 880.0, 1174.66, 1760.0]
        : patronId === 'mugi'
        ? [523.25, 659.25, 783.99, 1318.51]
        : [659.25, 783.99, 1046.5, 1567.98];
    chord.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, i % 2 === 0 ? 'triangle' : 'sine', 0.105, 0.26, 0.005);
      }, i * 44);
    });
  }

  playShiftClear() {
    // Warm triumphant patisserie register chime + major chord arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, i === notes.length - 1 ? 'sine' : 'triangle', 0.115, 0.34, 0.006);
      }, i * 62);
    });
  }

  playCoinSpend() {
    this._playTone(1174.66, 'sine', 0.09, 0.12, 0.003, 1567.98);
    setTimeout(() => this._playTone(1760.0, 'triangle', 0.075, 0.15, 0.003), 48);
  }

  playBumperHit() {
    this._playTone(880, 'triangle', 0.11, 0.14, 0.003, 1320);
    this._playTone(1760, 'sine', 0.055, 0.09, 0.002);
  }

  playAntiGrav() {
    const notes = [392.0, 523.25, 659.25, 987.77];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'sine', 0.085, 0.28, 0.01, f * 1.18);
      }, i * 55);
    });
  }

  playGlazeRing() {
    // Glistening caramel starlight harp arpeggio
    const notes = [1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, i % 2 === 0 ? 'sine' : 'triangle', 0.075, 0.2, 0.004, f * 1.02);
      }, i * 36);
    });
  }

  playIceShatter() {
    // Crystalline frost crack + sparkling glass chimes
    const notes = [1760.0, 2349.32, 2637.02, 3135.96];
    this._playTone(620, 'triangle', 0.11, 0.08, 0.002, 180);
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone(f, 'sine', 0.068, 0.14, 0.002, f * 0.96);
      }, i * 24);
    });
  }

  getDebugState() {
    const info = this.getTrackInfo();
    return {
      ctxState: this.ctx ? this.ctx.state : 'uninitialized',
      bgmTrack: this.bgmTrack,
      bgmLabel: info.label,
      bgmTitle: info.title,
      bgmEnabled: this.bgmEnabled,
      isPlayingBGM: this._isPlayingBGM,
      sfxEnabled: this.sfxEnabled,
      feverMode: this.feverMode,
      muffled: this.muffled,
      dangerLevel: +this.dangerLevel.toFixed(2),
      stepIndex: this._stepIndex,
      cycleCount: this._cycleCount,
      toneFilterHz: this._bgmToneFilter ? Math.round(this._bgmToneFilter.frequency.value) : null
    };
  }
}

module.exports = StarlightAudio;
