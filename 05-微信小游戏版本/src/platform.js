/**
 * Unified Platform Abstraction Layer for WeChat Mini Game (`wx.*`)
 * with browser Canvas/Storage/WebAudio & Node-safe mock CloudBase v2 fallback.
 */
'use strict';

const {
  GAME_TITLE,
  ASSET_PATHS,
  DEFAULT_INITIAL_STARDUST,
  SHOP_TOTAL_CAP,
  DEFAULT_NPC_RIVALS,
  normalizePatronId
} = require('./constants');

const {
  CHAPTERS,
  VALID_LEVEL_IDS,
  MAX_CAMPAIGN_STARS,
  computeTotalStars
} = require('./levels_data');

const g =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : {};

let _saveSyncMod = null;
function getSaveSync() {
  if (!_saveSyncMod) {
    _saveSyncMod = require('./save_sync');
  }
  return _saveSyncMod;
}

const memoryStorage = new Map();

const BROWSER_MOCK_CLOUD_KEY = '__hoshi_browser_cloud_doc_v1__';
const BROWSER_MOCK_CLOUD_KEY_V2 = '__hoshi_browser_cloud_doc_v2__';

const MAX_TOTAL_STARS = MAX_CAMPAIGN_STARS;
const MAX_TOTAL_CUMULATIVE_SCORE = 3450000;
const MAX_OFFLINE_STARDUST_DELTA = 1500;
const MAX_INITIAL_UNSYNCED_STARDUST = 6000;
const MAX_SAFE_STARDUST = 9999999;
const MAX_CONSUMABLE_SPENT_STARDUST = MAX_SAFE_STARDUST - SHOP_TOTAL_CAP;
const MAX_TIMESTAMP_MS = 9999999999999;

const VALID_LEVEL_SET = new Set(VALID_LEVEL_IDS);
const CHAPTER_SCORE_CAPS = {};
for (let i = 0; i < CHAPTERS.length; i++) {
  const ch = CHAPTERS[i];
  CHAPTER_SCORE_CAPS[String(ch.chapter)] = ch.maxScoreAntiCheatCap;
}

const KNOWN_PATRON_INPUTS = new Set([
  'mikan',
  'chef_mikan',
  'luna',
  'patron_luna',
  'mugi',
  'patron_mugi'
]);

const DEFAULT_SHARE_IMAGE_URL =
  (ASSET_PATHS && ASSET_PATHS.hero) ||
  'assets/ui_v090/title_hero_v2.jpg';
const DEFAULT_APP_SHARE_TITLE = `${GAME_TITLE} · 治愈猫咪甜品屋`;
const DEFAULT_TIMELINE_SHARE_TITLE = `${GAME_TITLE} · 烤猫饼上菜闯关小游戏`;
const DEFAULT_TRIGGER_SHARE_TITLE = `${GAME_TITLE} · 来烤香喷喷的猫咪甜点吧！`;

let mainCanvas = null;
let resizeCallbacks = [];
let keyListeners = [];

function hasOwn(obj, key) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return false;
  try {
    return Object.prototype.hasOwnProperty.call(obj, key);
  } catch (_) {
    return false;
  }
}

function getOwn(obj, key) {
  if (!hasOwn(obj, key)) return undefined;
  try {
    return obj[key];
  } catch (_) {
    return undefined;
  }
}

function safeIsArray(v) {
  try {
    return Array.isArray(v);
  } catch (_) {
    return false;
  }
}

function safeArrayLength(arr) {
  if (!safeIsArray(arr)) return 0;
  try {
    const len = arr.length;
    return typeof len === 'number' && len > 0 ? len : 0;
  } catch (_) {
    return 0;
  }
}

function safeArrayAt(arr, idx) {
  if (!safeIsArray(arr) || !hasOwn(arr, idx)) return undefined;
  try {
    return arr[idx];
  } catch (_) {
    return undefined;
  }
}

function isPlainRecord(v) {
  if (v === null || v === undefined || typeof v !== 'object') return false;
  try {
    return !Array.isArray(v);
  } catch (_) {
    return false;
  }
}

function safeShallowCopyPlain(obj) {
  const out = {};
  if (!isPlainRecord(obj)) return out;
  let keys = [];
  try {
    keys = Object.keys(obj);
  } catch (_) {
    return out;
  }
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = getOwn(obj, k);
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function toSafeFiniteNumber(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function clampSafeInt(val, min, max, fallback = min) {
  const n = toSafeFiniteNumber(val);
  if (!Number.isFinite(n)) return fallback === 0 ? 0 : fallback;
  const floored = Math.floor(n);
  if (floored < min) return min === 0 ? 0 : min;
  if (floored > max) return max === 0 ? 0 : max;
  return floored === 0 ? 0 : floored;
}

function readBoundedBoardMetric(obj, key, maxVal) {
  if (!isPlainRecord(obj) || !hasOwn(obj, key)) return 0;
  const val = getOwn(obj, key);
  if (val === undefined) return 0;
  if (typeof val !== 'number' || !Number.isFinite(val) || !Number.isInteger(val) || val < 0 || val > maxVal) {
    return -1;
  }
  return val === 0 ? 0 : val;
}

function safeErrorText(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const errMsg = getOwn(err, 'errMsg');
    if (typeof errMsg === 'string') return errMsg;
    const msg = getOwn(err, 'message');
    if (typeof msg === 'string') return msg;
    try {
      if (typeof err.errMsg === 'string') return err.errMsg;
      if (typeof err.message === 'string') return err.message;
    } catch (_) {}
  }
  try {
    return String(err);
  } catch (_) {
    return 'unknown_error';
  }
}

function normalizeZero(n) {
  return n === 0 ? 0 : n;
}

function safeReadProp(obj, key) {
  if (
    obj === null ||
    obj === undefined ||
    (typeof obj !== 'object' && typeof obj !== 'function')
  ) {
    return undefined;
  }
  try {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return obj[key];
    }
    if (
      !Object.prototype.hasOwnProperty.call(Object.prototype, key) &&
      !Object.prototype.hasOwnProperty.call(Array.prototype, key) &&
      !Object.prototype.hasOwnProperty.call(Function.prototype, key)
    ) {
      return obj[key];
    }
    let proto = Object.getPrototypeOf(obj);
    let depth = 0;
    while (
      proto &&
      proto !== Object.prototype &&
      proto !== Array.prototype &&
      proto !== Function.prototype &&
      depth < 16
    ) {
      if (Object.prototype.hasOwnProperty.call(proto, key)) {
        return Reflect.get(proto, key, obj);
      }
      proto = Object.getPrototypeOf(proto);
      depth++;
    }
  } catch (_) {
    return undefined;
  }
  return undefined;
}

function safeFirstItem(list) {
  if (list === null || list === undefined || typeof list !== 'object') return undefined;
  try {
    if (safeIsArray(list)) {
      return hasOwn(list, 0) ? list[0] : undefined;
    }
    const len = safeReadProp(list, 'length');
    if (typeof len !== 'number' || !(len > 0)) return undefined;
    if (hasOwn(list, 0)) return list[0];
    const itemFn = safeReadProp(list, 'item');
    if (typeof itemFn === 'function') {
      return itemFn.call(list, 0);
    }
  } catch (_) {}
  return undefined;
}

function getWxObject() {
  try {
    const cand = safeReadProp(g, 'wx');
    if (cand !== null && cand !== undefined && typeof cand === 'object') {
      Object.getPrototypeOf(cand);
      return cand;
    }
  } catch (_) {}
  return null;
}

function isWxCanvasEnv() {
  try {
    const wxObj = getWxObject();
    if (!wxObj) return false;
    const createCanvasFn = safeReadProp(wxObj, 'createCanvas');
    return typeof createCanvasFn === 'function';
  } catch (_) {
    return false;
  }
}

function getSafeDocument() {
  try {
    const d = safeReadProp(g, 'document');
    if (d !== null && d !== undefined && typeof d === 'object') {
      Object.getPrototypeOf(d);
      return d;
    }
  } catch (_) {}
  return null;
}

function hasBrowserDomEnv() {
  try {
    const win = safeReadProp(g, 'window');
    if (!win || typeof win !== 'object') return false;
    Object.getPrototypeOf(win);
    return Boolean(getSafeDocument());
  } catch (_) {
    return false;
  }
}

function getUsableLocalStorage() {
  try {
    if (!hasBrowserDomEnv()) {
      const desc = Object.getOwnPropertyDescriptor(g, 'localStorage');
      if (!desc || !('value' in desc) || !desc.value || typeof desc.value !== 'object') {
        return null;
      }
      const mockLs = desc.value;
      Object.getPrototypeOf(mockLs);
      if (
        typeof safeReadProp(mockLs, 'getItem') === 'function' &&
        typeof safeReadProp(mockLs, 'setItem') === 'function' &&
        typeof safeReadProp(mockLs, 'removeItem') === 'function'
      ) {
        return mockLs;
      }
      return null;
    }
    const ls = safeReadProp(g, 'localStorage');
    if (!ls || typeof ls !== 'object') return null;
    Object.getPrototypeOf(ls);
    if (
      typeof safeReadProp(ls, 'getItem') === 'function' &&
      typeof safeReadProp(ls, 'setItem') === 'function' &&
      typeof safeReadProp(ls, 'removeItem') === 'function'
    ) {
      return ls;
    }
  } catch (_) {}
  return null;
}

function sanitizeMockMenuRect(mr) {
  if (!isPlainRecord(mr)) return null;
  const mLeft = getOwn(mr, 'left');
  const mTop = getOwn(mr, 'top');
  const mRight = getOwn(mr, 'right');
  const mBottom = getOwn(mr, 'bottom');
  const mWidth = getOwn(mr, 'width');
  const mHeight = getOwn(mr, 'height');
  if (
    typeof mLeft !== 'number' ||
    !Number.isFinite(mLeft) ||
    typeof mTop !== 'number' ||
    !Number.isFinite(mTop) ||
    typeof mRight !== 'number' ||
    !Number.isFinite(mRight) ||
    typeof mBottom !== 'number' ||
    !Number.isFinite(mBottom) ||
    typeof mWidth !== 'number' ||
    !Number.isFinite(mWidth) ||
    mWidth <= 0 ||
    typeof mHeight !== 'number' ||
    !Number.isFinite(mHeight) ||
    mHeight <= 0
  ) {
    return null;
  }
  return {
    left: normalizeZero(mLeft),
    top: normalizeZero(mTop),
    right: normalizeZero(mRight),
    bottom: normalizeZero(mBottom),
    width: normalizeZero(mWidth),
    height: normalizeZero(mHeight)
  };
}

function getSystemMetrics() {
  if (isWxCanvasEnv()) {
    const wxObj = getWxObject();
    let win = null;
    try {
      const getWinFn = wxObj ? safeReadProp(wxObj, 'getWindowInfo') : null;
      const getSysFn = wxObj ? safeReadProp(wxObj, 'getSystemInfoSync') : null;
      if (typeof getWinFn === 'function') {
        win = getWinFn.call(wxObj);
      } else if (typeof getSysFn === 'function') {
        win = getSysFn.call(wxObj);
      }
    } catch (_) {
      try {
        const getSysFn = wxObj ? safeReadProp(wxObj, 'getSystemInfoSync') : null;
        if (typeof getSysFn === 'function') {
          win = getSysFn.call(wxObj);
        }
      } catch (_2) {
        win = {};
      }
    }
    win = isPlainRecord(win) ? win : {};
    const rawW = toSafeFiniteNumber(getOwn(win, 'windowWidth'));
    const rawH = toSafeFiniteNumber(getOwn(win, 'windowHeight'));
    const rawDpr = toSafeFiniteNumber(getOwn(win, 'pixelRatio'));
    const width = normalizeZero(Math.max(320, Number.isFinite(rawW) && rawW > 0 ? rawW : 390));
    const height = normalizeZero(Math.max(480, Number.isFinite(rawH) && rawH > 0 ? rawH : 844));
    const dpr = normalizeZero(
      Math.min(Math.max(1, Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 2), 2.0)
    );

    const rawStatusH = toSafeFiniteNumber(getOwn(win, 'statusBarHeight'));
    const defaultSafeTop = Number.isFinite(rawStatusH)
      ? rawStatusH > 0
        ? Math.round(rawStatusH)
        : 0
      : 20;
    const rawSafeArea = getOwn(win, 'safeArea');
    let safeTop = defaultSafeTop;
    let safeBottom = 0;
    if (isPlainRecord(rawSafeArea)) {
      const saTop = toSafeFiniteNumber(getOwn(rawSafeArea, 'top'));
      const saBottom = toSafeFiniteNumber(getOwn(rawSafeArea, 'bottom'));
      safeTop = Number.isFinite(saTop) && saTop > 0 ? Math.round(saTop) : 0;
      const rawSb = height - (Number.isFinite(saBottom) && saBottom > 0 ? saBottom : height);
      safeBottom = Number.isFinite(rawSb) && rawSb > 0 ? Math.round(rawSb) : 0;
    }

    let menuRect = null;
    try {
      const getMenuFn = wxObj ? safeReadProp(wxObj, 'getMenuButtonBoundingClientRect') : null;
      if (typeof getMenuFn === 'function') {
        const mr = getMenuFn.call(wxObj);
        if (isPlainRecord(mr)) {
          const mLeft = toSafeFiniteNumber(getOwn(mr, 'left'));
          const mRight = toSafeFiniteNumber(getOwn(mr, 'right'));
          const mTop = toSafeFiniteNumber(getOwn(mr, 'top'));
          const mBottom = toSafeFiniteNumber(getOwn(mr, 'bottom'));
          const mWidth = toSafeFiniteNumber(getOwn(mr, 'width'));
          const mHeight = toSafeFiniteNumber(getOwn(mr, 'height'));
          if (
            Number.isFinite(mWidth) &&
            mWidth > 0 &&
            Number.isFinite(mLeft) &&
            mLeft > 0 &&
            Number.isFinite(mTop) &&
            Number.isFinite(mHeight) &&
            mHeight > 0
          ) {
            const effRight = Number.isFinite(mRight) ? mRight : mLeft + mWidth;
            const effBottom = Number.isFinite(mBottom) ? mBottom : mTop + mHeight;
            menuRect = {
              left: normalizeZero(mLeft),
              right: normalizeZero(effRight),
              top: normalizeZero(mTop),
              bottom: normalizeZero(effBottom),
              width: normalizeZero(mWidth),
              height: normalizeZero(mHeight)
            };
          }
        }
      }
    } catch (_) {}

    return {
      width,
      height,
      dpr,
      safeTop: normalizeZero(safeTop),
      safeBottom: normalizeZero(safeBottom),
      menuRect,
      isWeChat: true
    };
  }

  let rawInnerW = NaN;
  let rawInnerH = NaN;
  let rawDevDpr = NaN;
  let mockRect = null;
  let mockSafeTop = 8;
  let mockSafeBottom = 0;
  try {
    rawInnerW = toSafeFiniteNumber(safeReadProp(g, 'innerWidth'));
    rawInnerH = toSafeFiniteNumber(safeReadProp(g, 'innerHeight'));
    rawDevDpr = toSafeFiniteNumber(safeReadProp(g, 'devicePixelRatio'));
    if (hasOwn(g, '__WX_MOCK_CAPSULE__')) {
      mockRect = sanitizeMockMenuRect(getOwn(g, '__WX_MOCK_CAPSULE__'));
    }
    if (hasOwn(g, '__WX_MOCK_SAFE_TOP__')) {
      const mst = toSafeFiniteNumber(getOwn(g, '__WX_MOCK_SAFE_TOP__'));
      if (Number.isFinite(mst)) {
        mockSafeTop = mst > 0 ? Math.round(mst) : 0;
      }
    }
    if (hasOwn(g, '__WX_MOCK_SAFE_BOTTOM__')) {
      const msb = toSafeFiniteNumber(getOwn(g, '__WX_MOCK_SAFE_BOTTOM__'));
      if (Number.isFinite(msb)) {
        mockSafeBottom = msb > 0 ? Math.round(msb) : 0;
      }
    }
  } catch (_) {}

  const width = normalizeZero(Math.max(320, Number.isFinite(rawInnerW) && rawInnerW > 0 ? rawInnerW : 390));
  const height = normalizeZero(Math.max(480, Number.isFinite(rawInnerH) && rawInnerH > 0 ? rawInnerH : 844));
  const dpr = normalizeZero(
    Math.min(Math.max(1, Number.isFinite(rawDevDpr) && rawDevDpr > 0 ? rawDevDpr : 1), 2.0)
  );
  return {
    width,
    height,
    dpr,
    safeTop: mockSafeTop > 0 ? Math.round(mockSafeTop) : 0,
    safeBottom: mockSafeBottom > 0 ? Math.round(mockSafeBottom) : 0,
    menuRect: mockRect,
    isWeChat: false
  };
}

function makeStubCanvas(metrics) {
  const w = normalizeZero(Math.round(metrics.width * metrics.dpr));
  const h = normalizeZero(Math.round(metrics.height * metrics.dpr));
  return {
    width: w,
    height: h,
    style: {},
    getContext() {
      return null;
    },
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        right: metrics.width,
        bottom: metrics.height,
        width: metrics.width,
        height: metrics.height
      };
    },
    addEventListener() {},
    removeEventListener() {}
  };
}

function isCachedCanvasUsable(c) {
  if (!c || typeof c !== 'object') return false;
  try {
    Object.getPrototypeOf(c);
    if (Object.isFrozen(c)) return false;
    const w = c.width;
    const h = c.height;
    void w;
    void h;
    if (hasOwn(c, 'width')) {
      const dw = Object.getOwnPropertyDescriptor(c, 'width');
      if (dw && dw.writable === false && typeof dw.set !== 'function') return false;
    }
    if (hasOwn(c, 'height')) {
      const dh = Object.getOwnPropertyDescriptor(c, 'height');
      if (dh && dh.writable === false && typeof dh.set !== 'function') return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function notifyResizeListeners(m) {
  for (let i = 0; i < resizeCallbacks.length; i++) {
    const fn = resizeCallbacks[i];
    if (typeof fn === 'function') {
      try {
        fn(m);
      } catch (_) {}
    }
  }
}

function createMainCanvas() {
  if (mainCanvas) {
    if (isCachedCanvasUsable(mainCanvas)) {
      return mainCanvas;
    }
    mainCanvas = null;
  }
  const metrics = getSystemMetrics();
  const targetW = normalizeZero(Math.round(metrics.width * metrics.dpr));
  const targetH = normalizeZero(Math.round(metrics.height * metrics.dpr));

  if (isWxCanvasEnv()) {
    const wxObj = getWxObject();
    let cand = null;
    try {
      const createFn = wxObj ? safeReadProp(wxObj, 'createCanvas') : null;
      const created = typeof createFn === 'function' ? createFn.call(wxObj) : null;
      if (created && typeof created === 'object' && !Object.isFrozen(created)) {
        Object.getPrototypeOf(created);
        created.width = targetW;
        created.height = targetH;
        cand = created;
      }
    } catch (_) {
      cand = null;
    }

    if (!cand) {
      return makeStubCanvas(metrics);
    }

    mainCanvas = cand;
    try {
      const onWinResizeFn = wxObj ? safeReadProp(wxObj, 'onWindowResize') : null;
      if (typeof onWinResizeFn === 'function') {
        onWinResizeFn.call(wxObj, () => {
          try {
            const m = getSystemMetrics();
            if (mainCanvas) {
              try {
                mainCanvas.width = normalizeZero(Math.round(m.width * m.dpr));
                mainCanvas.height = normalizeZero(Math.round(m.height * m.dpr));
              } catch (_) {}
            }
            notifyResizeListeners(m);
          } catch (_) {}
        });
      }
    } catch (_) {}
    return mainCanvas;
  }

  const doc = getSafeDocument();
  const createElFn = doc ? safeReadProp(doc, 'createElement') : null;
  if (!doc || typeof createElFn !== 'function') {
    return makeStubCanvas(metrics);
  }

  try {
    const getByIdFn = safeReadProp(doc, 'getElementById');
    const existingEl = typeof getByIdFn === 'function' ? getByIdFn.call(doc, 'game-canvas') : null;
    const cand = existingEl || createElFn.call(doc, 'canvas');
    if (!cand || typeof cand !== 'object' || Object.isFrozen(cand)) {
      return makeStubCanvas(metrics);
    }
    Object.getPrototypeOf(cand);

    try {
      const parentNode = safeReadProp(cand, 'parentNode');
      const body = safeReadProp(doc, 'body');
      const appendFn = body ? safeReadProp(body, 'appendChild') : null;
      if (!parentNode && body && typeof appendFn === 'function') {
        appendFn.call(body, cand);
      }
    } catch (_) {}

    try {
      let styleObj = safeReadProp(cand, 'style');
      if (!styleObj || typeof styleObj !== 'object') {
        cand.style = {};
        styleObj = cand.style;
      }
      if (styleObj && typeof styleObj === 'object' && !Object.isFrozen(styleObj)) {
        styleObj.display = 'block';
        styleObj.width = '100%';
        styleObj.height = '100%';
        styleObj.touchAction = 'none';
      }
    } catch (_) {}

    cand.width = targetW;
    cand.height = targetH;
    mainCanvas = cand;

    try {
      const addListenerFn = safeReadProp(g, 'addEventListener');
      if (typeof addListenerFn === 'function') {
        addListenerFn.call(g, 'resize', () => {
          try {
            const m = getSystemMetrics();
            if (mainCanvas) {
              try {
                mainCanvas.width = normalizeZero(Math.round(m.width * m.dpr));
                mainCanvas.height = normalizeZero(Math.round(m.height * m.dpr));
              } catch (_) {}
            }
            notifyResizeListeners(m);
          } catch (_) {}
        });
      }
    } catch (_) {}
    return mainCanvas;
  } catch (_) {
    mainCanvas = null;
    return makeStubCanvas(metrics);
  }
}

function onResize(cb) {
  if (typeof cb === 'function') {
    resizeCallbacks.push(cb);
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (typeof src !== 'string' || !src.trim()) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    try {
      let img = null;
      const wxObj = getWxObject();
      const createImgFn = wxObj ? safeReadProp(wxObj, 'createImage') : null;
      if (isWxCanvasEnv() && typeof createImgFn === 'function') {
        img = createImgFn.call(wxObj);
      } else {
        const ImgCtor = safeReadProp(g, 'Image');
        if (typeof ImgCtor === 'function') {
          img = new ImgCtor();
        }
      }
      if (!img || typeof img !== 'object') {
        finish(null);
        return;
      }
      Object.getPrototypeOf(img);
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = src;
    } catch (_) {
      finish(null);
    }
  });
}

function getStorageJSON(key) {
  if (typeof key !== 'string' || !key) return null;
  try {
    if (isWxCanvasEnv()) {
      const wxObj = getWxObject();
      const getSyncFn = wxObj ? safeReadProp(wxObj, 'getStorageSync') : null;
      if (typeof getSyncFn === 'function') {
        const raw = getSyncFn.call(wxObj, key);
        if (raw === '' || raw === null || raw === undefined) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      return null;
    }
    const ls = getUsableLocalStorage();
    if (ls) {
      try {
        const getFn = safeReadProp(ls, 'getItem');
        const raw = typeof getFn === 'function' ? getFn.call(ls, key) : null;
        return raw ? JSON.parse(raw) : null;
      } catch (_) {}
    }
    if (memoryStorage.has(key)) {
      const raw = memoryStorage.get(key);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (_) {}
  return null;
}

function setStorageJSON(key, value) {
  if (typeof key !== 'string' || !key) return;
  try {
    const str = JSON.stringify(value);
    if (typeof str !== 'string') return;
    if (isWxCanvasEnv()) {
      const wxObj = getWxObject();
      const setSyncFn = wxObj ? safeReadProp(wxObj, 'setStorageSync') : null;
      if (typeof setSyncFn === 'function') {
        setSyncFn.call(wxObj, key, str);
      }
      return;
    }
    const ls = getUsableLocalStorage();
    if (ls) {
      try {
        const setFn = safeReadProp(ls, 'setItem');
        if (typeof setFn === 'function') {
          setFn.call(ls, key, str);
          return;
        }
      } catch (_) {}
    }
    memoryStorage.set(key, str);
  } catch (_) {}
}

function removeStorage(key) {
  if (typeof key !== 'string' || !key) return;
  try {
    if (isWxCanvasEnv()) {
      const wxObj = getWxObject();
      const remSyncFn = wxObj ? safeReadProp(wxObj, 'removeStorageSync') : null;
      const setSyncFn = wxObj ? safeReadProp(wxObj, 'setStorageSync') : null;
      if (typeof remSyncFn === 'function') {
        remSyncFn.call(wxObj, key);
      } else if (typeof setSyncFn === 'function') {
        setSyncFn.call(wxObj, key, '');
      }
      return;
    }
    const ls = getUsableLocalStorage();
    if (ls) {
      try {
        const remFn = safeReadProp(ls, 'removeItem');
        if (typeof remFn === 'function') {
          remFn.call(ls, key);
          return;
        }
      } catch (_) {}
    }
    memoryStorage.delete(key);
  } catch (_) {}
}

function createAudioContext() {
  try {
    if (isWxCanvasEnv()) {
      const wxObj = getWxObject();
      try {
        const setOptFn = wxObj ? safeReadProp(wxObj, 'setInnerAudioOption') : null;
        if (typeof setOptFn === 'function') {
          setOptFn.call(wxObj, { obeyMuteSwitch: true });
        }
      } catch (_) {}
      try {
        const createAudioFn = wxObj ? safeReadProp(wxObj, 'createWebAudioContext') : null;
        if (typeof createAudioFn === 'function') {
          return createAudioFn.call(wxObj);
        }
      } catch (_) {}
      return null;
    }

    const AudioCtx = safeReadProp(g, 'AudioContext') || safeReadProp(g, 'webkitAudioContext');
    return typeof AudioCtx === 'function' ? new AudioCtx() : null;
  } catch (_) {
    return null;
  }
}

function bindLifecycle(onShow, onHide) {
  const invokeShow = () => {
    if (typeof onShow === 'function') {
      try {
        onShow();
      } catch (_) {}
    }
  };
  const invokeHide = () => {
    if (typeof onHide === 'function') {
      try {
        onHide();
      } catch (_) {}
    }
  };

  if (isWxCanvasEnv()) {
    const wxObj = getWxObject();
    if (!wxObj) return;
    try {
      const fn = safeReadProp(wxObj, 'onShow');
      if (typeof fn === 'function') fn.call(wxObj, invokeShow);
    } catch (_) {}
    try {
      const fn = safeReadProp(wxObj, 'onHide');
      if (typeof fn === 'function') fn.call(wxObj, invokeHide);
    } catch (_) {}
    try {
      const fn = safeReadProp(wxObj, 'onAudioInterruptionBegin');
      if (typeof fn === 'function') fn.call(wxObj, invokeHide);
    } catch (_) {}
    try {
      const fn = safeReadProp(wxObj, 'onAudioInterruptionEnd');
      if (typeof fn === 'function') fn.call(wxObj, invokeShow);
    } catch (_) {}
    return;
  }

  try {
    const doc = getSafeDocument();
    const docAddFn = doc ? safeReadProp(doc, 'addEventListener') : null;
    if (doc && typeof docAddFn === 'function') {
      docAddFn.call(doc, 'visibilitychange', () => {
        try {
          if (safeReadProp(doc, 'hidden')) {
            invokeHide();
          } else {
            invokeShow();
          }
        } catch (_) {}
      });
    }
  } catch (_) {}

  try {
    const gAddFn = safeReadProp(g, 'addEventListener');
    if (typeof gAddFn === 'function') {
      gAddFn.call(g, 'pageshow', () => {
        try {
          const curDoc = getSafeDocument();
          if (!curDoc || !safeReadProp(curDoc, 'hidden')) {
            invokeShow();
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
}

function readTouchClientCoords(t) {
  if (!t || typeof t !== 'object') return null;
  try {
    Object.getPrototypeOf(t);
    const rawCx = safeReadProp(t, 'clientX');
    const rawCy = safeReadProp(t, 'clientY');
    const cx = toSafeFiniteNumber(rawCx !== undefined ? rawCx : safeReadProp(t, 'x'));
    const cy = toSafeFiniteNumber(rawCy !== undefined ? rawCy : safeReadProp(t, 'y'));
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
    return {
      x: normalizeZero(cx),
      y: normalizeZero(cy)
    };
  } catch (_) {
    return null;
  }
}

function bindPointerEvents(canvas, handlers) {
  const h = isPlainRecord(handlers) ? handlers : {};
  const onDown = safeReadProp(h, 'onDown');
  const onMove = safeReadProp(h, 'onMove');
  const onUp = safeReadProp(h, 'onUp');
  const onCancel = safeReadProp(h, 'onCancel');
  const onWheel = safeReadProp(h, 'onWheel');

  if (isWxCanvasEnv()) {
    const wxObj = getWxObject();
    if (!wxObj) return;

    const extractWxTouch = (ev) => {
      if (!ev || typeof ev !== 'object') return null;
      const changed = safeReadProp(ev, 'changedTouches');
      const active = safeReadProp(ev, 'touches');
      const t = safeFirstItem(changed) || safeFirstItem(active);
      return readTouchClientCoords(t);
    };

    try {
      const fn = safeReadProp(wxObj, 'onTouchStart');
      if (typeof fn === 'function') {
        fn.call(wxObj, (ev) => {
          if (typeof onDown !== 'function') return;
          const pt = extractWxTouch(ev);
          if (!pt) return;
          try {
            onDown({ x: pt.x, y: pt.y, pointerType: 'touch' });
          } catch (_) {}
        });
      }
    } catch (_) {}

    try {
      const fn = safeReadProp(wxObj, 'onTouchMove');
      if (typeof fn === 'function') {
        fn.call(wxObj, (ev) => {
          if (typeof onMove !== 'function') return;
          const pt = extractWxTouch(ev);
          if (!pt) return;
          try {
            onMove({ x: pt.x, y: pt.y, pointerType: 'touch' });
          } catch (_) {}
        });
      }
    } catch (_) {}

    try {
      const fn = safeReadProp(wxObj, 'onTouchEnd');
      if (typeof fn === 'function') {
        fn.call(wxObj, (ev) => {
          if (typeof onUp !== 'function') return;
          const pt = extractWxTouch(ev);
          if (!pt) return;
          try {
            onUp({ x: pt.x, y: pt.y, pointerType: 'touch' });
          } catch (_) {}
        });
      }
    } catch (_) {}

    try {
      const fn = safeReadProp(wxObj, 'onTouchCancel');
      if (typeof fn === 'function') {
        fn.call(wxObj, () => {
          if (typeof onCancel === 'function') {
            try {
              onCancel();
            } catch (_) {}
          }
        });
      }
    } catch (_) {}
    return;
  }

  let canvasAddFn = null;
  try {
    if (canvas && typeof canvas === 'object') {
      Object.getPrototypeOf(canvas);
      const candAdd = safeReadProp(canvas, 'addEventListener');
      if (typeof candAdd === 'function') {
        canvasAddFn = candAdd;
      }
    }
  } catch (_) {
    canvasAddFn = null;
  }
  if (!canvasAddFn) {
    return;
  }

  const mapCoords = (ev) => {
    let rectLeft = 0;
    let rectTop = 0;
    try {
      const getRectFn = safeReadProp(canvas, 'getBoundingClientRect');
      if (typeof getRectFn === 'function') {
        const rect = getRectFn.call(canvas);
        if (rect && typeof rect === 'object') {
          const rl = toSafeFiniteNumber(safeReadProp(rect, 'left'));
          const rt = toSafeFiniteNumber(safeReadProp(rect, 'top'));
          if (Number.isFinite(rl)) rectLeft = rl;
          if (Number.isFinite(rt)) rectTop = rt;
        }
      }
    } catch (_) {}

    let cx = 0;
    let cy = 0;
    let pType = 'mouse';
    try {
      if (ev && typeof ev === 'object') {
        Object.getPrototypeOf(ev);
        const touches = safeReadProp(ev, 'touches');
        const changedTouches = safeReadProp(ev, 'changedTouches');
        const firstTouch = safeFirstItem(touches) || safeFirstItem(changedTouches);
        let rawX;
        let rawY;
        if (firstTouch && typeof firstTouch === 'object') {
          const tx = safeReadProp(firstTouch, 'clientX');
          const ty = safeReadProp(firstTouch, 'clientY');
          rawX = tx !== undefined ? tx : safeReadProp(firstTouch, 'x');
          rawY = ty !== undefined ? ty : safeReadProp(firstTouch, 'y');
        } else {
          const ex = safeReadProp(ev, 'clientX');
          const ey = safeReadProp(ev, 'clientY');
          rawX = ex !== undefined ? ex : safeReadProp(ev, 'x');
          rawY = ey !== undefined ? ey : safeReadProp(ev, 'y');
        }
        const nx = toSafeFiniteNumber(rawX);
        const ny = toSafeFiniteNumber(rawY);
        if (Number.isFinite(nx)) cx = nx;
        if (Number.isFinite(ny)) cy = ny;
        const rawPType = safeReadProp(ev, 'pointerType');
        if (typeof rawPType === 'string' && rawPType) {
          pType = rawPType;
        }
      }
    } catch (_) {}

    return {
      x: normalizeZero(cx - rectLeft),
      y: normalizeZero(cy - rectTop),
      pointerType: pType
    };
  };

  try {
    canvasAddFn.call(canvas, 'pointerdown', (ev) => {
      if (typeof onDown === 'function') {
        try {
          onDown(mapCoords(ev));
        } catch (_) {}
      }
    });
    canvasAddFn.call(canvas, 'pointermove', (ev) => {
      if (typeof onMove === 'function') {
        try {
          onMove(mapCoords(ev));
        } catch (_) {}
      }
    });
    canvasAddFn.call(canvas, 'pointerup', (ev) => {
      if (typeof onUp === 'function') {
        try {
          onUp(mapCoords(ev));
        } catch (_) {}
      }
    });
    canvasAddFn.call(canvas, 'pointercancel', () => {
      if (typeof onCancel === 'function') {
        try {
          onCancel();
        } catch (_) {}
      }
    });
    canvasAddFn.call(
      canvas,
      'wheel',
      (ev) => {
        if (typeof onWheel === 'function') {
          try {
            const preventFn = safeReadProp(ev, 'preventDefault');
            if (typeof preventFn === 'function') {
              try {
                preventFn.call(ev);
              } catch (_) {}
            }
            const coords = mapCoords(ev);
            const rawDy = safeReadProp(ev, 'deltaY');
            const dy = toSafeFiniteNumber(rawDy);
            onWheel(coords.x, coords.y, Number.isFinite(dy) ? normalizeZero(dy) : 0);
          } catch (_) {}
        }
      },
      { passive: false }
    );
  } catch (_) {}

  // Prevent browser zoom gestures
  try {
    const doc = getSafeDocument();
    const docAddFn = doc ? safeReadProp(doc, 'addEventListener') : null;
    if (doc && typeof docAddFn === 'function') {
      docAddFn.call(
        doc,
        'gesturestart',
        (ev) => {
          try {
            const preventFn = safeReadProp(ev, 'preventDefault');
            if (typeof preventFn === 'function') preventFn.call(ev);
          } catch (_) {}
        },
        { passive: false }
      );
      docAddFn.call(
        doc,
        'dblclick',
        (ev) => {
          try {
            const preventFn = safeReadProp(ev, 'preventDefault');
            if (typeof preventFn === 'function') preventFn.call(ev);
          } catch (_) {}
        },
        { passive: false }
      );
    }
  } catch (_) {}
}

function bindKeyboard(cb) {
  if (typeof cb !== 'function') return;
  if (isWxCanvasEnv()) {
    try {
      const wxObj = getWxObject();
      const onKeyDownFn = wxObj ? safeReadProp(wxObj, 'onKeyDown') : null;
      if (typeof onKeyDownFn === 'function') {
        onKeyDownFn.call(wxObj, (res) => {
          const rawKey = safeReadProp(res, 'key');
          const safeKey = typeof rawKey === 'string' ? rawKey : '';
          try {
            cb(safeKey, res);
          } catch (_) {}
        });
      }
    } catch (_) {}
    return;
  }
  try {
    const gAddFn = safeReadProp(g, 'addEventListener');
    if (typeof gAddFn === 'function') {
      const fn = (ev) => {
        const rawKey = safeReadProp(ev, 'key');
        const keyVal = typeof rawKey === 'string' ? rawKey : '';
        try {
          cb(keyVal, ev);
        } catch (_) {}
      };
      gAddFn.call(g, 'keydown', fn);
      keyListeners.push(fn);
    }
  } catch (_) {}
}

function vibrateShort(style = 'light') {
  try {
    const wxObj = getWxObject();
    const vibFn = wxObj ? safeReadProp(wxObj, 'vibrateShort') : null;
    if (typeof vibFn === 'function') {
      vibFn.call(wxObj, { type: typeof style === 'string' && style ? style : 'light' });
    }
  } catch (_) {}
}

const reportedEventLog = [];
const MAX_REPORTED_EVENT_LOG = 200;

/**
 * We分析 custom analytics event (wx.reportEvent). Values are coerced to string/number only,
 * keys limited to [a-z0-9_]. In browser/dev the call is recorded to an in-memory log for tests.
 */
function reportEvent(name, data) {
  try {
    if (typeof name !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(name)) return false;
    const payload = {};
    if (isPlainRecord(data)) {
      const keys = Object.keys(data);
      for (let i = 0; i < keys.length && i < 40; i++) {
        const k = String(keys[i]).replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()).replace(/[^a-z0-9_]/g, '').slice(0, 32);
        if (!k) continue;
        const v = data[keys[i]];
        if (typeof v === 'number' && Number.isFinite(v)) payload[k] = v;
        else if (typeof v === 'string') payload[k] = v.slice(0, 64);
        else if (typeof v === 'boolean') payload[k] = v ? 1 : 0;
      }
    }
    reportedEventLog.push({ name, payload });
    if (reportedEventLog.length > MAX_REPORTED_EVENT_LOG) reportedEventLog.shift();
    const wxObj = getWxObject();
    const fn = wxObj ? safeReadProp(wxObj, 'reportEvent') : null;
    if (typeof fn === 'function') {
      fn.call(wxObj, name, payload);
      return true;
    }
  } catch (_) {}
  return false;
}

function getReportedEventLog() {
  return reportedEventLog.slice();
}

function normalizeSharePayload(rawPayload, fallbackTitle) {
  const p = isPlainRecord(rawPayload) ? rawPayload : {};
  const rawTitle = getOwn(p, 'title');
  const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : fallbackTitle;
  const rawImage = getOwn(p, 'imageUrl');
  const imageUrl =
    typeof rawImage === 'string' && rawImage.trim() ? rawImage.trim() : DEFAULT_SHARE_IMAGE_URL;
  const out = { title, imageUrl };
  const rawQuery = getOwn(p, 'query');
  if (typeof rawQuery === 'string' && rawQuery.trim()) {
    out.query = rawQuery.trim();
  }
  return out;
}

function setupShare(getSharePayload) {
  const wxObj = getWxObject();
  if (!wxObj) return;
  try {
    const showMenuFn = safeReadProp(wxObj, 'showShareMenu');
    if (typeof showMenuFn === 'function') {
      showMenuFn.call(wxObj, {
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
  } catch (_) {}
  try {
    const onAppMsgFn = safeReadProp(wxObj, 'onShareAppMessage');
    if (typeof onAppMsgFn === 'function') {
      onAppMsgFn.call(wxObj, () => {
        let raw = null;
        try {
          raw = typeof getSharePayload === 'function' ? getSharePayload() : null;
        } catch (_) {}
        return normalizeSharePayload(raw, DEFAULT_APP_SHARE_TITLE);
      });
    }
  } catch (_) {}
  try {
    const onTimelineFn = safeReadProp(wxObj, 'onShareTimeline');
    if (typeof onTimelineFn === 'function') {
      onTimelineFn.call(wxObj, () => {
        let raw = null;
        try {
          raw = typeof getSharePayload === 'function' ? getSharePayload() : null;
        } catch (_) {}
        return normalizeSharePayload(raw, DEFAULT_TIMELINE_SHARE_TITLE);
      });
    }
  } catch (_) {}
}

function triggerShare(payload) {
  try {
    const wxObj = getWxObject();
    const shareFn = wxObj ? safeReadProp(wxObj, 'shareAppMessage') : null;
    if (typeof shareFn === 'function') {
      shareFn.call(wxObj, normalizeSharePayload(payload, DEFAULT_TRIGGER_SHARE_TITLE));
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * 统一激励行为抽象桩（商业化 IAA 激励视频 / 社交分享预留扩展口）。
 * 当前 v0.9.0 返回无广告分享成功桩，后续接入 `wx.createRewardedVideoAd` 无需修改业务层调用方。
 */
function requestRewardAction(scene = 'default', opts = {}) {
  const safeScene =
    typeof scene === 'string' && scene.trim() ? scene.trim().slice(0, 32) : 'default';
  const silent = isPlainRecord(opts) && Boolean(getOwn(opts, 'silent'));
  if (!silent) {
    const sharePayload = isPlainRecord(opts) ? getOwn(opts, 'sharePayload') : null;
    triggerShare(sharePayload);
  }
  return Promise.resolve({
    ok: true,
    rewarded: true,
    channel: 'share_stub',
    scene: safeScene
  });
}

// ============================================================================
// WeChat Cloud Development (`wx.cloud`) & Native UserInfo Authorization Layer
// ============================================================================
let cloudInitialized = false;
let cloudReady = false;
let initializedWxMode = '';
let initializedWxCloudRef = null;
let activeUserInfoBtn = null;
let activeUserInfoRectKey = '';

function getDefaultNpcRivals() {
  const srcArr = safeIsArray(DEFAULT_NPC_RIVALS) ? DEFAULT_NPC_RIVALS : [];
  const out = [];
  const len = safeArrayLength(srcArr);
  for (let idx = 0; idx < len; idx++) {
    if (!hasOwn(srcArr, idx)) continue;
    const r = safeArrayAt(srcArr, idx);
    if (!isPlainRecord(r)) continue;
    const rawId = getOwn(r, 'id');
    const rawNick = getOwn(r, 'nickName');
    const rawPreset = getOwn(r, 'avatarPreset');
    out.push({
      id: typeof rawId === 'string' && rawId.trim() ? rawId.trim() : `npc_${idx + 1}`,
      nickName:
        typeof rawNick === 'string' && rawNick.trim()
          ? rawNick.trim()
          : `星夜店长#NPC${idx + 1}`,
      avatarUrl: '',
      avatarPreset: normalizePatronId(typeof rawPreset === 'string' ? rawPreset : 'mikan'),
      totalStars: clampSafeInt(getOwn(r, 'totalStars'), 0, MAX_TOTAL_STARS, 0),
      totalCumulativeScore: clampSafeInt(
        getOwn(r, 'totalCumulativeScore'),
        0,
        MAX_TOTAL_CUMULATIVE_SCORE,
        0
      ),
      isNpc: true
    });
  }
  return out;
}

function initCloud(envId = '') {
  try {
    if (isWxCanvasEnv()) {
      const wxObj = getWxObject();
      const cloudObj = wxObj ? safeReadProp(wxObj, 'cloud') : null;
      if (cloudInitialized && initializedWxMode === 'wx' && initializedWxCloudRef === cloudObj) {
        return cloudReady;
      }
      cloudInitialized = true;
      initializedWxMode = 'wx';
      initializedWxCloudRef = cloudObj;

      try {
        const onPrivFn = wxObj ? safeReadProp(wxObj, 'onNeedPrivacyAuthorization') : null;
        if (typeof onPrivFn === 'function') {
          onPrivFn.call(wxObj, (resolve) => {
            if (typeof resolve === 'function') {
              try {
                resolve({ event: 'exposureAuthorization' });
              } catch (_) {}
            }
          });
        }
      } catch (_) {}

      if (cloudObj && typeof cloudObj === 'object') {
        try {
          Object.getPrototypeOf(cloudObj);
          const initFn = safeReadProp(cloudObj, 'init');
          if (typeof initFn === 'function') {
            const opts = { traceUser: true };
            if (envId && typeof envId === 'string' && envId.trim()) {
              opts.env = envId.trim();
            }
            initFn.call(cloudObj, opts);
            cloudReady = true;
            return true;
          }
        } catch (_) {
          cloudReady = false;
          return false;
        }
      }
      cloudReady = false;
      return false;
    }

    cloudInitialized = true;
    initializedWxMode = 'browser';
    initializedWxCloudRef = null;
    cloudReady = true;
    return true;
  } catch (_) {
    cloudInitialized = true;
    cloudReady = false;
    return false;
  }
}

function addUniqueWarning(warnings, code) {
  if (!warnings.includes(code)) {
    warnings.push(code);
  }
}

function getChapterScoreCapForLevel(levelId) {
  if (typeof levelId !== 'string' || !VALID_LEVEL_SET.has(levelId)) return 35000;
  return CHAPTER_SCORE_CAPS[levelId[0]] || 35000;
}

function canonicalizePatronOrMikan(rawId) {
  if (typeof rawId !== 'string') return 'mikan';
  const trimmed = rawId.trim();
  return KNOWN_PATRON_INPUTS.has(trimmed) ? normalizePatronId(trimmed) : 'mikan';
}

function sanitizeCloudProfile(rawProf, openidSuffix, fallbackPatron = 'mikan') {
  const SaveSync = getSaveSync();
  const suffix =
    typeof openidSuffix === 'string' && openidSuffix.trim() ? openidSuffix.trim() : '0000';
  const base = SaveSync.normalizeProfile(rawProf, fallbackPatron);
  return {
    nickName: base.nickName || `星夜店长#${suffix}`,
    avatarUrl: base.avatarUrl,
    avatarPreset: base.avatarPreset,
    authorized: base.authorized,
    updatedAt: base.updatedAt
  };
}

function isPlaceholderNickName(nick, defaultName) {
  if (typeof nick !== 'string') return true;
  const trimmed = nick.trim();
  if (!trimmed) return true;
  if (defaultName && trimmed === defaultName) return true;
  return /^星夜店长#[0-9A-Za-z_-]{1,8}$/.test(trimmed);
}

function isPlaceholderCloudProfile(prof, defaultName) {
  if (!isPlainRecord(prof)) return true;
  if (getOwn(prof, 'authorized')) return false;
  if (getOwn(prof, 'avatarUrl')) return false;
  const preset = getOwn(prof, 'avatarPreset');
  if (preset && preset !== 'mikan') return false;
  const ts = getOwn(prof, 'updatedAt');
  if ((typeof ts === 'number' ? ts : 0) > 0) return false;
  return isPlaceholderNickName(getOwn(prof, 'nickName'), defaultName);
}

function mergeCloudProfiles(serverProf, clientProf, openidSuffix, fallbackPatron) {
  const suffix =
    typeof openidSuffix === 'string' && openidSuffix.trim() ? openidSuffix.trim() : '0000';
  const defaultName = `星夜店长#${suffix}`;
  const fbPreset = canonicalizePatronOrMikan(fallbackPatron);

  const hasServer = isPlainRecord(serverProf);
  const hasClient = isPlainRecord(clientProf);
  if (!hasServer && !hasClient) {
    return sanitizeCloudProfile(null, suffix, fbPreset);
  }
  if (!hasServer) {
    const cCheck = sanitizeCloudProfile(clientProf, suffix, 'mikan');
    const c = sanitizeCloudProfile(clientProf, suffix, fbPreset);
    if (
      isPlaceholderCloudProfile(cCheck, defaultName) &&
      c.avatarPreset === 'mikan' &&
      fbPreset !== 'mikan'
    ) {
      return { ...c, avatarPreset: fbPreset };
    }
    return c;
  }
  if (!hasClient) {
    const sCheck = sanitizeCloudProfile(serverProf, suffix, 'mikan');
    const s = sanitizeCloudProfile(serverProf, suffix, fbPreset);
    if (
      isPlaceholderCloudProfile(sCheck, defaultName) &&
      s.avatarPreset === 'mikan' &&
      fbPreset !== 'mikan'
    ) {
      return { ...s, avatarPreset: fbPreset };
    }
    return s;
  }

  const sCheck = sanitizeCloudProfile(serverProf, suffix, 'mikan');
  const cCheck = sanitizeCloudProfile(clientProf, suffix, 'mikan');
  const s = sanitizeCloudProfile(serverProf, suffix, fbPreset);
  const c = sanitizeCloudProfile(clientProf, suffix, fbPreset);

  if (s.authorized && !c.authorized) return s;
  if (c.authorized && !s.authorized) return c;

  const sPlaceholder = isPlaceholderCloudProfile(sCheck, defaultName);
  const cPlaceholder = isPlaceholderCloudProfile(cCheck, defaultName);
  const sHasCustomNick = !isPlaceholderNickName(sCheck.nickName, defaultName);
  const cHasCustomNick = !isPlaceholderNickName(cCheck.nickName, defaultName);
  const sTs = s.updatedAt || 0;
  const cTs = c.updatedAt || 0;

  if (cTs > sTs && !cPlaceholder) {
    return {
      ...c,
      nickName: cHasCustomNick ? c.nickName : sHasCustomNick ? s.nickName : c.nickName,
      avatarUrl: c.avatarUrl || s.avatarUrl
    };
  }
  if (sTs > cTs && !sPlaceholder) {
    return {
      ...s,
      nickName: sHasCustomNick ? s.nickName : cHasCustomNick ? c.nickName : s.nickName,
      avatarUrl: s.avatarUrl || c.avatarUrl
    };
  }

  if (sHasCustomNick && !cHasCustomNick && cTs <= sTs) {
    return {
      ...s,
      avatarUrl: s.avatarUrl || c.avatarUrl
    };
  }
  if (cHasCustomNick && !sHasCustomNick && sTs <= cTs) {
    return {
      ...c,
      avatarUrl: c.avatarUrl || s.avatarUrl
    };
  }

  if (cPlaceholder !== sPlaceholder) {
    const chosen = cPlaceholder ? s : c;
    const other = cPlaceholder ? c : s;
    const chosenCustom = cPlaceholder ? sHasCustomNick : cHasCustomNick;
    const otherCustom = cPlaceholder ? cHasCustomNick : sHasCustomNick;
    return {
      ...chosen,
      nickName: chosenCustom ? chosen.nickName : otherCustom ? other.nickName : s.nickName,
      avatarUrl: chosen.avatarUrl || other.avatarUrl
    };
  }

  if (cPlaceholder && sPlaceholder) {
    const primary = cTs > sTs ? c : s;
    const secondary = cTs > sTs ? s : c;
    let avatarPreset = primary.avatarPreset;
    if (avatarPreset === 'mikan') {
      if (fbPreset !== 'mikan') {
        avatarPreset = fbPreset;
      } else if (secondary.avatarPreset && secondary.avatarPreset !== 'mikan') {
        avatarPreset = secondary.avatarPreset;
      }
    }
    return {
      ...primary,
      avatarUrl: primary.avatarUrl || secondary.avatarUrl,
      avatarPreset
    };
  }

  const primary = cTs > sTs ? c : s;
  const secondary = cTs > sTs ? s : c;
  const primaryCustom = cTs > sTs ? cHasCustomNick : sHasCustomNick;
  const secondaryCustom = cTs > sTs ? sHasCustomNick : cHasCustomNick;
  return {
    nickName: primaryCustom ? primary.nickName : secondaryCustom ? secondary.nickName : primary.nickName,
    avatarUrl: primary.avatarUrl || secondary.avatarUrl,
    avatarPreset: primary.avatarPreset,
    authorized: primary.authorized,
    updatedAt: primary.updatedAt
  };
}

function auditAndSanitizeSaveForCloud(rawMeta, warnings) {
  const SaveSync = getSaveSync();
  if (!isPlainRecord(rawMeta)) {
    const def = SaveSync.createDefaultSave();
    def.lastSyncedEarnedStardust = def.totalEarnedStardust;
    return def;
  }

  const sv = hasOwn(rawMeta, 'schemaVersion')
    ? toSafeFiniteNumber(getOwn(rawMeta, 'schemaVersion'))
    : 0;
  if (!Number.isFinite(sv) || sv < 2) {
    return SaveSync.migrateV1ToV2(rawMeta);
  }

  const cleanScores = {};
  const rawLevelScores = getOwn(rawMeta, 'levelBestScores');
  const inScores = isPlainRecord(rawLevelScores) ? rawLevelScores : null;
  if (inScores) {
    for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
      const id = VALID_LEVEL_IDS[i];
      if (!hasOwn(inScores, id)) continue;
      const cap = getChapterScoreCapForLevel(id);
      const rawVal = toSafeFiniteNumber(getOwn(inScores, id));
      const rawInt = Number.isFinite(rawVal) ? Math.max(0, Math.floor(rawVal)) : 0;
      if (rawInt > cap) {
        addUniqueWarning(warnings, 'level_score_cap_clamped');
      }
      const sc = Math.min(cap, rawInt);
      if (sc > 0) {
        cleanScores[id] = sc;
      }
    }
  }

  const cleanStars = {};
  const rawLevelStars = getOwn(rawMeta, 'levelStars');
  const inStars = isPlainRecord(rawLevelStars) ? rawLevelStars : null;
  if (inStars) {
    for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
      const id = VALID_LEVEL_IDS[i];
      if (!hasOwn(inStars, id)) continue;
      const rawVal = toSafeFiniteNumber(getOwn(inStars, id));
      const rawInt = Number.isFinite(rawVal) ? Math.floor(rawVal) : 0;
      if (rawInt > 3 || rawInt < 0) {
        addUniqueWarning(warnings, 'level_stars_clamped');
      }
      let st = Math.max(0, Math.min(3, rawInt));
      const bestSc = hasOwn(cleanScores, id) ? cleanScores[id] : 0;
      if (st > 0 && bestSc <= 0) {
        addUniqueWarning(warnings, 'stars_without_score_clamped');
        st = 0;
      }
      if (st > 0) {
        cleanStars[id] = st;
      }
    }
  }

  const copy = safeShallowCopyPlain(rawMeta);
  if (Number.isFinite(sv) && Math.floor(sv) > 2) {
    copy.higherSchemaDetected = true;
  }
  copy.schemaVersion = 2;
  copy.levelBestScores = cleanScores;
  copy.levelStars = cleanStars;
  return SaveSync.normalizeSaveData(copy);
}

function rollbackCloudLevelProgress(clientMeta, baseMeta, levelId) {
  const SaveSync = getSaveSync();
  if (typeof levelId === 'string' && VALID_LEVEL_SET.has(levelId)) {
    const prevScore =
      baseMeta && hasOwn(baseMeta.levelBestScores, levelId)
        ? baseMeta.levelBestScores[levelId]
        : 0;
    const prevStar =
      baseMeta && hasOwn(baseMeta.levelStars, levelId) ? baseMeta.levelStars[levelId] : 0;

    if (prevScore > 0) {
      clientMeta.levelBestScores[levelId] = prevScore;
    } else {
      delete clientMeta.levelBestScores[levelId];
    }

    if (prevStar > 0 && prevScore > 0) {
      clientMeta.levelStars[levelId] = prevStar;
    } else {
      delete clientMeta.levelStars[levelId];
    }
  } else {
    const nextScores = {};
    const nextStars = {};
    if (baseMeta) {
      for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
        const id = VALID_LEVEL_IDS[i];
        if (hasOwn(baseMeta.levelBestScores, id)) {
          nextScores[id] = baseMeta.levelBestScores[id];
        }
        if (hasOwn(baseMeta.levelStars, id)) {
          nextStars[id] = baseMeta.levelStars[id];
        }
      }
    }
    clientMeta.levelBestScores = nextScores;
    clientMeta.levelStars = nextStars;
  }

  clientMeta.highestUnlockedLevel = SaveSync.computeHighestUnlockedLevel(clientMeta.levelStars);
  clientMeta.lifetimeStats.totalStars = computeTotalStars(clientMeta.levelStars);
  clientMeta.lifetimeStats.totalCumulativeScore = SaveSync.computeCumulativeScore(
    clientMeta.levelBestScores
  );
}

function applyRunReportValidation(clientMeta, baseMeta, runReport, warnings) {
  if (!isPlainRecord(runReport)) return;

  const SaveSync = getSaveSync();
  const rawScoreVal = getOwn(runReport, 'score');
  const rawScoreNum =
    typeof rawScoreVal === 'number'
      ? rawScoreVal
      : typeof rawScoreVal === 'string' && rawScoreVal.trim() !== ''
      ? Number(rawScoreVal.trim())
      : NaN;
  const rrScore = Number.isFinite(rawScoreNum)
    ? Math.floor(rawScoreNum)
    : rawScoreNum === Infinity
    ? MAX_TOTAL_CUMULATIVE_SCORE + 1
    : 0;
  if (rrScore <= 0) return;

  const rawServes = hasOwn(runReport, 'serves')
    ? getOwn(runReport, 'serves')
    : hasOwn(runReport, 'ordersServed')
    ? getOwn(runReport, 'ordersServed')
    : 0;
  const rawServesNum = toSafeFiniteNumber(rawServes);
  const rrServes = Number.isFinite(rawServesNum) ? Math.floor(rawServesNum) : 0;

  const rawDurVal = getOwn(runReport, 'durationSec');
  const hasDur =
    hasOwn(runReport, 'durationSec') && rawDurVal !== undefined && rawDurVal !== null;
  const rrDur = hasDur ? toSafeFiniteNumber(rawDurVal) : NaN;

  const rawLid = getOwn(runReport, 'levelId');
  const lid = typeof rawLid === 'string' ? rawLid.trim() : '';

  let rolledBack = false;
  if (rrServes < 1) {
    addUniqueWarning(warnings, 'zero_serve_score_rejected');
    rollbackCloudLevelProgress(clientMeta, baseMeta, lid);
    rolledBack = true;
  }

  if (hasDur && (!Number.isFinite(rrDur) || rrDur < 3)) {
    addUniqueWarning(warnings, 'implausible_run_duration');
    if (!rolledBack) {
      rollbackCloudLevelProgress(clientMeta, baseMeta, lid);
      rolledBack = true;
    }
  }

  if (!rolledBack && !VALID_LEVEL_SET.has(lid)) {
    addUniqueWarning(warnings, 'invalid_run_level');
    rollbackCloudLevelProgress(clientMeta, baseMeta, lid);
    rolledBack = true;
  }

  if (!rolledBack && VALID_LEVEL_SET.has(lid)) {
    const cap = getChapterScoreCapForLevel(lid);
    if (rrScore > cap) {
      addUniqueWarning(warnings, 'run_score_cap_clamped');
      addUniqueWarning(warnings, 'level_score_cap_clamped');
      if (hasOwn(clientMeta.levelBestScores, lid) && clientMeta.levelBestScores[lid] > cap) {
        clientMeta.levelBestScores[lid] = cap;
      }
      clientMeta.lifetimeStats.totalCumulativeScore = SaveSync.computeCumulativeScore(
        clientMeta.levelBestScores
      );
    }
  }
}

function isUntouchedDefaultMeta(s) {
  const SaveSync = getSaveSync();
  return Boolean(
    isPlainRecord(s) &&
      s.totalEarnedStardust === DEFAULT_INITIAL_STARDUST &&
      SaveSync.computeSpentStardust(s) === 0 &&
      s.lifetimeStats &&
      s.lifetimeStats.runsPlayed === 0 &&
      s.lifetimeStats.ordersServed === 0 &&
      s.lifetimeStats.vipServed === 0 &&
      s.lifetimeStats.totalStars === 0 &&
      s.lifetimeStats.totalCumulativeScore === 0 &&
      (!isPlainRecord(s.levelFailStreaks) || Object.keys(s.levelFailStreaks).length === 0) &&
      !s.migratedFromV1GiftPending &&
      s.selectedPatron === 'mikan' &&
      s.equippedTheme === 'amber' &&
      s.bgmTrack === 'waltz' &&
      s.sfxEnabled === true &&
      s.seenTutorials &&
      !s.seenTutorials.intro_slide &&
      !s.seenTutorials.tray_trash &&
      !s.seenTutorials.flavor_tile &&
      !s.seenTutorials.ice_tile &&
      isPlaceholderCloudProfile(s.playerProfile, '')
  );
}

function isUntouchedInitialServerMeta(s, prevRevision) {
  const SaveSync = getSaveSync();
  return Boolean(
    prevRevision <= 1 &&
      isPlainRecord(s) &&
      s.totalEarnedStardust === DEFAULT_INITIAL_STARDUST &&
      SaveSync.computeSpentStardust(s) === 0 &&
      s.lifetimeStats &&
      s.lifetimeStats.runsPlayed === 0 &&
      s.lifetimeStats.ordersServed === 0 &&
      s.lifetimeStats.vipServed === 0 &&
      s.lifetimeStats.totalStars === 0 &&
      s.lifetimeStats.totalCumulativeScore === 0 &&
      (!isPlainRecord(s.levelFailStreaks) || Object.keys(s.levelFailStreaks).length === 0) &&
      !s.migratedFromV1GiftPending
  );
}

const MOCK_CLOUD_LEGACY_ROOT_KEYS = [
  'activeRun',
  'savedRuns',
  'bestChef',
  'bestRush',
  'bestZen',
  'bestShiftReached',
  'shopUpgrades',
  'bankStardust',
  'totalEarnedStardust',
  'lastSyncedEarnedStardust',
  'unlockedPatrons',
  'selectedPatron',
  'unlockedThemes',
  'equippedTheme',
  'bgmTrack',
  'sfxEnabled',
  'playerProfile',
  'lifetimeStats'
];

function hasMockLegacyRootKeys(obj) {
  if (!isPlainRecord(obj)) return false;
  for (let i = 0; i < MOCK_CLOUD_LEGACY_ROOT_KEYS.length; i++) {
    if (hasOwn(obj, MOCK_CLOUD_LEGACY_ROOT_KEYS[i])) return true;
  }
  return false;
}

function mergeRawMockProfilePair(a, b, openidSuffix) {
  const hasA = isPlainRecord(a);
  const hasB = isPlainRecord(b);
  if (!hasA && !hasB) return null;
  if (!hasA) return b;
  if (!hasB) return a;
  const mergedMikan = mergeCloudProfiles(a, b, openidSuffix, 'mikan');
  const mergedProbe = mergeCloudProfiles(a, b, openidSuffix, 'luna');
  if (mergedMikan.avatarPreset !== mergedProbe.avatarPreset) {
    return {
      nickName: mergedMikan.nickName,
      avatarUrl: mergedMikan.avatarUrl,
      authorized: mergedMikan.authorized,
      updatedAt: mergedMikan.updatedAt
    };
  }
  return mergedMikan;
}

function resolveMockTopDocProfile(rawDoc, openidSuffix) {
  if (!isPlainRecord(rawDoc)) return null;
  const rawDocProf = getOwn(rawDoc, 'profile');
  const rawDocPlayerProf = getOwn(rawDoc, 'playerProfile');
  return mergeRawMockProfilePair(rawDocProf, rawDocPlayerProf, openidSuffix);
}

function resolveRawMockStoredProfile(rawDoc, openidSuffix) {
  if (!isPlainRecord(rawDoc)) return null;
  const rawTopProf = resolveMockTopDocProfile(rawDoc, openidSuffix);
  const rawMetaObj = getOwn(rawDoc, 'metaSave');
  const rawMetaProf =
    isPlainRecord(rawMetaObj) &&
    rawMetaObj !== rawDoc &&
    isPlainRecord(getOwn(rawMetaObj, 'playerProfile'))
      ? getOwn(rawMetaObj, 'playerProfile')
      : null;
  return mergeRawMockProfilePair(rawTopProf, rawMetaProf, openidSuffix);
}

function resolveMockStoredProfile(rawDoc, openidSuffix, fallbackPatron) {
  const rawTopProf = resolveMockTopDocProfile(rawDoc, openidSuffix);
  const rawMetaObj = isPlainRecord(rawDoc) ? getOwn(rawDoc, 'metaSave') : null;
  const rawMetaProf =
    isPlainRecord(rawMetaObj) &&
    rawMetaObj !== rawDoc &&
    isPlainRecord(getOwn(rawMetaObj, 'playerProfile'))
      ? getOwn(rawMetaObj, 'playerProfile')
      : null;
  if (isPlainRecord(rawTopProf) || isPlainRecord(rawMetaProf)) {
    return mergeCloudProfiles(rawTopProf, rawMetaProf, openidSuffix, fallbackPatron);
  }
  return sanitizeCloudProfile(null, openidSuffix, fallbackPatron);
}

function normalizeStoredCloudDoc(rawDoc, defaultSuffix = 'CAFE') {
  if (!isPlainRecord(rawDoc)) return null;

  const SaveSync = getSaveSync();
  const isWrapper =
    hasOwn(rawDoc, 'metaSave') ||
    hasOwn(rawDoc, 'revision') ||
    hasOwn(rawDoc, 'openidSuffix') ||
    (hasOwn(rawDoc, 'profile') &&
      !hasOwn(rawDoc, 'bankStardust') &&
      !hasOwn(rawDoc, 'levelStars') &&
      !hasOwn(rawDoc, 'catcakeLevels'));

  const rawSuffix = getOwn(rawDoc, 'openidSuffix');
  const openidSuffix =
    typeof rawSuffix === 'string' && rawSuffix.trim()
      ? rawSuffix.trim().slice(0, 8)
      : defaultSuffix;

  const rawRevVal = getOwn(rawDoc, 'revision');
  const hasCorruptedWrapperRevision =
    isWrapper &&
    (!hasOwn(rawDoc, 'revision') ||
      typeof rawRevVal !== 'number' ||
      !Number.isFinite(rawRevVal) ||
      !Number.isInteger(rawRevVal) ||
      rawRevVal < 1 ||
      rawRevVal > 999999999);
  const revision = hasOwn(rawDoc, 'revision')
    ? clampSafeInt(rawRevVal, 1, 999999999, 1)
    : 1;

  const rawDocProf = getOwn(rawDoc, 'profile');
  const rawDocPlayerProf = getOwn(rawDoc, 'playerProfile');
  const hasTopProf = isPlainRecord(rawDocProf);
  const hasRootPlayerProf = isPlainRecord(rawDocPlayerProf);

  const hadLegacyWrapperKeys = Boolean(isWrapper && hasMockLegacyRootKeys(rawDoc));

  let migratedFromV1 = false;
  let metaSave;

  if (!isWrapper) {
    const sv = hasOwn(rawDoc, 'schemaVersion')
      ? toSafeFiniteNumber(getOwn(rawDoc, 'schemaVersion'))
      : 0;
    if (!Number.isFinite(sv) || sv < 2) {
      let rootInput = rawDoc;
      if (!hasRootPlayerProf && hasTopProf) {
        const copyRoot = safeShallowCopyPlain(rawDoc);
        copyRoot.playerProfile = rawDocProf;
        rootInput = copyRoot;
      }
      metaSave = SaveSync.migrateV1ToV2(rootInput);
      migratedFromV1 = true;
    } else {
      metaSave = auditAndSanitizeSaveForCloud(rawDoc, []);
    }
  } else {
    const metaCand = getOwn(rawDoc, 'metaSave');
    const wrapperBestChef = hasOwn(rawDoc, 'bestChef')
      ? clampSafeInt(getOwn(rawDoc, 'bestChef'), 0, 350000, 0)
      : 0;
    const wrapperBestRush = hasOwn(rawDoc, 'bestRush')
      ? clampSafeInt(getOwn(rawDoc, 'bestRush'), 0, 85000, 0)
      : 0;
    const wrapperBestZen = hasOwn(rawDoc, 'bestZen')
      ? clampSafeInt(getOwn(rawDoc, 'bestZen'), 0, 180000, 0)
      : 0;

    if (!isPlainRecord(metaCand)) {
      if (!hasOwn(rawDoc, 'metaSave') || metaCand === undefined || hadLegacyWrapperKeys) {
        const rootSv = hasOwn(rawDoc, 'schemaVersion')
          ? toSafeFiniteNumber(getOwn(rawDoc, 'schemaVersion'))
          : 0;
        if (!Number.isFinite(rootSv) || rootSv < 2) {
          const copyRoot = safeShallowCopyPlain(rawDoc);
          if (!isPlainRecord(getOwn(copyRoot, 'playerProfile')) && hasTopProf) {
            copyRoot.playerProfile = rawDocProf;
          }
          metaSave = SaveSync.migrateV1ToV2(copyRoot);
          migratedFromV1 = Boolean(
            hadLegacyWrapperKeys || wrapperBestChef > 0 || wrapperBestRush > 0 || wrapperBestZen > 0
          );
        } else {
          metaSave = auditAndSanitizeSaveForCloud(rawDoc, []);
        }
      } else if (wrapperBestChef > 0 || wrapperBestRush > 0 || wrapperBestZen > 0) {
        metaSave = SaveSync.migrateV1ToV2({
          bestChef: wrapperBestChef,
          bestRush: wrapperBestRush,
          bestZen: wrapperBestZen,
          playerProfile: hasTopProf ? rawDocProf : hasRootPlayerProf ? rawDocPlayerProf : undefined
        });
        migratedFromV1 = true;
      } else {
        metaSave = SaveSync.migrateV1ToV2({
          playerProfile: hasTopProf ? rawDocProf : hasRootPlayerProf ? rawDocPlayerProf : undefined
        });
      }
    } else {
      const sv = hasOwn(metaCand, 'schemaVersion')
        ? toSafeFiniteNumber(getOwn(metaCand, 'schemaVersion'))
        : 0;
      if (!Number.isFinite(sv) || sv < 2) {
        const candChef = hasOwn(metaCand, 'bestChef')
          ? clampSafeInt(getOwn(metaCand, 'bestChef'), 0, 350000, 0)
          : 0;
        const candRush = hasOwn(metaCand, 'bestRush')
          ? clampSafeInt(getOwn(metaCand, 'bestRush'), 0, 85000, 0)
          : 0;
        const candZen = hasOwn(metaCand, 'bestZen')
          ? clampSafeInt(getOwn(metaCand, 'bestZen'), 0, 180000, 0)
          : 0;
        const copyCand = safeShallowCopyPlain(metaCand);
        copyCand.bestChef = Math.max(candChef, wrapperBestChef);
        copyCand.bestRush = Math.max(candRush, wrapperBestRush);
        copyCand.bestZen = Math.max(candZen, wrapperBestZen);
        if (!isPlainRecord(getOwn(copyCand, 'playerProfile'))) {
          if (isPlainRecord(getOwn(copyCand, 'profile'))) {
            copyCand.playerProfile = getOwn(copyCand, 'profile');
          } else if (hasTopProf) {
            copyCand.playerProfile = rawDocProf;
          } else if (hasRootPlayerProf) {
            copyCand.playerProfile = rawDocPlayerProf;
          }
        }
        metaSave = SaveSync.migrateV1ToV2(copyCand);
        migratedFromV1 = true;
      } else {
        metaSave = auditAndSanitizeSaveForCloud(metaCand, []);
      }
    }
  }

  metaSave.lastSyncedEarnedStardust = metaSave.totalEarnedStardust;

  const totalStars = computeTotalStars(metaSave.levelStars);
  const totalCumulativeScore = SaveSync.computeCumulativeScore(metaSave.levelBestScores);
  metaSave.lifetimeStats.totalStars = totalStars;
  metaSave.lifetimeStats.totalCumulativeScore = totalCumulativeScore;

  const rawMetaUntouched = isUntouchedDefaultMeta(metaSave);
  const rawMetaCandObj = isWrapper ? getOwn(rawDoc, 'metaSave') : null;
  const rawMetaCandSv =
    isPlainRecord(rawMetaCandObj) && hasOwn(rawMetaCandObj, 'schemaVersion')
      ? toSafeFiniteNumber(getOwn(rawMetaCandObj, 'schemaVersion'))
      : 0;
  const isExistingWrapperV2 = Boolean(Number.isFinite(rawMetaCandSv) && rawMetaCandSv >= 2);

  const profile = resolveMockStoredProfile(rawDoc, openidSuffix, metaSave.selectedPatron);
  metaSave.playerProfile = { ...profile };

  const doc = {
    schemaVersion: 2,
    openidSuffix,
    profile,
    totalStars,
    totalCumulativeScore,
    metaSave,
    revision
  };

  return {
    doc,
    migratedFromV1,
    rawMetaUntouched,
    isExistingWrapperV2,
    dirty:
      migratedFromV1 ||
      hadLegacyWrapperKeys ||
      hasOwn(rawDoc, 'playerProfile') ||
      hasCorruptedWrapperRevision ||
      !isWrapper
  };
}

function readStoredMockCloudRaw() {
  const v1 = getStorageJSON(BROWSER_MOCK_CLOUD_KEY);
  if (v1 !== null && v1 !== undefined) return v1;
  return getStorageJSON(BROWSER_MOCK_CLOUD_KEY_V2);
}

function persistMockCloudDoc(doc) {
  setStorageJSON(BROWSER_MOCK_CLOUD_KEY, doc);
  if (getStorageJSON(BROWSER_MOCK_CLOUD_KEY_V2) !== null) {
    removeStorage(BROWSER_MOCK_CLOUD_KEY_V2);
  }
}

function normalizeBoardType(rawType) {
  if (rawType === 'score' || rawType === 'totalScore') return 'score';
  return 'stars';
}

function rankLeaderboardEntries(rawBoardType, candidateRows, myStars, myScore, extraProps) {
  const boardType = normalizeBoardType(rawBoardType);
  const eligible = [];
  const rowCount = safeArrayLength(candidateRows);

  for (let i = 0; i < rowCount; i++) {
    if (!hasOwn(candidateRows, i)) continue;
    const row = safeArrayAt(candidateRows, i);
    if (!isPlainRecord(row)) continue;

    const stars = readBoundedBoardMetric(row, 'totalStars', MAX_TOTAL_STARS);
    const cumScore = readBoundedBoardMetric(
      row,
      'totalCumulativeScore',
      MAX_TOTAL_CUMULATIVE_SCORE
    );
    if (stars < 0 || cumScore < 0) continue;

    if (boardType === 'stars') {
      if (stars <= 0) continue;
    } else {
      if (cumScore <= 0) continue;
    }

    const rawId = getOwn(row, 'id');
    const id = typeof rawId === 'string' && rawId ? rawId : `row_${i + 1}`;
    const rawSuffix = getOwn(row, 'openidSuffix');
    const suffix =
      typeof rawSuffix === 'string' && rawSuffix.trim()
        ? rawSuffix.trim().slice(0, 8)
        : id.slice(-4).toUpperCase() || '0000';
    const isMe = Boolean(getOwn(row, 'isMe'));
    const isNpc = Boolean(getOwn(row, 'isNpc'));
    const rawNick = getOwn(row, 'nickName');
    const nickName =
      typeof rawNick === 'string' && rawNick.trim()
        ? rawNick.trim().slice(0, 16)
        : `星夜店长#${suffix}`;
    const rawAvatarUrl = getOwn(row, 'avatarUrl');
    const avatarUrl = typeof rawAvatarUrl === 'string' ? rawAvatarUrl.trim().slice(0, 512) : '';
    const rawPreset = getOwn(row, 'avatarPreset');
    const avatarPreset = normalizePatronId(typeof rawPreset === 'string' ? rawPreset : 'mikan');

    eligible.push({
      id,
      openidSuffix: suffix,
      isMe,
      isSelf: isMe,
      isNpc,
      nickName,
      avatarUrl,
      avatarPreset,
      totalStars: stars,
      totalCumulativeScore: cumScore,
      totalScore: cumScore,
      score: boardType === 'stars' ? stars : cumScore
    });
  }

  eligible.sort((a, b) => {
    if (boardType === 'stars') {
      if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
      if (b.totalCumulativeScore !== a.totalCumulativeScore) {
        return b.totalCumulativeScore - a.totalCumulativeScore;
      }
    } else {
      if (b.totalCumulativeScore !== a.totalCumulativeScore) {
        return b.totalCumulativeScore - a.totalCumulativeScore;
      }
      if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
    }
    const aId = String(a.id);
    const bId = String(b.id);
    return aId < bId ? -1 : aId > bId ? 1 : 0;
  });

  const totalPlayers = eligible.length;
  let myRank = null;
  for (let i = 0; i < eligible.length; i++) {
    if (eligible[i].isMe) {
      myRank = i + 1;
      break;
    }
  }

  const list = eligible.slice(0, 50).map((item, idx) => ({
    rank: idx + 1,
    ...item
  }));

  return {
    ok: true,
    boardType,
    list,
    myRank,
    totalPlayers,
    myStars: clampSafeInt(myStars, 0, MAX_TOTAL_STARS, 0),
    myScore: clampSafeInt(myScore, 0, MAX_TOTAL_CUMULATIVE_SCORE, 0),
    ...(extraProps || {})
  };
}

function buildOfflineLeaderboard(boardType = 'stars', saveData = null, openidSuffix = 'LOCAL') {
  try {
    const SaveSync = getSaveSync();
    const safeSuffix =
      typeof openidSuffix === 'string' && openidSuffix.trim()
        ? openidSuffix.trim().slice(0, 8)
        : 'LOCAL';

    let normalizedSave = null;
    let myStars = 0;
    let myScore = 0;
    let callerDisqualified = false;

    if (isPlainRecord(saveData)) {
      const rawExplicitStars = readBoundedBoardMetric(saveData, 'totalStars', MAX_TOTAL_STARS);
      const rawExplicitScore = readBoundedBoardMetric(
        saveData,
        'totalCumulativeScore',
        MAX_TOTAL_CUMULATIVE_SCORE
      );
      if (rawExplicitStars < 0 || rawExplicitScore < 0) {
        callerDisqualified = true;
      }
      if (hasOwn(saveData, 'lifetimeStats')) {
        const rawLs = getOwn(saveData, 'lifetimeStats');
        if (isPlainRecord(rawLs)) {
          const lsStars = readBoundedBoardMetric(rawLs, 'totalStars', MAX_TOTAL_STARS);
          const lsScore = readBoundedBoardMetric(
            rawLs,
            'totalCumulativeScore',
            MAX_TOTAL_CUMULATIVE_SCORE
          );
          if (lsStars < 0 || lsScore < 0) {
            callerDisqualified = true;
          }
        }
      }
      normalizedSave = SaveSync.normalizeSaveData(saveData);
      if (!callerDisqualified) {
        myStars = normalizedSave.lifetimeStats.totalStars;
        myScore = normalizedSave.lifetimeStats.totalCumulativeScore;
        if (myStars === 0 && rawExplicitStars > 0) {
          myStars = rawExplicitStars;
        }
        if (myScore === 0 && rawExplicitScore > 0) {
          myScore = rawExplicitScore;
        }
      }
    }

    const rows = getDefaultNpcRivals().map((npc, idx) => ({
      ...npc,
      id: npc.id || `npc_${idx + 1}`,
      openidSuffix: `NPC${idx + 1}`,
      isMe: false,
      isNpc: true
    }));

    if (!callerDisqualified && (myStars > 0 || myScore > 0)) {
      const prof = normalizedSave
        ? sanitizeCloudProfile(
            normalizedSave.playerProfile,
            safeSuffix,
            normalizedSave.selectedPatron
          )
        : sanitizeCloudProfile(null, safeSuffix, 'mikan');
      rows.push({
        id: 'me',
        openidSuffix: safeSuffix,
        isMe: true,
        isNpc: false,
        nickName: prof.nickName,
        avatarUrl: prof.avatarUrl,
        avatarPreset: prof.avatarPreset,
        totalStars: myStars,
        totalCumulativeScore: myScore
      });
    }

    return rankLeaderboardEntries(boardType, rows, myStars, myScore, {
      isLocalFallback: true
    });
  } catch (_) {
    return rankLeaderboardEntries(boardType, getDefaultNpcRivals(), 0, 0, {
      isLocalFallback: true
    });
  }
}

function runBrowserMockCloud(data = {}) {
  try {
    return runBrowserMockCloudInner(data);
  } catch (err) {
    return Promise.resolve({
      ok: false,
      isMockCloud: true,
      reason: 'mock_cloud_exception',
      errMsg: safeErrorText(err),
      fallbackRows: getDefaultNpcRivals()
    });
  }
}

function isHigherSchemaCloudDoc(rawObj) {
  if (!isPlainRecord(rawObj)) return false;
  const topSv = hasOwn(rawObj, 'schemaVersion')
    ? toSafeFiniteNumber(getOwn(rawObj, 'schemaVersion'))
    : 0;
  if (Number.isFinite(topSv) && Math.floor(topSv) > 2) return true;
  const rawMeta = getOwn(rawObj, 'metaSave');
  if (isPlainRecord(rawMeta) && hasOwn(rawMeta, 'schemaVersion')) {
    const metaSv = toSafeFiniteNumber(getOwn(rawMeta, 'schemaVersion'));
    if (Number.isFinite(metaSv) && Math.floor(metaSv) > 2) return true;
  }
  return false;
}

function runBrowserMockCloudInner(data = {}) {
  const SaveSync = getSaveSync();
  const req = isPlainRecord(data) ? data : {};
  const rawActionVal = getOwn(req, 'action');
  const action =
    !hasOwn(req, 'action') || rawActionVal === undefined || rawActionVal === null || rawActionVal === ''
      ? 'pull'
      : typeof rawActionVal === 'string'
      ? rawActionVal.trim() || 'pull'
      : 'invalid';

  const defaultSuffix = 'CAFE';
  const rawStored = readStoredMockCloudRaw();
  const higherSchemaStored = isHigherSchemaCloudDoc(rawStored);
  const normalizedState = rawStored ? normalizeStoredCloudDoc(rawStored, defaultSuffix) : null;
  let doc = normalizedState ? normalizedState.doc : null;
  const openidSuffix = (doc && doc.openidSuffix) || defaultSuffix;

  if (action === 'pull') {
    if (higherSchemaStored) {
      const safeReadMeta = doc
        ? SaveSync.normalizeSaveData(doc.metaSave)
        : SaveSync.createDefaultSave();
      safeReadMeta.higherSchemaDetected = true;
      const rawMetaCand = isPlainRecord(getOwn(rawStored, 'metaSave'))
        ? getOwn(rawStored, 'metaSave')
        : rawStored;
      return Promise.resolve({
        ok: true,
        isMockCloud: true,
        isNewUser: false,
        higherSchemaDetected: true,
        openidSuffix,
        profile: doc ? { ...doc.profile } : sanitizeCloudProfile(null, openidSuffix, 'mikan'),
        totalStars: doc ? doc.totalStars : safeReadMeta.lifetimeStats.totalStars,
        totalCumulativeScore: doc
          ? doc.totalCumulativeScore
          : safeReadMeta.lifetimeStats.totalCumulativeScore,
        metaSave: rawMetaCand,
        revision: doc ? doc.revision : 1
      });
    }

    if (!doc) {
      const now = Date.now();
      const freshMeta = SaveSync.createDefaultSave();
      freshMeta.lastSyncedEarnedStardust = freshMeta.totalEarnedStardust;
      const freshProf = sanitizeCloudProfile(null, openidSuffix, 'mikan');
      freshMeta.playerProfile = { ...freshProf };
      freshMeta.updatedAt = now;
      doc = {
        schemaVersion: 2,
        openidSuffix,
        profile: freshProf,
        totalStars: 0,
        totalCumulativeScore: 0,
        metaSave: freshMeta,
        revision: 1
      };
      persistMockCloudDoc(doc);
      return Promise.resolve({
        ok: true,
        isMockCloud: true,
        isNewUser: true,
        openidSuffix,
        profile: { ...doc.profile },
        totalStars: 0,
        totalCumulativeScore: 0,
        metaSave: SaveSync.normalizeSaveData(doc.metaSave),
        revision: 1
      });
    }

    if (!normalizedState.isExistingWrapperV2) {
      doc.metaSave.updatedAt = doc.metaSave.updatedAt || Date.now();
    }
    if (normalizedState.dirty || !normalizedState.isExistingWrapperV2) {
      persistMockCloudDoc(doc);
    }

    const res = {
      ok: true,
      isMockCloud: true,
      isNewUser: false,
      openidSuffix: doc.openidSuffix,
      profile: { ...doc.profile },
      totalStars: doc.totalStars,
      totalCumulativeScore: doc.totalCumulativeScore,
      metaSave: SaveSync.normalizeSaveData(doc.metaSave),
      revision: doc.revision
    };
    if (normalizedState.migratedFromV1) {
      res.migratedFromV1 = true;
    }
    return Promise.resolve(res);
  }

  if (action === 'push') {
    if (higherSchemaStored) {
      return Promise.resolve({
        ok: false,
        blocked: true,
        isMockCloud: true,
        higherSchemaDetected: true,
        reason: 'higher_schema_version_on_cloud'
      });
    }

    const warnings = [];
    const rawStoredRev = isPlainRecord(rawStored) ? getOwn(rawStored, 'revision') : undefined;
    const prevRev = doc ? clampSafeInt(rawStoredRev, 0, 999999999, 0) : 0;
    const baseRev = hasOwn(req, 'baseRevision')
      ? clampSafeInt(getOwn(req, 'baseRevision'), 0, 999999999, 0)
      : 0;
    const conflictMerged = Boolean(doc && baseRev > 0 && baseRev < (prevRev || 1));
    const baseMeta = doc ? doc.metaSave : null;

    const reqMetaRaw = getOwn(req, 'metaSave');
    const hasIncomingMeta = isPlainRecord(reqMetaRaw);
    const clientMeta = hasIncomingMeta
      ? auditAndSanitizeSaveForCloud(reqMetaRaw, warnings)
      : baseMeta
      ? SaveSync.normalizeSaveData(baseMeta)
      : SaveSync.createDefaultSave();

    applyRunReportValidation(
      clientMeta,
      baseMeta,
      getOwn(req, 'runReport'),
      warnings
    );

    let mergedMeta;
    let clientUntouched = false;
    let serverUntouched = false;
    if (!baseMeta) {
      mergedMeta = SaveSync.normalizeSaveData(clientMeta);
      const spent = SaveSync.computeSpentStardust(mergedMeta);
      const maxFirstPush = Math.max(spent, MAX_INITIAL_UNSYNCED_STARDUST);
      let totalEarned;
      if (clientMeta.totalEarnedStardust > maxFirstPush) {
        addUniqueWarning(warnings, 'stardust_delta_clamped');
        totalEarned = maxFirstPush;
      } else {
        totalEarned = Math.max(DEFAULT_INITIAL_STARDUST, clientMeta.totalEarnedStardust, spent);
      }
      mergedMeta.totalEarnedStardust = Math.min(MAX_SAFE_STARDUST, totalEarned);
      mergedMeta.lastSyncedEarnedStardust = mergedMeta.totalEarnedStardust;
      mergedMeta.bankStardust = Math.max(0, mergedMeta.totalEarnedStardust - spent);
    } else if (!hasIncomingMeta) {
      mergedMeta = SaveSync.normalizeSaveData(baseMeta);
      mergedMeta.lastSyncedEarnedStardust = mergedMeta.totalEarnedStardust;
    } else {
      const serverUntouchedInitial = isUntouchedInitialServerMeta(baseMeta, prevRev);
      serverUntouched = normalizedState
        ? Boolean(normalizedState.rawMetaUntouched)
        : isUntouchedDefaultMeta(baseMeta);
      clientUntouched = isUntouchedDefaultMeta(clientMeta);
      const preferClient =
        clientUntouched && !serverUntouched
          ? false
          : serverUntouchedInitial || (!clientUntouched && serverUntouched)
          ? true
          : (clientMeta.updatedAt || 0) >= (baseMeta.updatedAt || 0);
      const latest = preferClient ? clientMeta : baseMeta;

      const mergedScores = {};
      const mergedStars = {};
      const mergedFailStreaks = {};
      for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
        const id = VALID_LEVEL_IDS[i];
        const baseSc = hasOwn(baseMeta.levelBestScores, id) ? baseMeta.levelBestScores[id] : 0;
        const clientSc = hasOwn(clientMeta.levelBestScores, id)
          ? clientMeta.levelBestScores[id]
          : 0;
        const bestSc = Math.max(baseSc, clientSc);
        if (bestSc > 0) mergedScores[id] = bestSc;

        const baseSt = hasOwn(baseMeta.levelStars, id) ? baseMeta.levelStars[id] : 0;
        const clientSt = hasOwn(clientMeta.levelStars, id) ? clientMeta.levelStars[id] : 0;
        let bestSt = Math.max(baseSt, clientSt);
        if (bestSt > 0 && bestSc <= 0) {
          bestSt = 0;
        }
        if (bestSt > 0) {
          mergedStars[id] = bestSt;
        } else {
          const fs =
            isPlainRecord(latest.levelFailStreaks) && hasOwn(latest.levelFailStreaks, id)
              ? latest.levelFailStreaks[id]
              : Math.max(
                  isPlainRecord(baseMeta.levelFailStreaks) && hasOwn(baseMeta.levelFailStreaks, id)
                    ? baseMeta.levelFailStreaks[id]
                    : 0,
                  isPlainRecord(clientMeta.levelFailStreaks) &&
                    hasOwn(clientMeta.levelFailStreaks, id)
                    ? clientMeta.levelFailStreaks[id]
                    : 0
                );
          if (fs > 0) mergedFailStreaks[id] = fs;
        }
      }

      const catcakeLevels = {};
      for (let tier = 1; tier <= 7; tier++) {
        const k = String(tier);
        catcakeLevels[k] = Math.max(
          baseMeta.catcakeLevels[k] || 0,
          clientMeta.catcakeLevels[k] || 0
        );
      }

      const deviceUpgrades = {
        dev_tray: Math.max(
          baseMeta.deviceUpgrades.dev_tray || 0,
          clientMeta.deviceUpgrades.dev_tray || 0
        ),
        dev_flour: Math.max(
          baseMeta.deviceUpgrades.dev_flour || 0,
          clientMeta.deviceUpgrades.dev_flour || 0
        ),
        dev_teapot: Math.max(
          baseMeta.deviceUpgrades.dev_teapot || 0,
          clientMeta.deviceUpgrades.dev_teapot || 0
        ),
        dev_tools: Math.max(
          baseMeta.deviceUpgrades.dev_tools || 0,
          clientMeta.deviceUpgrades.dev_tools || 0
        )
      };

      const unlockedPatrons = Array.from(
        new Set(['mikan', ...baseMeta.unlockedPatrons, ...clientMeta.unlockedPatrons])
      );
      const selectedPatron = unlockedPatrons.includes(latest.selectedPatron)
        ? latest.selectedPatron
        : 'mikan';

      const unlockedThemes = Array.from(
        new Set(['amber', ...baseMeta.unlockedThemes, ...clientMeta.unlockedThemes])
      );
      const equippedTheme = unlockedThemes.includes(latest.equippedTheme)
        ? latest.equippedTheme
        : 'amber';

      const seenTutorials = {
        intro_slide: Boolean(
          baseMeta.seenTutorials.intro_slide || clientMeta.seenTutorials.intro_slide
        ),
        tray_trash: Boolean(
          baseMeta.seenTutorials.tray_trash || clientMeta.seenTutorials.tray_trash
        ),
        flavor_tile: Boolean(
          baseMeta.seenTutorials.flavor_tile || clientMeta.seenTutorials.flavor_tile
        ),
        ice_tile: Boolean(baseMeta.seenTutorials.ice_tile || clientMeta.seenTutorials.ice_tile)
      };

      const migratedFromV1GiftPending =
        clientUntouched && !serverUntouched
          ? Boolean(baseMeta.migratedFromV1GiftPending)
          : Boolean(clientMeta.migratedFromV1GiftPending);

      mergedMeta = {
        schemaVersion: 2,
        bgmTrack: latest.bgmTrack,
        sfxEnabled: latest.sfxEnabled,
        bankStardust: 0,
        totalEarnedStardust: DEFAULT_INITIAL_STARDUST,
        lastSyncedEarnedStardust: 0,
        consumableSpentStardust: clampSafeInt(
          Math.max(
            baseMeta.consumableSpentStardust || 0,
            clientMeta.consumableSpentStardust || 0
          ),
          0,
          MAX_CONSUMABLE_SPENT_STARDUST,
          0
        ),
        migratedFromV1GiftPending,
        levelStars: mergedStars,
        levelBestScores: mergedScores,
        levelFailStreaks: mergedFailStreaks,
        highestUnlockedLevel: SaveSync.computeHighestUnlockedLevel(mergedStars),
        catcakeLevels,
        deviceUpgrades,
        selectedPatron,
        unlockedPatrons,
        equippedTheme,
        unlockedThemes,
        seenTutorials,
        playerProfile: clientMeta.playerProfile,
        lifetimeStats: {
          runsPlayed: Math.max(
            baseMeta.lifetimeStats.runsPlayed,
            clientMeta.lifetimeStats.runsPlayed
          ),
          ordersServed: Math.max(
            baseMeta.lifetimeStats.ordersServed,
            clientMeta.lifetimeStats.ordersServed
          ),
          vipServed: Math.max(
            baseMeta.lifetimeStats.vipServed,
            clientMeta.lifetimeStats.vipServed
          ),
          maxComboEver: Math.max(
            baseMeta.lifetimeStats.maxComboEver,
            clientMeta.lifetimeStats.maxComboEver
          ),
          highestSingleServe: Math.max(
            baseMeta.lifetimeStats.highestSingleServe,
            clientMeta.lifetimeStats.highestSingleServe
          ),
          totalStars: computeTotalStars(mergedStars),
          totalCumulativeScore: SaveSync.computeCumulativeScore(mergedScores)
        },
        updatedAt: Date.now()
      };

      const spent = SaveSync.computeSpentStardust(mergedMeta);
      const syncBase = clientMeta.lastSyncedEarnedStardust || 0;
      let totalEarned;

      if (
        serverUntouchedInitial &&
        (syncBase === 0 ||
          syncBase === clientMeta.totalEarnedStardust ||
          clientMeta.migratedFromV1GiftPending)
      ) {
        const maxFirstPush = Math.max(spent, MAX_INITIAL_UNSYNCED_STARDUST);
        if (clientMeta.totalEarnedStardust > maxFirstPush) {
          addUniqueWarning(warnings, 'stardust_delta_clamped');
          totalEarned = maxFirstPush;
        } else {
          totalEarned = Math.max(
            DEFAULT_INITIAL_STARDUST,
            clientMeta.totalEarnedStardust,
            spent
          );
        }
      } else if (
        syncBase >= DEFAULT_INITIAL_STARDUST &&
        clientMeta.totalEarnedStardust > syncBase &&
        baseMeta.totalEarnedStardust > syncBase
      ) {
        const rawDelta = clientMeta.totalEarnedStardust - syncBase;
        if (rawDelta > MAX_OFFLINE_STARDUST_DELTA) {
          addUniqueWarning(warnings, 'stardust_delta_clamped');
        }
        const clampedDelta = Math.min(MAX_OFFLINE_STARDUST_DELTA, rawDelta);
        totalEarned = Math.max(
          DEFAULT_INITIAL_STARDUST,
          spent,
          baseMeta.totalEarnedStardust + clampedDelta
        );
      } else if (
        clientMeta.totalEarnedStardust - baseMeta.totalEarnedStardust >
        MAX_OFFLINE_STARDUST_DELTA
      ) {
        addUniqueWarning(warnings, 'stardust_delta_clamped');
        totalEarned = Math.max(
          DEFAULT_INITIAL_STARDUST,
          spent,
          baseMeta.totalEarnedStardust + MAX_OFFLINE_STARDUST_DELTA
        );
      } else {
        totalEarned = Math.max(
          DEFAULT_INITIAL_STARDUST,
          baseMeta.totalEarnedStardust,
          clientMeta.totalEarnedStardust,
          spent
        );
      }

      mergedMeta.totalEarnedStardust = Math.min(MAX_SAFE_STARDUST, totalEarned);
      mergedMeta.lastSyncedEarnedStardust = mergedMeta.totalEarnedStardust;
      mergedMeta.bankStardust = Math.max(0, mergedMeta.totalEarnedStardust - spent);
    }

    const defaultName = `星夜店长#${openidSuffix}`;
    const rawSrvProf = isPlainRecord(rawStored)
      ? resolveRawMockStoredProfile(rawStored, openidSuffix)
      : null;
    const serverProfInput = isPlainRecord(rawSrvProf)
      ? rawSrvProf
      : doc
      ? {}
      : null;
    const serverHasTouchedProfile = Boolean(
      doc &&
        isPlainRecord(serverProfInput) &&
        !isPlaceholderCloudProfile(
          sanitizeCloudProfile(serverProfInput, openidSuffix, 'mikan'),
          defaultName
        )
    );
    const suppressUntouchedClientProf = Boolean(
      baseMeta &&
        hasIncomingMeta &&
        clientUntouched &&
        (!serverUntouched || serverHasTouchedProfile)
    );
    const reqProfileRaw = getOwn(req, 'profile');
    const reqProfIsPlaceholder =
      !isPlainRecord(reqProfileRaw) ||
      isPlaceholderCloudProfile(
        sanitizeCloudProfile(reqProfileRaw, openidSuffix, 'mikan'),
        defaultName
      );
    const effectiveReqProfile =
      isPlainRecord(reqProfileRaw) && !(suppressUntouchedClientProf && reqProfIsPlaceholder)
        ? reqProfileRaw
        : null;
    const reqMetaProfRaw =
      hasIncomingMeta && !suppressUntouchedClientProf
        ? getOwn(reqMetaRaw, 'playerProfile')
        : null;
    const incomingProf = isPlainRecord(effectiveReqProfile)
      ? effectiveReqProfile
      : isPlainRecord(reqMetaProfRaw)
      ? reqMetaProfRaw
      : null;

    const mergedProf = mergeCloudProfiles(
      serverProfInput,
      incomingProf,
      openidSuffix,
      mergedMeta.selectedPatron
    );
    mergedMeta.playerProfile = { ...mergedProf };

    const totalStars = computeTotalStars(mergedMeta.levelStars);
    const totalCumulativeScore = SaveSync.computeCumulativeScore(mergedMeta.levelBestScores);
    mergedMeta.lifetimeStats.totalStars = totalStars;
    mergedMeta.lifetimeStats.totalCumulativeScore = totalCumulativeScore;
    mergedMeta.updatedAt = Date.now();

    const nextRev = prevRev + 1;
    doc = {
      schemaVersion: 2,
      openidSuffix,
      profile: mergedProf,
      totalStars,
      totalCumulativeScore,
      metaSave: mergedMeta,
      revision: nextRev
    };
    persistMockCloudDoc(doc);

    return Promise.resolve({
      ok: true,
      isMockCloud: true,
      openidSuffix,
      profile: { ...mergedProf },
      totalStars,
      totalCumulativeScore,
      metaSave: SaveSync.normalizeSaveData(mergedMeta),
      revision: nextRev,
      conflictMerged,
      validationWarnings: warnings
    });
  }

  if (action === 'updateProfile') {
    const now = Date.now();
    const reqProf = getOwn(req, 'profile');
    const inProf = isPlainRecord(reqProf) ? reqProf : req;

    const baseMeta = doc
      ? doc.metaSave
      : (() => {
          const m = SaveSync.createDefaultSave();
          m.lastSyncedEarnedStardust = m.totalEarnedStardust;
          return m;
        })();
    const rawExistingProf = isPlainRecord(rawStored)
      ? resolveRawMockStoredProfile(rawStored, openidSuffix)
      : null;
    const baseProf = isPlainRecord(rawExistingProf)
      ? mergeCloudProfiles(rawExistingProf, null, openidSuffix, baseMeta.selectedPatron)
      : sanitizeCloudProfile(null, openidSuffix, baseMeta.selectedPatron);

    let nextNick = baseProf.nickName;
    const rawNickVal = getOwn(inProf, 'nickName');
    if (typeof rawNickVal === 'string') {
      const trimmed = rawNickVal.trim();
      if (trimmed) {
        nextNick = trimmed.slice(0, 16);
      }
    }

    let nextAvatarUrl = baseProf.avatarUrl;
    const rawAvatarVal = getOwn(inProf, 'avatarUrl');
    if (typeof rawAvatarVal === 'string') {
      const trimmedUrl = rawAvatarVal.trim();
      if (trimmedUrl !== '') {
        nextAvatarUrl = trimmedUrl.slice(0, 512);
      } else if (getOwn(inProf, 'clearAvatarUrl') === true) {
        nextAvatarUrl = '';
      }
    }

    let nextPreset = baseProf.avatarPreset;
    const rawPresetVal = getOwn(inProf, 'avatarPreset');
    if (typeof rawPresetVal === 'string') {
      const trimmedPreset = rawPresetVal.trim();
      if (KNOWN_PATRON_INPUTS.has(trimmedPreset)) {
        nextPreset = normalizePatronId(trimmedPreset);
      }
    }

    const nextAuthorized = Boolean(
      baseProf.authorized || (hasOwn(inProf, 'authorized') && Boolean(getOwn(inProf, 'authorized')))
    );

    const inTs = hasOwn(inProf, 'updatedAt')
      ? clampSafeInt(getOwn(inProf, 'updatedAt'), 0, MAX_TIMESTAMP_MS, 0)
      : 0;
    const nextUpdatedAt = Math.max(now, baseProf.updatedAt || 0, inTs);

    const updatedProf = {
      nickName: nextNick || `星夜店长#${openidSuffix}`,
      avatarUrl: nextAvatarUrl,
      avatarPreset: nextPreset,
      authorized: nextAuthorized,
      updatedAt: nextUpdatedAt
    };

    baseMeta.playerProfile = { ...updatedProf };
    baseMeta.updatedAt = now;
    const nextRev = doc ? doc.revision + 1 : 1;
    doc = {
      schemaVersion: 2,
      openidSuffix,
      profile: updatedProf,
      totalStars: doc ? doc.totalStars : 0,
      totalCumulativeScore: doc ? doc.totalCumulativeScore : 0,
      metaSave: baseMeta,
      revision: nextRev
    };
    persistMockCloudDoc(doc);

    return Promise.resolve({
      ok: true,
      isMockCloud: true,
      openidSuffix,
      profile: { ...updatedProf },
      revision: nextRev
    });
  }

  if (action === 'leaderboard') {
    const rawBoardType = getOwn(req, 'boardType');
    const rawMode = getOwn(req, 'mode');
    const rawBoard =
      typeof rawBoardType === 'string' && rawBoardType.trim()
        ? rawBoardType.trim()
        : typeof rawMode === 'string' && rawMode.trim()
        ? rawMode.trim()
        : 'stars';

    let callerDisqualified = false;
    if (isPlainRecord(rawStored)) {
      if (readBoundedBoardMetric(rawStored, 'totalStars', MAX_TOTAL_STARS) < 0) {
        callerDisqualified = true;
      }
      if (
        readBoundedBoardMetric(
          rawStored,
          'totalCumulativeScore',
          MAX_TOTAL_CUMULATIVE_SCORE
        ) < 0
      ) {
        callerDisqualified = true;
      }
      if (hasOwn(rawStored, 'lifetimeStats')) {
        const topLs = getOwn(rawStored, 'lifetimeStats');
        if (isPlainRecord(topLs)) {
          if (
            readBoundedBoardMetric(topLs, 'totalStars', MAX_TOTAL_STARS) < 0 ||
            readBoundedBoardMetric(
              topLs,
              'totalCumulativeScore',
              MAX_TOTAL_CUMULATIVE_SCORE
            ) < 0
          ) {
            callerDisqualified = true;
          }
        }
      }
      if (hasOwn(rawStored, 'metaSave')) {
        const storedMeta = getOwn(rawStored, 'metaSave');
        if (isPlainRecord(storedMeta)) {
          if (
            readBoundedBoardMetric(storedMeta, 'totalStars', MAX_TOTAL_STARS) < 0 ||
            readBoundedBoardMetric(
              storedMeta,
              'totalCumulativeScore',
              MAX_TOTAL_CUMULATIVE_SCORE
            ) < 0
          ) {
            callerDisqualified = true;
          }
          if (hasOwn(storedMeta, 'lifetimeStats')) {
            const metaLs = getOwn(storedMeta, 'lifetimeStats');
            if (isPlainRecord(metaLs)) {
              if (
                readBoundedBoardMetric(metaLs, 'totalStars', MAX_TOTAL_STARS) < 0 ||
                readBoundedBoardMetric(
                  metaLs,
                  'totalCumulativeScore',
                  MAX_TOTAL_CUMULATIVE_SCORE
                ) < 0
              ) {
                callerDisqualified = true;
              }
            }
          }
        }
      }
    }

    const myStars =
      doc && !callerDisqualified ? clampSafeInt(doc.totalStars, 0, MAX_TOTAL_STARS, 0) : 0;
    const myScore =
      doc && !callerDisqualified
        ? clampSafeInt(doc.totalCumulativeScore, 0, MAX_TOTAL_CUMULATIVE_SCORE, 0)
        : 0;

    const reqRivals = getOwn(req, 'rivals');
    const baseRivals = safeIsArray(reqRivals) ? reqRivals : getDefaultNpcRivals();

    const rows = [];
    const rivalLen = safeArrayLength(baseRivals);
    for (let idx = 0; idx < rivalLen; idx++) {
      if (!hasOwn(baseRivals, idx)) continue;
      const r = safeArrayAt(baseRivals, idx);
      if (!isPlainRecord(r)) continue;
      const copyR = safeShallowCopyPlain(r);
      const rawRId = getOwn(r, 'id');
      const rawRSuffix = getOwn(r, 'openidSuffix');
      copyR.id = typeof rawRId === 'string' && rawRId ? rawRId : `npc_${idx + 1}`;
      copyR.openidSuffix =
        typeof rawRSuffix === 'string' && rawRSuffix ? rawRSuffix : `NPC${idx + 1}`;
      copyR.isMe = false;
      copyR.isNpc = hasOwn(r, 'isNpc') ? Boolean(getOwn(r, 'isNpc')) : true;
      rows.push(copyR);
    }

    if (!callerDisqualified && (myStars > 0 || myScore > 0)) {
      const prof = doc
        ? sanitizeCloudProfile(doc.profile, openidSuffix, doc.metaSave.selectedPatron)
        : sanitizeCloudProfile(null, openidSuffix, 'mikan');
      rows.push({
        id: 'me',
        openidSuffix,
        isMe: true,
        isNpc: false,
        nickName: prof.nickName,
        avatarUrl: prof.avatarUrl,
        avatarPreset: prof.avatarPreset,
        totalStars: myStars,
        totalCumulativeScore: myScore
      });
    }

    return Promise.resolve(
      rankLeaderboardEntries(rawBoard, rows, myStars, myScore, {
        isMockCloud: true
      })
    );
  }

  const safeActionLabel = typeof action === 'string' ? action.slice(0, 32) : 'invalid';
  return Promise.resolve({ ok: false, reason: `unknown_action:${safeActionLabel}` });
}

function callCloudFunction(name, data = {}) {
  try {
    const inWx = isWxCanvasEnv();
    const wxObj = inWx ? getWxObject() : null;
    const cloudObj = wxObj ? safeReadProp(wxObj, 'cloud') : null;

    if (
      !cloudInitialized ||
      (inWx
        ? initializedWxMode !== 'wx' || initializedWxCloudRef !== cloudObj
        : initializedWxMode !== 'browser')
    ) {
      initCloud('');
    }

    if (!cloudReady) {
      return Promise.resolve({
        ok: false,
        reason: 'cloud_unavailable',
        fallbackRows: getDefaultNpcRivals()
      });
    }

    if (inWx) {
      const callFn =
        cloudObj && typeof cloudObj === 'object' ? safeReadProp(cloudObj, 'callFunction') : null;
      if (typeof callFn !== 'function') {
        return Promise.resolve({
          ok: false,
          reason: 'cloud_unavailable',
          fallbackRows: getDefaultNpcRivals()
        });
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = (payload) => {
          if (settled) return;
          settled = true;
          resolve(payload);
        };
        const onSuccess = (res) => {
          try {
            const resObj = isPlainRecord(res) ? getOwn(res, 'result') : undefined;
            finish(resObj || { ok: false, reason: 'empty_result' });
          } catch (_) {
            finish({ ok: false, reason: 'empty_result' });
          }
        };
        const onFail = (err) => {
          finish({
            ok: false,
            reason: 'call_failed',
            errMsg: safeErrorText(err),
            fallbackRows: getDefaultNpcRivals()
          });
        };
        try {
          const safeName = typeof name === 'string' ? name : String(name || '');
          const maybePromise = callFn.call(cloudObj, {
            name: safeName,
            data: isPlainRecord(data) ? data : {},
            success: onSuccess,
            fail: onFail
          });
          const thenFn = maybePromise ? safeReadProp(maybePromise, 'then') : null;
          if (typeof thenFn === 'function') {
            thenFn.call(maybePromise, onSuccess, onFail);
          }
        } catch (err) {
          finish({
            ok: false,
            reason: 'call_exception',
            errMsg: safeErrorText(err),
            fallbackRows: getDefaultNpcRivals()
          });
        }
      });
    }

    return runBrowserMockCloud(data);
  } catch (err) {
    return Promise.resolve({
      ok: false,
      reason: 'call_exception',
      errMsg: safeErrorText(err),
      fallbackRows: getDefaultNpcRivals()
    });
  }
}

let lastFriendCloudKey = '';
let lastFriendCloudFn = null;
function setWxFriendCloudScore(totalStars = 0, totalCumulativeScore = 0) {
  try {
    const wxObj = getWxObject();
    const setFn = wxObj ? safeReadProp(wxObj, 'setUserCloudStorage') : null;
    if (!wxObj || typeof setFn !== 'function') return;

    let rawStars = totalStars;
    let rawScore = totalCumulativeScore;

    if (isPlainRecord(totalStars)) {
      const rawLs = getOwn(totalStars, 'lifetimeStats');
      const ls = isPlainRecord(rawLs) ? rawLs : null;
      const rawLvStars = getOwn(totalStars, 'levelStars');
      if (hasOwn(totalStars, 'totalStars')) {
        rawStars = getOwn(totalStars, 'totalStars');
      } else if (ls && hasOwn(ls, 'totalStars')) {
        rawStars = getOwn(ls, 'totalStars');
      } else if (isPlainRecord(rawLvStars)) {
        const safeLvStars = {};
        for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
          const lid = VALID_LEVEL_IDS[i];
          if (hasOwn(rawLvStars, lid)) {
            safeLvStars[lid] = clampSafeInt(getOwn(rawLvStars, lid), 0, 3, 0);
          }
        }
        rawStars = computeTotalStars(safeLvStars);
      } else {
        rawStars = 0;
      }

      const rawLvScores = getOwn(totalStars, 'levelBestScores');
      if (hasOwn(totalStars, 'totalCumulativeScore')) {
        rawScore = getOwn(totalStars, 'totalCumulativeScore');
      } else if (ls && hasOwn(ls, 'totalCumulativeScore')) {
        rawScore = getOwn(ls, 'totalCumulativeScore');
      } else if (isPlainRecord(rawLvScores)) {
        rawScore = getSaveSync().computeCumulativeScore(rawLvScores);
      } else {
        rawScore = 0;
      }
    }

    const safeStars = clampSafeInt(rawStars, 0, MAX_TOTAL_STARS, 0);
    const safeScore = clampSafeInt(rawScore, 0, MAX_TOTAL_CUMULATIVE_SCORE, 0);
    const sStr = String(safeStars);
    const cStr = String(safeScore);
    const key = `${sStr}:${cStr}`;

    if (key === lastFriendCloudKey && lastFriendCloudFn === setFn) {
      return;
    }

    setFn.call(wxObj, {
      KVDataList: [
        { key: 'totalStars', value: sStr },
        { key: 'totalScore', value: cStr }
      ]
    });
    lastFriendCloudKey = key;
    lastFriendCloudFn = setFn;
  } catch (_) {}
}

function destroyUserInfoButton() {
  if (activeUserInfoBtn) {
    const btnRef = activeUserInfoBtn;
    activeUserInfoBtn = null;
    activeUserInfoRectKey = '';
    try {
      const destroyFn = safeReadProp(btnRef, 'destroy');
      if (typeof destroyFn === 'function') {
        destroyFn.call(btnRef);
      }
    } catch (_) {}
  } else {
    activeUserInfoRectKey = '';
  }
}

function syncUserInfoButton(rectOrNull, onAuthResult) {
  try {
    const wxObj = getWxObject();
    const createBtnFn = wxObj ? safeReadProp(wxObj, 'createUserInfoButton') : null;
    if (
      !isPlainRecord(rectOrNull) ||
      !isWxCanvasEnv() ||
      !wxObj ||
      typeof createBtnFn !== 'function'
    ) {
      destroyUserInfoButton();
      return false;
    }

    const rx = toSafeFiniteNumber(safeReadProp(rectOrNull, 'x'));
    const ry = toSafeFiniteNumber(safeReadProp(rectOrNull, 'y'));
    const rw = toSafeFiniteNumber(safeReadProp(rectOrNull, 'w'));
    const rh = toSafeFiniteNumber(safeReadProp(rectOrNull, 'h'));
    if (
      !Number.isFinite(rx) ||
      !Number.isFinite(ry) ||
      !Number.isFinite(rw) ||
      !Number.isFinite(rh)
    ) {
      destroyUserInfoButton();
      return false;
    }

    const left = normalizeZero(Math.round(rx));
    const top = normalizeZero(Math.round(ry));
    const width = normalizeZero(Math.max(24, Math.round(rw)));
    const height = normalizeZero(Math.max(20, Math.round(rh)));
    const key = `${left},${top},${width},${height}`;

    if (activeUserInfoBtn && activeUserInfoRectKey === key) {
      try {
        Object.getPrototypeOf(activeUserInfoBtn);
        return true;
      } catch (_) {
        activeUserInfoBtn = null;
        activeUserInfoRectKey = '';
      }
    }

    destroyUserInfoButton();
    const btn = createBtnFn.call(wxObj, {
      type: 'text',
      text: '',
      style: {
        left,
        top,
        width,
        height,
        lineHeight: height,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(0, 0, 0, 0)',
        borderWidth: 0,
        borderRadius: 12,
        color: 'rgba(0, 0, 0, 0)',
        textAlign: 'center',
        fontSize: 12
      }
    });
    if (!btn || typeof btn !== 'object') {
      return false;
    }
    Object.getPrototypeOf(btn);

    const onTapFn = safeReadProp(btn, 'onTap');
    if (typeof onTapFn === 'function') {
      onTapFn.call(btn, (res) => {
        try {
          const ui = isPlainRecord(res) ? getOwn(res, 'userInfo') : null;
          const nick = isPlainRecord(ui) ? getOwn(ui, 'nickName') : '';
          const av = isPlainRecord(ui) ? getOwn(ui, 'avatarUrl') : '';
          if (typeof nick === 'string' && nick) {
            if (typeof onAuthResult === 'function') {
              onAuthResult({
                ok: true,
                nickName: nick,
                avatarUrl: typeof av === 'string' ? av : ''
              });
            }
          } else if (typeof onAuthResult === 'function') {
            onAuthResult({ ok: false, cancelled: true });
          }
        } catch (_) {}
      });
    }
    activeUserInfoBtn = btn;
    activeUserInfoRectKey = key;
    return true;
  } catch (_) {
    destroyUserInfoButton();
    return false;
  }
}

function getGlobal() {
  return g;
}

module.exports = {
  get hasWx() {
    return isWxCanvasEnv();
  },
  getSystemMetrics,
  createMainCanvas,
  onResize,
  loadImage,
  getStorageJSON,
  setStorageJSON,
  removeStorage,
  createAudioContext,
  bindLifecycle,
  bindPointerEvents,
  bindKeyboard,
  vibrateShort,
  reportEvent,
  getReportedEventLog,
  setupShare,
  triggerShare,
  requestRewardAction,
  initCloud,
  callCloudFunction,
  setWxFriendCloudScore,
  syncUserInfoButton,
  destroyUserInfoButton,
  getDefaultNpcRivals,
  getGlobal,
  runBrowserMockCloud,
  buildOfflineLeaderboard
};
