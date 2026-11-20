/**
 * Unified Platform Abstraction Layer for WeChat Mini Game (`wx.*`)
 * with transparent fallback to HTML5 Canvas/Storage/WebAudio for browser preview.
 */
'use strict';

const hasWx = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';
const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});

let mainCanvas = null;
let resizeCallbacks = [];
let keyListeners = [];

function getSystemMetrics() {
  if (hasWx) {
    let win = null;
    try {
      win = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (_) {
      try {
        win = wx.getSystemInfoSync();
      } catch (_2) {
        win = {};
      }
    }
    const width = Math.max(320, win.windowWidth || 390);
    const height = Math.max(480, win.windowHeight || 844);
    const dpr = Math.min(Math.max(1, win.pixelRatio || 2), 2.5);
    const safeArea = win.safeArea || { top: win.statusBarHeight || 20, bottom: height, left: 0, right: width };
    const safeTop = Math.max(0, safeArea.top || 0);
    const safeBottom = Math.max(0, height - (safeArea.bottom || height));

    let menuRect = null;
    try {
      if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
        const mr = wx.getMenuButtonBoundingClientRect();
        if (mr && mr.width > 0 && mr.left > 0) {
          menuRect = {
            left: mr.left,
            right: mr.right,
            top: mr.top,
            bottom: mr.bottom,
            width: mr.width,
            height: mr.height
          };
        }
      }
    } catch (_) {}

    return { width, height, dpr, safeTop, safeBottom, menuRect, isWeChat: true };
  }

  const width = Math.max(320, (g && g.innerWidth) || 390);
  const height = Math.max(480, (g && g.innerHeight) || 844);
  const dpr = Math.min(Math.max(1, (g && g.devicePixelRatio) || 1), 2.5);
  const mockRect = g && g.__WX_MOCK_CAPSULE__ ? g.__WX_MOCK_CAPSULE__ : null;
  const mockSafeTop = g && typeof g.__WX_MOCK_SAFE_TOP__ === 'number' ? g.__WX_MOCK_SAFE_TOP__ : 8;
  const mockSafeBottom = g && typeof g.__WX_MOCK_SAFE_BOTTOM__ === 'number' ? g.__WX_MOCK_SAFE_BOTTOM__ : 0;
  return {
    width,
    height,
    dpr,
    safeTop: mockSafeTop,
    safeBottom: mockSafeBottom,
    menuRect: mockRect,
    isWeChat: false
  };
}

function createMainCanvas() {
  if (mainCanvas) return mainCanvas;
  const metrics = getSystemMetrics();

  if (hasWx) {
    mainCanvas = wx.createCanvas();
    mainCanvas.width = Math.round(metrics.width * metrics.dpr);
    mainCanvas.height = Math.round(metrics.height * metrics.dpr);
    if (typeof wx.onWindowResize === 'function') {
      wx.onWindowResize(() => {
        const m = getSystemMetrics();
        mainCanvas.width = Math.round(m.width * m.dpr);
        mainCanvas.height = Math.round(m.height * m.dpr);
        resizeCallbacks.forEach((fn) => fn(m));
      });
    }
    return mainCanvas;
  }

  const doc = g.document;
  mainCanvas = doc.getElementById('game-canvas') || doc.createElement('canvas');
  if (!mainCanvas.parentNode) {
    doc.body.appendChild(mainCanvas);
  }
  mainCanvas.style.display = 'block';
  mainCanvas.style.width = '100%';
  mainCanvas.style.height = '100%';
  mainCanvas.style.touchAction = 'none';
  mainCanvas.width = Math.round(metrics.width * metrics.dpr);
  mainCanvas.height = Math.round(metrics.height * metrics.dpr);

  g.addEventListener('resize', () => {
    const m = getSystemMetrics();
    mainCanvas.width = Math.round(m.width * m.dpr);
    mainCanvas.height = Math.round(m.height * m.dpr);
    resizeCallbacks.forEach((fn) => fn(m));
  });

  return mainCanvas;
}

function onResize(cb) {
  if (typeof cb === 'function') resizeCallbacks.push(cb);
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = hasWx ? wx.createImage() : new g.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function getStorageJSON(key) {
  try {
    if (hasWx) {
      const raw = wx.getStorageSync(key);
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    if (g.localStorage) {
      const raw = g.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (_) {}
  return null;
}

function setStorageJSON(key, value) {
  try {
    const str = JSON.stringify(value);
    if (hasWx) {
      wx.setStorageSync(key, str);
      return;
    }
    if (g.localStorage) {
      g.localStorage.setItem(key, str);
    }
  } catch (_) {}
}

function createAudioContext() {
  if (hasWx) {
    try {
      if (typeof wx.setInnerAudioOption === 'function') {
        wx.setInnerAudioOption({ obeyMuteSwitch: false });
      }
    } catch (_) {}
    if (typeof wx.createWebAudioContext === 'function') {
      return wx.createWebAudioContext();
    }
    return null;
  }
  const AudioCtx = g.AudioContext || g.webkitAudioContext;
  return AudioCtx ? new AudioCtx() : null;
}

function bindLifecycle(onShow, onHide) {
  if (hasWx) {
    if (typeof wx.onShow === 'function') wx.onShow(() => onShow && onShow());
    if (typeof wx.onHide === 'function') wx.onHide(() => onHide && onHide());
    if (typeof wx.onAudioInterruptionBegin === 'function') {
      wx.onAudioInterruptionBegin(() => onHide && onHide());
    }
    if (typeof wx.onAudioInterruptionEnd === 'function') {
      wx.onAudioInterruptionEnd(() => onShow && onShow());
    }
    return;
  }
  if (g.document) {
    g.document.addEventListener('visibilitychange', () => {
      if (g.document.hidden) {
        if (onHide) onHide();
      } else if (onShow) {
        onShow();
      }
    });
    g.addEventListener('pageshow', () => {
      if (g.document && !g.document.hidden && onShow) onShow();
    });
  }
}

function bindPointerEvents(canvas, handlers) {
  const { onDown, onMove, onUp, onCancel, onWheel } = handlers;

  if (hasWx) {
    wx.onTouchStart((ev) => {
      const t = ev && ev.changedTouches && ev.changedTouches[0];
      if (!t || !onDown) return;
      onDown({ x: t.clientX, y: t.clientY, pointerType: 'touch' });
    });
    wx.onTouchMove((ev) => {
      const t = ev && ev.changedTouches && ev.changedTouches[0];
      if (!t || !onMove) return;
      onMove({ x: t.clientX, y: t.clientY, pointerType: 'touch' });
    });
    wx.onTouchEnd((ev) => {
      const t = ev && ev.changedTouches && ev.changedTouches[0];
      if (!t || !onUp) return;
      onUp({ x: t.clientX, y: t.clientY, pointerType: 'touch' });
    });
    wx.onTouchCancel(() => {
      if (onCancel) onCancel();
    });
    return;
  }

  const mapCoords = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const cx = ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
    const cy = ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
    return {
      x: cx - rect.left,
      y: cy - rect.top,
      pointerType: ev.pointerType || 'mouse'
    };
  };

  canvas.addEventListener('pointerdown', (ev) => {
    if (onDown) onDown(mapCoords(ev));
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (onMove) onMove(mapCoords(ev));
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (onUp) onUp(mapCoords(ev));
  });
  canvas.addEventListener('pointercancel', () => {
    if (onCancel) onCancel();
  });
  canvas.addEventListener(
    'wheel',
    (ev) => {
      if (onWheel) {
        ev.preventDefault();
        const coords = mapCoords(ev);
        onWheel(coords.x, coords.y, ev.deltaY);
      }
    },
    { passive: false }
  );

  // Prevent browser zoom gestures
  if (g.document) {
    g.document.addEventListener('gesturestart', (ev) => ev.preventDefault(), { passive: false });
    g.document.addEventListener('dblclick', (ev) => ev.preventDefault(), { passive: false });
  }
}

function bindKeyboard(cb) {
  if (hasWx) {
    if (typeof wx.onKeyDown === 'function') {
      wx.onKeyDown((res) => cb && cb(res && res.key ? res.key : ''));
    }
    return;
  }
  if (g.addEventListener) {
    const fn = (ev) => cb && cb(ev.key, ev);
    keyListeners.push(fn);
    g.addEventListener('keydown', fn);
  }
}

function vibrateShort(style = 'light') {
  if (hasWx && typeof wx.vibrateShort === 'function') {
    try {
      wx.vibrateShort({ type: style });
    } catch (_) {}
  }
}

function setupShare(getSharePayload) {
  if (!hasWx) return;
  try {
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
    if (typeof wx.onShareAppMessage === 'function') {
      wx.onShareAppMessage(() => {
        const p = getSharePayload ? getSharePayload() : {};
        return {
          title: p.title || '🌙 星夜吃茶 · 今晚也在温柔烤制猫神舒芙蕾！',
          imageUrl: p.imageUrl || 'assets/title_hero.jpg'
        };
      });
    }
    if (typeof wx.onShareTimeline === 'function') {
      wx.onShareTimeline(() => {
        const p = getSharePayload ? getSharePayload() : {};
        return {
          title: p.title || '🌙 星夜吃茶 · 喵呜甜品合合乐',
          imageUrl: p.imageUrl || 'assets/title_hero.jpg'
        };
      });
    }
  } catch (_) {}
}

function triggerShare(payload) {
  if (hasWx && typeof wx.shareAppMessage === 'function') {
    try {
      wx.shareAppMessage({
        title: (payload && payload.title) || '🌙 星夜吃茶 · 来试试你能合出星冠猫神舒芙蕾吗！',
        imageUrl: (payload && payload.imageUrl) || 'assets/title_hero.jpg'
      });
      return true;
    } catch (_) {}
  }
  return false;
}

function getGlobal() {
  return g;
}

module.exports = {
  hasWx,
  getSystemMetrics,
  createMainCanvas,
  onResize,
  loadImage,
  getStorageJSON,
  setStorageJSON,
  createAudioContext,
  bindLifecycle,
  bindPointerEvents,
  bindKeyboard,
  vibrateShort,
  setupShare,
  triggerShare,
  getGlobal
};
