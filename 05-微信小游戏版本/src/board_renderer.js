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
      frameBorder: safeColor(getOwn(themeArg, 'frameBorder', null), base.frameBorder),
      frameHighlight: safeColor(getOwn(themeArg, 'frameHighlight', null), base.frameHighlight),
      boardBgTop: safeColor(getOwn(themeArg, 'boardBgTop', null), base.boardBgTop),
      boardBgBot: safeColor(getOwn(themeArg, 'boardBgBot', null), base.boardBgBot),
      boardInnerBorder: safeColor(getOwn(themeArg, 'boardInnerBorder', null), base.boardInnerBorder),
      cellFill: safeColor(getOwn(themeArg, 'cellFill', null), base.cellFill),
      cellFillAlt: safeColor(getOwn(themeArg, 'cellFillAlt', null), base.cellFillAlt),
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

    const maxCell = Math.max(16, toSafeNum(getOwn(safeOpts, 'maxCellSize', 88), 88));
    const minCell = Math.max(12, toSafeNum(getOwn(safeOpts, 'minCellSize', 46), 46));
    const padX = rw < 220 ? 6 : 12;
    const padY = rh < 220 ? 6 : 10;

    const hardMax = Math.max(
      12,
      Math.floor(Math.min((rw - padX * 2) / cols, (rh - padY * 2) / rows))
    );
    const rawIdeal = Math.floor(Math.min((rw - 24) / cols, (rh - 20) / rows));
    const cellSize = Math.min(maxCell, Math.min(hardMax, Math.max(minCell, rawIdeal)));

    const gridW = cols * cellSize;
    const gridH = rows * cellSize;
    const offX = toSafeNum(getOwn(safeOpts, 'offsetX', 0), 0);
    const offY = toSafeNum(getOwn(safeOpts, 'offsetY', 0), 0);
    const gridX = Math.round(rx + (rw - gridW) * 0.5 + offX);
    const gridY = Math.round(ry + (rh - gridH) * 0.5 + offY);
    const cellInset = Math.max(1.5, Math.round(cellSize * 0.045));
    const bezelPad = Math.max(3, Math.min(8, Math.round(cellSize * 0.09)));

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

    // Warm wooden bakery counter ledge running cleanly beneath the 3 portrait seats (Design 03)
    const counterH = Math.min(20, Math.max(14, Math.round(cardH * 0.16)));
    const counterY = ry + cardH - counterH;
    if (!vertical) {
      ctx.save();
      try {
        const cg = safeLinearGradient(ctx, rx - 8, counterY, rx - 8, ry + cardH, '#D9A773');
        safeAddColorStop(cg, 0, '#E3B680', '#E3B680');
        safeAddColorStop(cg, 0.4, '#C9935B', '#C9935B');
        safeAddColorStop(cg, 1, '#9E6A3A', '#9E6A3A');
        ctx.fillStyle = cg;
        UI.roundRectPath(ctx, rx - 4, counterY, rw + 8, counterH, 6);
        ctx.fill();
        ctx.lineWidth = 2.0;
        ctx.strokeStyle = '#5A3928';
        ctx.stroke();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }
    }

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
                cardY + cardH * 0.56,
                Math.min(54, cardH * 0.54),
                { circular: false, mood: 'angry', alpha }
              );
              drewLeaving = true;
              break;
            }
          }
        }

        if (!drewLeaving) {
          UI.drawKissaCard(ctx, cardX + 4, cardY + 8, cardW - 8, Math.max(28, cardH - counterH - 14), {
            tone: 'soft',
            radius: 12,
            borderColor: 'rgba(90, 57, 40, 0.45)',
            lineWidth: 1.6
          });
          UI.drawUiIcon(ctx, sprites || {}, 'icon_clock', cardX + cardW * 0.5, cardY + cardH * 0.34, 16, 0.65);
          UI.drawFitText(
            ctx,
            '候客中...',
            cardX + cardW * 0.5,
            cardY + cardH * 0.56,
            Math.max(24, cardW - 14),
            10.2,
            8.2,
            700,
            '#754C36',
            'center',
            'middle'
          );
        }
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

      const mood = allMatched
        ? 'happy'
        : ratio < PATIENCE_TIP_BANDS.yellowThreshold
        ? 'anxious'
        : 'normal';

      // 1. Cream Speech Bubble on top with downward tail pointing to customer portrait (Design 03)
      const bubbleX = cardX + 2;
      const bubbleY = cardY + 2;
      const bubbleW = Math.max(36, cardW - 4);
      const bubbleH = clamp(Math.round(cardH * 0.37), 34, 46);
      const tailX = bubbleX + Math.round(bubbleW * (i === 0 ? 0.34 : i === 2 ? 0.66 : 0.42));

      ctx.save();
      try {
        const bg = safeLinearGradient(ctx, bubbleX, bubbleY, bubbleX, bubbleY + bubbleH, '#FFFDF7');
        safeAddColorStop(bg, 0, '#FFFDF7', '#FFFDF7');
        safeAddColorStop(bg, 1, '#F8EDD9', '#F8EDD9');
        ctx.fillStyle = bg;
        UI.roundRectPath(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 10);
        ctx.fill();
        ctx.lineWidth = 2.0;
        ctx.strokeStyle = '#5A3928';
        ctx.stroke();

        // Downward speech tail
        ctx.beginPath();
        ctx.moveTo(tailX - 5, bubbleY + bubbleH - 1.5);
        ctx.lineTo(tailX - 1, bubbleY + bubbleH + 7);
        ctx.lineTo(tailX + 5, bubbleY + bubbleH - 1.5);
        ctx.closePath();
        ctx.fillStyle = '#F9EFE0';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tailX - 5, bubbleY + bubbleH - 1);
        ctx.lineTo(tailX - 1, bubbleY + bubbleH + 7);
        ctx.lineTo(tailX + 5, bubbleY + bubbleH - 1);
        ctx.strokeStyle = '#5A3928';
        ctx.lineWidth = 1.9;
        ctx.lineJoin = 'round';
        ctx.stroke();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      // Order required Cat-Cakes inside Speech Bubble (1..3 slots)
      if (slots.length > 0) {
        const chipGap = slots.length >= 3 ? 2 : 5;
        const maxItemS = Math.min(bubbleH - 6, slots.length >= 3 ? 30 : 34);
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
            UI.drawCheckmarkBadge(ctx, icx + itemS * 0.30, itemCy + itemS * 0.28, Math.max(5.0, itemS * 0.20), {
              sprites
            });
          }
        }
      }

      // 2. Standalone Customer WebP Portrait standing behind the wooden counter
      const portTop = bubbleY + bubbleH + 2;
      const portBot = counterY + 2;
      const portH = Math.max(36, portBot - portTop);
      const portS = Math.min(cardW * 0.78, portH * 1.10);
      const bob = Math.sin(nowSec * 2.6 + i * 1.4) * 1.2;
      const portCx = cardX + cardW * 0.5;
      const portCy = portBot - portS * 0.44 + bob;

      // Cyan priority target halo behind preferred customer portrait (Design 03 left fox)
      if (isPreferred && typeof UI.drawPriorityTargetBadge === 'function') {
        UI.drawPriorityTargetBadge(ctx, portCx, portCy, portS * 0.52, nowSec);
      }

      UI.drawCustomerPortrait(ctx, sprites, custId, portCx, portCy, portS, {
        circular: false,
        mood,
        isVip,
        isUrgent
      });

      // 3. Semantic Badges: Urgent ('急单 ×1.25') or VIP ('VIP ×1.5' + crown) matching Design 03
      if (isVip) {
        const bw = Math.min(44, Math.round(cardW * 0.40));
        const bh = 28;
        const bx = cardX + cardW - bw - 1;
        const by = portBot - bh - 2;
        UI.drawKissaCard(ctx, bx, by, bw, bh, {
          fill: '#F5B841',
          borderColor: '#5A3928',
          radius: 8,
          lineWidth: 1.9
        });
        UI.drawUiIcon(ctx, sprites, 'icon_vip_crown', bx + bw * 0.5, by - 4, 15);
        UI.drawOutlinedText(ctx, 'VIP', bx + bw * 0.5, by + 9.5, {
          size: 9.8,
          weight: 900,
          fill: '#FFF8EC',
          stroke: '#5A3928',
          strokeWidth: 2.2,
          shadowOffsetY: 0,
          maxWidth: bw - 4
        });
        UI.drawOutlinedText(ctx, '×1.5', bx + bw * 0.5, by + 20.5, {
          size: 8.8,
          weight: 900,
          fill: '#5A3928',
          stroke: '',
          strokeWidth: 0,
          shadowOffsetY: 0,
          maxWidth: bw - 4
        });
      } else if (isUrgent) {
        const bw = Math.min(44, Math.round(cardW * 0.40));
        const bh = 28;
        const bx = cardX + 1;
        const by = portBot - bh - 2;
        UI.drawKissaCard(ctx, bx, by, bw, bh, {
          fill: '#F27C38',
          borderColor: '#5A3928',
          radius: 8,
          lineWidth: 1.9
        });
        UI.drawOutlinedText(ctx, '急单', bx + bw * 0.5, by + 9.5, {
          size: 9.8,
          weight: 900,
          fill: '#FFF8EC',
          stroke: '#5A3928',
          strokeWidth: 2.2,
          shadowOffsetY: 0,
          maxWidth: bw - 4
        });
        UI.drawOutlinedText(ctx, '×1.25', bx + bw * 0.5, by + 20.5, {
          size: 8.6,
          weight: 900,
          fill: '#FFE9B8',
          stroke: '#5A3928',
          strokeWidth: 1.8,
          shadowOffsetY: 0,
          maxWidth: bw - 4
        });
      }

      // 4. Bottom 3-Band Patience Progress Bar tucked into wooden counter ledge (Design 03)
      const barW = Math.max(26, cardW - 18);
      const barH = 8.5;
      const barX = Math.round(cardX + (cardW - barW) * 0.5);
      const barY = Math.round(counterY + (counterH - barH) * 0.5);

      ctx.save();
      try {
        ctx.fillStyle = '#6D432B';
        UI.roundRectPath(ctx, barX, barY, barW, barH, barH * 0.5);
        ctx.fill();

        if (ratio > 0) {
          const fillW = Math.max(5, (barW - 2) * ratio);
          const pg = safeLinearGradient(ctx, barX, barY, barX + barW, barY, '#74C353');
          if (freezeActive) {
            safeAddColorStop(pg, 0, '#7CE8FF', '#7CE8FF');
            safeAddColorStop(pg, 1, '#2FA8DF', '#2FA8DF');
          } else if (ratio >= PATIENCE_TIP_BANDS.greenThreshold) {
            safeAddColorStop(pg, 0, '#8AD862', '#8AD862');
            safeAddColorStop(pg, 1, '#58AE3B', '#58AE3B');
          } else if (ratio >= PATIENCE_TIP_BANDS.yellowThreshold) {
            safeAddColorStop(pg, 0, '#FFD452', '#FFD452');
            safeAddColorStop(pg, 1, '#E89B1E', '#E89B1E');
          } else {
            safeAddColorStop(pg, 0, '#F46E64', '#F46E64');
            safeAddColorStop(pg, 1, '#D13B32', '#D13B32');
            ctx.globalAlpha *= 0.80 + 0.20 * Math.sin(nowSec * 12);
          }
          ctx.fillStyle = pg;
          UI.roundRectPath(ctx, barX + 1, barY + 1, fillW, barH - 2, (barH - 2) * 0.5);
          ctx.fill();
        }

        ctx.strokeStyle = freezeActive ? '#4BE8FF' : '#FFF4DC';
        ctx.lineWidth = 1.4;
        UI.roundRectPath(ctx, barX, barY, barW, barH, barH * 0.5);
        ctx.stroke();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      // 5. Cyan Breathing 4-Corner Priority Lock Frame (`UI.drawPriorityLockFrame`) on preferred seat
      if (isPreferred && typeof UI.drawPriorityLockFrame === 'function') {
        UI.drawPriorityLockFrame(ctx, cardX + 1, cardY + 1, cardW - 2, cardH - 2, nowSec);
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
    const statusH = showStatusRow ? Math.min(22, Math.max(16, Math.floor(rh * 0.30))) : 0;
    const rowGap = showStatusRow ? 4 : 0;
    const trayRowH = Math.max(30, rh - statusH - rowGap);

    const trashW = Math.min(64, Math.max(50, Math.round(rw * 0.165)));
    const trashX = rx + rw - trashW;
    const trashY = ry + 1;
    const trashH = Math.max(28, trayRowH - 2);

    const platterX = rx;
    const platterW = Math.max(110, trashX - rx - 6);

    // 1. Dark Espresso Wooden Serving Counter Rail behind plates & trash (Design 03)
    ctx.save();
    try {
      const railG = safeLinearGradient(ctx, rx - 4, ry, rx - 4, ry + trayRowH, '#5C3C28');
      safeAddColorStop(railG, 0, '#6B4730', '#6B4730');
      safeAddColorStop(railG, 1, '#472D1E', '#472D1E');
      ctx.fillStyle = railG;
      UI.roundRectPath(ctx, rx - 3, ry, rw + 6, trayRowH, 11);
      ctx.fill();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#382115';
      ctx.stroke();
    } finally {
      try { ctx.restore(); } catch (_) {}
    }

    // 3~4 Round Wooden Serving Plates (`serving_plate.webp`)
    const plateImg =
      (sprites && sprites.byId && sprites.byId.serving_plate) ||
      (sprites && sprites.servingPlate) ||
      null;
    const slotGap = trayCap >= 4 ? 5 : 10;
    const maxSlotW = Math.floor((platterW - 10 - (trayCap - 1) * slotGap) / trayCap);
    const slotS = clamp(Math.min(maxSlotW, Math.round(trayRowH * 1.15)), 26, Math.max(28, trayRowH + 8));
    const slotHitH = Math.min(trayRowH - 2, slotS);
    const totalSlotsW = trayCap * slotS + (trayCap - 1) * slotGap;
    const startSlotX = Math.round(platterX + (platterW - totalSlotsW) * 0.5);
    const slotY = Math.round(ry + (trayRowH - slotHitH) * 0.5);

    const slotRects = [];
    let filledSlots = 0;

    for (let i = 0; i < trayCap; i++) {
      const sx = startSlotX + i * (slotS + slotGap);
      const rawTrayItem = getOwn(trayArr, i, null);
      const tile = isPlainObj(rawTrayItem) ? rawTrayItem : null;
      if (tile) filledSlots++;
      safePush(slotRects, { x: sx, y: slotY, w: slotS, h: slotHitH, slotIdx: i });

      const slotIdxCopy = i;
      safeAddHit(
        hits,
        `tray_slot_${slotIdxCopy}`,
        sx,
        slotY,
        slotS,
        slotHitH,
        () => onTapTraySlot(slotIdxCopy),
        { slotIdx: slotIdxCopy, occupied: Boolean(tile) }
      );

      const matched = tile ? isTrayIndexMatchedInSeats(orderState, i) : false;
      const plateCx = sx + slotS * 0.5;
      const plateCy = ry + trayRowH * 0.56;

      if (matched) {
        ctx.save();
        try {
          ctx.fillStyle = 'rgba(255, 224, 108, 0.28)';
          UI.fillEllipse(ctx, plateCx, plateCy, slotS * 0.52, trayRowH * 0.42);
          ctx.fill();
        } finally {
          try { ctx.restore(); } catch (_) {}
        }
      }

      if (plateImg && UI.isReadyImage(plateImg)) {
        UI.drawContainImage(ctx, plateImg, plateCx, plateCy, slotS * 1.02, trayRowH * 0.94);
      } else {
        ctx.save();
        try {
          ctx.fillStyle = matched ? '#D69952' : '#A86E3E';
          ctx.strokeStyle = '#5A3928';
          ctx.lineWidth = 2.0;
          UI.fillEllipse(ctx, plateCx, plateCy, slotS * 0.46, trayRowH * 0.34);
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
        UI.drawCatcakeSprite(
          ctx,
          sprites,
          tileTier,
          plateCx,
          ry + trayRowH * 0.42 + bounceDy,
          Math.max(18, Math.min(slotS * 0.72, trayRowH * 0.86)),
          {
            happy: matched,
            flavor: typeof rawTileFlv === 'string' ? rawTileFlv : 'plain',
            showFlavorBadge: true
          }
        );
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

    // 3. Bottom Serve Combo + Purple-Gold Starlight Fever Bar (Design 03)
    if (showStatusRow && statusH >= 12) {
      const statusY = ry + trayRowH + rowGap;
      const comboW = Math.round(rw * 0.36);
      const feverX = rx + comboW + 6;
      const feverW = Math.max(80, rw - comboW - 6);

      const comboCount = Math.max(0, Math.floor(toSafeNum(getOwn(orderState, 'comboCount', 0), 0)));
      const comboTimer = Math.max(0, toSafeNum(getOwn(orderState, 'comboTimer', 0), 0));
      const comboWindow = SERVE_COMBO_WINDOW_SEC || 8.0;
      const comboActive = comboCount >= 2 && comboTimer > 0;
      const comboBroken = Boolean(animState && toSafeNum(getOwn(animState, 'comboBreakTimer', 0), 0) > 0);
      const multLen = Math.max(1, safeArrayLen(SERVE_COMBO_MULTS, 16));
      const multIdx = clamp(comboCount - 1, 0, multLen - 1);
      const comboMult = SERVE_COMBO_MULTS[multIdx] || 1.0;

      // Orange-gold Combo Pill (with cute cat-ear glow peak when active)
      ctx.save();
      try {
        if (comboActive) {
          ctx.shadowColor = 'rgba(245, 184, 65, 0.55)';
          ctx.shadowBlur = 8;
        }
        const cg = safeLinearGradient(ctx, rx, statusY, rx, statusY + statusH, '#F27C38');
        if (comboBroken) {
          safeAddColorStop(cg, 0, '#8A847D', '#8A847D');
          safeAddColorStop(cg, 1, '#66605A', '#66605A');
        } else if (comboActive) {
          safeAddColorStop(cg, 0, '#FFD466', '#FFD466');
          safeAddColorStop(cg, 1, '#F27C38', '#F27C38');
        } else {
          safeAddColorStop(cg, 0, '#8A5A3A', '#8A5A3A');
          safeAddColorStop(cg, 1, '#633E26', '#633E26');
        }
        ctx.fillStyle = cg;
        UI.roundRectPath(ctx, rx, statusY, comboW, statusH, statusH * 0.5);
        ctx.fill();
        ctx.shadowColor = 'rgba(0, 0, 0, 0)';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = comboActive ? '#FFE885' : '#3D2417';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        if (comboActive) {
          const cRatio = clamp(comboTimer / comboWindow, 0, 1);
          ctx.fillStyle = 'rgba(255, 250, 210, 0.45)';
          UI.roundRectPath(ctx, rx + 5, statusY + statusH - 3.6, Math.max(4, (comboW - 10) * cRatio), 2.2, 1.1);
          ctx.fill();
        }
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      const comboText = comboActive
        ? `${comboCount}连 ×${comboMult.toFixed(2)}`
        : comboBroken
        ? '连击中断'
        : '连击待发';
      UI.drawOutlinedText(ctx, comboText, rx + comboW * 0.5, statusY + statusH * 0.5 + 0.4, {
        size: comboActive ? 11.4 : 9.8,
        minSize: 8.2,
        weight: 900,
        fill: comboActive ? '#FFF9E0' : '#EEDCC4',
        stroke: '#5A3928',
        strokeWidth: comboActive ? 2.4 : 1.8,
        shadowOffsetY: 0,
        maxWidth: comboW - 10
      });

      // Purple-to-Gold Starlight Fever Bar (`#B56CF5 -> #F5B841`, Design 03)
      const feverTimer = Math.max(0, toSafeNum(getOwn(orderState, 'feverTimer', 0), 0));
      const feverActive = Boolean(getOwn(orderState, 'feverActive', false) || feverTimer > 0);
      const feverEnergy = clamp(toSafeNum(getOwn(orderState, 'feverEnergy', 0), 0), 0, 100);
      const fRatio = feverActive
        ? clamp(feverTimer / (FEVER_CONFIG.durationSec || 10), 0, 1)
        : clamp(feverEnergy / 100, 0, 1);

      ctx.save();
      try {
        ctx.fillStyle = '#4A2E24';
        UI.roundRectPath(ctx, feverX, statusY, feverW, statusH, statusH * 0.5);
        ctx.fill();

        if (fRatio > 0) {
          const fg = safeLinearGradient(ctx, feverX, statusY, feverX + feverW, statusY, '#B56CF5');
          if (feverActive) {
            safeAddColorStop(fg, 0, '#C57BFF', '#C57BFF');
            safeAddColorStop(fg, 0.55, '#F58BBF', '#F58BBF');
            safeAddColorStop(fg, 1, '#FFE278', '#FFE278');
          } else {
            safeAddColorStop(fg, 0, '#9B6CF0', '#9B6CF0');
            safeAddColorStop(fg, 0.58, '#D27EE2', '#D27EE2');
            safeAddColorStop(fg, 1, '#F5B841', '#F5B841');
          }
          ctx.fillStyle = fg;
          UI.roundRectPath(
            ctx,
            feverX + 1.8,
            statusY + 1.8,
            Math.max(8, (feverW - 3.6) * fRatio),
            statusH - 3.6,
            (statusH - 3.6) * 0.5
          );
          ctx.fill();
        }

        ctx.strokeStyle = feverActive ? '#FFE885' : '#5A3928';
        ctx.lineWidth = 2.0;
        UI.roundRectPath(ctx, feverX, statusY, feverW, statusH, statusH * 0.5);
        ctx.stroke();
      } finally {
        try { ctx.restore(); } catch (_) {}
      }

      const feverLabel = feverActive
        ? `星光热潮 ×${(FEVER_CONFIG.scoreMult || 1.25).toFixed(2)}  ${Math.ceil(feverTimer)}s`
        : `星光热潮   ${Math.round(feverEnergy)}%`;
      UI.drawOutlinedText(ctx, feverLabel, feverX + feverW * 0.5, statusY + statusH * 0.5 + 0.5, {
        size: 10.6,
        minSize: 8.2,
        weight: 900,
        fill: '#FFF8EC',
        stroke: '#5A3928',
        strokeWidth: 2.2,
        shadowOffsetY: 0,
        maxWidth: feverW - 14
      });
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
        const srcCell = hasGsRow ? getOwn(gsRow, c, null) : null;
        if (isPlainObj(srcCell)) {
          cType = normalizeCellType(getOwn(srcCell, 'type', 'normal'));
          const rawTile = getOwn(srcCell, 'tile', null);
          tile = isPlainObj(rawTile) ? rawTile : null;
        } else if (hasLtRow) {
          const rawLt = getOwn(ltRow, c, 'normal');
          cType = typeof rawLt === 'string' ? rawLt : 'normal';
        }
        safePush(rowArr, { r, c, type: cType, tile });
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

    // Pass 1A: Shaped outer wooden/sakura/moonlight frame union over NON-VOID cells only
    const outerRad = Math.round(cellSize * 0.22) + bezelPad;
    const frameStops =
      safeIsArray(themeObj.frameStops) && safeArrayLen(themeObj.frameStops, 16) >= 3
        ? themeObj.frameStops
        : ['#d59c3b', '#ad7424', '#8c5a18'];

    ctx.save();
    try {
      const frameGrad = safeLinearGradient(
        ctx,
        layout.gridX,
        layout.gridY - bezelPad,
        layout.gridX,
        layout.gridY + layout.gridH + bezelPad,
        '#d59c3b'
      );
      safeAddColorStop(frameGrad, 0, getOwn(frameStops, 0, '#d59c3b'), '#d59c3b');
      safeAddColorStop(frameGrad, 0.52, getOwn(frameStops, 1, '#ad7424'), '#ad7424');
      safeAddColorStop(frameGrad, 1, getOwn(frameStops, 2, '#8c5a18'), '#8c5a18');

      // Outer drop lip + frame stroke per non-void cell
      ctx.fillStyle = 'rgba(26, 12, 5, 0.30)';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cellsMatrix[r][c].type === 'void') continue;
          const sx = layout.gridX + c * cellSize;
          const sy = layout.gridY + r * cellSize;
          UI.roundRectPath(
            ctx,
            sx - bezelPad,
            sy - bezelPad + 3,
            cellSize + bezelPad * 2,
            cellSize + bezelPad * 2,
            outerRad
          );
          ctx.fill();
        }
      }

      ctx.fillStyle = frameGrad;
      ctx.strokeStyle = safeColor(themeObj.frameBorder, '#4A2C2A');
      ctx.lineWidth = 2.4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cellsMatrix[r][c].type === 'void') continue;
          const sx = layout.gridX + c * cellSize;
          const sy = layout.gridY + r * cellSize;
          UI.roundRectPath(
            ctx,
            sx - bezelPad,
            sy - bezelPad,
            cellSize + bezelPad * 2,
            cellSize + bezelPad * 2,
            outerRad
          );
          ctx.fill();
          ctx.stroke();
        }
      }
      // Second fill pass without stroke merges interior frame seams cleanly
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cellsMatrix[r][c].type === 'void') continue;
          const sx = layout.gridX + c * cellSize;
          const sy = layout.gridY + r * cellSize;
          UI.roundRectPath(
            ctx,
            sx - bezelPad + 1.2,
            sy - bezelPad + 1.2,
            cellSize + bezelPad * 2 - 2.4,
            cellSize + bezelPad * 2 - 2.4,
            Math.max(4, outerRad - 1.2)
          );
          ctx.fill();
        }
      }

      // Pass 1B: Recessed carved board bed over NON-VOID cells only
      const bedGrad = safeLinearGradient(
        ctx,
        layout.gridX,
        layout.gridY,
        layout.gridX,
        layout.gridY + layout.gridH,
        '#243B4A'
      );
      safeAddColorStop(bedGrad, 0, themeObj.boardBgTop, '#243B4A');
      safeAddColorStop(bedGrad, 1, themeObj.boardBgBot, '#182834');
      ctx.fillStyle = bedGrad;
      const bedRad = Math.round(cellSize * 0.20) + 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cellsMatrix[r][c].type === 'void') continue;
          const sx = layout.gridX + c * cellSize;
          const sy = layout.gridY + r * cellSize;
          UI.roundRectPath(ctx, sx - 2, sy - 2, cellSize + 4, cellSize + 4, bedRad);
          ctx.fill();
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

    // Pass 2: Individual Playable Cushions, Obstacle Blocks, Special Cell Overlays, Rings & Tool Aiming
    const cushionRad = Math.max(5, Math.round(cw * 0.18));
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

        if (cell.type === 'block') {
          UI.drawBoardTileOverlay(ctx, sprites, 'tile_block', cx0, cy0, cw, { alpha: 1.0 });
          continue;
        }

        // Playable cell cushion ('normal' | 'gold' | 'matcha' | 'berry')
        ctx.save();
        try {
          ctx.fillStyle =
            (r + c) % 2 === 0
              ? themeObj.cellFill || 'rgba(255, 244, 218, 0.88)'
              : themeObj.cellFillAlt || 'rgba(250, 236, 202, 0.88)';
          UI.roundRectPath(ctx, cx0, cy0, cw, cw, cushionRad);
          ctx.fill();

          ctx.strokeStyle = themeObj.cellInnerSheen || 'rgba(255, 252, 240, 0.65)';
          ctx.lineWidth = 1.1;
          UI.roundRectPath(ctx, cx0 + 1.2, cy0 + 1.2, cw - 2.4, cw - 2.4, Math.max(3, cushionRad - 1));
          ctx.stroke();

          ctx.strokeStyle = themeObj.cellBorder || '#C69552';
          ctx.lineWidth = 1.4;
          UI.roundRectPath(ctx, cx0, cy0, cw, cw, cushionRad);
          ctx.stroke();
        } finally {
          try {
            ctx.restore();
          } catch (_) {}
        }

        if (cell.type === 'matcha') {
          ctx.save();
          try {
            ctx.fillStyle = 'rgba(125, 168, 92, 0.13)';
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
            { alpha: 0.90 }
          );
          if (guideTargets) safePush(guideCellTypes.matcha, cellRect);
        } else if (cell.type === 'berry') {
          ctx.save();
          try {
            ctx.fillStyle = 'rgba(232, 106, 140, 0.13)';
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
            { alpha: 0.90 }
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
              ctx.fillStyle = `rgba(255, 214, 78, ${(0.15 + 0.13 * pulse).toFixed(3)})`;
              UI.roundRectPath(ctx, cx0 + 1, cy0 + 1, cw - 2, cw - 2, cushionRad);
              ctx.fill();

              if (matchesPref) {
                ctx.strokeStyle = '#FFB014';
                ctx.lineWidth = 2.8;
                UI.roundRectPath(ctx, cx0 + 0.5, cy0 + 0.5, cw - 1, cw - 1, cushionRad);
                ctx.stroke();

                ctx.strokeStyle = `rgba(255, 240, 140, ${(0.78 + 0.22 * pulse).toFixed(3)})`;
                ctx.lineWidth = 1.8;
                UI.roundRectPath(ctx, cx0 - 2, cy0 - 2, cw + 4, cw + 4, cushionRad + 2);
                ctx.stroke();

                ctx.fillStyle = '#FFF4A8';
                UI.drawStar(ctx, cx0 + 5, cy0 + 5, Math.max(2.6, cellSize * 0.06), nowSec * 2.5);
              } else {
                ctx.strokeStyle = `rgba(242, 168, 24, ${(0.72 + 0.26 * pulse).toFixed(3)})`;
                ctx.lineWidth = 2.4;
                UI.roundRectPath(ctx, cx0 + 0.5, cy0 + 0.5, cw - 1, cw - 1, cushionRad);
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

        // Mandatory M1 rule: draw tile_ice over frozenHp > 0 Cat-Cakes at globalAlpha = 0.58
        if (tileFrozenHp > 0) {
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
