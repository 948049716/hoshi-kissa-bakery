/**
 * Canvas 2D Storybook UI Design System, Drawing Primitives, Safe Geometry Helpers,
 * CJK Text Wrapping, Atlas Icon Renderer, Unified Cards/Banners & Hit Registry.
 */
'use strict';

const {
  CATCAKE_MAP,
  CUSTOMER_MAP,
  CUSTOMERS_ATLAS_RECTS,
  BOARD_TILES_ATLAS_RECTS,
  UI_ATLAS_RECTS,
  UI_ATLAS_2_RECTS,
  UI_ATLAS_3_RECTS
} = require('./constants');

const OWN_PROP = Object.prototype.hasOwnProperty;

function hasOwnProp(obj, key) {
  try {
    return Boolean(
      obj &&
        (typeof obj === 'object' || typeof obj === 'function') &&
        OWN_PROP.call(obj, key)
    );
  } catch (_) {
    return false;
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

function safeArrayLen(arr, maxCap = 4096) {
  if (!safeIsArray(arr)) return 0;
  try {
    const len = Number(arr.length);
    if (!Number.isFinite(len) || len <= 0) return 0;
    const intLen = Math.floor(len);
    return maxCap > 0 ? Math.min(intLen, maxCap) : intLen;
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
  if (i !== idx || (!hasOwnProp(arr, i) && !safeIsExtensible(arr))) return false;
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

function getOwnProp(obj, key, fallback = undefined) {
  if (!hasOwnProp(obj, key)) return fallback;
  try {
    const val = obj[key];
    return val === undefined ? fallback : val;
  } catch (_) {
    return fallback;
  }
}

function toSafeNum(val, fallback = 0) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (val === null || val === undefined) return fallback;
  const t = typeof val;
  if (t === 'symbol' || t === 'bigint' || t === 'boolean' || t === 'function') {
    return fallback;
  }
  if (t === 'string') {
    const s = val.trim();
    if (s === '') return fallback;
    const parsed = Number(s);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (safeIsArray(val)) return fallback;
  try {
    const prim = typeof val.valueOf === 'function' ? val.valueOf() : NaN;
    if (typeof prim === 'number' && Number.isFinite(prim)) return prim;
    if (typeof prim === 'string' && prim.trim() !== '') {
      const parsed = Number(prim.trim());
      return Number.isFinite(parsed) ? parsed : fallback;
    }
  } catch (_) {
    return fallback;
  }
  return fallback;
}

function toFiniteNumber(val, fallback) {
  return toSafeNum(val, fallback);
}

function toSafeText(val, fallback = '') {
  const fb = typeof fallback === 'string' ? fallback : '';
  if (val === null || val === undefined) return fb;
  const t = typeof val;
  if (t === 'string') return val;
  if (t === 'number') return Number.isFinite(val) ? String(val) : fb;
  if (t === 'boolean') return val ? 'true' : 'false';
  if (t === 'bigint') return val.toString();
  if (t === 'symbol' || t === 'function') return fb;
  try {
    const s = String(val);
    return typeof s === 'string' ? s : fb;
  } catch (_) {
    return fb;
  }
}

const SAFE_HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_RGB_COLOR_RE =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d+(?:\.\d+)?|\.\d+))?\s*\)$/i;

function isValidCssColor(c) {
  if (typeof c !== 'string' || c.length > 128) return false;
  const s = c.trim();
  if (!s || /hsla?\s*\(/i.test(s)) return false;
  if (SAFE_HEX_COLOR_RE.test(s)) return true;
  const m = SAFE_RGB_COLOR_RE.exec(s);
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

function safeColor(c, fallback = '#4A2C2A') {
  if (isValidCssColor(c)) return c.trim();
  return isValidCssColor(fallback) ? fallback.trim() : '#4A2C2A';
}

function safeAddColorStop(grad, offset, color, fallbackColor) {
  try {
    if (!grad || typeof grad.addColorStop !== 'function') return;
    const off = Math.max(0, Math.min(1, toSafeNum(offset, 0)));
    const chosen = isValidCssColor(color)
      ? color.trim()
      : isValidCssColor(fallbackColor)
      ? fallbackColor.trim()
      : '#fffdf8';
    grad.addColorStop(off, chosen);
  } catch (_) {
    try {
      if (grad && typeof grad.addColorStop === 'function') {
        grad.addColorStop(
          Math.max(0, Math.min(1, toSafeNum(offset, 0))),
          isValidCssColor(fallbackColor) ? fallbackColor.trim() : '#fffdf8'
        );
      }
    } catch (__) {}
  }
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

function isPathCtx(ctx) {
  try {
    return Boolean(
      ctx &&
        typeof ctx === 'object' &&
        typeof ctx.beginPath === 'function' &&
        typeof ctx.moveTo === 'function'
    );
  } catch (_) {
    return false;
  }
}

function isMeasureCtx(ctx) {
  try {
    return Boolean(ctx && typeof ctx === 'object' && typeof ctx.measureText === 'function');
  } catch (_) {
    return false;
  }
}

function safeSave(ctx) {
  try {
    ctx.save();
    return true;
  } catch (_) {
    return false;
  }
}

function safeRestore(ctx) {
  try {
    ctx.restore();
  } catch (_) {}
}

function safeLinearGradient(ctx, x0, y0, x1, y1, fallback = '#fffdf8') {
  try {
    if (!ctx || typeof ctx.createLinearGradient !== 'function') {
      return safeColor(fallback, '#fffdf8');
    }
    const sx0 = toSafeNum(x0, 0);
    const sy0 = toSafeNum(y0, 0);
    const sx1 = toSafeNum(x1, 0);
    const sy1 = toSafeNum(y1, 1);
    const g = ctx.createLinearGradient(sx0, sy0, sx1, sy1);
    return g || safeColor(fallback, '#fffdf8');
  } catch (_) {
    return safeColor(fallback, '#fffdf8');
  }
}

function safeRadialGradient(ctx, x0, y0, r0, x1, y1, r1, fallback = '#fffdf8') {
  try {
    if (!ctx || typeof ctx.createRadialGradient !== 'function') {
      return safeColor(fallback, '#fffdf8');
    }
    const sx0 = toSafeNum(x0, 0);
    const sy0 = toSafeNum(y0, 0);
    const sr0 = Math.max(0, toSafeNum(r0, 0));
    const sx1 = toSafeNum(x1, 0);
    const sy1 = toSafeNum(y1, 0);
    const sr1 = Math.max(0.001, toSafeNum(r1, 1));
    const g = ctx.createRadialGradient(sx0, sy0, sr0, sx1, sy1, sr1);
    return g || safeColor(fallback, '#fffdf8');
  } catch (_) {
    return safeColor(fallback, '#fffdf8');
  }
}

function safeMeasureWidth(ctx, str) {
  try {
    if (!ctx || typeof ctx.measureText !== 'function') return 0;
    const m = ctx.measureText(str);
    if (!m || typeof m !== 'object') return 0;
    const hasOwnW = hasOwnProp(m, 'width');
    if (!hasOwnW && Object.getPrototypeOf(m) === Object.prototype) return 0;
    const w = toSafeNum(m.width, 0);
    return w > 0 ? w : 0;
  } catch (_) {
    return 0;
  }
}

function hasSafeImageProp(img, key) {
  if (!img || (typeof img !== 'object' && typeof img !== 'function')) return false;
  try {
    if (OWN_PROP.call(img, key)) return true;
    let proto = Object.getPrototypeOf(img);
    let depth = 0;
    while (
      proto &&
      proto !== Object.prototype &&
      proto !== Array.prototype &&
      proto !== Function.prototype &&
      depth < 16
    ) {
      if (OWN_PROP.call(proto, key)) return true;
      proto = Object.getPrototypeOf(proto);
      depth++;
    }
    if (key in img && !OWN_PROP.call(Object.prototype, key)) {
      return true;
    }
  } catch (_) {}
  return false;
}

function readImageProp(img, key) {
  if (!hasSafeImageProp(img, key)) return undefined;
  try {
    return img[key];
  } catch (_) {
    return undefined;
  }
}

function getReadyImageDims(img) {
  if (!img || typeof img !== 'object') return null;
  try {
    const rawComplete = readImageProp(img, 'complete');
    if (rawComplete === false) return null;

    const rawNw = readImageProp(img, 'naturalWidth');
    const rawNh = readImageProp(img, 'naturalHeight');
    if (rawNw !== undefined && rawNw !== null && !(toSafeNum(rawNw, 0) > 0)) return null;
    if (rawNh !== undefined && rawNh !== null && !(toSafeNum(rawNh, 0) > 0)) return null;

    const nw = toSafeNum(rawNw, 0);
    const nh = toSafeNum(rawNh, 0);
    const w = toSafeNum(readImageProp(img, 'width'), 0) || nw;
    const h = toSafeNum(readImageProp(img, 'height'), 0) || nh;
    if (!(w > 0 && h > 0)) return null;

    const isDomImg = typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement;
    if (isDomImg && !(nw > 0 && nh > 0)) {
      return null;
    }
    return { w, h };
  } catch (_) {
    return null;
  }
}

function isReadyImage(img) {
  return Boolean(getReadyImageDims(img));
}

function safeDrawImage(ctx, ...args) {
  try {
    if (!ctx || typeof ctx.drawImage !== 'function') return false;
    ctx.drawImage(...args);
    return true;
  } catch (_) {
    return false;
  }
}

function resolveBoardTilesAtlas(sprites) {
  if (!sprites || typeof sprites !== 'object') return null;
  const img =
    getOwnProp(sprites, 'boardTilesAtlas', null) ||
    getOwnProp(sprites, 'board_tiles_atlas', null) ||
    null;
  return isReadyImage(img) ? img : null;
}

function resolveCustomersAtlas(sprites) {
  if (!sprites || typeof sprites !== 'object') return null;
  const img =
    getOwnProp(sprites, 'customersAtlas', null) ||
    getOwnProp(sprites, 'customers_atlas', null) ||
    null;
  return isReadyImage(img) ? img : null;
}

function resolveByIdSprite(sprites, id) {
  if (!sprites || typeof sprites !== 'object' || typeof id !== 'string' || !id) return null;
  const byId = getOwnProp(sprites, 'byId', null);
  const direct =
    (byId && typeof byId === 'object' ? getOwnProp(byId, id, null) : null) ||
    getOwnProp(sprites, id, null) ||
    null;
  return isReadyImage(direct) ? direct : null;
}

function resolveCatcakeImage(sprites, tier, happy = false) {
  if (!sprites || typeof sprites !== 'object') return null;
  const t = normalizeCatcakeTier(tier);
  if (!t) return null;
  const cKey = `C${t}`;
  if (happy) {
    const happyMap = getOwnProp(sprites, 'catcakesHappy', null);
    const hImg =
      (happyMap &&
        typeof happyMap === 'object' &&
        (getOwnProp(happyMap, String(t), null) || getOwnProp(happyMap, cKey, null))) ||
      resolveByIdSprite(sprites, `catcake_${t}_happy`) ||
      null;
    if (isReadyImage(hImg)) return hImg;
  }
  const baseMap = getOwnProp(sprites, 'catcakes', null);
  const bImg =
    (baseMap &&
      typeof baseMap === 'object' &&
      (getOwnProp(baseMap, String(t), null) || getOwnProp(baseMap, cKey, null))) ||
    resolveByIdSprite(sprites, `catcake_${t}`) ||
    null;
  return isReadyImage(bImg) ? bImg : null;
}

const FONT_FAMILY = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';

// Unified Starlight Kissa Palette Tokens
const KISSA_THEME = {
  ink: '#5A3928',
  inkSoft: '#754C36',
  inkMuted: '#99735B',
  creamLight: '#FFF8EC',
  creamMid: '#F7EAD2',
  creamDeep: '#F2E2C4',
  borderWarm: '#8A5634',
  brassLight: '#FFD466',
  brassMid: '#F5A623',
  brassDark: '#C87A1E'
};

const MAX_FONT_PX = 256;
const MAX_WRAP_CHARS = 4096;
const MAX_WRAP_LINES = 128;

function fontStr(px, weight = 700) {
  const safePx = Math.min(MAX_FONT_PX, Math.max(1, Math.round(toSafeNum(px, 12))));
  const safeWeight =
    typeof weight === 'number'
      ? Number.isFinite(weight)
        ? Math.min(1000, Math.max(1, Math.round(weight)))
        : 700
      : typeof weight === 'string' && weight.trim()
      ? weight.trim().slice(0, 32)
      : 700;
  const activeFam =
    module.exports && typeof module.exports.getFontFamily === 'function'
      ? module.exports.getFontFamily()
      : FONT_FAMILY;
  return `${safeWeight} ${safePx}px ${activeFam}`;
}

function sanitizeFontSpec(font) {
  if (typeof font === 'number') {
    return fontStr(font, 700);
  }
  if (typeof font !== 'string') return '';
  const trimmed = font.trim();
  if (!trimmed) return '';
  if (trimmed.length > 256) return fontStr(12, 700);
  return trimmed.replace(/(\d+(?:\.\d+)?)px/gi, (_, numStr) => {
    const n = Number(numStr);
    const clamped = Number.isFinite(n) ? Math.min(MAX_FONT_PX, Math.max(1, Math.round(n))) : 12;
    return `${clamped}px`;
  });
}

function fitFontPx(ctx, text, maxWidth, startPx, minPx, weight) {
  const minFs = Math.min(MAX_FONT_PX, Math.max(1, minPx));
  let fs = Math.min(MAX_FONT_PX, Math.max(1, startPx));
  if (!(fs > minFs)) {
    ctx.font = fontStr(fs, weight);
    return fs;
  }
  if (fs > 64 && fs > maxWidth) {
    const probeFs = Math.max(minFs, Math.min(48, Math.ceil(maxWidth)));
    if (probeFs < fs) {
      ctx.font = fontStr(probeFs, weight);
      const wProbe = safeMeasureWidth(ctx, text);
      if (wProbe > maxWidth) {
        if (probeFs <= minFs) return minFs;
        fs = probeFs;
      }
    }
  }
  ctx.font = fontStr(fs, weight);
  const w0 = safeMeasureWidth(ctx, text);
  if (!(fs > minFs && w0 > maxWidth)) {
    return fs;
  }
  if (fs - minFs > 8 && w0 > 0) {
    const ratioEst = Math.floor(((fs * maxWidth) / w0) * 2) * 0.5;
    let est = Math.max(minFs, Math.min(fs - 0.5, ratioEst));
    ctx.font = fontStr(est, weight);
    if (safeMeasureWidth(ctx, text) <= maxWidth) {
      let growSteps = 0;
      while (est + 0.5 <= fs && growSteps < 8) {
        ctx.font = fontStr(est + 0.5, weight);
        if (safeMeasureWidth(ctx, text) <= maxWidth) {
          est += 0.5;
          growSteps++;
        } else {
          break;
        }
      }
      fs = est;
    } else {
      let lo = minFs;
      let hi = est;
      for (let iter = 0; iter < 9; iter++) {
        const mid = Math.floor((lo + hi) * 0.5 * 2) * 0.5;
        if (mid <= lo || mid >= hi) break;
        ctx.font = fontStr(mid, weight);
        if (safeMeasureWidth(ctx, text) <= maxWidth) lo = mid;
        else hi = mid;
      }
      fs = lo;
    }
    ctx.font = fontStr(fs, weight);
  }
  let shrinkSteps = 0;
  while (fs > minFs && shrinkSteps < 24 && safeMeasureWidth(ctx, text) > maxWidth) {
    fs = Math.max(minFs, fs - 0.5);
    ctx.font = fontStr(fs, weight);
    shrinkSteps++;
  }
  return fs;
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (!isPathCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = Math.max(0, toSafeNum(w, 0));
  const sh = Math.max(0, toSafeNum(h, 0));
  const maxR = Math.min(sw, sh) * 0.5;
  let tl, tr, br, bl;
  if (Array.isArray(r)) {
    tl = Math.max(0, Math.min(toSafeNum(r[0], 0), maxR));
    tr = Math.max(0, Math.min(toSafeNum(r[1], tl), maxR));
    br = Math.max(0, Math.min(toSafeNum(r[2], tl), maxR));
    bl = Math.max(0, Math.min(toSafeNum(r[3], tr), maxR));
  } else {
    const rad = Math.max(0, Math.min(toSafeNum(r, 0), maxR));
    tl = tr = br = bl = rad;
  }
  try {
    ctx.beginPath();
    ctx.moveTo(sx + tl, sy);
    ctx.lineTo(sx + sw - tr, sy);
    if (tr > 0) ctx.arcTo(sx + sw, sy, sx + sw, sy + tr, tr);
    else ctx.lineTo(sx + sw, sy);
    ctx.lineTo(sx + sw, sy + sh - br);
    if (br > 0) ctx.arcTo(sx + sw, sy + sh, sx + sw - br, sy + sh, br);
    else ctx.lineTo(sx + sw, sy + sh);
    ctx.lineTo(sx + bl, sy + sh);
    if (bl > 0) ctx.arcTo(sx, sy + sh, sx, sy + sh - bl, bl);
    else ctx.lineTo(sx, sy + sh);
    ctx.lineTo(sx, sy + tl);
    if (tl > 0) ctx.arcTo(sx, sy, sx + tl, sy, tl);
    else ctx.lineTo(sx, sy);
    ctx.closePath();
  } catch (_) {}
}

function fillEllipse(ctx, cx, cy, rx, ry) {
  if (!isCanvasCtx(ctx)) return;
  const scx = toSafeNum(cx, 0);
  const scy = toSafeNum(cy, 0);
  const srx = toSafeNum(rx, 0);
  const sry = toSafeNum(ry, 0);
  if (!(srx > 0 && sry > 0)) {
    try {
      ctx.beginPath();
    } catch (_) {}
    return;
  }
  if (!safeSave(ctx)) return;
  try {
    ctx.translate(scx, scy);
    ctx.scale(Math.max(0.01, srx), Math.max(0.01, sry));
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function drawStar(ctx, x, y, r, rot) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sr = toSafeNum(r, 0);
  if (!(sr > 0)) return;
  const srot = toSafeNum(rot, 0);
  if (!safeSave(ctx)) return;
  try {
    ctx.translate(sx, sy);
    ctx.rotate(srot);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? sr : sr * 0.42;
      if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function drawSakuraPetal(ctx, x, y, r, rot) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sr = toSafeNum(r, 0);
  if (!(sr > 0)) return;
  const srot = toSafeNum(rot, 0);
  if (!safeSave(ctx)) return;
  try {
    ctx.translate(sx, sy);
    ctx.rotate(srot);
    ctx.beginPath();
    ctx.moveTo(0, -sr * 1.15);
    ctx.bezierCurveTo(sr * 0.95, -sr * 0.65, sr * 0.85, sr * 0.75, 0, sr * 1.1);
    ctx.bezierCurveTo(-sr * 0.85, sr * 0.75, -sr * 0.95, -sr * 0.65, 0, -sr * 1.15);
    ctx.closePath();
    ctx.fill();
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function drawHeartIcon(ctx, x, y, size, color) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const ssize = toSafeNum(size, 0);
  if (!(ssize > 0)) return;
  if (!safeSave(ctx)) return;
  try {
    ctx.translate(sx, sy);
    ctx.fillStyle = safeColor(color, '#FF8FA8');
    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const s = ssize * 0.5;
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.35, -s * 0.1, -s * 0.75, -s * 1.2, 0, -s * 0.45);
    ctx.bezierCurveTo(s * 0.75, -s * 1.2, s * 1.35, -s * 0.1, 0, s * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function drawCoverImage(ctx, img, x, y, w, h, focusY = 0.5) {
  if (!isCanvasCtx(ctx)) return false;
  const dims = getReadyImageDims(img);
  if (!dims) return false;
  const dx = toSafeNum(x, 0);
  const dy = toSafeNum(y, 0);
  const dw = toSafeNum(w, 0);
  const dh = toSafeNum(h, 0);
  const fy = Math.max(0, Math.min(1, toSafeNum(focusY, 0.5)));
  if (!(dw > 0 && dh > 0)) return false;
  const iw = dims.w;
  const ih = dims.h;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = Math.max(0, (iw - sw) * 0.5);
  const sy = Math.max(0, Math.min(ih - sh, (ih - sh) * fy));
  return safeDrawImage(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawContainImageDims(ctx, img, dims, cx, cy, maxW, maxH) {
  const scx = toSafeNum(cx, 0);
  const scy = toSafeNum(cy, 0);
  const smw = toSafeNum(maxW, 0);
  const smh = toSafeNum(maxH, 0);
  if (!(smw > 0 && smh > 0)) return false;
  const iw = dims.w;
  const ih = dims.h;
  const scale = Math.min(smw / iw, smh / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return safeDrawImage(ctx, img, scx - dw * 0.5, scy - dh * 0.5, dw, dh);
}

function drawContainImage(ctx, img, cx, cy, maxW, maxH) {
  if (!isCanvasCtx(ctx)) return false;
  const dims = getReadyImageDims(img);
  if (!dims) return false;
  return drawContainImageDims(ctx, img, dims, cx, cy, maxW, maxH);
}

const V090_ICON_ALIAS_MAP = {
  // Dock & Shop / Compendium / Leaderboard / Theme
  icon_shop: 'dock_shop',
  dock_shop: 'dock_shop',
  shop_sign: 'dock_shop',
  icon_book: 'dock_compendium',
  dock_compendium: 'dock_compendium',
  icon_trophy: 'dock_rank',
  dock_rank: 'dock_rank',
  icon_ribbon: 'dock_theme',
  dock_theme: 'dock_theme',
  // HUD badges
  icon_stardust: 'icon_star_coin',
  icon_coin: 'icon_star_coin',
  icon_star_coin: 'icon_star_coin',
  icon_star_dim: 'icon_star_dim',
  icon_crown: 'icon_vip_crown',
  icon_vip_crown: 'icon_vip_crown',
  icon_hourglass: 'icon_clock',
  icon_clock: 'icon_clock',
  icon_lock: 'icon_lock',
  icon_bgm: 'icon_music',
  icon_music: 'icon_music',
  icon_sfx: 'icon_sfx',
  icon_paw_guide: 'icon_paw_marker',
  icon_paw_marker: 'icon_paw_marker',
  icon_check: 'icon_check',
  // Tools & Tray & Dough
  tool_fork: 'tool_swap_fork',
  tool_swap_fork: 'tool_swap_fork',
  tool_spoon: 'tool_upgrade_spoon',
  tool_upgrade_spoon: 'tool_upgrade_spoon',
  btn_knead: 'knead_dough',
  knead_dough: 'knead_dough',
  tool_dough: 'knead_dough',
  btn_trash: 'icon_trash',
  icon_trash: 'icon_trash',
  serve_bell: 'serving_plate',
  serving_plate: 'serving_plate',
  // Tiles & Flavors
  tile_block: 'tile_obstacle',
  tile_rock: 'tile_obstacle',
  tile_obstacle: 'tile_obstacle',
  tile_ice: 'tile_ice',
  tile_matcha: 'flavor_matcha',
  flavor_matcha: 'flavor_matcha',
  tile_berry: 'flavor_berry',
  tile_strawberry: 'flavor_berry',
  flavor_berry: 'flavor_berry',
  tile_gold: 'flavor_gold',
  flavor_gold: 'flavor_gold',
  // Devices & Themes
  device_tray: 'device_tray',
  device_flour: 'device_flour',
  icon_sieve: 'device_flour',
  device_teapot: 'device_teapot',
  device_rack: 'device_rack',
  icon_toolbox: 'device_rack',
  theme_amber: 'theme_amber',
  theme_sakura: 'theme_sakura',
  theme_moonlight: 'theme_moonlight',
  // Medals & Ribbon
  icon_medal_1: 'medal_gold',
  medal_gold: 'medal_gold',
  icon_medal_2: 'medal_silver',
  medal_silver: 'medal_silver',
  icon_medal_3: 'medal_bronze',
  medal_bronze: 'medal_bronze',
  result_ribbon: 'result_ribbon',
  // Patrons
  mikan: 'patron_mikan',
  chef_mikan: 'patron_mikan',
  patron_mikan: 'patron_mikan',
  mode_chef: 'patron_mikan',
  luna: 'patron_luna',
  patron_luna: 'patron_luna',
  icon_moon: 'patron_luna',
  mugi: 'patron_mugi',
  patron_mugi: 'patron_mugi',
  // Supplementary generated icons (10_补充素材/)
  icon_avatar_default: 'icon_avatar_default',
  icon_id_card: 'icon_avatar_default',
  icon_flame: 'icon_urgent_flame',
  icon_urgent_flame: 'icon_urgent_flame',
  icon_fever_badge: 'icon_fever_badge',
  icon_gift: 'icon_fever_badge',
  icon_cloud: 'icon_cloud_sync',
  icon_cloud_sync: 'icon_cloud_sync'
};

function drawCrispVectorControlIcon(ctx, iconKey, cx, cy, size, alpha = 1, rot = 0) {
  if (!safeSave(ctx)) return false;
  let ok = false;
  try {
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    const r = size * 0.38;

    if (iconKey === 'icon_pause') {
      const bw = Math.max(2.6, size * 0.19);
      const bh = Math.max(7, size * 0.56);
      const gap = Math.max(2.2, size * 0.14);
      ctx.fillStyle = '#FFF8EC';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(1.3, size * 0.08);
      for (const dir of [-1, 1]) {
        const rx = dir * (gap * 0.5 + bw * 0.5) - bw * 0.5;
        roundRectPath(ctx, rx, -bh * 0.5, bw, bh, bw * 0.45);
        ctx.fill();
        ctx.stroke();
      }
      ok = true;
    } else if (iconKey === 'icon_close') {
      const arm = size * 0.28;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(4.4, size * 0.28);
      ctx.beginPath();
      ctx.moveTo(-arm, -arm);
      ctx.lineTo(arm, arm);
      ctx.moveTo(arm, -arm);
      ctx.lineTo(-arm, arm);
      ctx.stroke();
      ctx.strokeStyle = '#FFF8EC';
      ctx.lineWidth = Math.max(2.4, size * 0.15);
      ctx.beginPath();
      ctx.moveTo(-arm, -arm);
      ctx.lineTo(arm, arm);
      ctx.moveTo(arm, -arm);
      ctx.lineTo(-arm, arm);
      ctx.stroke();
      ok = true;
    } else if (iconKey === 'icon_help') {
      const drawOut = module.exports && typeof module.exports.drawOutlinedText === 'function' ? module.exports.drawOutlinedText : null;
      if (drawOut) {
        drawOut(ctx, '?', 0, 1, {
          size: Math.max(12, Math.round(size * 0.85)),
          weight: 900,
          fill: '#FFF8EC',
          stroke: '#5A3928',
          strokeWidth: 2.6,
          shadowOffsetY: 0
        });
      } else {
        drawFitText(ctx, '?', 0, 1, size, size * 0.8, 10, 900, '#FFF8EC', 'center', 'middle');
      }
      ok = true;
    } else if (iconKey === 'icon_home') {
      ctx.fillStyle = '#FFF8EC';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(1.4, size * 0.085);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(r * 1.05, -r * 0.05);
      ctx.lineTo(r * 0.72, -r * 0.05);
      ctx.lineTo(r * 0.72, r * 0.88);
      ctx.lineTo(-r * 0.72, r * 0.88);
      ctx.lineTo(-r * 0.72, -r * 0.05);
      ctx.lineTo(-r * 1.05, -r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ok = true;
    } else if (iconKey === 'icon_restart') {
      ctx.strokeStyle = '#FFF8EC';
      ctx.lineWidth = Math.max(2.1, size * 0.13);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, -Math.PI * 0.8, Math.PI * 0.72, false);
      ctx.stroke();
      ctx.fillStyle = '#FFF8EC';
      ctx.beginPath();
      ctx.moveTo(-r * 0.86, -r * 0.35);
      ctx.lineTo(-r * 0.25, -r * 0.92);
      ctx.lineTo(-r * 0.14, -r * 0.22);
      ctx.closePath();
      ctx.fill();
      ok = true;
    } else if (iconKey === 'icon_arrow') {
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(2.2, size * 0.16);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.75);
      ctx.lineTo(r * 0.5, 0);
      ctx.lineTo(-r * 0.4, r * 0.75);
      ctx.stroke();
      ok = true;
    } else if (iconKey === 'icon_warn') {
      ctx.fillStyle = '#FFD466';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(1.4, size * 0.09);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.lineTo(r * 0.95, r * 0.82);
      ctx.lineTo(-r * 0.95, r * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5A3928';
      ctx.fillRect(-r * 0.12, -r * 0.34, r * 0.24, r * 0.62);
      ctx.beginPath();
      ctx.arc(0, r * 0.52, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ok = true;
    } else if (iconKey === 'icon_local_save') {
      ctx.fillStyle = '#FFE599';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(1.3, size * 0.085);
      roundRectPath(ctx, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.36);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(1.5, size * 0.10);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.38, 0);
      ctx.lineTo(-r * 0.08, r * 0.34);
      ctx.lineTo(r * 0.44, -r * 0.30);
      ctx.stroke();
      ok = true;
    }
  } catch (_) {
    ok = false;
  } finally {
    safeRestore(ctx);
  }
  return ok;
}

/**
 * Draw a storybook illustrated icon from v0.9.0 standalone WebP sprites (`sprites.byId`)
 * with full backward compatibility for all legacy icon keys and crisp vector controls.
 */
function drawUiIcon(ctx, sprites, iconKey, cx, cy, size, alpha = 1, rot = 0) {
  const safeSize = toSafeNum(size, 0);
  if (
    !isCanvasCtx(ctx) ||
    !sprites ||
    typeof sprites !== 'object' ||
    typeof iconKey !== 'string' ||
    !iconKey ||
    !(safeSize > 0)
  ) {
    return false;
  }
  const safeCx = toSafeNum(cx, 0);
  const safeCy = toSafeNum(cy, 0);
  const safeAlpha = Math.max(0, Math.min(1, toSafeNum(alpha, 1)));
  const safeRot = toSafeNum(rot, 0);

  if (
    iconKey === 'icon_pause' ||
    iconKey === 'icon_close' ||
    iconKey === 'icon_help' ||
    iconKey === 'icon_home' ||
    iconKey === 'icon_restart' ||
    iconKey === 'icon_arrow' ||
    iconKey === 'icon_warn' ||
    iconKey === 'icon_local_save'
  ) {
    return drawCrispVectorControlIcon(ctx, iconKey, safeCx, safeCy, safeSize, safeAlpha, safeRot);
  }

  if (iconKey === 'badge_matcha' || iconKey === 'badge_berry' || iconKey === 'badge_gold') {
    return drawFlavorBadge(ctx, sprites, iconKey.slice(6), safeCx, safeCy, safeSize, {
      alpha: safeAlpha,
      rot: safeRot
    });
  }

  const catMatch = /^(?:C([1-7])|catcake_([1-7])(_happy)?)$/.exec(iconKey);
  if (catMatch) {
    const tierNum = Number(catMatch[1] || catMatch[2]);
    const isHappy = Boolean(catMatch[3]);
    return drawCatcakeSprite(ctx, sprites, tierNum, safeCx, safeCy, safeSize, {
      happy: isHappy,
      alpha: safeAlpha,
      rot: safeRot,
      showFlavorBadge: false
    });
  }

  if (
    (CUSTOMERS_ATLAS_RECTS && hasOwnProp(CUSTOMERS_ATLAS_RECTS, iconKey)) ||
    iconKey === 'cust_orange_uncle' ||
    iconKey === 'cust_scholar' ||
    iconKey === 'cust_lop_bunny' ||
    iconKey === 'cust_vip_cat'
  ) {
    return drawCustomerPortrait(ctx, sprites, iconKey, safeCx, safeCy, safeSize, {
      circular: false,
      alpha: safeAlpha
    });
  }

  // 1. Direct v0.9.0 standalone WebP sprite lookup via alias map or exact key
  const mappedId = hasOwnProp(V090_ICON_ALIAS_MAP, iconKey) ? V090_ICON_ALIAS_MAP[iconKey] : iconKey;
  let standalone = resolveByIdSprite(sprites, mappedId) || resolveByIdSprite(sprites, iconKey);

  // Also check nested legacy buckets (`sprites.tools`, `sprites.patrons`, `sprites.devices`, `sprites.themes`)
  if (!standalone) {
    const toolsMap = getOwnProp(sprites, 'tools', null);
    const patronsMap = getOwnProp(sprites, 'patrons', null);
    const baseMap = getOwnProp(sprites, 'base', null);
    if (iconKey === 'tool_spoon' || iconKey === 'tool_upgrade_spoon') {
      standalone = toolsMap && typeof toolsMap === 'object' ? getOwnProp(toolsMap, 'spoon', null) : null;
    } else if (iconKey === 'tool_fork' || iconKey === 'tool_swap_fork') {
      standalone = toolsMap && typeof toolsMap === 'object' ? getOwnProp(toolsMap, 'fork', null) : null;
    } else if (iconKey === 'mikan' || iconKey === 'chef_mikan' || iconKey === 'patron_mikan') {
      standalone = patronsMap && typeof patronsMap === 'object' ? getOwnProp(patronsMap, 'mikan', null) : null;
    } else if (iconKey === 'luna' || iconKey === 'patron_luna') {
      standalone = patronsMap && typeof patronsMap === 'object' ? getOwnProp(patronsMap, 'luna', null) : null;
    } else if (iconKey === 'mugi' || iconKey === 'patron_mugi') {
      standalone = patronsMap && typeof patronsMap === 'object' ? getOwnProp(patronsMap, 'mugi', null) : null;
    } else if (iconKey.startsWith('tier_')) {
      const tNum = Number(iconKey.slice(5));
      standalone = baseMap && typeof baseMap === 'object' ? getOwnProp(baseMap, String(tNum), null) : null;
    }
  }

  const standaloneDims = getReadyImageDims(standalone);
  if (standaloneDims && safeSave(ctx)) {
    let drewStandalone = false;
    try {
      if (safeAlpha < 1) ctx.globalAlpha *= safeAlpha;
      ctx.translate(safeCx, safeCy);
      if (safeRot) ctx.rotate(safeRot);
      drewStandalone = drawContainImageDims(ctx, standalone, standaloneDims, 0, 0, safeSize, safeSize);
    } catch (_) {
      drewStandalone = false;
    } finally {
      safeRestore(ctx);
    }
    if (drewStandalone) return true;
  }

  // 2. Procedural fallback for board tile icons when sprite not yet loaded
  if (BOARD_TILES_ATLAS_RECTS && hasOwnProp(BOARD_TILES_ATLAS_RECTS, iconKey)) {
    drawProceduralBoardTileIcon(ctx, iconKey, safeCx, safeCy, safeSize, safeAlpha, safeRot);
    return true;
  }

  // 3. Legacy atlas fallback (only if a caller explicitly supplies old atlas sprites in a unit test)
  let rect = UI_ATLAS_RECTS && hasOwnProp(UI_ATLAS_RECTS, iconKey) ? getOwnProp(UI_ATLAS_RECTS, iconKey, null) : null;
  let atlas = getOwnProp(sprites, 'uiAtlas', null) || getOwnProp(sprites, 'ui_atlas', null);
  if (!rect && UI_ATLAS_2_RECTS && hasOwnProp(UI_ATLAS_2_RECTS, iconKey)) {
    rect = getOwnProp(UI_ATLAS_2_RECTS, iconKey, null);
    atlas = getOwnProp(sprites, 'uiAtlas2', null) || getOwnProp(sprites, 'ui_atlas_2', null);
  }
  if (!rect && UI_ATLAS_3_RECTS && hasOwnProp(UI_ATLAS_3_RECTS, iconKey)) {
    rect = getOwnProp(UI_ATLAS_3_RECTS, iconKey, null);
    atlas = getOwnProp(sprites, 'uiAtlas3', null) || getOwnProp(sprites, 'ui_atlas_3', null);
  }
  if (!rect || !isReadyImage(atlas) || !safeSave(ctx)) return false;

  let ok = false;
  try {
    if (safeAlpha < 1) ctx.globalAlpha *= safeAlpha;
    ctx.translate(safeCx, safeCy);
    if (safeRot) ctx.rotate(safeRot);
    ok = safeDrawImage(
      ctx,
      atlas,
      toSafeNum(getOwnProp(rect, 'x', 0), 0),
      toSafeNum(getOwnProp(rect, 'y', 0), 0),
      toSafeNum(getOwnProp(rect, 'w', 0), 0),
      toSafeNum(getOwnProp(rect, 'h', 0), 0),
      -safeSize * 0.5,
      -safeSize * 0.5,
      safeSize,
      safeSize
    );
  } catch (_) {
    ok = false;
  } finally {
    safeRestore(ctx);
  }
  return ok;
}

function drawWoodBoard(ctx, x, y, w, h, radius = 15, withRivets = true) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = toSafeNum(w, 0);
  const sh = toSafeNum(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const srad = Math.max(0, toSafeNum(radius, 15));

  if (safeSave(ctx)) {
    try {
      ctx.shadowColor = 'rgba(26, 12, 5, 0.38)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      const g = safeLinearGradient(ctx, sx, sy, sx, sy + sh, '#8b5429');
      safeAddColorStop(g, 0, '#be844c', '#be844c');
      safeAddColorStop(g, 0.52, '#8b5429', '#8b5429');
      safeAddColorStop(g, 1, '#683a19', '#683a19');
      ctx.fillStyle = g;
      roundRectPath(ctx, sx, sy, sw, sh, srad);
      ctx.fill();
    } catch (_) {} finally {
      safeRestore(ctx);
    }
  }

  if (!safeSave(ctx)) return;
  try {
    roundRectPath(ctx, sx, sy, sw, sh, srad);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#432418';
    ctx.stroke();

    // Inner warm brass-wood bevel sheen
    if (sw > 5 && sh > 5) {
      ctx.strokeStyle = 'rgba(255, 228, 174, 0.38)';
      ctx.lineWidth = 1.4;
      roundRectPath(ctx, sx + 2.2, sy + 2.2, sw - 4.4, sh - 4.4, Math.max(4, srad - 2));
      ctx.stroke();
    }

    if (Boolean(withRivets) && sw > 64) {
      const rivetR = sw < 220 ? 3.4 : 4.2;
      const ry = sy + 9;
      for (const rx of [sx + 12, sx + sw - 12]) {
        const rg = safeRadialGradient(ctx, rx - 1, ry - 1, 0.5, rx, ry, rivetR, '#fff0b3');
        safeAddColorStop(rg, 0, '#fff0b3', '#fff0b3');
        safeAddColorStop(rg, 1, '#a97023', '#a97023');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(rx, ry, rivetR, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#432418';
        ctx.stroke();
      }
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function drawParchmentSheet(
  ctx,
  x,
  y,
  w,
  h,
  radius = 11,
  topCol = '#fcf6e6',
  botCol = '#f2e2c1',
  borderCol = '#4A2C2A',
  lineWidth = 2
) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = toSafeNum(w, 0);
  const sh = toSafeNum(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const srad = Math.max(0, toSafeNum(radius, 11));
  const slw = toSafeNum(lineWidth, 2);

  if (!safeSave(ctx)) return;
  try {
    const g = safeLinearGradient(ctx, sx, sy, sx, sy + sh, '#fcf6e6');
    safeAddColorStop(g, 0, topCol, '#fcf6e6');
    safeAddColorStop(g, 1, botCol, '#f2e2c1');
    ctx.fillStyle = g;
    roundRectPath(ctx, sx, sy, sw, sh, srad);
    ctx.fill();

    // Subtle top inner parchment highlight for cohesive depth
    if (sh > 22 && sw > 24) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.1;
      roundRectPath(ctx, sx + 1.5, sy + 1.5, sw - 3, sh - 3, Math.max(3, srad - 1.5));
      ctx.stroke();
    }

    if (slw > 0) {
      roundRectPath(ctx, sx, sy, sw, sh, srad);
      ctx.lineWidth = slw;
      ctx.strokeStyle = safeColor(borderCol, '#4A2C2A');
      ctx.stroke();
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

/**
 * Unified Storybook Card surface used across Lobby, Shop, Prep Shop, Guide & Modals.
 */
function drawKissaCard(ctx, x, y, w, h, opts = {}) {
  if (!isCanvasCtx(ctx)) return;
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = toSafeNum(w, 0);
  const sh = toSafeNum(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const radius = Math.max(0, toSafeNum(getOwnProp(safeOpts, 'radius', 12), 12));
  const rawTone = getOwnProp(safeOpts, 'tone', 'cream');
  const tone = typeof rawTone === 'string' ? rawTone : 'cream'; // 'cream' | 'selected' | 'equipped' | 'amber' | 'soft'
  let topCol = '#fffdf8';
  let botCol = '#f7ead0';
  const optBorderCol = getOwnProp(safeOpts, 'borderColor', null);
  const optTopCol = getOwnProp(safeOpts, 'topCol', null);
  const optBotCol = getOwnProp(safeOpts, 'botCol', null);
  let borderCol = isValidCssColor(optBorderCol) ? optBorderCol.trim() : '#c59e68';
  let lipCol = 'rgba(138, 92, 42, 0.22)';
  let borderW = Math.max(0, toSafeNum(getOwnProp(safeOpts, 'lineWidth', 1.8), 1.8));

  if (tone === 'selected') {
    topCol = '#fff9e0';
    botCol = '#ffe394';
    borderCol = '#4A2C2A';
    lipCol = '#965d1c';
    borderW = 2.2;
  } else if (tone === 'equipped') {
    topCol = '#f2fbf0';
    botCol = '#d8efd2';
    borderCol = '#437a42';
    lipCol = 'rgba(56, 108, 54, 0.35)';
    borderW = 2.0;
  } else if (tone === 'amber') {
    topCol = '#fff8dc';
    botCol = '#fbe4a4';
    borderCol = isValidCssColor(optBorderCol) ? optBorderCol.trim() : '#c08424';
    lipCol = 'rgba(154, 96, 22, 0.26)';
  } else if (tone === 'soft') {
    topCol = 'rgba(255, 250, 238, 0.72)';
    botCol = 'rgba(244, 228, 198, 0.78)';
    borderCol = '#cca874';
    lipCol = null;
    borderW = 1.4;
  }

  if (!safeSave(ctx)) return;
  try {
    if (lipCol) {
      ctx.fillStyle = lipCol;
      roundRectPath(ctx, sx, sy + 2, sw, sh, radius);
      ctx.fill();
    }

    const g = safeLinearGradient(ctx, sx, sy, sx, sy + sh, topCol);
    safeAddColorStop(g, 0, optTopCol, topCol);
    safeAddColorStop(g, 1, optBotCol, botCol);
    ctx.fillStyle = g;
    roundRectPath(ctx, sx, sy, sw, sh, radius);
    ctx.fill();

    if (sh >= 26 && sw > 3) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.1;
      roundRectPath(ctx, sx + 1.5, sy + 1.5, sw - 3, sh - 3, Math.max(3, radius - 1.5));
      ctx.stroke();
    }

    if (borderW > 0) {
      roundRectPath(ctx, sx, sy, sw, sh, radius);
      ctx.lineWidth = borderW;
      ctx.strokeStyle = borderCol;
      ctx.stroke();
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

/**
 * Unified Micro-Badge / Tag Pill with optional leading illustrated icon.
 */
function drawTagBadge(ctx, x, y, w, h, text, tone = 'amber', fontSize = 9.5, icon = '', sprites = null) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = toSafeNum(w, 0);
  const sh = toSafeNum(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const safeText = toSafeText(text, '');
  const fs = Math.min(MAX_FONT_PX, Math.max(1, toSafeNum(fontSize, 9.5)));
  const safeIcon = typeof icon === 'string' ? icon : '';

  const palettes = {
    amber: { top: '#ffebb0', bot: '#f5c762', border: '#a8681c', text: '#5e2e08' },
    berry: { top: '#ff9685', bot: '#eb6b58', border: '#4A2C2A', text: '#fffdf8' },
    sage: { top: '#e4f5de', bot: '#bfe0b5', border: '#3c703a', text: '#214d20' },
    cocoa: { top: '#59331d', bot: '#3d2112', border: '#dfa855', text: '#ffefc8' },
    soft: { top: '#f6e8cc', bot: '#ead4ad', border: '#b89058', text: '#694127' },
    plum: { top: '#f8e6f0', bot: '#edd0e1', border: '#944a6d', text: '#632644' },
    frost: { top: '#e6f6fc', bot: '#cbe8f6', border: '#3f7896', text: '#1d4c66' }
  };
  const pal = (typeof tone === 'string' && hasOwnProp(palettes, tone) && palettes[tone]) || palettes.amber;
  const r = Math.min(sh * 0.5, 10);

  if (!safeSave(ctx)) return;
  try {
    const g = safeLinearGradient(ctx, sx, sy, sx, sy + sh, pal.top);
    safeAddColorStop(g, 0, pal.top, pal.top);
    safeAddColorStop(g, 1, pal.bot, pal.bot);
    ctx.fillStyle = g;
    roundRectPath(ctx, sx, sy, sw, sh, r);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = pal.border;
    ctx.stroke();

    let drewIcon = false;
    let icS = 0;
    if (safeIcon && sprites) {
      icS = Math.min(sh - 3, 13);
      drewIcon = drawUiIcon(ctx, sprites, safeIcon, sx + 5 + icS * 0.5, sy + sh * 0.5, icS);
    }
    if (drewIcon) {
      const tx = sx + 7 + icS;
      const tw = Math.max(12, sx + sw - tx - 4);
      drawFitText(ctx, safeText, tx + tw * 0.5, sy + sh * 0.5 + 0.4, tw, fs, 7.2, 800, pal.text, 'center', 'middle');
    } else {
      drawFitText(ctx, safeText, sx + sw * 0.5, sy + sh * 0.5 + 0.4, Math.max(1, sw - 8), fs, 7.5, 800, pal.text, 'center', 'middle');
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

/**
 * Unified Floating Notice / Toast / Skill Prompt Banner with semantic storybook tones.
 */
function drawNoticeBanner(ctx, x, y, w, h, opts = {}) {
  if (!isCanvasCtx(ctx)) return;
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = toSafeNum(w, 0);
  const sh = toSafeNum(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const r = Math.max(0, toSafeNum(getOwnProp(safeOpts, 'radius', Math.min(sh * 0.5, 15)), Math.min(sh * 0.5, 15)));
  const tonePalettes = {
    info: {
      top: 'rgba(62, 34, 19, 0.94)',
      bot: 'rgba(40, 21, 11, 0.96)',
      border: '#e5b45a',
      sheen: 'rgba(255, 232, 180, 0.22)',
      text: '#fff4d4'
    },
    success: {
      top: 'rgba(34, 84, 54, 0.95)',
      bot: 'rgba(22, 58, 36, 0.97)',
      border: '#9ae09e',
      sheen: 'rgba(214, 255, 220, 0.24)',
      text: '#f0ffef'
    },
    warn: {
      top: 'rgba(138, 42, 30, 0.95)',
      bot: 'rgba(98, 24, 18, 0.97)',
      border: '#ffb294',
      sheen: 'rgba(255, 220, 206, 0.24)',
      text: '#fff2ec'
    },
    event: {
      top: 'rgba(92, 46, 18, 0.96)',
      bot: 'rgba(58, 28, 12, 0.98)',
      border: '#ffe278',
      sheen: 'rgba(255, 244, 192, 0.30)',
      text: '#fff8db'
    }
  };
  const rawTone = getOwnProp(safeOpts, 'tone', 'info');
  const pal = (typeof rawTone === 'string' && hasOwnProp(tonePalettes, rawTone) && tonePalettes[rawTone]) || tonePalettes.info;
  const optBorder = getOwnProp(safeOpts, 'borderColor', null);
  const optTopCol = getOwnProp(safeOpts, 'topCol', null);
  const optBotCol = getOwnProp(safeOpts, 'botCol', null);
  const borderCol = isValidCssColor(optBorder) ? optBorder.trim() : pal.border;

  if (safeSave(ctx)) {
    try {
      ctx.shadowColor = 'rgba(18, 8, 3, 0.38)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3.5;
      const g = safeLinearGradient(ctx, sx, sy, sx, sy + sh, pal.top);
      safeAddColorStop(g, 0, optTopCol, pal.top);
      safeAddColorStop(g, 1, optBotCol, pal.bot);
      ctx.fillStyle = g;
      roundRectPath(ctx, sx, sy, sw, sh, r);
      ctx.fill();
    } catch (_) {} finally {
      safeRestore(ctx);
    }
  }

  if (!safeSave(ctx)) return;
  try {
    if (sh >= 20 && sw > 3) {
      roundRectPath(ctx, sx + 1.4, sy + 1.4, sw - 2.8, sh - 2.8, Math.max(3, r - 1.4));
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = pal.sheen;
      ctx.stroke();
    }
    roundRectPath(ctx, sx, sy, sw, sh, r);
    ctx.lineWidth = 1.9;
    ctx.strokeStyle = borderCol;
    ctx.stroke();

    let textLeft = sx + 11;
    const optIcon = getOwnProp(safeOpts, 'icon', '');
    const optSprites = getOwnProp(safeOpts, 'sprites', null);
    if (typeof optIcon === 'string' && optIcon && optSprites) {
      const icS = toSafeNum(getOwnProp(safeOpts, 'iconSize', Math.min(20, sh - 5)), Math.min(20, sh - 5));
      if (drawUiIcon(ctx, optSprites, optIcon, sx + 9 + icS * 0.5, sy + sh * 0.5, icS)) {
        textLeft = sx + 13 + icS;
      }
    }
    const rightPad = toSafeNum(getOwnProp(safeOpts, 'rightReserve', 11), 11);
    const bannerText = toSafeText(getOwnProp(safeOpts, 'text', ''), '');
    if (bannerText) {
      const availW = Math.max(24, sx + sw - rightPad - textLeft);
      const rawAlign = getOwnProp(safeOpts, 'align', null);
      const align = typeof rawAlign === 'string' ? rawAlign : (typeof optIcon === 'string' && optIcon ? 'left' : 'center');
      const tx = align === 'center' ? textLeft + availW * 0.5 : textLeft;
      const optTextCol = getOwnProp(safeOpts, 'textColor', null);
      drawFitText(
        ctx,
        bannerText,
        tx,
        sy + sh * 0.5 + 0.5,
        availW,
        Math.min(MAX_FONT_PX, Math.max(1, toSafeNum(getOwnProp(safeOpts, 'fontSize', 11.5), 11.5))),
        9,
        800,
        isValidCssColor(optTextCol) ? optTextCol.trim() : pal.text,
        align,
        'middle'
      );
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

/**
 * Unified Currency Capsule (Stardust `icon_stardust` or Recipe Coins `icon_coin`).
 */
function drawCurrencyChip(ctx, x, y, w, h, sprites, iconKey, valText, opts = {}) {
  if (!isCanvasCtx(ctx)) return;
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = toSafeNum(w, 0);
  const sh = toSafeNum(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const rawStyle = getOwnProp(safeOpts, 'style', 'wood');
  const style = typeof rawStyle === 'string' ? rawStyle : 'wood';
  const isDark = style === 'dark';
  drawPillButton(ctx, sx, sy, sw, sh, {
    style: isDark ? 'dark' : style,
    radius: sh * 0.5
  });
  const icS = Math.min(sh - 4, 22);
  const icCx = sx + 6 + icS * 0.5;
  const drew = drawUiIcon(ctx, sprites, iconKey, icCx, sy + sh * 0.5, icS);
  const tx = drew ? icCx + icS * 0.5 + 3 : sx + 8;
  const tw = Math.max(16, sx + sw - tx - 7);
  const safeVal = toSafeText(valText, '');
  drawFitText(
    ctx,
    safeVal,
    tx + tw * 0.5,
    sy + sh * 0.5 + 0.5,
    tw,
    Math.min(MAX_FONT_PX, Math.max(1, toSafeNum(getOwnProp(safeOpts, 'fontSize', 12), 12))),
    9,
    900,
    isDark ? '#fff2cf' : '#592e0d',
    'center',
    'middle'
  );
}

function drawPillButton(ctx, x, y, w, h, opts = {}) {
  if (!isCanvasCtx(ctx)) return;
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = toSafeNum(w, 0);
  const sh = toSafeNum(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const rawStyle = getOwnProp(safeOpts, 'style', 'wood');
  const style = typeof rawStyle === 'string' ? rawStyle : 'wood';
  const radius = Math.max(0, toSafeNum(getOwnProp(safeOpts, 'radius', Math.min(sh * 0.5, 16)), Math.min(sh * 0.5, 16)));
  const disabled = Boolean(getOwnProp(safeOpts, 'disabled', false));

  let topCol = '#fdf2da';
  let botCol = '#e9cd99';
  let borderCol = '#4A2C2A';
  let lipCol = '#6e401d';
  let textCol = '#4A2C2A';
  let sheenCol = 'rgba(255, 255, 255, 0.62)';
  let borderW = 2;

  if (style === 'cta') {
    topCol = '#ffe994';
    botCol = '#e39224';
    lipCol = '#8a4a10';
    textCol = '#421e08';
    sheenCol = 'rgba(255, 252, 224, 0.78)';
    borderW = 2.4;
  } else if (style === 'walnut') {
    topCol = '#9e6435';
    botCol = '#6d3e1c';
    borderCol = '#3d2010';
    lipCol = '#42210e';
    textCol = '#fff4dc';
    sheenCol = 'rgba(255, 226, 174, 0.34)';
    borderW = 2.1;
  } else if (style === 'active') {
    topCol = '#ffea9f';
    botCol = '#eeb44a';
    lipCol = '#7e4814';
    sheenCol = 'rgba(255, 252, 226, 0.72)';
  } else if (style === 'equipped') {
    topCol = '#e6f5df';
    botCol = '#bfe0b4';
    borderCol = '#386b35';
    lipCol = '#386b35';
    textCol = '#214d20';
    sheenCol = 'rgba(255, 255, 255, 0.65)';
  } else if (style === 'card') {
    topCol = '#fffdf8';
    botCol = '#f7ebd2';
    borderCol = '#c49d67';
    lipCol = 'rgba(138, 92, 42, 0.22)';
    borderW = 1.8;
  } else if (style === 'cardSelected') {
    topCol = '#fff8dc';
    botCol = '#ffdf88';
    borderCol = '#4A2C2A';
    lipCol = '#8d5518';
    borderW = 2.2;
  } else if (style === 'dark') {
    topCol = 'rgba(68, 38, 20, 0.94)';
    botCol = 'rgba(44, 24, 12, 0.96)';
    borderCol = '#d59f50';
    lipCol = 'rgba(22, 10, 4, 0.55)';
    textCol = '#fcecc9';
    sheenCol = 'rgba(255, 228, 172, 0.22)';
    borderW = 1.8;
  } else if (style === 'danger') {
    topCol = '#e85b4d';
    botCol = '#c2392c';
    borderCol = '#4A2C2A';
    lipCol = '#6b1812';
    textCol = '#ffffff';
    sheenCol = 'rgba(255, 226, 220, 0.38)';
  }

  const optIcon = getOwnProp(safeOpts, 'icon', '');
  const optSprites = getOwnProp(safeOpts, 'sprites', null);
  const hasIcon = Boolean(typeof optIcon === 'string' && optIcon && optSprites);
  let btnText = toSafeText(getOwnProp(safeOpts, 'text', ''), '');
  if (btnText.length > MAX_WRAP_CHARS) btnText = btnText.slice(0, MAX_WRAP_CHARS);
  let fbText = toSafeText(getOwnProp(safeOpts, 'fallbackText', ''), '');
  if (fbText.length > MAX_WRAP_CHARS) fbText = fbText.slice(0, MAX_WRAP_CHARS);
  const hasText = btnText.length > 0;
  const mutedSlash = Boolean(getOwnProp(safeOpts, 'mutedSlash', false));
  const optTextCol = getOwnProp(safeOpts, 'textColor', null);
  const resolvedTextCol = safeColor(optTextCol, textCol);

  if (!safeSave(ctx)) return;
  try {
    if (disabled) ctx.globalAlpha = 0.52;

    // 3D bevel bottom lip
    if (lipCol && !disabled) {
      ctx.fillStyle = lipCol;
      roundRectPath(ctx, sx, sy + 2.3, sw, sh, radius);
      ctx.fill();
    }

    const g = safeLinearGradient(ctx, sx, sy, sx, sy + sh, topCol);
    safeAddColorStop(g, 0, topCol, topCol);
    safeAddColorStop(g, 1, botCol, botCol);
    ctx.fillStyle = g;
    roundRectPath(ctx, sx, sy, sw, sh, radius);
    ctx.fill();

    // Inner top highlight sheen
    if (sheenCol && sh >= 18 && sw >= 18) {
      ctx.strokeStyle = sheenCol;
      ctx.lineWidth = 1.1;
      roundRectPath(ctx, sx + 1.5, sy + 1.4, sw - 3, sh - 2.8, Math.max(2, radius - 1.4));
      ctx.stroke();
    }

    roundRectPath(ctx, sx, sy, sw, sh, radius);
    ctx.lineWidth = borderW;
    ctx.strokeStyle = borderCol;
    ctx.stroke();

    if (hasIcon && !hasText) {
      const defIcS = Math.min(sw, sh) * 0.68;
      const icS = Math.max(0, toSafeNum(getOwnProp(safeOpts, 'iconSize', defIcS), defIcS));
      const drew = drawUiIcon(ctx, optSprites, optIcon, sx + sw * 0.5, sy + sh * 0.5, icS, mutedSlash ? 0.65 : 1);
      if (!drew && fbText) {
        const fbFs = Math.min(MAX_FONT_PX, Math.max(1, toSafeNum(getOwnProp(safeOpts, 'fontSize', 13), 13)));
        ctx.font = fontStr(fbFs, 800);
        ctx.fillStyle = resolvedTextCol;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (typeof ctx.fillText === 'function') {
          ctx.fillText(fbText, sx + sw * 0.5, sy + sh * 0.5 + 0.5);
        }
      }
      if (mutedSlash && icS > 0 && safeSave(ctx)) {
        try {
          ctx.strokeStyle = '#4A2C2A';
          ctx.lineWidth = 3.2;
          ctx.lineCap = 'round';
          const sl = icS * 0.34;
          ctx.beginPath();
          ctx.moveTo(sx + sw * 0.5 - sl, sy + sh * 0.5 - sl);
          ctx.lineTo(sx + sw * 0.5 + sl, sy + sh * 0.5 + sl);
          ctx.stroke();
          ctx.strokeStyle = '#ef6456';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } catch (_) {} finally {
          safeRestore(ctx);
        }
      }
    } else if (hasText) {
      const defaultFs = Math.min(MAX_FONT_PX, Math.max(11, Math.min(15, sh * 0.44)));
      const fs = Math.min(MAX_FONT_PX, Math.max(1, toSafeNum(getOwnProp(safeOpts, 'fontSize', defaultFs), defaultFs)));
      let curFs = fs;
      const rawWeight = getOwnProp(safeOpts, 'fontWeight', 800);
      const weight = typeof rawWeight === 'number' || typeof rawWeight === 'string' ? rawWeight : 800;
      const defIcS = Math.min(sh - 7, curFs * 1.42);
      const icS = hasIcon ? Math.max(0, toSafeNum(getOwnProp(safeOpts, 'iconSize', defIcS), defIcS)) : 0;
      const icGap = hasIcon ? 4.5 : 0;
      const maxTw = Math.max(12, sw - 12 - (hasIcon ? icS + icGap : 0));

      curFs = fitFontPx(ctx, btnText, maxTw, curFs, 8.5, weight);
      const tw = safeMeasureWidth(ctx, btnText);
      const totalW = (hasIcon ? icS + icGap : 0) + tw;
      const startX = sx + (sw - totalW) * 0.5;

      let drewIcon = false;
      if (hasIcon && icS > 0) {
        drewIcon = drawUiIcon(ctx, optSprites, optIcon, startX + icS * 0.5, sy + sh * 0.5, icS);
        if (drewIcon && mutedSlash && safeSave(ctx)) {
          try {
            const icx = startX + icS * 0.5;
            const icy = sy + sh * 0.5;
            const sl = icS * 0.34;
            ctx.strokeStyle = '#ef6456';
            ctx.lineWidth = 2.0;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(icx - sl, icy - sl);
            ctx.lineTo(icx + sl, icy + sl);
            ctx.stroke();
          } catch (_) {} finally {
            safeRestore(ctx);
          }
        }
      }

      ctx.fillStyle = resolvedTextCol;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textCx = drewIcon ? startX + icS + icGap + tw * 0.5 : sx + sw * 0.5;
      if (typeof ctx.fillText === 'function') {
        ctx.fillText(btnText, textCx, sy + sh * 0.5 + 0.5);
      }
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function wrapText(ctx, text, maxWidth, font) {
  if (!isMeasureCtx(ctx)) return [];
  let safeText = toSafeText(text, '');
  if (!safeText) return [''];
  if (safeText.length > MAX_WRAP_CHARS) safeText = safeText.slice(0, MAX_WRAP_CHARS);
  const mw = Math.max(1, toSafeNum(maxWidth, 100));
  const safeFont = sanitizeFontSpec(font);
  const lines = [];
  let saved = false;
  try {
    if (typeof ctx.save === 'function') {
      ctx.save();
      saved = true;
    }
  } catch (_) {}
  try {
    if (safeFont) ctx.font = safeFont;
    const tokens = safeText.match(/[0-9A-Za-z.,%+\-~/:]+|\n|[\s\S]/gu) || [''];
    const tokCount = safeArrayLen(tokens, MAX_WRAP_CHARS);
    let line = '';
    for (let i = 0; i < tokCount; i++) {
      const tok = hasOwnProp(tokens, i) ? tokens[i] : '';
      if (tok === '\n') {
        safePush(lines, line);
        line = '';
        continue;
      }
      const test = line + tok;
      if (safeMeasureWidth(ctx, test) > mw && line.length > 0) {
        if (tok.length > 1 && safeMeasureWidth(ctx, tok) > mw) {
          for (const ch of tok) {
            if (safeMeasureWidth(ctx, line + ch) > mw && line.length > 0) {
              safePush(lines, line);
              line = ch;
            } else {
              line += ch;
            }
          }
        } else {
          safePush(lines, line);
          line = tok === ' ' ? '' : tok;
        }
      } else {
        line = test;
      }
    }
    if (line.length > 0 || safeArrayLen(lines, MAX_WRAP_CHARS) === 0) {
      safePush(lines, line);
    }
  } catch (_) {
    if (safeArrayLen(lines, MAX_WRAP_CHARS) === 0) safePush(lines, '');
  } finally {
    if (saved) {
      try {
        if (typeof ctx.restore === 'function') ctx.restore();
      } catch (_) {}
    }
  }
  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, font, color, align = 'left', maxLines = 99) {
  if (!isCanvasCtx(ctx)) return 0;
  let safeText = toSafeText(text, '');
  if (safeText.length > MAX_WRAP_CHARS) safeText = safeText.slice(0, MAX_WRAP_CHARS);
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const rawMw = toSafeNum(maxWidth, 100);
  if (!(rawMw > 0)) return 0;
  const mw = Math.max(1, rawMw);
  const lh = Math.max(0, toSafeNum(lineHeight, 16));
  const ml = Math.min(MAX_WRAP_LINES, Math.max(1, Math.floor(toSafeNum(maxLines, 99))));
  const safeFont = sanitizeFontSpec(font);

  if (!safeSave(ctx)) return 0;
  let totalH = 0;
  try {
    if (safeFont) ctx.font = safeFont;
    ctx.fillStyle = safeColor(color, '#4A2C2A');
    ctx.textAlign =
      typeof align === 'string' && ['left', 'right', 'center', 'start', 'end'].includes(align)
        ? align
        : 'left';
    ctx.textBaseline = 'top';
    let lines = wrapText(ctx, safeText, mw, safeFont || font);
    let lineCount = safeArrayLen(lines, MAX_WRAP_CHARS + 1);
    if (lineCount === 0) {
      lines = [''];
      lineCount = 1;
    }
    if (lineCount > ml) {
      const trimmed = [];
      for (let i = 0; i < ml; i++) {
        safePush(trimmed, hasOwnProp(lines, i) ? lines[i] : '');
      }
      lines = trimmed;
      lineCount = ml;
      let last = toSafeText(hasOwnProp(lines, ml - 1) ? lines[ml - 1] : '', '');
      if (last.length > 256) last = last.slice(0, 256);
      while (last.length > 1 && safeMeasureWidth(ctx, `${last}…`) > mw) {
        last = last.slice(0, -1);
      }
      safeSetIdx(lines, ml - 1, `${last}…`);
    }
    if (typeof ctx.fillText === 'function') {
      for (let i = 0; i < lineCount; i++) {
        ctx.fillText(hasOwnProp(lines, i) ? lines[i] : '', sx, sy + i * lh);
      }
    }
    totalH = lineCount * lh;
  } catch (_) {} finally {
    safeRestore(ctx);
  }
  return totalH;
}

function drawFitText(ctx, text, x, y, maxWidth, baseSize, minSize, weight, color, align = 'left', baseline = 'middle') {
  if (!isCanvasCtx(ctx)) return;
  let safeText = toSafeText(text, '');
  if (!safeText) return;
  if (safeText.length > MAX_WRAP_CHARS) safeText = safeText.slice(0, MAX_WRAP_CHARS);
  const rawMw = toSafeNum(maxWidth, 100);
  if (!(rawMw > 0)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const mw = Math.max(1, rawMw);
  const minFs = Math.min(MAX_FONT_PX, Math.max(1, toSafeNum(minSize, 8)));
  let fs = Math.min(MAX_FONT_PX, Math.max(1, toSafeNum(baseSize, 12)));

  if (!safeSave(ctx)) return;
  try {
    fs = fitFontPx(ctx, safeText, mw, fs, minFs, weight);
    ctx.fillStyle = safeColor(color, '#4A2C2A');
    ctx.textAlign =
      typeof align === 'string' && ['left', 'right', 'center', 'start', 'end'].includes(align)
        ? align
        : 'left';
    ctx.textBaseline =
      typeof baseline === 'string' &&
      ['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'].includes(baseline)
        ? baseline
        : 'middle';
    if (typeof ctx.fillText === 'function') {
      ctx.fillText(safeText, sx, sy);
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

// Convert HSL (h: deg, s: 0..100, l: 0..100) to rgb(r, g, b) because iOS WeChat native Canvas 2D rejects hsl(...) in addColorStop
function hslToRgbColor(h, s, l) {
  const hue = ((toSafeNum(h, 0) % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, toSafeNum(s, 0))) / 100;
  const lit = Math.max(0, Math.min(100, toSafeNum(l, 0))) / 100;
  const c = (1 - Math.abs(2 * lit - 1)) * sat;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) {
    r1 = c; g1 = x;
  } else if (hp < 2) {
    r1 = x; g1 = c;
  } else if (hp < 3) {
    g1 = c; b1 = x;
  } else if (hp < 4) {
    g1 = x; b1 = c;
  } else if (hp < 5) {
    r1 = x; b1 = c;
  } else {
    r1 = c; b1 = x;
  }
  const m = lit - c * 0.5;
  const r = Math.max(0, Math.min(255, Math.round((r1 + m) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((g1 + m) * 255)));
  const b = Math.max(0, Math.min(255, Math.round((b1 + m) * 255)));
  return `rgb(${r}, ${g}, ${b})`;
}

// Procedural Rainbow Wildcard Konpeito Star Candy (used both inside Jar AND UI Previews!)
function drawRainbowWildcard(ctx, x, y, r, angle, nowSec, alpha = 1) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const rad = toSafeNum(r, 0);
  if (!(rad > 0)) return;
  const ang = toSafeNum(angle, 0);
  const t = toSafeNum(nowSec, 0);
  const aVal = Math.max(0, Math.min(1, toSafeNum(alpha, 1)));

  if (!safeSave(ctx)) return;
  try {
    if (aVal < 1) ctx.globalAlpha = aVal;
    ctx.translate(sx, sy);

    // Outer pastel glow
    const aura = safeRadialGradient(ctx, 0, 0, rad * 0.2, 0, 0, rad * 1.55, 'rgba(255, 255, 255, 0.72)');
    safeAddColorStop(aura, 0, 'rgba(255, 255, 255, 0.72)', 'rgba(255, 255, 255, 0.72)');
    safeAddColorStop(aura, 0.55, 'rgba(255, 168, 214, 0.34)', 'rgba(255, 168, 214, 0.34)');
    safeAddColorStop(aura, 1, 'rgba(130, 224, 255, 0)', 'rgba(130, 224, 255, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 1.55, 0, Math.PI * 2);
    ctx.fill();

    if (safeSave(ctx)) {
      try {
        ctx.rotate(ang + t * 0.85);
        const pts = 7;
        const grad = safeLinearGradient(ctx, -rad, -rad, rad, rad, '#ffd6ec');
        const hueShift = (t * 90) % 360;
        safeAddColorStop(grad, 0, hslToRgbColor(hueShift, 92, 82), '#ffd6ec');
        safeAddColorStop(grad, 0.35, hslToRgbColor(hueShift + 65, 95, 80), '#fff0b8');
        safeAddColorStop(grad, 0.7, hslToRgbColor(hueShift + 150, 85, 78), '#ccf4dd');
        safeAddColorStop(grad, 1, hslToRgbColor(hueShift + 240, 88, 82), '#d6e4ff');

        ctx.beginPath();
        for (let i = 0; i < pts * 2; i++) {
          const a = (i * Math.PI) / pts - Math.PI / 2;
          const ptR = i % 2 === 0 ? rad * 1.14 : rad * 0.74;
          if (i === 0) ctx.moveTo(Math.cos(a) * ptR, Math.sin(a) * ptR);
          else ctx.lineTo(Math.cos(a) * ptR, Math.sin(a) * ptR);
        }
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#4A2C2A';
        ctx.lineWidth = Math.max(1.5, rad * 0.12);
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(-rad * 0.18, -rad * 0.22, rad * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } catch (_) {} finally {
        safeRestore(ctx);
      }
    }

    // Sparkling face
    ctx.rotate(ang * 0.25);
    ctx.fillStyle = 'rgba(255, 118, 168, 0.75)';
    fillEllipse(ctx, -rad * 0.34, rad * 0.14, rad * 0.14, rad * 0.08);
    ctx.fill();
    fillEllipse(ctx, rad * 0.34, rad * 0.14, rad * 0.14, rad * 0.08);
    ctx.fill();

    ctx.fillStyle = '#4A2C2A';
    drawStar(ctx, -rad * 0.24, -rad * 0.04, rad * 0.18, t * 1.5);
    drawStar(ctx, rad * 0.24, -rad * 0.04, rad * 0.18, -t * 1.5);

    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = Math.max(1.3, rad * 0.095);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, rad * 0.08, rad * 0.14, 0.2, Math.PI - 0.2);
    ctx.stroke();

    if (aVal > 0.5) {
      for (let k = 0; k < 2; k++) {
        const oa = t * 2.8 + k * Math.PI;
        ctx.fillStyle = k === 0 ? '#fff6a6' : '#ff99cc';
        drawStar(ctx, Math.cos(oa) * rad * 1.18, Math.sin(oa) * rad * 1.18, Math.max(2.4, rad * 0.19), t * 4);
      }
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function drawGoldenAura(ctx, x, y, r, nowSec, alpha = 1) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const rad = toSafeNum(r, 0);
  if (!(rad > 0)) return;
  const t = toSafeNum(nowSec, 0);
  const aVal = Math.max(0, Math.min(1, toSafeNum(alpha, 1)));

  if (!safeSave(ctx)) return;
  try {
    if (aVal < 1) ctx.globalAlpha = aVal;
    ctx.translate(sx, sy);
    const pulse = 0.88 + 0.12 * Math.sin(t * 6);
    const grad = safeRadialGradient(ctx, 0, 0, rad * 0.55, 0, 0, rad * 1.48 * pulse, 'rgba(255, 224, 96, 0.48)');
    safeAddColorStop(grad, 0, 'rgba(255, 224, 96, 0.48)', 'rgba(255, 224, 96, 0.48)');
    safeAddColorStop(grad, 0.68, 'rgba(255, 198, 56, 0.22)', 'rgba(255, 198, 56, 0.22)');
    safeAddColorStop(grad, 1, 'rgba(255, 198, 56, 0)', 'rgba(255, 198, 56, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 1.48 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(t * 0.9);
    ctx.strokeStyle = 'rgba(255, 226, 102, 0.85)';
    ctx.lineWidth = 2.1;
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, rad * 1.07, 0, Math.PI * 2);
    ctx.stroke();
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function drawThemeSwatch(ctx, x, y, w, h, themeId, sprites = null) {
  if (!isCanvasCtx(ctx)) return;
  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const sw = toSafeNum(w, 0);
  const sh = toSafeNum(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  if (sprites && typeof sprites === 'object') {
    const key = themeId === 'sakura' ? 'theme_sakura' : themeId === 'moonlight' ? 'theme_moonlight' : 'theme_amber';
    const img = resolveByIdSprite(sprites, key);
    if (img) {
      if (drawContainImage(ctx, img, sx + sw * 0.5, sy + sh * 0.5, sw, sh)) return;
    }
  }
  if (!safeSave(ctx)) return;
  try {
    roundRectPath(ctx, sx, sy, sw, sh, 9);
    if (typeof ctx.clip === 'function') ctx.clip();
    const g = safeLinearGradient(ctx, sx, sy, sx, sy + sh, '#D99954');
    if (themeId === 'sakura') {
      safeAddColorStop(g, 0, '#FFE0EC', '#FFE0EC');
      safeAddColorStop(g, 0.65, '#EBA9C0', '#EBA9C0');
      safeAddColorStop(g, 1, '#F5C3D6', '#F5C3D6');
    } else if (themeId === 'moonlight') {
      safeAddColorStop(g, 0, '#7294CE', '#7294CE');
      safeAddColorStop(g, 0.65, '#2E4474', '#2E4474');
      safeAddColorStop(g, 1, '#5878B4', '#5878B4');
    } else {
      safeAddColorStop(g, 0, '#E8AE6A', '#E8AE6A');
      safeAddColorStop(g, 0.65, '#C58644', '#C58644');
      safeAddColorStop(g, 1, '#9E632B', '#9E632B');
    }
    ctx.fillStyle = g;
    if (typeof ctx.fillRect === 'function') {
      ctx.fillRect(sx, sy, sw, sh);
    } else {
      roundRectPath(ctx, sx, sy, sw, sh, 0);
      ctx.fill();
    }
    ctx.strokeStyle = '#5A3928';
    ctx.lineWidth = 2;
    roundRectPath(ctx, sx + 1, sy + 1, sw - 2, sh - 2, 8);
    ctx.stroke();
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

function appendRoundedRectSubpath(ctx, x, y, w, h, r, ccw = false) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  if (!ccw) {
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  } else {
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x, y, x, y + rad, rad);
    ctx.lineTo(x, y + h - rad);
    ctx.arcTo(x, y + h, x + rad, y + h, rad);
    ctx.lineTo(x + w - rad, y + h);
    ctx.arcTo(x + w, y + h, x + w, y + h - rad, rad);
    ctx.lineTo(x + w, y + rad);
    ctx.arcTo(x + w, y, x + w - rad, y, rad);
    ctx.closePath();
  }
}

function drawProceduralStrawberryMotif(ctx, r) {
  const sr = toSafeNum(r, 0);
  if (!(sr > 0)) return;
  try {
    // Plump strawberry body
    const bg = safeLinearGradient(ctx, 0, -sr * 0.58, 0, sr * 0.72, '#F25C7E');
    safeAddColorStop(bg, 0, '#F25C7E', '#F25C7E');
    safeAddColorStop(bg, 1, '#C92F53', '#C92F53');
    ctx.fillStyle = bg;
    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = Math.max(1.0, sr * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, sr * 0.68);
    ctx.bezierCurveTo(-sr * 0.72, sr * 0.28, -sr * 0.66, -sr * 0.42, 0, -sr * 0.36);
    ctx.bezierCurveTo(sr * 0.66, -sr * 0.42, sr * 0.72, sr * 0.28, 0, sr * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3-leaf green calyx at top
    ctx.fillStyle = '#5AA342';
    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = Math.max(0.9, sr * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, -sr * 0.26);
    ctx.quadraticCurveTo(-sr * 0.36, -sr * 0.68, -sr * 0.54, -sr * 0.30);
    ctx.quadraticCurveTo(-sr * 0.20, -sr * 0.22, 0, -sr * 0.48);
    ctx.quadraticCurveTo(sr * 0.20, -sr * 0.22, sr * 0.54, -sr * 0.30);
    ctx.quadraticCurveTo(sr * 0.36, -sr * 0.68, 0, -sr * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tiny cream seeds
    ctx.fillStyle = '#FFF6D6';
    for (const seed of [
      [-sr * 0.20, 0.0],
      [sr * 0.20, 0.0],
      [0, sr * 0.28]
    ]) {
      ctx.beginPath();
      ctx.arc(seed[0], seed[1], Math.max(0.8, sr * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
  } catch (_) {}
}

function drawProceduralBoardTileIcon(ctx, iconKey, cx, cy, size, alpha = 1, rot = 0) {
  if (!isCanvasCtx(ctx)) return;
  const scx = toSafeNum(cx, 0);
  const scy = toSafeNum(cy, 0);
  const ssize = toSafeNum(size, 0);
  if (!(ssize > 0)) return;
  const salpha = Math.max(0, Math.min(1, toSafeNum(alpha, 1)));
  const srot = toSafeNum(rot, 0);
  const half = ssize * 0.5;

  if (!safeSave(ctx)) return;
  try {
    if (salpha < 1) ctx.globalAlpha *= salpha;
    ctx.translate(scx, scy);
    if (srot) ctx.rotate(srot);

    if (iconKey === 'tile_gold') {
      const outHalf = half * 0.94;
      const inHalf = half * 0.52;
      const outR = ssize * 0.18;
      const inR = ssize * 0.10;
      const g = safeLinearGradient(ctx, -outHalf, -outHalf, outHalf, outHalf, '#F2B838');
      safeAddColorStop(g, 0, '#FFE885', '#FFE885');
      safeAddColorStop(g, 0.5, '#F2B838', '#F2B838');
      safeAddColorStop(g, 1, '#CF8B22', '#CF8B22');
      ctx.fillStyle = g;
      ctx.beginPath();
      appendRoundedRectSubpath(ctx, -outHalf, -outHalf, outHalf * 2, outHalf * 2, outR, false);
      appendRoundedRectSubpath(ctx, -inHalf, -inHalf, inHalf * 2, inHalf * 2, inR, true);
      ctx.fill();

      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = Math.max(1.2, ssize * 0.032);
      roundRectPath(ctx, -outHalf, -outHalf, outHalf * 2, outHalf * 2, outR);
      ctx.stroke();
      roundRectPath(ctx, -inHalf, -inHalf, inHalf * 2, inHalf * 2, inR);
      ctx.stroke();

      ctx.fillStyle = '#FFF9D9';
      const sp = outHalf * 0.74;
      drawStar(ctx, -sp, -sp, Math.max(2, ssize * 0.065), 0);
      drawStar(ctx, sp, -sp, Math.max(2, ssize * 0.065), 0);
      drawStar(ctx, -sp, sp, Math.max(2, ssize * 0.065), 0);
      drawStar(ctx, sp, sp, Math.max(2, ssize * 0.065), 0);
    } else if (iconKey === 'tile_matcha') {
      ctx.fillStyle = 'rgba(139, 184, 104, 0.34)';
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.72, 0, Math.PI * 2);
      ctx.fill();

      for (const dir of [-1, 1]) {
        if (safeSave(ctx)) {
          try {
            ctx.translate(dir * ssize * 0.09, dir * ssize * 0.03);
            ctx.rotate(dir * 0.52);
            ctx.fillStyle = dir < 0 ? '#6EA34E' : '#588C3B';
            ctx.strokeStyle = '#4A2C2A';
            ctx.lineWidth = Math.max(1.1, ssize * 0.03);
            ctx.beginPath();
            ctx.moveTo(0, -ssize * 0.22);
            ctx.quadraticCurveTo(ssize * 0.16, -ssize * 0.04, 0, ssize * 0.22);
            ctx.quadraticCurveTo(-ssize * 0.16, -ssize * 0.04, 0, -ssize * 0.22);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -ssize * 0.16);
            ctx.lineTo(0, ssize * 0.16);
            ctx.stroke();
          } catch (_) {} finally {
            safeRestore(ctx);
          }
        }
      }
    } else if (iconKey === 'tile_berry') {
      ctx.fillStyle = 'rgba(224, 82, 118, 0.30)';
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const rad = i % 2 === 0 ? half * 0.74 : half * 0.58;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      drawProceduralStrawberryMotif(ctx, ssize * 0.24);
    } else if (iconKey === 'tile_block') {
      const bHalf = half * 0.92;
      const bRad = ssize * 0.18;
      ctx.fillStyle = '#633918';
      roundRectPath(ctx, -bHalf, -bHalf + ssize * 0.04, bHalf * 2, bHalf * 2 - ssize * 0.04, bRad);
      ctx.fill();

      const wg = safeLinearGradient(ctx, 0, -bHalf, 0, bHalf, '#C98E54');
      safeAddColorStop(wg, 0, '#C98E54', '#C98E54');
      safeAddColorStop(wg, 1, '#8C5628', '#8C5628');
      ctx.fillStyle = wg;
      roundRectPath(ctx, -bHalf, -bHalf, bHalf * 2, bHalf * 2 - ssize * 0.05, bRad);
      ctx.fill();
      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = Math.max(1.4, ssize * 0.036);
      ctx.stroke();

      // Carved cat-paw emblem
      ctx.fillStyle = '#5C3419';
      fillEllipse(ctx, 0, ssize * 0.06, ssize * 0.14, ssize * 0.11);
      ctx.fill();
      for (const toe of [
        [-ssize * 0.14, -ssize * 0.08],
        [-ssize * 0.05, -ssize * 0.14],
        [ssize * 0.05, -ssize * 0.14],
        [ssize * 0.14, -ssize * 0.08]
      ]) {
        ctx.beginPath();
        ctx.arc(toe[0], toe[1], ssize * 0.048, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (iconKey === 'tile_ice') {
      const iHalf = half * 0.92;
      const iRad = ssize * 0.18;
      const ig = safeLinearGradient(ctx, -iHalf, -iHalf, iHalf, iHalf, 'rgba(148, 218, 250, 0.78)');
      safeAddColorStop(ig, 0, 'rgba(210, 245, 255, 0.88)', 'rgba(210, 245, 255, 0.88)');
      safeAddColorStop(ig, 0.55, 'rgba(148, 218, 250, 0.78)', 'rgba(148, 218, 250, 0.78)');
      safeAddColorStop(ig, 1, 'rgba(108, 192, 238, 0.86)', 'rgba(108, 192, 238, 0.86)');
      ctx.fillStyle = ig;
      roundRectPath(ctx, -iHalf, -iHalf, iHalf * 2, iHalf * 2, iRad);
      ctx.fill();
      ctx.strokeStyle = '#3B7CA8';
      ctx.lineWidth = Math.max(1.4, ssize * 0.034);
      ctx.stroke();

      // Frost highlight & Y-crack lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = Math.max(1.1, ssize * 0.028);
      ctx.beginPath();
      ctx.moveTo(-iHalf * 0.65, -iHalf * 0.72);
      ctx.lineTo(-iHalf * 0.20, -iHalf * 0.72);
      ctx.moveTo(-iHalf * 0.55, iHalf * 0.45);
      ctx.lineTo(-iHalf * 0.12, iHalf * 0.12);
      ctx.lineTo(iHalf * 0.35, iHalf * 0.32);
      ctx.moveTo(-iHalf * 0.12, iHalf * 0.12);
      ctx.lineTo(iHalf * 0.10, -iHalf * 0.38);
      ctx.stroke();
    } else if (iconKey === 'btn_knead') {
      // Mochi dough pillow + pink cat paw
      ctx.fillStyle = '#FFF5E0';
      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = Math.max(1.3, ssize * 0.045);
      fillEllipse(ctx, 0, ssize * 0.14, ssize * 0.36, ssize * 0.22);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F7A8B8';
      fillEllipse(ctx, 0, -ssize * 0.02, ssize * 0.16, ssize * 0.12);
      ctx.fill();
      ctx.stroke();
      for (const pt of [
        [-ssize * 0.17, -ssize * 0.18],
        [-ssize * 0.06, -ssize * 0.24],
        [ssize * 0.06, -ssize * 0.24],
        [ssize * 0.17, -ssize * 0.18]
      ]) {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], ssize * 0.055, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (iconKey === 'btn_trash') {
      // Cozy wicker trash basket + lid
      ctx.fillStyle = '#C68B53';
      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = Math.max(1.3, ssize * 0.045);
      ctx.beginPath();
      ctx.moveTo(-ssize * 0.28, -ssize * 0.10);
      ctx.lineTo(ssize * 0.28, -ssize * 0.10);
      ctx.lineTo(ssize * 0.21, ssize * 0.34);
      ctx.lineTo(-ssize * 0.21, ssize * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lid
      ctx.fillStyle = '#DFAA6E';
      roundRectPath(ctx, -ssize * 0.33, -ssize * 0.22, ssize * 0.66, ssize * 0.12, ssize * 0.05);
      ctx.fill();
      ctx.stroke();
      roundRectPath(ctx, -ssize * 0.10, -ssize * 0.31, ssize * 0.20, ssize * 0.09, ssize * 0.04);
      ctx.fill();
      ctx.stroke();
    } else {
      // badge_flavor_set fallback
      ctx.fillStyle = '#FFE885';
      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = Math.max(1.2, ssize * 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, ssize * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

/**
 * Draw circular flavor sticker badge ('matcha', 'berry', or 'gold') using v0.9.0 WebP sprites.
 */
function drawFlavorBadge(ctx, sprites, flavor, cx, cy, size, opts = {}) {
  const safeSize = toSafeNum(size, 0);
  if (!isCanvasCtx(ctx) || !(safeSize > 0) || typeof flavor !== 'string') return false;
  const flv = flavor.trim();
  if (flv !== 'matcha' && flv !== 'berry' && flv !== 'gold') return false;

  const safeCx = toSafeNum(cx, 0);
  const safeCy = toSafeNum(cy, 0);
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const alpha = Math.max(0, Math.min(1, toSafeNum(getOwnProp(safeOpts, 'alpha', 1), 1)));
  const rot = toSafeNum(getOwnProp(safeOpts, 'rot', 0), 0);

  const webpKey = flv === 'matcha' ? 'flavor_matcha' : flv === 'berry' ? 'flavor_berry' : 'flavor_gold';
  const webpImg = resolveByIdSprite(sprites, webpKey);
  if (webpImg && safeSave(ctx)) {
    let ok = false;
    try {
      const dSize = safeSize * 1.18;
      if (alpha < 1) ctx.globalAlpha *= alpha;
      ctx.translate(safeCx, safeCy);
      if (rot) ctx.rotate(rot);
      ok = drawContainImage(ctx, webpImg, 0, 0, dSize, dSize);
    } catch (_) {
      ok = false;
    } finally {
      safeRestore(ctx);
    }
    if (ok) return true;
  }

  // Storybook circular sticker fallback when WebP is not loaded yet
  const r = safeSize * 0.48;
  if (!safeSave(ctx)) return false;
  let okVec = false;
  try {
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(safeCx, safeCy);
    if (rot) ctx.rotate(rot);

    ctx.fillStyle = '#FFFDF7';
    ctx.strokeStyle = '#5A3928';
    ctx.lineWidth = Math.max(1.2, safeSize * 0.09);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = flv === 'matcha' ? '#DDF2CE' : flv === 'gold' ? '#FFF2BD' : '#FFE3EC';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.80, 0, Math.PI * 2);
    ctx.fill();

    if (flv === 'berry') {
      drawProceduralStrawberryMotif(ctx, r * 0.68);
    } else if (flv === 'matcha') {
      ctx.rotate(-0.35);
      ctx.fillStyle = '#5D9942';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(1.0, safeSize * 0.07);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.58);
      ctx.quadraticCurveTo(r * 0.46, 0, 0, r * 0.58);
      ctx.quadraticCurveTo(-r * 0.46, 0, 0, -r * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3A6826';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.42);
      ctx.lineTo(0, r * 0.42);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#F5B82E';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = Math.max(1.0, safeSize * 0.07);
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, r * 0.34);
      ctx.lineTo(-r * 0.54, -r * 0.24);
      ctx.lineTo(-r * 0.18, 0.0);
      ctx.lineTo(0, -r * 0.46);
      ctx.lineTo(r * 0.18, 0.0);
      ctx.lineTo(r * 0.54, -r * 0.24);
      ctx.lineTo(r * 0.48, r * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    okVec = true;
  } catch (_) {
    okVec = false;
  } finally {
    safeRestore(ctx);
  }
  return okVec;
}

/**
 * Draw a board cell overlay ('tile_gold', 'tile_matcha', 'tile_berry', 'tile_block', 'tile_ice')
 * using v0.9.0 standalone WebP sprites inside box (x, y, size, size).
 */
function drawBoardTileOverlay(ctx, sprites, tileKey, x, y, size, opts = {}) {
  const safeSize = toSafeNum(size, 0);
  if (!isCanvasCtx(ctx) || !(safeSize > 0) || typeof tileKey !== 'string') return false;
  if (!BOARD_TILES_ATLAS_RECTS || !hasOwnProp(BOARD_TILES_ATLAS_RECTS, tileKey)) return false;

  const sx = toSafeNum(x, 0);
  const sy = toSafeNum(y, 0);
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const alpha = Math.max(0, Math.min(1, toSafeNum(getOwnProp(safeOpts, 'alpha', 1), 1)));

  const TILE_WEBP_MAP = {
    tile_block: 'tile_obstacle',
    tile_ice: 'tile_ice',
    tile_matcha: 'flavor_matcha',
    tile_berry: 'flavor_berry',
    tile_gold: 'flavor_gold'
  };
  const mappedId = hasOwnProp(TILE_WEBP_MAP, tileKey) ? TILE_WEBP_MAP[tileKey] : null;
  const webpImg = mappedId ? resolveByIdSprite(sprites, mappedId) : null;

  if (webpImg && safeSave(ctx)) {
    let ok = false;
    try {
      ctx.globalAlpha *= alpha;
      if (tileKey === 'tile_gold') {
        // Hollow warm gold border + corner gold emblem so catcake stays unobstructed
        const pad = safeSize * 0.05;
        const rad = Math.max(5, safeSize * 0.18);
        ctx.strokeStyle = '#FFD466';
        ctx.lineWidth = Math.max(2.0, safeSize * 0.055);
        roundRectPath(ctx, sx + pad, sy + pad, safeSize - pad * 2, safeSize - pad * 2, rad);
        ctx.stroke();
        const embS = safeSize * 0.44;
        ok = drawContainImage(ctx, webpImg, sx + safeSize * 0.5, sy + safeSize * 0.5, embS, embS);
      } else if (tileKey === 'tile_matcha' || tileKey === 'tile_berry') {
        const embS = safeSize * 0.56;
        ok = drawContainImage(ctx, webpImg, sx + safeSize * 0.5, sy + safeSize * 0.5, embS, embS);
      } else {
        ok = safeDrawImage(ctx, webpImg, sx, sy, safeSize, safeSize);
      }
    } catch (_) {
      ok = false;
    } finally {
      safeRestore(ctx);
    }
    if (ok) return true;
  }

  drawProceduralBoardTileIcon(ctx, tileKey, sx + safeSize * 0.5, sy + safeSize * 0.5, safeSize, alpha, 0);
  return true;
}

function normalizeCatcakeTier(tier) {
  if (typeof tier === 'number') {
    return Number.isInteger(tier) && tier >= 1 && tier <= 7 ? tier : 0;
  }
  if (typeof tier === 'string') {
    const s = tier.trim();
    if (/^[1-7]$/.test(s)) return Number(s);
    if (/^C[1-7]$/.test(s)) return Number(s.slice(1));
  }
  return 0;
}

function drawProceduralCatcakeBody(ctx, tier, size, happy, silhouette) {
  const safeSize = toSafeNum(size, 0);
  if (!(safeSize > 0)) return;
  const def = CATCAKE_MAP && hasOwnProp(CATCAKE_MAP, String(tier)) ? getOwnProp(CATCAKE_MAP, String(tier), null) : null;
  const baseCol = silhouette
    ? '#5A3928'
    : safeColor(def && getOwnProp(def, 'color', null), '#FFF3DC');
  const crumbCol = silhouette
    ? '#4A2C2A'
    : safeColor(def && getOwnProp(def, 'crumbColor', null), '#FFF9EE');
  const r = safeSize * 0.36;

  // Pointed cat ears
  for (const dir of [-1, 1]) {
    ctx.fillStyle = baseCol;
    ctx.strokeStyle = '#5A3928';
    ctx.lineWidth = Math.max(1.3, safeSize * 0.036);
    ctx.beginPath();
    ctx.moveTo(dir * r * 0.30, -r * 0.62);
    ctx.lineTo(dir * r * 0.86, -r * 1.12);
    ctx.lineTo(dir * r * 0.92, -r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!silhouette) {
      ctx.fillStyle = '#F7A8B8';
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.44, -r * 0.60);
      ctx.lineTo(dir * r * 0.76, -r * 0.94);
      ctx.lineTo(dir * r * 0.80, -r * 0.44);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Plump cat-bun body
  const bg = safeRadialGradient(ctx, -r * 0.22, -r * 0.25, r * 0.12, 0, 0, r * 1.08, crumbCol);
  safeAddColorStop(bg, 0, crumbCol, '#FFF9EE');
  safeAddColorStop(bg, 1, baseCol, '#FFF3DC');
  ctx.fillStyle = bg;
  ctx.strokeStyle = '#5A3928';
  ctx.lineWidth = Math.max(1.4, safeSize * 0.038);
  fillEllipse(ctx, 0, r * 0.08, r * 1.02, r * 0.88);
  ctx.fill();
  ctx.stroke();

  if (silhouette) {
    drawFitText(ctx, '?', 0, r * 0.10, r * 1.2, Math.max(10, safeSize * 0.38), 8, 900, '#DFD6C7', 'center', 'middle');
    return;
  }

  // Tier signature topping
  if (tier === 4) {
    ctx.fillStyle = '#B8651B';
    fillEllipse(ctx, 0, -r * 0.42, r * 0.62, r * 0.22);
    ctx.fill();
  } else if (tier === 5) {
    if (safeSave(ctx)) {
      try {
        ctx.translate(0, -r * 0.68);
        drawProceduralStrawberryMotif(ctx, r * 0.36);
      } catch (_) {} finally {
        safeRestore(ctx);
      }
    }
  } else if (tier === 6) {
    ctx.strokeStyle = '#FFFDF7';
    ctx.lineWidth = Math.max(1.8, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(-r * 0.82, r * 0.22);
    ctx.lineTo(r * 0.82, r * 0.22);
    ctx.stroke();
  } else if (tier === 7) {
    ctx.fillStyle = '#FFD859';
    ctx.strokeStyle = '#5A3928';
    ctx.lineWidth = Math.max(1.1, safeSize * 0.028);
    ctx.beginPath();
    ctx.moveTo(-r * 0.34, -r * 0.62);
    ctx.lineTo(-r * 0.40, -r * 1.02);
    ctx.lineTo(-r * 0.12, -r * 0.82);
    ctx.lineTo(0, -r * 1.14);
    ctx.lineTo(r * 0.12, -r * 0.82);
    ctx.lineTo(r * 0.40, -r * 1.02);
    ctx.lineTo(r * 0.34, -r * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Blush cheeks
  ctx.fillStyle = 'rgba(244, 130, 152, 0.58)';
  fillEllipse(ctx, -r * 0.52, r * 0.18, r * 0.18, r * 0.11);
  ctx.fill();
  fillEllipse(ctx, r * 0.52, r * 0.18, r * 0.18, r * 0.11);
  ctx.fill();

  // Eyes & smile
  ctx.strokeStyle = '#5A3928';
  ctx.fillStyle = '#5A3928';
  ctx.lineWidth = Math.max(1.2, safeSize * 0.032);
  ctx.lineCap = 'round';
  if (happy) {
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(dir * r * 0.34, r * 0.04, r * 0.14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(dir * r * 0.34, r * 0.02, Math.max(1.3, r * 0.10), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(-r * 0.09, r * 0.16, r * 0.09, 0.1, Math.PI - 0.1);
  ctx.arc(r * 0.09, r * 0.16, r * 0.09, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

/**
 * Render a 1..7 Cat-Cake sprite with optional happy swap, corner flavor sticker, silhouette, or ice overlay.
 */
function drawCatcakeSprite(ctx, sprites, tier, cx, cy, size, opts = {}) {
  const t = normalizeCatcakeTier(tier);
  const safeSize = toSafeNum(size, 0);
  if (!isCanvasCtx(ctx) || !t || !(safeSize > 0)) return false;

  const safeCx = toSafeNum(cx, 0);
  const safeCy = toSafeNum(cy, 0);
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const happy = Boolean(getOwnProp(safeOpts, 'happy', false));
  const silhouette = Boolean(getOwnProp(safeOpts, 'silhouette', false));
  const rawFlv = getOwnProp(safeOpts, 'flavor', '');
  const flavor = typeof rawFlv === 'string' ? rawFlv.trim() : '';
  const rawShowBadge = getOwnProp(safeOpts, 'showFlavorBadge', undefined);
  const showFlavorBadge =
    rawShowBadge !== undefined
      ? Boolean(rawShowBadge)
      : Boolean(flavor && flavor !== 'plain' && flavor !== 'any');
  const frozen = Boolean(getOwnProp(safeOpts, 'frozen', false));
  const alpha = Math.max(0, Math.min(1, toSafeNum(getOwnProp(safeOpts, 'alpha', 1), 1)));
  const scaleX = toSafeNum(getOwnProp(safeOpts, 'scaleX', 1), 1);
  const scaleY = toSafeNum(getOwnProp(safeOpts, 'scaleY', 1), 1);
  const rot = toSafeNum(getOwnProp(safeOpts, 'rot', 0), 0);
  if (scaleX === 0 || scaleY === 0) return true;

  if (!safeSave(ctx)) return false;
  let bodyOk = false;
  try {
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(safeCx, safeCy);
    if (rot) ctx.rotate(rot);
    if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY);

    let drewImg = false;
    if (!silhouette) {
      const img = resolveCatcakeImage(sprites, t, happy);
      if (img) {
        drewImg = drawContainImage(ctx, img, 0, 0, safeSize, safeSize);
      }
    }
    if (!drewImg) {
      drawProceduralCatcakeBody(ctx, t, safeSize, happy, silhouette);
    }
    bodyOk = true;
  } catch (_) {
    bodyOk = false;
  } finally {
    safeRestore(ctx);
  }
  if (!bodyOk) return false;

  if (!silhouette && showFlavorBadge && (flavor === 'matcha' || flavor === 'berry' || flavor === 'gold')) {
    drawFlavorBadge(
      ctx,
      sprites,
      flavor,
      safeCx + safeSize * 0.30 * scaleX,
      safeCy + safeSize * 0.30 * scaleY,
      Math.max(11, safeSize * 0.34),
      { alpha }
    );
  }

  if (frozen) {
    const iceSize = safeSize * 1.04;
    drawBoardTileOverlay(ctx, sprites, 'tile_ice', safeCx - iceSize * 0.5, safeCy - iceSize * 0.5, iceSize, {
      alpha: 0.62 * alpha
    });
  }

  return true;
}

const CUSTOMER_WEBP_ALIAS = {
  cust_ragdoll: 'cust_ragdoll',
  cust_orange: 'cust_orange_uncle',
  cust_orange_uncle: 'cust_orange_uncle',
  cust_silver: 'cust_scholar',
  cust_scholar: 'cust_scholar',
  cust_rabbit: 'cust_lop_bunny',
  cust_lop_bunny: 'cust_lop_bunny',
  cust_fox: 'cust_fox',
  cust_raccoon: 'cust_raccoon',
  cust_shiba: 'cust_shiba',
  cust_critic: 'cust_vip_cat',
  cust_vip_cat: 'cust_vip_cat'
};

/**
 * Render an animal customer portrait using v0.9.0 standalone WebP sprites (`02_顾客头像/`).
 */
function drawCustomerPortrait(ctx, sprites, customerId, cx, cy, size, opts = {}) {
  const safeSize = toSafeNum(size, 0);
  if (!isCanvasCtx(ctx) || !(safeSize > 0) || typeof customerId !== 'string') return false;
  const safeCx = toSafeNum(cx, 0);
  const safeCy = toSafeNum(cy, 0);
  const def = CUSTOMER_MAP && hasOwnProp(CUSTOMER_MAP, customerId) ? getOwnProp(CUSTOMER_MAP, customerId, null) : null;

  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const rawMood = getOwnProp(safeOpts, 'mood', 'normal');
  const mood = typeof rawMood === 'string' ? rawMood : 'normal';
  const circular = getOwnProp(safeOpts, 'circular', true) !== false;
  const isVip = Boolean(getOwnProp(safeOpts, 'isVip', false) || (def && getOwnProp(def, 'isVip', false)));
  const isUrgent = Boolean(getOwnProp(safeOpts, 'isUrgent', false) || (def && getOwnProp(def, 'isUrgent', false)));
  const alpha = Math.max(0, Math.min(1, toSafeNum(getOwnProp(safeOpts, 'alpha', 1), 1)));
  const r = safeSize * 0.5;

  if (!safeSave(ctx)) return false;
  let okPortrait = false;
  try {
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(safeCx, safeCy);

    if (circular) {
      const mg = safeLinearGradient(ctx, 0, -r, 0, r, '#FFF9EC');
      if (isVip) {
        safeAddColorStop(mg, 0, '#FFF0B8', '#FFF0B8');
        safeAddColorStop(mg, 1, '#F5CA5C', '#F5CA5C');
      } else if (isUrgent) {
        safeAddColorStop(mg, 0, '#FFF2E2', '#FFF2E2');
        safeAddColorStop(mg, 1, '#F8D4B4', '#F8D4B4');
      } else {
        safeAddColorStop(mg, 0, '#FFF9EC', '#FFF9EC');
        safeAddColorStop(mg, 1, '#F2E2C4', '#F2E2C4');
      }
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (safeSave(ctx)) {
      try {
        if (circular && typeof ctx.clip === 'function') {
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(1, r - 1.4), 0, Math.PI * 2);
          ctx.clip();
        }

        const mappedCustId = hasOwnProp(CUSTOMER_WEBP_ALIAS, customerId)
          ? CUSTOMER_WEBP_ALIAS[customerId]
          : customerId;
        const custMap = sprites && typeof sprites === 'object' ? getOwnProp(sprites, 'customers', null) : null;
        const webpImg =
          (custMap && typeof custMap === 'object' ? getOwnProp(custMap, customerId, null) : null) ||
          resolveByIdSprite(sprites, mappedCustId) ||
          resolveByIdSprite(sprites, customerId);

        let drewPortrait = false;
        if (isReadyImage(webpImg)) {
          drewPortrait = drawContainImage(ctx, webpImg, 0, 0, safeSize, safeSize);
        }

        if (!drewPortrait) {
          const furColors = {
            cust_ragdoll: '#FAF4EB',
            cust_orange: '#F09D46',
            cust_silver: '#CFD6DE',
            cust_rabbit: '#FFF5E8',
            cust_fox: '#E57A3C',
            cust_raccoon: '#9C785C',
            cust_shiba: '#E5B263',
            cust_critic: '#FFFFFF'
          };
          const fur = hasOwnProp(furColors, customerId) ? furColors[customerId] : '#F5E6CF';
          ctx.fillStyle = fur;
          ctx.strokeStyle = '#5A3928';
          ctx.lineWidth = Math.max(1.2, safeSize * 0.04);
          for (const dir of [-1, 1]) {
            ctx.beginPath();
            if (customerId === 'cust_rabbit' || customerId === 'cust_lop_bunny') {
              fillEllipse(ctx, dir * r * 0.34, -r * 0.45, r * 0.16, r * 0.38);
            } else {
              ctx.moveTo(dir * r * 0.20, -r * 0.25);
              ctx.lineTo(dir * r * 0.62, -r * 0.70);
              ctx.lineTo(dir * r * 0.66, -r * 0.10);
              ctx.closePath();
            }
            ctx.fill();
            ctx.stroke();
          }
          fillEllipse(ctx, 0, r * 0.14, r * 0.62, r * 0.54);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#5A3928';
          ctx.beginPath();
          ctx.arc(-r * 0.22, r * 0.10, Math.max(1.1, r * 0.08), 0, Math.PI * 2);
          ctx.arc(r * 0.22, r * 0.10, Math.max(1.1, r * 0.08), 0, Math.PI * 2);
          ctx.fill();
        }

        if (mood === 'angry') {
          ctx.fillStyle = 'rgba(72, 78, 92, 0.28)';
          if (typeof ctx.fillRect === 'function') {
            ctx.fillRect(-r, -r, safeSize, safeSize);
          } else {
            roundRectPath(ctx, -r, -r, safeSize, safeSize, 0);
            ctx.fill();
          }
        }
      } catch (_) {} finally {
        safeRestore(ctx);
      }
    }

    if (circular) {
      ctx.strokeStyle = isVip ? '#C98212' : isUrgent ? '#C95B2B' : '#5A3928';
      ctx.lineWidth = Math.max(1.6, safeSize * 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, r - 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (mood === 'anxious') {
      const sx = r * 0.62;
      const sy = -r * 0.48;
      const sr = Math.max(2.6, safeSize * 0.11);
      ctx.fillStyle = '#8BE0FF';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - sr);
      ctx.quadraticCurveTo(sx + sr * 0.85, sy + sr * 0.25, sx, sy + sr);
      ctx.quadraticCurveTo(sx - sr * 0.85, sy + sr * 0.25, sx, sy - sr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (mood === 'happy') {
      ctx.fillStyle = '#FFE268';
      drawStar(ctx, -r * 0.68, -r * 0.48, Math.max(2.5, safeSize * 0.10), 0.2);
      drawStar(ctx, r * 0.68, -r * 0.48, Math.max(2.5, safeSize * 0.10), -0.2);
    } else if (mood === 'angry') {
      const cxCloud = r * 0.56;
      const cyCloud = -r * 0.56;
      const cr = Math.max(3.2, safeSize * 0.12);
      ctx.fillStyle = '#636B7A';
      ctx.strokeStyle = '#5A3928';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cxCloud - cr * 0.55, cyCloud + cr * 0.1, cr * 0.65, 0, Math.PI * 2);
      ctx.arc(cxCloud, cyCloud - cr * 0.2, cr * 0.8, 0, Math.PI * 2);
      ctx.arc(cxCloud + cr * 0.6, cyCloud + cr * 0.12, cr * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    okPortrait = true;
  } catch (_) {
    okPortrait = false;
  } finally {
    safeRestore(ctx);
  }
  return okPortrait;
}

/**
 * Draw crisp emerald checkmark badge using v0.9.0 `icon_check.webp` when available.
 */
function drawCheckmarkBadge(ctx, cx, cy, radius = 6, opts = {}) {
  const srad = toSafeNum(radius, 0);
  if (!isCanvasCtx(ctx) || !(srad > 0)) return;
  const scx = toSafeNum(cx, 0);
  const scy = toSafeNum(cy, 0);
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const alpha = Math.max(0, Math.min(1, toSafeNum(getOwnProp(safeOpts, 'alpha', 1), 1)));
  const sp = getOwnProp(safeOpts, 'sprites', null);
  const checkImg = sp ? resolveByIdSprite(sp, 'icon_check') : null;

  if (checkImg && safeSave(ctx)) {
    try {
      if (alpha < 1) ctx.globalAlpha *= alpha;
      drawContainImage(ctx, checkImg, scx, scy, srad * 2.4, srad * 2.4);
      return;
    } catch (_) {} finally {
      safeRestore(ctx);
    }
  }

  if (!safeSave(ctx)) return;
  try {
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(scx, scy);

    const g = safeLinearGradient(ctx, 0, -srad, 0, srad, '#74C353');
    safeAddColorStop(g, 0, '#7FD45E', '#7FD45E');
    safeAddColorStop(g, 1, '#4E9A35', '#4E9A35');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#5A3928';
    ctx.lineWidth = Math.max(1.2, srad * 0.22);
    ctx.beginPath();
    ctx.arc(0, 0, srad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#FFFDF7';
    ctx.lineWidth = Math.max(1.5, srad * 0.34);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-srad * 0.42, srad * 0.02);
    ctx.lineTo(-srad * 0.10, srad * 0.36);
    ctx.lineTo(srad * 0.46, -srad * 0.32);
    ctx.stroke();
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

/**
 * Draw sapphire/cyan target lock emblem for preferred customer seat (upgraded by ui_v090_skin_patch).
 */
function drawPriorityTargetBadge(ctx, cx, cy, radius = 8, nowSec = 0, opts = {}) {
  const srad = toSafeNum(radius, 0);
  if (!isCanvasCtx(ctx) || !(srad > 0)) return;
  const scx = toSafeNum(cx, 0);
  const scy = toSafeNum(cy, 0);
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const alpha = Math.max(0, Math.min(1, toSafeNum(getOwnProp(safeOpts, 'alpha', 1), 1)));
  const t = toSafeNum(nowSec, 0);
  const pulse = 1 + 0.10 * Math.sin(t * 6.5);

  if (!safeSave(ctx)) return;
  try {
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(scx, scy);
    ctx.strokeStyle = '#4BE8FF';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, srad * pulse, 0, Math.PI * 2);
    ctx.stroke();
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

/**
 * Draw 5-pointed star icon (uses v0.9.0 `icon_star_coin.webp` / `icon_star_dim.webp` when `opts.sprites` passed).
 */
function drawStarIcon(ctx, cx, cy, outerR, filled = true, opts = {}) {
  const sor = toSafeNum(outerR, 0);
  if (!isCanvasCtx(ctx) || !(sor > 0)) return;
  const scx = toSafeNum(cx, 0);
  const scy = toSafeNum(cy, 0);
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const alpha = Math.max(0, Math.min(1, toSafeNum(getOwnProp(safeOpts, 'alpha', 1), 1)));
  const rot = toSafeNum(getOwnProp(safeOpts, 'rot', 0), 0);
  const sp = getOwnProp(safeOpts, 'sprites', null);
  const starImg = sp ? resolveByIdSprite(sp, filled ? 'icon_star_coin' : 'icon_star_dim') : null;

  if (starImg && safeSave(ctx)) {
    try {
      if (alpha < 1) ctx.globalAlpha *= alpha;
      ctx.translate(scx, scy);
      if (rot) ctx.rotate(rot);
      drawContainImage(ctx, starImg, 0, 0, sor * 2.25, sor * 2.25);
      return;
    } catch (_) {} finally {
      safeRestore(ctx);
    }
  }

  const innerR = sor * 0.46;
  const defLw = Math.max(1.2, sor * 0.18);
  const lw = Math.max(0.1, toSafeNum(getOwnProp(safeOpts, 'lineWidth', defLw), defLw));

  if (!safeSave(ctx)) return;
  try {
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(scx, scy);
    if (rot) ctx.rotate(rot);

    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI * 0.5 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? sor : innerR;
      if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();

    if (Boolean(filled)) {
      const g = safeLinearGradient(ctx, 0, -sor, 0, sor, '#FFE880');
      safeAddColorStop(g, 0, '#FFE880', '#FFE880');
      safeAddColorStop(g, 1, '#F5A623', '#F5A623');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#5A3928';
    } else {
      ctx.fillStyle = 'rgba(90, 57, 40, 0.36)';
      ctx.strokeStyle = '#5A3928';
    }
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.fill();
    ctx.stroke();

    if (Boolean(filled)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.beginPath();
      ctx.arc(-sor * 0.18, -sor * 0.20, Math.max(0.9, sor * 0.14), 0, Math.PI * 2);
      ctx.fill();
    }
  } catch (_) {} finally {
    safeRestore(ctx);
  }
}

/**
 * Interactive hit-target registry rebuilt cleanly each frame in paint order.
 * Hit testing runs reverse-order so topmost modal/floating controls capture first.
 */
const MAX_HIT_ITEMS = 1024;

class HitRegistry {
  constructor() {
    try {
      Object.defineProperty(this, 'items', {
        __proto__: null,
        value: [],
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (_) {}
  }

  clear() {
    if (!this || typeof this !== 'object' || safeIsFrozen(this)) return;
    const items = getOwnProp(this, 'items', null);
    if (!safeIsArray(items) || safeIsFrozen(items) || !safeIsExtensible(items)) return;
    try {
      items.length = 0;
    } catch (_) {}
  }

  add(id, x, y, w, h, onClick, meta = null) {
    if (!this || typeof this !== 'object' || safeIsFrozen(this)) return;
    const items = getOwnProp(this, 'items', null);
    if (!safeIsArray(items) || safeIsFrozen(items) || !safeIsExtensible(items)) return;
    if (safeArrayLen(items, MAX_HIT_ITEMS + 1) >= MAX_HIT_ITEMS) return;
    const sx = toSafeNum(x, NaN);
    const sy = toSafeNum(y, NaN);
    const sw = toSafeNum(w, NaN);
    const sh = toSafeNum(h, NaN);
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !(sw > 0) || !(sh > 0)) return;
    const sid = toSafeText(id, '');
    const safeFn = typeof onClick === 'function' ? onClick : null;
    let safeMeta = meta && typeof meta === 'object' ? meta : null;
    if (safeMeta && hasOwnProp(safeMeta, 'clipRect')) {
      const rawCr = getOwnProp(safeMeta, 'clipRect', null);
      let cleanCr = null;
      if (rawCr && typeof rawCr === 'object') {
        const cx = toSafeNum(getOwnProp(rawCr, 'x', NaN), NaN);
        const cy = toSafeNum(getOwnProp(rawCr, 'y', NaN), NaN);
        const cw = toSafeNum(getOwnProp(rawCr, 'w', NaN), NaN);
        const ch = toSafeNum(getOwnProp(rawCr, 'h', NaN), NaN);
        if (Number.isFinite(cx) && Number.isFinite(cy) && cw > 0 && ch > 0) {
          cleanCr = { x: cx, y: cy, w: cw, h: ch };
        }
      }
      try {
        safeMeta = { ...safeMeta, clipRect: cleanCr };
      } catch (_) {
        safeMeta = cleanCr ? { clipRect: cleanCr } : null;
      }
    }
    safePush(items, { id: sid, x: sx, y: sy, w: sw, h: sh, onClick: safeFn, meta: safeMeta });
  }

  findAt(px, py) {
    if (!this || typeof this !== 'object') return null;
    const items = getOwnProp(this, 'items', null);
    if (!safeIsArray(items)) return null;
    const x = toSafeNum(px, NaN);
    const y = toSafeNum(py, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const count = safeArrayLen(items, MAX_HIT_ITEMS);
    for (let i = count - 1; i >= 0; i--) {
      let it = null;
      try {
        if (!OWN_PROP.call(items, i)) continue;
        it = items[i];
      } catch (_) {
        continue;
      }
      if (!it || typeof it !== 'object') continue;
      const ix = toSafeNum(getOwnProp(it, 'x', NaN), NaN);
      const iy = toSafeNum(getOwnProp(it, 'y', NaN), NaN);
      const iw = toSafeNum(getOwnProp(it, 'w', NaN), NaN);
      const ih = toSafeNum(getOwnProp(it, 'h', NaN), NaN);
      if (!Number.isFinite(ix) || !Number.isFinite(iy) || !(iw > 0) || !(ih > 0)) continue;
      const meta = getOwnProp(it, 'meta', null);
      const cr = meta && typeof meta === 'object' ? getOwnProp(meta, 'clipRect', null) : null;
      if (cr && typeof cr === 'object') {
        const cx = toSafeNum(getOwnProp(cr, 'x', NaN), NaN);
        const cy = toSafeNum(getOwnProp(cr, 'y', NaN), NaN);
        const cw = toSafeNum(getOwnProp(cr, 'w', NaN), NaN);
        const ch = toSafeNum(getOwnProp(cr, 'h', NaN), NaN);
        if (!Number.isFinite(cx) || !Number.isFinite(cy) || !(cw > 0) || !(ch > 0)) continue;
        if (x < cx || x > cx + cw || y < cy || y > cy + ch) continue;
      }
      if (x >= ix && x <= ix + iw && y >= iy && y <= iy + ih) {
        return it;
      }
    }
    return null;
  }
}

module.exports = {
  FONT_FAMILY,
  KISSA_THEME,
  fontStr,
  hslToRgbColor,
  roundRectPath,
  fillEllipse,
  drawStar,
  drawSakuraPetal,
  drawHeartIcon,
  drawCoverImage,
  drawContainImage,
  getReadyImageDims,
  isReadyImage,
  drawUiIcon,
  drawWoodBoard,
  drawParchmentSheet,
  drawKissaCard,
  drawTagBadge,
  drawNoticeBanner,
  drawCurrencyChip,
  drawPillButton,
  wrapText,
  drawWrappedText,
  drawFitText,
  drawRainbowWildcard,
  drawGoldenAura,
  drawThemeSwatch,
  drawFlavorBadge,
  drawBoardTileOverlay,
  drawCatcakeSprite,
  drawCustomerPortrait,
  drawCheckmarkBadge,
  drawPriorityTargetBadge,
  drawStarIcon,
  HitRegistry
};

const { applyV090Skin } = require('./ui_v090_skin_patch');
applyV090Skin(module.exports);

