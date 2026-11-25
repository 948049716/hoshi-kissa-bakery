#!/usr/bin/env node
/**
 * 一起做猫饼 v2.0 — Core L1 Unit Tests, L2 30-Level Static Invariants & M4 Integration Suite
 *
 * Pure Node.js ESM, zero external npm dependencies, 100% in-memory (zero /tmp or disk writes).
 * Covers:
 *   Section A: UT-G01 .. UT-G11 (grid_engine.js shaped 2048 rules, dye, ice, knead)
 *   Section B: UT-O01 .. UT-O07 (order_service.js & Pure Serve-Only Scoring Iron Law)
 *   Section C: UT-S01 .. UT-S03 (save_sync.js v1->v2 migration, merge, kissa_sync & mock cloud parity)
 *   Section D: L2-1   .. L2-5   (levels_data.js 30-level static invariants & zero-tool ice thawability)
 *   Section E: UT-M01 .. UT-M06 (M4 post-cleanup gate, 0 hsl/emoji spy, multi-viewport boot, controller loop, shop/tools/patrons, 6-step spotlight guide)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const MINIGAME_DIR = path.join(REPO_ROOT, '05-微信小游戏版本');
const SRC_DIR = path.join(MINIGAME_DIR, 'src');
const ASSETS_DIR = path.join(MINIGAME_DIR, 'assets');
const CLOUD_INDEX_PATH = path.join(MINIGAME_DIR, 'cloudfunctions', 'kissa_sync', 'index.js');

const require = createRequire(import.meta.url);

const Constants = require(path.join(SRC_DIR, 'constants.js'));
const Levels = require(path.join(SRC_DIR, 'levels_data.js'));
const GridEngine = require(path.join(SRC_DIR, 'grid_engine.js'));
const OrderService = require(path.join(SRC_DIR, 'order_service.js'));
const SaveSync = require(path.join(SRC_DIR, 'save_sync.js'));
const Platform = require(path.join(SRC_DIR, 'platform.js'));
const UI = require(path.join(SRC_DIR, 'ui_draw.js'));

// ============================================================================
// Deterministic PRNG & Test Runner Harness
// ============================================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fixedRng = () => 0.5;

function countBoardTiles(gs) {
  let count = 0;
  for (let r = 0; r < gs.rows; r++) {
    for (let c = 0; c < gs.cols; c++) {
      if (gs.cells[r][c].tile !== null) count++;
    }
  }
  return count;
}

function rowTiers(gs, r = 0) {
  return gs.cells[r].map((cell) => (cell.tile ? cell.tile.tier : null));
}

function deepClone(val) {
  return val === undefined ? undefined : JSON.parse(JSON.stringify(val));
}

const results = [];

async function runTest(id, title, fn) {
  try {
    await fn();
    results.push({ id, title, ok: true });
    console.log(`[PASS] ${id} · ${title}`);
  } catch (err) {
    results.push({ id, title, ok: false, err });
    console.error(`[FAIL] ${id} · ${title}`);
    console.error(err && err.stack ? err.stack : err);
  }
}

// ============================================================================
// In-Memory CloudBase (`wx-server-sdk`) Mock for `cloudfunctions/kissa_sync`
// ============================================================================

function loadCloudFunctionInMemory(initialOpenId = 'openid_player_alpha_CAFE') {
  const docs = new Map();
  let currentOpenId = initialOpenId;

  function makeCond(pred) {
    const cond = {
      __isCond: true,
      test: pred,
      and(other) {
        return makeCond((val, hasKey, doc) => {
          const ok1 = cond.test(val, hasKey, doc);
          if (!ok1) return false;
          if (other && other.__isCond) return other.test(val, hasKey, doc);
          return val === other;
        });
      }
    };
    return cond;
  }

  const command = {
    set(val) {
      return { __cmd: 'set', val: deepClone(val) };
    },
    remove() {
      return { __cmd: 'remove' };
    },
    eq(val) {
      return makeCond((v, hasKey) => hasKey && v === val);
    },
    exists(flag) {
      return makeCond((_v, hasKey) => Boolean(hasKey) === Boolean(flag));
    },
    gt(val) {
      return makeCond((v, hasKey) => hasKey && typeof v === typeof val && v > val);
    },
    gte(val) {
      return makeCond((v, hasKey) => hasKey && typeof v === typeof val && v >= val);
    },
    lt(val) {
      return makeCond((v, hasKey) => hasKey && typeof v === typeof val && v < val);
    },
    lte(val) {
      return makeCond((v, hasKey) => hasKey && typeof v === typeof val && v <= val);
    },
    or(branches) {
      return { __cmd: 'or', branches: Array.isArray(branches) ? branches : [] };
    }
  };

  function matchesFilter(doc, filter) {
    if (!filter || typeof filter !== 'object') return true;
    if (filter.__cmd === 'and_pair') {
      return filter.testDoc(doc);
    }
    if (filter.__cmd === 'or') {
      return filter.branches.some((b) => matchesFilter(doc, b));
    }
    for (const key of Object.keys(filter)) {
      const cond = filter[key];
      const hasKey = Object.prototype.hasOwnProperty.call(doc, key);
      const val = hasKey ? doc[key] : undefined;
      if (cond && cond.__isCond) {
        if (!cond.test(val, hasKey, doc)) return false;
      } else if (!hasKey || val !== cond) {
        return false;
      }
    }
    return true;
  }

  function applyUpdatePatch(targetDoc, patch) {
    for (const key of Object.keys(patch)) {
      if (key === '_id') continue;
      const spec = patch[key];
      if (spec && typeof spec === 'object' && spec.__cmd === 'remove') {
        delete targetDoc[key];
      } else if (spec && typeof spec === 'object' && spec.__cmd === 'set') {
        targetDoc[key] = deepClone(spec.val);
      } else {
        targetDoc[key] = deepClone(spec);
      }
    }
  }

  function makeQuery(colMap, filter = null, orders = [], skipN = 0, limitN = Infinity) {
    function evalDocs() {
      let arr = [];
      for (const [id, raw] of colMap.entries()) {
        const d = deepClone(raw);
        d._id = id;
        if (matchesFilter(d, filter)) arr.push(d);
      }
      if (orders.length > 0) {
        arr.sort((a, b) => {
          for (const { field, dir } of orders) {
            const av = a[field];
            const bv = b[field];
            if (av === bv) continue;
            const cmp = av < bv ? -1 : 1;
            return dir === 'desc' ? -cmp : cmp;
          }
          return 0;
        });
      }
      if (skipN > 0) arr = arr.slice(skipN);
      if (Number.isFinite(limitN)) arr = arr.slice(0, limitN);
      return arr;
    }

    return {
      where(nextFilter) {
        const combined = filter
          ? {
              __cmd: 'and_pair',
              testDoc: (d) => matchesFilter(d, filter) && matchesFilter(d, nextFilter)
            }
          : nextFilter;
        return makeQuery(colMap, combined, orders, skipN, limitN);
      },
      orderBy(field, dir = 'asc') {
        return makeQuery(colMap, filter, [...orders, { field, dir }], skipN, limitN);
      },
      skip(n) {
        return makeQuery(colMap, filter, orders, n, limitN);
      },
      limit(n) {
        return makeQuery(colMap, filter, orders, skipN, n);
      },
      async get() {
        return { data: evalDocs() };
      },
      async count() {
        return { total: evalDocs().length };
      },
      async update({ data }) {
        let updated = 0;
        for (const [id, stored] of colMap.entries()) {
          const probe = deepClone(stored);
          probe._id = id;
          if (matchesFilter(probe, filter)) {
            applyUpdatePatch(stored, data || {});
            stored._id = id;
            updated++;
          }
        }
        return { stats: { updated } };
      }
    };
  }

  const db = {
    command,
    collection(name) {
      if (!docs.has(name)) docs.set(name, new Map());
      const colMap = docs.get(name);
      return {
        doc(id) {
          const key = String(id);
          return {
            async get() {
              if (!colMap.has(key)) {
                const err = new Error('document.get:fail document does not exist');
                err.errCode = -1;
                throw err;
              }
              return { data: deepClone(colMap.get(key)) };
            },
            async set({ data }) {
              const stored = deepClone(data || {});
              stored._id = key;
              colMap.set(key, stored);
              return { _id: key, stats: { updated: 1, created: 1 } };
            },
            async update({ data }) {
              if (!colMap.has(key)) return { stats: { updated: 0 } };
              const stored = colMap.get(key);
              applyUpdatePatch(stored, data || {});
              stored._id = key;
              return { stats: { updated: 1 } };
            }
          };
        },
        where(filter) {
          return makeQuery(colMap, filter);
        }
      };
    }
  };

  const mockCloudSdk = {
    DYNAMIC_CURRENT_ENV: 'mock-test-env',
    init() {},
    database() {
      return db;
    },
    getWXContext() {
      return {
        OPENID: currentOpenId,
        APPID: 'wx923bf8440b65a1af',
        ENV: 'mock-test-env'
      };
    }
  };

  const code = fs.readFileSync(CLOUD_INDEX_PATH, 'utf8');
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require(id) {
      if (id === 'wx-server-sdk') return mockCloudSdk;
      throw new Error(`Unexpected require in kissa_sync: ${id}`);
    },
    console,
    Date,
    Math,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    Set,
    Map,
    Error,
    TypeError,
    RangeError,
    Symbol,
    Reflect,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Infinity,
    NaN,
    undefined
  };
  vm.runInNewContext(code, sandbox, { filename: CLOUD_INDEX_PATH });

  return {
    exports: mod.exports,
    docs,
    setOpenId(id) {
      currentOpenId = id;
    }
  };
}

// ============================================================================
// In-Memory Mock WeChat + Mock 2D Canvas Environment for Controller (UT-M02..06)
// ============================================================================

function createMockCanvas2D(canvas, spy) {
  const stateStack = [];
  let fillStyleVal = '#000000';
  let strokeStyleVal = '#000000';
  let shadowColorVal = 'rgba(0,0,0,0)';

  const ctx = {
    canvas,
    get fillStyle() {
      return fillStyleVal;
    },
    set fillStyle(v) {
      fillStyleVal = v;
      if (typeof v === 'string') spy.styles.push(v);
    },
    get strokeStyle() {
      return strokeStyleVal;
    },
    set strokeStyle(v) {
      strokeStyleVal = v;
      if (typeof v === 'string') spy.styles.push(v);
    },
    get shadowColor() {
      return shadowColorVal;
    },
    set shadowColor(v) {
      shadowColorVal = v;
      if (typeof v === 'string') spy.styles.push(v);
    },
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineDashOffset: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '12px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'inherit',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    filter: 'none',

    save() {
      stateStack.push({
        fillStyleVal,
        strokeStyleVal,
        shadowColorVal,
        shadowBlur: this.shadowBlur,
        shadowOffsetX: this.shadowOffsetX,
        shadowOffsetY: this.shadowOffsetY,
        lineWidth: this.lineWidth,
        lineCap: this.lineCap,
        lineJoin: this.lineJoin,
        globalAlpha: this.globalAlpha,
        globalCompositeOperation: this.globalCompositeOperation,
        font: this.font,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline
      });
    },
    restore() {
      const prev = stateStack.pop();
      if (!prev) return;
      fillStyleVal = prev.fillStyleVal;
      strokeStyleVal = prev.strokeStyleVal;
      shadowColorVal = prev.shadowColorVal;
      this.shadowBlur = prev.shadowBlur;
      this.shadowOffsetX = prev.shadowOffsetX;
      this.shadowOffsetY = prev.shadowOffsetY;
      this.lineWidth = prev.lineWidth;
      this.lineCap = prev.lineCap;
      this.lineJoin = prev.lineJoin;
      this.globalAlpha = prev.globalAlpha;
      this.globalCompositeOperation = prev.globalCompositeOperation;
      this.font = prev.font;
      this.textAlign = prev.textAlign;
      this.textBaseline = prev.textBaseline;
    },
    scale() {},
    rotate() {},
    translate() {},
    transform() {},
    setTransform() {},
    resetTransform() {},
    getTransform() {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    },
    createLinearGradient() {
      return {
        addColorStop(_offset, color) {
          spy.colorStops.push(String(color));
        }
      };
    },
    createRadialGradient() {
      return {
        addColorStop(_offset, color) {
          spy.colorStops.push(String(color));
        }
      };
    },
    createConicGradient() {
      return {
        addColorStop(_offset, color) {
          spy.colorStops.push(String(color));
        }
      };
    },
    createPattern() {
      return {};
    },
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    quadraticCurveTo() {},
    arc() {},
    arcTo() {},
    ellipse() {},
    rect() {},
    roundRect() {},
    fill() {},
    stroke() {},
    clip() {},
    isPointInPath() {
      return false;
    },
    isPointInStroke() {
      return false;
    },
    setLineDash() {},
    getLineDash() {
      return [];
    },
    fillText(text) {
      spy.texts.push(String(text ?? ''));
    },
    strokeText(text) {
      spy.texts.push(String(text ?? ''));
    },
    measureText(text) {
      const str = String(text ?? '');
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font || '');
      const px = m ? Number(m[1]) : 12;
      let width = 0;
      for (const ch of str) {
        width += ch.charCodeAt(0) > 0x7f ? px * 0.96 : px * 0.56;
      }
      return {
        width,
        actualBoundingBoxAscent: px * 0.8,
        actualBoundingBoxDescent: px * 0.2
      };
    },
    drawImage() {},
    createImageData(w = 1, h = 1) {
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
    getImageData(_x, _y, w = 1, h = 1) {
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
    putImageData() {}
  };

  return ctx;
}

function inferSpriteDims(src) {
  const s = String(src || '');
  if (s.includes('bg_lobby_ch') || s.includes('title_hero_v2')) return { w: 750, h: 1334 };
  if (s.includes('title_plaque_banner')) return { w: 640, h: 491 };
  if (s.includes('lobby_plaque_blank')) return { w: 428, h: 290 };
  if (s.includes('patron_')) return { w: 320, h: 320 };
  if (s.includes('catcake_')) return { w: 256, h: 256 };
  return { w: 192, h: 192 };
}

function createMockWebAudioContext(spy) {
  function makeParam(initial = 0) {
    return {
      value: initial,
      setValueAtTime(v) {
        this.value = v;
      },
      linearRampToValueAtTime(v) {
        this.value = v;
      },
      exponentialRampToValueAtTime(v) {
        this.value = v;
      },
      setTargetAtTime(v) {
        this.value = v;
      },
      cancelScheduledValues() {}
    };
  }

  const gainNodes = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: {},
    _gainNodes: gainNodes,
    resume() {
      this.state = 'running';
      return Promise.resolve();
    },
    createGain() {
      const node = {
        gain: makeParam(1),
        connect() {
          return this;
        },
        disconnect() {}
      };
      gainNodes.push(node);
      return node;
    },
    createOscillator() {
      return {
        type: 'sine',
        frequency: makeParam(440),
        detune: makeParam(0),
        connect() {
          return this;
        },
        disconnect() {},
        start() {
          spy.oscillatorStarts += 1;
        },
        stop() {}
      };
    },
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: makeParam(12500),
        Q: makeParam(1),
        gain: makeParam(0),
        connect() {
          return this;
        },
        disconnect() {}
      };
    },
    createDynamicsCompressor() {
      return {
        threshold: makeParam(-14),
        knee: makeParam(18),
        ratio: makeParam(3),
        attack: makeParam(0.008),
        release: makeParam(0.22),
        connect() {
          return this;
        },
        disconnect() {}
      };
    },
    createDelay() {
      return {
        delayTime: makeParam(0.05),
        connect() {
          return this;
        },
        disconnect() {}
      };
    },
    createStereoPanner() {
      return {
        pan: makeParam(0),
        connect() {
          return this;
        },
        disconnect() {}
      };
    },
    createBuffer(channels = 1, length = 1, sampleRate = 44100) {
      const chData = Array.from({ length: channels }, () => new Float32Array(Math.max(1, length)));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData(ch = 0) {
          return chData[ch] || chData[0];
        }
      };
    },
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        playbackRate: makeParam(1),
        connect() {
          return this;
        },
        disconnect() {},
        start() {},
        stop() {}
      };
    }
  };
  spy.lastAudioCtx = ctx;
  return ctx;
}

function bootMockApp(viewportOpts = {}, initialStorage = {}) {
  const vp = {
    width: viewportOpts.width || 390,
    height: viewportOpts.height || 844,
    dpr: viewportOpts.dpr || 2,
    safeTop: viewportOpts.safeTop ?? 47,
    safeBottom: viewportOpts.safeBottom ?? 34,
    menuRect:
      viewportOpts.menuRect !== undefined
        ? viewportOpts.menuRect
        : { left: 293, top: 51, right: 380, bottom: 83, width: 87, height: 32 }
  };

  const spy = {
    colorStops: [],
    styles: [],
    texts: [],
    userInfoButtons: [],
    setInnerAudioOptionCalls: [],
    createWebAudioContextCalls: 0,
    oscillatorStarts: 0,
    lastAudioCtx: null
  };

  const storage = new Map();
  for (const [k, v] of Object.entries(initialStorage)) {
    storage.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

  const resizeListeners = [];
  const touchListeners = { start: [], move: [], end: [], cancel: [] };
  const keyListeners = [];
  const lifecycleListeners = { show: [], hide: [] };
  const activeTimers = new Set();

  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  const origSetInterval = globalThis.setInterval;
  const origClearInterval = globalThis.clearInterval;
  const origRAF = globalThis.requestAnimationFrame;
  const origCAF = globalThis.cancelAnimationFrame;
  const origWx = globalThis.wx;

  globalThis.setTimeout = (fn, ms, ...args) => {
    const id = origSetTimeout(fn, ms, ...args);
    if (id && typeof id.unref === 'function') id.unref();
    activeTimers.add({ kind: 'timeout', id });
    return id;
  };
  globalThis.clearTimeout = (id) => origClearTimeout(id);
  globalThis.setInterval = (fn, ms, ...args) => {
    const id = origSetInterval(fn, ms, ...args);
    if (id && typeof id.unref === 'function') id.unref();
    activeTimers.add({ kind: 'interval', id });
    return id;
  };
  globalThis.clearInterval = (id) => origClearInterval(id);
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};

  let mainMockCanvas = null;
  const wxImgState = new WeakMap();
  const wxImgProto = {
    get width() {
      return (wxImgState.get(this) || {}).w || 0;
    },
    get height() {
      return (wxImgState.get(this) || {}).h || 0;
    },
    get naturalWidth() {
      return (wxImgState.get(this) || {}).nw || 0;
    },
    get naturalHeight() {
      return (wxImgState.get(this) || {}).nh || 0;
    },
    get complete() {
      return Boolean((wxImgState.get(this) || {}).complete);
    },
    get src() {
      return (wxImgState.get(this) || {}).src || '';
    },
    set src(v) {
      const st = wxImgState.get(this);
      if (!st) return;
      st.src = String(v || '');
      const dims = inferSpriteDims(st.src);
      st.w = dims.w;
      st.h = dims.h;
      st.nw = dims.w;
      st.nh = dims.h;
      st.complete = true;
      queueMicrotask(() => {
        if (typeof this.onload === 'function') this.onload();
      });
    }
  };

  globalThis.wx = {
    getWindowInfo() {
      return {
        windowWidth: vp.width,
        windowHeight: vp.height,
        pixelRatio: vp.dpr,
        statusBarHeight: vp.safeTop,
        safeArea: {
          left: 0,
          top: vp.safeTop,
          right: vp.width,
          bottom: vp.height - vp.safeBottom,
          width: vp.width,
          height: vp.height - vp.safeTop - vp.safeBottom
        }
      };
    },
    getSystemInfoSync() {
      return this.getWindowInfo();
    },
    getMenuButtonBoundingClientRect() {
      return vp.menuRect ? { ...vp.menuRect } : null;
    },
    createCanvas() {
      const canvas = {
        width: Math.round(vp.width * vp.dpr),
        height: Math.round(vp.height * vp.dpr),
        style: {},
        _ctx: null,
        getContext(type) {
          if (type !== '2d') return null;
          if (!this._ctx) this._ctx = createMockCanvas2D(this, spy);
          return this._ctx;
        },
        getBoundingClientRect() {
          return {
            left: 0,
            top: 0,
            right: vp.width,
            bottom: vp.height,
            width: vp.width,
            height: vp.height
          };
        },
        addEventListener() {},
        removeEventListener() {}
      };
      if (!mainMockCanvas) mainMockCanvas = canvas;
      return canvas;
    },
    createImage() {
      const img = Object.create(wxImgProto);
      wxImgState.set(img, { w: 192, h: 192, nw: 192, nh: 192, complete: false, src: '' });
      img.onload = null;
      img.onerror = null;
      return img;
    },
    getStorageSync(key) {
      return storage.has(key) ? storage.get(key) : '';
    },
    setStorageSync(key, val) {
      storage.set(key, typeof val === 'string' ? val : JSON.stringify(val));
    },
    removeStorageSync(key) {
      storage.delete(key);
    },
    clearStorageSync() {
      storage.clear();
    },
    onWindowResize(cb) {
      if (typeof cb === 'function') resizeListeners.push(cb);
    },
    onTouchStart(cb) {
      if (typeof cb === 'function') touchListeners.start.push(cb);
    },
    onTouchMove(cb) {
      if (typeof cb === 'function') touchListeners.move.push(cb);
    },
    onTouchEnd(cb) {
      if (typeof cb === 'function') touchListeners.end.push(cb);
    },
    onTouchCancel(cb) {
      if (typeof cb === 'function') touchListeners.cancel.push(cb);
    },
    onKeyDown(cb) {
      if (typeof cb === 'function') keyListeners.push(cb);
    },
    onShow(cb) {
      if (typeof cb === 'function') lifecycleListeners.show.push(cb);
    },
    onHide(cb) {
      if (typeof cb === 'function') lifecycleListeners.hide.push(cb);
    },
    setInnerAudioOption(opts) {
      spy.setInnerAudioOptionCalls.push(opts);
    },
    createWebAudioContext() {
      spy.createWebAudioContextCalls += 1;
      return createMockWebAudioContext(spy);
    },
    vibrateShort() {},
    showShareMenu() {},
    onShareAppMessage() {},
    shareAppMessage() {},
    setUserCloudStorage() {},
    createUserInfoButton(cfg) {
      const rec = { cfg, destroyed: false, tapCb: null };
      spy.userInfoButtons.push(rec);
      return {
        show() {},
        hide() {},
        destroy() {
          rec.destroyed = true;
        },
        onTap(cb) {
          rec.tapCb = cb;
        }
      };
    }
  };

  // Reload runtime controller & UI modules with fresh platform state
  for (const modName of [
    'platform.js',
    'ui_draw.js',
    'board_renderer.js',
    'screens_ui.js',
    'modals_ui.js',
    'game_app.js'
  ]) {
    const resolved = path.join(SRC_DIR, modName);
    delete require.cache[resolved];
  }

  const { createApp } = require(path.join(SRC_DIR, 'game_app.js'));
  const appInstance = createApp();
  const dbg = globalThis.__HOSHI_DEBUG__;

  return {
    app: appInstance,
    dbg,
    spy,
    storage,
    resizeListeners,
    touchListeners,
    keyListeners,
    lifecycleListeners,
    async flushAssets() {
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => queueMicrotask(r));
      }
      if (dbg && typeof dbg.advanceTime === 'function') {
        dbg.advanceTime(0);
      }
    },
    dispose() {
      for (const t of activeTimers) {
        if (t.kind === 'timeout') origClearTimeout(t.id);
        else origClearInterval(t.id);
      }
      activeTimers.clear();
      globalThis.setTimeout = origSetTimeout;
      globalThis.clearTimeout = origClearTimeout;
      globalThis.setInterval = origSetInterval;
      globalThis.clearInterval = origClearInterval;
      globalThis.requestAnimationFrame = origRAF;
      globalThis.cancelAnimationFrame = origCAF;
      if (origWx === undefined) {
        delete globalThis.wx;
      } else {
        globalThis.wx = origWx;
      }
    }
  };
}

// ============================================================================
// Section A — L1 `grid_engine.js` Unit Tests (UT-G01 .. UT-G11)
// ============================================================================

async function runSectionA() {
  await runTest('UT-G01', '缺角 # 边界阻挡 (Void # Boundary Isolation)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['..#.'] },
      [
        { r: 0, c: 0, tier: 1, flavor: 'plain' },
        { r: 0, c: 3, tier: 1, flavor: 'plain' }
      ]
    );
    const resL = GridEngine.slideGrid(gs, 'left', { skipSpawn: true });
    assert.equal(resL.moved, false);
    assert.equal(gs.cells[0][0].tile.tier, 1);
    assert.equal(gs.cells[0][3].tile.tier, 1);

    const resR = GridEngine.slideGrid(gs, 'right', { skipSpawn: true });
    assert.equal(resR.moved, true);
    assert.equal(resR.mergeEvents.length, 0);
    assert.equal(gs.cells[0][0].tile, null);
    assert.equal(gs.cells[0][1].tile.tier, 1);
    assert.equal(gs.cells[0][2].type, 'void');
    assert.equal(gs.cells[0][2].tile, null);
    assert.equal(gs.cells[0][3].tile.tier, 1);
  });

  await runTest('UT-G02', '障碍柱 X 分段滑道 (Block X Segmented Lane)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['.X..'] },
      [
        { r: 0, c: 2, tier: 1, flavor: 'plain' },
        { r: 0, c: 3, tier: 1, flavor: 'plain' }
      ]
    );
    const res = GridEngine.slideGrid(gs, 'left', { skipSpawn: true });
    assert.equal(res.moved, true);
    assert.equal(res.mergeEvents.length, 1);
    assert.equal(res.mergeEvents[0].r, 0);
    assert.equal(res.mergeEvents[0].c, 2);
    assert.equal(gs.cells[0][2].tile.tier, 2);
    assert.equal(gs.cells[0][3].tile, null);
    assert.equal(gs.cells[0][0].tile, null);

    const resAgain = GridEngine.slideGrid(gs, 'left', { skipSpawn: true });
    assert.equal(resAgain.moved, false);
  });

  await runTest('UT-G03', '单步防连合规范 (Single-Step Non-Chaining Merge)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['....'] },
      [
        { r: 0, c: 0, tier: 1 },
        { r: 0, c: 1, tier: 1 },
        { r: 0, c: 2, tier: 2 }
      ]
    );
    const res = GridEngine.slideGrid(gs, 'left', { skipSpawn: true });
    assert.equal(res.moved, true);
    assert.equal(res.mergeEvents.length, 1);
    assert.deepEqual(rowTiers(gs, 0), [2, 2, null, null]);
  });

  await runTest('UT-G04', '四连合并规则 (Four-in-a-Row Pairwise Merge)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['....'] },
      [
        { r: 0, c: 0, tier: 1 },
        { r: 0, c: 1, tier: 1 },
        { r: 0, c: 2, tier: 1 },
        { r: 0, c: 3, tier: 1 }
      ]
    );
    const res = GridEngine.slideGrid(gs, 'left', { skipSpawn: true });
    assert.equal(res.moved, true);
    assert.equal(res.mergeEvents.length, 2);
    assert.deepEqual(rowTiers(gs, 0), [2, 2, null, null]);
  });

  await runTest('UT-G05', '满阶封顶保护 (Max Tier C7 Cap Protection)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['...'] },
      [
        { r: 0, c: 1, tier: 7 },
        { r: 0, c: 2, tier: 7 }
      ]
    );
    const res1 = GridEngine.slideGrid(gs, 'left', { skipSpawn: true });
    assert.equal(res1.moved, true);
    assert.equal(res1.mergeEvents.length, 0);
    assert.deepEqual(rowTiers(gs, 0), [7, 7, null]);

    const res2 = GridEngine.slideGrid(gs, 'left', { rng: fixedRng });
    assert.equal(res2.moved, false);
    assert.equal(res2.spawned, null);
    assert.deepEqual(rowTiers(gs, 0), [7, 7, null]);

    const spoonMax = GridEngine.upgradeTileAt(gs, 0, 0);
    assert.equal(spoonMax.upgraded, false);
    assert.equal(spoonMax.reason, 'max_tier');
  });

  await runTest('UT-G06', '无效滑动不刷饼 (Blocked Slide Spawns Zero Tiles)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['....'] },
      [
        { r: 0, c: 0, tier: 1 },
        { r: 0, c: 1, tier: 2 }
      ]
    );
    const res = GridEngine.slideGrid(gs, 'left', { c2Rate: 0.1, rng: fixedRng });
    assert.equal(res.moved, false);
    assert.equal(res.spawned, null);
    assert.equal(countBoardTiles(gs), 2);
    assert.equal(gs.cells[0][2].tile, null);
    assert.equal(gs.cells[0][3].tile, null);
  });

  await runTest('UT-G07', '有效滑动必刷 1 饼 (Valid Slide Spawns Exactly 1 C1/C2)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['....'] },
      [
        { r: 0, c: 1, tier: 1 },
        { r: 0, c: 2, tier: 1 }
      ]
    );
    const beforeCount = countBoardTiles(gs);
    assert.equal(beforeCount, 2);

    const res = GridEngine.slideGrid(gs, 'left', { c2Rate: 0.1, rng: fixedRng });
    assert.equal(res.moved, true);
    assert.equal(res.mergeEvents.length, 1);
    assert.notEqual(res.spawned, null);
    assert.ok([1, 2].includes(res.spawned.tile.tier));
    assert.equal(countBoardTiles(gs), beforeCount - res.mergeEvents.length + 1);

    const gsC2 = GridEngine.createGridState({ matrix: ['..'] }, [{ r: 0, c: 1, tier: 3 }]);
    const resC2 = GridEngine.slideGrid(gsC2, 'left', { c2Rate: 1.0, rng: () => 0.99 });
    assert.equal(resC2.moved, true);
    assert.equal(resC2.spawned.tile.tier, 2);
  });

  await runTest('UT-G08', '风味合成防卡死与继承 (Cross-Flavor Merge & Inheritance Priority)', () => {
    // Subcase A: matcha moving into stationary berry -> moving non-plain wins ('matcha')
    const gsA = GridEngine.createGridState(
      { matrix: ['..'] },
      [
        { r: 0, c: 0, tier: 2, flavor: 'berry' },
        { r: 0, c: 1, tier: 2, flavor: 'matcha' }
      ]
    );
    GridEngine.slideGrid(gsA, 'left', { skipSpawn: true });
    assert.equal(gsA.cells[0][0].tile.tier, 3);
    assert.equal(gsA.cells[0][0].tile.flavor, 'matcha');

    // Subcase B: plain moving into stationary berry -> stationary non-plain wins ('berry')
    const gsB = GridEngine.createGridState(
      { matrix: ['..'] },
      [
        { r: 0, c: 0, tier: 2, flavor: 'berry' },
        { r: 0, c: 1, tier: 2, flavor: 'plain' }
      ]
    );
    GridEngine.slideGrid(gsB, 'left', { skipSpawn: true });
    assert.equal(gsB.cells[0][0].tile.tier, 3);
    assert.equal(gsB.cells[0][0].tile.flavor, 'berry');

    // Subcase C: gold dominates regardless of stationary vs moving
    const gsC1 = GridEngine.createGridState(
      { matrix: ['..'] },
      [
        { r: 0, c: 0, tier: 2, flavor: 'gold' },
        { r: 0, c: 1, tier: 2, flavor: 'matcha' }
      ]
    );
    GridEngine.slideGrid(gsC1, 'left', { skipSpawn: true });
    assert.equal(gsC1.cells[0][0].tile.flavor, 'gold');

    const gsC2 = GridEngine.createGridState(
      { matrix: ['..'] },
      [
        { r: 0, c: 0, tier: 2, flavor: 'berry' },
        { r: 0, c: 1, tier: 2, flavor: 'gold' }
      ]
    );
    GridEngine.slideGrid(gsC2, 'left', { skipSpawn: true });
    assert.equal(gsC2.cells[0][0].tile.flavor, 'gold');

    assert.equal(GridEngine.resolveMergedFlavor('plain', 'plain', 'normal'), 'plain');
    assert.equal(GridEngine.resolveMergedFlavor('matcha', 'berry', 'normal'), 'matcha');
    assert.equal(GridEngine.resolveMergedFlavor('plain', 'gold', 'matcha'), 'gold');
  });

  await runTest('UT-G09', '特殊格染色与不降级 (Special Cell G/M/B Dyeing & Gold Non-Downgrade)', () => {
    const gsGoldOnM = GridEngine.createGridState(
      { matrix: ['M.'] },
      [{ r: 0, c: 1, tier: 3, flavor: 'gold' }]
    );
    GridEngine.slideGrid(gsGoldOnM, 'left', { skipSpawn: true });
    assert.equal(gsGoldOnM.cells[0][0].tile.flavor, 'gold');

    const gsGoldOnB = GridEngine.createGridState(
      { matrix: ['B.'] },
      [{ r: 0, c: 1, tier: 3, flavor: 'gold' }]
    );
    GridEngine.slideGrid(gsGoldOnB, 'left', { skipSpawn: true });
    assert.equal(gsGoldOnB.cells[0][0].tile.flavor, 'gold');

    const gsPlainOnG = GridEngine.createGridState(
      { matrix: ['G.'] },
      [{ r: 0, c: 1, tier: 3, flavor: 'plain' }]
    );
    GridEngine.slideGrid(gsPlainOnG, 'left', { skipSpawn: true });
    assert.equal(gsPlainOnG.cells[0][0].tile.flavor, 'gold');

    const gsMatchaOnB = GridEngine.createGridState(
      { matrix: ['B.'] },
      [{ r: 0, c: 1, tier: 3, flavor: 'matcha' }]
    );
    GridEngine.slideGrid(gsMatchaOnB, 'left', { skipSpawn: true });
    assert.equal(gsMatchaOnB.cells[0][0].tile.flavor, 'berry');
  });

  await runTest('UT-G10', '破冰仅限正交 4 邻接且本步不滑走 (Orthogonal-Only Ice Shatter & Stay-in-Place)', () => {
    // Diagonal merge at (0,0) must NOT shatter frozen tile at (1,1)
    const gsDiag = GridEngine.createGridState(
      { matrix: ['...', '.I.', '...'] },
      [
        { r: 0, c: 0, tier: 1 },
        { r: 0, c: 1, tier: 1 },
        { r: 1, c: 1, tier: 4, frozen: true }
      ]
    );
    const resDiag = GridEngine.slideGrid(gsDiag, 'left', { skipSpawn: true });
    assert.equal(resDiag.moved, true);
    assert.equal(resDiag.mergeEvents[0].r, 0);
    assert.equal(resDiag.mergeEvents[0].c, 0);
    assert.equal(resDiag.brokenIceCells.length, 0);
    assert.equal(gsDiag.cells[1][1].tile.frozenHp, 1);

    // Orthogonal merge at (0,1) MUST shatter (1,1) to frozenHp=0 AND keep (1,1) stationary this turn
    const gsOrtho = GridEngine.createGridState(
      { matrix: ['..#', '.I.', '...'] },
      [
        { r: 0, c: 0, tier: 2 },
        { r: 0, c: 1, tier: 2 },
        { r: 1, c: 1, tier: 4, frozen: true }
      ]
    );
    const resOrtho = GridEngine.slideGrid(gsOrtho, 'right', { skipSpawn: true });
    assert.equal(resOrtho.moved, true);
    assert.equal(resOrtho.mergeEvents.length, 1);
    assert.equal(resOrtho.mergeEvents[0].r, 0);
    assert.equal(resOrtho.mergeEvents[0].c, 1);
    assert.equal(resOrtho.brokenIceCells.length, 1);
    assert.equal(resOrtho.brokenIceCells[0].r, 1);
    assert.equal(resOrtho.brokenIceCells[0].c, 1);
    assert.equal(gsOrtho.cells[1][1].tile.frozenHp, 0);
    assert.equal(gsOrtho.cells[1][1].tile.tier, 4);
    assert.equal(gsOrtho.cells[1][2].tile, null);

    // Next turn, thawed C4 at (1,1) can slide freely to (1,2)
    const resNext = GridEngine.slideGrid(gsOrtho, 'right', { skipSpawn: true });
    assert.equal(resNext.moved, true);
    assert.equal(gsOrtho.cells[1][1].tile, null);
    assert.equal(gsOrtho.cells[1][2].tile.tier, 4);
  });

  await runTest('UT-G11', '揉面补料边界测试 (Knead Spawn Dyeing & Full-Board Guard)', () => {
    const gs = GridEngine.createGridState({ matrix: ['MB'] }, []);
    const k1 = GridEngine.kneadSpawn(gs, { c2Rate: 0, rng: () => 0.1 });
    assert.equal(k1.spawned, true);
    assert.equal(k1.r, 0);
    assert.equal(k1.c, 0);
    assert.equal(k1.tile.tier, 1);
    assert.equal(k1.tile.flavor, 'matcha');

    const k2 = GridEngine.kneadSpawn(gs, { c2Rate: 1, rng: () => 0.9 });
    assert.equal(k2.spawned, true);
    assert.equal(k2.r, 0);
    assert.equal(k2.c, 1);
    assert.equal(k2.tile.tier, 2);
    assert.equal(k2.tile.flavor, 'berry');

    const k3 = GridEngine.kneadSpawn(gs, { c2Rate: 0.1, rng: fixedRng });
    assert.deepEqual(k3, { spawned: false, reason: 'board_full' });
  });

  await runTest('UT-G12', '挑拣移位叉：单点破冰与直投厨余销毁 (applyForkAction shatter_ice & trash, 0 Spawns)', () => {
    // 1) 1-step ice shatter on 'I' cell with G/M/B dye check
    const gsIce = GridEngine.createGridState(
      { matrix: ['I.M'] },
      [
        { r: 0, c: 0, tier: 4, flavor: 'plain', frozen: true },
        { r: 0, c: 2, tier: 2, flavor: 'plain' }
      ]
    );
    const beforeCount = countBoardTiles(gsIce);
    const resIce = GridEngine.applyForkAction(gsIce, 0, 0);
    assert.equal(resIce.applied, true);
    assert.equal(resIce.mode, 'shatter_ice');
    assert.equal(resIce.shatteredIce, true);
    assert.equal(gsIce.cells[0][0].tile.frozenHp, 0);
    assert.equal(gsIce.cells[0][0].tile.tier, 4);
    assert.equal(countBoardTiles(gsIce), beforeCount);

    // 2) Direct trash on non-frozen tile frees board slot with 0 spawns
    const resTrash = GridEngine.applyForkAction(gsIce, 0, 2, undefined, undefined, { discardToTrash: true });
    assert.equal(resTrash.applied, true);
    assert.equal(resTrash.mode, 'trash');
    assert.equal(resTrash.removed, true);
    assert.equal(gsIce.cells[0][2].tile, null);
    assert.equal(countBoardTiles(gsIce), beforeCount - 1);
  });

  await runTest('UT-G13', '挑拣移位叉：跨障挪移与落点染色 (applyForkAction move Across #/X/I + G/M/B Dye)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['.X#MG'] },
      [
        { r: 0, c: 0, tier: 3, flavor: 'plain' }
      ]
    );
    // Move across X and # onto M -> dyed matcha, 0 spawns
    const r1 = GridEngine.applyForkAction(gs, 0, 0, 0, 3);
    assert.equal(r1.applied, true);
    assert.equal(r1.mode, 'move');
    assert.equal(gs.cells[0][0].tile, null);
    assert.equal(gs.cells[0][3].tile.tier, 3);
    assert.equal(gs.cells[0][3].tile.flavor, 'matcha');
    assert.equal(countBoardTiles(gs), 1);

    // Move onto G -> dyed gold; then move back to M -> gold never downgrades!
    const r2 = GridEngine.applyForkAction(gs, 0, 3, 0, 4);
    assert.equal(r2.applied, true);
    assert.equal(r2.mode, 'move');
    assert.equal(gs.cells[0][4].tile.flavor, 'gold');

    const r3 = GridEngine.applyForkAction(gs, 0, 4, 0, 3);
    assert.equal(r3.applied, true);
    assert.equal(r3.mode, 'move');
    assert.equal(gs.cells[0][3].tile.flavor, 'gold');
  });

  await runTest('UT-G14', '挑拣移位叉：跨格同阶合并、震碎邻冰与高阶充能 (applyForkAction merge + Ortho Ice + C5 Charge)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['.X.', '.I.', '..B'] },
      [
        { r: 0, c: 0, tier: 4, flavor: 'matcha' },
        { r: 0, c: 2, tier: 4, flavor: 'plain' },
        { r: 1, c: 1, tier: 3, flavor: 'plain', frozen: true },
        { r: 2, c: 0, tier: 2, flavor: 'plain' },
        { r: 2, c: 2, tier: 2, flavor: 'plain' }
      ]
    );
    // Merge C2(2,0) into C2(2,2 on B) -> C3 berry, orthogonal to nothing frozen, newTier=3 (<5 -> skillChargeGain=0)
    const lowMerge = GridEngine.applyForkAction(gs, 2, 0, 2, 2);
    assert.equal(lowMerge.applied, true);
    assert.equal(lowMerge.mode, 'merge');
    assert.equal(lowMerge.newTier, 3);
    assert.equal(lowMerge.skillChargeGain, 0);
    assert.equal(gs.cells[2][0].tile, null);
    assert.equal(gs.cells[2][2].tile.tier, 3);
    assert.equal(gs.cells[2][2].tile.flavor, 'berry');

    // Move C4(0,2) to (0,1)? Wait: (0,1) is X, so move C4(0,2) to (1,2) then merge C4(0,0) into (1,0) orthogonal to (1,1)!
    assert.equal(GridEngine.applyForkAction(gs, 0, 2, 1, 0).mode, 'move');
    const highMerge = GridEngine.applyForkAction(gs, 0, 0, 1, 0);
    assert.equal(highMerge.applied, true);
    assert.equal(highMerge.mode, 'merge');
    assert.equal(highMerge.newTier, 5);
    assert.equal(highMerge.skillChargeGain, 8);
    assert.equal(highMerge.brokenIceCells.length, 1);
    assert.equal(gs.cells[1][1].tile.frozenHp, 0);
    assert.equal(gs.cells[0][0].tile, null);
    assert.equal(gs.cells[1][0].tile.tier, 5);
    assert.equal(gs.cells[1][0].tile.flavor, 'matcha');
  });

  await runTest('UT-G15', '挑拣移位叉：异阶/双C7互换与非法落点零副作用回滚 (applyForkAction swap & Atomic Rollback)', () => {
    const gs = GridEngine.createGridState(
      { matrix: ['M#GB', '.X.I'] },
      [
        { r: 0, c: 0, tier: 2, flavor: 'matcha' },
        { r: 0, c: 2, tier: 5, flavor: 'plain' }, // dyed gold by G on init
        { r: 0, c: 3, tier: 7, flavor: 'berry' },
        { r: 1, c: 0, tier: 7, flavor: 'plain' },
        { r: 1, c: 2, tier: 4, flavor: 'plain' },
        { r: 1, c: 3, tier: 3, flavor: 'plain', frozen: true }
      ]
    );
    // Heterogeneous swap 1: C2(0,0 on M) <-> C4(1,2 on .) -> C4 becomes matcha at (0,0), C2 stays matcha at (1,2)
    const sw0 = GridEngine.applyForkAction(gs, 0, 0, 1, 2);
    assert.equal(sw0.applied, true);
    assert.equal(sw0.mode, 'swap');
    assert.equal(gs.cells[0][0].tile.tier, 4);
    assert.equal(gs.cells[0][0].tile.flavor, 'matcha');
    assert.equal(gs.cells[1][2].tile.tier, 2);
    assert.equal(gs.cells[1][2].tile.flavor, 'matcha');

    // Heterogeneous swap 2: C4(0,0 on M) <-> C5_gold(0,2 on G) -> C4 becomes gold at (0,2), C5_gold stays gold on M!
    const sw1 = GridEngine.applyForkAction(gs, 0, 0, 0, 2);
    assert.equal(sw1.applied, true);
    assert.equal(sw1.mode, 'swap');
    assert.equal(gs.cells[0][0].tile.tier, 5);
    assert.equal(gs.cells[0][0].tile.flavor, 'gold');
    assert.equal(gs.cells[0][2].tile.tier, 4);
    assert.equal(gs.cells[0][2].tile.flavor, 'gold');

    // Dual max-tier C7 swap: C7(0,3 on B) <-> C7(1,0 on .) -> swaps cleanly instead of failing merge!
    const swMax = GridEngine.applyForkAction(gs, 0, 3, 1, 0);
    assert.equal(swMax.applied, true);
    assert.equal(swMax.mode, 'swap');
    assert.equal(gs.cells[1][0].tile.tier, 7);
    assert.equal(gs.cells[1][0].tile.flavor, 'berry');
    assert.equal(gs.cells[0][3].tile.tier, 7);
    assert.equal(gs.cells[0][3].tile.flavor, 'berry'); // dyed berry by B cell!

    // Invalid targets (#, X, frozen tile, same cell, OOB) MUST return applied: false with 0 mutation
    const snap = JSON.stringify(gs.cells);
    assert.equal(GridEngine.applyForkAction(gs, 0, 0, 0, 1).applied, false); // void #
    assert.equal(GridEngine.applyForkAction(gs, 0, 0, 1, 1).applied, false); // block X
    assert.equal(GridEngine.applyForkAction(gs, 0, 0, 1, 3).applied, false); // frozen destination
    assert.equal(GridEngine.applyForkAction(gs, 1, 3, 1, 2).applied, false); // frozen source with destination
    assert.equal(GridEngine.applyForkAction(gs, 0, 0, 0, 0).applied, false); // same cell
    assert.equal(GridEngine.applyForkAction(gs, 0, 0, 9, 9).applied, false); // OOB
    assert.equal(JSON.stringify(gs.cells), snap);
  });
}

// ============================================================================
// Section B — L1 `order_service.js` & Pure Serve-Only Iron Law (UT-O01 .. UT-O09)
// ============================================================================

async function runSectionB() {
  await runTest('UT-O01', '全局唯一得分铁律 (Global Pure Serve-Only Scoring Iron Law incl. All 5 Fork Modes)', () => {
    const gs = GridEngine.createGridState(Levels.getLevelById('3-1'));
    assert.equal(Object.prototype.hasOwnProperty.call(gs, 'score'), false);

    const os = OrderService.createOrderState('3-1', SaveSync.createDefaultSave(), fixedRng);
    os.seats[0] = {
      uid: 1,
      customerId: 'cust_critic',
      recipeId: 'R21',
      slots: [{ tier: 7, flavor: 'any' }],
      patience: 30,
      maxPatience: 30,
      bountyMult: 1.5,
      isVip: true,
      isUrgent: false
    };
    os.seats[1] = null;
    os.seats[2] = null;
    assert.equal(os.score, 0);

    // 10 slides (asserting real movement & merges occur while score stays 0)
    let movedSlides = 0;
    let totalMerges = 0;
    const dirs = ['left', 'right', 'up', 'down'];
    for (let i = 0; i < 10; i++) {
      const sr = GridEngine.slideGrid(gs, dirs[i % 4], { rng: mulberry32(100 + i) });
      if (sr.moved) movedSlides++;
      totalMerges += sr.mergeEvents.length;
      assert.equal(os.score, 0);
    }
    assert.ok(movedSlides >= 1 && totalMerges >= 1);

    // Ensure space and execute 5 real knead spawns
    const gsKnead = GridEngine.createGridState({ matrix: ['.....', '.....', '.....'] }, []);
    for (let i = 0; i < 5; i++) {
      const kr = GridEngine.kneadSpawn(gsKnead, { rng: mulberry32(200 + i) });
      assert.equal(kr.spawned, true);
      assert.equal(os.score, 0);
    }

    // 1 explicit orthogonal ice shatter (frozenHp 1 -> 0)
    const gsIce = GridEngine.createGridState(Levels.getLevelById('3-1'));
    assert.equal(gsIce.cells[1][2].tile.frozenHp, 1);
    const shattered = GridEngine.shatterAdjacentIce(gsIce, 0, 2);
    assert.ok(shattered.length >= 1);
    assert.equal(gsIce.cells[1][2].tile.frozenHp, 0);
    assert.equal(os.score, 0);

    // 2 partial tray placements (unmatched to C7 order)
    assert.equal(OrderService.tryPlaceToTray(os, { uid: 501, tier: 1, flavor: 'plain' }).placed, true);
    assert.equal(OrderService.tryPlaceToTray(os, { uid: 502, tier: 2, flavor: 'plain' }).placed, true);
    assert.equal(OrderService.matchTrayToCustomer(os).served, false);
    assert.equal(os.score, 0);

    // 1 double-tap discard into trash
    assert.equal(OrderService.discardTraySlot(os, 0).discarded, true);
    assert.equal(os.score, 0);

    // Utensils: spoon upgrade + all 5 Relocate Fork modes (shatter_ice, trash, move, merge, swap)
    assert.equal(GridEngine.upgradeTileAt(gsIce, 0, 1).upgraded, true);
    const gsFork5 = GridEngine.createGridState(
      { matrix: ['I....'] },
      [
        { r: 0, c: 0, tier: 3, flavor: 'plain', frozen: true },
        { r: 0, c: 1, tier: 2, flavor: 'plain' },
        { r: 0, c: 2, tier: 2, flavor: 'plain' },
        { r: 0, c: 3, tier: 4, flavor: 'plain' }
      ]
    );
    assert.equal(GridEngine.applyForkAction(gsFork5, 0, 0).mode, 'shatter_ice');
    assert.equal(GridEngine.applyForkAction(gsFork5, 0, 1, 0, 4).mode, 'move');
    assert.equal(GridEngine.applyForkAction(gsFork5, 0, 4, 0, 2).mode, 'merge');
    assert.equal(GridEngine.applyForkAction(gsFork5, 0, 2, 0, 3).mode, 'swap');
    assert.equal(GridEngine.applyForkAction(gsFork5, 0, 3, undefined, undefined, { discardToTrash: true }).mode, 'trash');
    assert.equal(os.score, 0);

    // All 3 patron active skills
    GridEngine.applyLunaBoardTidy(gsKnead);
    GridEngine.applyMugiBoardBlast(gsIce, fixedRng);
    OrderService.applyMikanComfortTea(os);
    assert.equal(os.score, 0);

    // First complete customer serve -> SOLE path where score becomes > 0
    assert.equal(OrderService.tryPlaceToTray(os, { uid: 503, tier: 7, flavor: 'plain' }).placed, true);
    const serveRes = OrderService.matchTrayToCustomer(os);
    assert.equal(serveRes.served, true);
    assert.equal(os.ordersServed, 1);
    assert.ok(os.score > 0);
    assert.equal(os.score, serveRes.scoreGain);
  });

  await runTest('UT-O02', '重复阶数套餐精准匹配 (Duplicate-Tier Multiset Matching R06: C2 + C2)', () => {
    const os = OrderService.createOrderState('1-2', SaveSync.createDefaultSave(), fixedRng);
    os.seats[0] = {
      uid: 10,
      customerId: 'cust_ragdoll',
      recipeId: 'R06',
      slots: [
        { tier: 2, flavor: 'any' },
        { tier: 2, flavor: 'any' }
      ],
      patience: 20,
      maxPatience: 25,
      bountyMult: 1.0,
      isVip: false,
      isUrgent: false
    };

    OrderService.tryPlaceToTray(os, { uid: 1, tier: 2, flavor: 'plain' });
    const partial = OrderService.matchCustomerWithTray(os.seats[0], os.tray);
    assert.equal(partial.fullMatch, false);
    assert.deepEqual(partial.slotMatches, [0, null]);
    assert.deepEqual(partial.usedTrayIndices, [0]);
    assert.equal(OrderService.matchTrayToCustomer(os).served, false);
    assert.equal(os.score, 0);

    OrderService.tryPlaceToTray(os, { uid: 2, tier: 2, flavor: 'plain' });
    const res = OrderService.matchTrayToCustomer(os);
    assert.equal(res.served, true);
    assert.deepEqual(res.usedTrayIndices, [0, 1]);
    assert.equal(os.tray[0], null);
    assert.equal(os.tray[1], null);
    assert.ok(os.score > 0);
  });

  await runTest('UT-O03', '风味约束与镀金王牌 (Constrained Flavor & Gold Wildcard x1.35)', () => {
    const save = { ...SaveSync.createDefaultSave(), selectedPatron: 'none' };
    const os = OrderService.createOrderState('2-1', save, fixedRng);
    os.seats[0] = {
      uid: 11,
      customerId: 'cust_silver',
      recipeId: 'R04',
      slots: [{ tier: 3, flavor: 'matcha' }],
      patience: 10,
      maxPatience: 25,
      bountyMult: 1.0,
      isVip: false,
      isUrgent: false
    };

    OrderService.tryPlaceToTray(os, { uid: 1, tier: 3, flavor: 'plain' });
    assert.equal(OrderService.matchTrayToCustomer(os).served, false);
    assert.equal(os.score, 0);

    OrderService.tryPlaceToTray(os, { uid: 2, tier: 3, flavor: 'gold' });
    const res = OrderService.matchTrayToCustomer(os);
    assert.equal(res.served, true);
    assert.deepEqual(res.usedTrayIndices, [1]);
    assert.notEqual(os.tray[0], null);
    assert.equal(os.tray[0].flavor, 'plain');
    assert.equal(res.scoreGain, 203); // round(150 * 1.35) = 203 in v0.9.0
    assert.equal(os.score, 203);
  });

  await runTest('UT-O04', '保留普通消耗策略 (Conserve Gold Wildcard on any Slot: plain -> flavored -> gold)', () => {
    const osA = OrderService.createOrderState('2-1', SaveSync.createDefaultSave(), fixedRng);
    osA.seats[0] = {
      uid: 21,
      customerId: 'cust_ragdoll',
      slots: [{ tier: 2, flavor: 'any' }],
      patience: 20,
      maxPatience: 25,
      bountyMult: 1.0,
      isVip: false,
      isUrgent: false
    };
    OrderService.tryPlaceToTray(osA, { uid: 1, tier: 2, flavor: 'gold' });
    OrderService.tryPlaceToTray(osA, { uid: 2, tier: 2, flavor: 'plain' });
    const resA = OrderService.matchTrayToCustomer(osA);
    assert.equal(resA.served, true);
    assert.deepEqual(resA.usedTrayIndices, [1]);
    assert.equal(osA.tray[0].flavor, 'gold');
    assert.equal(osA.tray[1], null);

    // Flavored before gold when plain is absent
    const osB = OrderService.createOrderState('2-1', SaveSync.createDefaultSave(), fixedRng);
    osB.seats[0] = {
      uid: 22,
      customerId: 'cust_ragdoll',
      slots: [{ tier: 2, flavor: 'any' }],
      patience: 20,
      maxPatience: 25,
      bountyMult: 1.0,
      isVip: false,
      isUrgent: false
    };
    OrderService.tryPlaceToTray(osB, { uid: 3, tier: 2, flavor: 'gold' });
    OrderService.tryPlaceToTray(osB, { uid: 4, tier: 2, flavor: 'matcha' });
    const resB = OrderService.matchTrayToCustomer(osB);
    assert.equal(resB.served, true);
    assert.deepEqual(resB.usedTrayIndices, [1]);
    assert.equal(osB.tray[0].flavor, 'gold');

    // Full 3-tier priority on 'any': [gold, matcha, plain] consumes plain first
    const osC = OrderService.createOrderState('2-1', SaveSync.createDefaultSave(), fixedRng);
    osC.seats[0] = {
      uid: 23,
      customerId: 'cust_ragdoll',
      slots: [{ tier: 2, flavor: 'any' }],
      patience: 20,
      maxPatience: 25,
      bountyMult: 1.0,
      isVip: false,
      isUrgent: false
    };
    OrderService.tryPlaceToTray(osC, { uid: 5, tier: 2, flavor: 'gold' });
    OrderService.tryPlaceToTray(osC, { uid: 6, tier: 2, flavor: 'matcha' });
    OrderService.tryPlaceToTray(osC, { uid: 7, tier: 2, flavor: 'plain' });
    const resC = OrderService.matchTrayToCustomer(osC);
    assert.equal(resC.served, true);
    assert.deepEqual(resC.usedTrayIndices, [2]);
    assert.equal(osC.tray[0].flavor, 'gold');
    assert.equal(osC.tray[1].flavor, 'matcha');
    assert.equal(osC.tray[2], null);
  });

  await runTest('UT-O05', '多顾客同时满足裁决 (Tie-Breaker: Lowest Patience vs Manual Lock & <0.10 VIP/Urgent)', () => {
    function makeDualState() {
      const os = OrderService.createOrderState('1-1', SaveSync.createDefaultSave(), fixedRng);
      os.seats[0] = {
        uid: 31,
        customerId: 'cust_ragdoll',
        slots: [{ tier: 2, flavor: 'any' }],
        patience: 20,
        maxPatience: 25, // 80%
        bountyMult: 1.0,
        isVip: false,
        isUrgent: false
      };
      os.seats[1] = {
        uid: 32,
        customerId: 'cust_orange',
        slots: [{ tier: 2, flavor: 'any' }],
        patience: 3.75,
        maxPatience: 25, // 15%
        bountyMult: 1.0,
        isVip: false,
        isUrgent: false
      };
      OrderService.tryPlaceToTray(os, { uid: 1, tier: 2, flavor: 'plain' });
      return os;
    }

    // Unlocked -> lowest patience Seat 1
    const osUnlocked = makeDualState();
    assert.equal(OrderService.matchTrayToCustomer(osUnlocked).seatIdx, 1);

    // Locked to Seat 0 -> preferredSeatIdx wins
    const osLocked = makeDualState();
    osLocked.preferredSeatIdx = 0;
    assert.equal(OrderService.matchTrayToCustomer(osLocked).seatIdx, 0);

    // Within <0.10 patience gap: isVip > isUrgent > seatIdx
    const osBand = OrderService.createOrderState('2-5', SaveSync.createDefaultSave(), fixedRng);
    osBand.seats[0] = {
      uid: 33,
      customerId: 'cust_ragdoll',
      slots: [{ tier: 2, flavor: 'any' }],
      patience: 12.5,
      maxPatience: 25, // 50%
      bountyMult: 1.0,
      isVip: false,
      isUrgent: false
    };
    osBand.seats[1] = {
      uid: 34,
      customerId: 'cust_fox',
      slots: [{ tier: 2, flavor: 'any' }],
      patience: 13.5,
      maxPatience: 25, // 54%
      bountyMult: 1.25,
      isVip: false,
      isUrgent: true
    };
    osBand.seats[2] = {
      uid: 35,
      customerId: 'cust_critic',
      slots: [{ tier: 2, flavor: 'any' }],
      patience: 14.0,
      maxPatience: 25, // 56% (< 0.10 gap from 50%)
      bountyMult: 1.5,
      isVip: true,
      isUrgent: false
    };
    OrderService.tryPlaceToTray(osBand, { uid: 9, tier: 2, flavor: 'plain' });
    assert.equal(OrderService.matchTrayToCustomer(osBand).seatIdx, 2);

    // Urgent beats regular within <0.10 gap when no VIP
    OrderService.tryPlaceToTray(osBand, { uid: 10, tier: 2, flavor: 'plain' });
    assert.equal(OrderService.matchTrayToCustomer(osBand).seatIdx, 1);

    // Lowest seatIdx wins when two regular seats are within <0.10 gap
    osBand.seats[2] = {
      uid: 36,
      customerId: 'cust_orange',
      slots: [{ tier: 2, flavor: 'any' }],
      patience: 13.0,
      maxPatience: 25, // 52% vs Seat 0's 50%
      bountyMult: 1.0,
      isVip: false,
      isUrgent: false
    };
    OrderService.tryPlaceToTray(osBand, { uid: 11, tier: 2, flavor: 'plain' });
    assert.equal(OrderService.matchTrayToCustomer(osBand).seatIdx, 0);
  });

  await runTest('UT-O06', 'v0.9.0 上菜总公式数值校验 (Exact Formula === 598 & All 24 Recipe baseScoreLv0 Oracles)', () => {
    const order = {
      customerId: 'cust_fox',
      bountyMult: 1.25,
      isUrgent: true,
      patience: 20,
      maxPatience: 25,
      slots: [
        { tier: 2, flavor: 'any' },
        { tier: 3, flavor: 'matcha' }
      ]
    };
    const usedTiles = [
      { tier: 2, flavor: 'plain' },
      { tier: 3, flavor: 'matcha' }
    ];
    const scoreCtx = {
      catcakeLevels: { 2: 1, 3: 0 },
      comboCount: 2,
      patronId: null,
      devTrayLv: 0,
      feverActive: true
    };
    const expectedOracle = Math.round((81 + 150 * 1.25) * 1.12 * 1.20 * 1.06 * 1.25 * 1.25);
    assert.equal(expectedOracle, 598);
    assert.equal(OrderService.computeServeScore(order, usedTiles, scoreCtx), 598);

    // Verify unrounded itemSum float precision oracles (R15===288, R16===616, R18===1778, R24===6750) + all 24 recipes
    const neutralCtx = {
      catcakeLevels: {},
      comboCount: 1,
      patronId: null,
      devTrayLv: 0,
      feverActive: false
    };
    const expectedOracles = { R15: 288, R16: 616, R18: 1778, R24: 6750 };
    for (const [rId, exactScore] of Object.entries(expectedOracles)) {
      const rec = Levels.RECIPES[rId];
      const tiles = rec.slots.map((s) => ({
        tier: s.tier,
        flavor: s.flavor === 'any' ? 'plain' : s.flavor
      }));
      const ord = {
        customerId: 'cust_ragdoll',
        bountyMult: 1.0,
        patience: 10,
        maxPatience: 25,
        slots: rec.slots
      };
      assert.equal(OrderService.computeServeScore(ord, tiles, neutralCtx), exactScore, `${rId} oracle mismatch`);
    }
    for (const rec of Levels.RECIPE_LIST) {
      const tiles = rec.slots.map((s) => ({
        tier: s.tier,
        flavor: s.flavor === 'any' ? 'plain' : s.flavor
      }));
      const ord = {
        customerId: 'cust_ragdoll',
        bountyMult: 1.0,
        patience: 10,
        maxPatience: 25,
        slots: rec.slots
      };
      assert.equal(
        OrderService.computeServeScore(ord, tiles, neutralCtx),
        rec.baseScoreLv0,
        `${rec.id} baseScoreLv0 mismatch`
      );
    }
  });

  await runTest('UT-O07', '顾客耐心归零轻惩罚 (Patience Zero Walkout Resets Combo Without Score Deduction)', () => {
    const os = OrderService.createOrderState('1-1', SaveSync.createDefaultSave(), fixedRng);
    os.score = 500;
    os.comboCount = 3;
    os.comboTimer = 8.0;
    os.seats[0] = {
      uid: 77,
      customerId: 'cust_ragdoll',
      recipeId: 'R01',
      slots: [{ tier: 1, flavor: 'any' }],
      patience: 0.5,
      maxPatience: 25,
      bountyMult: 1.0,
      isVip: false,
      isUrgent: false
    };
    os.seats[1] = null;
    os.seats[2] = null;

    const tick = OrderService.stepCustomers(os, 1.0, { rng: fixedRng });
    assert.deepEqual(tick.angryLeftSeats, [0]);
    assert.equal(os.comboCount, 0);
    assert.equal(os.score, 500);
    assert.equal(os.seats[0], null);
    assert.ok(os.seatCooldowns[0] >= 0.8);
  });

  await runTest('UT-O08', '厨余篮 8.0s 冷却、断连击与扣减 15 热潮能量 (TRASH_CONFIG Cooldown & Zero Score Loss)', () => {
    const os = OrderService.createOrderState('1-3', SaveSync.createDefaultSave(), fixedRng);
    os.score = 620;
    os.comboCount = 3;
    os.comboTimer = 6.5;
    os.feverEnergy = 40;
    OrderService.tryPlaceToTray(os, { uid: 901, tier: 1, flavor: 'plain' });
    OrderService.tryPlaceToTray(os, { uid: 902, tier: 2, flavor: 'plain' });

    const d1 = OrderService.discardTraySlot(os, 0);
    assert.equal(d1.discarded, true);
    assert.equal(os.trashDiscards, 1);
    assert.equal(os.trashCooldown, 8.0);
    assert.equal(os.comboCount, 0);
    assert.equal(os.comboTimer, 0);
    assert.equal(os.feverEnergy, 25);
    assert.equal(os.score, 620); // NEVER deducts earned score!

    // Immediate 2nd discard blocked by 8.0s cooldown
    const d2Blocked = OrderService.discardTraySlot(os, 1);
    assert.equal(d2Blocked.discarded, false);
    assert.equal(d2Blocked.reason, 'cooldown');
    assert.ok(d2Blocked.cooldownLeft > 7.9);
    assert.notEqual(os.tray[1], null);

    // Advance 8.1s via stepCustomers -> cooldown expires -> 2nd discard succeeds
    OrderService.stepCustomers(os, 8.1, { rng: fixedRng });
    assert.equal(os.trashCooldown, 0);
    const d2Ok = OrderService.discardTraySlot(os, 1);
    assert.equal(d2Ok.discarded, true);
    assert.equal(os.trashDiscards, 2);
  });

  await runTest('UT-O09', '同星级纯重刷星尘折半衰减与 modeOverrides 模式解耦校验', () => {
    // 1) First 3-star clear on 1-1: firstStarDustAward (10+15+22=47) + clearDustAward (6) + threeStarBonusDust (4) = 57
    const osFirst = OrderService.createOrderState('1-1', SaveSync.createDefaultSave(), fixedRng);
    osFirst.score = 1800;
    osFirst.ordersServed = 12;
    const setFirst = OrderService.computeLevelSettlement('1-1', osFirst, {});
    assert.equal(setFirst.cleared, true);
    assert.equal(setFirst.starsEarned, 3);
    assert.equal(setFirst.newStarsDelta, 3);
    assert.equal(setFirst.isReplayDecay, false);
    assert.equal(setFirst.firstStarDustAward, 47);
    assert.equal(setFirst.clearDustAward, 6);
    assert.equal(setFirst.threeStarBonusDust, 4);
    assert.equal(setFirst.totalDustAward, 57);

    // 2) Same-star 3-star replay on 1-1 (also testing polymorphic 2-arg call): 0 + ceil(6*0.5)=3 + 2 = 5
    const setReplay = OrderService.computeLevelSettlement(osFirst, { '1-1': 3 });
    assert.equal(setReplay.cleared, true);
    assert.equal(setReplay.starsEarned, 3);
    assert.equal(setReplay.newStarsDelta, 0);
    assert.equal(setReplay.isReplayDecay, true);
    assert.equal(setReplay.firstStarDustAward, 0);
    assert.equal(setReplay.clearDustAward, 3);
    assert.equal(setReplay.threeStarBonusDust, 2);
    assert.equal(setReplay.totalDustAward, 5);

    // 3) 3-10 same-star 3-star replay with 5 VIPs: ceil(14*0.5)=7 + 2 + 5*3 = 24
    const osBoss = OrderService.createOrderState('3-10', SaveSync.createDefaultSave(), fixedRng);
    osBoss.score = 90000;
    osBoss.ordersServed = 18;
    osBoss.vipServed = 5;
    osBoss.vipBonusDustEarned = 20;
    const setBossReplay = OrderService.computeLevelSettlement('3-10', osBoss, { '3-10': 3 });
    assert.equal(setBossReplay.isReplayDecay, true);
    assert.equal(setBossReplay.clearDustAward, 7);
    assert.equal(setBossReplay.threeStarBonusDust, 2);
    assert.equal(setBossReplay.vipDustAward, 15);
    assert.equal(setBossReplay.totalDustAward, 24);

    // 4) modeOverrides decoupling
    const osCustom = OrderService.createOrderState('2-5', SaveSync.createDefaultSave(), fixedRng, {
      durationSec: 180,
      allowedRecipes: ['R15', 'R17'],
      disableTutorial: true,
      customModeTag: 'daily_challenge'
    });
    assert.equal(osCustom.durationSec, 180);
    assert.equal(osCustom.timeLeft, 180);
    assert.deepEqual(osCustom.allowedRecipes, ['R15', 'R17']);
    assert.equal(osCustom.disableTutorial, true);
    assert.equal(osCustom.customModeTag, 'daily_challenge');
  });
}

// ============================================================================
// Section C — L1 `save_sync.js`, `platform.js` & `kissa_sync` (UT-S01 .. UT-S04)
// ============================================================================

async function runSectionC() {
  const v1Fixture = {
    bankStardust: 50,
    unlockedPatrons: ['mikan', 'luna'],
    selectedPatron: 'luna',
    unlockedThemes: ['amber', 'sakura'],
    equippedTheme: 'sakura',
    shopUpgrades: { up_tools: 2, up_fever: 0, up_combo: 0, up_dust: 0 }, // 40 + 90 = 130
    bestChef: 8000
  };

  await runTest('UT-S01', 'v1 -> v2 无损退还与差价补齐 (migrateV1ToV2 & Legacy Run Storage Cleanup)', () => {
    const v2 = SaveSync.migrateV1ToV2(v1Fixture);
    assert.equal(v2.schemaVersion, 2);
    assert.ok(v2.unlockedPatrons.includes('luna'));
    assert.equal(v2.selectedPatron, 'luna');
    assert.ok(v2.unlockedThemes.includes('sakura'));
    assert.equal(v2.equippedTheme, 'sakura');
    assert.equal(SaveSync.computeSpentStardust(v2), 200); // luna (100) + sakura (100) in v0.9.0
    assert.equal(v2.totalEarnedStardust, 430); // 50 + 270(v1Spent) + 60(priceDiffComp) + 50(veteranGift)
    assert.equal(v2.bankStardust, 230); // zero deduction vs v1 balance + 130 refund + 50 gift!
    assert.equal(v2.migratedFromV1GiftPending, true);

    // Verify loadLocalSave purges legacy active_run keys and persists migrated v2 save
    const memMap = new Map([
      [Constants.STORAGE_KEY, JSON.stringify(v1Fixture)],
      ['hoshi_kissa_active_run_v1', '{"score":999}'],
      ['hoshi_kissa_active_runs_v2', '{"chef":{}}'],
      ['hoshi_kissa_saved_runs_v2', '{"rush":{}}']
    ]);
    const mockStoragePlatform = {
      getStorageJSON(k) {
        return memMap.has(k) ? JSON.parse(memMap.get(k)) : null;
      },
      setStorageJSON(k, v) {
        memMap.set(k, JSON.stringify(v));
      },
      removeStorage(k) {
        memMap.delete(k);
      }
    };

    const loaded = SaveSync.loadLocalSave(mockStoragePlatform);
    assert.equal(loaded.schemaVersion, 2);
    assert.equal(loaded.bankStardust, 230);
    assert.equal(memMap.has('hoshi_kissa_active_run_v1'), false);
    assert.equal(memMap.has('hoshi_kissa_active_runs_v2'), false);
    assert.equal(memMap.has('hoshi_kissa_saved_runs_v2'), false);
  });

  await runTest('UT-S02', '双端星尘合并防丢失 (mergeSaveData Offline Delta Conservation & >1500 Clamp)', () => {
    const localSave = {
      ...SaveSync.createDefaultSave(),
      schemaVersion: 2,
      totalEarnedStardust: 345,
      lastSyncedEarnedStardust: 300,
      bankStardust: 345,
      levelStars: { '1-1': 3 },
      levelBestScores: { '1-1': 1500 },
      updatedAt: 2000
    };
    const cloudSave = {
      ...SaveSync.createDefaultSave(),
      schemaVersion: 2,
      totalEarnedStardust: 300,
      lastSyncedEarnedStardust: 300,
      bankStardust: 200,
      catcakeLevels: { 1: 1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, // 25
      deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 0 }, // 75
      updatedAt: 1500
    };

    const merged = SaveSync.mergeSaveData(localSave, cloudSave);
    assert.equal(merged.totalEarnedStardust, 345);
    assert.equal(SaveSync.computeSpentStardust(merged), 100);
    assert.equal(merged.bankStardust, 245);
    assert.equal(merged.bankStardust, merged.totalEarnedStardust - SaveSync.computeSpentStardust(merged));
    assert.equal(merged.levelStars['1-1'], 3);
    assert.equal(merged.catcakeLevels[1], 1);
    assert.equal(merged.deviceUpgrades.dev_tray, 1);

    // Offline delta > 1500 clamped to MAX_OFFLINE_STARDUST_DELTA (1500)
    const inflatedLocal = {
      ...localSave,
      totalEarnedStardust: 5000,
      lastSyncedEarnedStardust: 300,
      bankStardust: 5000
    };
    const clamped = SaveSync.mergeSaveData(inflatedLocal, cloudSave);
    assert.equal(clamped.totalEarnedStardust, 300 + SaveSync.MAX_OFFLINE_STARDUST_DELTA);
    assert.equal(clamped.bankStardust, 1800 - 100);
  });

  await runTest('UT-S03', '客户端↔云函数常量 100% 同构门禁、反作弊与双榜一致性', async () => {
    const cloudVm = loadCloudFunctionInMemory('openid_chef_01_A1B2');
    const { _internal, main: cloudMain } = cloudVm.exports;

    // 100% Isomorphism Gate between client (constants.js + levels_data.js) and cloud (kissa_sync/index.js)
    assert.equal(_internal.SCHEMA_VERSION, SaveSync.SCHEMA_VERSION);
    assert.equal(_internal.DEFAULT_INITIAL_STARDUST, Constants.DEFAULT_INITIAL_STARDUST);
    assert.equal(_internal.DEFAULT_INITIAL_STARDUST, 15);
    assert.deepEqual(deepClone(_internal.CATCAKE_UPGRADE_COSTS), Constants.CATCAKE_UPGRADE_COSTS);
    assert.deepEqual(deepClone(_internal.DEVICE_UPGRADE_COSTS), Constants.DEVICE_UPGRADE_COSTS);
    assert.deepEqual(deepClone(_internal.PATRON_COSTS), Constants.PATRON_COSTS);
    assert.deepEqual(deepClone(_internal.THEME_COSTS), Constants.THEME_COSTS);
    assert.equal(_internal.SHOP_TOTAL_CAP, Constants.SHOP_TOTAL_CAP);
    assert.equal(_internal.SHOP_TOTAL_CAP, 5650);
    assert.equal(_internal.MAX_CAMPAIGN_STARS, Levels.MAX_CAMPAIGN_STARS);
    assert.equal(_internal.MAX_CAMPAIGN_STARS, 90);
    assert.deepEqual(
      deepClone([..._internal.VALID_LEVEL_IDS]).sort(),
      Levels.LEVELS.map((l) => l.id).sort()
    );
    assert.deepEqual(deepClone(_internal.CHAPTER_SCORE_CAPS), { 1: 35000, 2: 90000, 3: 220000 });
    assert.equal(_internal.migrateV1ToV2(v1Fixture).bankStardust, 230);

    // Clean mock cloud storage before testing Platform.runBrowserMockCloud
    Platform.removeStorage('__hoshi_browser_cloud_doc_v1__');
    Platform.removeStorage('__hoshi_browser_cloud_doc_v2__');

    const pullCloud = await cloudMain({ action: 'pull' });
    const pullMock = await Platform.runBrowserMockCloud({ action: 'pull' });
    assert.equal(pullCloud.ok, true);
    assert.equal(pullMock.ok, true);
    assert.equal(pullCloud.metaSave.schemaVersion, 2);
    assert.equal(pullMock.metaSave.schemaVersion, 2);
    assert.equal(pullCloud.metaSave.bankStardust, 15);
    assert.equal(pullMock.metaSave.bankStardust, 15);

    // Anti-cheat: score > 0 with serves < 1 MUST be rejected & rolled back on both
    const cheatMeta = SaveSync.recordLevelSettlementToSave(
      SaveSync.createDefaultSave(),
      '1-1',
      1800,
      3,
      57,
      { ordersServed: 0 }
    );
    const cheatPayload = {
      action: 'push',
      baseRevision: 1,
      metaSave: cheatMeta,
      runReport: { levelId: '1-1', score: 1800, serves: 0, durationSec: 90 }
    };
    const cheatCloudRes = await cloudMain(cheatPayload);
    const cheatMockRes = await Platform.runBrowserMockCloud(cheatPayload);
    assert.equal(cheatCloudRes.ok, true);
    assert.equal(cheatMockRes.ok, true);
    assert.ok(cheatCloudRes.validationWarnings.includes('zero_serve_score_rejected'));
    assert.ok(cheatMockRes.validationWarnings.includes('zero_serve_score_rejected'));
    assert.equal(cheatCloudRes.totalStars, 0);
    assert.equal(cheatMockRes.totalStars, 0);
    assert.equal(cheatCloudRes.metaSave.levelBestScores['1-1'] || 0, 0);
    assert.equal(cheatMockRes.metaSave.levelBestScores['1-1'] || 0, 0);

    // Chapter score caps: 35k / 90k / 220k
    const overCapMeta = {
      ...SaveSync.createDefaultSave(),
      totalEarnedStardust: 400,
      lastSyncedEarnedStardust: 15,
      levelStars: { '1-1': 3, '2-1': 3, '3-1': 3 },
      levelBestScores: { '1-1': 50000, '2-1': 120000, '3-1': 300000 },
      lifetimeStats: {
        runsPlayed: 3,
        ordersServed: 40,
        vipServed: 2,
        maxComboEver: 6,
        highestSingleServe: 8000,
        totalStars: 9,
        totalCumulativeScore: 470000
      }
    };
    const capPayload = {
      action: 'push',
      baseRevision: cheatCloudRes.revision,
      metaSave: overCapMeta,
      runReport: { levelId: '3-1', score: 300000, serves: 15, durationSec: 120 }
    };
    const capCloudRes = await cloudMain(capPayload);
    const capMockRes = await Platform.runBrowserMockCloud(capPayload);
    assert.equal(capCloudRes.metaSave.levelBestScores['1-1'], 35000);
    assert.equal(capCloudRes.metaSave.levelBestScores['2-1'], 90000);
    assert.equal(capCloudRes.metaSave.levelBestScores['3-1'], 220000);
    assert.equal(capCloudRes.totalCumulativeScore, 345000);
    assert.equal(capMockRes.metaSave.levelBestScores['1-1'], 35000);
    assert.equal(capMockRes.metaSave.levelBestScores['2-1'], 90000);
    assert.equal(capMockRes.metaSave.levelBestScores['3-1'], 220000);
    assert.equal(capMockRes.totalCumulativeScore, 345000);

    // Dual leaderboards: 'stars', 'score', and 'totalScore' alias
    for (const reqBoard of ['stars', 'score', 'totalScore']) {
      const expectedBoard = reqBoard === 'stars' ? 'stars' : 'score';
      const lbCloud = await cloudMain({ action: 'leaderboard', boardType: reqBoard });
      const lbMock = await Platform.runBrowserMockCloud({ action: 'leaderboard', boardType: reqBoard });
      assert.equal(lbCloud.ok, true);
      assert.equal(lbCloud.boardType, expectedBoard);
      assert.ok(Array.isArray(lbCloud.list) && lbCloud.list.length >= 1);
      assert.equal(lbCloud.myRank, 1);

      assert.equal(lbMock.ok, true);
      assert.equal(lbMock.boardType, expectedBoard);
      assert.ok(Array.isArray(lbMock.list) && lbMock.list.length >= 1);
      assert.ok(typeof lbMock.myRank === 'number' && lbMock.myRank >= 1);
    }

    Platform.removeStorage('__hoshi_browser_cloud_doc_v1__');
    Platform.removeStorage('__hoshi_browser_cloud_doc_v2__');
    assert.equal(Platform.getStorageJSON('__hoshi_browser_cloud_doc_v1__'), null);
    assert.equal(Platform.getStorageJSON('__hoshi_browser_cloud_doc_v2__'), null);
  });

  await runTest('UT-S04', '高版本 schemaVersion 防覆盖写保护、连败 >=2 开局 +40% 充能保底与 requestRewardAction 桩位', async () => {
    // 1) Client normalizeSaveData / mergeSaveData marks higherSchemaDetected when schemaVersion > 2
    const futureRaw = {
      schemaVersion: 3,
      totalEarnedStardust: 500,
      lastSyncedEarnedStardust: 500,
      bankStardust: 500,
      levelStars: { '1-1': 3 },
      futureExpansionData: { endlessBestWave: 18 }
    };
    const normFuture = SaveSync.normalizeSaveData(futureRaw);
    assert.equal(normFuture.higherSchemaDetected, true);
    const mergedFuture = SaveSync.mergeSaveData(SaveSync.createDefaultSave(), futureRaw);
    assert.equal(mergedFuture.higherSchemaDetected, true);

    // 2) Cloud function & browser mock cloud both block overwrite when cloud doc has schemaVersion > 2
    const cloudVm = loadCloudFunctionInMemory('openid_future_schema_03');
    const { main: cloudMain } = cloudVm.exports;
    cloudVm.docs.set(
      'players',
      new Map([
        [
          'openid_future_schema_03',
          {
            _id: 'openid_future_schema_03',
            revision: 9,
            metaSave: futureRaw
          }
        ]
      ])
    );
    const pullFuture = await cloudMain({ action: 'pull' });
    assert.equal(pullFuture.ok, true);
    assert.equal(pullFuture.higherSchemaDetected, true);
    // Original v3 field in DB must remain intact (not overwritten on pull)
    assert.deepEqual(
      cloudVm.docs.get('players').get('openid_future_schema_03').metaSave.futureExpansionData,
      { endlessBestWave: 18 }
    );
    const pushFuture = await cloudMain({
      action: 'push',
      baseRevision: 9,
      metaSave: SaveSync.createDefaultSave()
    });
    assert.equal(pushFuture.ok, false);
    assert.equal(pushFuture.blocked, true);
    assert.equal(pushFuture.reason, 'higher_schema_version_on_cloud');
    assert.equal(pushFuture.higherSchemaDetected, true);

    // Browser mock cloud parity for schemaVersion: 3
    Platform.setStorageJSON('__hoshi_browser_cloud_doc_v1__', {
      schemaVersion: 3,
      revision: 4,
      metaSave: futureRaw
    });
    const mockPullFuture = await Platform.runBrowserMockCloud({ action: 'pull' });
    assert.equal(mockPullFuture.higherSchemaDetected, true);
    const mockPushFuture = await Platform.runBrowserMockCloud({
      action: 'push',
      baseRevision: 4,
      metaSave: SaveSync.createDefaultSave()
    });
    assert.equal(mockPushFuture.ok, false);
    assert.equal(mockPushFuture.blocked, true);
    assert.equal(mockPushFuture.reason, 'higher_schema_version_on_cloud');
    Platform.removeStorage('__hoshi_browser_cloud_doc_v1__');

    // 3) Reward action stub resolves cleanly
    const rewardRes = await Platform.requestRewardAction('extra_fork');
    assert.equal(rewardRes.rewarded, true);
    assert.equal(rewardRes.scene, 'extra_fork');

    // 4) Controller DDA Soft Pity: 2 consecutive failures on 1-4 -> 3rd attempt starts with skillEnergy === 40; clearing resets to 0
    const env = bootMockApp();
    try {
      const { dbg } = env;
      dbg.setSaveData({
        ...SaveSync.createDefaultSave(),
        levelStars: { '1-1': 3, '1-2': 3, '1-3': 3 }
      });

      // Attempt 1 fail
      dbg.startLevel('1-4', { skipTutorial: true, rng: mulberry32(811) });
      assert.equal(dbg.getState().skillEnergy, 0);
      dbg.advanceTime(120);
      assert.equal(dbg.getState().lastResult.cleared, false);
      assert.equal(dbg.getSaveData().levelFailStreaks['1-4'], 1);

      // Attempt 2 fail
      dbg.closeModal();
      dbg.startLevel('1-4', { skipTutorial: true, rng: mulberry32(812) });
      assert.equal(dbg.getState().skillEnergy, 0);
      dbg.advanceTime(120);
      assert.equal(dbg.getState().lastResult.cleared, false);
      assert.equal(dbg.getSaveData().levelFailStreaks['1-4'], 2);

      // Attempt 3 -> soft pity kicks in with skillEnergy === 40!
      dbg.closeModal();
      dbg.startLevel('1-4', { skipTutorial: true, rng: mulberry32(813) });
      assert.equal(dbg.getState().skillEnergy, 40);

      // Record >= 1 star clear on 1-4 -> fail streak deleted -> next start has skillEnergy === 0
      const clearedSave = SaveSync.recordLevelSettlementToSave(dbg.getSaveData(), '1-4', 1800, 1, 16, {
        ordersServed: 8
      });
      assert.equal(clearedSave.levelFailStreaks['1-4'], undefined);
      dbg.setSaveData(clearedSave);
      dbg.startLevel('1-4', { skipTutorial: true, rng: mulberry32(814) });
      assert.equal(dbg.getState().skillEnergy, 0);
    } finally {
      env.dispose();
    }
  });
}

// ============================================================================
// Section D — L2 Static 30-Level Invariants (L2-1 .. L2-6)
// ============================================================================

async function runSectionD() {
  await runTest('L2-1', '数量完备与章节门控 (3 Chapters x 10 Continuous Levels, MAX_CAMPAIGN_STARS=90 & Gate Thresholds)', () => {
    assert.equal(Levels.CHAPTERS.length, 3);
    assert.equal(Levels.MAX_CAMPAIGN_STARS, Levels.LEVELS.length * 3);
    assert.equal(Levels.MAX_CAMPAIGN_STARS, 90);

    assert.equal(Levels.CHAPTERS[0].unlockStars, 0);
    assert.equal(Levels.CHAPTERS[0].prevLevelReq, null);
    assert.deepEqual(Levels.CHAPTERS[0].firstStarDust, [10, 15, 22]);
    assert.equal(Levels.CHAPTERS[0].baseClearDust, 6);

    assert.equal(Levels.CHAPTERS[1].unlockStars, 18);
    assert.equal(Levels.CHAPTERS[1].prevLevelReq, '1-10');
    assert.deepEqual(Levels.CHAPTERS[1].firstStarDust, [16, 22, 32]);
    assert.equal(Levels.CHAPTERS[1].baseClearDust, 10);

    assert.equal(Levels.CHAPTERS[2].unlockStars, 40);
    assert.equal(Levels.CHAPTERS[2].prevLevelReq, '2-10');
    assert.deepEqual(Levels.CHAPTERS[2].firstStarDust, [22, 30, 42]);
    assert.equal(Levels.CHAPTERS[2].baseClearDust, 14);

    assert.equal(Levels.LEVELS.length, 30);
    const expectedIds = [];
    for (let ch = 1; ch <= 3; ch++) {
      for (let idx = 1; idx <= 10; idx++) expectedIds.push(`${ch}-${idx}`);
    }
    assert.deepEqual(
      Levels.LEVELS.map((l) => l.id),
      expectedIds
    );
    assert.equal(Levels.getNextLevelId('1-10'), '2-1');
    assert.equal(Levels.getNextLevelId('2-10'), '3-1');
    assert.equal(Levels.getNextLevelId('3-10'), null);

    // Chapter 2 gate check (requires 1-10 cleared AND >= 18 stars)
    const stars17 = { '1-1': 3, '1-2': 3, '1-3': 3, '1-4': 3, '1-5': 3, '1-10': 2 }; // 17 stars
    assert.equal(Levels.isChapterUnlocked(2, stars17).unlocked, false);
    const stars18NoBoss = { '1-1': 3, '1-2': 3, '1-3': 3, '1-4': 3, '1-5': 3, '1-6': 3 }; // 18 stars, no 1-10
    assert.equal(Levels.isChapterUnlocked(2, stars18NoBoss).unlocked, false);
    const stars18WithBoss = { ...stars17, '1-6': 1 }; // 18 stars + 1-10 cleared
    assert.equal(Levels.isChapterUnlocked(2, stars18WithBoss).unlocked, true);
    assert.equal(Levels.isLevelUnlocked('2-1', stars18WithBoss).unlocked, true);
  });

  await runTest('L2-2', '矩阵矩形对齐与字符合法性 (3x3..5x5 Rectangular Matrix & Valid Cell Alphabet)', () => {
    for (const lvl of Levels.LEVELS) {
      const rows = lvl.matrix.length;
      assert.ok(rows >= 3 && rows <= 5, `${lvl.id}: invalid rows=${rows}`);
      const cols = lvl.matrix[0].length;
      assert.ok(cols >= 3 && cols <= 5, `${lvl.id}: invalid cols=${cols}`);
      for (let r = 0; r < rows; r++) {
        const row = lvl.matrix[r];
        assert.equal(row.length, cols, `${lvl.id}: row ${r} ragged length`);
        assert.match(row, /^[.#XGMBI]+$/, `${lvl.id}: row ${r} illegal char in "${row}"`);
      }
    }
  });

  await runTest('L2-3', '预置坐标合法性与冰封双射 (Preset Bounds, Non-#/X & Exact I <-> frozen Bijection)', () => {
    for (const lvl of Levels.LEVELS) {
      const rows = lvl.matrix.length;
      const cols = lvl.matrix[0].length;
      const presetByCoord = new Map();

      for (const p of lvl.presets) {
        assert.ok(Number.isInteger(p.r) && p.r >= 0 && p.r < rows, `${lvl.id}: preset r out of bounds`);
        assert.ok(Number.isInteger(p.c) && p.c >= 0 && p.c < cols, `${lvl.id}: preset c out of bounds`);
        const key = `${p.r},${p.c}`;
        assert.equal(presetByCoord.has(key), false, `${lvl.id}: duplicate preset at ${key}`);
        presetByCoord.set(key, p);

        assert.ok(Number.isInteger(p.tier) && p.tier >= 1 && p.tier <= 7, `${lvl.id}: invalid tier at ${key}`);
        assert.ok(
          ['plain', 'matcha', 'berry', 'gold'].includes(p.flavor),
          `${lvl.id}: invalid flavor at ${key}`
        );
        const ch = lvl.matrix[p.r][p.c];
        assert.notEqual(ch, '#', `${lvl.id}: preset on void # at ${key}`);
        assert.notEqual(ch, 'X', `${lvl.id}: preset on block X at ${key}`);
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const key = `${r},${c}`;
          const ch = lvl.matrix[r][c];
          const preset = presetByCoord.get(key) || null;
          if (ch === 'I') {
            assert.ok(preset !== null && preset.frozen === true, `${lvl.id}: 'I' cell ${key} missing frozen preset`);
          } else if (preset) {
            assert.notEqual(preset.frozen, true, `${lvl.id}: non-'I' cell ${key} has frozen:true`);
          }
        }
      }
    }
  });

  await runTest('L2-4', '可达性、四邻接连通性与零道具破冰可解性 (>=8 Open Cells, 4-Way BFS & Ice Thawability)', () => {
    const DIRS4 = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];

    for (const lvl of Levels.LEVELS) {
      const rows = lvl.matrix.length;
      const cols = lvl.matrix[0].length;
      const isPassable = (r, c) =>
        r >= 0 && r < rows && c >= 0 && c < cols && lvl.matrix[r][c] !== '#' && lvl.matrix[r][c] !== 'X';

      let nonFrozenPlayable = 0;
      const passableCells = [];
      const remainingFrozen = new Set();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ch = lvl.matrix[r][c];
          if (ch === '.' || ch === 'G' || ch === 'M' || ch === 'B') {
            nonFrozenPlayable++;
          }
          if (ch === 'I') {
            remainingFrozen.add(`${r},${c}`);
          }
          if (isPassable(r, c)) {
            passableCells.push([r, c]);
          }
        }
      }

      assert.ok(
        nonFrozenPlayable >= 8,
        `${lvl.id}: expected >= 8 non-frozen playable cells, got ${nonFrozenPlayable}`
      );

      // Zero 1-cell prisons
      for (const [r, c] of passableCells) {
        const deg = DIRS4.filter(([dr, dc]) => isPassable(r + dr, c + dc)).length;
        assert.ok(deg >= 1, `${lvl.id}: isolated 1-cell prison at (${r},${c})`);
      }

      // Single 4-way connected component (treating '#' and 'X' as the ONLY permanent walls; 'I' is thawable)
      const visited = new Set([`${passableCells[0][0]},${passableCells[0][1]}`]);
      const queue = [passableCells[0]];
      while (queue.length > 0) {
        const [cr, cc] = queue.shift();
        for (const [dr, dc] of DIRS4) {
          const nr = cr + dr;
          const nc = cc + dc;
          const nk = `${nr},${nc}`;
          if (isPassable(nr, nc) && !visited.has(nk)) {
            visited.add(nk);
            queue.push([nr, nc]);
          }
        }
      }
      assert.equal(
        visited.size,
        passableCells.length,
        `${lvl.id}: disconnected board components (${visited.size}/${passableCells.length})`
      );

      // Iterative zero-tool ice-thawability check: an 'I' cell thaws if an orthogonal unlocked neighbor
      // belongs to a horizontal or vertical contiguous unlocked segment of length >= 2 (can host a 2048 merge).
      const isUnlocked = (r, c) => isPassable(r, c) && !remainingFrozen.has(`${r},${c}`);
      const canHostMergeAt = (r, c) => {
        if (!isUnlocked(r, c)) return false;
        let lc = c;
        let rc = c;
        while (isUnlocked(r, lc - 1)) lc--;
        while (isUnlocked(r, rc + 1)) rc++;
        let tr = r;
        let br = r;
        while (isUnlocked(tr - 1, c)) tr--;
        while (isUnlocked(br + 1, c)) br++;
        return rc - lc + 1 >= 2 || br - tr + 1 >= 2;
      };

      let progress = true;
      while (progress && remainingFrozen.size > 0) {
        progress = false;
        for (const key of [...remainingFrozen]) {
          const [ir, ic] = key.split(',').map(Number);
          if (DIRS4.some(([dr, dc]) => canHostMergeAt(ir + dr, ic + dc))) {
            remainingFrozen.delete(key);
            progress = true;
          }
        }
      }
      assert.equal(
        remainingFrozen.size,
        0,
        `${lvl.id}: unthawable ice cells without utensils: ${[...remainingFrozen].join('; ')}`
      );
    }
  });

  await runTest('L2-5', '星级递增、章节特殊格限制与菜谱可制作性 (Stars, Chapter Cell Gating & Craftability)', () => {
    for (const lvl of Levels.LEVELS) {
      assert.equal(lvl.stars.length, 3, `${lvl.id}: stars length !== 3`);
      const [s1, s2, s3] = lvl.stars;
      assert.ok(
        Number.isInteger(s1) && Number.isInteger(s2) && Number.isInteger(s3) && 0 < s1 && s1 < s2 && s2 < s3,
        `${lvl.id}: stars not strictly increasing: ${JSON.stringify(lvl.stars)}`
      );
      assert.ok(
        Number.isInteger(lvl.durationSec) && lvl.durationSec >= 90 && lvl.durationSec <= 150,
        `${lvl.id}: durationSec=${lvl.durationSec} out of [90,150]`
      );

      const joined = lvl.matrix.join('');
      if (lvl.chapter === 1) {
        assert.match(joined, /^[.#X]+$/, `${lvl.id}: Chapter 1 forbids G/M/B/I cells`);
      } else if (lvl.chapter === 2) {
        assert.match(joined, /^[.#XGM]+$/, `${lvl.id}: Chapter 2 forbids B/I cells`);
      }

      const hasMatchaSource =
        joined.includes('M') ||
        joined.includes('G') ||
        lvl.presets.some((p) => p.flavor === 'matcha' || p.flavor === 'gold');
      const hasBerrySource =
        joined.includes('B') ||
        joined.includes('G') ||
        lvl.presets.some((p) => p.flavor === 'berry' || p.flavor === 'gold');

      assert.ok(lvl.allowedRecipes.length >= 1, `${lvl.id}: empty allowedRecipes`);
      const recipePool = [...lvl.allowedRecipes];
      if (lvl.vipFixedRecipeId) recipePool.push(lvl.vipFixedRecipeId);

      for (const rId of recipePool) {
        const rec = Levels.RECIPES[rId];
        assert.ok(rec, `${lvl.id}: unknown recipe ${rId}`);
        for (const slot of rec.slots) {
          if (slot.flavor === 'matcha') {
            assert.ok(hasMatchaSource, `${lvl.id}: recipe ${rId} needs matcha without M/G source`);
          }
          if (slot.flavor === 'berry') {
            assert.ok(hasBerrySource, `${lvl.id}: recipe ${rId} needs berry without B/G source`);
          }
        }
      }
    }
  });

  await runTest('L2-6', '云端反作弊安全裕度校验 (stars[2] * 2.5 <= CHAPTER_SCORE_CAPS)', () => {
    const caps = { 1: 35000, 2: 90000, 3: 220000 };
    for (const lvl of Levels.LEVELS) {
      const cap = caps[lvl.chapter];
      assert.ok(
        lvl.stars[2] * 2.5 <= cap,
        `${lvl.id}: stars[2]=${lvl.stars[2]} leaves insufficient headroom below chapter cap ${cap}`
      );
    }
  });
}

// ============================================================================
// Section E — M4 Cleanup, Iron Laws & Controller Integration (UT-M01 .. UT-M06)
// ============================================================================

function buildExpected65DeletedPaths() {
  const list = [
    '05-微信小游戏版本/src/physics.js',
    '05-微信小游戏版本/src/physics_shapes.js',
    '05-微信小游戏版本/src/jar_renderer.js',
    'scripts/extract_physics_shapes.py',
    '02-游戏素材-精修透明PNG/event_yarn_ball.png',
    '02-游戏素材-精修透明PNG/physics_shapes.json',
    '02-游戏素材-精修透明PNG/sprites_meta.json',
    '02-游戏素材-精修透明PNG/tool_shake.png',
    '05-微信小游戏版本/assets/event_yarn_ball.png',
    '05-微信小游戏版本/assets/title_hero.jpg',
    '05-微信小游戏版本/assets/tool_shake.png'
  ];
  for (let t = 1; t <= 9; t++) {
    for (const suffix of ['', '_act', '_int']) {
      list.push(`02-游戏素材-精修透明PNG/tier_${t}${suffix}.png`);
      list.push(`05-微信小游戏版本/assets/tier_${t}${suffix}.png`);
    }
  }
  return list;
}

function collectAssetPathsFromConstants(assetPathsObj) {
  const out = new Set();
  function walk(val) {
    if (typeof val === 'string') {
      out.add(val);
    } else if (val && typeof val === 'object') {
      for (const v of Object.values(val)) walk(v);
    }
  }
  walk(assetPathsObj);
  return out;
}

function walkFilesExcludingCloud(dirPath, acc = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === 'cloudfunctions') continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFilesExcludingCloud(full, acc);
    } else if (entry.isFile()) {
      acc.push({ path: full, size: fs.statSync(full).size });
    }
  }
  return acc;
}

function verifyHitsGeometry(hits, metrics, contextLabel) {
  assert.ok(Array.isArray(hits) && hits.length > 0, `${contextLabel}: hits empty`);
  const { width, height, safeBottom = 0, menuRect } = metrics;
  const maxY = height - Math.max(10, safeBottom + 8) + 0.5;

  for (const h of hits) {
    assert.ok(
      Number.isFinite(h.x) && Number.isFinite(h.y) && h.w > 0 && h.h > 0,
      `${contextLabel}: invalid hit dimensions on ${h.id}: ${JSON.stringify(h)}`
    );
    assert.ok(h.x >= -0.5 && h.x + h.w <= width + 0.5, `${contextLabel}: ${h.id} X out of [0, ${width}]`);
    assert.ok(
      h.y >= -0.5 && h.y + h.h <= maxY,
      `${contextLabel}: ${h.id} bottom ${h.y + h.h} exceeds safeBottom dock limit ${maxY - 0.5}`
    );
    if (menuRect && h.y < menuRect.bottom) {
      assert.ok(
        h.x + h.w <= menuRect.left - 8 + 0.5,
        `${contextLabel}: ${h.x + h.w} on ${h.id} violates capsule clearance <= ${menuRect.left - 8}`
      );
    }
  }

  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const a = hits[i];
      const b = hits[j];
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      assert.ok(
        ox <= 0 || oy <= 0,
        `${contextLabel}: overlapping hits ${a.id} and ${b.id} (${ox.toFixed(2)}x${oy.toFixed(2)}px)`
      );
    }
  }
}

function serveOneCustomerOnLevel1(dbg) {
  // Ensure at least one customer is seated
  for (let w = 0; w < 8; w++) {
    const st = dbg.getState();
    if (st.seats && st.seats.some(Boolean)) break;
    dbg.advanceTime(0.5);
  }
  let st = dbg.getState();
  const seatIdx = st.seats.findIndex(Boolean);
  assert.ok(seatIdx >= 0, 'Expected at least one seated customer on 1-1');
  const targetOrder = st.seats[seatIdx];

  // Clear tray first so slots match cleanly (bypassing 8s cooldown in test helper)
  for (let s = 0; s < st.trayCapacity; s++) {
    if (st.tray[s]) dbg.doubleTapTray(s, { ignoreCooldown: true });
  }

  // Lock target customer if not already preferred
  st = dbg.getState();
  if (st.preferredSeatIdx !== seatIdx) {
    dbg.clickHit(`seat_${seatIdx}`);
  }

  for (const reqSlot of targetOrder.slots) {
    // Ensure required tier (1 or 2 on 1-1) exists on the board
    for (let guard = 0; guard < 24; guard++) {
      st = dbg.getState();
      let found = null;
      for (let r = 0; r < st.grid.rows && !found; r++) {
        for (let c = 0; c < st.grid.cols && !found; c++) {
          const t = st.grid.cells[r][c].tile;
          if (t && t.frozenHp === 0 && t.tier === reqSlot.tier) {
            found = { r, c };
          }
        }
      }
      if (found) {
        const tapRes = dbg.tapBoardCell(found.r, found.c);
        assert.equal(tapRes.placed, true);
        break;
      }
      // Bake C2 by sliding or spawn C1 by kneading
      const kneadRes = dbg.knead();
      if (!kneadRes.spawned || reqSlot.tier >= 2) {
        for (const dir of ['left', 'up', 'right', 'down']) {
          const sr = dbg.slide(dir);
          if (sr && sr.moved) break;
        }
      }
    }
  }

  const prevServed = dbg.getState().ordersServed;
  dbg.advanceTime(0.25);
  assert.ok(dbg.getState().ordersServed > prevServed, 'Expected order to auto-serve after 0.10s');
}

async function runSectionE() {
  await runTest('UT-M01', '清理后旧版文件与废弃素材目录零残留、69 张微信白名单 ASCII PNG/JPG 双射、KissaRound 圆体子集与包体门禁', () => {
    const legacyPaths = buildExpected65DeletedPaths();
    assert.equal(legacyPaths.length, 65);
    const lingering = legacyPaths.filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));
    assert.deepEqual(lingering, [], `Legacy v1 files still present: ${lingering.join(', ')}`);

    const deprecatedV080Paths = [
      '02-游戏素材-精修透明PNG',
      '03-游戏素材-原始原图与WebP',
      'scripts/extract_assets.py',
      'scripts/extract_ui_assets.py'
    ];
    const lingeringV080 = deprecatedV080Paths.filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));
    assert.deepEqual(lingeringV080, [], `Deprecated legacy asset dirs/scripts still present: ${lingeringV080.join(', ')}`);

    const constAssetSet = collectAssetPathsFromConstants(Constants.ASSET_PATHS);
    assert.equal(constAssetSet.size, 69);
    assert.equal(Array.isArray(Constants.V090_ASSET_LIST) && Constants.V090_ASSET_LIST.length, 69);

    const allDiskAssets = walkFilesExcludingCloud(ASSETS_DIR)
      .map((f) => path.relative(MINIGAME_DIR, f.path).split(path.sep).join('/'))
      .filter((rel) => !path.basename(rel).startsWith('.'))
      .sort();

    // Zero non-whitelisted .webp files inside assets/ (WeChat Mini Game silently strips .webp on upload!)
    const forbiddenWebp = allDiskAssets.filter((p) => /\.webp$/i.test(p));
    assert.deepEqual(forbiddenWebp, [], `Non-whitelisted .webp files found in assets/: ${forbiddenWebp.join(', ')}`);

    // Pure ASCII asset paths for iOS WeChat Mini Game compatibility
    const nonAsciiAssets = allDiskAssets.filter((p) => /[^\x20-\x7E]/.test(p));
    assert.deepEqual(nonAsciiAssets, [], `Non-ASCII asset paths found in assets/: ${nonAsciiAssets.join(', ')}`);

    // Exact 69 WeChat-whitelisted PNG/JPG sprites bijection under assets/ui_v090/
    const diskRasterFiles = allDiskAssets.filter((p) => /\.(png|jpe?g)$/i.test(p)).sort();
    assert.equal(diskRasterFiles.length, 69);
    const onlyOnDisk = diskRasterFiles.filter((p) => !constAssetSet.has(p));
    const onlyInConst = [...constAssetSet].filter((p) => !diskRasterFiles.includes(p));
    assert.deepEqual(onlyOnDisk, []);
    assert.deepEqual(onlyInConst, []);

    // Valid subsetted TrueType font assets/fonts/kissa_round.ttf
    const fontAbs = path.join(ASSETS_DIR, 'fonts', 'kissa_round.ttf');
    assert.ok(fs.existsSync(fontAbs), 'Missing subsetted font assets/fonts/kissa_round.ttf');
    const fontBuf = fs.readFileSync(fontAbs);
    assert.ok(fontBuf.length > 50_000 && fontBuf.length < 600_000, `Unexpected kissa_round.ttf size: ${fontBuf.length}`);
    assert.equal(fontBuf.readUInt32BE(0), 0x00010000, 'kissa_round.ttf must have valid TrueType sfnt header');

    // Exact 13 lossless v0.9.0 design images in 01-游戏效果图/
    const designDir = path.join(REPO_ROOT, '01-游戏效果图');
    const designImgs = fs.readdirSync(designDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    assert.equal(designImgs.length, 13, `Expected 13 v0.9.0 design images in 01-游戏效果图/, got ${designImgs.length}`);
    assert.ok(
      designImgs.includes('01_标题首屏_TitleScreen（备用）.jpg'),
      'Reserve title screen design image must be present and marked 备用'
    );

    const bundleFiles = walkFilesExcludingCloud(MINIGAME_DIR);
    const totalBytes = bundleFiles.reduce((sum, f) => sum + f.size, 0);
    assert.ok(
      totalBytes < 3.2 * 1024 * 1024 && totalBytes < 4 * 1024 * 1024,
      `Mini Game raw bundle ${totalBytes} bytes exceeds 3.2 MB budget (< 4 MB WeChat limit)`
    );

    const externalAudio = bundleFiles.filter((f) => /\.(mp3|wav|ogg|m4a|aac)$/i.test(f.path));
    assert.deepEqual(externalAudio, []);
  });

  await runTest('UT-M02', '全局铁律校验：5,650 星尘小铺总上限、0 hsl() 渐变色与 0 彩色 Emoji', () => {
    const catcakeSum = Object.values(Constants.CATCAKE_UPGRADE_COSTS)
      .flat()
      .reduce((a, b) => a + b, 0);
    const deviceSum = Object.values(Constants.DEVICE_UPGRADE_COSTS)
      .flat()
      .reduce((a, b) => a + b, 0);
    const patronSum = Object.values(Constants.PATRON_COSTS).reduce((a, b) => a + b, 0);
    const themeSum = Object.values(Constants.THEME_COSTS).reduce((a, b) => a + b, 0);

    assert.equal(catcakeSum, 3920);
    assert.equal(deviceSum, 1250);
    assert.equal(patronSum, 240);
    assert.equal(themeSum, 240);
    assert.equal(catcakeSum + deviceSum + patronSum + themeSum, 5650);
    assert.equal(Constants.SHOP_TOTAL_CAP, 5650);

    const hslRe = /\bhsla?\s*\(/i;
    const colorEmojiRe = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u;

    const srcFiles = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.js'));
    for (const file of srcFiles) {
      const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
      const codeOnly = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      assert.equal(hslRe.test(codeOnly), false, `${file} contains forbidden hsl()/hsla() in code`);
      assert.equal(colorEmojiRe.test(codeOnly), false, `${file} contains forbidden color Unicode emoji in code`);
    }

    // Dynamic Canvas spy across Lobby, Play HUD, all Modals & Tutorial overlays
    const env = bootMockApp();
    try {
      const { dbg, spy } = env;
      dbg.openLevelPreview('1-1');
      dbg.openModal('shop');
      for (const tabId of ['shop_tab_catcakes', 'shop_tab_devices', 'shop_tab_patrons', 'shop_tab_themes']) {
        dbg.clickHit(tabId);
      }
      dbg.openModal('compendium');
      dbg.clickHit('compendium_tab_catcakes');
      dbg.clickHit('compendium_tab_recipes');
      dbg.openModal('leaderboard');
      dbg.clickHit('leaderboard_tab_stars');
      dbg.clickHit('leaderboard_tab_score');
      dbg.openModal('help');
      dbg.closeModal();

      dbg.startLevel('1-1'); // triggers intro_slide_1 spotlight
      dbg.slide('left'); // triggers intro_slide_2 spotlight
      dbg.knead(); // triggers intro_slide_3 spotlight
      dbg.openModal('pause');
      dbg.clickHit('pause_lobby_btn'); // triggers confirm modal if wired, or returns
      dbg.openModal('confirm');
      dbg.closeModal();
      dbg.startLevel('2-1'); // triggers flavor_tile spotlight
      dbg.startLevel('3-1'); // triggers ice_tile spotlight
      dbg.advanceTime(125); // triggers level_result modal

      const badStops = spy.colorStops.filter((c) => hslRe.test(c));
      const badStyles = spy.styles.filter((c) => hslRe.test(c));
      const badTexts = spy.texts.filter((t) => colorEmojiRe.test(t));
      assert.deepEqual(badStops, []);
      assert.deepEqual(badStyles, []);
      assert.deepEqual(badTexts, []);
    } finally {
      env.dispose();
    }
  });

  await runTest('UT-M03', '多视口无头启动、__HOSHI_DEBUG__ 契约、胶囊避让与热区零重叠 (375x667 / 390x844 / 1280x760)', async () => {
    const viewports = [
      {
        label: '375x667',
        width: 375,
        height: 667,
        dpr: 2,
        safeTop: 20,
        safeBottom: 0,
        menuRect: { left: 278, top: 24, right: 365, bottom: 56, width: 87, height: 32 }
      },
      {
        label: '390x844',
        width: 390,
        height: 844,
        dpr: 3,
        safeTop: 47,
        safeBottom: 34,
        menuRect: { left: 293, top: 51, right: 380, bottom: 83, width: 87, height: 32 }
      },
      {
        label: '1280x760',
        width: 1280,
        height: 760,
        dpr: 1,
        safeTop: 0,
        safeBottom: 0,
        menuRect: { left: 1181, top: 12, right: 1268, bottom: 44, width: 87, height: 32 }
      }
    ];

    for (const vp of viewports) {
      const env = bootMockApp(vp);
      try {
        const { dbg } = env;
        assert.ok(dbg && typeof dbg === 'object');
        assert.strictEqual(globalThis.__HOSHI_DEBUG__, globalThis.__game);
        assert.equal(dbg.version, '0.9.0');

        await env.flushAssets();
        let st = dbg.getState();
        assert.equal(st.assetsTotal, 69);
        assert.equal(st.assetsLoaded, 69);
        assert.equal(st.screen, 'lobby');
        assert.equal(st.activeModal, null);

        const hitIds = new Set(st.hits.map((h) => h.id));
        assert.equal(hitIds.has('mode_rush'), false);
        assert.equal(hitIds.has('mode_zen'), false);
        assert.equal(hitIds.has('mode_chef'), false);

        for (const reqId of [
          'chapter_prev',
          'chapter_next',
          'level_node_1-1',
          'level_node_1-10',
          'lobby_start_cta',
          'lobby_patron_switch',
          'dock_shop',
          'dock_compendium',
          'dock_leaderboard',
          'dock_themes',
          'lobby_bgm_btn',
          'lobby_sfx_btn',
          'lobby_help_btn'
        ]) {
          assert.ok(hitIds.has(reqId), `${vp.label} Lobby missing canonical hit ${reqId}`);
        }
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:lobby`);

        // Chapter switch exposes Ch2 & Ch3 level nodes cleanly
        dbg.clickHit('chapter_next');
        st = dbg.getState();
        assert.ok(st.hits.some((h) => h.id === 'level_node_2-1'));
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:lobby_ch2`);
        dbg.clickHit('chapter_next');
        st = dbg.getState();
        assert.ok(st.hits.some((h) => h.id === 'level_node_3-10'));
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:lobby_ch3`);
        dbg.clickHit('chapter_prev');
        dbg.clickHit('chapter_prev');

        // Level Preview modal
        dbg.openLevelPreview('1-1');
        st = dbg.getState();
        assert.equal(st.activeModal, 'level_preview');
        for (const id of [
          'modal_close',
          'preview_start_btn',
          'preview_patron_mikan',
          'preview_patron_luna',
          'preview_patron_mugi'
        ]) {
          assert.ok(st.hits.some((h) => h.id === id), `${vp.label}:level_preview missing ${id}`);
        }
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:level_preview`);

        // Shop modal across all 4 tabs (single-column catcakes shows C1..C4 at top and scrolls to C7)
        dbg.openModal('shop');
        for (const [tabHit, expectedIds] of [
          [
            'shop_tab_catcakes',
            ['modal_close', 'shop_buy_catcake_1', 'shop_buy_catcake_2', 'shop_buy_catcake_3']
          ],
          [
            'shop_tab_devices',
            ['modal_close', 'shop_buy_dev_tray', 'shop_buy_dev_flour', 'shop_buy_dev_teapot', 'shop_buy_dev_tools']
          ],
          [
            'shop_tab_patrons',
            ['modal_close', 'shop_equip_patron_mikan', 'shop_buy_patron_luna', 'shop_buy_patron_mugi']
          ],
          [
            'shop_tab_themes',
            ['modal_close', 'shop_equip_theme_amber', 'shop_buy_theme_sakura', 'shop_buy_theme_moonlight']
          ]
        ]) {
          dbg.clickHit(tabHit);
          st = dbg.getState();
          for (const id of expectedIds) {
            assert.ok(st.hits.some((h) => h.id === id), `${vp.label}:${tabHit} missing ${id}`);
          }
          verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:tab_${tabHit}`);
        }

        // Compendium & 3-Tab Leaderboard modals
        dbg.openModal('compendium');
        st = dbg.getState();
        assert.ok(st.hits.some((h) => h.id === 'compendium_tab_catcakes'));
        assert.ok(st.hits.some((h) => h.id === 'compendium_tab_recipes'));
        assert.ok(st.hits.some((h) => h.id === 'compendium_cake_1'));
        assert.ok(st.hits.some((h) => h.id === 'compendium_cake_7'));
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:compendium`);

        dbg.openModal('leaderboard');
        st = dbg.getState();
        assert.ok(st.hits.some((h) => h.id === 'leaderboard_tab_stars'));
        assert.ok(st.hits.some((h) => h.id === 'leaderboard_tab_score'));
        assert.ok(st.hits.some((h) => h.id === 'leaderboard_tab_friends'));
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:leaderboard`);
        dbg.clickHit('leaderboard_tab_friends');
        st = dbg.getState();
        assert.equal(st.leaderboardBoardType, 'friends');
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:leaderboard_friends`);

        dbg.openModal('help');
        st = dbg.getState();
        assert.ok(st.hits.some((h) => h.id === 'help_ok_btn'));
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:help`);
        dbg.closeModal();

        // Play HUD
        dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(42) });
        st = dbg.getState();
        assert.equal(st.screen, 'playing');
        assert.equal(st.trashCooldown, 0);
        assert.equal(st.forkSourceCell, null);
        assert.ok(st.boardLayout && st.boardLayout.cellSize >= 46);
        for (const id of [
          'pause_btn',
          'seat_0',
          'seat_1',
          'seat_2',
          'tray_slot_0',
          'tray_slot_1',
          'tray_slot_2',
          'tray_trash_btn',
          'knead_btn',
          'tool_fork_btn',
          'tool_spoon_btn',
          'patron_skill_btn'
        ]) {
          assert.ok(st.hits.some((h) => h.id === id), `${vp.label}:play missing ${id}`);
        }
        verifyHitsGeometry(st.hits, st.metrics, `${vp.label}:play`);
      } finally {
        env.dispose();
      }
    }
  });

  await runTest('UT-M04', '控制器纯上菜铁律、通关结算解锁与 0单/有单失败鼓励星尘校验', () => {
    const env = bootMockApp();
    try {
      const { dbg } = env;
      const initSave = {
        ...SaveSync.createDefaultSave(),
        totalEarnedStardust: 250,
        lastSyncedEarnedStardust: 250,
        bankStardust: 250,
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 1 } // fork:1, spoon:1
      };
      dbg.setSaveData(initSave);

      // 1) Controller Pure Serve-Only Iron Law + >=1 star clear & 1-2 unlock
      dbg.startLevel('1-1', { skipTutorial: true, forceCharge: true, rng: mulberry32(777) });
      assert.equal(dbg.getState().score, 0);

      dbg.slide('left');
      assert.equal(dbg.getState().score, 0);
      dbg.knead();
      assert.equal(dbg.getState().score, 0);

      // Place one tile into tray and immediately double-tap discard (before 0.10s auto-serve)
      const stBeforeTap = dbg.getState();
      let anyTilePos = null;
      for (let r = 0; r < stBeforeTap.grid.rows && !anyTilePos; r++) {
        for (let c = 0; c < stBeforeTap.grid.cols && !anyTilePos; c++) {
          if (stBeforeTap.grid.cells[r][c].tile) anyTilePos = { r, c };
        }
      }
      assert.ok(anyTilePos);
      assert.equal(dbg.tapBoardCell(anyTilePos.r, anyTilePos.c).placed, true);
      assert.equal(dbg.getState().score, 0);
      assert.equal(dbg.doubleTapTray(0).discarded, true);
      assert.equal(dbg.getState().trashCooldown, 8.0);
      assert.equal(dbg.getState().score, 0);

      // Spoon, 2-step Relocate Fork, and Patron Skill all keep score === 0
      dbg.knead();
      dbg.knead();
      const cellsWithTile = [];
      const gNow = dbg.getState().grid;
      for (let r = 0; r < gNow.rows; r++) {
        for (let c = 0; c < gNow.cols; c++) {
          if (gNow.cells[r][c].tile) cellsWithTile.push({ r, c });
        }
      }
      dbg.useToolOnCell('spoon', cellsWithTile[0].r, cellsWithTile[0].c);
      assert.equal(dbg.getState().score, 0);
      // 2-step fork: Step 1 locks source without consuming fork, Step 2 clickHit('tray_trash_btn') trashes directly even during 8s cooldown!
      const step1Res = dbg.useToolOnCell('fork', cellsWithTile[1].r, cellsWithTile[1].c);
      assert.equal(step1Res.armed, true);
      assert.equal(step1Res.step, 2);
      assert.equal(dbg.getState().toolCounts.fork, 1);
      assert.deepEqual(dbg.getState().forkSourceCell, { r: cellsWithTile[1].r, c: cellsWithTile[1].c });
      assert.equal(dbg.clickHit('tray_trash_btn'), true);
      assert.equal(dbg.getState().toolCounts.fork, 0);
      assert.equal(dbg.getState().forkSourceCell, null);
      assert.equal(dbg.getState().score, 0);
      dbg.castPatronSkill({ forceCharge: true });
      assert.equal(dbg.getState().score, 0);

      // Serve first customer -> score strictly > 0
      serveOneCustomerOnLevel1(dbg);
      assert.ok(dbg.getState().ordersServed >= 1);
      assert.ok(dbg.getState().score > 0);

      // Keep serving until reaching >= 850 (1 star on 1-1 in v0.9.0)
      let safety = 0;
      while (dbg.getState().score < 850 && safety < 30) {
        serveOneCustomerOnLevel1(dbg);
        safety++;
      }
      assert.ok(dbg.getState().score >= 850);

      dbg.advanceTime(95);
      const resClear = dbg.getState();
      assert.equal(resClear.activeModal, 'level_result');
      assert.equal(resClear.lastResult.cleared, true);
      assert.ok(resClear.lastResult.starsEarned >= 1);

      const postClearSave = dbg.getSaveData();
      assert.ok(postClearSave.levelStars['1-1'] >= 1);
      assert.equal(Levels.isLevelUnlocked('1-2', postClearSave.levelStars).unlocked, true);
      assert.equal(
        postClearSave.bankStardust,
        postClearSave.totalEarnedStardust - SaveSync.computeSpentStardust(postClearSave)
      );

      // 2) Zero-serve timeout -> consolationDust === 0
      dbg.closeModal();
      dbg.startLevel('1-2', { skipTutorial: true, rng: mulberry32(888) });
      dbg.advanceTime(100);
      const zeroServeRes = dbg.getState().lastResult;
      assert.equal(zeroServeRes.cleared, false);
      assert.equal(zeroServeRes.consolationDust, 0);
      assert.equal(zeroServeRes.totalDustAward, 0);

      // 3) >= 1 serve but < star1 (850) timeout -> consolationDust === Math.max(1, Math.floor((score / 850) * 4))
      dbg.closeModal();
      dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(999) });
      serveOneCustomerOnLevel1(dbg);
      const subStarScore = dbg.getState().score;
      assert.ok(subStarScore > 0 && subStarScore < 850);
      dbg.advanceTime(95);
      const subStarRes = dbg.getState().lastResult;
      assert.equal(subStarRes.cleared, false);
      assert.equal(subStarRes.consolationDust, Math.max(1, Math.floor((subStarRes.score / 850) * 4)));
    } finally {
      env.dispose();
    }
  });

  await runTest('UT-M05', '吃茶小铺四分页升级、应急厨具限购守恒与三位主厨搭档主动技', () => {
    const env = bootMockApp();
    try {
      const { dbg } = env;
      dbg.setSaveData({
        ...SaveSync.createDefaultSave(),
        totalEarnedStardust: 1500,
        lastSyncedEarnedStardust: 1500,
        bankStardust: 1500
      });

      // 1) 4-Tab Kissa Shop purchases
      dbg.openModal('shop');
      dbg.clickHit('shop_tab_catcakes');
      assert.equal(dbg.clickHit('shop_buy_catcake_1'), true); // 25
      assert.equal(dbg.getSaveData().catcakeLevels['1'], 1);
      assert.equal(Constants.getCatcakePrice(1, 1), 35); // round(30 * 1.15) = 35

      dbg.clickHit('shop_tab_devices');
      assert.equal(dbg.clickHit('shop_buy_dev_tray'), true); // 75 -> trayCapacity 4
      assert.equal(dbg.getSaveData().deviceUpgrades.dev_tray, 1);

      dbg.clickHit('shop_tab_patrons');
      assert.equal(dbg.clickHit('shop_buy_patron_luna'), true); // 100
      assert.equal(dbg.clickHit('shop_buy_patron_mugi'), true); // 140
      assert.ok(dbg.getSaveData().unlockedPatrons.includes('luna'));
      assert.ok(dbg.getSaveData().unlockedPatrons.includes('mugi'));

      dbg.clickHit('shop_tab_themes');
      assert.equal(dbg.clickHit('shop_buy_theme_sakura'), true); // 100
      assert.equal(dbg.clickHit('shop_equip_theme_sakura'), true);
      assert.equal(dbg.getSaveData().equippedTheme, 'sakura');
      dbg.closeModal();

      // Verify dev_tray Lv.1 gives 4 tray slots & dev_tools Lv.0 starts with { fork: 1, spoon: 0 }
      dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(101) });
      assert.equal(dbg.getState().trayCapacity, 4);
      assert.deepEqual(dbg.getState().toolCounts, { fork: 1, spoon: 0 });

      // 2) Emergency Utensils: spoon=0 -> emergency buy 1x for 25 stardust; 2nd emergency buy blocked
      const preConsumable = dbg.getSaveData().consumableSpentStardust;
      const spoonRes1 = dbg.useToolOnCell('spoon', 0, 0);
      assert.equal(spoonRes1.upgraded, true);
      assert.equal(dbg.getSaveData().consumableSpentStardust, preConsumable + 25);

      const spoonRes2 = dbg.useToolOnCell('spoon', 0, 1);
      assert.equal(Boolean(spoonRes2 && spoonRes2.upgraded), false);
      assert.equal(dbg.getSaveData().consumableSpentStardust, preConsumable + 25);

      // Free fork (1 -> 0 via 5-arg move/swap/merge or 'trash'), then emergency fork (20 stardust), then 2nd emergency fork blocked
      assert.equal(dbg.useToolOnCell('fork', 0, 0, 0, 2).applied, true); // moves (0,0) -> empty (0,2)
      assert.equal(dbg.getState().toolCounts.fork, 0);
      assert.equal(dbg.useToolOnCell('fork', 0, 1, 'trash').removed, true);
      assert.equal(dbg.getSaveData().consumableSpentStardust, preConsumable + 45);
      const forkBlocked = dbg.useToolOnCell('fork', 0, 2, 'trash');
      assert.equal(Boolean(forkBlocked && forkBlocked.applied), false);
      const curSave = dbg.getSaveData();
      assert.equal(curSave.bankStardust, curSave.totalEarnedStardust - SaveSync.computeSpentStardust(curSave));

      // Verify dev_tools Lv.1..3 starting free charges ({1,1}, {2,1}, {2,2})
      const expectedToolTable = [
        { lv: 1, tools: { fork: 1, spoon: 1 } },
        { lv: 2, tools: { fork: 2, spoon: 1 } },
        { lv: 3, tools: { fork: 2, spoon: 2 } }
      ];
      for (const { lv, tools } of expectedToolTable) {
        dbg.openModal('shop');
        dbg.clickHit('shop_tab_devices');
        assert.equal(dbg.clickHit('shop_buy_dev_tools'), true);
        assert.equal(dbg.getSaveData().deviceUpgrades.dev_tools, lv);
        dbg.closeModal();
        dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(110 + lv) });
        assert.deepEqual(dbg.getState().toolCounts, tools);
      }

      // 3) Patron Active Skills: mikan, luna, mugi
      // Mikan: +45% patience + 5.0s patience freeze
      dbg.setSaveData({ ...dbg.getSaveData(), selectedPatron: 'mikan' });
      dbg.startLevel('1-1', { skipTutorial: true, forceCharge: true, rng: mulberry32(202) });
      dbg.advanceTime(4.0); // seat customers and let some patience decay
      const seatBeforeMikan = dbg.getState().seats.find(Boolean);
      assert.ok(seatBeforeMikan);
      dbg.castPatronSkill({ forceCharge: true });
      const seatAfterMikan =
        dbg.getState().seats.find((s) => s && s.customerId === seatBeforeMikan.customerId) ||
        dbg.getState().seats.find(Boolean);
      assert.ok(seatAfterMikan.patience > seatBeforeMikan.patience);
      const frozenPat = seatAfterMikan.patience;
      dbg.advanceTime(3.0); // within 5.0s freeze window
      const seatDuringFreeze = dbg.getState().seats.find(Boolean);
      assert.ok(Math.abs(seatDuringFreeze.patience - frozenPat) < 1e-4);

      // Luna: clears C1s, sorts remaining tiles descending, and boosts next serve x1.50
      dbg.setSaveData({ ...dbg.getSaveData(), selectedPatron: 'luna' });
      dbg.startLevel('1-1', { skipTutorial: true, forceCharge: true, rng: mulberry32(303) });
      const lunaRes = dbg.castPatronSkill({ forceCharge: true });
      assert.ok(lunaRes && lunaRes.clearedCount >= 2);
      assert.equal(dbg.getState().grid.cells[0][0].tile.tier, 2);
      assert.equal(dbg.getState().score, 0);
      serveOneCustomerOnLevel1(dbg);
      const lunaBoostedFirstServe = dbg.getState().score;
      // Compare with identical seed without casting Luna active skill
      dbg.startLevel('1-1', { skipTutorial: true, forceCharge: true, rng: mulberry32(303) });
      serveOneCustomerOnLevel1(dbg);
      const unboostedFirstServe = dbg.getState().score;
      assert.ok(lunaBoostedFirstServe > unboostedFirstServe);

      // Mugi: thaws all frozen tiles on 3-1 + upgrades up to 2 tiles +1 gold
      dbg.setSaveData({ ...dbg.getSaveData(), selectedPatron: 'mugi' });
      dbg.startLevel('3-1', { skipTutorial: true, forceCharge: true, rng: mulberry32(404) });
      const mugiRes = dbg.castPatronSkill({ forceCharge: true });
      assert.ok(mugiRes && mugiRes.shatteredCells.length >= 2);
      const gAfterMugi = dbg.getState().grid;
      for (let r = 0; r < gAfterMugi.rows; r++) {
        for (let c = 0; c < gAfterMugi.cols; c++) {
          const t = gAfterMugi.cells[r][c].tile;
          if (t) assert.equal(t.frozenHp, 0);
        }
      }
      assert.equal(dbg.getState().score, 0);
    } finally {
      env.dispose();
    }
  });

  await runTest('UT-M06', '6步非阻塞聚光灯新手引导状态机 (1-1 三连步 / 1-3 厨余 / 2-1 抹茶 / 3-1 破冰)', () => {
    const env = bootMockApp();
    try {
      const { dbg } = env;
      dbg.setSaveData(SaveSync.createDefaultSave());

      // 1-1: intro_slide_1 -> intro_slide_2 -> intro_slide_3 -> seenTutorials.intro_slide = true
      dbg.startLevel('1-1', { rng: mulberry32(501) });
      assert.equal(dbg.getState().activeModal, null);
      assert.equal(dbg.getState().activeTutorialStep, 'intro_slide_1');

      const mergeSlide = dbg.slide('left');
      assert.equal(mergeSlide.moved, true);
      assert.ok(mergeSlide.mergeEvents.length >= 1);
      assert.equal(dbg.getState().activeModal, null);
      assert.equal(dbg.getState().activeTutorialStep, 'intro_slide_2');

      const kneadStep = dbg.knead();
      assert.equal(kneadStep.spawned, true);
      assert.equal(dbg.getState().activeModal, null);
      assert.equal(dbg.getState().activeTutorialStep, 'intro_slide_3');

      serveOneCustomerOnLevel1(dbg);
      assert.equal(dbg.getState().activeTutorialStep, null);
      assert.equal(dbg.getSaveData().seenTutorials.intro_slide, true);

      // 1-3: tray_trash triggers when >=2 unmatched tray items or tray full, completes on doubleTapTray
      dbg.startLevel('1-3', { rng: mulberry32(502) });
      for (let k = 0; k < 4; k++) dbg.knead();
      let placedCnt = 0;
      const g13 = dbg.getState().grid;
      for (let r = 0; r < g13.rows && placedCnt < 3; r++) {
        for (let c = 0; c < g13.cols && placedCnt < 3; c++) {
          if (g13.cells[r][c].tile) {
            if (dbg.tapBoardCell(r, c).placed) placedCnt++;
          }
        }
      }
      assert.equal(dbg.getState().activeModal, null);
      assert.equal(dbg.getState().activeTutorialStep, 'tray_trash');
      dbg.doubleTapTray(0);
      assert.equal(dbg.getState().activeTutorialStep, null);
      assert.equal(dbg.getSaveData().seenTutorials.tray_trash, true);

      // Also verify 6.0s auto-fade path on tray_trash when untouched
      dbg.setSaveData({
        ...dbg.getSaveData(),
        seenTutorials: { ...dbg.getSaveData().seenTutorials, tray_trash: false }
      });
      dbg.startLevel('1-3', { rng: mulberry32(503) });
      for (let k = 0; k < 4; k++) dbg.knead();
      let placedCnt2 = 0;
      const g13b = dbg.getState().grid;
      for (let r = 0; r < g13b.rows && placedCnt2 < 3; r++) {
        for (let c = 0; c < g13b.cols && placedCnt2 < 3; c++) {
          if (g13b.cells[r][c].tile) {
            if (dbg.tapBoardCell(r, c).placed) placedCnt2++;
          }
        }
      }
      assert.equal(dbg.getState().activeTutorialStep, 'tray_trash');
      dbg.advanceTime(6.5);
      assert.equal(dbg.getState().activeTutorialStep, null);
      assert.equal(dbg.getSaveData().seenTutorials.tray_trash, true);

      // 2-1: flavor_tile completes on matcha dye or merge
      dbg.startLevel('2-1', { rng: mulberry32(504) });
      assert.equal(dbg.getState().activeModal, null);
      assert.equal(dbg.getState().activeTutorialStep, 'flavor_tile');
      const dirs = ['down', 'up', 'left', 'right'];
      for (let step = 0; step < 12 && dbg.getState().activeTutorialStep === 'flavor_tile'; step++) {
        dbg.knead();
        dbg.slide(dirs[step % 4]);
      }
      assert.equal(dbg.getState().activeTutorialStep, null);
      assert.equal(dbg.getSaveData().seenTutorials.flavor_tile, true);

      // 3-1: ice_tile completes on ice shatter (orthogonal merge or fork ice shatter)
      dbg.startLevel('3-1', { rng: mulberry32(505) });
      assert.equal(dbg.getState().activeModal, null);
      assert.equal(dbg.getState().activeTutorialStep, 'ice_tile');
      for (let step = 0; step < 18 && dbg.getState().activeTutorialStep === 'ice_tile'; step++) {
        dbg.knead();
        dbg.slide(dirs[step % 4]);
      }
      if (dbg.getState().activeTutorialStep === 'ice_tile') {
        dbg.useToolOnCell('fork', 1, 2);
      }
      assert.equal(dbg.getState().activeTutorialStep, null);
      assert.equal(dbg.getSaveData().seenTutorials.ice_tile, true);

      // W2-F06a: 1-3 with skipTutorial: true MUST NEVER arm tray_trash mid-run
      dbg.setSaveData(SaveSync.createDefaultSave());
      dbg.startLevel('1-3', { skipTutorial: true, rng: mulberry32(506) });
      dbg.advanceTime(0.6);
      for (let k = 0; k < 4; k++) dbg.knead();
      let placedSkip = 0;
      const gSkip = dbg.getState().grid;
      for (let r = 0; r < gSkip.rows && placedSkip < 3; r++) {
        for (let c = 0; c < gSkip.cols && placedSkip < 3; c++) {
          if (gSkip.cells[r][c].tile && dbg.tapBoardCell(r, c).placed) {
            placedSkip++;
          }
        }
      }
      assert.equal(dbg.getState().activeTutorialStep, null);

      // W2-F06b: 1-3 single misplaced tile (filled === 1 matching zero seated slots) triggers tray_trash
      dbg.setSaveData(SaveSync.createDefaultSave());
      dbg.startLevel('1-3', { skipTutorial: false, rng: mulberry32(507) });
      dbg.advanceTime(0.6);
      // Upgrade board tiles with spoon/merges until we have a tier unmatched by any seated customer
      let unmatchedCoord = null;
      for (let attempt = 0; attempt < 20 && !unmatchedCoord; attempt++) {
        const curSt = dbg.getState();
        const neededSet = new Set();
        for (const s of curSt.seats) {
          if (!s) continue;
          for (const sl of s.slots) neededSet.add(sl.tier);
        }
        for (let r = 0; r < curSt.grid.rows && !unmatchedCoord; r++) {
          for (let c = 0; c < curSt.grid.cols && !unmatchedCoord; c++) {
            const t = curSt.grid.cells[r][c].tile;
            if (t && t.frozenHp === 0 && !neededSet.has(t.tier)) {
              unmatchedCoord = { r, c };
            }
          }
        }
        if (!unmatchedCoord) {
          dbg.knead();
          dbg.slide(dirs[attempt % 4]);
          // Upgrade first tile via spoon if needed to exceed C1/C2
          const gCur = dbg.getState().grid;
          outerSpoon: for (let r = 0; r < gCur.rows; r++) {
            for (let c = 0; c < gCur.cols; c++) {
              if (gCur.cells[r][c].tile) {
                dbg.setSaveData({ ...dbg.getSaveData(), bankStardust: 200 });
                dbg.useToolOnCell('spoon', r, c);
                break outerSpoon;
              }
            }
          }
        }
      }
      assert.ok(unmatchedCoord, 'Expected to locate a single tile unmatched by seated 1-3 customers');
      assert.equal(dbg.tapBoardCell(unmatchedCoord.r, unmatchedCoord.c).placed, true);
      assert.equal(dbg.getState().tray.filter(Boolean).length, 1);
      assert.equal(dbg.getState().activeTutorialStep, 'tray_trash');

      // W2-F02: Portrait 390x844 tap on [跳过] (334, 118) over seat_2 dismisses tutorial without selecting seat_2
      dbg.setSaveData(SaveSync.createDefaultSave());
      dbg.startLevel('2-1', { skipTutorial: false, rng: mulberry32(508) });
      dbg.advanceTime(3.2); // ensure all 3 seats incl. seat_2 are occupied
      assert.equal(dbg.getState().activeTutorialStep, 'flavor_tile');
      assert.ok(dbg.getState().seats[2] !== null, 'Expected seat_2 to be occupied underneath tutorialSkipRect');
      const seat2Hit = dbg.getState().hits.find((h) => h.id === 'seat_2');
      assert.ok(seat2Hit && 334 >= seat2Hit.x && 334 <= seat2Hit.x + seat2Hit.w);
      assert.ok(118 >= seat2Hit.y && 118 <= seat2Hit.y + seat2Hit.h);
      for (const fn of env.touchListeners.start) {
        fn({ touches: [{ clientX: 334, clientY: 118 }], changedTouches: [{ clientX: 334, clientY: 118 }] });
      }
      for (const fn of env.touchListeners.end) {
        fn({ touches: [], changedTouches: [{ clientX: 334, clientY: 118 }] });
      }
      assert.equal(dbg.getState().activeTutorialStep, null);
      assert.equal(dbg.getSaveData().seenTutorials.flavor_tile, true);
      assert.equal(dbg.getState().preferredSeatIdx, null);
    } finally {
      env.dispose();
    }
  });

  await runTest('UT-M07', 'Wave-1 回归门禁：WeChat WebAudio、setSaveData 隔离、防挂死、预校验扣费、原型污染与 45° 斜划死区', async () => {
    const env = bootMockApp();
    try {
      const { dbg, spy, touchListeners, keyListeners } = env;

      // 1) W2-F01 + W2-F07: No premature AudioContext on boot; gesture invokes wx.setInnerAudioOption + wx.createWebAudioContext; setSaveData syncs active BGM
      assert.equal(spy.createWebAudioContextCalls, 0);
      dbg.clickHit('lobby_bgm_btn'); // waltz -> bossa + unlock()
      assert.equal(spy.createWebAudioContextCalls, 1);
      assert.ok(spy.setInnerAudioOptionCalls.length >= 1);
      assert.deepEqual(spy.setInnerAudioOptionCalls[0], { obeyMuteSwitch: true });
      assert.ok(spy.lastAudioCtx && spy.lastAudioCtx._gainNodes.length >= 2);
      const bgmMasterNode = spy.lastAudioCtx._gainNodes[0]; // first gain node after compressor is _bgmMasterGain
      assert.ok(bgmMasterNode.gain.value > 0.01, 'Expected active BGM master gain > 0.01');

      // setSaveData({ bgmTrack: 'off' }) stops active BGM; setSaveData({ bgmTrack: 'waltz' }) restarts BGM
      dbg.setSaveData({ ...dbg.getSaveData(), bgmTrack: 'off' });
      assert.ok(bgmMasterNode.gain.value <= 0.001, 'Expected BGM master gain ramped down on bgmTrack=off');
      dbg.setSaveData({ ...dbg.getSaveData(), bgmTrack: 'waltz' });
      assert.ok(bgmMasterNode.gain.value > 0.01, 'Expected BGM master gain restored on bgmTrack=waltz');

      // SFX oscillator trigger check
      const oscBefore = spy.oscillatorStarts;
      dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(701) });
      dbg.knead();
      assert.ok(spy.oscillatorStarts > oscBefore, 'Expected procedural WebAudio oscillators to fire on SFX');

      // 2) W2-F03a: Spread bankStardust override & non-mutation of input fixture
      const spreadSaved = dbg.setSaveData({ ...dbg.getSaveData(), bankStardust: 500 });
      assert.equal(spreadSaved.bankStardust, 500);
      const frozenV1 = Object.freeze({
        bankStardust: 50,
        unlockedPatrons: ['mikan', 'luna'],
        selectedPatron: 'luna',
        unlockedThemes: ['amber', 'sakura'],
        equippedTheme: 'sakura',
        shopUpgrades: { up_tools: 2 },
        bestChef: 8000
      });
      const migSaved = dbg.setSaveData(frozenV1);
      assert.equal(migSaved.bankStardust, 230);
      assert.equal(Object.prototype.hasOwnProperty.call(frozenV1, 'schemaVersion'), false);

      // 3) W2-F04: advanceTime(Infinity / NaN / -5) non-finite guard
      dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(702) });
      const tlBefore = dbg.getState().timeLeft;
      dbg.advanceTime(Infinity);
      dbg.advanceTime(-Infinity);
      dbg.advanceTime(NaN);
      dbg.advanceTime('Infinity');
      dbg.advanceTime(-5);
      assert.equal(dbg.getState().timeLeft, tlBefore);

      // 4) W2-F05: Invalid/empty/OOB/frozen target cell charges 0 stardust & consumes 0 buy limit; pause modal blocks mutations
      dbg.setSaveData({ schemaVersion: 2, totalEarnedStardust: 100, bankStardust: 100 });
      dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(703) }); // fork:1, spoon:0
      assert.equal(dbg.useToolOnCell('spoon', 0, 2).applied, false); // empty cell on 1-1
      assert.equal(dbg.useToolOnCell('spoon', -1, 0).applied, false); // OOB
      assert.equal(dbg.useToolOnCell('spoon', NaN, 0).applied, false); // NaN
      assert.equal(dbg.getSaveData().bankStardust, 100);
      assert.equal(dbg.getSaveData().consumableSpentStardust, 0);

      // Frozen tile on 3-1 charges 0 stardust for spoon
      dbg.startLevel('3-1', { skipTutorial: true, rng: mulberry32(704) });
      assert.equal(dbg.useToolOnCell('spoon', 1, 2).applied, false); // (1,2) is frozen on 3-1
      assert.equal(dbg.getSaveData().bankStardust, 100);
      assert.equal(dbg.getSaveData().consumableSpentStardust, 0);
      // Valid non-frozen tile (0,1) STILL succeeds because 1/level limit was NOT wasted!
      assert.equal(dbg.useToolOnCell('spoon', 0, 1).upgraded, true);
      assert.equal(dbg.getSaveData().bankStardust, 75);
      assert.equal(dbg.getSaveData().consumableSpentStardust, 25);

      // Pause modal blocks tool & tray discard mutations
      dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(705) });
      assert.equal(dbg.tapBoardCell(0, 0).placed, true);
      dbg.openModal('pause');
      assert.equal(dbg.useToolOnCell('fork', 0, 1, 'trash').applied, false);
      assert.equal(dbg.doubleTapTray(0).discarded, false);
      assert.ok(dbg.getState().tray[0] !== null);
      dbg.closeModal();

      // 5) W2-F08a: Object.prototype pollution immunity on keyboard, catalog & image lookups
      dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(706) });
      const tilesBeforeSpace = countBoardTiles(dbg.getState().grid);
      const wxImg = globalThis.wx.createImage();
      assert.equal(UI.isReadyImage(wxImg), false, 'Unloaded wx.createImage() must not be ready');
      await new Promise((resolve) => {
        wxImg.onload = resolve;
        wxImg.src = 'assets/catcake_1.png';
      });
      assert.equal(Object.prototype.hasOwnProperty.call(wxImg, 'width'), false, 'wxImg.width must live on prototype');
      assert.equal(UI.isReadyImage(wxImg), true, 'Loaded prototype-getter wx.createImage() must be ready');
      try {
        Object.prototype[' '] = 'left';
        Object.prototype['1'] = 'up';
        Object.prototype.width = 512;
        Object.prototype.height = 512;
        assert.equal(UI.isReadyImage({}), false, 'Plain {} must stay unready under Object.prototype width/height pollution');
        assert.equal(UI.isReadyImage(wxImg), true, 'Prototype-getter wxImg stays ready under Object.prototype pollution');
        for (const kfn of keyListeners) {
          kfn({ key: ' ' });
        }
        assert.equal(countBoardTiles(dbg.getState().grid), tilesBeforeSpace + 1, 'Space must knead, not slide left');
        for (const kfn of keyListeners) {
          kfn({ key: '1' });
        }
        assert.equal(dbg.getState().activeTool, 'fork', 'Key 1 must arm fork, not slide up');
        for (const kfn of keyListeners) {
          kfn({ key: 'toString' });
        }
        assert.equal(dbg.getState().activeTool, 'fork');
      } finally {
        delete Object.prototype[' '];
        delete Object.prototype['1'];
        delete Object.prototype.width;
        delete Object.prototype.height;
      }
      dbg.clickHit('tool_fork_btn'); // disarm fork

      // 6) W2-F08b: Pure 45-degree diagonal swipe (dx=25, dy=25) rejected; curved swipe with axisDiff >= 4 & dist >= 20 accepted
      dbg.startLevel('1-1', { skipTutorial: true, rng: mulberry32(707) });
      const bl = dbg.getState().boardLayout;
      const sx = bl.gridX + bl.gridW * 0.5;
      const sy = bl.gridY + bl.gridH * 0.5;
      const gridSnapBefore = JSON.stringify(dbg.getState().grid.cells);

      for (const fn of touchListeners.start) {
        fn({ touches: [{ clientX: sx, clientY: sy }], changedTouches: [{ clientX: sx, clientY: sy }] });
      }
      for (const fn of touchListeners.move) {
        fn({ touches: [{ clientX: sx + 25, clientY: sy + 25 }], changedTouches: [{ clientX: sx + 25, clientY: sy + 25 }] });
      }
      for (const fn of touchListeners.end) {
        fn({ touches: [], changedTouches: [{ clientX: sx + 25, clientY: sy + 25 }] });
      }
      assert.equal(JSON.stringify(dbg.getState().grid.cells), gridSnapBefore, 'Pure 45-deg swipe must NOT slide');

      // Delayed diagonal that establishes primary axis (13,13 -> 19,13: dist > 20, axisDiff = 6 >= 4) slides right
      for (const fn of touchListeners.start) {
        fn({ touches: [{ clientX: sx, clientY: sy }], changedTouches: [{ clientX: sx, clientY: sy }] });
      }
      for (const fn of touchListeners.move) {
        fn({ touches: [{ clientX: sx + 13, clientY: sy + 13 }], changedTouches: [{ clientX: sx + 13, clientY: sy + 13 }] });
      }
      assert.equal(JSON.stringify(dbg.getState().grid.cells), gridSnapBefore);
      for (const fn of touchListeners.move) {
        fn({ touches: [{ clientX: sx + 19, clientY: sy + 13 }], changedTouches: [{ clientX: sx + 19, clientY: sy + 13 }] });
      }
      for (const fn of touchListeners.end) {
        fn({ touches: [], changedTouches: [{ clientX: sx + 19, clientY: sy + 13 }] });
      }
      assert.notEqual(JSON.stringify(dbg.getState().grid.cells), gridSnapBefore, 'Established axis after diagonal delay must slide');

      // 7) W2-F09 + v0.9.0 unlockLevel gating: Shop red-dot parity & leaderboard_auth_btn synthetic clickHit fallback
      dbg.closeModal();
      dbg.openModal('pause');
      dbg.clickHit('pause_lobby_btn');
      // C3 (unlockLevel: '1-1', cost: 40) is unlocked on fresh save -> red dot shown & purchasable
      dbg.setSaveData({
        ...SaveSync.createDefaultSave(),
        levelStars: {},
        catcakeLevels: { 1: 4, 2: 4, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        bankStardust: 40
      });
      spy.styles.length = 0;
      dbg.advanceTime(0.01);
      assert.ok(spy.styles.includes('#E6483B'), 'Expected dock_shop red dot when C3 (40 stardust, 1-1 unlocked) is purchasable');
      dbg.openModal('shop');
      assert.equal(dbg.clickHit('shop_buy_catcake_3'), true);
      assert.equal(dbg.getSaveData().catcakeLevels['3'], 1);
      dbg.closeModal();

      // C4 (unlockLevel: '1-3', cost: 49 -> 50) MUST NOT show red dot or allow purchase when 1-3 is still locked (bank 49 < dev_tools 50)
      dbg.setSaveData({
        ...SaveSync.createDefaultSave(),
        levelStars: {},
        catcakeLevels: { 1: 4, 2: 4, 3: 4, 4: 0, 5: 0, 6: 0, 7: 0 },
        deviceUpgrades: { dev_tray: 2, dev_flour: 3, dev_teapot: 3, dev_tools: 3 },
        unlockedPatrons: ['mikan', 'luna', 'mugi'],
        unlockedThemes: ['amber', 'sakura', 'moonlight'],
        bankStardust: 50
      });
      spy.styles.length = 0;
      dbg.advanceTime(0.01);
      assert.equal(spy.styles.includes('#E6483B'), false, 'Locked C4 (requires 1-3) must NOT trigger false dock_shop red dot');
      dbg.openModal('shop');
      dbg.clickHit('shop_buy_catcake_4');
      assert.equal(dbg.getSaveData().catcakeLevels['4'], 0, 'Locked C4 must block purchase');
      dbg.closeModal();

      // Once 1-1 & 1-2 are cleared (1-3 unlocked), C4 lights red dot and can be upgraded
      dbg.setSaveData({
        ...dbg.getSaveData(),
        levelStars: { '1-1': 1, '1-2': 1 },
        bankStardust: 50
      });
      spy.styles.length = 0;
      dbg.advanceTime(0.01);
      assert.ok(spy.styles.includes('#E6483B'), 'Unlocked C4 (1-3 unlocked, 50 stardust) must show dock_shop red dot');
      dbg.openModal('shop');
      assert.equal(dbg.clickHit('shop_buy_catcake_4'), true);
      assert.equal(dbg.getSaveData().catcakeLevels['4'], 1);
      dbg.closeModal();

      dbg.openModal('leaderboard');
      assert.equal(dbg.getSaveData().playerProfile.authorized, false);
      assert.equal(dbg.clickHit('leaderboard_auth_btn'), true);
      assert.equal(dbg.getSaveData().playerProfile.authorized, true);
      dbg.closeModal();
    } finally {
      env.dispose();
    }

    // 8) W2-F03b: Browser mock-cloud (!globalThis.wx) sequential setSaveData + flushCloudPush + reload isolation
    const origWxOuter = globalThis.wx;
    delete globalThis.wx;
    try {
      for (const modName of ['platform.js', 'game_app.js']) {
        delete require.cache[path.join(SRC_DIR, modName)];
      }
      const freshPlatform = require(path.join(SRC_DIR, 'platform.js'));
      freshPlatform.removeStorage(Constants.STORAGE_KEY);
      freshPlatform.removeStorage('__hoshi_browser_cloud_doc_v1__');
      freshPlatform.removeStorage('__hoshi_browser_cloud_doc_v2__');

      const CloudCfg = require(path.join(SRC_DIR, 'cloud_config.js'));
      const origDebounce = CloudCfg.SYNC_DEBOUNCE_MS;
      CloudCfg.SYNC_DEBOUNCE_MS = 25;
      try {
        const { createApp: createBrowserApp } = require(path.join(SRC_DIR, 'game_app.js'));
        const bDbg = createBrowserApp();
        await new Promise((r) => setTimeout(r, 20));

        // Contaminate browser mock cloud with upgrades from an earlier run
        bDbg.setSaveData({
          schemaVersion: 2,
          totalEarnedStardust: 500,
          lastSyncedEarnedStardust: 500,
          bankStardust: 500
        });
        bDbg.openModal('shop');
        bDbg.clickHit('shop_tab_catcakes');
        assert.equal(bDbg.clickHit('shop_buy_catcake_1'), true); // -25
        bDbg.clickHit('shop_tab_devices');
        assert.equal(bDbg.clickHit('shop_buy_dev_tray'), true); // -75
        bDbg.closeModal();
        await new Promise((r) => setTimeout(r, 60)); // let flushCloudPush persist to __hoshi_browser_cloud_doc_v1__

        // Now inject v1Fixture via setSaveData, buy catcake_2 (-30 -> 200), wait > debounce, and verify ZERO contamination
        bDbg.setSaveData({
          bankStardust: 50,
          unlockedPatrons: ['mikan', 'luna'],
          selectedPatron: 'luna',
          unlockedThemes: ['amber', 'sakura'],
          equippedTheme: 'sakura',
          shopUpgrades: { up_tools: 2 },
          bestChef: 8000
        });
        assert.equal(bDbg.getSaveData().bankStardust, 230);
        assert.equal(bDbg.getSaveData().deviceUpgrades.dev_tray, 0);
        bDbg.openModal('shop');
        bDbg.clickHit('shop_tab_catcakes');
        assert.equal(bDbg.clickHit('shop_buy_catcake_2'), true); // -30 -> 200
        bDbg.closeModal();
        await new Promise((r) => setTimeout(r, 60));
        assert.equal(bDbg.getSaveData().bankStardust, 200);
        assert.equal(bDbg.getSaveData().deviceUpgrades.dev_tray, 0);
        assert.equal(bDbg.getSaveData().catcakeLevels['1'], 0);

        // High-stardust setup (5680) + purchase (-25 -> 5655) must NOT be clamped by stale cloud baseline
        bDbg.setSaveData({
          schemaVersion: 2,
          totalEarnedStardust: 5680,
          lastSyncedEarnedStardust: 5680,
          bankStardust: 5680
        });
        bDbg.openModal('shop');
        bDbg.clickHit('shop_tab_catcakes');
        assert.equal(bDbg.clickHit('shop_buy_catcake_1'), true);
        bDbg.closeModal();
        await new Promise((r) => setTimeout(r, 60));
        assert.equal(bDbg.getSaveData().bankStardust, 5655);

        // Reset via setSaveData({}) + simulated Page.reload() must NOT resurrect prior cloud state
        bDbg.setSaveData({});
        assert.equal(bDbg.getSaveData().bankStardust, 15);
        const reloadedDbg = createBrowserApp();
        await new Promise((r) => setTimeout(r, 40));
        assert.equal(reloadedDbg.getSaveData().bankStardust, 15);
        assert.equal(reloadedDbg.getSaveData().deviceUpgrades.dev_tray, 0);
        reloadedDbg.setSaveData({}); // cancel any timers cleanly
      } finally {
        CloudCfg.SYNC_DEBOUNCE_MS = origDebounce;
        freshPlatform.removeStorage(Constants.STORAGE_KEY);
        freshPlatform.removeStorage('__hoshi_browser_cloud_doc_v1__');
        freshPlatform.removeStorage('__hoshi_browser_cloud_doc_v2__');
      }
    } finally {
      if (origWxOuter === undefined) delete globalThis.wx;
      else globalThis.wx = origWxOuter;
    }
  });
}

// ============================================================================
// Main Entrypoint
// ============================================================================

async function main() {
  console.log('=== 一起做猫饼 v0.9.0 Core L1 + L2 + M4 Verification Suite ===');
  await runSectionA();
  await runSectionB();
  await runSectionC();
  await runSectionD();
  await runSectionE();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n=== Summary: Passed ${passed} / ${results.length} tests (Failed: ${failed}) ===`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exitCode = 1;
});
