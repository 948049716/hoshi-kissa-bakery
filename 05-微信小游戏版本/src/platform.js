/**
 * Unified Platform Abstraction Layer for WeChat Mini Game (`wx.*`)
 * with lightweight browser Canvas/Storage/WebAudio fallback for local verification.
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
    const dpr = Math.min(Math.max(1, win.pixelRatio || 2), 2.0);
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
  const dpr = Math.min(Math.max(1, (g && g.devicePixelRatio) || 1), 2.0);
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

function removeStorage(key) {
  try {
    if (hasWx) {
      if (typeof wx.removeStorageSync === 'function') {
        wx.removeStorageSync(key);
      } else {
        wx.setStorageSync(key, '');
      }
      return;
    }
    if (g.localStorage) {
      g.localStorage.removeItem(key);
    }
  } catch (_) {}
}

function createAudioContext() {
  if (hasWx) {
    try {
      if (typeof wx.setInnerAudioOption === 'function') {
        wx.setInnerAudioOption({ obeyMuteSwitch: true });
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
          title: p.title || '星夜吃茶 · 温柔烤制猫神舒芙蕾',
          imageUrl: p.imageUrl || 'assets/title_hero.jpg'
        };
      });
    }
    if (typeof wx.onShareTimeline === 'function') {
      wx.onShareTimeline(() => {
        const p = getSharePayload ? getSharePayload() : {};
        return {
          title: p.title || '星夜吃茶 · 喵呜甜品合合乐',
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
        title: (payload && payload.title) || '星夜吃茶 · 来试试合出星冠猫神舒芙蕾',
        imageUrl: (payload && payload.imageUrl) || 'assets/title_hero.jpg'
      });
      return true;
    } catch (_) {}
  }
  return false;
}

// ============================================================================
// WeChat Cloud Development (`wx.cloud`) & Native UserInfo Authorization Layer
// ============================================================================
let cloudInitialized = false;
let cloudReady = false;
let activeUserInfoBtn = null;
let activeUserInfoRectKey = '';

const DEFAULT_NPC_RIVALS = [
  { nickName: '月光甜点师·小葵', avatarPreset: 'luna', bestChef: 24800, bestRush: 7680, bestZen: 14200, bestShiftReached: 6 },
  { nickName: '焦糖布丁喵', avatarPreset: 'mikan', bestChef: 18600, bestRush: 6150, bestZen: 10800, bestShiftReached: 5 },
  { nickName: '柴柴烘焙坊', avatarPreset: 'mugi', bestChef: 14200, bestRush: 5420, bestZen: 8900, bestShiftReached: 5 },
  { nickName: '星露茶会·奈奈', avatarPreset: 'luna', bestChef: 9600, bestRush: 4280, bestZen: 6500, bestShiftReached: 4 },
  { nickName: '晚风舒芙蕾', avatarPreset: 'mikan', bestChef: 5200, bestRush: 2860, bestZen: 4200, bestShiftReached: 3 }
];

function initCloud(envId = '') {
  if (cloudInitialized) return cloudReady;
  cloudInitialized = true;

  if (hasWx) {
    try {
      if (typeof wx.onNeedPrivacyAuthorization === 'function') {
        wx.onNeedPrivacyAuthorization((resolve) => {
          if (typeof resolve === 'function') {
            resolve({ event: 'exposureAuthorization' });
          }
        });
      }
    } catch (_) {}

    if (wx.cloud && typeof wx.cloud.init === 'function') {
      try {
        const opts = { traceUser: true };
        if (envId && typeof envId === 'string' && envId.trim()) {
          opts.env = envId.trim();
        }
        wx.cloud.init(opts);
        cloudReady = true;
        return true;
      } catch (_) {
        cloudReady = false;
        return false;
      }
    }
    cloudReady = false;
    return false;
  }

  cloudReady = true;
  return true;
}

function runBrowserMockCloud(data = {}) {
  const action = data.action || 'pull';
  const key = '__hoshi_browser_cloud_doc_v1__';
  let doc = getStorageJSON(key);
  const openidSuffix = 'CAFE';

  if (action === 'pull') {
    if (!doc) {
      doc = {
        openidSuffix,
        profile: { nickName: `星夜店长#${openidSuffix}`, avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 },
        bestChef: 0,
        bestRush: 0,
        bestZen: 0,
        bestShiftReached: 0,
        metaSave: null,
        activeRun: null,
        revision: 1
      };
      setStorageJSON(key, doc);
    }
    return Promise.resolve({ ok: true, ...doc });
  }

  if (action === 'push') {
    const nextMeta = data.metaSave || (doc && doc.metaSave) || null;
    const nextProfile = data.profile || (doc && doc.profile) || {
      nickName: `星夜店长#${openidSuffix}`,
      avatarUrl: '',
      avatarPreset: 'mikan',
      authorized: false,
      updatedAt: Date.now()
    };
    const nextActiveRun = data.clearActiveRun
      ? null
      : data.activeRun !== undefined
      ? data.activeRun
      : doc
      ? doc.activeRun
      : null;
    doc = {
      openidSuffix,
      profile: nextProfile,
      bestChef: Math.max((doc && doc.bestChef) || 0, (nextMeta && nextMeta.bestChef) || 0),
      bestRush: Math.max((doc && doc.bestRush) || 0, (nextMeta && nextMeta.bestRush) || 0),
      bestZen: Math.max((doc && doc.bestZen) || 0, (nextMeta && nextMeta.bestZen) || 0),
      bestShiftReached: Math.max(
        (doc && doc.bestShiftReached) || 0,
        (nextMeta && nextMeta.lifetimeStats && nextMeta.lifetimeStats.bestShiftReached) || 0
      ),
      metaSave: nextMeta,
      activeRun: nextActiveRun,
      revision: ((doc && doc.revision) || 0) + 1
    };
    setStorageJSON(key, doc);
    return Promise.resolve({ ok: true, ...doc });
  }

  if (action === 'updateProfile') {
    doc = doc || { openidSuffix, bestChef: 0, bestRush: 0, bestZen: 0, bestShiftReached: 0, revision: 1 };
    doc.profile = { ...(doc.profile || {}), ...(data.profile || {}), updatedAt: Date.now() };
    setStorageJSON(key, doc);
    return Promise.resolve({ ok: true, openidSuffix, profile: doc.profile });
  }

  if (action === 'leaderboard') {
    const mode = data.mode === 'rush' ? 'rush' : data.mode === 'zen' ? 'zen' : 'chef';
    const field = mode === 'rush' ? 'bestRush' : mode === 'zen' ? 'bestZen' : 'bestChef';
    const rows = DEFAULT_NPC_RIVALS.map((r, i) => ({
      id: `npc_${i}`,
      isMe: false,
      nickName: r.nickName,
      avatarUrl: '',
      avatarPreset: r.avatarPreset,
      score: r[field] || 0,
      bestShiftReached: r.bestShiftReached
    }));
    const myScore = doc ? doc[field] || 0 : 0;
    if (myScore > 0) {
      rows.push({
        id: 'me',
        isMe: true,
        nickName: (doc && doc.profile && doc.profile.nickName) || `星夜店长#${openidSuffix}`,
        avatarUrl: (doc && doc.profile && doc.profile.avatarUrl) || '',
        avatarPreset: (doc && doc.profile && doc.profile.avatarPreset) || 'mikan',
        score: myScore,
        bestShiftReached: (doc && doc.bestShiftReached) || 1
      });
    }
    rows.sort((a, b) => b.score - a.score);
    const list = rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
    const meRow = list.find((r) => r.isMe);
    return Promise.resolve({
      ok: true,
      mode,
      list,
      myRank: meRow ? meRow.rank : null,
      myScore
    });
  }

  return Promise.resolve({ ok: false, reason: 'unknown_action' });
}

function callCloudFunction(name, data = {}) {
  if (!cloudInitialized) initCloud('');
  if (!cloudReady) {
    return Promise.resolve({ ok: false, reason: 'cloud_unavailable', fallbackRows: DEFAULT_NPC_RIVALS });
  }

  if (hasWx) {
    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      return Promise.resolve({ ok: false, reason: 'cloud_unavailable', fallbackRows: DEFAULT_NPC_RIVALS });
    }
    return new Promise((resolve) => {
      try {
        const maybePromise = wx.cloud.callFunction({
          name,
          data,
          success: (res) => {
            resolve((res && res.result) || { ok: false, reason: 'empty_result' });
          },
          fail: (err) => {
            resolve({
              ok: false,
              reason: 'call_failed',
              errMsg: (err && err.errMsg) || String(err || ''),
              fallbackRows: DEFAULT_NPC_RIVALS
            });
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.catch(() => {});
        }
      } catch (err) {
        resolve({ ok: false, reason: 'call_exception', errMsg: String(err || ''), fallbackRows: DEFAULT_NPC_RIVALS });
      }
    });
  }

  return runBrowserMockCloud(data);
}

let lastFriendCloudKey = '';
function setWxFriendCloudScore(bestChef = 0, bestRush = 0, bestZen = 0) {
  if (!hasWx || typeof wx.setUserCloudStorage !== 'function') return;
  const c = String(Math.floor(bestChef || 0));
  const r = String(Math.floor(bestRush || 0));
  const z = String(Math.floor(bestZen || 0));
  const key = `${c}:${r}:${z}`;
  if (key === lastFriendCloudKey) return;
  lastFriendCloudKey = key;
  try {
    wx.setUserCloudStorage({
      KVDataList: [
        { key: 'bestChef', value: c },
        { key: 'bestRush', value: r },
        { key: 'bestZen', value: z }
      ]
    });
  } catch (_) {}
}

function destroyUserInfoButton() {
  if (activeUserInfoBtn) {
    try {
      activeUserInfoBtn.destroy();
    } catch (_) {}
    activeUserInfoBtn = null;
    activeUserInfoRectKey = '';
  }
}

function syncUserInfoButton(rectOrNull, onAuthResult) {
  if (!rectOrNull || !hasWx || typeof wx.createUserInfoButton !== 'function') {
    destroyUserInfoButton();
    return false;
  }

  const left = Math.round(rectOrNull.x);
  const top = Math.round(rectOrNull.y);
  const width = Math.max(24, Math.round(rectOrNull.w));
  const height = Math.max(20, Math.round(rectOrNull.h));
  const key = `${left},${top},${width},${height}`;

  if (activeUserInfoBtn && activeUserInfoRectKey === key) {
    return true;
  }

  destroyUserInfoButton();
  try {
    const btn = wx.createUserInfoButton({
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
    if (btn && typeof btn.onTap === 'function') {
      btn.onTap((res) => {
        if (res && res.userInfo && res.userInfo.nickName) {
          if (onAuthResult) {
            onAuthResult({
              ok: true,
              nickName: res.userInfo.nickName,
              avatarUrl: res.userInfo.avatarUrl || ''
            });
          }
        } else if (onAuthResult) {
          onAuthResult({ ok: false, cancelled: true });
        }
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

function getDefaultNpcRivals() {
  return DEFAULT_NPC_RIVALS.map((r) => ({ ...r, isNpc: true }));
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
  removeStorage,
  createAudioContext,
  bindLifecycle,
  bindPointerEvents,
  bindKeyboard,
  vibrateShort,
  setupShare,
  triggerShare,
  initCloud,
  callCloudFunction,
  setWxFriendCloudScore,
  syncUserInfoButton,
  destroyUserInfoButton,
  getDefaultNpcRivals,
  getGlobal
};
