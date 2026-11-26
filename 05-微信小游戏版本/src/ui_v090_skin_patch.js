'use strict';

/**
 * 《一起做猫饼》v0.9.0 — 严格对齐 13 张定稿 UI 设计图与原 src/ui_draw.js 的无损换皮补丁与新增组件库
 *
 * 设计原则：
 *   1. 不破坏原 ui_draw.js 里的微信兼容工具、HitRegistry、精灵渲染与安全几何逻辑；
 *   2. 严格匹配原文件真实导出的 KISSA_THEME 键名与核心视觉函数签名，并完全兼容 style/tone/icon/sprites/mutedSlash 等参数；
 *   3. 零 hsl()/hsla() 颜色字符串、零彩色 Unicode Emoji、全量 Node 无头 stub-ctx 安全护栏；
 *   4. 在原 src/ui_draw.js 末尾仅需追加 2 行代码即可无损升级全站视觉并挂载 v0.9.0 新组件：
 *        const { applyV090Skin } = require('./ui_v090_skin_patch');
 *        applyV090Skin(module.exports);
 */

const V090_KISSA_THEME = {
  ink: '#5A3928',        // 全站统一暖深棕描边与主字色
  inkSoft: '#754C36',    // 次级暖棕文字
  inkMuted: '#99735B',   // 说明/禁用浅棕文字
  creamLight: '#FFF8EC', // 奶油羊皮纸主底板
  creamMid: '#F7EAD2',   // 内嵌米白卡片底
  creamDeep: '#F2E2C4',  // 凹槽底板 / 统计底
  borderWarm: '#8A5634', // 烘焙暖木框色
  brassLight: '#FFD466', // 蜂蜜金按钮亮部
  brassMid: '#F5A623',   // 蜂蜜金按钮主色
  brassDark: '#C87A1E'   // 蜂蜜金按钮 3D 厚度底边
};

const V090_EXT_COLORS = {
  woodDark: '#6D432B',
  woodMain: '#8A5634',
  woodLight: '#A86F47',
  woodDeep: '#593622',
  awningRed: '#D95D48',
  awningCream: '#FFF3DF',
  urgentOrange: '#F27C38',
  vipGold: '#F5B841',
  feverStart: '#B56CF5',
  feverEnd: '#F5B841',
  patienceGreen: '#74C353',
  patienceYellow: '#F5B841',
  patienceRed: '#E85C5C',
  priorityCyan: '#4BE8FF',
  lockedCardBg: '#DFD6C7',
  lockedBorder: '#8C8073',
  modalScrim: 'rgba(18, 22, 42, 0.64)'
};

const CHAPTER_THEMES = {
  amber: {
    skyTop: '#1A213D',
    skyMid: '#262F54',
    skyBot: '#35406B',
    pathColor: '#5B6285',
    starColor: '#FFE599'
  },
  sakura: {
    skyTop: '#3B2549',
    skyMid: '#5E3B62',
    skyBot: '#8D5870',
    pathColor: '#F6E4CE',
    starColor: '#FFD6E7'
  },
  moonlight: {
    skyTop: '#161F45',
    skyMid: '#25356B',
    skyBot: '#3E5594',
    pathColor: '#BFE4FF',
    starColor: '#FFF2B2'
  }
};

const DEFAULT_FALLBACK_FONT = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';
let _customFontFamily = '';
let _boundUi = null;

function _isCtx(ctx) {
  try {
    return Boolean(
      ctx &&
        typeof ctx === 'object' &&
        typeof ctx.save === 'function' &&
        typeof ctx.restore === 'function' &&
        typeof ctx.beginPath === 'function' &&
        typeof ctx.closePath === 'function' &&
        typeof ctx.fill === 'function' &&
        typeof ctx.stroke === 'function'
    );
  } catch (_) {
    return false;
  }
}

function _num(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function _clamp(v, lo, hi) {
  const n = _num(v, lo);
  return n < lo ? lo : n > hi ? hi : n;
}

function _linearGrad(ctx, x0, y0, x1, y1, fallbackColor) {
  try {
    if (typeof ctx.createLinearGradient === 'function') {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      if (g && typeof g.addColorStop === 'function') return g;
    }
  } catch (_) {}
  return fallbackColor;
}

function _addStop(grad, offset, color) {
  try {
    if (grad && typeof grad.addColorStop === 'function') {
      grad.addColorStop(_clamp(offset, 0, 1), color);
    }
  } catch (_) {}
}

function _imgDims(img) {
  if (!img || typeof img !== 'object') return null;
  const w = _num(img.naturalWidth || img.width, 0);
  const h = _num(img.naturalHeight || img.height, 0);
  if (w > 0 && h > 0) return { w, h };
  return null;
}

/**
 * 启动时加载裁剪后的圆体 TTF（约 368KB，统一名称表 KissaRound），自动注入全站 fontStr()
 * iOS 微信小游戏 Canvas 2D 要求整数 px、无引号单一自定义字体名（CoreText/Skia 自动回退系统字体显示生僻昵称）
 */
function initGameFont(fontPath = 'assets/fonts/kissa_round.ttf') {
  if (_customFontFamily) return getFontFamily();
  if (typeof wx !== 'undefined' && wx && typeof wx.loadFont === 'function') {
    const clean = String(fontPath || 'assets/fonts/kissa_round.ttf').replace(/^\/+/, '');
    const candidates = [clean, `/${clean}`];
    for (let i = 0; i < candidates.length; i++) {
      try {
        const fam = wx.loadFont(candidates[i]);
        if (typeof fam === 'string' && fam.trim()) {
          _customFontFamily = fam.trim();
          break;
        }
      } catch (_) {
        // 尝试备用路径或降级为系统字体
      }
    }
  }
  return getFontFamily();
}

function getFontFamily() {
  if (_customFontFamily) {
    // 微信小游戏真机（尤其 iOS 原生 Canvas 2D）解析多字体逗号列表/双引号时容易失效，
    // 当字体名无空格（如 KissaRound）直接返回纯字体名，缺失生僻字由系统 CoreText/Skia 自动回退。
    if (typeof wx !== 'undefined' && wx && typeof wx.loadFont === 'function') {
      return /\s/.test(_customFontFamily) ? `"${_customFontFamily}"` : _customFontFamily;
    }
    return `"${_customFontFamily}", ${DEFAULT_FALLBACK_FONT}`;
  }
  return DEFAULT_FALLBACK_FONT;
}

function fontStr(px, weight = 700) {
  const safePx = Math.max(6, Math.min(120, Math.round(_num(px, 14))));
  const isBold =
    typeof weight === 'string'
      ? /bold|[6-9]00/i.test(weight)
      : _num(weight, 700) >= 600;
  // 微信真机上 kissa_round.ttf 本身已是 Bold 粗圆体字形（表内标记为 Regular 以避开 iOS 权重匹配失配），
  // 因此加载成功后直接输出 `${safePx}px KissaRound`；未加载时使用标准 `bold` 关键字避免 iOS 忽略 700/800 数值字重。
  if (_customFontFamily && typeof wx !== 'undefined' && wx && typeof wx.loadFont === 'function') {
    return `${safePx}px ${getFontFamily()}`;
  }
  return `${isBold ? 'bold' : 'normal'} ${safePx}px ${getFontFamily()}`;
}

/**
 * 动态计算微信小游戏安全区布局参数（自动避让右上角胶囊与底部 Home Indicator）
 * 同时兼容无头 E2E/Node 传入的 metrics 参数
 */
function getSafeLayout(screenW, screenH, metrics = null) {
  const sw = Math.max(320, _num(screenW, 390));
  const sh = Math.max(480, _num(screenH, 844));
  let top = 20;
  let capsuleTop = 10;
  let capsuleBottom = 56;
  let capsuleLeft = sw - 98;
  let capsuleRight = sw - 8;
  let safeBottom = 14;

  if (metrics && typeof metrics === 'object') {
    if (Number.isFinite(metrics.safeTop)) top = Math.max(8, metrics.safeTop);
    if (Number.isFinite(metrics.safeBottom)) safeBottom = Math.max(8, metrics.safeBottom);
    const mr = metrics.menuRect;
    if (mr && typeof mr === 'object' && Number.isFinite(mr.bottom) && mr.bottom > 0) {
      capsuleTop = Math.max(4, Math.round(_num(mr.top, top)));
      capsuleBottom = Math.round(mr.bottom) + 8;
      capsuleLeft = Math.floor(_num(mr.left, sw - 96)) - 8;
      capsuleRight = Math.ceil(_num(mr.right, sw - 8));
      return {
        top,
        capsuleTop,
        capsuleBottom,
        capsuleLeft,
        capsuleRight,
        safeBottom,
        contentPaddingX: Math.round(sw * 0.035)
      };
    }
  }

  if (typeof wx !== 'undefined' && wx) {
    try {
      const sys = typeof wx.getWindowInfo === 'function'
        ? wx.getWindowInfo()
        : typeof wx.getSystemInfoSync === 'function'
        ? wx.getSystemInfoSync()
        : null;
      if (sys && sys.safeArea) {
        top = Math.max(10, _num(sys.safeArea.top, top));
        safeBottom = Math.max(10, _num(sys.windowHeight, sh) - _num(sys.safeArea.bottom, sh));
      }
      if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
        const rect = wx.getMenuButtonBoundingClientRect();
        if (rect && rect.bottom) {
          capsuleTop = Math.max(4, Math.round(_num(rect.top, top)));
          capsuleBottom = Math.round(rect.bottom) + 8;
          capsuleLeft = Math.floor(_num(rect.left, sw - 96)) - 8;
          capsuleRight = Math.ceil(_num(rect.right, sw - 8));
        }
      }
    } catch (_) {
      // 使用安全默认值
    }
  }

  return {
    top,
    capsuleTop,
    capsuleBottom,
    capsuleLeft,
    capsuleRight,
    safeBottom,
    contentPaddingX: Math.round(sw * 0.035)
  };
}

function _roundRect(ctx, x, y, w, h, r = 12) {
  const radii = Array.isArray(r) ? r : [r, r, r, r];
  const [tl, tr, br, bl] = radii.map((v) => Math.max(0, Math.min(_num(v, 0), w / 2, h / 2)));
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/**
 * 卡通圆角描边字（强制 lineJoin='round' + miterLimit=2 防描边毛刺）
 * 支持 maxWidth 自动等比缩字防裁剪
 */
function drawOutlinedText(ctx, text, x, y, opts = {}) {
  if (!_isCtx(ctx)) return;
  const o = opts && typeof opts === 'object' ? opts : {};
  const size = Math.max(7, _num(o.size, 20));
  const minSize = Math.max(6, _num(o.minSize, Math.max(8, size * 0.68)));
  const weight = _num(o.weight, 800);
  const fill = o.fill || V090_KISSA_THEME.creamLight;
  const stroke = o.stroke !== undefined ? o.stroke : V090_KISSA_THEME.ink;
  const strokeWidth = Math.max(0, _num(o.strokeWidth, 3.4));
  const shadowOffsetY = Math.max(0, _num(o.shadowOffsetY, 1.4));
  const align = o.align || 'center';
  const baseline = o.baseline || 'middle';
  const maxWidth = _num(o.maxWidth, 0);

  const str = String(text === null || text === undefined ? '' : text);
  if (!str) return;

  ctx.save();
  try {
    let finalSize = size;
    ctx.font = fontStr(finalSize, weight);
    if (maxWidth > 0 && typeof ctx.measureText === 'function') {
      let measured = _num(ctx.measureText(str).width, 0);
      while (measured > maxWidth && finalSize > minSize) {
        finalSize = Math.max(minSize, finalSize - 0.8);
        ctx.font = fontStr(finalSize, weight);
        measured = _num(ctx.measureText(str).width, 0);
      }
    }
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;

    const scaledStroke = strokeWidth > 0 ? Math.max(1.2, strokeWidth * (finalSize / size)) : 0;
    const canStroke = typeof ctx.strokeText === 'function';
    const canFill = typeof ctx.fillText === 'function';

    if (shadowOffsetY > 0 && scaledStroke > 0 && canStroke) {
      ctx.strokeStyle = 'rgba(90, 57, 40, 0.30)';
      ctx.lineWidth = scaledStroke;
      if (maxWidth > 0) ctx.strokeText(str, x, y + shadowOffsetY, maxWidth);
      else ctx.strokeText(str, x, y + shadowOffsetY);
    }
    if (scaledStroke > 0 && stroke && canStroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = scaledStroke;
      if (maxWidth > 0) ctx.strokeText(str, x, y, maxWidth);
      else ctx.strokeText(str, x, y);
    }
    if (canFill) {
      ctx.fillStyle = fill;
      if (maxWidth > 0) ctx.fillText(str, x, y, maxWidth);
      else ctx.fillText(str, x, y);
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/* ======================== 原有核心函数无损视觉升级 ======================== */

/**
 * 暖木相框底板（严格匹配原签名 drawWoodBoard(ctx, x, y, w, h, radius = 15, withRivets = true)）
 */
function drawWoodBoard(ctx, x, y, w, h, radius = 15, withRivets = true) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const rad = Math.max(0, _num(radius, 15));

  ctx.save();
  try {
    ctx.shadowColor = 'rgba(26, 20, 18, 0.38)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;

    const grad = _linearGrad(ctx, sx, sy, sx, sy + sh, V090_EXT_COLORS.woodMain);
    _addStop(grad, 0, V090_EXT_COLORS.woodLight);
    _addStop(grad, 0.16, V090_EXT_COLORS.woodMain);
    _addStop(grad, 1, V090_EXT_COLORS.woodDark);
    _roundRect(ctx, sx, sy, sw, sh, rad);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = V090_KISSA_THEME.ink;
    ctx.stroke();

    // 微妙木纹水平线（仅在大木框可见）
    if (sw > 80 && sh > 60) {
      ctx.save();
      try {
        _roundRect(ctx, sx + 3, sy + 3, sw - 6, sh - 6, Math.max(4, rad - 3));
        if (typeof ctx.clip === 'function') ctx.clip();
        ctx.strokeStyle = 'rgba(90, 57, 40, 0.14)';
        ctx.lineWidth = 1.2;
        const step = Math.max(22, Math.round(sh / 14));
        for (let gy = sy + 16; gy < sy + sh - 12; gy += step) {
          ctx.beginPath();
          ctx.moveTo(sx + 6, gy);
          ctx.lineTo(sx + sw - 6, gy);
          ctx.stroke();
        }
      } finally {
        ctx.restore();
      }
    }

    // 内框暖光高光线
    if (sw > 10 && sh > 10) {
      _roundRect(ctx, sx + 3.5, sy + 3.5, sw - 7, sh - 7, Math.max(4, rad - 3.5));
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(255, 240, 212, 0.30)';
      ctx.stroke();
    }

    if (withRivets && sw >= 64 && sh >= 48) {
      const inset = 11;
      const pts = [
        [sx + inset, sy + inset],
        [sx + sw - inset, sy + inset],
        [sx + inset, sy + sh - inset],
        [sx + sw - inset, sy + sh - inset]
      ];
      for (let i = 0; i < pts.length; i++) {
        const rx = pts[i][0];
        const ry = pts[i][1];
        ctx.beginPath();
        ctx.arc(rx, ry, 3.0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFE08A';
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = V090_KISSA_THEME.ink;
        ctx.stroke();
      }
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 奶油羊皮纸内板（严格匹配原签名）
 */
function drawParchmentSheet(
  ctx,
  x,
  y,
  w,
  h,
  radius = 11,
  topCol = V090_KISSA_THEME.creamLight,
  botCol = V090_KISSA_THEME.creamMid,
  borderCol = V090_KISSA_THEME.ink,
  lineWidth = 2.4
) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const rad = Math.max(0, _num(radius, 11));
  const lw = Math.max(0, _num(lineWidth, 2.4));

  ctx.save();
  try {
    const grad = _linearGrad(ctx, sx, sy, sx, sy + sh, topCol);
    _addStop(grad, 0, topCol);
    _addStop(grad, 1, botCol);
    _roundRect(ctx, sx, sy, sw, sh, rad);
    ctx.fillStyle = grad;
    ctx.fill();

    if (sw > 14 && sh > 14) {
      _roundRect(ctx, sx + 2, sy + 2, sw - 4, sh - 4, Math.max(3, rad - 2));
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
      ctx.stroke();
    }

    if (lw > 0) {
      _roundRect(ctx, sx, sy, sw, sh, rad);
      ctx.lineWidth = lw;
      ctx.strokeStyle = borderCol;
      ctx.stroke();
    }

    // Storybook subtle parchment edge notches (top-right & left-mid, matching Designs 04/06/07/10/11)
    if (sw > 140 && sh > 140 && lw > 0) {
      ctx.fillStyle = V090_EXT_COLORS.woodDark;
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = Math.max(1.2, lw * 0.7);

      const n1x = sx + sw * 0.78;
      ctx.beginPath();
      ctx.moveTo(n1x - 4, sy);
      ctx.lineTo(n1x, sy + 4.5);
      ctx.lineTo(n1x + 4, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const n2y = sy + sh * 0.62;
      ctx.beginPath();
      ctx.moveTo(sx, n2y - 4);
      ctx.lineTo(sx + 4.5, n2y);
      ctx.lineTo(sx, n2y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 统一奶油卡片组件（严格兼容原 tone 与 v0.9.0 locked/selected/highlighted/金银铜行色）
 */
function drawKissaCard(ctx, x, y, w, h, opts = {}) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const o = opts && typeof opts === 'object' ? opts : {};

  const radius = Math.max(0, _num(o.radius, 12));
  const tone = typeof o.tone === 'string' ? o.tone : 'cream';
  const locked = Boolean(o.locked);
  const isHi = Boolean(o.selected || o.highlighted || tone === 'selected');
  const borderOverride = typeof o.borderColor === 'string' && o.borderColor ? o.borderColor : null;
  const customFill = typeof o.fill === 'string' && o.fill ? o.fill : null;
  const customLineW = Number.isFinite(o.lineWidth) ? o.lineWidth : null;

  const TONE_MAP = {
    cream: { top: '#FFFDF7', bot: '#F7EAD2', border: '#5A3928', lip: 'rgba(90, 57, 40, 0.14)' },
    recess: { top: '#F5E7CE', bot: '#EEDAB8', border: '#C9AE86', lip: null },
    selected: { top: '#FFF9DE', bot: '#FFE89E', border: '#F5B841', lip: 'rgba(200, 122, 30, 0.25)' },
    equipped: { top: '#F4FBE8', bot: '#E0F1CB', border: '#5A7F2E', lip: 'rgba(72, 108, 36, 0.20)' },
    amber: { top: '#FFF4CF', bot: '#FBE09B', border: '#A86F32', lip: 'rgba(138, 86, 52, 0.18)' },
    soft: { top: '#F3E8D6', bot: '#E9DBC2', border: '#9E856B', lip: null },
    wood: { top: '#945F3B', bot: '#6D432B', border: '#5A3928', lip: 'rgba(40, 22, 12, 0.28)' },
    goldRow: { top: '#FFF1AE', bot: '#F9DC74', border: '#8A5634', lip: 'rgba(138, 86, 52, 0.18)' },
    silverRow: { top: '#F1F4F8', bot: '#DCE2EC', border: '#6B7482', lip: 'rgba(60, 70, 88, 0.16)' },
    bronzeRow: { top: '#F7DBBF', bot: '#E9B98B', border: '#8A5634', lip: 'rgba(120, 68, 36, 0.18)' },
    myRankRow: { top: '#FFD35E', bot: '#F39E22', border: '#5A3928', lip: 'rgba(90, 57, 40, 0.28)' }
  };
  const pal = TONE_MAP[tone] || TONE_MAP.cream;

  ctx.save();
  try {
    if (!locked && pal.lip) {
      _roundRect(ctx, sx, sy + 2, sw, sh, radius);
      ctx.fillStyle = pal.lip;
      ctx.fill();
    }

    _roundRect(ctx, sx, sy, sw, sh, radius);
    if (locked) {
      const lg = _linearGrad(ctx, sx, sy, sx, sy + sh, '#A2988A');
      _addStop(lg, 0, o.topCol || '#A49B8E');
      _addStop(lg, 1, o.botCol || '#897F72');
      ctx.fillStyle = lg;
    } else if (customFill) {
      ctx.fillStyle = customFill;
    } else {
      const grad = _linearGrad(ctx, sx, sy, sx, sy + sh, pal.top);
      _addStop(grad, 0, o.topCol || pal.top);
      _addStop(grad, 1, o.botCol || pal.bot);
      ctx.fillStyle = grad;
    }
    ctx.fill();

    // Design 04 double-framed recessed square tile (ivory outer border ring + warm beige inner square)
    if (o.doubleRecess && !locked && sw > 22 && sh > 22) {
      const inset = Math.max(4, Math.min(6, Math.round(Math.min(sw, sh) * 0.085)));
      const ig = _linearGrad(ctx, sx + inset, sy + inset, sx + inset, sy + sh - inset, '#F0E1C4');
      _addStop(ig, 0, '#E8D5B2');
      _addStop(ig, 0.25, '#F2E4C8');
      _addStop(ig, 1, '#EDE0C4');
      _roundRect(ctx, sx + inset, sy + inset, sw - inset * 2, sh - inset * 2, Math.max(4, radius - inset * 0.7));
      ctx.fillStyle = ig;
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = 'rgba(138, 86, 52, 0.22)';
      ctx.stroke();
    } else if (!locked && sw > 16 && sh > 16 && tone !== 'wood') {
      _roundRect(ctx, sx + 1.5, sy + 1.5, sw - 3, sh - 3, Math.max(3, radius - 1.5));
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
      ctx.stroke();
    }

    _roundRect(ctx, sx, sy, sw, sh, radius);
    if (isHi && !locked) {
      ctx.shadowColor = o.goldenGlow ? 'rgba(255, 212, 74, 0.88)' : 'rgba(245, 184, 65, 0.72)';
      ctx.shadowBlur = o.goldenGlow ? 14 : 10;
      ctx.lineWidth = customLineW !== null ? customLineW : 3.0;
      ctx.strokeStyle = borderOverride || (o.goldenGlow ? '#FFE46E' : V090_EXT_COLORS.vipGold);
    } else {
      ctx.lineWidth = customLineW !== null ? customLineW : 2.2;
      ctx.strokeStyle = borderOverride || (locked ? '#4E3829' : pal.border);
    }
    if (ctx.lineWidth > 0) ctx.stroke();

    if (o.goldenGlow && !locked) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0)';
      ctx.shadowBlur = 0;
      _roundRect(ctx, sx + 1.8, sy + 1.8, sw - 3.6, sh - 3.6, Math.max(3, radius - 1.8));
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#FFF7B8';
      ctx.stroke();

      // Delicate 4-point sparkles along golden rim (Design 09)
      const spPts = [
        [sx + sw * 0.22, sy + 1, 5.0],
        [sx + sw - 2, sy + sh * 0.24, 5.5],
        [sx + 2, sy + sh * 0.65, 4.5],
        [sx + sw * 0.78, sy + sh - 1, 4.8]
      ];
      ctx.fillStyle = '#FFFDF0';
      for (let i = 0; i < spPts.length; i++) {
        const px = spPts[i][0];
        const py = spPts[i][1];
        const sz = spPts[i][2];
        ctx.beginPath();
        ctx.moveTo(px, py - sz);
        ctx.quadraticCurveTo(px + sz * 0.22, py - sz * 0.22, px + sz, py);
        ctx.quadraticCurveTo(px + sz * 0.22, py + sz * 0.22, px, py + sz);
        ctx.quadraticCurveTo(px - sz * 0.22, py + sz * 0.22, px - sz, py);
        ctx.quadraticCurveTo(px - sz * 0.22, py - sz * 0.22, px, py - sz);
        ctx.closePath();
        ctx.fill();
      }
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 3D 果冻厚边按钮（严格兼容原 style/icon/sprites/mutedSlash/fallbackText 及 v0.9.0 variant/tone/label/subLabel）
 */
function drawPillButton(ctx, x, y, w, h, opts = {}) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const o = opts && typeof opts === 'object' ? opts : {};

  const caption = String(o.label || o.text || '');
  const subLabel = String(o.subLabel || '');
  const disabled = Boolean(o.disabled);
  const pressAmt = o.pressed ? 1 : _clamp(_num(o.pressProgress, 0), 0, 1);
  const radius = Math.min(sh / 2, _num(o.radius, Math.min(sh / 2, 18)));
  const styleKey = disabled ? 'disabled' : String(o.variant || o.tone || o.style || 'primary');

  const PRESETS = {
    primary: { top: '#FFD86B', bot: '#F5A420', bevel: '#C67418', text: '#5A3928', stroke: '', outline: false },
    cta: { top: '#FFE073', bot: '#F39821', bevel: '#B65D0E', text: '#5A3928', stroke: '', outline: false },
    knead: { top: '#FFE66E', mid: '#FAAD22', bot: '#EB8212', bevel: '#B5530A', text: '#FFFDF8', stroke: '#4A230D', outline: true, strokeW: 3.6, glossDot: true },
    amber: { top: '#FFD86B', bot: '#F5A420', bevel: '#C67418', text: '#5A3928', stroke: '', outline: false },
    caramel: { top: '#F9D88C', bot: '#E3A44B', bevel: '#AE6F22', text: '#5A3928', stroke: '', outline: false },
    gold: { top: '#FFE27D', bot: '#F5A623', bevel: '#C87A1E', text: '#5A3928', stroke: '', outline: false },
    active: { top: '#FFE27D', bot: '#F5B538', bevel: '#C87A1E', text: '#5A3928', stroke: '', outline: false },
    orange: { top: '#FFA45E', bot: '#F27C38', bevel: '#B84B14', text: '#FFF8EC', stroke: '#5A3928', outline: true },
    green: { top: '#94C954', bot: '#72A639', bevel: '#4B7122', text: '#FFF8EC', stroke: '#3D591D', outline: true },
    equipped: { top: '#939652', bot: '#73763B', bevel: '#4B4E23', text: '#FFF9E8', stroke: '#3C3D18', outline: true },
    secondary: { top: '#BE8150', bot: '#8A5634', bevel: '#5E361D', text: '#FFF8EC', stroke: '#5A3928', outline: true },
    wood: { top: '#BA7E4B', bot: '#7F4D2B', bevel: '#522E17', text: '#FFF8EC', stroke: '#4A2511', outline: true },
    walnut: { top: '#C48A55', bot: '#986036', bevel: '#663B1E', text: '#FFF8EC', stroke: '#5A3928', outline: true },
    dark: { top: '#7E543C', bot: '#5B3A27', bevel: '#3B2316', text: '#F5E6D3', stroke: '#3B2316', outline: true },
    muted: { top: '#845940', bot: '#69432E', bevel: '#4A2E1E', text: '#F5E6D3', stroke: '#3D2417', outline: true },
    danger: { top: '#EE7360', bot: '#CF4D3D', bevel: '#8E2D22', text: '#FFF8EC', stroke: '#5A241E', outline: true },
    card: { top: '#FFFDF6', bot: '#F3E4C8', bevel: '#C7AE8A', text: '#5A3928', stroke: '', outline: false },
    cardSelected: { top: '#FFF5C8', bot: '#F8D470', bevel: '#C68820', text: '#5A3928', stroke: '', outline: false },
    disabled: { top: '#BCB3A8', bot: '#9E948A', bevel: '#756C63', text: '#F2ECE5', stroke: '#5E564E', outline: false }
  };

  const pal = PRESETS[styleKey] || PRESETS.primary;
  const useOutline = o.textOutline !== undefined ? Boolean(o.textOutline) : Boolean(pal.outline);
  const useGlossDot = o.glossDot !== undefined ? Boolean(o.glossDot) : Boolean(pal.glossDot);
  const maxBevel = disabled ? 2 : Math.min(6, Math.max(2.5, Math.round(sh * 0.12)));
  const bevelH = Math.max(1.5, maxBevel * (1 - pressAmt * 0.65));
  const dy = pressAmt * Math.min(2.5, maxBevel * 0.65);
  const bodyH = Math.max(8, sh - maxBevel);
  const fontSize = Math.max(9.5, _num(o.fontSize, Math.round(sh * 0.40)));
  const textColor = typeof o.textColor === 'string' && o.textColor ? o.textColor : useOutline && !pal.outline ? '#FFFDF8' : pal.text;
  const strokeColor = typeof o.strokeColor === 'string' && o.strokeColor ? o.strokeColor : pal.stroke || '#4A230D';
  const hasRichSub = Boolean(o.subIcon || o.subPrefix || o.subSuffix);
  const hasAnySub = Boolean(subLabel || hasRichSub);

  ctx.save();
  try {
    // 底部 3D 厚度边
    _roundRect(ctx, sx, sy + dy + bevelH, sw, bodyH, radius);
    ctx.fillStyle = pal.bevel;
    ctx.fill();
    ctx.lineWidth = _num(o.borderWidth, 2.4);
    ctx.strokeStyle = V090_KISSA_THEME.ink;
    ctx.stroke();

    // 主体渐变面
    const grad = _linearGrad(ctx, sx, sy + dy, sx, sy + dy + bodyH, pal.top);
    _addStop(grad, 0, pal.top);
    if (pal.mid) _addStop(grad, 0.56, pal.mid);
    _addStop(grad, 1, pal.bot);
    _roundRect(ctx, sx, sy + dy, sw, bodyH, radius);
    ctx.fillStyle = grad;
    ctx.fill();

    // 可选暖木细木纹（对应设计图 03 底部移位叉/升阶勺木质按钮）
    if (o.woodGrain && !disabled && sw > 24 && bodyH > 24) {
      ctx.save();
      try {
        _roundRect(ctx, sx + 2, sy + dy + 2, sw - 4, bodyH - 4, Math.max(4, radius - 2));
        if (typeof ctx.clip === 'function') ctx.clip();
        ctx.strokeStyle = 'rgba(66, 34, 16, 0.18)';
        ctx.lineWidth = 1.1;
        for (let gy = sy + dy + 12; gy < sy + dy + bodyH - 8; gy += 11) {
          ctx.beginPath();
          ctx.moveTo(sx + 3, gy);
          ctx.quadraticCurveTo(sx + sw * 0.5, gy + 1.5, sx + sw - 3, gy - 0.8);
          ctx.stroke();
        }
      } finally {
        ctx.restore();
      }
    }

    _roundRect(ctx, sx, sy + dy, sw, bodyH, radius);
    ctx.lineWidth = _num(o.borderWidth, 2.4);
    ctx.strokeStyle = V090_KISSA_THEME.ink;
    ctx.stroke();

    // 顶部果冻柔光高光条
    if (sw > 18 && bodyH > 14 && !disabled) {
      const insetX = Math.min(Math.max(8, radius * 0.55), sw * 0.18);
      const hlX = sx + insetX;
      const hlW = Math.max(4, sw - insetX * 2);
      const hlH = Math.max(3, Math.min(7, bodyH * 0.20));
      _roundRect(ctx, hlX, sy + dy + 2.8, hlW, hlH, hlH * 0.5);
      ctx.fillStyle = useGlossDot ? 'rgba(255, 255, 232, 0.44)' : 'rgba(255, 255, 255, 0.34)';
      ctx.fill();

      if (useGlossDot && sw > 70) {
        ctx.fillStyle = 'rgba(255, 254, 240, 0.78)';
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(sx + Math.max(15, radius * 0.65), sy + dy + Math.max(9, bodyH * 0.25), 5.2, 2.8, -0.45, 0, Math.PI * 2);
        } else {
          ctx.arc(sx + Math.max(15, radius * 0.65), sy + dy + Math.max(9, bodyH * 0.25), 3.4, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    const cx = sx + sw * 0.5;
    const cy = sy + dy + bodyH * 0.5;
    const iconKey = typeof o.icon === 'string' ? o.icon : '';
    const sprites = o.sprites || null;
    const drawIconFn = _boundUi && typeof _boundUi.drawUiIcon === 'function' ? _boundUi.drawUiIcon : null;
    const iconSz = Math.min(bodyH - 4, _num(o.iconSize, Math.round(bodyH * 0.58)));

    let drewIcon = false;
    if (iconKey && sprites && drawIconFn) {
      if (!caption && !hasAnySub) {
        drewIcon = drawIconFn(ctx, sprites, iconKey, cx, cy, iconSz, disabled ? 0.55 : 1);
      } else {
        // Icon + Text horizontally centered as a group
        ctx.font = fontStr(fontSize, 800);
        const rawTextW = typeof ctx.measureText === 'function' ? _num(ctx.measureText(caption).width, caption.length * fontSize * 0.7) : caption.length * fontSize * 0.7;
        const clampedTextW = Math.min(rawTextW, Math.max(16, sw - iconSz - 16));
        const gap = 4;
        const groupW = iconSz + gap + clampedTextW;
        const startX = sx + Math.max(6, (sw - groupW) * 0.5);
        const iconCx = startX + iconSz * 0.5;
        drewIcon = drawIconFn(ctx, sprites, iconKey, iconCx, hasAnySub ? cy - bodyH * 0.14 : cy, iconSz, disabled ? 0.55 : 1);
        if (drewIcon) {
          const textX = startX + iconSz + gap;
          const availTextW = Math.max(14, sx + sw - 6 - textX);
          drawOutlinedText(ctx, caption, textX, hasAnySub ? cy - bodyH * 0.14 : cy + 0.5, {
            size: fontSize,
            weight: 800,
            fill: textColor,
            stroke: useOutline ? strokeColor : '',
            strokeWidth: useOutline ? _num(pal.strokeW, 2.6) : 0,
            shadowOffsetY: 0,
            align: 'left',
            baseline: 'middle',
            maxWidth: availTextW
          });
        }
      }
    }

    if (!drewIcon && !caption && o.fallbackText) {
      drawOutlinedText(ctx, o.fallbackText, cx, cy + 0.5, {
        size: Math.max(11, Math.round(bodyH * 0.50)),
        weight: 800,
        fill: textColor,
        stroke: useOutline ? strokeColor : '',
        strokeWidth: useOutline ? 2.2 : 0,
        shadowOffsetY: 0,
        maxWidth: sw - 8
      });
    } else if (caption && !drewIcon) {
      if (o.trailingCaret && !hasAnySub) {
        const caretW = 7;
        const caretGap = 4;
        ctx.font = fontStr(fontSize, 800);
        const rawTw = typeof ctx.measureText === 'function' ? _num(ctx.measureText(caption).width, caption.length * fontSize * 0.85) : caption.length * fontSize * 0.85;
        const maxTw = Math.max(16, sw - 12 - caretGap - caretW);
        const tw = Math.min(rawTw, maxTw);
        const groupW = tw + caretGap + caretW;
        const startX = sx + Math.max(6, (sw - groupW) * 0.5);
        drawOutlinedText(ctx, caption, startX, cy + 0.5, {
          size: fontSize,
          weight: 800,
          fill: textColor,
          stroke: useOutline ? strokeColor : '',
          strokeWidth: useOutline ? 2.2 : 0,
          shadowOffsetY: 0,
          align: 'left',
          baseline: 'middle',
          maxWidth: maxTw
        });
        const triCx = startX + tw + caretGap + caretW * 0.5;
        const triCy = cy + 0.8;
        ctx.fillStyle = textColor;
        ctx.beginPath();
        ctx.moveTo(triCx - 3.6, triCy - 2.2);
        ctx.lineTo(triCx + 3.6, triCy - 2.2);
        ctx.lineTo(triCx, triCy + 2.8);
        ctx.closePath();
        ctx.fill();
      } else {
        drawOutlinedText(ctx, caption, cx, hasAnySub ? cy - bodyH * 0.16 : cy + 0.6, {
          size: fontSize,
          weight: 900,
          fill: textColor,
          stroke: useOutline ? strokeColor : '',
          strokeWidth: useOutline ? _num(pal.strokeW, 3.0) : 0,
          shadowOffsetY: useGlossDot ? 1.4 : 0,
          maxWidth: sw - 14
        });
      }
    }

    if (hasRichSub) {
      const subSize = Math.max(10, Math.round(fontSize * 0.67));
      const subY = cy + bodyH * 0.25;
      const pre = String(o.subPrefix || '');
      const suf = String(o.subSuffix || '');
      const subIcSz = Math.round(subSize * 1.15);
      ctx.font = fontStr(subSize, 700);
      const preW = pre && typeof ctx.measureText === 'function' ? _num(ctx.measureText(pre).width, pre.length * subSize * 0.85) : pre.length * subSize * 0.85;
      const sufW = suf && typeof ctx.measureText === 'function' ? _num(ctx.measureText(suf).width, suf.length * subSize * 0.58) : suf.length * subSize * 0.58;
      const hasSubSprite = Boolean(o.subIcon && sprites && drawIconFn);
      const gapPre = pre && hasSubSprite ? 4 : 0;
      const gapSuf = suf && hasSubSprite ? 3 : 0;
      const rowW = preW + gapPre + (hasSubSprite ? subIcSz : 0) + gapSuf + sufW;
      let cursorX = cx - rowW * 0.5;
      if (pre) {
        drawOutlinedText(ctx, pre, cursorX, subY, {
          size: subSize,
          weight: 700,
          fill: textColor,
          stroke: '',
          strokeWidth: 0,
          shadowOffsetY: 0,
          align: 'left',
          baseline: 'middle',
          maxWidth: Math.max(20, sw * 0.5)
        });
        cursorX += preW + gapPre;
      }
      if (hasSubSprite) {
        drawIconFn(ctx, sprites, o.subIcon, cursorX + subIcSz * 0.5, subY - 0.5, subIcSz, disabled ? 0.55 : 1);
        cursorX += subIcSz + gapSuf;
      }
      if (suf) {
        drawOutlinedText(ctx, suf, cursorX, subY, {
          size: subSize,
          weight: 800,
          fill: textColor,
          stroke: '',
          strokeWidth: 0,
          shadowOffsetY: 0,
          align: 'left',
          baseline: 'middle',
          maxWidth: Math.max(20, sw * 0.45)
        });
      }
    } else if (subLabel) {
      drawOutlinedText(ctx, subLabel, cx, cy + bodyH * 0.25, {
        size: Math.max(9.5, Math.round(fontSize * 0.66)),
        weight: 700,
        fill: textColor,
        stroke: '',
        strokeWidth: 0,
        shadowOffsetY: 0,
        maxWidth: sw - 14
      });
    }

    if (o.mutedSlash) {
      ctx.strokeStyle = '#E85C5C';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx + sw * 0.22, sy + dy + bodyH * 0.22);
      ctx.lineTo(sx + sw * 0.78, sy + dy + bodyH * 0.78);
      ctx.stroke();
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 统一语义微标胶囊（兼容原 berry/sage/cocoa/soft/plum/frost 及 v0.9.0 amber/vip/urgent/red/green/wood/purple）
 */
function drawTagBadge(ctx, x, y, w, h, text, tone = 'amber', fontSize = 9.5, icon = '', sprites = null) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;

  const TONES = {
    amber: { bg: '#F5B841', fg: '#5A3928', stroke: '' },
    gold: { bg: '#F5B841', fg: '#5A3928', stroke: '' },
    butter: { bg: '#F8D78A', fg: '#5A3928', stroke: '' },
    vip: { bg: '#F5B841', fg: '#5A3928', stroke: '' },
    urgent: { bg: '#F27C38', fg: '#FFF8EC', stroke: '#5A3928' },
    berry: { bg: '#F27C38', fg: '#FFF8EC', stroke: '#5A3928' },
    red: { bg: '#E85C5C', fg: '#FFF8EC', stroke: '#5A3928' },
    green: { bg: '#74C353', fg: '#FFF8EC', stroke: '#3B5924' },
    matcha: { bg: '#74C353', fg: '#FFF8EC', stroke: '#3B5924' },
    sage: { bg: '#74C353', fg: '#FFF8EC', stroke: '#3B5924' },
    wood: { bg: '#7B4F32', fg: '#FFF8EC', stroke: '#5A3928' },
    cocoa: { bg: '#6D432B', fg: '#FFF8EC', stroke: '#5A3928' },
    soft: { bg: '#EFE0C6', fg: '#5A3928', stroke: '' },
    plum: { bg: '#9B6CF0', fg: '#FFF8EC', stroke: '#4A2B7A' },
    purple: { bg: '#9B6CF0', fg: '#FFF8EC', stroke: '#4A2B7A' },
    frost: { bg: '#D6F2FF', fg: '#205575', stroke: '' }
  };
  const pal = TONES[tone] || TONES.amber;
  const safeText = String(text === null || text === undefined ? '' : text);

  ctx.save();
  try {
    _roundRect(ctx, sx, sy, sw, sh, Math.min(sh / 2, 10));
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = V090_KISSA_THEME.ink;
    ctx.stroke();

    const drawIconFn = _boundUi && typeof _boundUi.drawUiIcon === 'function' ? _boundUi.drawUiIcon : null;
    let drewIcon = false;
    let icS = 0;
    if (icon && sprites && drawIconFn) {
      icS = Math.min(sh - 3, 13);
      drewIcon = drawIconFn(ctx, sprites, icon, sx + 4 + icS * 0.5, sy + sh * 0.5, icS);
    }

    const tx = drewIcon ? sx + 6 + icS : sx + 4;
    const tw = Math.max(10, sx + sw - 4 - tx);
    drawOutlinedText(ctx, safeText, tx + tw * 0.5, sy + sh * 0.5 + 0.4, {
      size: _num(fontSize, 9.5),
      minSize: 7.2,
      weight: 800,
      fill: pal.fg,
      stroke: pal.stroke,
      strokeWidth: pal.stroke ? 1.8 : 0,
      shadowOffsetY: 0,
      maxWidth: tw
    });
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 暖深木货币胶囊（星尘币 / 总星数等）
 */
function drawCurrencyChip(ctx, x, y, w, h, sprites, iconKey, valText, opts = {}) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const o = opts && typeof opts === 'object' ? opts : {};

  ctx.save();
  try {
    const grad = _linearGrad(ctx, sx, sy, sx, sy + sh, '#7B4F32');
    _addStop(grad, 0, '#805336');
    _addStop(grad, 1, '#583724');
    _roundRect(ctx, sx, sy, sw, sh, sh / 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#3E2518';
    ctx.stroke();

    const cy = sy + sh * 0.5;
    const iconSz = Math.min(sh - 3, Math.round(sh * 0.72));
    const leftPad = _num(o.leftPad, 7);
    const rightPad = _num(o.rightPad, 9);
    const iconGap = _num(o.iconGap, 5);
    const fontSz = _num(o.fontSize, Math.max(11.5, Math.round(sh * 0.50)));
    const safeVal = String(valText === null || valText === undefined ? '' : valText);
    const drawIconFn = _boundUi && typeof _boundUi.drawUiIcon === 'function' ? _boundUi.drawUiIcon : null;
    const canDrawIcon = Boolean(sprites && iconKey && drawIconFn);

    if (o.groupCenter && canDrawIcon) {
      ctx.font = fontStr(fontSz, 800);
      const rawW = typeof ctx.measureText === 'function' ? _num(ctx.measureText(safeVal).width, safeVal.length * fontSz * 0.72) : safeVal.length * fontSz * 0.72;
      const innerAvail = Math.max(20, sw - leftPad - rightPad);
      const textMaxW = Math.max(16, innerAvail - iconSz - iconGap);
      const usedTextW = Math.min(rawW, textMaxW);
      const groupW = iconSz + iconGap + usedTextW;
      const startX = sx + leftPad + Math.max(0, (innerAvail - groupW) * 0.5);
      const drewIcon = drawIconFn(ctx, sprites, iconKey, startX + iconSz * 0.5, cy, iconSz);
      const textX = drewIcon ? startX + iconSz + iconGap : sx + sw * 0.5;
      drawOutlinedText(ctx, safeVal, textX, cy + 0.6, {
        size: fontSz,
        minSize: 8.5,
        weight: 800,
        fill: '#FFF8EC',
        stroke: '#3E2518',
        strokeWidth: 2.2,
        shadowOffsetY: 0,
        align: drewIcon ? 'left' : 'center',
        baseline: 'middle',
        maxWidth: drewIcon ? textMaxW : innerAvail
      });
    } else {
      let drewIcon = false;
      if (canDrawIcon) {
        drewIcon = drawIconFn(ctx, sprites, iconKey, sx + leftPad + iconSz * 0.5, cy, iconSz);
      }
      const textStart = drewIcon ? sx + leftPad + iconSz + iconGap : sx + 8;
      const availW = Math.max(16, sx + sw - rightPad - textStart);
      const textAlign = o.align === 'left' ? 'left' : 'center';
      const tx = textAlign === 'left' ? textStart : textStart + availW * 0.5;
      drawOutlinedText(ctx, safeVal, tx, cy + 0.6, {
        size: fontSz,
        minSize: 8.5,
        weight: 800,
        fill: '#FFF8EC',
        stroke: '#3E2518',
        strokeWidth: 2.2,
        shadowOffsetY: 0,
        align: textAlign,
        baseline: 'middle',
        maxWidth: availW
      });
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 统一悬浮提示条 / Toast / 厨具提示横幅
 */
function drawNoticeBanner(ctx, x, y, w, h, opts = {}) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const o = opts && typeof opts === 'object' ? opts : {};

  const tone = typeof o.tone === 'string' ? o.tone : 'info';
  const TONES = {
    info: { bg: 'rgba(84, 52, 34, 0.94)', border: '#F5C45E', fg: '#FFF8EC', outline: true },
    wood: { bg: 'rgba(84, 52, 34, 0.94)', border: '#5A3928', fg: '#FFF8EC', outline: true },
    gold: { bg: '#FFE599', border: '#5A3928', fg: '#5A3928', outline: false },
    event: { bg: 'rgba(104, 54, 24, 0.95)', border: '#FFE078', fg: '#FFF8EC', outline: true },
    success: { bg: 'rgba(56, 108, 44, 0.94)', border: '#A6E088', fg: '#FFFDF5', outline: true },
    warn: { bg: 'rgba(166, 56, 40, 0.95)', border: '#FFB49A', fg: '#FFF6F0', outline: true }
  };
  const pal = TONES[tone] || TONES.info;
  const rad = Math.min(sh / 2, _num(o.radius, sh / 2));

  ctx.save();
  try {
    _roundRect(ctx, sx, sy, sw, sh, rad);
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = o.borderColor || pal.border;
    ctx.stroke();

    const drawIconFn = _boundUi && typeof _boundUi.drawUiIcon === 'function' ? _boundUi.drawUiIcon : null;
    let textLeft = sx + 10;
    if (o.icon && o.sprites && drawIconFn) {
      const icS = Math.min(sh - 4, _num(o.iconSize, 16));
      if (drawIconFn(ctx, o.sprites, o.icon, sx + 8 + icS * 0.5, sy + sh * 0.5, icS)) {
        textLeft = sx + 12 + icS;
      }
    }
    const rightRes = _num(o.rightReserve, 10);
    const availW = Math.max(20, sx + sw - rightRes - textLeft);
    const align = o.align || (o.icon ? 'left' : 'center');
    const tx = align === 'center' ? textLeft + availW * 0.5 : textLeft;

    if (o.text) {
      drawOutlinedText(ctx, o.text, tx, sy + sh * 0.5 + 0.5, {
        size: _num(o.fontSize, Math.max(10.5, Math.round(sh * 0.45))),
        minSize: 8.5,
        weight: 800,
        fill: o.textColor || pal.fg,
        stroke: pal.outline ? '#3D2214' : '',
        strokeWidth: pal.outline ? 2.0 : 0,
        shadowOffsetY: 0,
        align,
        baseline: 'middle',
        maxWidth: availW
      });
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 优先锁定顾客青蓝光环（对应设计图 03 左侧小狐狸头像双环准星光环）
 */
function drawPriorityTargetBadge(ctx, cx, cy, radius = 8, nowSec = 0, opts = {}) {
  if (!_isCtx(ctx)) return;
  const r = _num(radius, 8);
  if (!(r > 0)) return;
  const t = _num(nowSec, 0);
  const pulse = 0.80 + 0.20 * Math.sin(t * 5.2);
  const outerR = r * (1.16 + 0.03 * pulse);
  const innerR = r * (0.97 + 0.02 * pulse);
  const tickLen = Math.max(3.5, r * 0.22);

  ctx.save();
  try {
    // Soft luminous outer cyan mist ring
    ctx.strokeStyle = 'rgba(75, 232, 255, 0.34)';
    ctx.lineWidth = Math.max(4.5, r * 0.24);
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // Crisp outer ring
    ctx.strokeStyle = 'rgba(130, 244, 255, 0.82)';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = V090_EXT_COLORS.priorityCyan;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bright cyan reticle ring
    ctx.strokeStyle = V090_EXT_COLORS.priorityCyan;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.stroke();

    // 4 short inward reticle crosshair ticks (12, 3, 6, 9 o'clock — Design 03)
    ctx.strokeStyle = '#BDF8FF';
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0]
    ];
    for (let i = 0; i < dirs.length; i++) {
      const dx = dirs[i][0];
      const dy = dirs[i][1];
      ctx.beginPath();
      ctx.moveTo(cx + dx * (innerR + 1.5), cy + dy * (innerR + 1.5));
      ctx.lineTo(cx + dx * (innerR - tickLen), cy + dy * (innerR - tickLen));
      ctx.stroke();
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/* ======================== v0.9.0 新增视觉组件 ======================== */

/**
 * 星夜小铺 / 烤盘主题弹窗红白条纹波浪雨棚（对应设计图 06 & 09）
 */
function drawAwningHeader(ctx, x, y, w, h, stripes = 11) {
  if (!_isCtx(ctx)) return;
  const sx0 = _num(x, 0);
  const sy0 = _num(y, 0);
  const sw0 = _num(w, 0);
  const sh0 = _num(h, 0);
  if (!(sw0 > 0 && sh0 > 0)) return;
  const count = Math.max(5, Math.floor(_num(stripes, 11)));
  const topInset = 5;
  const topW = Math.max(20, sw0 - topInset * 2);
  const topSw = topW / count;
  const botSw = sw0 / count;
  const r = Math.min(botSw * 0.48, sh0 * 0.34);

  ctx.save();
  try {
    // 遮阳篷底面暖棕投影（投射到下方羊皮纸上）
    ctx.shadowColor = 'rgba(42, 20, 10, 0.36)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 3.5;

    for (let i = 0; i < count; i++) {
      const tx0 = sx0 + topInset + i * topSw;
      const tx1 = tx0 + topSw;
      const bx0 = sx0 + i * botSw;
      const bx1 = bx0 + botSw;
      const midBx = (bx0 + bx1) * 0.5;

      ctx.beginPath();
      ctx.moveTo(tx0, sy0);
      ctx.lineTo(tx1, sy0);
      ctx.lineTo(bx1, sy0 + sh0 - r);
      ctx.arc(midBx, sy0 + sh0 - r, r, 0, Math.PI, false);
      ctx.lineTo(bx0, sy0 + sh0 - r);
      ctx.closePath();

      const isRed = i % 2 === 0;
      const g = _linearGrad(ctx, midBx, sy0, midBx, sy0 + sh0, isRed ? '#DC5845' : '#FFF9EE');
      _addStop(g, 0, isRed ? '#E86E58' : '#FFFBF3');
      _addStop(g, 0.68, isRed ? '#D14B38' : '#F8EBDA');
      _addStop(g, 1, isRed ? '#B33B2A' : '#E7D3B8');
      ctx.fillStyle = g;
      ctx.fill();

      ctx.shadowColor = 'rgba(0, 0, 0, 0)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 1.9;
      ctx.strokeStyle = V090_KISSA_THEME.ink;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 4 格（或 N 格）分段升级进度条（对应设计图 06 猫饼升级与店面设备）
 */
function drawSegmentedBar(ctx, x, y, w, h, current, max = 4) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const segCount = Math.max(1, Math.floor(_num(max, 4)));
  const cur = _clamp(Math.floor(_num(current, 0)), 0, segCount);

  ctx.save();
  try {
    _roundRect(ctx, sx, sy, sw, sh, sh * 0.5);
    ctx.fillStyle = '#D6CCBE';
    ctx.fill();

    const segW = sw / segCount;
    ctx.save();
    try {
      _roundRect(ctx, sx, sy, sw, sh, sh * 0.5);
      if (typeof ctx.clip === 'function') ctx.clip();
      for (let i = 0; i < cur; i++) {
        const grad = _linearGrad(ctx, sx, sy, sx, sy + sh, '#F5A623');
        _addStop(grad, 0, '#FFE680');
        _addStop(grad, 0.55, '#F8B62E');
        _addStop(grad, 1, '#E58E16');
        ctx.fillStyle = grad;
        ctx.fillRect(sx + i * segW, sy, segW, sh);
        ctx.fillStyle = 'rgba(255, 252, 224, 0.42)';
        ctx.fillRect(sx + i * segW + 1, sy + 1, Math.max(2, segW - 2), Math.max(2, sh * 0.34));
      }
      ctx.strokeStyle = V090_KISSA_THEME.ink;
      ctx.lineWidth = 1.8;
      for (let i = 1; i < segCount; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + i * segW, sy);
        ctx.lineTo(sx + i * segW, sy + sh);
        ctx.stroke();
      }
    } finally {
      ctx.restore();
    }

    _roundRect(ctx, sx, sy, sw, sh, sh * 0.5);
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = V090_KISSA_THEME.ink;
    ctx.stroke();
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * v0.9.0 暖木风格厨余篮冷却格（严格禁止黑色遮罩，对应设计图 03 右侧 6s 厨余篮）
 */
function drawCooldownCell(ctx, x, y, w, h, remainingSec, opts = {}) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const o = opts && typeof opts === 'object' ? opts : {};

  const rem = Math.max(0, _num(remainingSec, 0));
  const isCooling = rem > 1e-6;
  const forkReady = Boolean(o.forkTrashReady);
  const trashImg = o.trashImg || null;
  const clockImg = o.clockImg || null;
  const label = forkReady ? '叉入销毁' : String(o.label || '厨余篮');
  const wobbleRot = _num(o.rot, 0);

  // Design 03 proportions: compact glossy warm-caramel square in upper ~74%, crisp outlined label anchored cleanly across bottom
  const boxH = Math.max(24, Math.round(sh * 0.72));
  const boxW = Math.min(sw, Math.max(36, Math.round(boxH * 1.16)));
  const bx = Math.round(sx + (sw - boxW) * 0.5);
  const by = Math.round(sy + 1);
  const rad = Math.min(10, Math.round(boxH * 0.27));

  ctx.save();
  try {
    // Soft bottom shadow lip under the wood square
    _roundRect(ctx, bx, by + 2.2, boxW, boxH, rad);
    ctx.fillStyle = forkReady ? '#225934' : '#3E2212';
    ctx.fill();

    const grad = _linearGrad(ctx, bx, by, bx, by + boxH, '#A26D44');
    if (forkReady) {
      _addStop(grad, 0, '#6BC97D');
      _addStop(grad, 1, '#3A8F53');
    } else if (isCooling) {
      _addStop(grad, 0, '#B07B52');
      _addStop(grad, 0.55, '#8F5D3A');
      _addStop(grad, 1, '#704528');
    } else {
      _addStop(grad, 0, '#BA8151');
      _addStop(grad, 0.55, '#96613A');
      _addStop(grad, 1, '#754627');
    }

    _roundRect(ctx, bx, by, boxW, boxH, rad);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = forkReady ? 2.4 : 2.1;
    ctx.strokeStyle = forkReady ? '#225934' : '#402212';
    ctx.stroke();

    // Soft glossy oval highlight at top-left (Design 03 detail)
    if (!forkReady) {
      ctx.fillStyle = 'rgba(255, 240, 214, 0.34)';
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(bx + 7.5, by + 6.0, 4.2, 2.2, -0.35, 0, Math.PI * 2);
      } else {
        ctx.arc(bx + 7.5, by + 6.0, 2.5, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    if (forkReady && typeof ctx.setLineDash === 'function') {
      ctx.strokeStyle = '#E8FFF0';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      _roundRect(ctx, bx + 2, by + 2, boxW - 4, boxH - 4, Math.max(4, rad - 2));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (isCooling && !forkReady) {
      drawOutlinedText(ctx, `${Math.ceil(rem)}s`, bx + boxW * 0.5, by + boxH * 0.52, {
        size: Math.max(15, Math.round(boxH * 0.54)),
        minSize: 12,
        weight: 900,
        fill: '#FFFDF8',
        stroke: '#3D1E0E',
        strokeWidth: 3.4,
        shadowOffsetY: 1.0,
        maxWidth: boxW - 6
      });
      if (_imgDims(clockImg) && typeof ctx.drawImage === 'function') {
        const csz = Math.max(13, Math.min(18, Math.round(boxH * 0.44)));
        ctx.drawImage(clockImg, bx + boxW - csz * 0.72, by - csz * 0.22, csz, csz);
      }
    } else if (_imgDims(trashImg) && typeof ctx.drawImage === 'function') {
      const isz = Math.max(18, Math.round(Math.min(boxW, boxH) * 0.74));
      ctx.save();
      try {
        ctx.translate(bx + boxW * 0.5, by + boxH * 0.49);
        if (wobbleRot) ctx.rotate(wobbleRot);
        ctx.drawImage(trashImg, -isz * 0.5, -isz * 0.5, isz, isz);
      } finally {
        ctx.restore();
      }
    }

    drawOutlinedText(ctx, label, sx + sw * 0.5, sy + sh - Math.max(6.5, sh * 0.14), {
      size: Math.max(10.8, Math.round(sh * 0.24)),
      minSize: 8.8,
      weight: 900,
      fill: '#FFFDF8',
      stroke: '#381B0D',
      strokeWidth: 2.8,
      shadowOffsetY: 0.7,
      maxWidth: sw + 6
    });
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 暂停弹窗奶油暖绿滑块开关（支持平滑过渡动画 animPos 0..1，对应设计图 10）
 */
function drawSwitchToggle(ctx, x, y, w, h, isOn, animPos = null) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;

  const t = animPos !== null && animPos !== undefined && Number.isFinite(Number(animPos))
    ? _clamp(Number(animPos), 0, 1)
    : isOn
    ? 1
    : 0;
  const activeVisual = t >= 0.5;

  // 插值背景色 (#A69A8E -> #8FB347)
  const bgR = Math.round(166 + (143 - 166) * t);
  const bgG = Math.round(154 + (179 - 154) * t);
  const bgB = Math.round(142 + (71 - 142) * t);

  ctx.save();
  try {
    _roundRect(ctx, sx, sy, sw, sh, sh / 2);
    ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = V090_KISSA_THEME.ink;
    ctx.stroke();

    const knobR = sh * 0.44;
    const leftX = sx + knobR + 2.5;
    const rightX = sx + sw - knobR - 2.5;
    const knobX = leftX + (rightX - leftX) * t;
    const cy = sy + sh * 0.5;

    drawOutlinedText(ctx, activeVisual ? 'ON' : 'OFF', activeVisual ? sx + sw * 0.30 : sx + sw * 0.70, cy + 0.5, {
      size: Math.max(9.5, Math.round(sh * 0.42)),
      minSize: 8,
      weight: 800,
      fill: '#FFF8EC',
      stroke: V090_KISSA_THEME.ink,
      strokeWidth: 2.0,
      shadowOffsetY: 0
    });

    // 圆形金色/灰米旋钮
    const kGrad = _linearGrad(ctx, knobX, cy - knobR, knobX, cy + knobR, activeVisual ? '#F5B841' : '#D9CFC4');
    _addStop(kGrad, 0, activeVisual ? '#FFE27A' : '#EDE5DC');
    _addStop(kGrad, 1, activeVisual ? '#E89D24' : '#C7BCB0');
    ctx.beginPath();
    ctx.arc(knobX, cy, knobR, 0, Math.PI * 2);
    ctx.fillStyle = kGrad;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = V090_KISSA_THEME.ink;
    ctx.stroke();

    drawOutlinedText(ctx, activeVisual ? '开' : '关', knobX, cy + 0.6, {
      size: Math.max(9.5, Math.round(sh * 0.42)),
      minSize: 8,
      weight: 800,
      fill: V090_KISSA_THEME.ink,
      stroke: '',
      strokeWidth: 0,
      shadowOffsetY: 0
    });
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 优先锁定顾客青蓝呼吸四角锁框（对应设计图 03 左侧顾客）
 */
function drawPriorityLockFrame(ctx, x, y, w, h, nowSec = 0) {
  if (!_isCtx(ctx)) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = _num(w, 0);
  const sh = _num(h, 0);
  if (!(sw > 0 && sh > 0)) return;
  const pulse = 0.72 + 0.28 * Math.sin(_num(nowSec, 0) * 5.2);
  const corner = Math.min(13, sw * 0.16, sh * 0.18);

  ctx.save();
  try {
    ctx.strokeStyle = V090_EXT_COLORS.priorityCyan;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 3.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = V090_EXT_COLORS.priorityCyan;
    ctx.shadowBlur = 10;
    const brackets = [
      [[sx, sy + corner], [sx, sy], [sx + corner, sy]],
      [[sx + sw - corner, sy], [sx + sw, sy], [sx + sw, sy + corner]],
      [[sx + sw, sy + sh - corner], [sx + sw, sy + sh], [sx + sw - corner, sy + sh]],
      [[sx + corner, sy + sh], [sx, sy + sh], [sx, sy + sh - corner]]
    ];
    for (let i = 0; i < brackets.length; i++) {
      const pts = brackets[i];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.stroke();
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 右侧暖木滚动条（对应设计图 06 星夜小铺 & 08 排行榜）
 */
function drawScrollBar(ctx, x, y, w, h, scrollRatio, thumbRatio) {
  if (!_isCtx(ctx)) return;
  const tr = _clamp(_num(thumbRatio, 1), 0.08, 1);
  if (tr >= 0.999) return;
  const sx = _num(x, 0);
  const sy = _num(y, 0);
  const sw = Math.max(4, _num(w, 6));
  const sh = _num(h, 0);
  if (!(sh > 10)) return;

  const thumbH = Math.max(24, sh * tr);
  const thumbY = sy + (sh - thumbH) * _clamp(_num(scrollRatio, 0), 0, 1);

  ctx.save();
  try {
    _roundRect(ctx, sx, sy, sw, sh, sw * 0.5);
    ctx.fillStyle = 'rgba(138, 86, 52, 0.20)';
    ctx.fill();
    _roundRect(ctx, sx, thumbY, sw, thumbH, sw * 0.5);
    ctx.fillStyle = V090_EXT_COLORS.woodMain;
    ctx.fill();
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = V090_KISSA_THEME.ink;
    ctx.stroke();
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 3 章节选关纯色星夜兜底底图（在手绘底图 WebP 尚未加载完成时无缝兜底）
 */
function drawChapterBackdrop(ctx, w, h, themeKey = 'amber') {
  if (!_isCtx(ctx)) return;
  const sw = Math.max(320, _num(w, 390));
  const sh = Math.max(480, _num(h, 844));
  const theme = CHAPTER_THEMES[themeKey] || CHAPTER_THEMES.amber;

  ctx.save();
  try {
    const grad = _linearGrad(ctx, 0, 0, 0, sh, theme.skyMid);
    _addStop(grad, 0, theme.skyTop);
    _addStop(grad, 0.55, theme.skyMid);
    _addStop(grad, 1, theme.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, sw, sh);

    ctx.fillStyle = theme.starColor;
    for (let i = 0; i < 42; i++) {
      const sx = ((i * 197.3) % 1) * sw;
      const sy = ((i * 83.7) % 0.62) * sh;
      const sr = i % 3 === 0 ? 2.0 : 1.1;
      ctx.globalAlpha = 0.35 + ((i * 37) % 60) / 100;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  } catch (_) {} finally {
    ctx.restore();
  }
}

/**
 * 一键无损挂载到原 src/ui_draw.js 的 module.exports 上：
 * 保留原文件全部底层工具与 HitRegistry，升级核心视觉函数并挂入 v0.9.0 新增组件。
 */
function applyV090Skin(uiExports) {
  if (!uiExports || typeof uiExports !== 'object') return uiExports;
  _boundUi = uiExports;

  if (uiExports.KISSA_THEME && typeof uiExports.KISSA_THEME === 'object') {
    Object.assign(uiExports.KISSA_THEME, V090_KISSA_THEME);
  } else {
    uiExports.KISSA_THEME = Object.assign({}, V090_KISSA_THEME);
  }

  // 无损替换已核对签名的核心视觉函数
  uiExports.fontStr = fontStr;
  uiExports.drawWoodBoard = drawWoodBoard;
  uiExports.drawParchmentSheet = drawParchmentSheet;
  uiExports.drawKissaCard = drawKissaCard;
  uiExports.drawPillButton = drawPillButton;
  uiExports.drawTagBadge = drawTagBadge;
  uiExports.drawCurrencyChip = drawCurrencyChip;
  uiExports.drawNoticeBanner = drawNoticeBanner;
  uiExports.drawPriorityTargetBadge = drawPriorityTargetBadge;

  // 挂载 v0.9.0 新增视觉组件与安全区/字体工具
  uiExports.V090_EXT_COLORS = V090_EXT_COLORS;
  uiExports.CHAPTER_THEMES = CHAPTER_THEMES;
  uiExports.initGameFont = initGameFont;
  uiExports.getFontFamily = getFontFamily;
  uiExports.getSafeLayout = getSafeLayout;
  uiExports.drawOutlinedText = drawOutlinedText;
  uiExports.drawAwningHeader = drawAwningHeader;
  uiExports.drawSegmentedBar = drawSegmentedBar;
  uiExports.drawCooldownCell = drawCooldownCell;
  uiExports.drawSwitchToggle = drawSwitchToggle;
  uiExports.drawPriorityLockFrame = drawPriorityLockFrame;
  uiExports.drawScrollBar = drawScrollBar;
  uiExports.drawChapterBackdrop = drawChapterBackdrop;

  return uiExports;
}

module.exports = {
  V090_KISSA_THEME,
  V090_EXT_COLORS,
  CHAPTER_THEMES,
  initGameFont,
  getFontFamily,
  fontStr,
  getSafeLayout,
  drawOutlinedText,
  drawWoodBoard,
  drawParchmentSheet,
  drawKissaCard,
  drawPillButton,
  drawTagBadge,
  drawCurrencyChip,
  drawNoticeBanner,
  drawPriorityTargetBadge,
  drawAwningHeader,
  drawSegmentedBar,
  drawCooldownCell,
  drawSwitchToggle,
  drawPriorityLockFrame,
  drawScrollBar,
  drawChapterBackdrop,
  applyV090Skin
};
