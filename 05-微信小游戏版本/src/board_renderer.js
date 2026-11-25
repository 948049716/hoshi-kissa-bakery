/**
 * Shaped-Grid Baking Stage, 3-Seat Customers Bar, Serving Tray + Wicker Trash Strip,
 * Hit-Testing & Micro-Interaction Renderer for Hoshi Kissa Bakery v2.0.
 */
'use strict';

const {
  SERVE_COMBO_MULTS,
  SERVE_COMBO_WINDOW_SEC,
  PATIENCE_TIP_BANDS,
  FEVER_CONFIG,
  TRASH_CONFIG,
  CUSTOMER_MAP,
  BOARD_THEMES
} = require('./constants');
const UI = require('./ui_draw');

const OWN = Object.prototype.hasOwnProperty;

function hasOwn(obj, key) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return false;
  try {
    return Boolean(OWN.call(obj, key));
  } catch (_) {
    return false;
  }
}

function getOwn(obj, key, fallback = undefined) {
  if (!hasOwn(obj, key)) return fallback;
  try {
    const val = obj[key];
    return val === undefined ? fallback : val;
  } catch (_) {
    return fallback;
  }
}

function safeIsArray(x) {
  try {
    return Array.isArray(x);
  } catch (_) {
    return false;
  }
}

function safeIsFrozen(x) {
  try {
    return Object.isFrozen(x);
  } catch (_) {
    return true;
  }
}

function safeIsExtensible(x) {
  try {
    return Object.isExtensible(x);
  } catch (_) {
    return false;
  }
}

function safeArrayLen(arr, maxCap = 256) {
  if (!safeIsArray(arr)) return 0;
  const cap =
    typeof maxCap === 'number' && Number.isFinite(maxCap) && maxCap >= 0
      ? Math.floor(maxCap)
      : 256;
  try {
    const raw = arr.length;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0;
    const n = Math.floor(raw);
    return n > cap ? cap : n;
  } catch (_) {
    return 0;
  }
}

function safePush(arr, ...items) {
  if (!safeIsArray(arr) || safeIsFrozen(arr) || !safeIsExtensible(arr)) return 0;
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

function safeSetIdx(arr, idx, val) {
  if (!safeIsArray(arr) || safeIsFrozen(arr)) return false;
  const i = idx >>> 0;
  if (i !== idx || (!hasOwn(arr, i) && !safeIsExtensible(arr))) return false;
  try {
    Object.defineProperty(arr, i, {
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

function isPlainObj(x) {
  if (!x || typeof x !== 'object' || safeIsArray(x)) return false;
  try {
    OWN.call(x, '__probe__');
    return true;
  } catch (_) {
    return false;
  }
}

function toSafeNum(x, fallback = 0) {
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
  if (safeIsArray(x)) return fallback;
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

function toSafeText(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  const t = typeof val;
  if (t === 'string') return val;
  if (t === 'number') return Number.isFinite(val) ? String(val) : fallback;
  if (t === 'boolean') return val ? 'true' : 'false';
  if (t === 'bigint') return val.toString();
  if (t === 'symbol' || t === 'function') return fallback;
  try {
    const s = String(val);
    return typeof s === 'string' ? s : fallback;
  } catch (_) {
    return fallback;
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function toSafeTier(val, fallback = 1) {
  const fb = clamp(Math.round(toSafeNum(fallback, 1)), 1, 7);
  if (typeof val === 'number') {
    return Number.isFinite(val) ? clamp(Math.round(val), 1, 7) : fb;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return fb;
    const m = /^(?:c|catcake_)?([1-7])(?:_happy)?$/i.exec(s);
    if (m) return Number(m[1]);
    const n = Number(s);
    if (Number.isFinite(n)) return clamp(Math.round(n), 1, 7);
  }
  return fb;
}

const SAFE_HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_RGB_RE =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d+(?:\.\d+)?|\.\d+))?\s*\)$/i;

function isValidCssColor(c) {
  if (typeof c !== 'string') return false;
  const s = c.trim();
  if (!s || /hsla?\s*\(/i.test(s)) return false;
  if (SAFE_HEX_RE.test(s)) return true;
  const m = SAFE_RGB_RE.exec(s);
  if (m) {
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    if (r > 255 || g > 255 || b > 255) return false;
    if (m[4] !== undefined) {
      const a = Number(m[4]);
      if (!Number.isFinite(a) || a < 0 || a > 1) return false;
    }
    return true;
  }
  return false;
}

function safeColor(val, fallback) {
  return isValidCssColor(val) ? val.trim() : fallback;
}

function isCanvasCtx(ctx) {
  try {
    return Boolean(
      ctx &&
        typeof ctx === 'object' &&
        typeof ctx.save === 'function' &&
        typeof ctx.restore === 'function' &&
        typeof ctx.beginPath === 'function' &&
        typeof ctx.closePath === 'function' &&
        typeof ctx.moveTo === 'function' &&
        typeof ctx.lineTo === 'function' &&
        typeof ctx.arc === 'function' &&
        typeof ctx.fill === 'function' &&
        typeof ctx.stroke === 'function' &&
        typeof ctx.translate === 'function' &&
        typeof ctx.rotate === 'function' &&
        typeof ctx.scale === 'function'
    );
  } catch (_) {
    return false;
  }
}

function safeLinearGradient(ctx, x0, y0, x1, y1, fallback = '#d59c3b') {
  const sx0 = toSafeNum(x0, 0);
  const sy0 = toSafeNum(y0, 0);
  const sx1 = toSafeNum(x1, 0);
  const sy1 = toSafeNum(y1, 1);
  try {
    if (!ctx || typeof ctx.createLinearGradient !== 'function') {
      return safeColor(fallback, '#d59c3b');
    }
    const g = ctx.createLinearGradient(sx0, sy0, sx1, sy1);
    return g || safeColor(fallback, '#d59c3b');
  } catch (_) {
    return safeColor(fallback, '#d59c3b');
  }
}

function safeAddColorStop(grad, offset, color, fallbackColor) {
  const off = clamp(toSafeNum(offset, 0), 0, 1);
  const chosen = isValidCssColor(color)
    ? color.trim()
    : isValidCssColor(fallbackColor)
    ? fallbackColor.trim()
    : '#d59c3b';
  try {
    if (!grad || typeof grad.addColorStop !== 'function') return;
    grad.addColorStop(off, chosen);
  } catch (_) {
    try {
      if (grad && typeof grad.addColorStop === 'function') {
        grad.addColorStop(off, isValidCssColor(fallbackColor) ? fallbackColor.trim() : '#d59c3b');
      }
    } catch (__) {}
  }
}

function safeAddHit(hits, id, x, y, w, h, onClick, meta) {
  if (!hits || typeof hits !== 'object' || safeIsFrozen(hits)) return;
  let addFn = getOwn(hits, 'add', null);
  if (typeof addFn !== 'function') {
    try {
      if (typeof hits.add === 'function') addFn = hits.add;
    } catch (_) {
      addFn = null;
    }
  }
  if (typeof addFn !== 'function') return;
  try {
    addFn.call(hits, id, x, y, w, h, onClick, meta);
  } catch (_) {}
}

function safeSetProp(obj, key, val) {
  if (!obj || typeof obj !== 'object' || safeIsFrozen(obj)) return false;
  const own = hasOwn(obj, key);
  if (!own && !safeIsExtensible(obj)) return false;
  try {
    if (own) {
      const desc = Object.getOwnPropertyDescriptor(obj, key);
      if (desc && hasOwn(desc, 'value')) {
        if (!desc.writable) return false;
        Object.defineProperty(obj, key, { __proto__: null, value: val });
        return true;
      }
      if (desc && typeof desc.set === 'function') {
        obj[key] = val;
        return true;
      }
      return false;
    }
    Object.defineProperty(obj, key, {
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

function extractValidBoardLayout(l) {
  if (!isPlainObj(l)) return null;
  try {
    const x = toSafeNum(getOwn(l, 'x', undefined), NaN);
    const y = toSafeNum(getOwn(l, 'y', undefined), NaN);
    const w = toSafeNum(getOwn(l, 'w', undefined), NaN);
    const h = toSafeNum(getOwn(l, 'h', undefined), NaN);
    const rows = toSafeNum(getOwn(l, 'rows', undefined), NaN);
    const cols = toSafeNum(getOwn(l, 'cols', undefined), NaN);
    const cellSize = toSafeNum(getOwn(l, 'cellSize', undefined), NaN);
    const gridX = toSafeNum(getOwn(l, 'gridX', undefined), NaN);
    const gridY = toSafeNum(getOwn(l, 'gridY', undefined), NaN);
    const gridW = toSafeNum(getOwn(l, 'gridW', undefined), NaN);
    const gridH = toSafeNum(getOwn(l, 'gridH', undefined), NaN);
    const cellInset = toSafeNum(getOwn(l, 'cellInset', undefined), NaN);
    const bezelPad = toSafeNum(getOwn(l, 'bezelPad', undefined), NaN);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      !Number.isInteger(rows) ||
      !Number.isInteger(cols) ||
      rows < 1 ||
      rows > 12 ||
      cols < 1 ||
      cols > 12 ||
      !Number.isFinite(cellSize) ||
      !Number.isFinite(gridX) ||
      !Number.isFinite(gridY) ||
      !Number.isFinite(gridW) ||
      !Number.isFinite(gridH) ||
      !Number.isFinite(cellInset) ||
      !Number.isFinite(bezelPad) ||
      !(w > 0 && h > 0 && cellSize > 0 && gridW > 0 && gridH > 0 && cellInset >= 0 && bezelPad >= 0)
    ) {
      return null;
    }

    let cellTypes = null;
    const rawCellTypes = getOwn(l, 'cellTypes', null);
    if (safeIsArray(rawCellTypes) && safeArrayLen(rawCellTypes, 16) > 0) {
      cellTypes = [];
      for (let r = 0; r < rows; r++) {
        const rawRow = getOwn(rawCellTypes, r, null);
        const rowOut = [];
        if (safeIsArray(rawRow)) {
          for (let c = 0; c < cols; c++) {
            safePush(rowOut, normalizeCellType(getOwn(rawRow, c, 'normal')));
          }
        } else if (typeof rawRow === 'string') {
          const chars = [];
          for (const ch of rawRow) {
            if (chars.length >= cols) break;
            safePush(chars, ch);
          }
          for (let c = 0; c < cols; c++) {
            safePush(rowOut, c < chars.length ? normalizeMatrixChar(chars[c]) : 'normal');
          }
        } else {
          for (let c = 0; c < cols; c++) {
            safePush(rowOut, 'normal');
          }
        }
        safePush(cellTypes, rowOut);
      }
    }

    return {
      x,
      y,
      w,
      h,
      rows,
      cols,
      cellSize,
      gridX,
      gridY,
      gridW,
      gridH,
      cellInset,
      bezelPad,
      cellTypes
    };
  } catch (_) {
    return null;
  }
}

function normalizeMatrixChar(ch) {
  if (ch === '#') return 'void';
  if (ch === 'X') return 'block';
  if (ch === 'G') return 'gold';
  if (ch === 'M') return 'matcha';
  if (ch === 'B') return 'berry';
  if (ch === 'O') return 'oven';
  if (ch === 'S') return 'syrup';
  return 'normal';
}

function normalizeCellType(raw) {
  if (typeof raw !== 'string') return 'normal';
  const s = raw.trim();
  if (s === 'void' || s === '#') return 'void';
  if (s === 'block' || s === 'X') return 'block';
  if (s === 'gold' || s === 'G') return 'gold';
  if (s === 'matcha' || s === 'M') return 'matcha';
  if (s === 'berry' || s === 'B') return 'berry';
  if (s === 'oven' || s === 'O') return 'oven';
  if (s === 'syrup' || s === 'S') return 'syrup';
  return 'normal';
}

function resolveBoardTheme(themeArg) {
  const def = BOARD_THEMES.amber;
  if (typeof themeArg === 'string') {
    const key = themeArg.trim();
    if (BOARD_THEMES && hasOwn(BOARD_THEMES, key)) {
      return BOARD_THEMES[key];
    }
    return def;
  }
  if (isPlainObj(themeArg)) {
    const rawId = getOwn(themeArg, 'id', null);
    const base =
      typeof rawId === 'string' && BOARD_THEMES && hasOwn(BOARD_THEMES, rawId.trim())
        ? BOARD_THEMES[rawId.trim()]
        : def;
    const rawStops = getOwn(themeArg, 'frameStops', null);
    const hasCustomFields =
      hasOwn(themeArg, 'frameStops') ||
      hasOwn(themeArg, 'frameBorder') ||
      hasOwn(themeArg, 'boardBgTop') ||
      hasOwn(themeArg, 'boardBgBot') ||
      hasOwn(themeArg, 'cellFill') ||
      hasOwn(themeArg, 'cellFillAlt') ||
      hasOwn(themeArg, 'cellBorder') ||
      hasOwn(themeArg, 'trayBg') ||
      hasOwn(themeArg, 'trayBorder') ||
      hasOwn(themeArg, 'traySlotFill') ||
      hasOwn(themeArg, 'traySlotBorder') ||
      hasOwn(themeArg, 'moteColor');
    if (!hasCustomFields) {
      return base;
    }
    const baseStops =
      safeIsArray(base.frameStops) && safeArrayLen(base.frameStops, 16) >= 3
        ? base.frameStops
        : ['#d59c3b', '#ad7424', '#8c5a18'];
    const hasRawStops = safeIsArray(rawStops) && safeArrayLen(rawStops, 16) > 0;
    const frameStops = [
      safeColor(hasRawStops ? getOwn(rawStops, 0, null) : null, baseStops[0]),
      safeColor(hasRawStops ? getOwn(rawStops, 1, null) : null, baseStops[1]),
      safeColor(hasRawStops ? getOwn(rawStops, 2, null) : null, baseStops[2])
    ];
    const rawMoteKind = getOwn(themeArg, 'moteKind', base.moteKind);
    return {
      id: typeof rawId === 'string' ? rawId : base.id,
      frameStops,
      frameSideTop: safeColor(getOwn(themeArg, 'frameSideTop', null), base.frameSideTop || '#B56B2B'),
      frameSideBot: safeColor(getOwn(themeArg, 'frameSideBot', null), base.frameSideBot || '#8D4B1B'),
      frameBorder: safeColor(getOwn(themeArg, 'frameBorder', null), base.frameBorder),
      frameHighlight: safeColor(getOwn(themeArg, 'frameHighlight', null), base.frameHighlight),
      boardBgTop: safeColor(getOwn(themeArg, 'boardBgTop', null), base.boardBgTop),
      boardBgBot: safeColor(getOwn(themeArg, 'boardBgBot', null), base.boardBgBot),
      boardInnerBorder: safeColor(getOwn(themeArg, 'boardInnerBorder', null), base.boardInnerBorder),
      cellFill: safeColor(getOwn(themeArg, 'cellFill', null), base.cellFill),
      cellFillAlt: safeColor(getOwn(themeArg, 'cellFillAlt', null), base.cellFillAlt),
      cellTopShadow: safeColor(getOwn(themeArg, 'cellTopShadow', null), base.cellTopShadow || 'rgba(116, 52, 14, 0.44)'),
      cellBorder: safeColor(getOwn(themeArg, 'cellBorder', null), base.cellBorder),
      cellInnerSheen: safeColor(getOwn(themeArg, 'cellInnerSheen', null), base.cellInnerSheen),
      trayBg: safeColor(getOwn(themeArg, 'trayBg', null), base.trayBg),
      trayBorder: safeColor(getOwn(themeArg, 'trayBorder', null), base.trayBorder),
      traySlotFill: safeColor(getOwn(themeArg, 'traySlotFill', null), base.traySlotFill),
      traySlotBorder: safeColor(getOwn(themeArg, 'traySlotBorder', null), base.traySlotBorder),
      moteKind: typeof rawMoteKind === 'string' ? rawMoteKind : base.moteKind,
      moteColor: safeColor(getOwn(themeArg, 'moteColor', null), base.moteColor)
    };
  }
  return def;
}

function isThemeCandidate(x) {
  if (typeof x === 'string') {
    const k = x.trim();
    return Boolean(BOARD_THEMES && hasOwn(BOARD_THEMES, k));
  }
  if (isPlainObj(x)) {
    const rawId = getOwn(x, 'id', null);
    return Boolean(
      hasOwn(x, 'frameStops') ||
        hasOwn(x, 'boardBgTop') ||
        hasOwn(x, 'boardBgBot') ||
        (typeof rawId === 'string' && BOARD_THEMES && hasOwn(BOARD_THEMES, rawId.trim()))
    );
  }
  return false;
}

function isSpritesCandidate(x) {
  if (!isPlainObj(x)) return false;
  return Boolean(
    hasOwn(x, 'byId') ||
      hasOwn(x, 'customers') ||
      hasOwn(x, 'boardTilesAtlas') ||
      hasOwn(x, 'board_tiles_atlas') ||
      hasOwn(x, 'customersAtlas') ||
      hasOwn(x, 'customers_atlas') ||
      hasOwn(x, 'catcakes') ||
      hasOwn(x, 'catcake_1') ||
      hasOwn(x, 'uiAtlas') ||
      hasOwn(x, 'ui_atlas')
  );
}

function isAnimStateCandidate(x) {
  if (!isPlainObj(x)) return false;
  return Boolean(
    hasOwn(x, 'slide') ||
      hasOwn(x, 'moveEvents') ||
      hasOwn(x, 'cellFX') ||
      hasOwn(x, 'blockedShake') ||
      hasOwn(x, 'flyingSprites') ||
      hasOwn(x, 'popups') ||
      hasOwn(x, 'slideTimer') ||
      hasOwn(x, 'mergeTimer') ||
      hasOwn(x, 'spawnTimer') ||
      hasOwn(x, 'iceTimer')
  );
}

function extractRect(rect, defaultW = 360, defaultH = 360) {
  if (!isPlainObj(rect)) {
    return { x: 0, y: 0, w: defaultW, h: defaultH };
  }
  const rx = toSafeNum(getOwn(rect, 'x', 0), 0);
  const ry = toSafeNum(getOwn(rect, 'y', 0), 0);
  const rawW = hasOwn(rect, 'w') ? getOwn(rect, 'w', defaultW) : getOwn(rect, 'width', defaultW);
  const rawH = hasOwn(rect, 'h') ? getOwn(rect, 'h', defaultH) : getOwn(rect, 'height', defaultH);
  const rw = Math.max(1, toSafeNum(rawW, defaultW));
  const rh = Math.max(1, toSafeNum(rawH, defaultH));
  return { x: rx, y: ry, w: rw, h: rh };
}

/**
 * Normalize polymorphic (..., nowSec, opts) vs (..., appObj, nowSec, opts) vs (..., opts)
 * for renderCustomersBar and renderTrayStrip.
 */
function normalizeBarArgs(arg6, arg7, arg8) {
  let appObj = null;
  let nowSec = 0;
  let opts = {};

  if (typeof arg6 === 'number') {
    nowSec = Number.isFinite(arg6) ? arg6 : 0;
    opts = isPlainObj(arg7) ? arg7 : {};
    const optApp = getOwn(opts, 'app', null);
    appObj = isPlainObj(optApp) ? optApp : null;
  } else if (isPlainObj(arg6)) {
    if (typeof arg7 === 'number') {
      appObj = arg6;
      nowSec = Number.isFinite(arg7) ? arg7 : 0;
      opts = isPlainObj(arg8) ? arg8 : {};
    } else if (isPlainObj(arg7)) {
      appObj = arg6;
      opts = arg7;
      nowSec = toSafeNum(
        hasOwn(opts, 'nowSec') ? getOwn(opts, 'nowSec', 0) : getOwn(appObj, 'nowSec', 0),
        0
      );
    } else {
      opts = arg6;
      appObj = arg6;
      nowSec = toSafeNum(getOwn(arg6, 'nowSec', 0), 0);
    }
  } else {
    nowSec = toSafeNum(arg6, 0);
    opts = isPlainObj(arg7) ? arg7 : {};
    const optApp = getOwn(opts, 'app', null);
    appObj = isPlainObj(optApp) ? optApp : null;
  }

  return { appObj, nowSec, opts };
}

/**
 * Compute centered shaped-grid geometry within `rect`.
 * Supports BOTH:
 *   - computeBoardLayout(rect, gridOrDims, opts)
 *   - computeBoardLayout(rect, rowsNum, colsNum, opts)
 */
function computeBoardLayout(rect, arg2, arg3 = undefined, arg4 = undefined) {
  try {
    const { x: rx, y: ry, w: rw, h: rh } = extractRect(rect, 360, 360);

    let rows = 4;
    let cols = 4;
    let cellTypes = null;
    let safeOpts = {};

    if (typeof arg2 === 'number' && typeof arg3 === 'number') {
      if (Number.isFinite(arg2) && arg2 > 0) rows = Math.floor(arg2);
      if (Number.isFinite(arg3) && arg3 > 0) cols = Math.floor(arg3);
      safeOpts = isPlainObj(arg4) ? arg4 : {};
    } else {
      const gridOrDims = arg2;
      safeOpts = isPlainObj(arg3) ? arg3 : {};

      const gridRowsLen = safeArrayLen(gridOrDims, 16);
      if (gridRowsLen > 0) {
        // Raw matrix array of strings or cell objects
        rows = gridRowsLen;
        const firstRow = getOwn(gridOrDims, 0, null);
        if (typeof firstRow === 'string') {
          cols = Math.min(16, firstRow.length) || 4;
          cellTypes = [];
          for (let r = 0; r < gridRowsLen; r++) {
            const rowStr = toSafeText(getOwn(gridOrDims, r, ''), '').slice(0, 16);
            const rowTypes = [];
            for (const ch of rowStr) {
              safePush(rowTypes, normalizeMatrixChar(ch));
            }
            safePush(cellTypes, rowTypes);
          }
        } else if (safeIsArray(firstRow)) {
          cols = safeArrayLen(firstRow, 16) || 4;
          cellTypes = [];
          for (let r = 0; r < gridRowsLen; r++) {
            const row = getOwn(gridOrDims, r, null);
            const rowLen = safeArrayLen(row, 16);
            if (rowLen > 0) {
              const rowTypes = [];
              for (let c = 0; c < rowLen; c++) {
                safePush(rowTypes, normalizeCellType(getOwn(getOwn(row, c, null), 'type', 'normal')));
              }
              safePush(cellTypes, rowTypes);
            } else {
              safePush(cellTypes, []);
            }
          }
        }
      } else if (isPlainObj(gridOrDims)) {
        const gdCells = getOwn(gridOrDims, 'cells', null);
        const gdMatrix = getOwn(gridOrDims, 'matrix', null);
        const gdRows = getOwn(gridOrDims, 'rows', NaN);
        const gdCols = getOwn(gridOrDims, 'cols', NaN);
        const gdCellsLen = safeArrayLen(gdCells, 16);
        const gdMatrixLen = safeArrayLen(gdMatrix, 16);

        if (gdCellsLen > 0) {
          const firstCellsRow = getOwn(gdCells, 0, null);
          const firstCellsRowLen = safeArrayLen(firstCellsRow, 16);
          rows = toSafeNum(gdRows, gdCellsLen);
          cols = toSafeNum(gdCols, firstCellsRowLen > 0 ? firstCellsRowLen : 4);
          cellTypes = [];
          for (let r = 0; r < gdCellsLen; r++) {
            const row = getOwn(gdCells, r, null);
            const rowLen = safeArrayLen(row, 16);
            if (rowLen > 0) {
              const rowTypes = [];
              for (let c = 0; c < rowLen; c++) {
                safePush(rowTypes, normalizeCellType(getOwn(getOwn(row, c, null), 'type', 'normal')));
              }
              safePush(cellTypes, rowTypes);
            } else {
              safePush(cellTypes, []);
            }
          }
        } else if (gdMatrixLen > 0) {
          rows = gdMatrixLen;
          const firstMatStr = toSafeText(getOwn(gdMatrix, 0, ''), '').slice(0, 16);
          cols = firstMatStr.length || 4;
          cellTypes = [];
          for (let r = 0; r < gdMatrixLen; r++) {
            const rowStr = toSafeText(getOwn(gdMatrix, r, ''), '').slice(0, 16);
            const rowTypes = [];
            for (const ch of rowStr) {
              safePush(rowTypes, normalizeMatrixChar(ch));
            }
            safePush(cellTypes, rowTypes);
          }
        } else {
          const rNum = toSafeNum(gdRows, NaN);
          const cNum = toSafeNum(gdCols, NaN);
          if (Number.isFinite(rNum) && rNum > 0) rows = Math.floor(rNum);
          if (Number.isFinite(cNum) && cNum > 0) cols = Math.floor(cNum);
        }
      }
    }

    rows = clamp(Math.floor(rows) || 4, 1, 12);
    cols = clamp(Math.floor(cols) || 4, 1, 12);

    const isThumb = Boolean(getOwn(safeOpts, 'thumbnail', false));
    const maxCell = Math.max(16, toSafeNum(getOwn(safeOpts, 'maxCellSize', isThumb ? 48 : 80), isThumb ? 48 : 80));
    const minCell = Math.max(12, toSafeNum(getOwn(safeOpts, 'minCellSize', isThumb ? 12 : 46), isThumb ? 12 : 46));
    const padX = isThumb || rw < 220 ? 6 : cols <= 4 ? 24 : 14;
    const padY = isThumb || rh < 220 ? 6 : 16;

    const hardMax = Math.max(
      12,
      Math.floor(Math.min((rw - padX * 2) / cols, (rh - padY * 2) / rows))
    );
    const rawIdeal = Math.floor(Math.min((rw - padX * 2) / cols, (rh - padY * 2) / rows));
    const cellSize = Math.min(maxCell, Math.min(hardMax, Math.max(minCell, rawIdeal)));

    const gridW = cols * cellSize;
    const gridH = rows * cellSize;
    const offX = toSafeNum(getOwn(safeOpts, 'offsetX', 0), 0);
    const offY = toSafeNum(getOwn(safeOpts, 'offsetY', 0), 0);
    const gridX = Math.round(rx + (rw - gridW) * 0.5 + offX);
    const gridY = Math.round(ry + (rh - gridH) * 0.5 + offY - (isThumb ? 0 : 2));
    const cellInset = isThumb
      ? Math.max(1.2, Math.round(cellSize * 0.055))
      : Math.max(3, Math.min(5, Math.round(cellSize * 0.06)));
    const bezelPad = isThumb
      ? Math.max(3, Math.min(6, Math.round(cellSize * 0.14)))
      : Math.max(7, Math.min(12, Math.round(cellSize * 0.155)));

    return {
      x: rx,
      y: ry,
      w: rw,
      h: rh,
      rows,
      cols,
      cellSize,
      gridX,
      gridY,
      gridW,
      gridH,
      cellInset,
      bezelPad,
      cellTypes
    };
  } catch (_) {
    return {
      x: 0,
      y: 0,
      w: 360,
      h: 360,
      rows: 4,
      cols: 4,
      cellSize: 84,
      gridX: 12,
      gridY: 12,
      gridW: 336,
      gridH: 336,
      cellInset: 4,
      bezelPad: 8,
      cellTypes: null
    };
  }
}

/**
 * Hit-test pointer coordinates against playable/non-void board cells.
 * Supports BOTH:
 *   - hitTestBoardCell(layout, lx, ly, gridState)
 *   - hitTestBoardCell(layout, gridStateObj, lx, ly)
 */
function hitTestBoardCell(layout, arg2, arg3, arg4 = null) {
  try {
    let lx;
    let ly;
    let gridState = null;

    if (arg2 && typeof arg2 === 'object') {
      gridState = arg2;
      lx = arg3;
      ly = arg4;
    } else {
      lx = arg2;
      ly = arg3;
      gridState = arg4 && typeof arg4 === 'object' ? arg4 : null;
    }

    if (!isPlainObj(layout)) {
      return null;
    }

    const lCellSize = toSafeNum(getOwn(layout, 'cellSize', 0), 0);
    const lGridX = toSafeNum(getOwn(layout, 'gridX', NaN), NaN);
    const lGridY = toSafeNum(getOwn(layout, 'gridY', NaN), NaN);
    const lRows = toSafeNum(getOwn(layout, 'rows', 0), 0);
    const lCols = toSafeNum(getOwn(layout, 'cols', 0), 0);

    if (
      !(lCellSize > 0) ||
      !(lRows >= 1) ||
      !(lCols >= 1) ||
      !Number.isFinite(lGridX) ||
      !Number.isFinite(lGridY) ||
      typeof lx !== 'number' ||
      typeof ly !== 'number' ||
      !Number.isFinite(lx) ||
      !Number.isFinite(ly)
    ) {
      return null;
    }

    const relX = lx - lGridX;
    const relY = ly - lGridY;
    if (relX < 0 || relY < 0) return null;

    const c = Math.floor(relX / lCellSize);
    const r = Math.floor(relY / lCellSize);
    if (r < 0 || r >= lRows || c < 0 || c >= lCols) return null;

    let cellObj = null;
    let tileObj = null;

    const gsCells = getOwn(gridState, 'cells', null);
    const gsMatrix = getOwn(gridState, 'matrix', null);
    const lCellTypes = getOwn(layout, 'cellTypes', null);

    if (safeIsArray(gsCells)) {
      const rowArr = getOwn(gsCells, r, null);
      const cellEntry = safeIsArray(rowArr) ? getOwn(rowArr, c, null) : null;
      if (!isPlainObj(cellEntry)) return null;
      cellObj = cellEntry;
      const cType = normalizeCellType(getOwn(cellObj, 'type', 'normal'));
      if (cType === 'void') return null;
      const rawTile = getOwn(cellObj, 'tile', null);
      tileObj = isPlainObj(rawTile) ? rawTile : null;
    } else if (safeIsArray(gsMatrix)) {
      const rowStr = toSafeText(getOwn(gsMatrix, r, ''), '');
      const ch = c >= 0 && c < rowStr.length ? rowStr.charAt(c) : '';
      if (!ch || ch === '#') return null;
    } else if (safeIsArray(lCellTypes)) {
      const typeRow = getOwn(lCellTypes, r, null);
      if (safeIsArray(typeRow) && getOwn(typeRow, c, null) === 'void') return null;
    }

    const x = lGridX + c * lCellSize;
    const y = lGridY + r * lCellSize;
    return {
      r,
      c,
      cell: cellObj,
      tile: tileObj,
      x,
      y,
      w: lCellSize,
      h: lCellSize,
      cx: x + lCellSize * 0.5,
      cy: y + lCellSize * 0.5
    };
  } catch (_) {
    return null;
  }
}

function isOrderSlotMatched(seat, sl, si) {
  const mti = getOwn(sl, 'matchedTrayIdx', -1);
  if (typeof mti === 'number' && Number.isFinite(mti) && mti >= 0) return true;
  const sm = getOwn(seat, 'slotMatches', null);
  if (safeIsArray(sm) && si >= 0 && si < safeArrayLen(sm, 8) && hasOwn(sm, si)) {
    const smVal = getOwn(sm, si, -1);
    if (typeof smVal === 'number' && Number.isFinite(smVal) && smVal >= 0) {
      return true;
    }
  }
  return Boolean(getOwn(sl, 'matched', false));
}

function isTrayIndexMatchedInSeats(orderState, trayIdx) {
  const seats = getOwn(orderState, 'seats', null);
  const seatsLen = safeArrayLen(seats, 3);
  if (seatsLen === 0) return false;
  for (let s = 0; s < seatsLen; s++) {
    const seat = getOwn(seats, s, null);
    if (!isPlainObj(seat)) continue;
    const sm = getOwn(seat, 'slotMatches', null);
    const smLen = safeArrayLen(sm, 8);
    for (let m = 0; m < smLen; m++) {
      if (hasOwn(sm, m) && getOwn(sm, m, -1) === trayIdx) return true;
    }
    const slots = getOwn(seat, 'slots', null);
    const slotsLen = safeArrayLen(slots, 8);
    for (let k = 0; k < slotsLen; k++) {
      const sl = getOwn(slots, k, null);
      if (isPlainObj(sl) && getOwn(sl, 'matchedTrayIdx', -1) === trayIdx) return true;
    }
  }
  return false;
}

function isPatienceFrozen(orderState, opts, appObj) {
  if (Boolean(getOwn(opts, 'freezeActive', false))) return true;
  if (toSafeNum(getOwn(opts, 'patienceFreezeTimer', 0), 0) > 0) return true;
  if (toSafeNum(getOwn(opts, 'freezeTimer', 0), 0) > 0) return true;
  if (toSafeNum(getOwn(orderState, 'patienceFreezeTimer', 0), 0) > 0) return true;
  if (toSafeNum(getOwn(orderState, 'freezeTimer', 0), 0) > 0) return true;
  if (Boolean(getOwn(orderState, 'freezeActive', false))) return true;
  if (appObj && appObj !== opts) {
    if (Boolean(getOwn(appObj, 'freezeActive', false))) return true;
    if (toSafeNum(getOwn(appObj, 'patienceFreezeTimer', 0), 0) > 0) return true;
    if (toSafeNum(getOwn(appObj, 'freezeTimer', 0), 0) > 0) return true;
  }
  return false;
}

/**
 * Render the 3-seat customer service bar (portrait 3-column horizontal strip OR wide vertical list).
 * Supports BOTH:
 *   - renderCustomersBar(ctx, rect, orderState, sprites, hits, nowSec, opts)
 *   - renderCustomersBar(ctx, rect, orderState, sprites, hits, appObj, nowSec, opts)
 */
function renderCustomersBar(ctx, rect, orderState, sprites, hits, arg6 = 0, arg7 = undefined, arg8 = undefined) {
  if (!isCanvasCtx(ctx)) return;
  try {
    const { x: rx, y: ry, w: rw, h: rh } = extractRect(rect, 359, 108);
    const { appObj, nowSec, opts } = normalizeBarArgs(arg6, arg7, arg8);

    const vertical = Boolean(getOwn(opts, 'vertical', false));
    const optOnSelectSeat = getOwn(opts, 'onSelectSeat', null);
    const appOnSelectSeat = getOwn(appObj, 'onSelectSeat', null);
    const appSelectCustomerSeat = getOwn(appObj, 'selectCustomerSeat', null);
    const appSelectSeat = getOwn(appObj, 'selectSeat', null);
    const onSelectSeat =
      typeof optOnSelectSeat === 'function'
        ? optOnSelectSeat
        : typeof appOnSelectSeat === 'function'
        ? (idx) => appOnSelectSeat.call(appObj, idx)
        : typeof appSelectCustomerSeat === 'function'
        ? (idx) => appSelectCustomerSeat.call(appObj, idx)
        : typeof appSelectSeat === 'function'
        ? (idx) => appSelectSeat.call(appObj, idx)
        : () => {};

    const optAnim = getOwn(opts, 'animState', null);
    const appAnim = getOwn(appObj, 'animState', null);
    const animState =
      (isPlainObj(optAnim) && optAnim) ||
      (isPlainObj(appAnim) && appAnim) ||
      null;
    const optGuide = getOwn(opts, 'guideTargets', null);
    const appGuide = getOwn(appObj, 'guideTargets', null);
    const guideTargets =
      (isPlainObj(optGuide) && optGuide) ||
      (isPlainObj(appGuide) && appGuide) ||
      null;

    const rawSeats = getOwn(orderState, 'seats', null);
    const seats = safeIsArray(rawSeats) ? rawSeats : [null, null, null];
    const rawPref = getOwn(orderState, 'preferredSeatIdx', null);
    const preferredIdx = typeof rawPref === 'number' ? rawPref : null;
    const freezeActive = isPatienceFrozen(orderState, opts, appObj);

    const gap = vertical ? (rh < 240 ? 4 : 8) : rw < 360 ? 6 : 8;
    const cardW = vertical ? rw : Math.max(44, Math.floor((rw - gap * 2) / 3));
    const cardH = vertical ? Math.min(156, Math.max(44, Math.floor((rh - gap * 2) / 3))) : rh;
    const startX = vertical ? rx : rx + Math.max(0, Math.floor((rw - (cardW * 3 + gap * 2)) * 0.5));
    const seatRects = [];

    // Full-width warm honey-oak bakery counter ledge running flush beneath the 3 portrait seats (Design 03)
    const counterH = Math.min(22, Math.max(17, Math.round(cardH * 0.175)));
    const counterY = ry + cardH - counterH;
    const fullBarX = toSafeNum(getOwn(opts, 'fullBarX', rx - 8), rx - 8);
    const fullBarW = Math.max(rw + 16, toSafeNum(getOwn(opts, 'fullBarW', rw + 16), rw + 16));

    // Helper: draw seamless cream speech bubble + curved downward comic tail (single closed path, zero seam)
    const drawSeamlessSpeechBubble = (bx, by, bw, bh, tx, isReady = false, readyPulse = 0) => {
      const r = Math.min(11, bh * 0.32, bw * 0.22);
      const tBaseL = clamp(tx - 6, bx + r + 2, bx + bw - r - 14);
      const tBaseR = Math.min(bx + bw - r - 2, tBaseL + 11);
      const tTipX = tBaseL + 2;
      const tTipY = by + bh + 7.5;

      ctx.save();
      try {
        ctx.shadowColor = isReady ? 'rgba(255, 200, 56, 0.85)' : 'rgba(56, 30, 14, 0.20)';
        ctx.shadowBlur = isReady ? 8 + 4 * readyPulse : 5;
        ctx.shadowOffsetY = isReady ? 0 : 2;

        const bg = safeLinearGradient(ctx, bx, by, bx, by + bh, isReady ? '#FFF7D6' : '#FFFDF7');
        if (isReady) {
          safeAddColorStop(bg, 0, '#FFFDF0', '#FFFDF0');
          safeAddColorStop(bg, 1, '#FFE79E', '#FFE79E');
        } else {
          safeAddColorStop(bg, 0, '#FFFDF7', '#FFFDF7');
          safeAddColorStop(bg, 1, '#F8EED9', '#F8EED9');
        }
        ctx.fillStyle = bg;
        ctx.strokeStyle = isReady ? '#E8961E' : '#4B2B17';
        ctx.lineWidth = isReady ? 2.5 : 2.1;
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + bw - r, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
        ctx.lineTo(bx + bw, by + bh - r);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        ctx.lineTo(tBaseR, by + bh);
        ctx.quadraticCurveTo(tBaseR - 3.5, by + bh + 5.5, tTipX, tTipY);
        ctx.quadraticCurveTo(tBaseL + 0.5, by + bh + 3.2, tBaseL, by + bh);
        ctx.lineTo(bx + r, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = 'rgba(0, 0, 0, 0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.stroke();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }
    };

    // Draw full-width wooden counter ledge BEFORE portraits/badges? No — portraits stand BEHIND the counter!
    // So draw empty-seat placeholders, speech bubbles & clipped portraits first, THEN draw the oak counter ledge & patience bars cleanly in front!

    // Pre-pass: register hit areas & draw background speech bubbles + behind-counter portraits
    const seatRenderMeta = [];
    for (let i = 0; i < 3; i++) {
      const cardX = vertical ? startX : startX + i * (cardW + gap);
      const cardY = vertical ? ry + i * (cardH + gap) : ry;
      const rawSeat = getOwn(seats, i, null);
      const seat = isPlainObj(rawSeat) ? rawSeat : null;
      safePush(seatRects, { x: cardX, y: cardY, w: cardW, h: cardH, seatIdx: i });

      const idxCopy = i;
      safeAddHit(
        hits,
        `seat_${idxCopy}`,
        cardX,
        cardY,
        cardW,
        cardH,
        () => onSelectSeat(idxCopy),
        { seatIdx: idxCopy, occupied: Boolean(seat) }
      );

      if (!seat) {
        // Angry walkout micro-animation on recently vacated seat
        let drewLeaving = false;
        const leavingList = getOwn(animState, 'leavingCustomers', null);
        const leavingLen = safeArrayLen(leavingList, 256);
        for (let k = 0; k < leavingLen; k++) {
          const entry = getOwn(leavingList, k, null);
          if (isPlainObj(entry) && getOwn(entry, 'seatIdx', -1) === i) {
            const dur = Math.max(0.05, toSafeNum(getOwn(entry, 'duration', 0.26), 0.26));
            const rem = clamp(toSafeNum(getOwn(entry, 'timer', 0), 0), 0, dur);
            const p = clamp(1 - rem / dur, 0, 1);
            if (p < 1) {
              const alpha = clamp(1 - p, 0.05, 1);
              const rawLeaveId = getOwn(entry, 'customerId', null);
              UI.drawCustomerPortrait(
                ctx,
                sprites,
                typeof rawLeaveId === 'string' && rawLeaveId ? rawLeaveId : 'cust_orange',
                cardX + cardW * 0.5 + p * 22,
                counterY - Math.min(28, cardH * 0.24),
                Math.min(60, cardH * 0.56),
                { circular: false, mood: 'angry', alpha }
              );
              drewLeaving = true;
              break;
            }
          }
        }

        if (!drewLeaving) {
          // Cozy subtle translucent waiting plaque in the bubble zone so the sunlit cafe interior shines through
          const waitX = cardX + 6;
          const waitY = cardY + 6;
          const waitW = Math.max(36, cardW - 12);
          const waitH = clamp(Math.round(cardH * 0.36), 34, 44);
          ctx.save();
          try {
            ctx.fillStyle = 'rgba(255, 248, 234, 0.72)';
            ctx.strokeStyle = 'rgba(90, 57, 40, 0.42)';
            ctx.lineWidth = 1.6;
            UI.roundRectPath(ctx, waitX, waitY, waitW, waitH, 10);
            ctx.fill();
            ctx.stroke();
          } finally {
            try { ctx.restore(); } catch (_) {}
          }
          UI.drawUiIcon(ctx, sprites || {}, 'icon_clock', waitX + 14, waitY + waitH * 0.5, 15, 0.72);
          UI.drawFitText(
            ctx,
            '候客中...',
            waitX + 25 + (waitW - 30) * 0.5,
            waitY + waitH * 0.5 + 0.5,
            Math.max(24, waitW - 30),
            10.5,
            8.4,
            700,
            '#6E4831',
            'center',
            'middle'
          );
        }
        safePush(seatRenderMeta, null);
        continue;
      }

      // Occupied seat
      const rawCustId = getOwn(seat, 'customerId', null);
      const custId = typeof rawCustId === 'string' && rawCustId ? rawCustId : 'cust_ragdoll';
      const custDef = CUSTOMER_MAP && hasOwn(CUSTOMER_MAP, custId) ? CUSTOMER_MAP[custId] : null;
      const isVip = Boolean(getOwn(seat, 'isVip', false) || getOwn(custDef, 'isVip', false));
      const isUrgent = Boolean(getOwn(seat, 'isUrgent', false) || getOwn(custDef, 'isUrgent', false));
      const isPreferred = preferredIdx === i;

      const maxPat = Math.max(0.01, toSafeNum(getOwn(seat, 'maxPatience', 30), 30));
      const curPat = clamp(toSafeNum(getOwn(seat, 'patience', maxPat), maxPat), 0, maxPat);
      const ratio = clamp(curPat / maxPat, 0, 1);

      const rawSlots = getOwn(seat, 'slots', null);
      const rawSlotsLen = safeArrayLen(rawSlots, 8);
      const slots = [];
      for (let si = 0; si < rawSlotsLen; si++) {
        safePush(slots, getOwn(rawSlots, si, null));
      }
      let allMatched = slots.length > 0;
      for (let si = 0; si < slots.length; si++) {
        if (!isOrderSlotMatched(seat, slots[si], si)) {
          allMatched = false;
          break;
        }
      }
      const isReady = allMatched || Boolean(getOwn(seat, 'readyToServe', false));
      const readyPulse = isReady ? 0.5 + 0.5 * Math.sin(nowSec * 6.5 + i * 0.8) : 0;

      const mood = isReady
        ? 'happy'
        : ratio < PATIENCE_TIP_BANDS.yellowThreshold
        ? 'anxious'
        : 'normal';

      // 1. Seamless Cream Speech Bubble on top with curved downward comic tail (Design 03 + readyToServe glow)
      const bubbleX = cardX + 3;
      const bubbleY = cardY + 6;
      const bubbleW = Math.max(36, cardW - 6);
      const bubbleH = clamp(Math.round(cardH * 0.35), 34, 45);
      const tailX = bubbleX + Math.round(bubbleW * 0.28);
      drawSeamlessSpeechBubble(bubbleX, bubbleY, bubbleW, bubbleH, tailX, isReady, readyPulse);

      // Order required Cat-Cakes inside Speech Bubble (1..3 slots)
      if (slots.length > 0) {
        const chipGap = slots.length >= 3 ? 2 : 5;
        const maxItemS = Math.min(bubbleH - 6, slots.length >= 3 ? 31 : 34);
        const itemS = clamp(
          Math.floor((bubbleW - 10 - (slots.length - 1) * chipGap) / slots.length),
          18,
          maxItemS
        );
        const totalW = slots.length * itemS + (slots.length - 1) * chipGap;
        const rowStartX = Math.round(bubbleX + (bubbleW - totalW) * 0.5);
        const itemCy = bubbleY + bubbleH * 0.5;

        for (let si = 0; si < slots.length; si++) {
          const rawSl = slots[si];
          const sl = isPlainObj(rawSl) ? rawSl : { tier: 1, flavor: 'any' };
          const slotTier = toSafeTier(getOwn(sl, 'tier', 1), 1);
          const rawSlotFlavor = getOwn(sl, 'flavor', 'any');
          const matched = isOrderSlotMatched(seat, sl, si);
          const icx = rowStartX + si * (itemS + chipGap) + itemS * 0.5;
          const reqFlavor =
            typeof rawSlotFlavor === 'string' && rawSlotFlavor !== 'any' && rawSlotFlavor !== 'plain'
              ? rawSlotFlavor
              : null;

          UI.drawCatcakeSprite(ctx, sprites, slotTier, icx, itemCy, itemS, {
            happy: matched,
            flavor: reqFlavor,
            showFlavorBadge: Boolean(reqFlavor)
          });

          if (matched) {
            UI.drawCheckmarkBadge(ctx, icx + itemS * 0.31, itemCy + itemS * 0.28, Math.max(5.5, itemS * 0.21), {
              sprites
            });
          }
        }
      }

      // 2. Standalone Customer Portrait standing cleanly behind the wooden counter ledge (Design 03)
      const portTop = bubbleY + bubbleH + 1;
      const portBot = counterY + 2;
      const portH = Math.max(38, portBot - portTop);
      const portS = Math.min(cardW * 0.86, portH * 1.18);
      const bob = isReady
        ? -Math.abs(Math.sin(nowSec * 5.8 + i * 0.9)) * 3.0
        : Math.sin(nowSec * 2.6 + i * 1.4) * 1.0;
      const portCx = cardX + cardW * 0.5;
      const portCy = portBot - portS * 0.42 + bob;

      // Golden ready-to-serve aura behind portrait (Plan A)
      if (isReady) {
        ctx.save();
        try {
          const haloR = portS * (0.48 + 0.05 * readyPulse);
          ctx.beginPath();
          ctx.arc(portCx, portCy, haloR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 224, 102, ${(0.28 + 0.18 * readyPulse).toFixed(3)})`;
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = `rgba(255, 214, 76, ${(0.65 + 0.30 * readyPulse).toFixed(3)})`;
          ctx.stroke();
        } finally {
          try { ctx.restore(); } catch (_) {}
        }
      }

      // Clip softly at counterY so customer torso tucks cleanly behind the wooden bar counter
      ctx.save();
      try {
        if (!vertical && typeof ctx.clip === 'function') {
          ctx.beginPath();
          ctx.rect(cardX - 10, cardY - 6, cardW + 20, counterY - (cardY - 6) + 1);
          ctx.clip();
        }
        UI.drawCustomerPortrait(ctx, sprites, custId, portCx, portCy, portS, {
          circular: false,
          mood,
          isVip,
          isUrgent
        });
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      safePush(seatRenderMeta, {
        i,
        cardX,
        cardY,
        bubbleY,
        bubbleH,
        isVip,
        isUrgent,
        isPreferred,
        isReady,
        readyPulse,
        ratio,
        portCx,
        portCy,
        portS,
        portBot: counterY
      });
    }

    // 3. Full-width Warm Honey-Oak Bakery Counter Ledge sitting cleanly IN FRONT of customer torsos (Design 03)
    if (!vertical) {
      ctx.save();
      try {
        const cg = safeLinearGradient(ctx, fullBarX, counterY, fullBarX, ry + cardH, '#D9A26B');
        safeAddColorStop(cg, 0, '#E8B87E', '#E8B87E');
        safeAddColorStop(cg, 0.45, '#D2965C', '#D2965C');
        safeAddColorStop(cg, 1, '#BE7F44', '#BE7F44');
        ctx.fillStyle = cg;
        if (typeof ctx.fillRect === 'function') {
          ctx.fillRect(fullBarX, counterY, fullBarW, counterH);
        } else {
          UI.roundRectPath(ctx, fullBarX, counterY, fullBarW, counterH, 0);
          ctx.fill();
        }

        // Subtle horizontal oak woodgrain streaks
        ctx.strokeStyle = 'rgba(122, 68, 28, 0.18)';
        ctx.lineWidth = 1.1;
        for (let gy = counterY + 5; gy < counterY + counterH - 3; gy += 6) {
          ctx.beginPath();
          ctx.moveTo(fullBarX, gy);
          ctx.lineTo(fullBarX + fullBarW, gy);
          ctx.stroke();
        }

        // Top sunlit rim sheen + crisp dark-brown top border
        ctx.strokeStyle = 'rgba(255, 240, 212, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(fullBarX, counterY + 1.5);
        ctx.lineTo(fullBarX + fullBarW, counterY + 1.5);
        ctx.stroke();

        ctx.strokeStyle = '#52301C';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(fullBarX, counterY);
        ctx.lineTo(fullBarX + fullBarW, counterY);
        ctx.stroke();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }
    }

    // 4. Foreground overlays: Semantic Badges (急单/VIP), 3-Band Patience Bars, Ready-to-Serve / Cyan Priority Lock
    for (let idx = 0; idx < seatRenderMeta.length; idx++) {
      const m = seatRenderMeta[idx];
      if (!m) continue;
      const {
        cardX,
        cardY,
        bubbleY,
        bubbleH,
        isVip,
        isUrgent,
        isPreferred,
        isReady,
        readyPulse,
        ratio,
        portCx,
        portCy,
        portS,
        portBot
      } = m;

      // Glowing Cyan Reticle Ring & 4-Corner Priority Lock Frame (drawn beneath 急单/VIP badges, unless readyToServe takes lead)
      if (!isReady && isPreferred && typeof UI.drawPriorityTargetBadge === 'function') {
        UI.drawPriorityTargetBadge(ctx, portCx, portCy + 2, portS * 0.48, nowSec);
      }
      if (!isReady && isPreferred && typeof UI.drawPriorityLockFrame === 'function') {
        UI.drawPriorityLockFrame(ctx, cardX - 1, cardY, cardW + 2, cardH - 1, nowSec);
      }

      // Semantic Badges: Urgent ('急单 ×1.25') or VIP ('VIP ×1.5' + crown) cleanly OVER reticle, matching Design 03
      if (isVip) {
        const bw = Math.min(44, Math.round(cardW * 0.40));
        const bh = 29;
        const bx = cardX + cardW - bw;
        const by = portBot - bh + 2;
        ctx.save();
        try {
          const vg = safeLinearGradient(ctx, bx, by, bx, by + bh, '#F5B841');
          safeAddColorStop(vg, 0, '#FFE478', '#FFE478');
          safeAddColorStop(vg, 1, '#EE9F22', '#EE9F22');
          UI.roundRectPath(ctx, bx, by, bw, bh, 8);
          ctx.fillStyle = vg;
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = '#4E2A16';
          ctx.stroke();
          UI.roundRectPath(ctx, bx + 1.8, by + 1.8, bw - 3.6, bh - 3.6, 6.2);
          ctx.lineWidth = 1.0;
          ctx.strokeStyle = 'rgba(255, 250, 224, 0.65)';
          ctx.stroke();
        } finally {
          try { ctx.restore(); } catch (_) {}
        }
        UI.drawUiIcon(ctx, sprites, 'icon_vip_crown', bx + bw * 0.5, by - 3.5, 16);
        UI.drawOutlinedText(ctx, 'VIP', bx + bw * 0.5, by + 10.5, {
          size: 10.8,
          weight: 900,
          fill: '#FFFDF5',
          stroke: '#4A2410',
          strokeWidth: 2.5,
          shadowOffsetY: 0.5,
          maxWidth: bw - 4
        });
        UI.drawOutlinedText(ctx, '×1.5', bx + bw * 0.5, by + 21.5, {
          size: 9.2,
          weight: 900,
          fill: '#FFF8E0',
          stroke: '#4A2410',
          strokeWidth: 2.0,
          shadowOffsetY: 0,
          maxWidth: bw - 4
        });
      } else if (isUrgent) {
        const bw = Math.min(44, Math.round(cardW * 0.40));
        const bh = 29;
        const bx = cardX;
        const by = portBot - bh + 2;
        ctx.save();
        try {
          const ug = safeLinearGradient(ctx, bx, by, bx, by + bh, '#F27C38');
          safeAddColorStop(ug, 0, '#FF9A44', '#FF9A44');
          safeAddColorStop(ug, 1, '#E6531A', '#E6531A');
          UI.roundRectPath(ctx, bx, by, bw, bh, 8);
          ctx.fillStyle = ug;
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = '#4E2612';
          ctx.stroke();
          UI.roundRectPath(ctx, bx + 1.8, by + 1.8, bw - 3.6, bh - 3.6, 6.2);
          ctx.lineWidth = 1.0;
          ctx.strokeStyle = 'rgba(255, 232, 186, 0.55)';
          ctx.stroke();
        } finally {
          try { ctx.restore(); } catch (_) {}
        }
        UI.drawOutlinedText(ctx, '急单', bx + bw * 0.5, by + 10.5, {
          size: 10.6,
          weight: 900,
          fill: '#FFFDF5',
          stroke: '#4E220E',
          strokeWidth: 2.5,
          shadowOffsetY: 0.5,
          maxWidth: bw - 4
        });
        UI.drawOutlinedText(ctx, '×1.25', bx + bw * 0.5, by + 21.5, {
          size: 8.8,
          weight: 900,
          fill: '#FFF2CC',
          stroke: '#4E220E',
          strokeWidth: 2.0,
          shadowOffsetY: 0,
          maxWidth: bw - 4
        });
      }

      // 3-Band Patience Progress Bar nested cleanly inside oak counter ledge (Design 03)
      const barW = Math.max(30, cardW - 22);
      const barH = 9.5;
      const barX = Math.round(cardX + (cardW - barW) * 0.5);
      const barY = Math.round(counterY + (counterH - barH) * 0.5);

      ctx.save();
      try {
        // Outer cream rim casing
        ctx.fillStyle = freezeActive ? '#8CEEFF' : '#F8E6C4';
        UI.roundRectPath(ctx, barX - 1.5, barY - 1.5, barW + 3, barH + 3, (barH + 3) * 0.5);
        ctx.fill();

        // Dark walnut recessed track
        ctx.fillStyle = '#5A3620';
        UI.roundRectPath(ctx, barX, barY, barW, barH, barH * 0.5);
        ctx.fill();

        if (ratio > 0) {
          const fillW = Math.max(6, (barW - 2) * ratio);
          const pg = safeLinearGradient(ctx, barX, barY, barX, barY + barH, '#74C353');
          if (freezeActive) {
            safeAddColorStop(pg, 0, '#9AF0FF', '#9AF0FF');
            safeAddColorStop(pg, 1, '#2EA4DC', '#2EA4DC');
          } else if (ratio >= PATIENCE_TIP_BANDS.greenThreshold) {
            safeAddColorStop(pg, 0, '#96E56B', '#96E56B');
            safeAddColorStop(pg, 1, '#52B435', '#52B435');
          } else if (ratio >= PATIENCE_TIP_BANDS.yellowThreshold) {
            safeAddColorStop(pg, 0, '#FFE468', '#FFE468');
            safeAddColorStop(pg, 1, '#EB9B1A', '#EB9B1A');
          } else {
            safeAddColorStop(pg, 0, '#FF766B', '#FF766B');
            safeAddColorStop(pg, 1, '#D63830', '#D63830');
            ctx.globalAlpha *= 0.80 + 0.20 * Math.sin(nowSec * 12);
          }
          ctx.fillStyle = pg;
          UI.roundRectPath(ctx, barX + 1, barY + 1, fillW, barH - 2, (barH - 2) * 0.5);
          ctx.fill();

          // Subtle top glossy gleam inside patience bar
          ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
          UI.roundRectPath(ctx, barX + 2.5, barY + 1.6, Math.max(3, fillW - 3), (barH - 2) * 0.38, 2);
          ctx.fill();
        }

        ctx.strokeStyle = '#4B2B17';
        ctx.lineWidth = 1.4;
        UI.roundRectPath(ctx, barX, barY, barW, barH, barH * 0.5);
        ctx.stroke();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      // 5. Ready-to-Serve Golden Pulse Frame & Bouncing '点此上菜' Pill (Plan A)
      if (isReady) {
        ctx.save();
        try {
          ctx.strokeStyle = '#FFD95C';
          ctx.globalAlpha = 0.72 + 0.28 * readyPulse;
          ctx.lineWidth = 2.6;
          ctx.shadowColor = '#F5A623';
          ctx.shadowBlur = 9;
          UI.roundRectPath(ctx, cardX + 1, cardY + 1, cardW - 2, cardH - 2, 11);
          ctx.stroke();
        } finally {
          try { ctx.restore(); } catch (_) {}
        }

        const pillW = clamp(Math.round(cardW * 0.58), 52, 68);
        const pillH = 18;
        const pillX = Math.round(portCx - pillW * 0.5);
        const pillY = Math.round(bubbleY + bubbleH - 4 - readyPulse * 2.0);
        ctx.save();
        try {
          const pillG = safeLinearGradient(ctx, pillX, pillY, pillX, pillY + pillH, '#F5A623');
          safeAddColorStop(pillG, 0, '#FFE880', '#FFE880');
          safeAddColorStop(pillG, 1, '#F29C1F', '#F29C1F');
          ctx.fillStyle = pillG;
          UI.roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH * 0.5);
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#5A3928';
          ctx.stroke();
        } finally {
          try { ctx.restore(); } catch (_) {}
        }
        UI.drawOutlinedText(ctx, '点此上菜', portCx, pillY + pillH * 0.5 + 0.5, {
          size: 9.8,
          minSize: 8.2,
          weight: 900,
          fill: '#FFF8EC',
          stroke: '#5A3928',
          strokeWidth: 2.2,
          shadowOffsetY: 0,
          maxWidth: pillW - 8
        });
      }
    }

    if (guideTargets) {
      safeSetProp(guideTargets, 'customersBar', { x: rx, y: ry, w: rw, h: rh });
      safeSetProp(guideTargets, 'seats', seatRects);
    }
  } catch (_) {}
}

/**
 * Render the 3~4 slot wooden serving tray (`serving_plate.webp`), warm-wood `UI.drawCooldownCell()` trash basket,
 * and orange-gold Combo + purple-gold Starlight Fever strip (Design 03).
 */
function renderTrayStrip(ctx, rect, orderState, sprites, hits, arg6 = 0, arg7 = undefined, arg8 = undefined) {
  if (!isCanvasCtx(ctx)) return;
  try {
    const { x: rx, y: ry, w: rw, h: rh } = extractRect(rect, 359, 68);
    const { appObj, nowSec, opts } = normalizeBarArgs(arg6, arg7, arg8);

    const optAnim = getOwn(opts, 'animState', null);
    const appAnim = getOwn(appObj, 'animState', null);
    const animState =
      (isPlainObj(optAnim) && optAnim) ||
      (isPlainObj(appAnim) && appAnim) ||
      null;
    const optGuide = getOwn(opts, 'guideTargets', null);
    const appGuide = getOwn(appObj, 'guideTargets', null);
    const guideTargets =
      (isPlainObj(optGuide) && optGuide) ||
      (isPlainObj(appGuide) && appGuide) ||
      null;

    const optTapSlot = getOwn(opts, 'onTapTraySlot', null) || getOwn(opts, 'onTraySlotTap', null);
    const appTapSlot = getOwn(appObj, 'onTapTraySlot', null) || getOwn(appObj, 'handleTraySlotTap', null);
    const onTapTraySlot =
      typeof optTapSlot === 'function'
        ? optTapSlot
        : typeof appTapSlot === 'function'
        ? (idx) => appTapSlot.call(appObj, idx)
        : () => {};

    const optTapTrash = getOwn(opts, 'onTapTrash', null) || getOwn(opts, 'onTrashTap', null);
    const appTapTrash = getOwn(appObj, 'onTapTrash', null) || getOwn(appObj, 'handleTrashTap', null);
    const onTapTrash =
      typeof optTapTrash === 'function'
        ? optTapTrash
        : typeof appTapTrash === 'function'
        ? () => appTapTrash.call(appObj)
        : () => {};

    const rawTray = getOwn(orderState, 'tray', null);
    const trayArr = safeIsArray(rawTray) ? rawTray : [];
    const trayLen = safeArrayLen(trayArr, 8);
    const rawCap =
      toSafeNum(getOwn(orderState, 'trayCapacity', 0), 0) ||
      trayLen ||
      toSafeNum(getOwn(opts, 'trayCapacity', 3), 3);
    const trayCap = rawCap >= 4 ? 4 : 3;

    const rawShowStatus = getOwn(opts, 'showStatusRow', undefined);
    const showStatusRow = rawShowStatus !== undefined ? Boolean(rawShowStatus) : rh >= 52;
    const optStatusH = toSafeNum(getOwn(opts, 'statusH', 0), 0);
    const optRowGap = toSafeNum(getOwn(opts, 'rowGap', 0), 0);
    const statusH = showStatusRow
      ? optStatusH > 0
        ? optStatusH
        : clamp(Math.round(rh * 0.34), 24, 33)
      : 0;
    const rowGap = showStatusRow ? (optRowGap > 0 ? optRowGap : rh >= 84 ? 8 : 5) : 0;
    const trayRowH = Math.max(34, rh - statusH - rowGap);

    const trashW = Math.min(64, Math.max(52, Math.round(rw * 0.165)));
    const trashX = rx + rw - trashW - 2;
    const trashY = ry + 3;
    const trashH = Math.max(32, trayRowH - 5);

    const platterX = rx + 6;
    const platterW = Math.max(120, trashX - platterX - 8);

    // 1. Full-Width Dark Espresso Wooden Serving Counter Rail flush beneath oak counter (Design 03)
    const fullBarX = toSafeNum(getOwn(opts, 'fullBarX', rx - 8), rx - 8);
    const fullBarW = Math.max(rw + 16, toSafeNum(getOwn(opts, 'fullBarW', rw + 16), rw + 16));
    const railRad = [0, 0, 14, 14];
    ctx.save();
    try {
      // Soft downward drop shadow cast onto dark walnut tabletop
      ctx.shadowColor = 'rgba(18, 9, 4, 0.44)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      const railG = safeLinearGradient(ctx, fullBarX, ry, fullBarX, ry + trayRowH, '#4D3C34');
      safeAddColorStop(railG, 0, '#5A463C', '#5A463C');
      safeAddColorStop(railG, 0.55, '#4A3830', '#4A3830');
      safeAddColorStop(railG, 1, '#3D2D26', '#3D2D26');
      ctx.fillStyle = railG;
      UI.roundRectPath(ctx, fullBarX, ry, fullBarW, trayRowH, railRad);
      ctx.fill();

      ctx.shadowColor = 'rgba(0, 0, 0, 0)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Subtle inner top wood sheen along upper rail lip
      ctx.strokeStyle = 'rgba(255, 224, 196, 0.14)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(fullBarX + 2, ry + 2.2);
      ctx.lineTo(fullBarX + fullBarW - 2, ry + 2.2);
      ctx.stroke();

      // Subtle inner bevel line above bottom border
      ctx.strokeStyle = 'rgba(255, 214, 178, 0.12)';
      ctx.lineWidth = 1.2;
      UI.roundRectPath(ctx, fullBarX + 2, ry + 1, fullBarW - 4, trayRowH - 3, [0, 0, 12, 12]);
      ctx.stroke();

      ctx.lineWidth = 2.1;
      ctx.strokeStyle = '#2B1B13';
      UI.roundRectPath(ctx, fullBarX, ry, fullBarW, trayRowH, railRad);
      ctx.stroke();
    } finally {
      try { ctx.restore(); } catch (_) {}
    }

    // 3~4 Large Prominent Round Wooden Serving Plates (`serving_plate.png`, Design 03)
    const plateImg =
      (sprites && sprites.byId && sprites.byId.serving_plate) ||
      (sprites && sprites.servingPlate) ||
      null;
    const slotGap = trayCap >= 4 ? 6 : 12;
    const maxSlotW = Math.floor((platterW - (trayCap - 1) * slotGap) / trayCap);
    const slotW = clamp(Math.min(maxSlotW, Math.round(trayRowH * 1.62)), 38, Math.max(46, Math.round(trayRowH * 1.68)));
    const slotHitH = Math.max(30, trayRowH - 4);
    const totalSlotsW = trayCap * slotW + (trayCap - 1) * slotGap;
    const startSlotX = Math.round(platterX + (platterW - totalSlotsW) * 0.5);
    const slotY = Math.round(ry + (trayRowH - slotHitH) * 0.5);

    const slotRects = [];
    let filledSlots = 0;

    for (let i = 0; i < trayCap; i++) {
      const sx = startSlotX + i * (slotW + slotGap);
      const rawTrayItem = getOwn(trayArr, i, null);
      const tile = isPlainObj(rawTrayItem) ? rawTrayItem : null;
      if (tile) filledSlots++;
      safePush(slotRects, { x: sx, y: slotY, w: slotW, h: slotHitH, slotIdx: i });

      const slotIdxCopy = i;
      safeAddHit(
        hits,
        `tray_slot_${slotIdxCopy}`,
        sx,
        slotY,
        slotW,
        slotHitH,
        () => onTapTraySlot(slotIdxCopy),
        { slotIdx: slotIdxCopy, occupied: Boolean(tile) }
      );

      const matched = tile ? isTrayIndexMatchedInSeats(orderState, i) : false;
      const plateCx = sx + slotW * 0.5;
      const plateCy = ry + trayRowH * 0.55;

      // Grounding cast shadow beneath each wooden plate (clean espresso shadow matching Design 03)
      ctx.save();
      try {
        ctx.fillStyle = 'rgba(18, 9, 4, 0.36)';
        UI.fillEllipse(ctx, plateCx, plateCy + 3, slotW * 0.45, trayRowH * 0.34);
        ctx.fill();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      if (plateImg && UI.isReadyImage(plateImg)) {
        UI.drawContainImage(ctx, plateImg, plateCx, plateCy, slotW * 1.04, trayRowH * 1.18);
      } else {
        ctx.save();
        try {
          ctx.fillStyle = matched ? '#D69952' : '#A86E3E';
          ctx.strokeStyle = '#5A3928';
          ctx.lineWidth = 2.0;
          UI.fillEllipse(ctx, plateCx, plateCy, slotW * 0.45, trayRowH * 0.35);
          ctx.fill();
          ctx.stroke();
        } finally {
          try { ctx.restore(); } catch (_) {}
        }
      }

      if (tile) {
        let bounceDy = 0;
        const hintTimer = toSafeNum(getOwn(animState, 'trayHintTimer', 0), 0);
        if (getOwn(animState, 'trayHintSlot', -1) === i && hintTimer > 0) {
          bounceDy = -Math.abs(Math.sin(hintTimer * 24)) * 3.5;
        }
        const tileTier = toSafeTier(getOwn(tile, 'tier', 1), 1);
        const rawTileFlv = getOwn(tile, 'flavor', 'plain');
        const cakeSz = Math.max(24, Math.min(slotW * 0.64, trayRowH * 0.90));
        // Seated snugly inside the wooden plate with cute cat ears gently peeking slightly above the dark rail rim (Design 03)
        UI.drawCatcakeSprite(
          ctx,
          sprites,
          tileTier,
          plateCx,
          ry + trayRowH * 0.33 + bounceDy,
          cakeSz,
          {
            happy: matched,
            flavor: typeof rawTileFlv === 'string' ? rawTileFlv : 'plain',
            showFlavorBadge: true
          }
        );

        // v0.10 M1: hot tray items (inside opts.freshWindowSec) puff a steam wisp + warm dot.
        const trayFreshWin = toSafeNum(getOwn(opts, 'freshWindowSec', 0), 0);
        const trayBakedAt = getOwn(tile, 'bakedAt', null);
        if (trayFreshWin > 0 && typeof trayBakedAt === 'number' && Number.isFinite(trayBakedAt)) {
          const trayAge = toSafeNum(getOwn(orderState, 'elapsedSec', 0), 0) - trayBakedAt;
          if (trayAge >= 0 && trayAge <= trayFreshWin) {
            const trayHeat = 1 - trayAge / trayFreshWin;
            const steamX = plateCx + cakeSz * 0.34;
            const steamY = ry + trayRowH * 0.33 - cakeSz * 0.42 + bounceDy;
            ctx.save();
            try {
              ctx.globalAlpha = clamp(0.55 + trayHeat * 0.45, 0, 1);
              ctx.fillStyle = '#FF8A3D';
              ctx.strokeStyle = '#FFF1D6';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.arc(steamX, steamY, Math.max(3, cakeSz * 0.09), 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineCap = 'round';
              ctx.lineWidth = Math.max(1.1, cakeSz * 0.04);
              const ph = (nowSec * 1.4 + i * 0.37) % 1;
              ctx.globalAlpha = clamp(trayHeat * (1 - ph) * 0.8, 0, 0.8);
              const wy = steamY - cakeSz * 0.12 - ph * cakeSz * 0.22;
              ctx.beginPath();
              ctx.moveTo(steamX, wy + cakeSz * 0.1);
              ctx.quadraticCurveTo(steamX + cakeSz * 0.06, wy + cakeSz * 0.05, steamX, wy);
              ctx.quadraticCurveTo(steamX - cakeSz * 0.06, wy - cakeSz * 0.05, steamX, wy - cakeSz * 0.1);
              ctx.stroke();
            } finally {
              try { ctx.restore(); } catch (_) {}
            }
          }
        }
      }
    }

    // 2. Warm-Wood Trash Basket Cell (`UI.drawCooldownCell`, strictly NO black overlay!)
    const isFullTray = filledSlots >= trayCap;
    const trashCooldown = Math.max(0, toSafeNum(getOwn(orderState, 'trashCooldown', 0), 0));
    const trashCooling = trashCooldown > 1e-6;
    const forkTrashReady = Boolean(
      getOwn(opts, 'forkTrashReady', false) ||
        (getOwn(appObj, 'activeTool', null) === 'fork' &&
          isPlainObj(getOwn(appObj, 'forkSourceCell', null)))
    );
    const shouldWobble =
      forkTrashReady ||
      (!trashCooling && isFullTray) ||
      Boolean(getOwn(opts, 'boardFullHint', false)) ||
      Boolean(animState && toSafeNum(getOwn(animState, 'trashWobbleTimer', 0), 0) > 0);
    const trashRot = shouldWobble ? Math.sin(nowSec * 13) * 0.11 : 0;

    safeAddHit(hits, 'tray_trash_btn', trashX, trashY, trashW, trashH, () => onTapTrash(), {
      isFullTray,
      trashCooldown,
      forkTrashReady
    });

    const trashImg =
      (sprites && sprites.byId && sprites.byId.icon_trash) ||
      (sprites && sprites.icon_trash) ||
      null;
    const clockImg =
      (sprites && sprites.byId && sprites.byId.icon_clock) ||
      (sprites && sprites.icon_clock) ||
      null;

    if (typeof UI.drawCooldownCell === 'function') {
      UI.drawCooldownCell(ctx, trashX, trashY, trashW, trashH, trashCooldown, {
        trashImg,
        clockImg,
        label: '厨余篮',
        forkTrashReady,
        rot: trashRot
      });
    }

    // Puff smoke rings on double-tap discard
    const puffTimer = toSafeNum(getOwn(animState, 'trashPuffTimer', 0), 0);
    if (puffTimer > 0) {
      const dur = 0.18;
      const p = clamp(1 - puffTimer / dur, 0, 1);
      ctx.save();
      try {
        ctx.strokeStyle = `rgba(255, 240, 214, ${(1 - p) * 0.78})`;
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 3; k++) {
          const pr = 3 + p * 8 + k * 2.2;
          const px = trashX + trashW * 0.5 + (k - 1) * 6;
          const py = trashY + 6 - p * 12 - k * 2;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.stroke();
        }
      } finally {
        try { ctx.restore(); } catch (_) {}
      }
    }

    // 3. Bottom Serve Combo Flame-Crest Pill + Luminous Violet-Pink Starlight Fever Bar (Strictly Design 03)
    if (showStatusRow && statusH >= 16) {
      const statusY = ry + trayRowH + rowGap;
      const optStatusW = toSafeNum(getOwn(opts, 'statusW', 0), 0);
      const statusW = optStatusW > 0
        ? Math.min(rw, optStatusW)
        : Math.min(rw - 8, Math.max(280, Math.round(rw * 0.88)));
      const statusX = Math.round(rx + (rw - statusW) * 0.5);
      const statusGap = statusW >= 310 ? 10 : 8;
      const comboW = clamp(Math.round(statusW * 0.34), 94, 124);
      const feverX = statusX + comboW + statusGap;
      const feverW = Math.max(120, statusW - comboW - statusGap);

      const comboCount = Math.max(0, Math.floor(toSafeNum(getOwn(orderState, 'comboCount', 0), 0)));
      const comboTimer = Math.max(0, toSafeNum(getOwn(orderState, 'comboTimer', 0), 0));
      const comboWindow = SERVE_COMBO_WINDOW_SEC || 8.0;
      const comboActive = comboCount >= 2 && comboTimer > 0;
      const comboBroken = Boolean(animState && toSafeNum(getOwn(animState, 'comboBreakTimer', 0), 0) > 0);
      const multLen = Math.max(1, safeArrayLen(SERVE_COMBO_MULTS, 16));
      const multIdx = clamp(comboCount - 1, 0, multLen - 1);
      const comboMult = SERVE_COMBO_MULTS[multIdx] || 1.0;

      // Helper: trace seamless Combo Pill with plump 3-peak golden flame/crown crest rising organically from top-left (Design 03)
      const traceFlameComboPath = (cx0, cy0, cw0, ch0, peakLift) => {
        const r = ch0 * 0.5;
        const p1x = cx0 + r * 0.48;
        const p1y = cy0 - peakLift * 0.52;
        const v1x = cx0 + cw0 * 0.16;
        const v1y = cy0 - peakLift * 0.18;
        const p2x = cx0 + cw0 * 0.25;
        const p2y = cy0 - peakLift;
        const v2x = cx0 + cw0 * 0.34;
        const v2y = cy0 - peakLift * 0.24;
        const p3x = cx0 + cw0 * 0.41;
        const p3y = cy0 - peakLift * 0.44;
        const joinX = cx0 + cw0 * 0.50;

        ctx.beginPath();
        ctx.moveTo(cx0 + r * 0.14, cy0 + r * 0.54);
        ctx.quadraticCurveTo(cx0 + r * 0.12, cy0 - peakLift * 0.16, p1x, p1y);
        ctx.quadraticCurveTo(p1x + 4.5, p1y + 1.2, v1x, v1y);
        ctx.quadraticCurveTo(p2x - 5.2, p2y + 2.5, p2x, p2y);
        ctx.quadraticCurveTo(p2x + 5.2, p2y + 2.5, v2x, v2y);
        ctx.quadraticCurveTo(p3x - 2.4, p3y + 0.6, p3x, p3y);
        ctx.quadraticCurveTo(p3x + 5.5, cy0 - peakLift * 0.08, joinX, cy0);
        ctx.lineTo(cx0 + cw0 - r, cy0);
        ctx.arc(cx0 + cw0 - r, cy0 + r, r, -Math.PI * 0.5, Math.PI * 0.5, false);
        ctx.lineTo(cx0 + r, cy0 + ch0);
        ctx.arc(cx0 + r, cy0 + r, r, Math.PI * 0.5, Math.PI * 1.18, false);
        ctx.closePath();
      };

      // A. Left Combo Pill (Active: seamless glowing flame-crest orange-gold capsule; Idle/Broken: chunky warm-wood bevel pill)
      ctx.save();
      try {
        const pillR = statusH * 0.5;
        if (comboActive) {
          const peakLift = clamp(Math.round(statusH * 0.31), 8, 11);
          ctx.shadowColor = 'rgba(255, 190, 56, 0.80)';
          ctx.shadowBlur = 13;

          const cg = safeLinearGradient(ctx, statusX, statusY - peakLift, statusX, statusY + statusH, '#F89B14');
          safeAddColorStop(cg, 0, '#FFF8A2', '#FFF8A2');
          safeAddColorStop(cg, 0.28, '#FFDC58', '#FFDC58');
          safeAddColorStop(cg, 0.62, '#FA9614', '#FA9614');
          safeAddColorStop(cg, 1, '#E65E0C', '#E65E0C');
          traceFlameComboPath(statusX, statusY, comboW, statusH, peakLift);
          ctx.fillStyle = cg;
          ctx.fill();

          ctx.shadowColor = 'rgba(0, 0, 0, 0)';
          ctx.shadowBlur = 0;

          // Seamless inset flame-crest cream-gold inner rim (follows crest curve — zero cutting line across flame base!)
          traceFlameComboPath(statusX + 2.0, statusY + 2.0, comboW - 4.0, statusH - 4.0, Math.max(4, peakLift - 2.2));
          ctx.strokeStyle = 'rgba(255, 248, 192, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.lineJoin = 'round';
          ctx.stroke();

          // Soft bright inner core glow right inside the rising main flame peak
          ctx.fillStyle = 'rgba(255, 252, 214, 0.44)';
          UI.fillEllipse(ctx, statusX + comboW * 0.25, statusY - peakLift * 0.22, comboW * 0.11, peakLift * 0.44);
          ctx.fill();

          // Glossy top-right specular sheen on the orange-gold capsule
          ctx.fillStyle = 'rgba(255, 255, 232, 0.34)';
          UI.roundRectPath(
            ctx,
            statusX + comboW * 0.48,
            statusY + 3.0,
            Math.max(12, comboW * 0.38),
            Math.max(3.4, statusH * 0.20),
            3
          );
          ctx.fill();

          // Subtle active combo timer indicator tucked neatly along lower inside curve
          const cRatio = clamp(comboTimer / comboWindow, 0, 1);
          ctx.fillStyle = 'rgba(255, 248, 200, 0.45)';
          UI.roundRectPath(
            ctx,
            statusX + pillR * 0.60,
            statusY + statusH - 4.0,
            Math.max(6, (comboW - pillR * 1.2) * cRatio),
            2.0,
            1.0
          );
          ctx.fill();

          // Crisp warm-mahogany outline wrapping the entire flame crest & capsule
          traceFlameComboPath(statusX, statusY, comboW, statusH, peakLift);
          ctx.strokeStyle = '#6A2E0E';
          ctx.lineWidth = 2.0;
          ctx.lineJoin = 'round';
          ctx.stroke();
        } else {
          // Chunky dark warm-wood pill when idle/broken (matches Fever bar weight cleanly)
          const cg = safeLinearGradient(ctx, statusX, statusY, statusX, statusY + statusH, '#6F4830');
          if (comboBroken) {
            safeAddColorStop(cg, 0, '#8A8178', '#8A8178');
            safeAddColorStop(cg, 1, '#5D554E', '#5D554E');
          } else {
            safeAddColorStop(cg, 0, '#7E5438', '#7E5438');
            safeAddColorStop(cg, 1, '#53331F', '#53331F');
          }
          UI.roundRectPath(ctx, statusX, statusY, comboW, statusH, pillR);
          ctx.fillStyle = cg;
          ctx.fill();
          ctx.strokeStyle = '#361C0E';
          ctx.lineWidth = 2.1;
          ctx.stroke();

          // Inner warm bevel rim
          UI.roundRectPath(ctx, statusX + 2.0, statusY + 2.0, comboW - 4.0, statusH - 4.0, Math.max(4, pillR - 2));
          ctx.strokeStyle = comboBroken ? 'rgba(235, 224, 212, 0.25)' : 'rgba(255, 218, 174, 0.28)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      // Two-color bold outlined Combo Typography (`3连` butter-gold + `×1.22` pure white, Design 03)
      if (comboActive) {
        const countStr = `${comboCount}连`;
        const multStr = `×${comboMult.toFixed(2)}`;
        const bigSz = clamp(Math.round(statusH * 0.60), 13.5, 18.0);
        const smallSz = clamp(Math.round(statusH * 0.44), 10.5, 13.8);
        const gapTxt = 3.5;

        ctx.save();
        let bigW = countStr.length * bigSz * 0.85;
        let smallW = multStr.length * smallSz * 0.62;
        try {
          if (typeof ctx.measureText === 'function') {
            ctx.font = UI.fontStr(bigSz, 900);
            const m1 = ctx.measureText(countStr);
            if (m1 && Number.isFinite(m1.width) && m1.width > 0) bigW = m1.width;
            ctx.font = UI.fontStr(smallSz, 900);
            const m2 = ctx.measureText(multStr);
            if (m2 && Number.isFinite(m2.width) && m2.width > 0) smallW = m2.width;
          }
        } finally {
          try { ctx.restore(); } catch (_) {}
        }

        const totalTxtW = bigW + gapTxt + smallW;
        const maxAvail = comboW - 12;
        const scaleDown = totalTxtW > maxAvail ? maxAvail / totalTxtW : 1;
        const fBig = bigSz * scaleDown;
        const fSmall = smallSz * scaleDown;
        const scaledBigW = bigW * scaleDown;
        const scaledTotalW = totalTxtW * scaleDown;
        const startTxtX = statusX + (comboW - scaledTotalW) * 0.5;
        const txtCy = statusY + statusH * 0.52;

        UI.drawOutlinedText(ctx, countStr, startTxtX, txtCy, {
          size: fBig,
          minSize: 9.8,
          weight: 900,
          fill: '#FFE75E',
          stroke: '#4E2006',
          strokeWidth: 3.5,
          shadowOffsetY: 0.8,
          align: 'left',
          baseline: 'middle'
        });
        UI.drawOutlinedText(ctx, multStr, startTxtX + scaledBigW + gapTxt * scaleDown, txtCy + 0.8, {
          size: fSmall,
          minSize: 8.5,
          weight: 900,
          fill: '#FFFDF8',
          stroke: '#4E2006',
          strokeWidth: 2.8,
          shadowOffsetY: 0.7,
          align: 'left',
          baseline: 'middle'
        });
      } else {
        UI.drawOutlinedText(ctx, comboBroken ? '连击中断' : '连击待发', statusX + comboW * 0.5, statusY + statusH * 0.52, {
          size: clamp(Math.round(statusH * 0.42), 10.5, 13.0),
          minSize: 8.8,
          weight: 800,
          fill: comboBroken ? '#E5DDD5' : '#F4DFC2',
          stroke: '#361C0E',
          strokeWidth: 2.2,
          shadowOffsetY: 0.5,
          maxWidth: comboW - 12
        });
      }

      // B. Right Starlight Fever Energy Bar (Sleeker height vertically centered beside Flame Combo Pill, Design 03!)
      const feverTimer = Math.max(0, toSafeNum(getOwn(orderState, 'feverTimer', 0), 0));
      const feverActive = Boolean(getOwn(orderState, 'feverActive', false) || feverTimer > 0);
      const feverEnergy = clamp(toSafeNum(getOwn(orderState, 'feverEnergy', 0), 0), 0, 100);
      const fRatio = feverActive
        ? clamp(feverTimer / (FEVER_CONFIG.durationSec || 10), 0, 1)
        : clamp(feverEnergy / 100, 0, 1);

      const feverH = clamp(statusH - 6, 20, 27);
      const feverY = statusY + Math.round((statusH - feverH) * 0.5) + 1;
      const fRad = feverH * 0.5;
      const frameInset = 2.6;
      const trackX = feverX + frameInset;
      const trackY = feverY + frameInset;
      const trackW = Math.max(12, feverW - frameInset * 2);
      const trackH = Math.max(8, feverH - frameInset * 2);
      const trackR = trackH * 0.5;

      ctx.save();
      try {
        if (feverActive) {
          ctx.shadowColor = 'rgba(218, 118, 245, 0.68)';
          ctx.shadowBlur = 12;
        }
        // Outer metallic warm-bronze rim casing
        const casingG = safeLinearGradient(ctx, feverX, feverY, feverX, feverY + feverH, '#7B5342');
        safeAddColorStop(casingG, 0, feverActive ? '#F5C468' : '#966A54', '#966A54');
        safeAddColorStop(casingG, 0.5, feverActive ? '#C878D8' : '#6D493C', '#6D493C');
        safeAddColorStop(casingG, 1, feverActive ? '#8C48B8' : '#4E3128', '#4E3128');
        UI.roundRectPath(ctx, feverX, feverY, feverW, feverH, fRad);
        ctx.fillStyle = casingG;
        ctx.fill();

        ctx.shadowColor = 'rgba(0, 0, 0, 0)';
        ctx.shadowBlur = 0;

        ctx.strokeStyle = feverActive ? '#4F1E5C' : '#351B10';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Deep recessed dark-plum interior track
        const troughG = safeLinearGradient(ctx, trackX, trackY, trackX, trackY + trackH, '#322230');
        safeAddColorStop(troughG, 0, '#241824', '#241824');
        safeAddColorStop(troughG, 0.45, '#352435', '#352435');
        safeAddColorStop(troughG, 1, '#3F2D3E', '#3F2D3E');
        UI.roundRectPath(ctx, trackX, trackY, trackW, trackH, trackR);
        ctx.fillStyle = troughG;
        ctx.fill();

        // Luminous pastel-amethyst-violet to orchid-pink glossy 3D energy fill clipped neatly inside trough (Design 03)
        if (fRatio > 0) {
          ctx.save();
          try {
            UI.roundRectPath(ctx, trackX, trackY, trackW, trackH, trackR);
            if (typeof ctx.clip === 'function') ctx.clip();

            const fillW = Math.max(trackH * 0.85, trackW * fRatio);
            const fg = safeLinearGradient(ctx, trackX, trackY, trackX + fillW, trackY, '#9A54E4');
            if (feverActive) {
              safeAddColorStop(fg, 0, '#9E54F0', '#9E54F0');
              safeAddColorStop(fg, 0.52, '#E478CE', '#E478CE');
              safeAddColorStop(fg, 1, '#FFE47C', '#FFE47C');
            } else {
              safeAddColorStop(fg, 0, '#7B44E6', '#7B44E6');
              safeAddColorStop(fg, 0.45, '#A862E8', '#A862E8');
              safeAddColorStop(fg, 0.82, '#D880D2', '#D880D2');
              safeAddColorStop(fg, 1, '#F4A4D4', '#F4A4D4');
            }
            ctx.fillStyle = fg;
            UI.roundRectPath(ctx, trackX, trackY, fillW, trackH, trackR);
            ctx.fill();

            // Bright upper 3D jelly glossy lavender-white highlight strip
            const glossH = Math.max(4, trackH * 0.44);
            const glossG = safeLinearGradient(ctx, trackX, trackY, trackX, trackY + glossH, 'rgba(255, 244, 255, 0.56)');
            safeAddColorStop(glossG, 0, 'rgba(255, 246, 255, 0.58)', 'rgba(255, 246, 255, 0.58)');
            safeAddColorStop(glossG, 1, 'rgba(255, 232, 255, 0.08)', 'rgba(255, 232, 255, 0.08)');
            ctx.fillStyle = glossG;
            UI.roundRectPath(ctx, trackX + 2, trackY + 1, Math.max(4, fillW - 4), glossH, glossH * 0.5);
            ctx.fill();

            // Lower deep-violet 3D contour shade
            const shadeH = Math.max(3, trackH * 0.25);
            ctx.fillStyle = 'rgba(60, 18, 114, 0.30)';
            UI.roundRectPath(ctx, trackX, trackY + trackH - shadeH, fillW, shadeH, shadeH * 0.5);
            ctx.fill();

            // Luminous leading-edge sheen when partially filled
            if (fRatio > 0.06 && fRatio < 0.99) {
              ctx.fillStyle = 'rgba(255, 238, 250, 0.48)';
              ctx.beginPath();
              ctx.arc(trackX + fillW - trackR * 0.72, trackY + trackR, trackR * 0.52, -Math.PI * 0.45, Math.PI * 0.45);
              ctx.fill();
            }
          } finally {
            try { ctx.restore(); } catch (_) {}
          }
        }

        // Crisp inner trough outline separating bezel from recessed track
        UI.roundRectPath(ctx, trackX, trackY, trackW, trackH, trackR);
        ctx.strokeStyle = '#25131E';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      // Split-aligned crisp bold white outlined text (`星光热潮` on left, `75%` inside right-mid fill, Design 03)
      const fTxtSz = clamp(Math.round(feverH * 0.52), 11.0, 13.4);
      const fTxtCy = feverY + feverH * 0.52;
      UI.drawOutlinedText(ctx, '星光热潮', feverX + 11, fTxtCy, {
        size: fTxtSz,
        minSize: 9.0,
        weight: 900,
        fill: '#FFFFFF',
        stroke: '#281024',
        strokeWidth: 2.8,
        shadowOffsetY: 0.6,
        align: 'left',
        baseline: 'middle',
        maxWidth: feverW * 0.52
      });

      if (feverActive) {
        const feverPctOpt = toSafeNum(getOwn(opts, 'feverScenePct', 0), 0);
        const feverBadgeTxt =
          feverPctOpt > 0
            ? `+${Math.round(feverPctOpt)}% ${Math.ceil(feverTimer)}s`
            : `×${(FEVER_CONFIG.scoreMult || 1.25).toFixed(2)} ${Math.ceil(feverTimer)}s`;
        UI.drawOutlinedText(
          ctx,
          feverBadgeTxt,
          feverX + feverW - 11,
          fTxtCy,
          {
            size: fTxtSz * 0.95,
            minSize: 8.6,
            weight: 900,
            fill: '#FFF3A8',
            stroke: '#361224',
            strokeWidth: 2.6,
            shadowOffsetY: 0.6,
            align: 'right',
            baseline: 'middle',
            maxWidth: feverW * 0.46
          }
        );
      } else {
        UI.drawOutlinedText(ctx, `${Math.round(feverEnergy)}%`, feverX + Math.round(feverW * 0.66), fTxtCy, {
          size: fTxtSz,
          minSize: 9.0,
          weight: 900,
          fill: '#FFFFFF',
          stroke: '#281024',
          strokeWidth: 2.8,
          shadowOffsetY: 0.6,
          align: 'center',
          baseline: 'middle',
          maxWidth: feverW * 0.36
        });
      }
    }

    if (guideTargets) {
      safeSetProp(guideTargets, 'trayStrip', { x: rx, y: ry, w: rw, h: rh });
      safeSetProp(guideTargets, 'trayPlatter', { x: platterX, y: ry, w: platterW, h: trayRowH });
      safeSetProp(guideTargets, 'traySlots', slotRects);
      safeSetProp(guideTargets, 'trashBtn', { x: trashX, y: trashY, w: trashW, h: trashH });
    }
  } catch (_) {}
}

function normalizeNeededReqSlice(rawArr) {
  const len = safeArrayLen(rawArr, 256);
  if (len === 0) return [];
  const out = [];
  for (let i = 0; i < len; i++) {
    const req = getOwn(rawArr, i, null);
    if (!isPlainObj(req) || !hasOwn(req, 'tier')) continue;
    const rawFlv = getOwn(req, 'flavor', 'any');
    safePush(out, {
      tier: toSafeTier(getOwn(req, 'tier', 1), 1),
      flavor: typeof rawFlv === 'string' ? rawFlv : 'any'
    });
  }
  return out;
}

function collectNeededOrderReqs(orderState, opts) {
  const optNeeded = getOwn(opts, 'neededTiers', null);
  if (isPlainObj(optNeeded)) {
    const rawAll = getOwn(optNeeded, 'allNeeded', null);
    const rawPref = getOwn(optNeeded, 'preferredNeeded', null);
    return {
      allNeeded: normalizeNeededReqSlice(rawAll),
      preferredNeeded: normalizeNeededReqSlice(rawPref)
    };
  }
  const allNeeded = [];
  const preferredNeeded = [];
  const seats = getOwn(orderState, 'seats', null);
  const seatsLen = safeArrayLen(seats, 3);
  if (seatsLen === 0) {
    return { allNeeded, preferredNeeded };
  }
  const rawPrefIdx = getOwn(orderState, 'preferredSeatIdx', -1);
  const prefIdx = typeof rawPrefIdx === 'number' ? rawPrefIdx : -1;

  for (let i = 0; i < seatsLen; i++) {
    const seat = getOwn(seats, i, null);
    if (!isPlainObj(seat)) continue;
    const slots = getOwn(seat, 'slots', null);
    const slotsLen = safeArrayLen(slots, 8);
    if (slotsLen === 0) continue;
    for (let si = 0; si < slotsLen; si++) {
      const sl = getOwn(slots, si, null);
      if (!isPlainObj(sl) || isOrderSlotMatched(seat, sl, si)) continue;
      const rawFlv = getOwn(sl, 'flavor', 'any');
      const req = {
        tier: toSafeTier(getOwn(sl, 'tier', 1), 1),
        flavor: typeof rawFlv === 'string' ? rawFlv : 'any'
      };
      safePush(allNeeded, req);
      if (i === prefIdx) {
        safePush(preferredNeeded, req);
      }
    }
  }
  return { allNeeded, preferredNeeded };
}

function tileMatchesReqList(tile, reqList) {
  const reqLen = safeArrayLen(reqList, 256);
  if (!isPlainObj(tile) || toSafeNum(getOwn(tile, 'frozenHp', 0), 0) > 0 || reqLen === 0) {
    return false;
  }
  const tTier = toSafeTier(getOwn(tile, 'tier', 1), 1);
  const rawTFlv = getOwn(tile, 'flavor', 'plain');
  const tFlavor = typeof rawTFlv === 'string' ? rawTFlv : 'plain';
  for (let i = 0; i < reqLen; i++) {
    const req = hasOwn(reqList, i) ? reqList[i] : null;
    if (!req || tTier !== req.tier) continue;
    const rf = req.flavor;
    if (rf === 'any' || rf === 'plain' || tFlavor === rf || tFlavor === 'gold') {
      return true;
    }
  }
  return false;
}

function resolveSlideState(animState) {
  if (!isPlainObj(animState)) return null;
  const s = getOwn(animState, 'slide', null);
  if (isPlainObj(s)) {
    const dur = Math.max(0.02, toSafeNum(getOwn(s, 'duration', 0.11), 0.11));
    let p = NaN;
    const rawProg = getOwn(s, 'progress', NaN);
    if (hasOwn(s, 'progress') && typeof rawProg === 'number' && Number.isFinite(rawProg)) {
      p = clamp(rawProg, 0, 1);
    } else if (hasOwn(s, 'timer')) {
      const rem = toSafeNum(getOwn(s, 'timer', 0), 0);
      if (rem > 0) p = clamp(1 - rem / dur, 0, 1);
    }
    if (Number.isFinite(p) && p < 1) {
      const sMoves = getOwn(s, 'moves', null);
      const aMoves = getOwn(animState, 'moveEvents', null);
      return {
        p,
        ease: 1 - Math.pow(1 - p, 3),
        moves: safeIsArray(sMoves)
          ? sMoves
          : safeIsArray(aMoves)
          ? aMoves
          : null
      };
    }
  }
  const remTimer = toSafeNum(getOwn(animState, 'slideTimer', 0), 0);
  if (remTimer > 0) {
    const dur = Math.max(0.02, toSafeNum(getOwn(animState, 'slideDuration', 0.11), 0.11));
    const p = clamp(1 - remTimer / dur, 0, 1);
    if (p < 1) {
      const aMoves = getOwn(animState, 'moveEvents', null);
      return {
        p,
        ease: 1 - Math.pow(1 - p, 3),
        moves: safeIsArray(aMoves) ? aMoves : null
      };
    }
  }
  return null;
}

function resolveBlockedShakeOffset(animState) {
  if (!isPlainObj(animState)) return { dx: 0, dy: 0 };
  // v0.10 bake crit: short omni-directional jolt that scales with crit level
  const rawCs = getOwn(animState, 'critShake', null);
  if (isPlainObj(rawCs)) {
    const cRem = toSafeNum(getOwn(rawCs, 'timer', 0), 0);
    const cDur = Math.max(0.02, toSafeNum(getOwn(rawCs, 'duration', 0.2), 0.2));
    if (cRem > 0) {
      const cp = clamp(1 - cRem / cDur, 0, 1);
      const lv = clamp(toSafeNum(getOwn(rawCs, 'level', 2), 2), 2, 4);
      const amp = Math.sin(cp * Math.PI * 3) * (1 - cp) * (1.6 + lv);
      return { dx: amp * 0.6, dy: amp };
    }
  }
  const rawBs = getOwn(animState, 'blockedShake', null);
  const bs = isPlainObj(rawBs) ? rawBs : null;
  const dir = bs ? getOwn(bs, 'dir', null) : getOwn(animState, 'shakeDir', null);
  const dur = Math.max(
    0.02,
    toSafeNum(bs ? getOwn(bs, 'duration', 0.09) : getOwn(animState, 'shakeDuration', 0.09), 0.09)
  );
  const rem = toSafeNum(
    bs ? getOwn(bs, 'timer', 0) : getOwn(animState, 'shakeTimer', 0),
    0
  );
  if (!(rem > 0) || typeof dir !== 'string') return { dx: 0, dy: 0 };

  const p = clamp(1 - rem / dur, 0, 1);
  const amp = Math.sin(p * Math.PI) * 4;
  if (dir === 'left') return { dx: -amp, dy: 0 };
  if (dir === 'right') return { dx: amp, dy: 0 };
  if (dir === 'up') return { dx: 0, dy: -amp };
  if (dir === 'down') return { dx: 0, dy: amp };
  return { dx: 0, dy: 0 };
}

function collectCellFXMaps(animState) {
  const mergeMap = Object.create(null);
  const spawnMap = Object.create(null);
  const iceList = [];

  if (!isPlainObj(animState)) {
    return { mergeMap, spawnMap, iceList };
  }

  const cellFX = getOwn(animState, 'cellFX', null);
  const cellFXLen = safeArrayLen(cellFX, 256);
  for (let i = 0; i < cellFXLen; i++) {
    const fx = getOwn(cellFX, i, null);
    if (!isPlainObj(fx)) continue;
    const r = toSafeNum(getOwn(fx, 'r', -1), -1);
    const c = toSafeNum(getOwn(fx, 'c', -1), -1);
    if (r < 0 || c < 0) continue;
    const kind = getOwn(fx, 'kind', '');
    const defDur =
      kind === 'ice_shatter' ? 0.22 : kind === 'spawn' || kind === 'knead' ? 0.13 : 0.22;
    const dur = Math.max(0.02, toSafeNum(getOwn(fx, 'duration', defDur), defDur));
    let p = NaN;
    const rawProg = getOwn(fx, 'progress', NaN);
    if (hasOwn(fx, 'progress') && typeof rawProg === 'number' && Number.isFinite(rawProg)) {
      p = clamp(rawProg, 0, 1);
    } else if (hasOwn(fx, 'timer')) {
      const rem = toSafeNum(getOwn(fx, 'timer', 0), 0);
      if (rem > 0) p = clamp(1 - rem / dur, 0, 1);
    }
    if (!Number.isFinite(p) || p >= 1) continue;
    const key = `${r},${c}`;
    if (kind === 'merge') {
      mergeMap[key] = p;
    } else if (kind === 'spawn' || kind === 'knead') {
      spawnMap[key] = p;
    } else if (kind === 'ice_shatter') {
      safePush(iceList, { r, c, p });
    }
  }

  const mergeTimer = toSafeNum(getOwn(animState, 'mergeTimer', 0), 0);
  const mergeEvents = getOwn(animState, 'mergeEvents', null);
  const mergeLen = mergeTimer > 0 ? safeArrayLen(mergeEvents, 256) : 0;
  if (mergeLen > 0) {
    const dur = Math.max(0.02, toSafeNum(getOwn(animState, 'mergeDuration', 0.22), 0.22));
    const p = clamp(1 - mergeTimer / dur, 0, 1);
    for (let i = 0; i < mergeLen; i++) {
      const me = getOwn(mergeEvents, i, null);
      if (!isPlainObj(me)) continue;
      const mr = getOwn(me, 'r', null);
      const mc = getOwn(me, 'c', null);
      if (Number.isInteger(mr) && Number.isInteger(mc)) {
        mergeMap[`${mr},${mc}`] = p;
      }
    }
  }

  const iceTimer = toSafeNum(getOwn(animState, 'iceTimer', 0), 0);
  const brokenIce = getOwn(animState, 'brokenIceCells', null);
  const iceLen = iceTimer > 0 ? safeArrayLen(brokenIce, 256) : 0;
  if (iceLen > 0) {
    const dur = Math.max(0.02, toSafeNum(getOwn(animState, 'iceDuration', 0.22), 0.22));
    const p = clamp(1 - iceTimer / dur, 0, 1);
    for (let i = 0; i < iceLen; i++) {
      const ic = getOwn(brokenIce, i, null);
      if (!isPlainObj(ic)) continue;
      const ir = getOwn(ic, 'r', null);
      const icCol = getOwn(ic, 'c', null);
      if (Number.isInteger(ir) && Number.isInteger(icCol)) {
        safePush(iceList, { r: ir, c: icCol, p });
      }
    }
  }

  return { mergeMap, spawnMap, iceList };
}

/**
 * v0.10 M1 board overlays (pure display):
 *  - steam wisps over tiles baked within opts.freshWindowSec of orderState.elapsedSec
 *  - expanding gold rings for cellFX kind 'crit'
 *  - soft starry tint across the bed while Starlight Fever is active
 */
function renderV010BoardOverlays(ctx, layout, cellsMatrix, orderState, animState, nowSec, opts) {
  const cellSize = layout.cellSize;
  const rows = layout.rows;
  const cols = layout.cols;
  const freshWindow = toSafeNum(getOwn(opts, 'freshWindowSec', 0), 0);
  const gameSec = toSafeNum(getOwn(orderState, 'elapsedSec', 0), 0);
  const feverTimer = toSafeNum(getOwn(orderState, 'feverTimer', 0), 0);
  const feverOn = Boolean(getOwn(orderState, 'feverActive', false) || feverTimer > 0);

  if (feverOn && Boolean(getOwn(opts, 'feverV2', false))) {
    ctx.save();
    try {
      ctx.globalAlpha *= 0.16 + 0.06 * Math.sin(nowSec * 3.1);
      ctx.fillStyle = '#B98CFF';
      UI.roundRectPath(ctx, layout.gridX - 2, layout.gridY - 2, layout.gridW + 4, layout.gridH + 4, Math.round(cellSize * 0.2));
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#FFF6C8';
      for (let k = 0; k < 7; k++) {
        const ang = nowSec * 0.9 + k * 0.9;
        const sx = layout.gridX + layout.gridW * ((k * 0.29 + 0.07 + Math.sin(ang) * 0.04 + 1) % 1);
        const sy = layout.gridY + layout.gridH * ((k * 0.41 + 0.11 + nowSec * 0.05) % 1);
        UI.drawStar(ctx, sx, sy, 2.6 + (k % 3), ang);
      }
    } finally {
      try {
        ctx.restore();
      } catch (_) {}
    }
  }

  if (freshWindow > 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cellsMatrix[r][c];
        if (!cell || !cell.tile) continue;
        const bakedAt = getOwn(cell.tile, 'bakedAt', null);
        if (typeof bakedAt !== 'number' || !Number.isFinite(bakedAt)) continue;
        if (toSafeNum(getOwn(cell.tile, 'frozenHp', 0), 0) > 0) continue;
        const age = gameSec - bakedAt;
        if (!(age >= 0) || age > freshWindow) continue;
        const heat = 1 - age / freshWindow;
        const cx = layout.gridX + (c + 0.5) * cellSize;
        const topY = layout.gridY + r * cellSize + cellSize * 0.2;
        ctx.save();
        try {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1.2, cellSize * 0.035);
          for (let k = 0; k < 2; k++) {
            const ph = (nowSec * 1.3 + k * 0.5 + (r * 7 + c * 3) * 0.13) % 1;
            ctx.globalAlpha = clamp(heat * (1 - ph) * 0.75, 0, 0.75);
            const wx = cx + (k === 0 ? -1 : 1) * cellSize * 0.12;
            const wy = topY - ph * cellSize * 0.28;
            ctx.beginPath();
            ctx.moveTo(wx, wy + cellSize * 0.1);
            ctx.quadraticCurveTo(wx + cellSize * 0.06, wy + cellSize * 0.05, wx, wy);
            ctx.quadraticCurveTo(wx - cellSize * 0.06, wy - cellSize * 0.05, wx, wy - cellSize * 0.1);
            ctx.stroke();
          }
        } finally {
          try {
            ctx.restore();
          } catch (_) {}
        }
      }
    }
  }

  const cellFX = getOwn(animState, 'cellFX', null);
  const fxLen = safeArrayLen(cellFX, 256);
  for (let i = 0; i < fxLen; i++) {
    const fx = getOwn(cellFX, i, null);
    if (!isPlainObj(fx) || getOwn(fx, 'kind', '') !== 'crit') continue;
    const dur = Math.max(0.05, toSafeNum(getOwn(fx, 'duration', 0.42), 0.42));
    const rem = toSafeNum(getOwn(fx, 'timer', 0), 0);
    if (!(rem > 0)) continue;
    const p = clamp(1 - rem / dur, 0, 1);
    const r = toSafeNum(getOwn(fx, 'r', -1), -1);
    const c = toSafeNum(getOwn(fx, 'c', -1), -1);
    if (r < 0 || c < 0) continue;
    const lv = clamp(toSafeNum(getOwn(fx, 'level', 2), 2), 2, 4);
    const cx = layout.gridX + (c + 0.5) * cellSize;
    const cy = layout.gridY + (r + 0.5) * cellSize;
    ctx.save();
    try {
      for (let ring = 0; ring < lv - 1; ring++) {
        const rp = clamp(p - ring * 0.12, 0, 1);
        if (rp <= 0) continue;
        ctx.globalAlpha = clamp(1 - rp, 0, 1);
        ctx.strokeStyle = ring === 0 ? '#FFD45E' : '#FFF2A8';
        ctx.lineWidth = Math.max(1.5, cellSize * 0.07 * (1 - rp));
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * (0.3 + rp * 0.6), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = clamp(1 - p, 0, 1);
      ctx.fillStyle = '#FFF6C8';
      for (let k = 0; k < 4 + lv * 2; k++) {
        const ang = (k / (4 + lv * 2)) * Math.PI * 2 + p;
        const dist = cellSize * (0.25 + p * 0.65);
        UI.drawStar(ctx, cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 2.2 + lv * 0.5, ang);
      }
    } finally {
      try {
        ctx.restore();
      } catch (_) {}
    }
  }
}

/**
 * Normalize polymorphic argument order for renderBoardStage:
 *   Form A: (ctx, rect, gridState, orderState, theme, sprites, animState, nowSec, opts)
 *   Form B: (ctx, rect, gridState, orderState, animState, theme, sprites, nowSec, opts)
 */
function normalizeBoardStageArgs(arg5, arg6, arg7, arg8, arg9) {
  let themeArg = null;
  let spritesArg = null;
  let animStateArg = null;

  const swapped =
    isThemeCandidate(arg6) ||
    (isAnimStateCandidate(arg5) && !isThemeCandidate(arg5)) ||
    (arg5 === null && isSpritesCandidate(arg7) && !isSpritesCandidate(arg6));

  if (swapped) {
    animStateArg = isPlainObj(arg5) ? arg5 : null;
    themeArg = arg6;
    spritesArg = isPlainObj(arg7) ? arg7 : {};
  } else {
    themeArg = arg5;
    spritesArg = isPlainObj(arg6) ? arg6 : {};
    animStateArg = isPlainObj(arg7) ? arg7 : null;
  }

  let nowSec = 0;
  let opts = {};
  if (typeof arg8 === 'number') {
    nowSec = Number.isFinite(arg8) ? arg8 : 0;
    opts = isPlainObj(arg9) ? arg9 : {};
  } else if (isPlainObj(arg8)) {
    opts = arg8;
    nowSec = toSafeNum(getOwn(opts, 'nowSec', 0), 0);
  } else {
    nowSec = toSafeNum(arg8, 0);
    opts = isPlainObj(arg9) ? arg9 : {};
  }

  const optAnim = getOwn(opts, 'animState', null);
  return {
    themeObj: resolveBoardTheme(themeArg || getOwn(opts, 'theme', null)),
    sprites: spritesArg,
    animState: animStateArg || (isPlainObj(optAnim) ? optAnim : null),
    nowSec,
    opts
  };
}

/**
 * Build exact rectilinear CW outer & CCW inner-hole boundary loops from non-void board cells.
 * Produces straight crisp tray walls and clean rounded corners with zero scalloping or inner diamond gaps.
 */
function buildOrthogonalBoardLoops(cellsMatrix, rows, cols, gridX, gridY, cellSize) {
  const isSolid = (r, c) =>
    r >= 0 && r < rows && c >= 0 && c < cols && cellsMatrix[r] && cellsMatrix[r][c] && cellsMatrix[r][c].type !== 'void';

  const outMap = Object.create(null);
  const allEdges = [];
  const addEdge = (x0, y0, x1, y1, dx, dy) => {
    const key = `${x0},${y0}`;
    const edge = { x0, y0, x1, y1, dx, dy, used: false };
    if (!outMap[key]) outMap[key] = [];
    safePush(outMap[key], edge);
    safePush(allEdges, edge);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isSolid(r, c)) continue;
      if (!isSolid(r - 1, c)) addEdge(c, r, c + 1, r, 1, 0);
      if (!isSolid(r, c + 1)) addEdge(c + 1, r, c + 1, r + 1, 0, 1);
      if (!isSolid(r + 1, c)) addEdge(c + 1, r + 1, c, r + 1, -1, 0);
      if (!isSolid(r, c - 1)) addEdge(c, r + 1, c, r, 0, -1);
    }
  }

  const loops = [];
  const maxSteps = rows * cols * 4 + 16;
  for (let ei = 0; ei < allEdges.length; ei++) {
    const start = allEdges[ei];
    if (start.used) continue;
    const rawPts = [];
    let cur = start;
    let steps = 0;
    while (cur && !cur.used && steps < maxSteps) {
      cur.used = true;
      safePush(rawPts, { x: cur.x0, y: cur.y0 });
      steps++;
      const nextKey = `${cur.x1},${cur.y1}`;
      const cands = outMap[nextKey];
      if (!cands || cands.length === 0) break;
      let nextEdge = null;
      if (cands.length === 1) {
        if (!cands[0].used) nextEdge = cands[0];
      } else {
        // Right-turn preference at rare diagonal pinch keeps solid connected without crossing
        const rdx = -cur.dy;
        const rdy = cur.dx;
        for (let ci = 0; ci < cands.length; ci++) {
          if (!cands[ci].used && cands[ci].dx === rdx && cands[ci].dy === rdy) {
            nextEdge = cands[ci];
            break;
          }
        }
        if (!nextEdge) {
          for (let ci = 0; ci < cands.length; ci++) {
            if (!cands[ci].used) {
              nextEdge = cands[ci];
              break;
            }
          }
        }
      }
      if (!nextEdge || (nextEdge.x0 === start.x0 && nextEdge.y0 === start.y0 && steps > 1 && nextEdge === start)) {
        break;
      }
      cur = nextEdge;
    }

    // Simplify collinear consecutive vertices
    const nRaw = rawPts.length;
    if (nRaw < 4) continue;
    const corners = [];
    for (let i = 0; i < nRaw; i++) {
      const prev = rawPts[(i - 1 + nRaw) % nRaw];
      const curr = rawPts[i];
      const next = rawPts[(i + 1) % nRaw];
      const d1x = Math.sign(curr.x - prev.x);
      const d1y = Math.sign(curr.y - prev.y);
      const d2x = Math.sign(next.x - curr.x);
      const d2y = Math.sign(next.y - curr.y);
      if (d1x !== d2x || d1y !== d2y) {
        safePush(corners, {
          x: gridX + curr.x * cellSize,
          y: gridY + curr.y * cellSize
        });
      }
    }
    if (corners.length >= 4) {
      safePush(loops, corners);
    }
  }
  return loops;
}

/**
 * Trace compound Canvas 2D path for offset rectilinear loops with smooth convex/concave corner fillets.
 */
function traceOffsetRoundedLoops(ctx, loops, pad, convexRad, concaveRad, offsetY = 0) {
  ctx.beginPath();
  for (let li = 0; li < loops.length; li++) {
    const verts = loops[li];
    const n = verts.length;
    if (n < 4) continue;

    const pts = [];
    for (let i = 0; i < n; i++) {
      const prev = verts[(i - 1 + n) % n];
      const curr = verts[i];
      const next = verts[(i + 1) % n];
      const dpx = Math.sign(curr.x - prev.x);
      const dpy = Math.sign(curr.y - prev.y);
      const dnx = Math.sign(next.x - curr.x);
      const dny = Math.sign(next.y - curr.y);
      // Interior is on the right in screen coords -> outward normal is (dy, -dx)
      const npx = dpy;
      const npy = -dpx;
      const nnx = dny;
      const nny = -dnx;
      const cross = dpx * dny - dpy * dnx;
      safePush(pts, {
        x: curr.x + (npx + nnx) * pad,
        y: curr.y + (npy + nny) * pad + offsetY,
        isConvex: cross > 0
      });
    }

    const entries = [];
    const exits = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const vpx = curr.x - prev.x;
      const vpy = curr.y - prev.y;
      const vnx = next.x - curr.x;
      const vny = next.y - curr.y;
      const lenP = Math.hypot(vpx, vpy);
      const lenN = Math.hypot(vnx, vny);
      const targetR = curr.isConvex ? convexRad : concaveRad;
      const r = Math.max(0, Math.min(targetR, lenP * 0.44, lenN * 0.44));
      const upx = lenP > 1e-4 ? vpx / lenP : 0;
      const upy = lenP > 1e-4 ? vpy / lenP : 0;
      const unx = lenN > 1e-4 ? vnx / lenN : 0;
      const uny = lenN > 1e-4 ? vny / lenN : 0;
      safePush(entries, { x: curr.x - upx * r, y: curr.y - upy * r });
      safePush(exits, { x: curr.x + unx * r, y: curr.y + uny * r });
    }

    ctx.moveTo(exits[n - 1].x, exits[n - 1].y);
    for (let i = 0; i < n; i++) {
      ctx.lineTo(entries[i].x, entries[i].y);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, exits[i].x, exits[i].y);
    }
    ctx.closePath();
  }
}

/**
 * Render the shaped 2048 Cat-Cake baking board stage, special flavor/gold/obstacle/ice cells,
 * servable rings, active utensil aiming frames, and all micro-animations.
 */
function renderBoardStage(
  ctx,
  rect,
  gridState,
  orderState,
  arg5 = null,
  arg6 = null,
  arg7 = null,
  arg8 = 0,
  arg9 = undefined
) {
  let layout = null;
  try {
    const { themeObj, sprites, animState, nowSec, opts } = normalizeBoardStageArgs(
      arg5,
      arg6,
      arg7,
      arg8,
      arg9
    );

    const preLayout = getOwn(opts, 'layout', null);
    layout = extractValidBoardLayout(preLayout) || computeBoardLayout(rect, gridState, opts);

    if (!isCanvasCtx(ctx)) return layout;

    const rows = layout.rows;
    const cols = layout.cols;
    const cellSize = layout.cellSize;
    const cellInset = layout.cellInset;
    const bezelPad = layout.bezelPad;
    const cw = Math.max(8, cellSize - cellInset * 2);

    const gsCells = getOwn(gridState, 'cells', null);
    const hasGsCells = safeIsArray(gsCells);
    const gsPresets = getOwn(gridState, 'presets', null);
    const lCellTypes = layout.cellTypes;
    const hasLtRows = safeIsArray(lCellTypes);

    // Build normalized cells grid view (tolerates GridState OR LevelConfig with matrix+presets)
    const cellsMatrix = [];
    for (let r = 0; r < rows; r++) {
      const rowArr = [];
      const gsRow = hasGsCells ? getOwn(gsCells, r, null) : null;
      const hasGsRow = safeIsArray(gsRow);
      const ltRow = hasLtRows ? getOwn(lCellTypes, r, null) : null;
      const hasLtRow = safeIsArray(ltRow);
      for (let c = 0; c < cols; c++) {
        let cType = 'normal';
        let tile = null;
        let ovenSec = 0;
        const srcCell = hasGsRow ? getOwn(gsRow, c, null) : null;
        if (isPlainObj(srcCell)) {
          cType = normalizeCellType(getOwn(srcCell, 'type', 'normal'));
          const rawTile = getOwn(srcCell, 'tile', null);
          tile = isPlainObj(rawTile) ? rawTile : null;
          ovenSec = toSafeNum(getOwn(srcCell, 'ovenSec', 0), 0);
        } else if (hasLtRow) {
          const rawLt = getOwn(ltRow, c, 'normal');
          cType = typeof rawLt === 'string' ? rawLt : 'normal';
        }
        safePush(rowArr, { r, c, type: cType, tile, ovenSec });
      }
      safePush(cellsMatrix, rowArr);
    }

    const presetsLen = !hasGsCells ? safeArrayLen(gsPresets, 256) : 0;
    for (let i = 0; i < presetsLen; i++) {
      const pr = getOwn(gsPresets, i, null);
      if (!isPlainObj(pr)) continue;
      const prR = getOwn(pr, 'r', null);
      const prC = getOwn(pr, 'c', null);
      if (
        Number.isInteger(prR) &&
        Number.isInteger(prC) &&
        prR >= 0 &&
        prR < rows &&
        prC >= 0 &&
        prC < cols &&
        hasOwn(cellsMatrix, prR) &&
        cellsMatrix[prR] &&
        hasOwn(cellsMatrix[prR], prC) &&
        cellsMatrix[prR][prC] &&
        cellsMatrix[prR][prC].type !== 'void' &&
        cellsMatrix[prR][prC].type !== 'block'
      ) {
        const rawPrFlv = getOwn(pr, 'flavor', 'plain');
        cellsMatrix[prR][prC].tile = {
          tier: toSafeTier(getOwn(pr, 'tier', 1), 1),
          flavor: typeof rawPrFlv === 'string' ? rawPrFlv : 'plain',
          frozenHp: Boolean(getOwn(pr, 'frozen', false)) ? 1 : 0
        };
      }
    }

    const isThumb = Boolean(getOwn(opts, 'thumbnail', false));

    // Subtle ambient theme motes ONLY in outer margin around the board (never inside void cutouts)
    if (!isThumb && layout.w >= 200 && layout.h >= 200) {
      ctx.save();
      try {
        ctx.fillStyle = safeColor(themeObj.moteColor, 'rgba(255, 236, 178, 0.28)');
        for (let m = 0; m < 6; m++) {
          const ang = nowSec * 0.45 + m * 1.047;
          const mx = layout.x + layout.w * (0.12 + 0.76 * ((m * 0.37 + Math.sin(ang) * 0.08 + 1) % 1));
          const my = layout.y + layout.h * (0.10 + 0.80 * ((m * 0.53 + Math.cos(ang) * 0.08 + 1) % 1));
          const insideGrid =
            mx >= layout.gridX - bezelPad - 4 &&
            mx <= layout.gridX + layout.gridW + bezelPad + 4 &&
            my >= layout.gridY - bezelPad - 4 &&
            my <= layout.gridY + layout.gridH + bezelPad + 4;
          if (insideGrid) continue;
          if (themeObj.moteKind === 'petal') {
            UI.drawSakuraPetal(ctx, mx, my, 3.6, ang);
          } else {
            UI.drawStar(ctx, mx, my, 3.2, ang);
          }
        }
      } finally {
        try {
          ctx.restore();
        } catch (_) {}
      }
    }

    // Pass 1: Unified Rectilinear 3D Baking Tray (Ground Shadow -> 3D Bottom Wall -> Raised Outer Rim -> Recessed Inner Deck)
    const boardLoops = buildOrthogonalBoardLoops(cellsMatrix, rows, cols, layout.gridX, layout.gridY, cellSize);
    const outerPad = bezelPad;
    const innerPad = Math.max(1.2, Math.round(outerPad * 0.20));
    const lipH = isThumb ? Math.max(2, Math.round(outerPad * 0.55)) : Math.max(6.0, Math.min(9.0, Math.round(outerPad * 0.74)));
    const outerConvexR = isThumb ? Math.max(5, Math.round(cellSize * 0.26)) : clamp(Math.round(cellSize * 0.22), 12, 17);
    const outerConcaveR = Math.max(3, Math.round(outerConvexR * 0.38));
    const innerConvexR = Math.max(4, outerConvexR - Math.max(4, Math.round((outerPad - innerPad) * 0.88)));
    const innerConcaveR = Math.max(2, Math.round(innerConvexR * 0.36));

    const frameStops =
      safeIsArray(themeObj.frameStops) && safeArrayLen(themeObj.frameStops, 16) >= 3
        ? themeObj.frameStops
        : ['#F2C36E', '#E2AD55', '#D29743'];
    const outlineCol = safeColor(themeObj.frameBorder, '#4A2614');
    const outlineW = isThumb ? 1.6 : 2.5;

    ctx.save();
    try {
      // 1A. Soft Ground Drop Shadow on dark walnut tabletop
      ctx.save();
      try {
        ctx.shadowColor = 'rgba(18, 8, 3, 0.48)';
        ctx.shadowBlur = isThumb ? 4 : 14;
        ctx.shadowOffsetY = isThumb ? 2 : 6;
        ctx.fillStyle = 'rgba(28, 13, 5, 0.38)';
        traceOffsetRoundedLoops(ctx, boardLoops, outerPad, outerConvexR, outerConcaveR, lipH + 1);
        ctx.fill();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      // 1B. 3D Bottom Thickness Wall (solid underside of wooden baking tray, Design 03!)
      const sideGrad = safeLinearGradient(
        ctx,
        layout.gridX,
        layout.gridY + layout.gridH - outerPad,
        layout.gridX,
        layout.gridY + layout.gridH + outerPad + lipH,
        '#B56B2B'
      );
      safeAddColorStop(sideGrad, 0, themeObj.frameSideTop || '#B56B2B', '#B56B2B');
      safeAddColorStop(sideGrad, 1, themeObj.frameSideBot || '#8D4B1B', '#8D4B1B');
      traceOffsetRoundedLoops(ctx, boardLoops, outerPad, outerConvexR, outerConcaveR, lipH);
      ctx.fillStyle = sideGrad;
      ctx.fill();
      ctx.strokeStyle = outlineCol;
      ctx.lineWidth = outlineW;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 1C. Raised Outer Baking-Tray Rim (warm bright bevel frame)
      const frameGrad = safeLinearGradient(
        ctx,
        layout.gridX,
        layout.gridY - outerPad,
        layout.gridX,
        layout.gridY + layout.gridH + outerPad,
        '#F2C36E'
      );
      safeAddColorStop(frameGrad, 0, getOwn(frameStops, 0, '#F2C36E'), '#F2C36E');
      safeAddColorStop(frameGrad, 0.52, getOwn(frameStops, 1, '#E2AD55'), '#E2AD55');
      safeAddColorStop(frameGrad, 1, getOwn(frameStops, 2, '#D29743'), '#D29743');
      traceOffsetRoundedLoops(ctx, boardLoops, outerPad, outerConvexR, outerConcaveR, 0);
      ctx.fillStyle = frameGrad;
      ctx.fill();
      ctx.strokeStyle = outlineCol;
      ctx.lineWidth = outlineW;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Soft bright top-rim specular bevel highlight inset inside outer rim
      if (!isThumb && outerPad >= 6) {
        traceOffsetRoundedLoops(
          ctx,
          boardLoops,
          Math.max(innerPad + 1, outerPad - 2.2),
          Math.max(5, outerConvexR - 2),
          Math.max(2, outerConcaveR - 1),
          0
        );
        ctx.strokeStyle = safeColor(themeObj.frameHighlight, 'rgba(255, 248, 218, 0.64)');
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // 1D. Recessed Inner Tray Deck (smooth lighter wooden divider surface)
      // Draw recessed inner shadow step along top lip first
      if (!isThumb) {
        traceOffsetRoundedLoops(ctx, boardLoops, innerPad + 0.8, innerConvexR + 0.8, innerConcaveR, -0.5);
        ctx.fillStyle = safeColor(themeObj.boardInnerBorder, '#9A5922');
        ctx.fill();
      }

      const deckGrad = safeLinearGradient(
        ctx,
        layout.gridX,
        layout.gridY,
        layout.gridX,
        layout.gridY + layout.gridH,
        '#DEA14A'
      );
      safeAddColorStop(deckGrad, 0, themeObj.boardBgTop, '#DEA14A');
      safeAddColorStop(deckGrad, 1, themeObj.boardBgBot, '#CC8E3B');
      traceOffsetRoundedLoops(ctx, boardLoops, innerPad, innerConvexR, innerConcaveR, 0.8);
      ctx.fillStyle = deckGrad;
      ctx.fill();

      // Subtle inner bevel step crease separating raised outer rim from inner divider deck
      traceOffsetRoundedLoops(ctx, boardLoops, innerPad + 0.4, innerConvexR + 0.4, innerConcaveR, 0.4);
      ctx.strokeStyle = safeColor(themeObj.boardInnerBorder, '#9A5922');
      ctx.lineWidth = isThumb ? 1.0 : 1.7;
      ctx.stroke();

      // Theme Rim Accents matching Design 09 (delicate sakura petals / moonlight stars along tray corners)
      if (!isThumb && boardLoops.length > 0 && (themeObj.id === 'sakura' || themeObj.id === 'moonlight')) {
        const outerVerts = boardLoops[0];
        ctx.save();
        try {
          if (themeObj.id === 'sakura') {
            for (let vi = 0; vi < outerVerts.length && vi < 6; vi += 2) {
              const v = outerVerts[vi];
              const dx = v.x < layout.gridX + layout.gridW * 0.5 ? -outerPad * 0.35 : outerPad * 0.35;
              const dy = v.y < layout.gridY + layout.gridH * 0.5 ? -outerPad * 0.35 : outerPad * 0.35;
              ctx.fillStyle = '#FFD2E2';
              ctx.strokeStyle = '#6E3C4C';
              ctx.lineWidth = 1.2;
              UI.drawSakuraPetal(ctx, v.x + dx, v.y + dy, 5.2, vi * 0.9 + 0.4);
            }
          } else {
            for (let vi = 0; vi < outerVerts.length && vi < 8; vi++) {
              const v = outerVerts[vi];
              const dx = v.x < layout.gridX + layout.gridW * 0.5 ? outerPad * 0.1 : -outerPad * 0.1;
              const dy = v.y < layout.gridY + layout.gridH * 0.5 ? outerPad * 0.1 : -outerPad * 0.1;
              ctx.fillStyle = vi % 2 === 0 ? '#FFE68A' : 'rgba(224, 240, 255, 0.78)';
              UI.drawStar(ctx, v.x + dx, v.y + dy, vi % 2 === 0 ? 4.0 : 2.6, vi * 0.5);
            }
          }
        } finally {
          try { ctx.restore(); } catch (_) {}
        }
      }
    } finally {
      try {
        ctx.restore();
      } catch (_) {}
    }

    const { allNeeded, preferredNeeded } = collectNeededOrderReqs(orderState, opts);
    const rawTool = getOwn(opts, 'activeTool', null);
    const activeTool =
      typeof rawTool === 'string' && (rawTool === 'fork' || rawTool === 'spoon')
        ? rawTool
        : null;
    const rawForkSrc = getOwn(opts, 'forkSourceCell', null);
    const forkSourceCell =
      activeTool === 'fork' &&
      isPlainObj(rawForkSrc) &&
      Number.isInteger(getOwn(rawForkSrc, 'r', null)) &&
      Number.isInteger(getOwn(rawForkSrc, 'c', null))
        ? { r: getOwn(rawForkSrc, 'r', 0), c: getOwn(rawForkSrc, 'c', 0) }
        : null;
    const pulse = 0.5 + 0.5 * Math.sin(nowSec * 5.2);

    // Prepare guideTargets containers if requested
    const optGuide = getOwn(opts, 'guideTargets', null);
    const guideTargets = isPlainObj(optGuide) ? optGuide : null;
    const guideCells = Object.create(null);
    const guideServable = [];
    const guideCellTypes = { matcha: [], berry: [], gold: [] };
    const guideFrozenOrthoSet = Object.create(null);
    const guideFrozenOrtho = [];

    // Pass 2: Carved Sunken Cell Wells, Obstacle Blocks, Special Cell Overlays, Rings & Tool Aiming (Design 03)
    const cushionRad = Math.max(5, Math.round(cw * 0.165));
    const cellTopShadow = safeColor(themeObj.cellTopShadow, 'rgba(116, 52, 14, 0.44)');
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cellsMatrix[r][c];
        if (cell.type === 'void') continue; // Strictly skip '#' void cutouts!

        const slotX = layout.gridX + c * cellSize;
        const slotY = layout.gridY + r * cellSize;
        const cx0 = slotX + cellInset;
        const cy0 = slotY + cellInset;
        const cellRect = { x: slotX, y: slotY, w: cellSize, h: cellSize, r, c };

        if (guideTargets) {
          guideCells[`${r},${c}`] = cellRect;
        }

        // Carved sunken well base (drawn for BOTH playable wells & underneath stone obstacles!)
        ctx.save();
        try {
          const wellBase =
            (r + c) % 2 === 0
              ? safeColor(themeObj.cellFill, '#B7732C')
              : safeColor(themeObj.cellFillAlt, '#B4702A');
          const wg = safeLinearGradient(ctx, cx0, cy0, cx0, cy0 + cw, wellBase);
          safeAddColorStop(wg, 0, safeColor(themeObj.cellBorder, '#8E501E'), '#8E501E');
          safeAddColorStop(wg, 0.14, wellBase, wellBase);
          safeAddColorStop(wg, 1, wellBase, wellBase);
          UI.roundRectPath(ctx, cx0, cy0, cw, cw, cushionRad);
          ctx.fillStyle = wg;
          ctx.fill();

          // Clipped inner top recessed wall shadow (gives unmistakable carved-into-wood hollow depth!)
          if (!isThumb && typeof ctx.clip === 'function') {
            ctx.save();
            try {
              UI.roundRectPath(ctx, cx0, cy0, cw, cw, cushionRad);
              ctx.clip();
              const shH = Math.max(4, Math.round(cw * 0.14));
              const shG = safeLinearGradient(ctx, cx0, cy0, cx0, cy0 + shH, cellTopShadow);
              safeAddColorStop(shG, 0, cellTopShadow, cellTopShadow);
              safeAddColorStop(shG, 1, 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)');
              ctx.fillStyle = shG;
              if (typeof ctx.fillRect === 'function') {
                ctx.fillRect(cx0, cy0, cw, shH);
              }
            } finally {
              try { ctx.restore(); } catch (_) {}
            }
          }

          // Subtle warm catch-light curve along the bottom outer lip of the recessed hollow
          if (!isThumb) {
            ctx.strokeStyle = safeColor(themeObj.cellInnerSheen, 'rgba(255, 226, 158, 0.38)');
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx0 + cushionRad * 0.75, cy0 + cw + 0.6);
            ctx.lineTo(cx0 + cw - cushionRad * 0.75, cy0 + cw + 0.6);
            ctx.stroke();
          }

          // Soft recessed groove outline
          ctx.strokeStyle = safeColor(themeObj.cellBorder, '#8E501E');
          ctx.lineWidth = isThumb ? 0.9 : 1.15;
          UI.roundRectPath(ctx, cx0, cy0, cw, cw, cushionRad);
          ctx.stroke();
        } finally {
          try {
            ctx.restore();
          } catch (_) {}
        }

        if (cell.type === 'block') {
          UI.drawBoardTileOverlay(ctx, sprites, 'tile_block', cx0 - 1, cy0 - 1, cw + 2, { alpha: 1.0 });
          continue;
        }

        if (cell.type === 'matcha') {
          ctx.save();
          try {
            ctx.fillStyle = 'rgba(110, 174, 72, 0.24)';
            UI.roundRectPath(ctx, cx0, cy0, cw, cw, cushionRad);
            ctx.fill();
          } finally {
            try {
              ctx.restore();
            } catch (_) {}
          }
          UI.drawBoardTileOverlay(
            ctx,
            sprites,
            'tile_matcha',
            cx0 + cw * 0.06,
            cy0 + cw * 0.06,
            cw * 0.88,
            { alpha: 0.92 }
          );
          if (guideTargets) safePush(guideCellTypes.matcha, cellRect);
        } else if (cell.type === 'berry') {
          ctx.save();
          try {
            ctx.fillStyle = 'rgba(235, 92, 132, 0.24)';
            UI.roundRectPath(ctx, cx0, cy0, cw, cw, cushionRad);
            ctx.fill();
          } finally {
            try {
              ctx.restore();
            } catch (_) {}
          }
          UI.drawBoardTileOverlay(
            ctx,
            sprites,
            'tile_berry',
            cx0 + cw * 0.06,
            cy0 + cw * 0.06,
            cw * 0.88,
            { alpha: 0.92 }
          );
          if (guideTargets) safePush(guideCellTypes.berry, cellRect);
        } else if (cell.type === 'gold') {
          ctx.save();
          try {
            ctx.fillStyle = 'rgba(245, 190, 88, 0.08)';
            UI.roundRectPath(ctx, cx0, cy0, cw, cw, cushionRad);
            ctx.fill();
          } finally {
            try {
              ctx.restore();
            } catch (_) {}
          }
          // Mandatory M1 rule: draw tile_gold at globalAlpha = 1.0 (hollow center exposes cushion!)
          UI.drawBoardTileOverlay(
            ctx,
            sprites,
            'tile_gold',
            slotX + cellInset * 0.5,
            slotY + cellInset * 0.5,
            cellSize - cellInset,
            { alpha: 1.0 }
          );
          if (guideTargets) safePush(guideCellTypes.gold, cellRect);
        } else if (cell.type === 'oven') {
          // v0.11 M2 Star Oven ('O'): warm copper-ember hearth with subtle glowing grate + bake arc
          const ovenPulse = 0.5 + 0.5 * Math.sin(nowSec * 3.6 + r + c);
          ctx.save();
          try {
            const og = safeLinearGradient(ctx, cx0, cy0, cx0, cy0 + cw, '#C86A28');
            safeAddColorStop(og, 0, 'rgba(255, 166, 76, 0.34)', '#FFA64C');
            safeAddColorStop(og, 1, 'rgba(208, 86, 36, 0.42)', '#D05624');
            ctx.fillStyle = og;
            UI.roundRectPath(ctx, cx0 + 1, cy0 + 1, cw - 2, cw - 2, cushionRad);
            ctx.fill();
            // Warm glowing grate bars
            ctx.strokeStyle = `rgba(255, 214, 128, ${(0.34 + 0.18 * ovenPulse).toFixed(3)})`;
            ctx.lineWidth = 1.6;
            for (let b = 1; b <= 3; b++) {
              const by = cy0 + (cw * b) / 4;
              ctx.beginPath();
              ctx.moveTo(cx0 + cw * 0.16, by);
              ctx.lineTo(cx0 + cw * 0.84, by);
              ctx.stroke();
            }
            ctx.strokeStyle = `rgba(255, 186, 86, ${(0.72 + 0.2 * ovenPulse).toFixed(3)})`;
            ctx.lineWidth = 2.0;
            UI.roundRectPath(ctx, cx0 + 1.5, cy0 + 1.5, cw - 3, cw - 3, Math.max(4, cushionRad - 1));
            ctx.stroke();
            // Star ember emblem in top-left corner
            ctx.fillStyle = '#FFE48E';
            UI.drawStar(ctx, cx0 + 9, cy0 + 9, Math.max(3.2, cw * 0.085), nowSec * 1.4);
            // Baking progress ring around cell center when an eligible tile is resting on it
            const rawOvenSec = toSafeNum(getOwn(cell, 'ovenSec', 0), 0);
            const ovenNeed = toSafeNum(getOwn(opts, 'ovenSec', 6.0), 6.0) || 6.0;
            if (rawOvenSec > 0.05 && cell.tile) {
              const frac = clamp(rawOvenSec / ovenNeed, 0, 1);
              const arcR = cw * 0.41;
              const acx = cx0 + cw * 0.5;
              const acy = cy0 + cw * 0.5;
              ctx.beginPath();
              ctx.arc(acx, acy, arcR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * frac);
              ctx.strokeStyle = '#FFF2A6';
              ctx.lineWidth = 2.8;
              ctx.lineCap = 'round';
              ctx.stroke();
            }
          } finally {
            try {
              ctx.restore();
            } catch (_) {}
          }
        } else if (cell.type === 'syrup') {
          // v0.11 M2 Honey Syrup ('S'): glossy amber-caramel sticky stopper pad
          ctx.save();
          try {
            const sg = safeLinearGradient(ctx, cx0, cy0, cx0, cy0 + cw, '#D8962A');
            safeAddColorStop(sg, 0, 'rgba(255, 206, 92, 0.44)', '#FFCE5C');
            safeAddColorStop(sg, 1, 'rgba(196, 122, 24, 0.52)', '#C47A18');
            ctx.fillStyle = sg;
            UI.roundRectPath(ctx, cx0 + 2, cy0 + 2, cw - 4, cw - 4, cushionRad);
            ctx.fill();
            // Honey swirl ring + sticky gloss droplet
            const scx = cx0 + cw * 0.5;
            const scy = cy0 + cw * 0.5;
            ctx.strokeStyle = 'rgba(255, 244, 194, 0.62)';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(scx, scy, cw * 0.27, 0.2, Math.PI * 1.65);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 250, 224, 0.72)';
            ctx.beginPath();
            ctx.ellipse(cx0 + cw * 0.28, cy0 + cw * 0.26, cw * 0.11, cw * 0.06, -0.45, 0, Math.PI * 2);
            ctx.fill();
            // Corner anchor brackets signaling stopper behavior
            ctx.strokeStyle = 'rgba(128, 66, 16, 0.72)';
            ctx.lineWidth = 2.0;
            UI.roundRectPath(ctx, cx0 + 2, cy0 + 2, cw - 4, cw - 4, Math.max(4, cushionRad - 1));
            ctx.stroke();
          } finally {
            try {
              ctx.restore();
            } catch (_) {}
          }
        }

        // Breathing servable warm-gold rings (single ring for any customer, double ring for preferred customer)
        const tile = cell.tile;
        const tileFrozenHp = toSafeNum(getOwn(tile, 'frozenHp', 0), 0);
        const tileTier = tile ? toSafeTier(getOwn(tile, 'tier', 1), 1) : 0;
        if (tile && !(tileFrozenHp > 0)) {
          const matchesPref = tileMatchesReqList(tile, preferredNeeded);
          const matchesAny = matchesPref || tileMatchesReqList(tile, allNeeded);

          if (matchesAny) {
            if (guideTargets) safePush(guideServable, cellRect);
            ctx.save();
            try {
              if (matchesPref) {
                ctx.fillStyle = `rgba(255, 224, 120, ${(0.06 + 0.05 * pulse).toFixed(3)})`;
                UI.roundRectPath(ctx, cx0 + 1, cy0 + 1, cw - 2, cw - 2, cushionRad);
                ctx.fill();

                ctx.strokeStyle = `rgba(255, 214, 96, ${(0.68 + 0.22 * pulse).toFixed(3)})`;
                ctx.lineWidth = 2.0;
                UI.roundRectPath(ctx, cx0 + 0.8, cy0 + 0.8, cw - 1.6, cw - 1.6, Math.max(4, cushionRad - 0.5));
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 246, 178, 0.88)';
                UI.drawStar(ctx, cx0 + 6, cy0 + 6, Math.max(2.3, cellSize * 0.048), nowSec * 2.2);
              } else {
                ctx.strokeStyle = `rgba(255, 222, 126, ${(0.38 + 0.16 * pulse).toFixed(3)})`;
                ctx.lineWidth = 1.4;
                UI.roundRectPath(ctx, cx0 + 0.8, cy0 + 0.8, cw - 1.6, cw - 1.6, Math.max(4, cushionRad - 0.5));
                ctx.stroke();
              }
            } finally {
              try {
                ctx.restore();
              } catch (_) {}
            }
          }
        }

        // Record frozen + orthogonal neighbors for 3-1 ice_tile spotlight tutorial
        if (guideTargets && tile && tileFrozenHp > 0) {
          const dirs = [
            [0, 0],
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1]
          ];
          for (let d = 0; d < dirs.length; d++) {
            const nr = r + dirs[d][0];
            const nc = c + dirs[d][1];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const nType = cellsMatrix[nr][nc].type;
            if (nType === 'void' || nType === 'block') continue;
            const nKey = `${nr},${nc}`;
            if (!guideFrozenOrthoSet[nKey]) {
              guideFrozenOrthoSet[nKey] = true;
              safePush(guideFrozenOrtho, {
                x: layout.gridX + nc * cellSize,
                y: layout.gridY + nr * cellSize,
                w: cellSize,
                h: cellSize,
                r: nr,
                c: nc
              });
            }
          }
        }

        // Active utensil aiming highlight ('spoon' C1..C6; 'fork' Step 1 cyan-blue on tiles, Step 2 gold source + emerald destinations)
        if (activeTool === 'spoon' && tile && !(tileFrozenHp > 0) && tileTier >= 1 && tileTier <= 6) {
          ctx.save();
          try {
            ctx.strokeStyle = 'rgba(248, 186, 48, 0.94)';
            ctx.lineWidth = 2.4;
            if (typeof ctx.setLineDash === 'function') ctx.setLineDash([5, 4]);
            UI.roundRectPath(ctx, cx0 + 1, cy0 + 1, cw - 2, cw - 2, cushionRad);
            ctx.stroke();
            if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
          } finally {
            try {
              ctx.restore();
            } catch (_) {}
          }
        } else if (activeTool === 'fork') {
          if (!forkSourceCell) {
            if (tile) {
              ctx.save();
              try {
                ctx.strokeStyle = `rgba(68, 194, 244, ${(0.72 + 0.24 * pulse).toFixed(3)})`;
                ctx.lineWidth = 2.4;
                if (typeof ctx.setLineDash === 'function') ctx.setLineDash([5, 4]);
                UI.roundRectPath(ctx, cx0 + 1, cy0 + 1, cw - 2, cw - 2, cushionRad);
                ctx.stroke();
                if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
              } finally {
                try {
                  ctx.restore();
                } catch (_) {}
              }
            }
          } else if (r === forkSourceCell.r && c === forkSourceCell.c) {
            ctx.save();
            try {
              ctx.fillStyle = 'rgba(255, 224, 112, 0.26)';
              UI.roundRectPath(ctx, cx0 + 1, cy0 + 1, cw - 2, cw - 2, cushionRad);
              ctx.fill();

              ctx.strokeStyle = '#FFB624';
              ctx.lineWidth = 2.8;
              UI.roundRectPath(ctx, cx0 + 0.5, cy0 + 0.5, cw - 1, cw - 1, cushionRad);
              ctx.stroke();

              ctx.strokeStyle = 'rgba(255, 248, 178, 0.95)';
              ctx.lineWidth = 1.6;
              UI.roundRectPath(ctx, cx0 - 2, cy0 - 2, cw + 4, cw + 4, cushionRad + 2);
              ctx.stroke();
            } finally {
              try {
                ctx.restore();
              } catch (_) {}
            }
          } else if (!tile || !(tileFrozenHp > 0)) {
            ctx.save();
            try {
              ctx.strokeStyle = `rgba(56, 196, 114, ${(0.72 + 0.24 * pulse).toFixed(3)})`;
              ctx.lineWidth = 2.3;
              if (typeof ctx.setLineDash === 'function') ctx.setLineDash([5, 4]);
              UI.roundRectPath(ctx, cx0 + 1, cy0 + 1, cw - 2, cw - 2, cushionRad);
              ctx.stroke();
              if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
            } finally {
              try {
                ctx.restore();
              } catch (_) {}
            }
          }
        }
      }
    }

    // Pass 3: Cat-Cake Sprites, Slide Interpolation, Q-Bounce, Knead Pop-In, Blocked Shake & Ice Overlay
    const slideState = resolveSlideState(animState);
    const shakeOffset = resolveBlockedShakeOffset(animState);
    const { mergeMap, spawnMap, iceList } = collectCellFXMaps(animState);

    const rawSlideMoves = slideState ? slideState.moves : null;
    const rawSlideMovesLen = safeArrayLen(rawSlideMoves, 256);
    const slideMoves = [];
    for (let i = 0; i < rawSlideMovesLen; i++) {
      const mv = getOwn(rawSlideMoves, i, null);
      if (isPlainObj(mv)) safePush(slideMoves, mv);
    }

    const hiddenDestKeys = Object.create(null);
    const hiddenUids = Object.create(null);
    for (let i = 0; i < slideMoves.length; i++) {
      const mv = slideMoves[i];
      const mvToR = getOwn(mv, 'toR', null);
      const mvToC = getOwn(mv, 'toC', null);
      if (Number.isInteger(mvToR) && Number.isInteger(mvToC)) {
        hiddenDestKeys[`${mvToR},${mvToC}`] = true;
      }
      const mvUid = getOwn(mv, 'uid', undefined);
      if (mvUid !== undefined && mvUid !== null) {
        const mvUidKey = toSafeText(mvUid, '');
        if (mvUidKey) hiddenUids[mvUidKey] = true;
      }
    }

    const hiddenFlyingDestKeys = Object.create(null);
    const preFlyingList = getOwn(animState, 'flyingSprites', null);
    const preFlyingLen = safeArrayLen(preFlyingList, 256);
    for (let i = 0; i < preFlyingLen; i++) {
      const fl = getOwn(preFlyingList, i, null);
      if (!isPlainObj(fl) || getOwn(fl, 'kind', '') !== 'board_to_board') continue;
      const dr = getOwn(fl, 'destR', null);
      const dc = getOwn(fl, 'destC', null);
      const rem = toSafeNum(getOwn(fl, 'timer', 0), 0);
      if (Number.isInteger(dr) && Number.isInteger(dc) && rem > 0) {
        hiddenFlyingDestKeys[`${dr},${dc}`] = true;
      }
    }

    const spriteSize = Math.round(cellSize * 0.84);
    const badgeSize = Math.max(12, Math.round(cellSize * 0.28));
    const animMergeTimer = toSafeNum(getOwn(animState, 'mergeTimer', 0), 0);
    const animSpawnTimer = toSafeNum(getOwn(animState, 'spawnTimer', 0), 0);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cellsMatrix[r][c];
        if (cell.type === 'void' || cell.type === 'block' || !cell.tile) continue;
        const tile = cell.tile;
        const cellKey = `${r},${c}`;
        const tileUid = getOwn(tile, 'uid', undefined);
        const tileUidKey = tileUid !== undefined && tileUid !== null ? toSafeText(tileUid, '') : '';
        const tileJustSpawned = Boolean(getOwn(tile, 'justSpawned', false));
        const tileJustMerged = Boolean(getOwn(tile, 'justMerged', false));
        const tileFrozenHp = toSafeNum(getOwn(tile, 'frozenHp', 0), 0);
        const tileTier = toSafeTier(getOwn(tile, 'tier', 1), 1);
        const rawTileFlv = getOwn(tile, 'flavor', 'plain');
        const tileFlavor = typeof rawTileFlv === 'string' ? rawTileFlv : 'plain';
        const tileFromR = getOwn(tile, 'fromR', null);
        const tileFromC = getOwn(tile, 'fromC', null);

        if (hiddenFlyingDestKeys[cellKey]) {
          continue;
        }

        // Skip destination tile while explicit MoveEvent is sliding into it
        if (
          slideState &&
          slideMoves.length > 0 &&
          (hiddenDestKeys[cellKey] ||
            (tileUidKey && hiddenUids[tileUidKey]) ||
            (tileJustSpawned && slideState.p < 0.72))
        ) {
          continue;
        }

        const slotX = layout.gridX + c * cellSize;
        const slotY = layout.gridY + r * cellSize;
        let drawCx = slotX + cellSize * 0.5;
        let drawCy = slotY + cellSize * 0.5;

        // Fallback slide interpolation via tile.fromR / tile.fromC when moves array wasn't supplied
        if (
          slideState &&
          slideMoves.length === 0 &&
          !(tileFrozenHp > 0) &&
          !tileJustSpawned &&
          Number.isInteger(tileFromR) &&
          Number.isInteger(tileFromC) &&
          (tileFromR !== r || tileFromC !== c)
        ) {
          const fromCx = layout.gridX + (tileFromC + 0.5) * cellSize;
          const fromCy = layout.gridY + (tileFromR + 0.5) * cellSize;
          drawCx = fromCx + (drawCx - fromCx) * slideState.ease;
          drawCy = fromCy + (drawCy - fromCy) * slideState.ease;
        }

        if (!(tileFrozenHp > 0)) {
          drawCx += shakeOffset.dx;
          drawCy += shakeOffset.dy;
        }

        let scale = 1.0;
        let isHappy = Boolean(getOwn(tile, 'happy', false));
        const isForkLifted = Boolean(forkSourceCell && r === forkSourceCell.r && c === forkSourceCell.c);
        if (isForkLifted) {
          drawCy -= 5.5 + Math.sin(nowSec * 6.5) * 1.5;
          scale = 1.08;
          isHappy = true;
        }

        const mergeP = hasOwn(mergeMap, cellKey)
          ? mergeMap[cellKey]
          : tileJustMerged && animMergeTimer > 0
          ? clamp(1 - animMergeTimer / 0.22, 0, 1)
          : -1;
        const spawnP = hasOwn(spawnMap, cellKey)
          ? spawnMap[cellKey]
          : tileJustSpawned && animSpawnTimer > 0
          ? clamp(1 - animSpawnTimer / 0.13, 0, 1)
          : -1;

        if (mergeP >= 0 && mergeP < 1) {
          isHappy = true;
          if (mergeP < 0.45) {
            scale = 0.78 + (mergeP / 0.45) * (1.16 - 0.78);
          } else {
            scale = 1.16 - ((mergeP - 0.45) / 0.55) * (1.16 - 1.0);
          }
        } else if (spawnP >= 0 && spawnP < 1) {
          if (spawnP < 0.65) {
            scale = 0.20 + (spawnP / 0.65) * (1.08 - 0.20);
          } else {
            scale = 1.08 - ((spawnP - 0.65) / 0.35) * (1.08 - 1.0);
          }

          // Cream flour puff rings around newly kneaded/spawned Cat-Cake
          ctx.save();
          try {
            ctx.fillStyle = `rgba(255, 250, 240, ${(0.55 * (1 - spawnP)).toFixed(3)})`;
            for (let k = 0; k < 5; k++) {
              const pa = (k * Math.PI * 2) / 5 + 0.3;
              const dist = spawnP * cellSize * 0.42;
              ctx.beginPath();
              ctx.arc(
                drawCx + Math.cos(pa) * dist,
                drawCy + Math.sin(pa) * dist,
                Math.max(2, (1 - spawnP * 0.5) * cellSize * 0.08),
                0,
                Math.PI * 2
              );
              ctx.fill();
            }
          } finally {
            try {
              ctx.restore();
            } catch (_) {}
          }
        }

        // Subtle grounding shadow anchoring each Cat-Cake inside its recessed wooden hollow (Design 03)
        if (!isThumb) {
          ctx.save();
          try {
            ctx.fillStyle = 'rgba(66, 28, 6, 0.22)';
            UI.fillEllipse(
              ctx,
              drawCx,
              drawCy + cellSize * 0.26 * scale,
              cellSize * 0.30 * scale,
              cellSize * 0.11 * scale
            );
            ctx.fill();
          } finally {
            try { ctx.restore(); } catch (_) {}
          }
        }

        UI.drawCatcakeSprite(ctx, sprites, tileTier, drawCx, drawCy, spriteSize, {
          happy: isHappy,
          flavor: tileFlavor,
          showFlavorBadge: false,
          scaleX: scale,
          scaleY: scale
        });

        if (tileFlavor && tileFlavor !== 'plain' && tileFlavor !== 'any') {
          UI.drawFlavorBadge(
            ctx,
            sprites,
            tileFlavor,
            drawCx + cellSize * 0.27 * scale,
            drawCy + cellSize * 0.27 * scale,
            badgeSize
          );
        }

        // v0.11 M2: Star Oven ('O') baking progress gauge drawn OVER the tile (top-right corner)
        if (!isThumb && cell.type === 'oven' && !(tileFrozenHp > 0) && tileTier < 5) {
          const rawOvenSec = toSafeNum(getOwn(cell, 'ovenSec', 0), 0);
          const ovenNeed = toSafeNum(getOwn(opts, 'ovenSec', 6.0), 6.0) || 6.0;
          if (rawOvenSec > 0.05) {
            const frac = clamp(rawOvenSec / ovenNeed, 0, 1);
            const gR = Math.max(6.2, Math.min(8.5, cellSize * 0.135));
            const gCx = slotX + cellSize - gR - 4;
            const gCy = slotY + gR + 4;
            ctx.save();
            try {
              ctx.beginPath();
              ctx.arc(gCx, gCy, gR + 1.5, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(54, 24, 10, 0.86)';
              ctx.fill();
              ctx.beginPath();
              ctx.arc(gCx, gCy, gR - 1, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(255, 224, 150, 0.25)';
              ctx.lineWidth = 2.2;
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(gCx, gCy, gR - 1, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * frac);
              ctx.strokeStyle = '#FFF2A6';
              ctx.lineWidth = 2.4;
              ctx.lineCap = 'round';
              ctx.stroke();
            } finally {
              try { ctx.restore(); } catch (_) {}
            }
          }
        }

        // Frosted rounded-square crystal casing + mandatory M1 tile_ice overlay at globalAlpha = 0.58 (Design 03)
        if (tileFrozenHp > 0) {
          const iceX = slotX + cellInset;
          const iceY = slotY + cellInset;
          const iceW = Math.max(8, cellSize - cellInset * 2);
          const iceR = Math.max(5, Math.round(iceW * 0.165));
          ctx.save();
          try {
            const ig = safeLinearGradient(ctx, iceX, iceY, iceX + iceW, iceY + iceW, 'rgba(218, 245, 255, 0.50)');
            safeAddColorStop(ig, 0, 'rgba(246, 253, 255, 0.64)', 'rgba(246, 253, 255, 0.64)');
            safeAddColorStop(ig, 0.52, 'rgba(186, 228, 248, 0.46)', 'rgba(186, 228, 248, 0.46)');
            safeAddColorStop(ig, 1, 'rgba(148, 204, 236, 0.56)', 'rgba(148, 204, 236, 0.56)');
            UI.roundRectPath(ctx, iceX, iceY, iceW, iceW, iceR);
            ctx.fillStyle = ig;
            ctx.fill();

            // Crisp diagonal frost specular sheen inside ice block
            if (!isThumb && typeof ctx.clip === 'function') {
              ctx.save();
              try {
                UI.roundRectPath(ctx, iceX + 1.5, iceY + 1.5, iceW - 3, iceW - 3, Math.max(3, iceR - 1.5));
                ctx.clip();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
                ctx.beginPath();
                ctx.moveTo(iceX + iceW * 0.08, iceY + iceW * 0.54);
                ctx.lineTo(iceX + iceW * 0.56, iceY + iceW * 0.06);
                ctx.lineTo(iceX + iceW * 0.74, iceY + iceW * 0.06);
                ctx.lineTo(iceX + iceW * 0.08, iceY + iceW * 0.72);
                ctx.closePath();
                ctx.fill();
              } finally {
                try { ctx.restore(); } catch (_) {}
              }
            }

            // Inner frost rim highlight
            UI.roundRectPath(ctx, iceX + 2, iceY + 2, iceW - 4, iceW - 4, Math.max(3, iceR - 2));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            // Outer icy steel-blue rounded-square outline
            UI.roundRectPath(ctx, iceX, iceY, iceW, iceW, iceR);
            ctx.strokeStyle = '#5B89AC';
            ctx.lineWidth = 1.8;
            ctx.stroke();
          } finally {
            try { ctx.restore(); } catch (_) {}
          }

          const iceInset = cellInset * 0.6;
          UI.drawBoardTileOverlay(
            ctx,
            sprites,
            'tile_ice',
            slotX + iceInset,
            slotY + iceInset,
            cellSize - iceInset * 2,
            { alpha: 0.58 }
          );
        }

        // Merge radial warm-gold star sparks
        if (mergeP >= 0 && mergeP < 1) {
          ctx.save();
          try {
            ctx.fillStyle = `rgba(255, 226, 104, ${(1 - mergeP).toFixed(3)})`;
            for (let k = 0; k < 6; k++) {
              const sa = (k * Math.PI) / 3 + mergeP * 0.9;
              const dist = (0.28 + mergeP * 0.44) * cellSize;
              UI.drawStar(
                ctx,
                drawCx + Math.cos(sa) * dist,
                drawCy + Math.sin(sa) * dist,
                Math.max(2.2, (1 - mergeP * 0.5) * cellSize * 0.075),
                sa
              );
            }
          } finally {
            try {
              ctx.restore();
            } catch (_) {}
          }
        }
      }
    }

    // Render active sliding MoveEvents on top of cells
    if (slideState && slideMoves.length > 0) {
      for (let i = 0; i < slideMoves.length; i++) {
        const mv = slideMoves[i];
        const fromCx = layout.gridX + (toSafeNum(getOwn(mv, 'fromC', 0), 0) + 0.5) * cellSize;
        const fromCy = layout.gridY + (toSafeNum(getOwn(mv, 'fromR', 0), 0) + 0.5) * cellSize;
        const toCx = layout.gridX + (toSafeNum(getOwn(mv, 'toC', 0), 0) + 0.5) * cellSize;
        const toCy = layout.gridY + (toSafeNum(getOwn(mv, 'toR', 0), 0) + 0.5) * cellSize;
        const mx = fromCx + (toCx - fromCx) * slideState.ease;
        const my = fromCy + (toCy - fromCy) * slideState.ease;
        const mvTier = toSafeTier(getOwn(mv, 'tier', 1), 1);
        const rawMvFlv = getOwn(mv, 'flavor', 'plain');
        const mvFlavor = typeof rawMvFlv === 'string' ? rawMvFlv : 'plain';

        UI.drawCatcakeSprite(ctx, sprites, mvTier, mx, my, spriteSize, {
          flavor: mvFlavor,
          showFlavorBadge: false
        });
        if (mvFlavor && mvFlavor !== 'plain' && mvFlavor !== 'any') {
          UI.drawFlavorBadge(
            ctx,
            sprites,
            mvFlavor,
            mx + cellSize * 0.27,
            my + cellSize * 0.27,
            badgeSize
          );
        }
      }
    }

    // Pass 4: Orthogonal Ice Shatter Crystal Shards (220ms)
    if (iceList.length > 0) {
      const shardPalette = ['#E8FAFF', '#89D6FF', '#4BA3DB'];
      const maxIceShards = Math.min(iceList.length, 256);
      for (let i = 0; i < maxIceShards; i++) {
        const ic = iceList[i];
        const icx = layout.gridX + (ic.r >= 0 ? (ic.c + 0.5) * cellSize : 0);
        const icy = layout.gridY + (ic.r + 0.5) * cellSize;
        const p = ic.p;

        ctx.save();
        try {
          ctx.globalAlpha *= clamp(1 - p * 0.85, 0.05, 1);
          for (let k = 0; k < 8; k++) {
            const ang = (k * Math.PI) / 4 + 0.22;
            const dist = p * cellSize * 0.68;
            const sx = icx + Math.cos(ang) * dist;
            const sy = icy + Math.sin(ang) * dist + p * p * 14;
            const sr = Math.max(2.5, (1 - p * 0.45) * cellSize * 0.09);

            ctx.save();
            try {
              ctx.translate(sx, sy);
              ctx.rotate(ang + p * 3.4);
              ctx.fillStyle = shardPalette[k % shardPalette.length];
              ctx.strokeStyle = '#2E6C99';
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.moveTo(0, -sr * 1.2);
              ctx.lineTo(sr * 0.85, 0);
              ctx.lineTo(0, sr * 1.1);
              ctx.lineTo(-sr * 0.75, -sr * 0.15);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            } finally {
              try {
                ctx.restore();
              } catch (_) {}
            }
          }
        } finally {
          try {
            ctx.restore();
          } catch (_) {}
        }
      }
    }

    // Pass 4B (v0.10): fresh steam wisps, bake-crit gold rings, Fever starry tint
    if (!isThumb) {
      renderV010BoardOverlays(ctx, layout, cellsMatrix, orderState, animState, nowSec, opts);
    }

    // Pass 5: Active Utensil Aiming Notice Banner at Top of Board Stage
    if (activeTool && !isThumb) {
      const bannerText =
        activeTool === 'spoon'
          ? '请点选 1~6 阶猫饼升阶（再点厨具取消）'
          : forkSourceCell
          ? '请点选落点移位/互换/合并，或点厨余篮销毁'
          : '点冰块破冰，或点猫饼挑起移位/互换/合并';
      const bw = Math.min(layout.w - 12, 296);
      const bx = layout.x + (layout.w - bw) * 0.5;
      const by = layout.y + 2;
      UI.drawNoticeBanner(ctx, bx, by, bw, 22, {
        tone: 'event',
        icon: activeTool === 'fork' ? 'tool_fork' : 'tool_spoon',
        sprites: sprites || {},
        text: bannerText,
        fontSize: 10.0
      });
    }

    // Pass 6: Parabolic Flying Cat-Cake Arcs (board->tray, board->board, tray->seat, tray/board->trash)
    const flyingList = getOwn(animState, 'flyingSprites', null);
    const flyingLen = safeArrayLen(flyingList, 256);
    for (let i = 0; i < flyingLen; i++) {
      const fl = getOwn(flyingList, i, null);
      if (!isPlainObj(fl)) continue;
      const flKind = getOwn(fl, 'kind', '');
      const isTrash = flKind === 'tray_to_trash' || flKind === 'board_to_trash';
      const defDur =
        flKind === 'tray_to_seat'
          ? 0.28
          : isTrash
          ? 0.18
          : flKind === 'board_to_board'
          ? 0.18
          : 0.16;
      const dur = Math.max(0.02, toSafeNum(getOwn(fl, 'duration', defDur), defDur));
      let p = NaN;
      const rawFlProg = getOwn(fl, 'progress', NaN);
      if (hasOwn(fl, 'progress') && typeof rawFlProg === 'number' && Number.isFinite(rawFlProg)) {
        p = clamp(rawFlProg, 0, 1);
      } else if (hasOwn(fl, 'timer')) {
        const rem = toSafeNum(getOwn(fl, 'timer', 0), 0);
        if (rem > 0) p = clamp(1 - rem / dur, 0, 1);
      }
      if (!Number.isFinite(p) || p >= 1) continue;

      const fx0 = toSafeNum(getOwn(fl, 'fromX', layout.gridX), layout.gridX);
      const fy0 = toSafeNum(getOwn(fl, 'fromY', layout.gridY), layout.gridY);
      const fx1 = toSafeNum(getOwn(fl, 'toX', fx0), fx0);
      const fy1 = toSafeNum(getOwn(fl, 'toY', fy0), fy0);
      const ctrlX = (fx0 + fx1) * 0.5;
      const ctrlY =
        Math.min(fy0, fy1) -
        (flKind === 'tray_to_seat' ? 46 : flKind === 'board_to_board' ? 28 : 34);

      const inv = 1 - p;
      const bx = inv * inv * fx0 + 2 * inv * p * ctrlX + p * p * fx1;
      const by = inv * inv * fy0 + 2 * inv * p * ctrlY + p * p * fy1;
      const fScale = isTrash ? 1 - p * 0.55 : 1 + Math.sin(p * Math.PI) * 0.12;
      const fRot = isTrash ? p * 5.0 : 0;
      const flTier = toSafeTier(getOwn(fl, 'tier', 1), 1);
      const rawFlFlv = getOwn(fl, 'flavor', 'plain');

      UI.drawCatcakeSprite(
        ctx,
        sprites,
        flTier,
        bx,
        by,
        Math.max(24, Math.round(cellSize * (flKind === 'board_to_board' ? 0.80 : 0.72))),
        {
          happy: flKind === 'tray_to_seat' || flKind === 'board_to_board',
          flavor: typeof rawFlFlv === 'string' ? rawFlFlv : 'plain',
          showFlavorBadge: true,
          scaleX: fScale,
          scaleY: fScale,
          rot: fRot,
          alpha: isTrash ? clamp(1 - p * 0.35, 0.2, 1) : 1
        }
      );
    }

    // Pass 7: Floating +Score / Combo Popups (650ms, pure display only — zero score mutation!)
    const popupsList = getOwn(animState, 'popups', null);
    const popupsLen = safeArrayLen(popupsList, 256);
    for (let i = 0; i < popupsLen; i++) {
      const pop = getOwn(popupsList, i, null);
      if (!isPlainObj(pop)) continue;
      const label = toSafeText(getOwn(pop, 'text', ''), '');
      if (!label) continue;
      const dur = Math.max(0.05, toSafeNum(getOwn(pop, 'duration', 0.65), 0.65));
      let p = NaN;
      const rawPopProg = getOwn(pop, 'progress', NaN);
      if (hasOwn(pop, 'progress') && typeof rawPopProg === 'number' && Number.isFinite(rawPopProg)) {
        p = clamp(rawPopProg, 0, 1);
      } else if (hasOwn(pop, 'timer')) {
        const rem = toSafeNum(getOwn(pop, 'timer', 0), 0);
        if (rem > 0) p = clamp(1 - rem / dur, 0, 1);
      }
      if (!Number.isFinite(p) || p >= 1) continue;

      const easeOut = 1 - (1 - p) * (1 - p);
      const px = toSafeNum(getOwn(pop, 'x', layout.gridX + layout.gridW * 0.5), layout.gridX + layout.gridW * 0.5);
      const py = toSafeNum(getOwn(pop, 'y', layout.gridY), layout.gridY) - easeOut * 28;
      const alpha = p > 0.68 ? clamp((1 - p) / 0.32, 0, 1) : 1;

      ctx.save();
      try {
        ctx.globalAlpha *= alpha;
        ctx.font = UI.fontStr(15, 900);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = '#4A2C2A';
        if (typeof ctx.strokeText === 'function') ctx.strokeText(label, px, py);
        ctx.fillStyle = safeColor(getOwn(pop, 'color', null), '#FFE97D');
        if (typeof ctx.fillText === 'function') ctx.fillText(label, px, py);

        UI.drawHeartIcon(ctx, px - 42, py - 1, 9, '#FF8FA8');
        ctx.fillStyle = '#FFF3A1';
        UI.drawStar(ctx, px + 42, py - 1, 4.5, p * 3);

        const sub = toSafeText(getOwn(pop, 'subText', ''), '');
        if (sub) {
          ctx.font = UI.fontStr(11, 800);
          ctx.lineWidth = 2.4;
          if (typeof ctx.strokeText === 'function') ctx.strokeText(sub, px, py + 15);
          ctx.fillStyle = '#FFF8DF';
          if (typeof ctx.fillText === 'function') ctx.fillText(sub, px, py + 15);
        }
      } finally {
        try {
          ctx.restore();
        } catch (_) {}
      }
    }

    if (guideTargets) {
      safeSetProp(guideTargets, 'boardStage', {
        x: layout.gridX - bezelPad,
        y: layout.gridY - bezelPad,
        w: layout.gridW + bezelPad * 2,
        h: layout.gridH + bezelPad * 2
      });
      safeSetProp(guideTargets, 'cells', guideCells);
      safeSetProp(guideTargets, 'servableCells', guideServable);
      safeSetProp(guideTargets, 'cellTypes', guideCellTypes);
      safeSetProp(guideTargets, 'frozenAndOrthogonalCells', guideFrozenOrtho);
    }
  } catch (_) {
    if (!layout) {
      layout = computeBoardLayout(rect, gridState);
    }
  }

  return layout;
}

module.exports = {
  computeBoardLayout,
  renderCustomersBar,
  renderTrayStrip,
  renderBoardStage,
  hitTestBoardCell
};
