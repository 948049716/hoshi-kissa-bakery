'use strict';
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
const AUDIO_OWN = Object.prototype.hasOwnProperty;

function _audioHasOwn(obj, key) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return false;
  try {
    return Boolean(AUDIO_OWN.call(obj, key));
  } catch (_) {
    return false;
  }
}

function _audioGetOwn(obj, key, fallback = undefined) {
  if (!_audioHasOwn(obj, key)) return fallback;
  try {
    const val = obj[key];
    return val === undefined ? fallback : val;
  } catch (_) {
    return fallback;
  }
}

function _safeIsArray(x) {
  try {
    return Array.isArray(x);
  } catch (_) {
    return false;
  }
}

function _safeIsFrozen(x) {
  try {
    return Object.isFrozen(x);
  } catch (_) {
    return true;
  }
}

function _safeIsExtensible(x) {
  try {
    return Object.isExtensible(x);
  } catch (_) {
    return false;
  }
}

function _isSafeAudioObj(x) {
  if (!x || typeof x !== 'object' || _safeIsArray(x)) return false;
  try {
    AUDIO_OWN.call(x, '__probe__');
    return true;
  } catch (_) {
    return false;
  }
}

function _audioSafePush(arr, ...items) {
  if (!_safeIsArray(arr) || _safeIsFrozen(arr) || !_safeIsExtensible(arr)) return 0;
  try {
    let len = arr.length >>> 0;
    for (let i = 0; i < items.length; i++) {
      Object.defineProperty(arr, len, {
        __proto__: null,
        value: items[i],
        writable: true,
        enumerable: true,
        configurable: true
      });
      len++;
    }
    arr.length = len;
    return len;
  } catch (_) {
    return 0;
  }
}

function _isAudioSelf(self) {
  if (!_isSafeAudioObj(self)) return false;
  try {
    return self instanceof StarlightAudio;
  } catch (_) {
    return false;
  }
}

function _isMutableAudioSelf(self) {
  return Boolean(_isAudioSelf(self) && !_safeIsFrozen(self));
}

const _ACTIVE_TIMERS = typeof WeakMap === 'function' ? new WeakMap() : null;

function _recordActiveTimer(self, timer) {
  if (!_ACTIVE_TIMERS || !self || (typeof self !== 'object' && typeof self !== 'function')) return;
  try {
    const prev = _ACTIVE_TIMERS.get(self);
    if (prev && prev !== timer) {
      try {
        clearInterval(prev);
      } catch (_) {}
    }
    if (timer) {
      _ACTIVE_TIMERS.set(self, timer);
    } else {
      _ACTIVE_TIMERS.delete(self);
    }
  } catch (_) {}
}

function _clearTrackedTimerOnlyMap(self) {
  if (!_ACTIVE_TIMERS || !self || (typeof self !== 'object' && typeof self !== 'function')) return;
  try {
    const tracked = _ACTIVE_TIMERS.get(self);
    if (tracked) {
      try {
        clearInterval(tracked);
      } catch (_) {}
      _ACTIVE_TIMERS.delete(self);
    }
  } catch (_) {}
}

function _clearTrackedTimer(self) {
  _clearTrackedTimerOnlyMap(self);
  if (!self || (typeof self !== 'object' && typeof self !== 'function')) return;
  try {
    const cur = self._schedTimer;
    if (cur) {
      clearInterval(cur);
    }
  } catch (_) {}
}

function _initAudioOwn(self, key, val) {
  try {
    Object.defineProperty(self, key, {
      __proto__: null,
      value: val,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return true;
  } catch (_) {
    try {
      self[key] = val;
      return true;
    } catch (_2) {
      return false;
    }
  }
}

function _safeSetAudioProp(self, key, val) {
  if (!_isAudioSelf(self) || _safeIsFrozen(self)) return false;
  const hasOwn = _audioHasOwn(self, key);
  if (!hasOwn && !_safeIsExtensible(self)) return false;
  try {
    if (hasOwn) {
      const desc = Object.getOwnPropertyDescriptor(self, key);
      if (desc && _audioHasOwn(desc, 'value')) {
        if (!desc.writable) return false;
        Object.defineProperty(self, key, { __proto__: null, value: val });
        return true;
      }
      if (desc && typeof desc.set === 'function') {
        self[key] = val;
        return true;
      }
      return false;
    }
    Object.defineProperty(self, key, {
      __proto__: null,
      value: val,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return true;
  } catch (_) {
    return false;
  }
}

function _safeCtxState(ctx) {
  if (!_isSafeAudioObj(ctx)) return '';
  try {
    const st = ctx.state;
    return typeof st === 'string' ? st : '';
  } catch (_) {
    return '';
  }
}

function _getFnProp(obj, key) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return null;
  try {
    const fn = obj[key];
    return typeof fn === 'function' ? fn : null;
  } catch (_) {
    return null;
  }
}

function _canPlaySfx(self) {
  if (!_isAudioSelf(self)) return false;
  try {
    return Boolean(self.sfxEnabled);
  } catch (_) {
    return false;
  }
}

function _toSafeAudioNum(x, fallback = 0) {
  if (typeof x === 'number') return Number.isFinite(x) ? x : fallback;
  if (x === null || x === undefined) return fallback;
  const t = typeof x;
  if (t === 'symbol' || t === 'bigint' || t === 'boolean' || t === 'function') {
    return fallback;
  }
  if (t === 'string') {
    const s = x.trim();
    if (s === '') return fallback;
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  if (_safeIsArray(x)) return fallback;
  try {
    const prim = typeof x.valueOf === 'function' ? x.valueOf() : NaN;
    if (typeof prim === 'number' && Number.isFinite(prim)) return prim;
    if (typeof prim === 'string' && prim.trim() !== '') {
      const n = Number(prim.trim());
      return Number.isFinite(n) ? n : fallback;
    }
  } catch (_) {
    return fallback;
  }
  return fallback;
}

function _toSafeAudioTier(x, fallback = 1, maxTier = 9, depth = 0) {
  const hi = Math.max(1, Math.floor(_toSafeAudioNum(maxTier, 9)));
  const fb = Math.max(1, Math.min(hi, Math.round(_toSafeAudioNum(fallback, 1))));
  if (typeof x === 'number') {
    return Number.isFinite(x) ? Math.max(1, Math.min(hi, Math.round(x))) : fb;
  }
  if (typeof x === 'string') {
    const s = x.trim();
    if (!s) return fb;
    const m = /^(?:c|catcake_|tier_)(\d+)(?:_happy)?$/i.exec(s);
    if (m) {
      const parsed = Number(m[1]);
      if (Number.isFinite(parsed)) {
        return Math.max(1, Math.min(hi, Math.round(parsed)));
      }
    }
    const n = Number(s);
    if (Number.isFinite(n)) {
      return Math.max(1, Math.min(hi, Math.round(n)));
    }
    return fb;
  }
  if (_isSafeAudioObj(x)) {
    try {
      if (depth < 4 && _audioHasOwn(x, 'tier')) {
        return _toSafeAudioTier(x.tier, fb, hi, depth + 1);
      }
      const prim = typeof x.valueOf === 'function' ? x.valueOf() : NaN;
      if (typeof prim === 'number' && Number.isFinite(prim)) {
        return Math.max(1, Math.min(hi, Math.round(prim)));
      }
    } catch (_) {
      return fb;
    }
  }
  return fb;
}

class StarlightAudio {
  constructor(opts = null) {
    let extCtx = null;
    let factory = null;
    if (_isSafeAudioObj(opts)) {
      try {
        const optFactory = _audioGetOwn(opts, 'createAudioContext', null);
        if (typeof optFactory === 'function') {
          factory = optFactory;
        } else if (_getFnProp(opts, 'createOscillator')) {
          extCtx = opts;
        } else {
          const optCtx = _audioGetOwn(opts, 'ctx', null);
          if (_isSafeAudioObj(optCtx)) {
            extCtx = optCtx;
          }
        }
      } catch (_) {}
    }
    _initAudioOwn(this, 'ctx', extCtx);
    _initAudioOwn(this, '_ctxFactory', factory);
    _initAudioOwn(this, '_externalCtx', Boolean(extCtx));

    // Independent BGM & SFX states (both ON by default for new players)
    _initAudioOwn(this, 'sfxEnabled', true);
    _initAudioOwn(this, 'bgmTrack', 'waltz'); // 'waltz' | 'bossa' | 'off'
    _initAudioOwn(this, 'bgmEnabled', true);
    _initAudioOwn(this, '_bgmWanted', false);
    _initAudioOwn(this, '_lastActiveTrack', 'waltz');

    // Dynamic musical state
    _initAudioOwn(this, 'feverMode', false);
    _initAudioOwn(this, 'muffled', false);
    _initAudioOwn(this, 'dangerLevel', 0); // 0..1
    _initAudioOwn(this, 'tabHidden', false);

    // Scheduler state
    _initAudioOwn(this, '_schedTimer', null);
    _initAudioOwn(this, '_nextNoteTime', 0);
    _initAudioOwn(this, '_stepIndex', 0);
    _initAudioOwn(this, '_cycleCount', 0);
    _initAudioOwn(this, '_isPlayingBGM', false);
    _initAudioOwn(this, '_fadeInDone', false);
    _initAudioOwn(this, '_duckUntil', 0);
    _initAudioOwn(this, '_lastBounceAt', 0);

    // Audio graph nodes (initialized once per AudioContext)
    _initAudioOwn(this, '_graphReady', false);
    _initAudioOwn(this, '_masterComp', null);
    _initAudioOwn(this, '_bgmDryGain', null);
    _initAudioOwn(this, '_bgmToneFilter', null);
    _initAudioOwn(this, '_bgmDuckGain', null);
    _initAudioOwn(this, '_bgmMasterGain', null);
    _initAudioOwn(this, '_reverbSend', null);
    _initAudioOwn(this, '_delaySend', null);
    _initAudioOwn(this, '_sfxBus', null);
    _initAudioOwn(this, '_sfxReverbSend', null);
    _initAudioOwn(this, '_noiseBuffer', null);
    _initAudioOwn(this, '_htmlAudioUnlocked', false);
    _initAudioOwn(this, '_silentAudioEl', null);
    _initAudioOwn(this, '_gainBoostedAtRunning', false);

    // Bright C-major / Lydian pentatonic scale spanning 2+ octaves (Hz) for exhilarating combo climb
    _initAudioOwn(this, 'scale', [
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
    ]);

    // Track metadata & hand-crafted scores
    let tracks = null;
    try {
      tracks = StarlightAudio.prototype._buildTracks.call(this);
    } catch (_) {
      tracks = { waltz: null, bossa: null };
    }
    _initAudioOwn(this, 'TRACKS', tracks);

    if (extCtx) {
      try {
        this._initGraph(extCtx);
      } catch (_) {
        _initAudioOwn(this, '_graphReady', false);
      }
    }
  }

  // Backward-compatible getter for legacy callers
  get muted() {
    return !_canPlaySfx(this);
  }

  _isMutableSelf() {
    return _isMutableAudioSelf(this);
  }

  _safeSetSelf(key, val) {
    return _safeSetAudioProp(this, key, val);
  }

  _toSafeNum(x, fallback = 0) {
    return _toSafeAudioNum(x, fallback);
  }

  _toSafeTier(x, fallback = 1, maxTier = null) {
    let scaleLen = 9;
    try {
      if (_isAudioSelf(this) && _safeIsArray(this.scale) && this.scale.length > 0) {
        scaleLen = this.scale.length;
      }
    } catch (_) {}
    const hi = maxTier !== null && maxTier !== undefined ? maxTier : scaleLen;
    return _toSafeAudioTier(x, fallback, hi);
  }

  _midiToHz(midi) {
    try {
      const m = _toSafeAudioNum(midi, 69);
      return 440 * Math.pow(2, (m - 69) / 12);
    } catch (_) {
      return 440;
    }
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
        label: '圆舞曲',
        title: '星夜圆舞曲',
        stepsPerBar: 6,
        bpmNormal: 114,
        bpmFever: 132,
        bars: waltzBars
      },
      bossa: {
        id: 'bossa',
        label: '吃茶爵士',
        title: '午夜吃茶波萨',
        stepsPerBar: 8,
        bpmNormal: 104,
        bpmFever: 122,
        bars: bossaBars
      }
    };
  }

  ensureCtx() {
    if (!_isAudioSelf(this)) return null;
    try {
      if (!this.ctx) {
        if (!_isMutableAudioSelf(this)) return null;
        try {
          let nextCtx = null;
          if (typeof this._ctxFactory === 'function') {
            nextCtx = this._ctxFactory();
          } else if (typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) nextCtx = new AudioCtx();
          }
          if (_isSafeAudioObj(nextCtx)) {
            _safeSetAudioProp(this, 'ctx', nextCtx);
          }
        } catch (_) {}
        if (!this.ctx) return null;
      }
      if (!this._graphReady && this.ctx) {
        if (!_isMutableAudioSelf(this)) return null;
        this._initGraph(this.ctx);
        if (!this._graphReady) return null;
      }
      const ctxState = _safeCtxState(this.ctx);
      const resumeFn = _getFnProp(this.ctx, 'resume');
      if (
        _isMutableAudioSelf(this) &&
        this.ctx &&
        ctxState &&
        ctxState !== 'running' &&
        !this._externalCtx &&
        resumeFn
      ) {
        try {
          const res = resumeFn.call(this.ctx);
          const thenFn = _getFnProp(res, 'then');
          if (thenFn) {
            const p2 = thenFn.call(res, () => {
              try {
                if (
                  !_isMutableAudioSelf(this) ||
                  !this._bgmWanted ||
                  !this.bgmEnabled ||
                  this.bgmTrack === 'off' ||
                  this.tabHidden
                ) {
                  return;
                }
                if (!this._isPlayingBGM) {
                  this.startBGM();
                } else if (this._bgmMasterGain) {
                  this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.28, false);
                  _safeSetAudioProp(this, '_gainBoostedAtRunning', true);
                }
              } catch (_) {}
            });
            const catchFn = _getFnProp(p2, 'catch');
            if (catchFn) catchFn.call(p2, () => {});
          }
        } catch (_) {}
      }
      return this.ctx;
    } catch (_) {
      return null;
    }
  }

  _unlockMobileAudio(ctx) {
    if (!_isMutableAudioSelf(this) || !_isSafeAudioObj(ctx)) return;
    try {
      if (this._externalCtx) return;
      try {
        if (_getFnProp(ctx, 'createBuffer') && _getFnProp(ctx, 'createBufferSource')) {
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
            _safeSetAudioProp(this, '_silentAudioEl', el);
          }
          if (this._silentAudioEl) {
            const p = this._silentAudioEl.play();
            const thenFn = _getFnProp(p, 'then');
            if (thenFn) {
              const p2 = thenFn.call(p, () => {
                _safeSetAudioProp(this, '_htmlAudioUnlocked', true);
              });
              const catchFn = _getFnProp(p2, 'catch');
              if (catchFn) catchFn.call(p2, () => {});
            } else {
              _safeSetAudioProp(this, '_htmlAudioUnlocked', true);
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  /**
   * Call on user gesture (touchend/click/keydown) to unlock Web Audio & smoothly start BGM if enabled.
   */
  unlock() {
    if (!_isMutableAudioSelf(this)) return;
    try {
      if (this.bgmEnabled && this.bgmTrack !== 'off' && !this.tabHidden) {
        _safeSetAudioProp(this, '_bgmWanted', true);
      }
      const ctx = this.ensureCtx();
      if (!ctx) return;
      this._unlockMobileAudio(ctx);
      if (this._bgmWanted && this.bgmEnabled && this.bgmTrack !== 'off' && !this.tabHidden) {
        const ctxState = _safeCtxState(ctx);
        if (!ctxState || ctxState === 'running') {
          if (!this._isPlayingBGM) {
            this.startBGM();
          } else if (this._bgmMasterGain && this._bgmMasterGain.gain.value < 0.01) {
            this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.25, false);
            _safeSetAudioProp(this, '_gainBoostedAtRunning', true);
          }
        }
      }
    } catch (_) {}
  }

  _initGraph(ctx) {
    if (!_isMutableAudioSelf(this) || !_isSafeAudioObj(ctx)) return;
    try {
      if (this._graphReady) return;
      _safeSetAudioProp(this, '_graphReady', true);

      // 1. Gentle glue compressor (with GainNode fallback if createDynamicsCompressor unavailable)
      let comp = null;
      if (_getFnProp(ctx, 'createDynamicsCompressor')) {
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
      _safeSetAudioProp(this, '_masterComp', comp);

      // 2. BGM Master Chain: Dry + Reverb + Shimmer Delay -> Warm Tone Filter -> Duck Gain -> Master Gain -> Comp
      const bgmMaster = ctx.createGain();
      bgmMaster.gain.value = 0.0001;
      bgmMaster.connect(comp);
      _safeSetAudioProp(this, '_bgmMasterGain', bgmMaster);

      const bgmDuck = ctx.createGain();
      bgmDuck.gain.value = 1.0;
      bgmDuck.connect(bgmMaster);
      _safeSetAudioProp(this, '_bgmDuckGain', bgmDuck);

      let toneFilter = null;
      if (_getFnProp(ctx, 'createBiquadFilter')) {
        toneFilter = ctx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = this.muffled ? 580 : 12500;
        toneFilter.Q.value = -3.0;
      } else {
        toneFilter = ctx.createGain();
        toneFilter.gain.value = 1.0;
        toneFilter.frequency = { value: this.muffled ? 580 : 12500 };
      }
      toneFilter.connect(bgmDuck);
      _safeSetAudioProp(this, '_bgmToneFilter', toneFilter);

      const bgmDry = ctx.createGain();
      bgmDry.gain.value = 0.86;
      bgmDry.connect(toneFilter);
      _safeSetAudioProp(this, '_bgmDryGain', bgmDry);

      // 3. Algorithmic Warm Wooden Café Reverb (Convolver on Web, Multi-Tap Delay Room on WeChat WebAudio)
      const reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.32;
      let reverbEntry = null;
      if (
        _getFnProp(ctx, 'createConvolver') &&
        _getFnProp(ctx, 'createBuffer') &&
        _getFnProp(ctx, 'createBiquadFilter')
      ) {
        const convolver = ctx.createConvolver();
        convolver.buffer = this._createCafeReverbIR(ctx, 1.65);
        const reverbLP = ctx.createBiquadFilter();
        reverbLP.type = 'lowpass';
        reverbLP.frequency.value = 3200;
        reverbSend.connect(convolver);
        convolver.connect(reverbLP);
        reverbLP.connect(toneFilter);
        reverbEntry = convolver;
      } else if (
        _getFnProp(ctx, 'createDelay') &&
        _getFnProp(ctx, 'createBiquadFilter')
      ) {
        // Pure Delay + Filter warm Schroeder wooden café room fallback (100% WeChat Mini Game supported)
        const revIn = ctx.createGain();
        revIn.gain.value = 0.65;
        const revLP = ctx.createBiquadFilter();
        revLP.type = 'lowpass';
        revLP.frequency.value = 2600;
        const taps = [0.029, 0.047, 0.071];
        for (let idx = 0; idx < taps.length; idx++) {
          const sec = taps[idx];
          const dl = ctx.createDelay(0.5);
          dl.delayTime.value = sec;
          const fb = ctx.createGain();
          fb.gain.value = 0.34 - idx * 0.04;
          revIn.connect(dl);
          dl.connect(fb);
          fb.connect(revLP);
          dl.connect(revLP);
        }
        reverbSend.connect(revIn);
        revLP.connect(toneFilter);
        reverbEntry = revIn;
      }
      _safeSetAudioProp(this, '_reverbSend', reverbSend);

      // 4. Subtle Warm Stereo Ping-Pong Shimmer Delay for celesta & harp sparkle
      const delaySend = ctx.createGain();
      delaySend.gain.value = 0.16;
      if (
        _getFnProp(ctx, 'createDelay') &&
        _getFnProp(ctx, 'createBiquadFilter')
      ) {
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

        if (_getFnProp(ctx, 'createStereoPanner')) {
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
      }
      _safeSetAudioProp(this, '_delaySend', delaySend);

      // 5. SFX Bus (clear headroom above BGM + subtle room cohesion)
      const sfxBus = ctx.createGain();
      sfxBus.gain.value = 1.0;
      sfxBus.connect(comp);
      _safeSetAudioProp(this, '_sfxBus', sfxBus);

      const sfxRev = ctx.createGain();
      sfxRev.gain.value = 0.11;
      sfxBus.connect(sfxRev);
      if (reverbEntry) sfxRev.connect(reverbEntry);
      _safeSetAudioProp(this, '_sfxReverbSend', sfxRev);

      // 6. Reusable noise buffer for jazz brushes, wood rim, flute breath, and shaker
      const noiseBuf =
        _getFnProp(ctx, 'createBuffer') && Number.isFinite(ctx.sampleRate) && ctx.sampleRate > 0
          ? this._createNoiseBuffer(ctx, 1.0)
          : null;
      _safeSetAudioProp(this, '_noiseBuffer', noiseBuf);
    } catch (_) {
      _safeSetAudioProp(this, '_graphReady', false);
    }
  }

  _createCafeReverbIR(ctx, durationSec) {
    if (!_isAudioSelf(this) || !_isSafeAudioObj(ctx)) return null;
    try {
      const rate = _toSafeAudioNum(ctx.sampleRate, 0);
      const dur = _toSafeAudioNum(durationSec, 1.65);
      if (!(rate > 0) || !(dur > 0) || !_getFnProp(ctx, 'createBuffer')) return null;
      const length = Math.max(1, Math.floor(rate * dur));
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
    } catch (_) {
      return null;
    }
  }

  _createNoiseBuffer(ctx, durationSec) {
    if (!_isAudioSelf(this) || !_isSafeAudioObj(ctx)) return null;
    try {
      const rate = _toSafeAudioNum(ctx.sampleRate, 0);
      const dur = _toSafeAudioNum(durationSec, 1.0);
      if (!(rate > 0) || !(dur > 0) || !_getFnProp(ctx, 'createBuffer')) return null;
      const length = Math.max(1, Math.floor(rate * dur));
      const buf = ctx.createBuffer(1, length, rate);
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
    } catch (_) {
      return null;
    }
  }

  _targetBGMGain() {
    if (!_isAudioSelf(this)) return 0.0001;
    try {
      if (!this.bgmEnabled || this.tabHidden) return 0.0001;
      const base = this.feverMode ? 1.05 : 0.94;
      return this.muffled ? base * 0.76 : base;
    } catch (_) {
      return 0.0001;
    }
  }

  _rampParam(param, target, timeSec = 0.35, exponential = true) {
    if (!_isAudioSelf(this) || !_isSafeAudioObj(param)) return;
    try {
      if (!this.ctx) return;
      const now = _toSafeAudioNum(this.ctx.currentTime, 0);
      const safeTgtNum = _toSafeAudioNum(target, 0.0001);
      const safeTime = Math.max(0.02, _toSafeAudioNum(timeSec, 0.35));
      const curVal = _toSafeAudioNum(param.value, 0.0001);
      const safeCur = exponential ? Math.max(0.0001, curVal) : curVal;
      const safeTarget = exponential ? Math.max(0.0001, safeTgtNum) : safeTgtNum;
      param.cancelScheduledValues(now);
      param.setValueAtTime(safeCur, now);
      if (exponential) {
        param.exponentialRampToValueAtTime(safeTarget, now + safeTime);
      } else {
        param.linearRampToValueAtTime(safeTarget, now + safeTime);
      }
    } catch (_) {}
  }

  _duckBGM(factor = 0.64, holdSec = 0.55, releaseSec = 0.7) {
    if (!_isAudioSelf(this)) return;
    try {
      if (!this.ctx || !this._bgmDuckGain || !this.bgmEnabled) return;
      const now = _toSafeAudioNum(this.ctx.currentTime, 0);
      const safeFactor = Math.max(0.15, _toSafeAudioNum(factor, 0.64));
      const safeHold = Math.max(0, _toSafeAudioNum(holdSec, 0.55));
      const safeRelease = Math.max(0.02, _toSafeAudioNum(releaseSec, 0.7));
      const cur = Math.max(0.05, _toSafeAudioNum(this._bgmDuckGain.gain.value, 1.0));
      this._bgmDuckGain.gain.cancelScheduledValues(now);
      this._bgmDuckGain.gain.setValueAtTime(cur, now);
      this._bgmDuckGain.gain.exponentialRampToValueAtTime(safeFactor, now + 0.08);
      this._bgmDuckGain.gain.setValueAtTime(safeFactor, now + 0.08 + safeHold);
      this._bgmDuckGain.gain.exponentialRampToValueAtTime(1.0, now + 0.08 + safeHold + safeRelease);
    } catch (_) {}
  }

  // ==================== Public State Controls ====================

  setSfxEnabled(enabled) {
    if (!_isMutableAudioSelf(this)) return;
    _safeSetAudioProp(this, 'sfxEnabled', Boolean(enabled));
  }

  // Legacy alias: toggles SFX only (never kills BGM unexpectedly)
  setMuted(mute) {
    if (!_isMutableAudioSelf(this)) return;
    _safeSetAudioProp(this, 'sfxEnabled', !Boolean(mute));
  }

  setBGMTrack(trackId) {
    let normTrack = '';
    try {
      normTrack = typeof trackId === 'string' ? trackId.trim().toLowerCase() : '';
    } catch (_) {
      normTrack = '';
    }
    const valid =
      normTrack === 'waltz' || normTrack === 'bossa' || normTrack === 'off' ? normTrack : 'waltz';

    if (!_isAudioSelf(this)) {
      if (normTrack === 'off') _clearTrackedTimerOnlyMap(this);
      return 'waltz';
    }
    if (!_isMutableAudioSelf(this)) {
      if (normTrack === 'off') {
        _clearTrackedTimer(this);
        try {
          if (this.ctx && this._bgmMasterGain) {
            this._rampParam(this._bgmMasterGain.gain, 0.0001, 0.28, true);
          }
        } catch (_) {}
      }
      try {
        return typeof this.bgmTrack === 'string' ? this.bgmTrack : 'waltz';
      } catch (_) {
        return 'waltz';
      }
    }

    try {
      const prevTrack = this.bgmTrack;
      _safeSetAudioProp(this, 'bgmTrack', valid);
      _safeSetAudioProp(this, 'bgmEnabled', valid !== 'off');

      if (valid === 'off' || !this.bgmEnabled) {
        _safeSetAudioProp(this, '_bgmWanted', false);
        this.stopBGM(true);
        return this.bgmTrack;
      }

      _safeSetAudioProp(this, '_bgmWanted', true);
      const ctx = this.ensureCtx();
      if (prevTrack !== valid) {
        _safeSetAudioProp(this, '_stepIndex', 0);
        _safeSetAudioProp(this, '_cycleCount', 0);
      }
      if (ctx && !this.tabHidden) {
        const ctxState = _safeCtxState(ctx);
        if (this._isPlayingBGM && prevTrack !== valid) {
          // Cross-fade seamlessly into the newly chosen track
          _safeSetAudioProp(this, '_nextNoteTime', ctx.currentTime + 0.08);
          if (this._bgmMasterGain) {
            this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.45, true);
          }
        } else if (!ctxState || ctxState === 'running' || this._externalCtx) {
          this.startBGM();
        }
      }
      return this.bgmTrack;
    } catch (_) {
      if (valid === 'off') _clearTrackedTimer(this);
      return 'waltz';
    }
  }

  /**
   * Cycles background music cleanly: waltz -> bossa -> off -> waltz
   */
  cycleBGMTrack() {
    if (!_isAudioSelf(this)) {
      _clearTrackedTimerOnlyMap(this);
      return 'waltz';
    }
    try {
      let curTrack = 'waltz';
      let trackReadFailed = false;
      try {
        curTrack = typeof this.bgmTrack === 'string' ? this.bgmTrack : 'waltz';
      } catch (_) {
        trackReadFailed = true;
      }
      const order = ['waltz', 'bossa', 'off'];
      const idx = order.indexOf(curTrack);
      const next = order[(idx + 1) % order.length];
      if (!_isMutableAudioSelf(this)) {
        if (next === 'off' || trackReadFailed) {
          _clearTrackedTimer(this);
        }
        return curTrack;
      }
      return this.setBGMTrack(next);
    } catch (_) {
      return 'waltz';
    }
  }

  /**
   * Quick toggle on/off (preserves last active track or defaults to waltz)
   */
  toggleBGM() {
    if (!_isAudioSelf(this)) {
      _clearTrackedTimerOnlyMap(this);
      return false;
    }
    if (!_isMutableAudioSelf(this)) {
      let curEnabled = false;
      let readFailed = false;
      try {
        curEnabled = Boolean(_audioGetOwn(this, 'bgmEnabled', false));
      } catch (_) {
        readFailed = true;
      }
      let hasTracked = false;
      if (_ACTIVE_TIMERS) {
        try {
          hasTracked = _ACTIVE_TIMERS.has(this);
        } catch (_) {}
      }
      if (curEnabled || readFailed || hasTracked) {
        _clearTrackedTimer(this);
        try {
          if (this.ctx && this._bgmMasterGain) {
            this._rampParam(this._bgmMasterGain.gain, 0.0001, 0.28, true);
          }
        } catch (_) {}
      }
      return curEnabled;
    }
    try {
      if (this.bgmEnabled) {
        _safeSetAudioProp(this, '_lastActiveTrack', this.bgmTrack);
        this.setBGMTrack('off');
        return false;
      }
      this.setBGMTrack(this._lastActiveTrack || 'waltz');
      return true;
    } catch (_) {
      _clearTrackedTimer(this);
      return false;
    }
  }

  getTrackInfo() {
    if (!_isAudioSelf(this)) {
      return { id: 'off', label: '音乐: 关', title: '已关闭' };
    }
    try {
      if (!this.bgmEnabled || this.bgmTrack === 'off') {
        return { id: 'off', label: '音乐: 关', title: '已关闭' };
      }
      const t =
        this.TRACKS && _audioHasOwn(this.TRACKS, this.bgmTrack)
          ? this.TRACKS[this.bgmTrack]
          : this.TRACKS && _audioHasOwn(this.TRACKS, 'waltz') && this.TRACKS.waltz
          ? this.TRACKS.waltz
          : { id: 'waltz', label: '圆舞曲', title: '星夜圆舞曲' };
      return { id: t.id, label: t.label, title: t.title };
    } catch (_) {
      return { id: 'off', label: '音乐: 关', title: '已关闭' };
    }
  }

  setFeverMode(active) {
    if (!_isMutableAudioSelf(this)) return;
    try {
      const next = Boolean(active);
      if (this.feverMode === next) return;
      _safeSetAudioProp(this, 'feverMode', next);
      if (this.ctx && this._bgmMasterGain && this.bgmEnabled && !this.tabHidden) {
        this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.45, true);
      }
    } catch (_) {}
  }

  setMuffled(muffled) {
    if (!_isMutableAudioSelf(this)) return;
    try {
      const next = Boolean(muffled);
      if (this.muffled === next) return;
      _safeSetAudioProp(this, 'muffled', next);
      if (this.ctx && this._bgmToneFilter && this._bgmMasterGain) {
        this._rampParam(this._bgmToneFilter.frequency, next ? 580 : 12500, 0.42, true);
        if (this.bgmEnabled && !this.tabHidden) {
          this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.42, true);
        }
      }
    } catch (_) {}
  }

  setDangerLevel(level) {
    if (!_isMutableAudioSelf(this)) return;
    try {
      _safeSetAudioProp(this, 'dangerLevel', Math.max(0, Math.min(1, _toSafeAudioNum(level, 0))));
    } catch (_) {}
  }

  setTabHidden(hidden) {
    const next = Boolean(hidden);
    if (!_isAudioSelf(this)) {
      if (next) _clearTrackedTimerOnlyMap(this);
      return;
    }
    if (!_isMutableAudioSelf(this)) {
      if (next) {
        _clearTrackedTimer(this);
        try {
          if (this._bgmMasterGain && this.ctx) {
            this._rampParam(this._bgmMasterGain.gain, 0.0001, 0.15, true);
          }
        } catch (_) {}
      }
      return;
    }
    try {
      if (this.tabHidden === next) {
        if (next) {
          _clearTrackedTimer(this);
          _safeSetAudioProp(this, '_schedTimer', null);
        }
        return;
      }
      _safeSetAudioProp(this, 'tabHidden', next);
      if (next) {
        if (this._bgmMasterGain && this.ctx) {
          this._rampParam(this._bgmMasterGain.gain, 0.0001, 0.15, true);
        }
        _clearTrackedTimer(this);
        _safeSetAudioProp(this, '_schedTimer', null);
        _safeSetAudioProp(this, '_isPlayingBGM', false);
      } else if (
        this._bgmWanted &&
        this.bgmEnabled &&
        this.bgmTrack !== 'off' &&
        this.ctx &&
        _safeCtxState(this.ctx) === 'running'
      ) {
        this.startBGM();
      }
    } catch (_) {
      if (next) {
        _clearTrackedTimer(this);
      }
    }
  }

  // ==================== Lookahead Music Scheduler ====================

  startBGM() {
    if (!_isMutableAudioSelf(this)) return;
    let createdTimer = null;
    try {
      if (!this.bgmEnabled || this.bgmTrack === 'off') {
        _safeSetAudioProp(this, '_bgmWanted', false);
        return;
      }
      _safeSetAudioProp(this, '_bgmWanted', true);
      if (this.tabHidden) return;
      const ctx = this.ensureCtx();
      if (!ctx || !_isMutableAudioSelf(this)) return;
      _clearTrackedTimer(this);
      _safeSetAudioProp(this, '_schedTimer', null);

      const ctxState = _safeCtxState(ctx);
      _safeSetAudioProp(this, '_isPlayingBGM', true);
      _safeSetAudioProp(this, '_nextNoteTime', ctx.currentTime + 0.08);
      _safeSetAudioProp(this, '_gainBoostedAtRunning', ctxState === 'running');

      // Smooth cozy fade-in so music blooms gently (linear ramp avoids mobile WebView exponential underflow)
      if (this._bgmMasterGain) {
        this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), this._fadeInDone ? 0.35 : 0.75, false);
      }
      if (this._bgmToneFilter) {
        this._rampParam(this._bgmToneFilter.frequency, this.muffled ? 580 : 12500, 0.35, true);
      }
      _safeSetAudioProp(this, '_fadeInDone', true);

      const timer = setInterval(() => {
        try {
          if (!_isMutableAudioSelf(this) || this._schedTimer !== timer) {
            clearInterval(timer);
            if (_ACTIVE_TIMERS) {
              try {
                if (_ACTIVE_TIMERS.get(this) === timer) _ACTIVE_TIMERS.delete(this);
              } catch (_2) {}
            }
            return;
          }
          this._schedulerTick();
        } catch (_) {
          try {
            clearInterval(timer);
          } catch (_2) {}
          if (_ACTIVE_TIMERS) {
            try {
              if (_ACTIVE_TIMERS.get(this) === timer) _ACTIVE_TIMERS.delete(this);
            } catch (_3) {}
          }
        }
      }, 35);
      createdTimer = timer;
      if (!_safeSetAudioProp(this, '_schedTimer', timer)) {
        clearInterval(timer);
        return;
      }
      let storedOk = false;
      try {
        storedOk = this._schedTimer === timer;
      } catch (_) {
        storedOk = false;
      }
      if (!storedOk) {
        clearInterval(timer);
        _clearTrackedTimer(this);
        return;
      }
      _recordActiveTimer(this, timer);
      this._schedulerTick();
    } catch (_) {
      if (createdTimer !== null) {
        try {
          clearInterval(createdTimer);
        } catch (_2) {}
        _clearTrackedTimerOnlyMap(this);
      }
    }
  }

  stopBGM(fade = true) {
    _clearTrackedTimerOnlyMap(this);
    if (!_isAudioSelf(this)) return;
    _clearTrackedTimer(this);
    if (_isMutableAudioSelf(this)) {
      _safeSetAudioProp(this, '_schedTimer', null);
      _safeSetAudioProp(this, '_bgmWanted', false);
      _safeSetAudioProp(this, '_isPlayingBGM', false);
      _safeSetAudioProp(this, '_gainBoostedAtRunning', false);
    }
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
    if (!_isAudioSelf(this) || !_isSafeAudioObj(track)) return 60 / 114 / 2;
    try {
      const baseBpm = _toSafeAudioNum(this.feverMode ? track.bpmFever : track.bpmNormal, 114);
      let bpm = baseBpm > 0 ? baseBpm : 114;
      const dl = _toSafeAudioNum(this.dangerLevel, 0);
      if (dl > 0.25) {
        const lift = this.feverMode ? 0.055 : 0.095;
        bpm *= 1 + (dl - 0.25) * lift;
      }
      // 1 step = 1 eighth note (half a quarter-note beat)
      return 60 / bpm / 2;
    } catch (_) {
      return 60 / 114 / 2;
    }
  }

  _schedulerTick() {
    if (!_isAudioSelf(this)) {
      _clearTrackedTimerOnlyMap(this);
      return;
    }
    if (!_isMutableAudioSelf(this)) {
      _clearTrackedTimer(this);
      return;
    }
    if (_ACTIVE_TIMERS) {
      let tracked = null;
      try {
        tracked = _ACTIVE_TIMERS.get(this) || null;
      } catch (_) {
        tracked = null;
      }
      if (tracked) {
        let curTimer = null;
        let timerReadOk = false;
        try {
          curTimer = this._schedTimer;
          timerReadOk = true;
        } catch (_) {
          timerReadOk = false;
        }
        if (!timerReadOk || curTimer !== tracked) {
          _clearTrackedTimer(this);
          return;
        }
      }
    }
    try {
      if (!this.bgmEnabled || this.bgmTrack === 'off' || this.tabHidden || !this.ctx) {
        _clearTrackedTimer(this);
        _safeSetAudioProp(this, '_schedTimer', null);
        return;
      }
      const ctxState = _safeCtxState(this.ctx);
      if (!this._externalCtx && ctxState && ctxState !== 'running') return;

      if (
        !this._externalCtx &&
        this._bgmMasterGain &&
        (!this._gainBoostedAtRunning || this._bgmMasterGain.gain.value < 0.01)
      ) {
        _safeSetAudioProp(this, '_gainBoostedAtRunning', true);
        this._rampParam(this._bgmMasterGain.gain, this._targetBGMGain(), 0.28, false);
      }

      const track = _audioHasOwn(this.TRACKS, this.bgmTrack)
        ? this.TRACKS[this.bgmTrack]
        : this.TRACKS.waltz;
      if (!_isSafeAudioObj(track)) return;
      const now = this.ctx.currentTime;
      const lookahead = 0.14; // Schedule 140ms ahead on exact Web Audio clock

      // Recover cleanly if browser throttled background timers (prevent note bursts!)
      if (this._nextNoteTime < now - 0.25) {
        _safeSetAudioProp(this, '_nextNoteTime', now + 0.06);
      }

      let guard = 0;
      while (this._nextNoteTime < now + lookahead && guard < 12) {
        this._scheduleTrackStep(track, this._stepIndex, this._nextNoteTime);
        const stepSec = this._currentStepDurationSec(track);
        _safeSetAudioProp(this, '_nextNoteTime', this._nextNoteTime + stepSec);
        let nextStep = this._stepIndex + 1;
        const totalSteps = track.bars.length * track.stepsPerBar;
        if (nextStep >= totalSteps) {
          nextStep = 0;
          _safeSetAudioProp(this, '_cycleCount', this._cycleCount + 1);
        }
        _safeSetAudioProp(this, '_stepIndex', nextStep);
        guard++;
      }
    } catch (_) {}
  }

  /**
   * Offline rendering helper for automated QA / spectral analysis (renders exact track on an OfflineAudioContext)
   */
  renderOfflineSchedule(durationSec, options = {}) {
    if (!_isAudioSelf(this)) return [];
    try {
      if (
        !_isSafeAudioObj(this.ctx) ||
        !_getFnProp(this.ctx, 'createGain') ||
        !_getFnProp(this.ctx, 'createOscillator')
      ) {
        return [];
      }
      const safeDur = Math.max(0, Math.min(120, _toSafeAudioNum(durationSec, 0)));
      const safeOpts = _isSafeAudioObj(options) ? options : {};
      const optTrack = _audioGetOwn(safeOpts, 'track', undefined);
      if (optTrack === 'waltz' || optTrack === 'bossa' || optTrack === 'off') {
        _safeSetAudioProp(this, 'bgmTrack', optTrack);
      }
      _safeSetAudioProp(this, 'bgmEnabled', this.bgmTrack !== 'off');
      const optFever = _audioGetOwn(safeOpts, 'fever', undefined);
      if (typeof optFever === 'boolean') {
        _safeSetAudioProp(this, 'feverMode', optFever);
      }
      const optMuffled = _audioGetOwn(safeOpts, 'muffled', undefined);
      if (typeof optMuffled === 'boolean') {
        _safeSetAudioProp(this, 'muffled', optMuffled);
      }

      if (!this._graphReady) {
        if (!_isMutableAudioSelf(this)) return [];
        this._initGraph(this.ctx);
        if (!this._graphReady) return [];
      }

      const tgtGain = this._targetBGMGain();
      if (this._bgmMasterGain && this._bgmMasterGain.gain) {
        if (_getFnProp(this._bgmMasterGain.gain, 'setValueAtTime')) {
          this._bgmMasterGain.gain.setValueAtTime(tgtGain, 0);
        } else {
          try {
            this._bgmMasterGain.gain.value = tgtGain;
          } catch (_) {}
        }
      }

      const tgtHz = this.muffled ? 580 : 12500;
      if (this._bgmToneFilter && this._bgmToneFilter.frequency) {
        if (_getFnProp(this._bgmToneFilter.frequency, 'setValueAtTime')) {
          this._bgmToneFilter.frequency.setValueAtTime(tgtHz, 0);
        } else {
          try {
            this._bgmToneFilter.frequency.value = tgtHz;
          } catch (_) {}
        }
      }

      if (!this.bgmEnabled || this.bgmTrack === 'off') {
        return [];
      }

      const track = _audioHasOwn(this.TRACKS, this.bgmTrack)
        ? this.TRACKS[this.bgmTrack]
        : this.TRACKS.waltz;
      if (!_isSafeAudioObj(track)) return [];
      let t = 0.05;
      let step = 0;
      const totalSteps = track.bars.length * track.stepsPerBar;
      _safeSetAudioProp(this, '_cycleCount', 0);
      const scheduled = [];

      while (t < safeDur - 0.1) {
        this._scheduleTrackStep(track, step, t);
        _audioSafePush(scheduled, t);
        t += this._currentStepDurationSec(track);
        step++;
        if (step >= totalSteps) {
          step = 0;
          _safeSetAudioProp(this, '_cycleCount', (this._cycleCount || 0) + 1);
        }
      }
      return scheduled;
    } catch (_) {
      return [];
    }
  }

  _scheduleTrackStep(track, globalStep, time) {
    if (!_isAudioSelf(this) || !_isSafeAudioObj(track)) return;
    try {
      const spb = track.stepsPerBar;
      if (!(spb > 0) || !_safeIsArray(track.bars) || track.bars.length === 0) return;
      const barIdx = Math.floor(globalStep / spb) % track.bars.length;
      const stepInBar = globalStep % spb;
      const bar = track.bars[barIdx];
      if (!_isSafeAudioObj(bar)) return;
      const stepSec = this._currentStepDurationSec(track);

      if (track.id === 'waltz') {
        this._scheduleWaltzStep(bar, barIdx, stepInBar, time, stepSec);
      } else {
        this._scheduleBossaStep(bar, barIdx, stepInBar, time, stepSec);
      }
    } catch (_) {}
  }

  _scheduleWaltzStep(bar, barIdx, s, time, stepSec) {
    if (!_isAudioSelf(this) || !_isSafeAudioObj(bar)) return;
    try {
      const fever = this.feverMode;
      const beatSec = stepSec * 2;
      const secondCycle = this._cycleCount % 2 === 1;
      const bass2 = _audioGetOwn(bar, 'bass2', 0);

      // 1. Warm Upright Bass (oom on beat 1; optional turn bass2 on beat 3)
      if (s === 0) {
        this._playBass(time, bar.bass, beatSec * 1.45, fever ? 0.34 : 0.30);
        this._playKick(time, fever ? 0.16 : 0.11);
      } else if (s === 4 && bass2) {
        this._playBass(time, bass2, beatSec * 0.95, 0.24);
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
      const mel = _safeIsArray(bar.mel) && s >= 0 && s < bar.mel.length ? bar.mel[s] : null;
      if (_safeIsArray(mel) && mel.length >= 2) {
        const midi = mel[0];
        const durSteps = mel[1];
        const velOverride = mel.length > 2 ? mel[2] : undefined;
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
    } catch (_) {}
  }

  _scheduleBossaStep(bar, barIdx, s, time, stepSec) {
    if (!_isAudioSelf(this) || !_isSafeAudioObj(bar)) return;
    try {
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
      const mel = _safeIsArray(bar.mel) && s >= 0 && s < bar.mel.length ? bar.mel[s] : null;
      if (_safeIsArray(mel) && mel.length >= 2) {
        const midi = mel[0];
        const durSteps = mel[1];
        const velOverride = mel.length > 2 ? mel[2] : undefined;
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
    } catch (_) {}
  }

  // ==================== Cozy Acoustic-Inspired Synth Voices ====================

  _createBgmFilter(type, freq, time, qVal = null, endFreq = null, endTime = null) {
    if (!_isAudioSelf(this)) return null;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return null;
      if (_getFnProp(ctx, 'createBiquadFilter')) {
        const flt = ctx.createBiquadFilter();
        flt.type = type;
        flt.frequency.setValueAtTime(freq, time);
        if (endFreq !== null && endTime !== null) {
          flt.frequency.exponentialRampToValueAtTime(endFreq, endTime);
        }
        if (qVal !== null && flt.Q) {
          flt.Q.value = qVal;
        }
        return flt;
      }
      const bypass = ctx.createGain();
      bypass.gain.value = 1.0;
      return bypass;
    } catch (_) {
      return null;
    }
  }

  _connectToBGM(node, panVal = 0, reverbAmt = 0.28, delayAmt = 0.0) {
    if (!_isAudioSelf(this) || !_isSafeAudioObj(node)) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx) || !this._bgmDryGain) return;
      let out = node;
      if (panVal !== 0 && _getFnProp(ctx, 'createStereoPanner')) {
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
    } catch (_) {}
  }

  /**
   * 1. Starlight Celesta / Music Box Bell — crystal-warm storybook patisserie melody
   */
  _playCelesta(time, midi, dur, vel = 0.22, pan = 0) {
    if (!_isAudioSelf(this)) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return;
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
    } catch (_) {}
  }

  /**
   * 2. Warm Felt Café Piano / Rhodes Chord — gently rolled like a real pianist's hand
   */
  _playRhodes(time, midiNotes, dur, vel = 0.15, spreadSec = 0.015, pan = 0) {
    if (!_isAudioSelf(this) || !_safeIsArray(midiNotes) || midiNotes.length === 0) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return;
      const perNoteVel = vel / Math.sqrt(Math.max(1, midiNotes.length));

      const chordFilter = this._createBgmFilter('lowpass', 2100, time, 0.5, 760, time + Math.min(dur, 0.55));
      if (!chordFilter) return;
      this._connectToBGM(chordFilter, pan, 0.34, 0.0);

      for (let i = 0; i < midiNotes.length; i++) {
        const midi = midiNotes[i];
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
      }
    } catch (_) {}
  }

  /**
   * 3. Cozy Upright Pizzicato Bass — woody, round, tight low-end foundation
   */
  _playBass(time, midi, dur, vel = 0.28) {
    if (!_isAudioSelf(this)) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return;
      const freq = this._midiToHz(midi);

      const lp = this._createBgmFilter('lowpass', 680, time, 0.9, 220, time + Math.min(0.28, dur));
      if (!lp) return;
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
    } catch (_) {}
  }

  /**
   * 4. Velvety Café Flute / Soft Vibraphone — warm singing lead with gentle delayed vibrato
   */
  _playFluteVibe(time, midi, dur, vel = 0.22, pan = 0) {
    if (!_isAudioSelf(this)) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return;
      const freq = this._midiToHz(midi);

      const lp = this._createBgmFilter('lowpass', 2400, time, 0.5);
      if (!lp) return;
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
    } catch (_) {}
  }

  /**
   * 5. Starlight Harp Sparkle — twinkling stereo counter-arpeggio
   */
  _playHarp(time, midi, dur, vel = 0.09, pan = 0) {
    if (!_isAudioSelf(this)) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return;
      const freq = this._midiToHz(midi);

      const lp = this._createBgmFilter('lowpass', 4600, time, null, 1400, time + Math.min(dur, 0.45));
      if (!lp) return;
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
    } catch (_) {}
  }

  /**
   * 6. Warm Nocturnal String Pad — soft velvety bloom in Chorus/Section B
   */
  _playPad(time, midiNotes, dur, vel = 0.05) {
    if (!_isAudioSelf(this) || !_safeIsArray(midiNotes) || midiNotes.length === 0) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return;
      const lp = this._createBgmFilter('lowpass', 1250, time, 0.5);
      if (!lp) return;
      this._connectToBGM(lp, 0, 0.55, 0.0);

      const perVel = vel / Math.max(1, midiNotes.length);
      for (let idx = 0; idx < midiNotes.length; idx++) {
        const midi = midiNotes[idx];
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
      }
    } catch (_) {}
  }

  /**
   * 7. Acoustic Café Percussion (Jazz Brush, Felt Kick, Wood Rim, Starlight Shaker)
   */
  _playBrush(time, vel = 0.075, dur = 0.09) {
    if (!_isAudioSelf(this)) return;
    try {
      if (!this._noiseBuffer) return;
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx) || !_getFnProp(ctx, 'createBufferSource')) return;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer;

      const bp = this._createBgmFilter('bandpass', 2900, time, 1.1);
      if (!bp) return;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(vel, time + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      src.connect(bp);
      bp.connect(g);
      this._connectToBGM(g, 0.12, 0.16, 0.0);
      src.start(time, (time * 3.7) % 0.6, dur + 0.02);
    } catch (_) {}
  }

  _playShaker(time, vel = 0.04) {
    if (!_isAudioSelf(this)) return;
    try {
      if (!this._noiseBuffer) return;
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx) || !_getFnProp(ctx, 'createBufferSource')) return;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer;

      const hp = this._createBgmFilter('highpass', 5800, time);
      if (!hp) return;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(vel, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);

      src.connect(hp);
      hp.connect(g);
      this._connectToBGM(g, -0.22, 0.12, 0.0);
      src.start(time, (time * 5.3) % 0.6, 0.05);
    } catch (_) {}
  }

  _playRim(time, vel = 0.06) {
    if (!_isAudioSelf(this)) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return;
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
    } catch (_) {}
  }

  _playKick(time, vel = 0.12) {
    if (!_isAudioSelf(this)) return;
    try {
      const ctx = this.ctx;
      if (!_isSafeAudioObj(ctx)) return;
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
    } catch (_) {}
  }

  // ==================== Tactile Game SFX (C-Major Harmonized) ====================

  _playTone(freq, type, gainPeak, duration, attack = 0.01, endFreq = null, delaySec = 0) {
    if (!_canPlaySfx(this)) return;
    try {
      const f = _toSafeAudioNum(freq, NaN);
      if (!(f > 0) || !Number.isFinite(f)) return;
      const peak = Math.max(0.0002, _toSafeAudioNum(gainPeak, 0.1));
      const dur = Math.max(0.005, _toSafeAudioNum(duration, 0.1));
      const atk = Math.max(0.001, Math.min(dur, _toSafeAudioNum(attack, 0.01)));
      const delay = Math.max(0, _toSafeAudioNum(delaySec, 0));
      const hasEnd = endFreq !== null && endFreq !== undefined;
      const ef = hasEnd ? _toSafeAudioNum(endFreq, NaN) : NaN;

      const ctx = this.ensureCtx();
      if (!ctx) return;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = typeof type === 'string' ? type : 'sine';
      osc.frequency.setValueAtTime(f, t);
      if (Number.isFinite(ef) && ef > 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, ef), t + dur);
      }

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + atk);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain);
      gain.connect(this._sfxBus || ctx.destination);
      this._attachAutoDisconnect(osc, [osc, gain]);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (_) {}
  }

  /**
   * Warm café brass door-bell welcome chime when opening the patisserie
   */
  playStartCafe() {
    if (!_canPlaySfx(this)) return;
    try {
      const notes = [659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((f, i) => {
        this._playTone(f, 'sine', 0.085, 0.42, 0.008, null, i * 0.068);
      });
    } catch (_) {}
  }

  playDrop(isWildcard = false, isGolden = false) {
    if (!_canPlaySfx(this)) return;
    try {
      if (Boolean(isWildcard)) {
        this._playTone(587.33, 'sine', 0.11, 0.14, 0.006, 880, 0);
        this._playTone(1174.66, 'triangle', 0.09, 0.18, 0.006, 1567.98, 0.035);
        return;
      }
      if (Boolean(isGolden)) {
        this._playTone(460, 'sine', 0.11, 0.12, 0.005, 290, 0);
        this._playTone(987.77, 'triangle', 0.075, 0.18, 0.006, 1318.51, 0);
        return;
      }
      // Crisp tactile macaron pop + gentle drop whoosh
      this._playTone(430, 'sine', 0.11, 0.11, 0.005, 235, 0);
      this._playTone(720, 'triangle', 0.045, 0.07, 0.004, 480, 0);
    } catch (_) {}
  }

  playBounce(intensity = 0.4, tier = 3, hitGlass = false) {
    if (!_canPlaySfx(this)) return;
    try {
      const now = Date.now();
      const lastAt = _toSafeAudioNum(this._lastBounceAt, 0);
      if (now - lastAt < 45) return;
      _safeSetAudioProp(this, '_lastBounceAt', now);
      const clamped = Math.max(0.08, Math.min(1, _toSafeAudioNum(intensity, 0.4)));
      const safeTier = _toSafeAudioTier(tier, 3, 9);
      // Lighter small candies (T1..T3) sound brighter & crisper; heavy pastries (T7..T9) sound deeper & softer
      const baseFreqs = [0, 320, 255, 222, 198, 172, 154, 140, 120, 100];
      const base = baseFreqs[safeTier] || 190;
      const vol = Math.min(0.095, 0.02 + clamped * 0.068);
      const dur = safeTier >= 7 ? 0.12 : safeTier <= 2 ? 0.072 : 0.092;
      const wave = safeTier <= 2 ? 'sine' : 'triangle';
      const f = base * (0.94 + clamped * 0.25);
      this._playTone(f, wave, vol, dur, 0.004, f * (safeTier >= 6 ? 0.64 : 0.78), 0);

      // Subtle crisp glass rim resonance when a candy or tart shell taps the glass jar
      if (Boolean(hitGlass) && clamped > 0.2 && (safeTier === 1 || safeTier === 4 || safeTier === 7)) {
        this._playTone(f * 3.1, 'sine', vol * 0.26, 0.048, 0.002, f * 2.8, 0);
      }
    } catch (_) {}
  }

  playTilt() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(540, 'sine', 0.032, 0.045, 0.003, 620, 0);
    } catch (_) {}
  }

  playMerge(tier, combo = 1, isCrit = false) {
    if (!_canPlaySfx(this)) return;
    try {
      const scaleArr = _safeIsArray(this.scale) && this.scale.length > 0 ? this.scale : [523.25];
      const safeTier = _toSafeAudioTier(tier, 1, scaleArr.length);
      const safeCombo = Math.max(1, Math.round(_toSafeAudioNum(combo, 1)));
      const crit = Boolean(isCrit);
      const idx = Math.min(scaleArr.length - 1, Math.max(0, (safeTier - 1) + Math.min(6, safeCombo - 1)));
      const rawNote = _audioHasOwn(scaleArr, idx) ? scaleArr[idx] : 523.25;
      const base = _toSafeAudioNum(rawNote, 523.25) || 523.25;
      // Layer 1: Warm elastic low-mid pop punch (upward pitch snap!)
      this._playTone(base * 0.48, 'sine', 0.15, 0.14, 0.005, base * 0.84, 0);
      // Layer 2: Crisp marimba / bell fundamental
      this._playTone(base, 'triangle', 0.15, 0.29, 0.006, base * 1.015, 0);
      // Layer 3: Upper fifth sparkle shimmer
      this._playTone(base * 1.5, 'sine', 0.085, 0.25, 0.008, null, 0.028);
      // Combo escalation flourish
      if (safeCombo >= 3) {
        this._playTone(Math.min(3136, base * 2.0), 'sine', 0.075, 0.28, 0.008, null, 0.056);
      }
      if (safeCombo >= 5 || crit) {
        this._playTone(Math.min(3520, base * 2.5), 'triangle', 0.07, 0.32, 0.008, null, 0.086);
      }
    } catch (_) {}
  }

  playWildcard() {
    if (!_canPlaySfx(this)) return;
    try {
      const notes = [587.33, 783.99, 987.77, 1174.66, 1567.98, 2093.0];
      notes.forEach((f, i) => {
        this._playTone(f, 'sine', 0.11, 0.32, 0.006, f * 1.02, i * 0.036);
      });
    } catch (_) {}
  }

  playGoldenMerge() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(1046.5, 'triangle', 0.13, 0.22, 0.005, 1318.51, 0);
      this._playTone(1567.98, 'sine', 0.11, 0.28, 0.006, 2093.0, 0.042);
      this._playTone(2349.32, 'sine', 0.08, 0.26, 0.006, null, 0.088);
    } catch (_) {}
  }

  playCritJump() {
    if (!_canPlaySfx(this)) return;
    try {
      const notes = [783.99, 1046.5, 1318.51, 1567.98, 2093.0];
      notes.forEach((f, i) => {
        this._playTone(f, 'triangle', 0.11, 0.3, 0.006, null, i * 0.040);
      });
    } catch (_) {}
  }

  playBlessingReady() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(1046.5, 'sine', 0.075, 0.18, 0.006, null, 0);
      this._playTone(1318.51, 'sine', 0.075, 0.24, 0.008, null, 0.065);
    } catch (_) {}
  }

  playBlessingOpen() {
    if (!_canPlaySfx(this)) return;
    try {
      const notes = [523.25, 659.25, 783.99, 987.77];
      notes.forEach((f, i) => {
        this._playTone(f, 'sine', 0.095, 0.42, 0.012, null, i * 0.055);
      });
    } catch (_) {}
  }

  playBlessingPick() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(659.25, 'triangle', 0.12, 0.18, 0.006, null, 0);
      this._playTone(987.77, 'triangle', 0.12, 0.22, 0.006, null, 0.052);
      this._playTone(1318.51, 'sine', 0.11, 0.34, 0.008, null, 0.104);
    } catch (_) {}
  }

  playFeverExtend() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(1046.5, 'sine', 0.09, 0.16, 0.005, 1318.51, 0);
      this._playTone(1567.98, 'sine', 0.085, 0.2, 0.005, null, 0.045);
    } catch (_) {}
  }

  playSupernova() {
    if (!_canPlaySfx(this)) return;
    try {
      this._duckBGM(0.55, 0.85, 0.9);
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
      notes.forEach((f, i) => {
        this._playTone(f, 'triangle', 0.12, 0.48, 0.01, null, i * 0.052);
      });
    } catch (_) {}
  }

  playOrderStamp() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(880, 'sine', 0.1, 0.18, 0.006, null, 0);
      this._playTone(1174.66, 'sine', 0.1, 0.22, 0.006, null, 0.058);
    } catch (_) {}
  }

  playOrderComplete() {
    if (!_canPlaySfx(this)) return;
    try {
      this._duckBGM(0.68, 0.55, 0.65);
      const notes = [659.25, 783.99, 1046.5, 1318.51, 1567.98];
      notes.forEach((f, i) => {
        this._playTone(f, 'triangle', 0.12, 0.34, 0.008, null, i * 0.062);
      });
    } catch (_) {}
  }

  playFeverStart() {
    if (!_canPlaySfx(this)) return;
    try {
      this._duckBGM(0.68, 0.5, 0.6);
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98];
      notes.forEach((f, i) => {
        this._playTone(f, 'sine', 0.11, 0.42, 0.008, null, i * 0.044);
      });
    } catch (_) {}
  }

  /** v0.10 bake crit: 2 = 双重烘焙, 3 = 三重烘焙, 4 = 星光暴击 (rising stacked chimes). */
  playCrit(level = 2) {
    if (!_canPlaySfx(this)) return;
    try {
      const lv = Math.max(2, Math.min(4, Math.round(_toSafeAudioNum(level, 2))));
      if (lv >= 3) this._duckBGM(0.72, 0.4, 0.5);
      // Warm punch
      this._playTone(196, 'sine', 0.16, 0.18, 0.004, 392, 0);
      const ladders = {
        2: [783.99, 1046.5],
        3: [783.99, 1046.5, 1318.51],
        4: [783.99, 1046.5, 1318.51, 1567.98, 2093.0]
      };
      const notes = ladders[lv];
      notes.forEach((f, i) => {
        this._playTone(f, 'triangle', 0.12, 0.26 + i * 0.03, 0.005, f * 1.01, 0.03 + i * 0.045);
      });
      if (lv >= 4) this._playTone(2637.02, 'sine', 0.07, 0.5, 0.01, null, 0.28);
    } catch (_) {}
  }

  /** v0.10 dough overheat: spawned=true → sizzle drop; false → dull puff while locked. */
  playOverheat(spawned = true) {
    if (!_canPlaySfx(this)) return;
    try {
      if (spawned) {
        this._playTone(880, 'triangle', 0.1, 0.22, 0.004, 220, 0);
        this._playTone(1760, 'sine', 0.05, 0.16, 0.004, 660, 0.02);
        this._playTone(140, 'sine', 0.12, 0.2, 0.006, 90, 0.05);
      } else {
        this._playTone(170, 'triangle', 0.07, 0.09, 0.004, 120, 0);
      }
    } catch (_) {}
  }

  /** v0.11 M2 mid-shift event chime (ice = cool bell, gold/warm = bright trumpet-chime). */
  playEvent(tone = 'gold') {
    if (!_canPlaySfx(this)) return;
    try {
      if (tone === 'ice') {
        [1046.5, 932.33, 783.99].forEach((f, i) => {
          this._playTone(f, 'sine', 0.09, 0.24, 0.005, f * 0.99, i * 0.06);
        });
      } else {
        [659.25, 880, 1174.66].forEach((f, i) => {
          this._playTone(f, 'triangle', 0.1, 0.22, 0.005, null, i * 0.05);
        });
      }
    } catch (_) {}
  }

  /** v0.11 M2 level goal completed fanfare. */
  playGoalDone() {
    if (!_canPlaySfx(this)) return;
    try {
      [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
        this._playTone(f, 'triangle', 0.11, 0.28, 0.006, null, i * 0.055);
      });
    } catch (_) {}
  }

  /** v0.11 M2 Star Oven ('O') auto-upgrade ding. */
  playOvenDing() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(1318.51, 'sine', 0.11, 0.34, 0.004, null, 0);
      this._playTone(1975.53, 'sine', 0.07, 0.38, 0.005, null, 0.045);
    } catch (_) {}
  }

  playTool(kind) {
    if (!_canPlaySfx(this)) return;
    try {
      if (kind === 'shake') {
        this._playTone(190, 'triangle', 0.12, 0.24, 0.01, 120, 0);
        this._playTone(987.77, 'sine', 0.09, 0.28, 0.01, null, 0.040);
      } else if (kind === 'fork') {
        this._playTone(620, 'sine', 0.12, 0.14, 0.005, 980, 0);
      } else if (kind === 'spoon') {
        this._playTone(784, 'sine', 0.11, 0.25, 0.01, null, 0);
        this._playTone(1175, 'triangle', 0.12, 0.3, 0.01, null, 0.060);
      } else if (kind === 'swap') {
        this._playTone(480, 'sine', 0.08, 0.11, 0.005, 660, 0);
      }
    } catch (_) {}
  }

  playGameOver() {
    if (!_canPlaySfx(this)) return;
    try {
      this._duckBGM(0.42, 1.1, 1.1);
      const notes = [523.25, 493.88, 440.0, 392.0];
      notes.forEach((f, i) => {
        this._playTone(f, 'triangle', 0.09, 0.38, 0.015, null, i * 0.140);
      });
    } catch (_) {}
  }

  /**
   * 3.0 Plan B SFX — 100% Web Audio C-Major Procedural Synthesis
   */
  playShopBuy() {
    if (!_canPlaySfx(this)) return;
    try {
      // Crisp wooden café register brass ding + warm major chord confirmation
      this._playTone(1318.51, 'sine', 0.12, 0.28, 0.004, null, 0);
      this._playTone(2637.02, 'sine', 0.045, 0.18, 0.003, null, 0);
      this._playTone(1046.5, 'triangle', 0.1, 0.32, 0.006, null, 0.068);
      this._playTone(1567.98, 'sine', 0.095, 0.36, 0.006, null, 0.068);
      this._playTone(2093.0, 'sine', 0.065, 0.38, 0.008, null, 0.068);
    } catch (_) {}
  }

  playPatronSelect() {
    if (!_canPlaySfx(this)) return;
    try {
      // Playful soft cat-paw kneading two-syllable chirp
      this._playTone(587.33, 'sine', 0.09, 0.095, 0.005, 740, 0);
      this._playTone(880.0, 'triangle', 0.095, 0.14, 0.005, 1046.5, 0.058);
    } catch (_) {}
  }

  playEventStart(kind) {
    if (!_canPlaySfx(this)) return;
    try {
      if (kind === 'meteor') {
        // Shimmering descending + ascending celesta/harp arpeggio
        const notes = [2093.0, 1760.0, 1567.98, 1318.51, 1567.98, 2093.0, 2637.02];
        notes.forEach((f, i) => {
          this._playTone(f, 'sine', 0.085, 0.32, 0.005, null, i * 0.044);
        });
      } else if (kind === 'yarn') {
        // Playful mischievous cat meow pitch-glide synth
        this._playTone(620, 'triangle', 0.11, 0.13, 0.012, 920, 0);
        this._playTone(920, 'sine', 0.1, 0.19, 0.008, 520, 0.105);
        this._playTone(783.99, 'sine', 0.065, 0.12, 0.006, 987.77, 0.240);
      } else if (kind === 'chime') {
        // Warm golden bakery oven brass bell harmonics
        this._playTone(783.99, 'sine', 0.12, 0.72, 0.006, null, 0);
        this._playTone(1567.98, 'triangle', 0.07, 0.58, 0.005, null, 0);
        this._playTone(2349.32, 'sine', 0.04, 0.38, 0.004, null, 0);
        this._playTone(1046.5, 'sine', 0.11, 0.76, 0.006, null, 0.170);
        this._playTone(2093.0, 'sine', 0.055, 0.5, 0.004, null, 0.170);
      }
    } catch (_) {}
  }

  playYarnHit() {
    if (!_canPlaySfx(this)) return;
    try {
      // Soft elastic wool thump + playful pluck
      this._playTone(260, 'sine', 0.14, 0.12, 0.004, 135, 0);
      this._playTone(587.33, 'triangle', 0.075, 0.09, 0.004, 783.99, 0);
    } catch (_) {}
  }

  playYarnBreak() {
    if (!_canPlaySfx(this)) return;
    try {
      // Joyful crispy candy-confetti pop + sparkle celebration chord
      this._playTone(360, 'sine', 0.14, 0.1, 0.004, 760, 0);
      const notes = [783.99, 1046.5, 1318.51, 1567.98, 2093.0];
      notes.forEach((f, i) => {
        this._playTone(f, i % 2 === 0 ? 'triangle' : 'sine', 0.1, 0.3, 0.005, null, 0.024 + i * 0.038);
      });
    } catch (_) {}
  }

  playRushTick(urgent = false) {
    if (!_canPlaySfx(this)) return;
    try {
      // Gentle wooden block tick for final 5s Rush countdown
      const isUrgent = Boolean(urgent);
      const f = isUrgent ? 1174.66 : 880.0;
      this._playTone(f, 'triangle', isUrgent ? 0.11 : 0.08, 0.075, 0.003, f * 0.86, 0);
      if (isUrgent) {
        this._playTone(f * 1.5, 'sine', 0.05, 0.06, 0.002, null, 0);
      }
    } catch (_) {}
  }

  playWindGust() {
    if (!_canPlaySfx(this)) return;
    try {
      // Airy starlight gust sweeping away top treats in 90s Rush mode
      this._playTone(440, 'sine', 0.1, 0.24, 0.015, 880, 0);
      this._playTone(659.25, 'triangle', 0.09, 0.22, 0.01, 1318.51, 0.060);
      const ctx = this.ensureCtx();
      if (ctx && this._noiseBuffer && _getFnProp(ctx, 'createBufferSource')) {
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.11, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        if (_getFnProp(ctx, 'createBiquadFilter')) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(900, now);
          bp.frequency.exponentialRampToValueAtTime(2600, now + 0.26);
          bp.Q.value = 1.4;
          src.connect(bp);
          bp.connect(g);
          this._attachAutoDisconnect(src, [src, bp, g]);
        } else {
          src.connect(g);
          this._attachAutoDisconnect(src, [src, g]);
        }
        g.connect(this._sfxBus || ctx.destination);
        src.start(now, 0, 0.35);
      }
    } catch (_) {}
  }

  playSlingStretch(power = 0.5) {
    if (!_canPlaySfx(this)) return;
    try {
      const p = Math.max(0, Math.min(1, _toSafeAudioNum(power, 0.5)));
      const f = 340 + p * 320;
      this._playTone(f, 'sine', 0.036, 0.048, 0.003, f * 1.12, 0);
    } catch (_) {}
  }

  playBankBounce(count = 1) {
    if (!_canPlaySfx(this)) return;
    try {
      const c = Math.max(1, Math.round(_toSafeAudioNum(count, 1)));
      const base = c >= 2 ? 1318.51 : 1046.5;
      this._playTone(base, 'sine', 0.095, 0.13, 0.003, base * 1.15, 0);
      this._playTone(base * 2.0, 'triangle', 0.04, 0.07, 0.002, null, 0);
    } catch (_) {}
  }

  playServeBell() {
    if (!_canPlaySfx(this)) return;
    try {
      // Classic brass patisserie service bell + bright ascending confirmation
      this._playTone(1567.98, 'sine', 0.13, 0.34, 0.003, null, 0);
      this._playTone(3135.96, 'sine', 0.045, 0.18, 0.002, null, 0);
      this._playTone(1318.51, 'triangle', 0.095, 0.22, 0.005, null, 0.055);
      this._playTone(1975.53, 'sine', 0.095, 0.28, 0.005, null, 0.110);
    } catch (_) {}
  }

  playCascadeHit(step = 1) {
    if (!_canPlaySfx(this)) return;
    try {
      const scale = [659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98];
      const s = Math.max(1, Math.round(_toSafeAudioNum(step, 1)));
      const f = scale[Math.min(scale.length - 1, Math.max(0, s - 1))];
      this._playTone(f, 'triangle', 0.125, 0.24, 0.004, f * 1.04, 0);
      this._playTone(f * 1.5, 'sine', 0.08, 0.22, 0.006, null, 0);
    } catch (_) {}
  }

  playTraitTrigger(tier = 4) {
    if (!_canPlaySfx(this)) return;
    try {
      const t = _toSafeAudioTier(tier, 4, 9);
      if (t === 4) {
        // Lemon fizz vaporize pop
        this._playTone(740, 'sine', 0.09, 0.11, 0.004, 1380, 0);
        this._playTone(1174.66, 'triangle', 0.075, 0.14, 0.004, 1760, 0.045);
      } else if (t === 5) {
        // Daifuku soft inward pull whoosh
        this._playTone(587.33, 'sine', 0.09, 0.22, 0.008, 392, 0);
        this._playTone(783.99, 'sine', 0.075, 0.18, 0.006, null, 0.060);
      } else if (t === 6) {
        // Caramel donut spin whirr
        this._playTone(440, 'triangle', 0.085, 0.18, 0.006, 880, 0);
        this._playTone(659.25, 'sine', 0.07, 0.18, 0.006, 987.77, 0.055);
      } else if (t === 8) {
        // Mont Blanc heavy hammer crush thump
        this._playTone(150, 'triangle', 0.16, 0.24, 0.004, 72, 0);
        this._playTone(320, 'sine', 0.09, 0.16, 0.004, 180, 0);
      } else {
        this._playTone(880, 'sine', 0.08, 0.18, 0.005, 1174.66, 0);
      }
    } catch (_) {}
  }

  playChefSkill(patronId = 'mikan') {
    if (!_canPlaySfx(this)) return;
    try {
      const pid =
        patronId === 'luna' || patronId === 'patron_luna'
          ? 'luna'
          : patronId === 'mugi' || patronId === 'patron_mugi'
          ? 'mugi'
          : 'mikan';
      const chord =
        pid === 'luna'
          ? [587.33, 880.0, 1174.66, 1760.0]
          : pid === 'mugi'
          ? [523.25, 659.25, 783.99, 1318.51]
          : [659.25, 783.99, 1046.5, 1567.98];
      chord.forEach((f, i) => {
        this._playTone(f, i % 2 === 0 ? 'triangle' : 'sine', 0.105, 0.26, 0.005, null, i * 0.044);
      });
    } catch (_) {}
  }

  playShiftClear() {
    if (!_canPlaySfx(this)) return;
    try {
      // Warm triumphant patisserie register chime + major chord arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((f, i) => {
        this._playTone(f, i === notes.length - 1 ? 'sine' : 'triangle', 0.115, 0.34, 0.006, null, i * 0.062);
      });
    } catch (_) {}
  }

  playCoinSpend() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(1174.66, 'sine', 0.09, 0.12, 0.003, 1567.98, 0);
      this._playTone(1760.0, 'triangle', 0.075, 0.15, 0.003, null, 0.048);
    } catch (_) {}
  }

  playBumperHit() {
    if (!_canPlaySfx(this)) return;
    try {
      this._playTone(880, 'triangle', 0.11, 0.14, 0.003, 1320, 0);
      this._playTone(1760, 'sine', 0.055, 0.09, 0.002, null, 0);
    } catch (_) {}
  }

  playAntiGrav() {
    if (!_canPlaySfx(this)) return;
    try {
      const notes = [392.0, 523.25, 659.25, 987.77];
      notes.forEach((f, i) => {
        this._playTone(f, 'sine', 0.085, 0.28, 0.01, f * 1.18, i * 0.055);
      });
    } catch (_) {}
  }

  playGlazeRing() {
    if (!_canPlaySfx(this)) return;
    try {
      // Glistening caramel starlight harp arpeggio
      const notes = [1046.5, 1318.51, 1567.98, 2093.0];
      notes.forEach((f, i) => {
        this._playTone(f, i % 2 === 0 ? 'sine' : 'triangle', 0.075, 0.2, 0.004, f * 1.02, i * 0.036);
      });
    } catch (_) {}
  }

  playIceShatter() {
    if (!_canPlaySfx(this)) return;
    try {
      // Crystalline frost crack + sparkling glass chimes
      const notes = [1760.0, 2349.32, 2637.02, 3135.96];
      this._playTone(620, 'triangle', 0.11, 0.08, 0.002, 180, 0);
      notes.forEach((f, i) => {
        this._playTone(f, 'sine', 0.068, 0.14, 0.002, f * 0.96, i * 0.024);
      });
    } catch (_) {}
  }

  // ==================== v2.0 Shaped-Grid & Service Tactile SFX ====================

  _attachAutoDisconnect(sourceNode, nodes) {
    if (!_isAudioSelf(this) || !_isSafeAudioObj(sourceNode) || !_safeIsArray(nodes)) return;
    try {
      sourceNode.onended = () => {
        try {
          for (let i = 0; i < nodes.length; i++) {
            const n = _audioHasOwn(nodes, i) ? nodes[i] : null;
            const disc = _getFnProp(n, 'disconnect');
            if (disc) {
              try {
                disc.call(n);
              } catch (_) {}
            }
          }
        } catch (_) {}
      };
    } catch (_) {}
  }

  /**
   * 1. Valid 4-way board slide (55ms): soft wooden board brush + 330Hz -> 440Hz (E4 -> A4) triangle glide
   */
  playGridSlide() {
    if (!_canPlaySfx(this)) return;
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const dest = this._sfxBus || ctx.destination;
      const now = ctx.currentTime;

      if (this._noiseBuffer && _getFnProp(ctx, 'createBufferSource')) {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.linearRampToValueAtTime(0.065, now + 0.008);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

        if (_getFnProp(ctx, 'createBiquadFilter')) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1400, now);
          bp.frequency.exponentialRampToValueAtTime(2400, now + 0.055);
          bp.Q.value = 1.3;
          src.connect(bp);
          bp.connect(ng);
          this._attachAutoDisconnect(src, [src, bp, ng]);
        } else {
          src.connect(ng);
          this._attachAutoDisconnect(src, [src, ng]);
        }
        ng.connect(dest);
        src.start(now, (now * 3.1) % 0.5, 0.065);
      }

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330.0, now);
      osc.frequency.exponentialRampToValueAtTime(440.0, now + 0.055);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.075, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      osc.connect(g);
      g.connect(dest);
      this._attachAutoDisconnect(osc, [osc, g]);
      osc.start(now);
      osc.stop(now + 0.065);
    } catch (_) {}
  }

  /**
   * 2. Blocked slide wall-bump (65ms): warm muted wood knock 165Hz -> 110Hz (E3 -> A2) sine decay
   */
  playGridBlocked() {
    if (!_canPlaySfx(this)) return;
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const dest = this._sfxBus || ctx.destination;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(165.0, now);
      osc1.frequency.exponentialRampToValueAtTime(110.0, now + 0.065);
      g1.gain.setValueAtTime(0.0001, now);
      g1.gain.linearRampToValueAtTime(0.13, now + 0.004);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc1.connect(g1);
      g1.connect(dest);
      this._attachAutoDisconnect(osc1, [osc1, g1]);
      osc1.start(now);
      osc1.stop(now + 0.075);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(330.0, now);
      osc2.frequency.exponentialRampToValueAtTime(165.0, now + 0.028);
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.linearRampToValueAtTime(0.045, now + 0.002);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
      osc2.connect(g2);
      g2.connect(dest);
      this._attachAutoDisconnect(osc2, [osc2, g2]);
      osc2.start(now);
      osc2.stop(now + 0.042);
    } catch (_) {}
  }

  /**
   * 3. Knead button / dough spawn (50ms): elastic mochi dough pop 420Hz -> 620Hz sine + C6 harmonic
   */
  playKneadSpawn() {
    if (!_canPlaySfx(this)) return;
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const dest = this._sfxBus || ctx.destination;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(420.0, now);
      osc1.frequency.exponentialRampToValueAtTime(620.0, now + 0.050);
      g1.gain.setValueAtTime(0.0001, now);
      g1.gain.linearRampToValueAtTime(0.115, now + 0.006);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.050);
      osc1.connect(g1);
      g1.connect(dest);
      this._attachAutoDisconnect(osc1, [osc1, g1]);
      osc1.start(now);
      osc1.stop(now + 0.060);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(840.0, now + 0.008);
      osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.048);
      g2.gain.setValueAtTime(0.0001, now + 0.008);
      g2.gain.linearRampToValueAtTime(0.042, now + 0.014);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.050);
      osc2.connect(g2);
      g2.connect(dest);
      this._attachAutoDisconnect(osc2, [osc2, g2]);
      osc2.start(now + 0.008);
      osc2.stop(now + 0.058);
    } catch (_) {}
  }

  /**
   * 4. Single-tap Cat-Cake onto serving tray (70ms): crisp porcelain saucer double-sine (A5 + E6)
   */
  playTrayPlace() {
    if (!_canPlaySfx(this)) return;
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const dest = this._sfxBus || ctx.destination;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880.0, now);
      g1.gain.setValueAtTime(0.0001, now);
      g1.gain.linearRampToValueAtTime(0.105, now + 0.003);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.054);
      osc1.connect(g1);
      g1.connect(dest);
      this._attachAutoDisconnect(osc1, [osc1, g1]);
      osc1.start(now);
      osc1.stop(now + 0.064);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.016);
      g2.gain.setValueAtTime(0.0001, now + 0.016);
      g2.gain.linearRampToValueAtTime(0.095, now + 0.020);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.070);
      osc2.connect(g2);
      g2.connect(dest);
      this._attachAutoDisconnect(osc2, [osc2, g2]);
      osc2.start(now + 0.016);
      osc2.stop(now + 0.080);
    } catch (_) {}
  }

  /**
   * 5. Double-tap tray discard into wicker trash basket (95ms): descending triangle D5 -> C4 + wicker rustle
   */
  playTrayTrash() {
    if (!_canPlaySfx(this)) return;
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const dest = this._sfxBus || ctx.destination;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.095);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.115, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      osc.connect(g);
      g.connect(dest);
      this._attachAutoDisconnect(osc, [osc, g]);
      osc.start(now);
      osc.stop(now + 0.105);

      if (this._noiseBuffer && _getFnProp(ctx, 'createBufferSource')) {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now + 0.050);
        ng.gain.linearRampToValueAtTime(0.042, now + 0.060);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

        if (_getFnProp(ctx, 'createBiquadFilter')) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1800, now + 0.050);
          bp.Q.value = 1.2;
          src.connect(bp);
          bp.connect(ng);
          this._attachAutoDisconnect(src, [src, bp, ng]);
        } else {
          src.connect(ng);
          this._attachAutoDisconnect(src, [src, ng]);
        }
        ng.connect(dest);
        src.start(now + 0.050, (now * 2.3) % 0.5, 0.055);
      }
    } catch (_) {}
  }

  /**
   * 6. Customer patience depleted angry walkout (180ms): pouty two-note descending filtered sawtooth meow
   */
  playCustomerAngry() {
    if (!_canPlaySfx(this)) return;
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const dest = this._sfxBus || ctx.destination;
      const now = ctx.currentTime;

      let vocalFilter = null;
      if (_getFnProp(ctx, 'createBiquadFilter')) {
        vocalFilter = ctx.createBiquadFilter();
        vocalFilter.type = 'lowpass';
        vocalFilter.frequency.setValueAtTime(1180, now);
        vocalFilter.frequency.exponentialRampToValueAtTime(640, now + 0.180);
        vocalFilter.Q.value = 1.6;
        vocalFilter.connect(dest);
      }
      const targetNode = vocalFilter || dest;

      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(440.0, now + 0.082);
      g1.gain.setValueAtTime(0.0001, now);
      g1.gain.linearRampToValueAtTime(0.075, now + 0.012);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.082);
      osc1.connect(g1);
      g1.connect(targetNode);
      this._attachAutoDisconnect(osc1, [osc1, g1]);
      osc1.start(now);
      osc1.stop(now + 0.090);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(493.88, now + 0.088);
      osc2.frequency.exponentialRampToValueAtTime(392.0, now + 0.180);
      g2.gain.setValueAtTime(0.0001, now + 0.088);
      g2.gain.linearRampToValueAtTime(0.080, now + 0.100);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.180);
      osc2.connect(g2);
      g2.connect(targetNode);
      this._attachAutoDisconnect(osc2, vocalFilter ? [osc2, g2, vocalFilter] : [osc2, g2]);
      osc2.start(now + 0.088);
      osc2.stop(now + 0.190);
    } catch (_) {}
  }

  /**
   * 7. Star 1/2/3 threshold unlocked: ascending 3-note high-register C-major harp sparkle (C6 / E6 / G6 roots)
   */
  playStarUnlock(starIndex = 1) {
    if (!_canPlaySfx(this)) return;
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const raw = _toSafeAudioNum(starIndex, 1);
      const idx = Math.max(1, Math.min(3, Math.round(raw)));

      if (idx === 3) {
        this._duckBGM(0.76, 0.22, 0.35);
      }

      const triads = {
        __proto__: null,
        1: [1046.5, 1318.51, 1567.98], // C6 - E6 - G6
        2: [1318.51, 1567.98, 2093.0], // E6 - G6 - C7
        3: [1567.98, 2093.0, 2637.02]  // G6 - C7 - E7
      };
      const notes = triads[idx] || triads[1];
      const dest = this._sfxBus || ctx.destination;
      const now = ctx.currentTime;

      for (let i = 0; i < notes.length; i++) {
        const f = notes[i];
        const t = now + i * 0.042;

        // Harp fundamental string
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.105, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
        osc.connect(g);
        g.connect(dest);
        this._attachAutoDisconnect(osc, [osc, g]);
        osc.start(t);
        osc.stop(t + 0.275);

        // Sparkle octave harmonic
        const hOsc = ctx.createOscillator();
        const hGain = ctx.createGain();
        hOsc.type = 'sine';
        hOsc.frequency.setValueAtTime(f * 2, t);
        hGain.gain.setValueAtTime(0.0001, t);
        hGain.gain.linearRampToValueAtTime(0.036, t + 0.003);
        hGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        hOsc.connect(hGain);
        hGain.connect(dest);
        this._attachAutoDisconnect(hOsc, [hOsc, hGain]);
        hOsc.start(t);
        hOsc.stop(t + 0.145);
      }
    } catch (_) {}
  }

  getDebugState() {
    if (!_isAudioSelf(this)) {
      return {
        ctxState: 'uninitialized',
        bgmTrack: 'waltz',
        bgmLabel: '音乐: 关',
        bgmTitle: '已关闭',
        bgmEnabled: false,
        isPlayingBGM: false,
        sfxEnabled: false,
        feverMode: false,
        muffled: false,
        dangerLevel: 0,
        stepIndex: 0,
        cycleCount: 0,
        toneFilterHz: null
      };
    }
    try {
      const info = this.getTrackInfo();
      let ctxState = 'uninitialized';
      const st = _safeCtxState(this.ctx);
      if (st) ctxState = st;
      let toneFilterHz = null;
      try {
        if (this._bgmToneFilter && this._bgmToneFilter.frequency) {
          const hz = _toSafeAudioNum(this._bgmToneFilter.frequency.value, NaN);
          toneFilterHz = Number.isFinite(hz) ? Math.round(hz) : null;
        }
      } catch (_) {}
      const dl = _toSafeAudioNum(this.dangerLevel, 0);
      return {
        ctxState,
        bgmTrack: typeof this.bgmTrack === 'string' ? this.bgmTrack : 'waltz',
        bgmLabel: info.label,
        bgmTitle: info.title,
        bgmEnabled: Boolean(this.bgmEnabled),
        isPlayingBGM: Boolean(this._isPlayingBGM),
        sfxEnabled: Boolean(this.sfxEnabled),
        feverMode: Boolean(this.feverMode),
        muffled: Boolean(this.muffled),
        dangerLevel: +dl.toFixed(2),
        stepIndex: _toSafeAudioNum(this._stepIndex, 0),
        cycleCount: _toSafeAudioNum(this._cycleCount, 0),
        toneFilterHz
      };
    } catch (_) {
      return {
        ctxState: 'uninitialized',
        bgmTrack: 'waltz',
        bgmLabel: '音乐: 关',
        bgmTitle: '已关闭',
        bgmEnabled: false,
        isPlayingBGM: false,
        sfxEnabled: false,
        feverMode: false,
        muffled: false,
        dangerLevel: 0,
        stepIndex: 0,
        cycleCount: 0,
        toneFilterHz: null
      };
    }
  }
}

module.exports = StarlightAudio;
