/**
 * Minimal headless WeChat-runtime stub to boot the real game_app controller in Node.
 * Used by scripts/sim_balance.mjs so balance bots exercise the exact production orchestration
 * (slide / knead / tray / serve / skills / fever / goals / events / perks) instead of a re-implementation.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const SRC_DIR = path.join(REPO_ROOT, '05-微信小游戏版本', 'src');
const require = createRequire(import.meta.url);

function createNoopCtx2D(canvas) {
  const target = {
    canvas,
    measureText(t) {
      return { width: String(t || '').length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createPattern() {
      return null;
    },
    getImageData(x, y, w, h) {
      return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h };
    },
    getTransform() {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    }
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      return () => {};
    },
    set(t, prop, val) {
      t[prop] = val;
      return true;
    }
  });
}

export function bootHeadlessApp({ width = 390, height = 844, dpr = 2 } = {}) {
  const storage = new Map();
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  const origSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...args) => {
    const id = origSetTimeout(fn, ms, ...args);
    if (id && typeof id.unref === 'function') id.unref();
    return id;
  };
  const origSetInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...args) => {
    const id = origSetInterval(fn, ms, ...args);
    if (id && typeof id.unref === 'function') id.unref();
    return id;
  };

  globalThis.wx = {
    getWindowInfo() {
      return {
        windowWidth: width,
        windowHeight: height,
        pixelRatio: dpr,
        statusBarHeight: 20,
        safeArea: { left: 0, top: 20, right: width, bottom: height, width, height: height - 20 }
      };
    },
    getSystemInfoSync() {
      return this.getWindowInfo();
    },
    getMenuButtonBoundingClientRect() {
      return null;
    },
    createCanvas() {
      const canvas = {
        width: width * dpr,
        height: height * dpr,
        style: {},
        _ctx: null,
        getContext(type) {
          if (type !== '2d') return null;
          if (!this._ctx) this._ctx = createNoopCtx2D(this);
          return this._ctx;
        },
        getBoundingClientRect() {
          return { left: 0, top: 0, right: width, bottom: height, width, height };
        },
        addEventListener() {},
        removeEventListener() {}
      };
      return canvas;
    },
    createImage() {
      const img = { width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, complete: false, onload: null, onerror: null };
      let src = '';
      Object.defineProperty(img, 'src', {
        get() {
          return src;
        },
        set(v) {
          src = String(v || '');
          img.width = img.height = img.naturalWidth = img.naturalHeight = 192;
          img.complete = true;
          queueMicrotask(() => {
            if (typeof img.onload === 'function') img.onload();
          });
        }
      });
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
    onWindowResize() {},
    onTouchStart() {},
    onTouchMove() {},
    onTouchEnd() {},
    onTouchCancel() {},
    onKeyDown() {},
    onShow() {},
    onHide() {},
    setInnerAudioOption() {},
    vibrateShort() {},
    showShareMenu() {},
    onShareAppMessage() {},
    shareAppMessage() {},
    setUserCloudStorage() {},
    reportEvent() {}
  };

  const { createApp } = require(path.join(SRC_DIR, 'game_app.js'));
  const silenced = console.warn;
  console.warn = () => {};
  const appInstance = createApp();
  console.warn = silenced;
  const dbg = globalThis.__HOSHI_DEBUG__;
  return { app: appInstance, dbg, storage, require: (m) => require(path.join(SRC_DIR, m)) };
}
