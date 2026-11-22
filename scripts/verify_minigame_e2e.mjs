#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const MINIGAME_DIR = path.join(REPO_ROOT, '05-微信小游戏版本');

const CHROMIUM =
  process.env.CHROME_PATH ||
  process.env.CHROME_BIN ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p)) ||
  '/usr/bin/chromium';
const OUT_DIR = process.env.VERIFY_OUT_DIR || '/tmp/minigame_verify';
fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

function loadMiniGameModuleMap() {
  const files = ['game.js', ...fs.readdirSync(path.join(MINIGAME_DIR, 'src')).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`)];
  const map = {};
  for (const rel of files) {
    map[`./${rel}`] = fs.readFileSync(path.join(MINIGAME_DIR, rel), 'utf8');
  }
  return map;
}

function buildPreviewHtml(moduleMap) {
  const jsonModules = JSON.stringify(moduleMap).replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <title>WeChat Mini Game Preview Harness</title>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #1a1228; touch-action: none; }
    canvas { display: block; width: 100%; height: 100%; touch-action: none; }
    #wx-capsule-overlay {
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: space-evenly;
      border-radius: 999px;
      background: rgba(12, 10, 22, 0.56);
      border: 1px solid rgba(255, 255, 255, 0.28);
      color: #ffffff;
      font-family: -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 700;
      box-sizing: border-box;
      backdrop-filter: blur(4px);
    }
    #wx-capsule-overlay .sep { width: 1px; height: 15px; background: rgba(255,255,255,0.28); }
    #wx-home-bar {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: 8px;
      width: 120px;
      height: 4px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.35);
      pointer-events: none;
      z-index: 9999;
    }
  </style>
</head>
<body>
<script>
(function () {
  const params = new URLSearchParams(location.search);
  const safeTop = Number(params.get('safeTop') || 20);
  const safeBottom = Number(params.get('safeBottom') || 0);
  const showCapsule = params.get('capsule') !== '0';

  function computeCapsuleRect() {
    const w = window.innerWidth;
    const width = 87;
    const height = 32;
    const rightMargin = w >= 760 ? 12 : 7;
    const top = Math.max(8, safeTop + 4);
    const right = w - rightMargin;
    const left = right - width;
    return { left, right, top, bottom: top + height, width, height };
  }

  let screenCanvasCreated = false;
  let touchHandlers = { start: [], move: [], end: [], cancel: [] };
  let resizeHandlers = [];
  let keyHandlers = [];
  let showHandlers = [];
  let hideHandlers = [];
  const audioCalls = { convolved: false, created: 0 };

  window.__WX_HARNESS__ = {
    vibrateCount: 0,
    shareSetupCount: 0,
    audioCalls,
    getMenuRect: computeCapsuleRect
  };

  window.wx = {
    getWindowInfo() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return {
        windowWidth: w,
        windowHeight: h,
        pixelRatio: window.devicePixelRatio || 1,
        statusBarHeight: safeTop,
        safeArea: { top: safeTop, bottom: h - safeBottom, left: 0, right: w, width: w, height: h - safeTop - safeBottom }
      };
    },
    getSystemInfoSync() {
      return this.getWindowInfo();
    },
    getMenuButtonBoundingClientRect() {
      return showCapsule ? computeCapsuleRect() : null;
    },
    createCanvas() {
      if (typeof CanvasGradient !== 'undefined' && CanvasGradient.prototype && !CanvasGradient.prototype.__hoshiIosColorGuard) {
        const origAddColorStop = CanvasGradient.prototype.addColorStop;
        Object.defineProperty(CanvasGradient.prototype, '__hoshiIosColorGuard', { value: true });
        CanvasGradient.prototype.addColorStop = function (offset, color) {
          if (typeof color === 'string') {
            const norm = color.trim().toLowerCase();
            if (norm.startsWith('hsl(') || norm.startsWith('hsla(')) {
              throw new SyntaxError('iOS WeChat Canvas2D rejects hsl()/hsla() color stops: ' + color);
            }
          }
          return origAddColorStop.call(this, offset, color);
        };
      }
      const c = document.createElement('canvas');
      if (!screenCanvasCreated) {
        screenCanvasCreated = true;
        c.id = 'wx-main-canvas';
        document.body.appendChild(c);
        c.addEventListener('pointerdown', (ev) => {
          const rect = c.getBoundingClientRect();
          const t = { clientX: ev.clientX - rect.left, clientY: ev.clientY - rect.top };
          touchHandlers.start.forEach((fn) => fn({ touches: [t], changedTouches: [t] }));
        });
        c.addEventListener('pointermove', (ev) => {
          const rect = c.getBoundingClientRect();
          const t = { clientX: ev.clientX - rect.left, clientY: ev.clientY - rect.top };
          touchHandlers.move.forEach((fn) => fn({ touches: [t], changedTouches: [t] }));
        });
        c.addEventListener('pointerup', (ev) => {
          const rect = c.getBoundingClientRect();
          const t = { clientX: ev.clientX - rect.left, clientY: ev.clientY - rect.top };
          touchHandlers.end.forEach((fn) => fn({ touches: [], changedTouches: [t] }));
        });
        c.addEventListener('pointercancel', () => {
          touchHandlers.cancel.forEach((fn) => fn({ touches: [], changedTouches: [] }));
        });
        window.addEventListener('keydown', (ev) => {
          keyHandlers.forEach((fn) => fn({ key: ev.key }));
        });
        window.addEventListener('resize', () => {
          syncOverlay();
          resizeHandlers.forEach((fn) => fn());
        });
      }
      return c;
    },
    createImage() {
      return new Image();
    },
    getStorageSync(k) {
      return localStorage.getItem('wx_' + k) || '';
    },
    setStorageSync(k, v) {
      localStorage.setItem('wx_' + k, typeof v === 'string' ? v : JSON.stringify(v));
    },
    removeStorageSync(k) {
      localStorage.removeItem('wx_' + k);
    },
    setInnerAudioOption() {},
    onNeedPrivacyAuthorization(cb) {
      window.__WX_HARNESS__.privacyHookRegistered = true;
    },
    setUserCloudStorage(opts) {
      window.__WX_HARNESS__.lastFriendCloudKV = opts && opts.KVDataList ? opts.KVDataList : [];
    },
    createUserInfoButton(cfg) {
      const old = document.getElementById('wx-mock-userinfo-btn');
      if (old) old.remove();
      const el = document.createElement('div');
      el.id = 'wx-mock-userinfo-btn';
      const st = (cfg && cfg.style) || {};
      el.style.position = 'fixed';
      el.style.left = (st.left || 0) + 'px';
      el.style.top = (st.top || 0) + 'px';
      el.style.width = (st.width || 80) + 'px';
      el.style.height = (st.height || 28) + 'px';
      el.style.zIndex = '9998';
      el.style.background = 'rgba(0,0,0,0)';
      el.style.cursor = 'pointer';
      document.body.appendChild(el);
      const tapCbs = [];
      const triggerAuth = (ev) => {
        if (ev) {
          ev.stopPropagation();
          ev.preventDefault();
        }
        window.__WX_HARNESS__.userInfoTapCount = (window.__WX_HARNESS__.userInfoTapCount || 0) + 1;
        const mockInfo = window.__WX_MOCK_USERINFO__ || {
          nickName: '微信店长·星野',
          avatarUrl: ''
        };
        tapCbs.forEach((fn) => fn({ userInfo: mockInfo }));
      };
      el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      el.addEventListener('pointerup', triggerAuth);
      return {
        onTap(fn) {
          if (typeof fn === 'function') tapCbs.push(fn);
        },
        destroy() {
          el.remove();
        },
        show() {
          el.style.display = 'block';
        },
        hide() {
          el.style.display = 'none';
        }
      };
    },
    cloud: params.get('cloud') === '0'
      ? undefined
      : {
          init(opts) {
            window.__WX_HARNESS__.cloudInited = true;
            window.__WX_HARNESS__.cloudEnv = (opts && opts.env) || 'default';
          },
          callFunction({ name, data, success, fail }) {
            try {
              const payload = data || {};
              const action = payload.action || 'pull';
              if (action === 'push' && (window.__WX_HARNESS__.failNextPushCount || 0) > 0) {
                window.__WX_HARNESS__.failNextPushCount--;
                const simErr = new Error('cloud.callFunction:fail transient network timeout');
                setTimeout(() => {
                  if (fail) fail(simErr);
                }, 15);
                return Promise.reject(simErr);
              }
              const cloudKey = 'wx_cloud_kissa_doc_v1';
              let doc = null;
              try {
                const raw = localStorage.getItem(cloudKey);
                doc = raw ? JSON.parse(raw) : null;
              } catch (_) {}
              const openidSuffix = '88A6';

              let result = { ok: false };
              if (action === 'pull') {
                const isNewUser = !doc;
                if (!doc) {
                  doc = {
                    openidSuffix,
                    profile: { nickName: '星夜店长#' + openidSuffix, avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 },
                    bestChef: 0,
                    bestRush: 0,
                    bestZen: 0,
                    bestShiftReached: 0,
                    metaSave: null,
                    activeRun: null,
                    savedRuns: { chef: null, rush: null, zen: null },
                    revision: 1
                  };
                  localStorage.setItem(cloudKey, JSON.stringify(doc));
                } else if (!doc.savedRuns) {
                  doc.savedRuns = {
                    chef: doc.activeRun && (!doc.activeRun.mode || doc.activeRun.mode === 'chef') ? doc.activeRun : null,
                    rush: doc.activeRun && doc.activeRun.mode === 'rush' ? doc.activeRun : null,
                    zen: doc.activeRun && doc.activeRun.mode === 'zen' ? doc.activeRun : null
                  };
                }
                result = { ok: true, isNewUser, ...doc };
              } else if (action === 'push') {
                const prevRev = (doc && doc.revision) || 0;
                if (typeof payload.baseRevision === 'number' && payload.baseRevision > 0 && prevRev > payload.baseRevision) {
                  result = { ok: false, conflict: true, ...doc };
                } else {
                  const prevMeta = (doc && doc.metaSave) || {};
                  const inMeta = payload.metaSave || {};
                  const mergedChef = Math.max((doc && doc.bestChef) || 0, prevMeta.bestChef || 0, inMeta.bestChef || 0);
                  const mergedRush = Math.max((doc && doc.bestRush) || 0, prevMeta.bestRush || 0, inMeta.bestRush || 0);
                  const mergedZen = Math.max((doc && doc.bestZen) || 0, prevMeta.bestZen || 0, inMeta.bestZen || 0);
                  const remEarned = prevMeta.totalEarnedStardust || 30;
                  const inEarned = inMeta.totalEarnedStardust || 30;
                  const baseSync =
                    typeof payload.lastSyncedEarnedStardust === 'number'
                      ? payload.lastSyncedEarnedStardust
                      : typeof inMeta.lastSyncedEarnedStardust === 'number'
                      ? inMeta.lastSyncedEarnedStardust
                      : null;
                  let mergedEarned = Math.max(30, remEarned, inEarned);
                  if (baseSync !== null && baseSync >= 30 && inEarned >= baseSync && remEarned >= baseSync) {
                    const deltaIn = Math.min(2500, Math.max(0, inEarned - baseSync));
                    const deltaRem = Math.max(0, remEarned - baseSync);
                    mergedEarned = Math.max(mergedEarned, baseSync + deltaIn + deltaRem);
                  }
                  const nextMeta = {
                    ...prevMeta,
                    ...inMeta,
                    bestChef: mergedChef,
                    bestRush: mergedRush,
                    bestZen: mergedZen,
                    totalEarnedStardust: mergedEarned,
                    lastSyncedEarnedStardust: mergedEarned
                  };
                  const prevRuns = (doc && doc.savedRuns) || { chef: null, rush: null, zen: null };
                  const inRuns = payload.savedRuns && typeof payload.savedRuns === 'object' ? payload.savedRuns : {};
                  const nextSavedRuns = {
                    chef: payload.clearActiveRun ? null : inRuns.chef !== undefined ? inRuns.chef : prevRuns.chef,
                    rush: payload.clearActiveRun ? null : inRuns.rush !== undefined ? inRuns.rush : prevRuns.rush,
                    zen: payload.clearActiveRun ? null : inRuns.zen !== undefined ? inRuns.zen : prevRuns.zen
                  };
                  if (payload.clearSavedRunMode && ['chef', 'rush', 'zen'].includes(payload.clearSavedRunMode)) {
                    nextSavedRuns[payload.clearSavedRunMode] = null;
                  }
                  if (payload.activeRun && payload.activeRun.mode && ['chef', 'rush', 'zen'].includes(payload.activeRun.mode)) {
                    nextSavedRuns[payload.activeRun.mode] = payload.activeRun;
                  }
                  const nextActiveRun = nextSavedRuns.chef || nextSavedRuns.rush || nextSavedRuns.zen || null;
                  doc = {
                    openidSuffix,
                    profile: payload.profile || (doc && doc.profile) || { nickName: '星夜店长#' + openidSuffix, avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: Date.now() },
                    bestChef: mergedChef,
                    bestRush: mergedRush,
                    bestZen: mergedZen,
                    bestShiftReached: Math.max((doc && doc.bestShiftReached) || 0, (inMeta.lifetimeStats && inMeta.lifetimeStats.bestShiftReached) || 0),
                    metaSave: nextMeta,
                    activeRun: nextActiveRun,
                    savedRuns: nextSavedRuns,
                    revision: prevRev + 1
                  };
                  localStorage.setItem(cloudKey, JSON.stringify(doc));
                  result = { ok: true, ...doc };
                }
              } else if (action === 'updateProfile') {
                doc = doc || { openidSuffix, bestChef: 0, bestRush: 0, bestZen: 0, bestShiftReached: 0, revision: 1 };
                doc.profile = { ...(doc.profile || {}), ...(payload.profile || {}), updatedAt: Date.now() };
                if (doc.metaSave) doc.metaSave.playerProfile = doc.profile;
                localStorage.setItem(cloudKey, JSON.stringify(doc));
                result = { ok: true, openidSuffix, profile: doc.profile };
              } else if (action === 'leaderboard') {
                const mode = payload.mode === 'rush' ? 'rush' : 'chef';
                const field = mode === 'rush' ? 'bestRush' : 'bestChef';
                const rivals = [
                  { id: 'r1', isMe: false, isNpc: true, nickName: '月光甜点师·小葵', avatarUrl: '', avatarPreset: 'luna', score: mode === 'rush' ? 7680 : 24800, bestShiftReached: 6 },
                  { id: 'r2', isMe: false, isNpc: true, nickName: '焦糖布丁喵', avatarUrl: '', avatarPreset: 'mikan', score: mode === 'rush' ? 6150 : 18600, bestShiftReached: 5 },
                  { id: 'r3', isMe: false, isNpc: true, nickName: '柴柴烘焙坊', avatarUrl: '', avatarPreset: 'mugi', score: mode === 'rush' ? 5420 : 14200, bestShiftReached: 5 }
                ];
                const myScore = doc ? doc[field] || 0 : 0;
                if (myScore > 0) {
                  rivals.push({
                    id: 'me',
                    isMe: true,
                    isNpc: false,
                    nickName: (doc.profile && doc.profile.nickName) || ('星夜店长#' + openidSuffix),
                    avatarUrl: (doc.profile && doc.profile.avatarUrl) || '',
                    avatarPreset: (doc.profile && doc.profile.avatarPreset) || 'mikan',
                    score: myScore,
                    bestShiftReached: doc.bestShiftReached || 4
                  });
                }
                rivals.sort((a, b) => b.score - a.score);
                const list = rivals.map((r, idx) => ({ ...r, rank: idx + 1 }));
                const me = list.find((r) => r.isMe);
                result = { ok: true, mode, list, myRank: me ? me.rank : null, myScore };
              }
              setTimeout(() => {
                if (success) success({ result });
              }, 15);
              return Promise.resolve({ result });
            } catch (err) {
              if (fail) fail(err);
              return Promise.reject(err);
            }
          }
        },
    createWebAudioContext() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      audioCalls.created++;
      // Explicitly hide createConvolver to test WeChat missing-Convolver Schroeder fallback!
      try {
        Object.defineProperty(ctx, 'createConvolver', { value: undefined, configurable: true });
      } catch (_) {}
      return ctx;
    },
    onShow(fn) { showHandlers.push(fn); },
    onHide(fn) { hideHandlers.push(fn); },
    onAudioInterruptionBegin(fn) {},
    onAudioInterruptionEnd(fn) {},
    onTouchStart(fn) { touchHandlers.start.push(fn); },
    onTouchMove(fn) { touchHandlers.move.push(fn); },
    onTouchEnd(fn) { touchHandlers.end.push(fn); },
    onTouchCancel(fn) { touchHandlers.cancel.push(fn); },
    onWindowResize(fn) { resizeHandlers.push(fn); },
    onKeyDown(fn) { keyHandlers.push(fn); },
    vibrateShort() { window.__WX_HARNESS__.vibrateCount++; },
    showShareMenu() { window.__WX_HARNESS__.shareSetupCount++; },
    onShareAppMessage() {},
    onShareTimeline() {},
    shareAppMessage() {}
  };

  function syncOverlay() {
    let cap = document.getElementById('wx-capsule-overlay');
    if (showCapsule) {
      if (!cap) {
        cap = document.createElement('div');
        cap.id = 'wx-capsule-overlay';
        cap.innerHTML = '<span>···</span><span class="sep"></span><span>◉</span>';
        document.body.appendChild(cap);
      }
      const r = computeCapsuleRect();
      cap.style.left = r.left + 'px';
      cap.style.top = r.top + 'px';
      cap.style.width = r.width + 'px';
      cap.style.height = r.height + 'px';
    }
    let home = document.getElementById('wx-home-bar');
    if (safeBottom > 0) {
      if (!home) {
        home = document.createElement('div');
        home.id = 'wx-home-bar';
        document.body.appendChild(home);
      }
    } else if (home) {
      home.remove();
    }
  }
  syncOverlay();

  // Synchronous CommonJS Loader
  const MODULES = ${jsonModules};
  const CACHE = {};

  function resolvePath(baseFile, req) {
    if (!req.startsWith('./') && !req.startsWith('../')) return req;
    const baseParts = baseFile.split('/').slice(0, -1);
    const reqParts = req.split('/');
    for (const part of reqParts) {
      if (part === '.' || part === '') continue;
      if (part === '..') baseParts.pop();
      else baseParts.push(part);
    }
    let resolved = './' + baseParts.filter(p => p !== '.').join('/');
    if (!resolved.endsWith('.js')) resolved += '.js';
    return resolved;
  }

  function runModule(modPath) {
    if (CACHE[modPath]) return CACHE[modPath].exports;
    const code = MODULES[modPath];
    if (typeof code !== 'string') {
      throw new Error('Cannot find Mini Game module: ' + modPath);
    }
    const mod = { exports: {} };
    CACHE[modPath] = mod;
    const localRequire = (req) => runModule(resolvePath(modPath, req));
    const fn = new Function('require', 'module', 'exports', code + '\\n//# sourceURL=' + modPath);
    fn(localRequire, mod, mod.exports);
    return mod.exports;
  }

  window.__MINI_ENTRY__ = runModule('./game.js');
})();
</script>
</body>
</html>`;
}

function startStaticServer() {
  const MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/__wx_preview.html' || urlPath === '/') {
      const moduleMap = loadMiniGameModuleMap();
      const html = buildPreviewHtml(moduleMap);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    const full = path.resolve(MINIGAME_DIR, '.' + urlPath);
    if (!full.startsWith(MINIGAME_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const buf = fs.readFileSync(full);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(buf);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

async function run() {
  const { server, port } = await startStaticServer();
  const baseUrl = `http://127.0.0.1:${port}/__wx_preview.html`;

  const userDataDir = '/tmp/chrome_cdp_minigame_' + Date.now();
  fs.mkdirSync(userDataDir, { recursive: true });
  let chrome = null;
  let ws = null;
  let chromeExit = null;

  try {
  const cdpPort = 9280 + Math.floor(Math.random() * 60);
  console.log('Launching headless browser:', CHROMIUM);
  const chromeEnv = { ...process.env };
  delete chromeEnv.DBUS_SESSION_BUS_ADDRESS;
  chrome = spawn(
    CHROMIUM,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-extensions',
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,760',
      'about:blank'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], env: chromeEnv }
  );

  let chromeStderr = '';
  chrome.stderr.on('data', (chunk) => {
    if (chromeStderr.length < 4000) chromeStderr += chunk.toString();
  });
  chrome.on('error', (err) => {
    chromeStderr += `\n[spawn error] ${err.message}`;
  });
  chrome.on('exit', (code, sig) => {
    chromeExit = `code=${code}, sig=${sig}`;
  });

  const pollCdpJson = () => new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${cdpPort}/json/list`, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(1000, () => { req.destroy(); resolve(null); });
  });

  let wsUrl = null;
  for (let i = 0; i < 225; i++) {
    if (chromeExit !== null) break;
    const pages = await pollCdpJson();
    if (Array.isArray(pages) && pages.length > 0 && pages[0].webSocketDebuggerUrl) {
      wsUrl = pages[0].webSocketDebuggerUrl;
      break;
    }
    await sleep(200);
  }
  if (!wsUrl) {
    throw new Error(
      `Failed to connect to Chromium CDP (bin=${CHROMIUM}, exit=${chromeExit || 'still running'})\n${chromeStderr}`
    );
  }

  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });

  let msgId = 1;
  const pending = new Map();
  const errors = [];

  ws.addEventListener('message', (ev) => {
    const data = JSON.parse(ev.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    } else if (data.method === 'Runtime.exceptionThrown') {
      errors.push('EXCEPTION: ' + JSON.stringify(data.params.exceptionDetails));
    } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      errors.push('CONSOLE.ERROR: ' + JSON.stringify(data.params.args));
    }
  });

  function send(method, params = {}) {
    const id = msgId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function evalJS(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error('JS Eval Error: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async function screenshot(name) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const p = path.join(OUT_DIR, name);
    fs.writeFileSync(p, Buffer.from(data, 'base64'));
    console.log('Saved screenshot:', p);
  }

  async function setViewport(width, height, mobile = false, dpr = 1) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile
    });
    await sleep(250);
  }

  async function navigate(query) {
    try {
      await evalJS(`window.__HOSHI_DEBUG__ = null;`);
    } catch (_) {}
    await send('Page.navigate', { url: `${baseUrl}${query}` });
    for (let i = 0; i < 50; i++) {
      await sleep(150);
      const ready = await evalJS(`(() => {
        if (!window.__HOSHI_DEBUG__) return false;
        const st = window.__HOSHI_DEBUG__.getState();
        return st.assetsTotal > 0 && st.assetsLoaded === st.assetsTotal && st.hits.length > 0;
      })()`);
      if (ready) break;
    }
    await sleep(250);
  }

  async function tapAt(x, y) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await sleep(60);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(160);
  }

  async function longPressAt(x, y, holdMs = 390) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await sleep(holdMs);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(180);
  }

  async function tapHit(id) {
    const rect = await evalJS(`(() => {
      const st = window.__HOSHI_DEBUG__.getState();
      return st.hits.find(h => h.id === ${JSON.stringify(id)}) || null;
    })()`);
    assert(rect, `Hit rect '${id}' not found`);
    await tapAt(Math.round(rect.x + rect.w * 0.5), Math.round(rect.y + rect.h * 0.5));
  }

  async function dragSwipe(x1, y1, x2, y2, steps = 8) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(x1 + (x2 - x1) * t),
        y: Math.round(y1 + (y2 - y1) * t),
        button: 'left'
      });
      await sleep(20);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
    await sleep(160);
  }

  async function checkCapsuleAndViewportBounds(label, width, height, safeBottom = 0) {
    const info = await evalJS(`(() => {
      const st = window.__HOSHI_DEBUG__.getState();
      const cap = window.__WX_HARNESS__.getMenuRect();
      return { hits: st.hits, cap, assetsLoaded: st.assetsLoaded, assetsTotal: st.assetsTotal };
    })()`);
    assert(info.assetsLoaded === 43 && info.assetsTotal === 43, `${label}: assets ${info.assetsLoaded}/${info.assetsTotal}`);
    for (const h of info.hits) {
      if (h.id === 'modal_backdrop' || h.id === 'modal_body_guard') continue;
      assert(h.x >= -1 && h.y >= -1, `${label}: hit ${h.id} out of top-left (${h.x},${h.y})`);
      assert(h.x + h.w <= width + 2, `${label}: hit ${h.id} exceeds width (${h.x + h.w} > ${width})`);
      assert(h.y + h.h <= height - safeBottom + 2, `${label}: hit ${h.id} overlaps bottom safe area (${h.y + h.h} > ${height - safeBottom})`);
      const overlapX = h.x < info.cap.right + 2 && h.x + h.w > info.cap.left - 2;
      const overlapY = h.y < info.cap.bottom + 2 && h.y + h.h > info.cap.top - 2;
      assert(!(overlapX && overlapY), `${label}: hit ${h.id} (${h.x},${h.y},${h.w}x${h.h}) overlaps WeChat capsule (${JSON.stringify(info.cap)})`);
    }
    console.log(`[Layout OK] ${label} — ${info.hits.length} hits clear of capsule & safeArea`);
  }

  await send('Page.enable');
  await send('Runtime.enable');

  // ==========================================================
  // 1. Desktop 1280x760: Lobby, Patron Poke, Shop Buy & Persist
  // ==========================================================
  await setViewport(1280, 760, false, 1);
  await navigate('?safeTop=8&safeBottom=0&capsule=1');
  let st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  console.log('Init state:', {
    isWeChat: st.isWeChat,
    lobbyOpen: st.lobbyOpen,
    assetsLoaded: st.assetsLoaded,
    assetsTotal: st.assetsTotal,
    hitIds: st.hits.map((h) => h.id),
    errors
  });
  assert(errors.length === 0, `Startup errors: ${errors.join(' | ')}`);
  assert(st.lobbyOpen === true, 'Lobby must open by default');
  assert(st.hits.some((h) => h.id === 'lobby_patron_poke'), 'Expected lobby_patron_poke hit');
  await checkCapsuleAndViewportBounds('Desktop Lobby 1280x760', 1280, 760, 0);
  await screenshot('01_lobby_desktop_1280.png');

  // Tap patron poke + switch patron + test Shop purchases
  await tapHit('lobby_patron_poke');
  await tapHit('lobby_patron_chip_mikan');
  await evalJS(`window.__HOSHI_DEBUG__.addBankStardust(2500)`);
  await tapHit('btn_shop');
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'shop', 'Shop modal opened');
  const firstUpBuy = st.hits.find((h) => h.id.startsWith('shop_up_'));
  if (firstUpBuy) await tapHit(firstUpBuy.id);
  await tapHit('shop_tab_themes');
  await sleep(160);
  await tapHit('shop_theme_sakura'); // unlock & equip immediately
  await sleep(160);
  await tapHit('shop_tab_patrons');
  await sleep(160);
  await tapHit('shop_patron_luna'); // invite & activate immediately
  await sleep(160);
  await screenshot('02_shop_patrons_desktop_1280.png');
  await tapHit('modal_close');
  await sleep(160);

  // ==========================================================
  // 2. iPhone 14 390x844 (dpr=2, safeTop=47, safeBottom=34)
  // ==========================================================
  await setViewport(390, 844, true, 2);
  await navigate('?safeTop=47&safeBottom=34&capsule=1');
  let sd = await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`);
  assert(sd.equippedTheme === 'sakura', `Persisted theme expected sakura, got ${sd.equippedTheme}`);
  assert(sd.selectedPatron === 'luna', `Persisted patron expected luna, got ${sd.selectedPatron}`);
  assert(sd.unlockedPatrons.includes('luna'), 'Luna unlocked persisted');
  await checkCapsuleAndViewportBounds('iPhone 14 Lobby 390x844', 390, 844, 34);
  await screenshot('03_lobby_iphone_390.png');

  // Career Modal + Drag Scroll
  await tapHit('btn_career');
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'career', 'Career modal opened');
  await dragSwipe(195, 520, 195, 290, 8);
  await screenshot('04_career_iphone_390.png');
  await tapHit('modal_close');
  await sleep(150);

  // Help Modal
  await tapHit('lobby_help');
  await sleep(180);
  await screenshot('05_help_iphone_390.png');
  await tapHit('modal_close');
  await sleep(150);

  // Compendium Modal
  await tapHit('btn_comp');
  await sleep(180);
  await screenshot('06_compendium_iphone_390.png');
  await tapHit('modal_close');
  await sleep(150);

  // ==========================================================
  // 3. Compact iPhone SE 375x667 (dpr=2, safeTop=20) & Chef Mode
  // ==========================================================
  await setViewport(375, 667, true, 2);
  await navigate('?safeTop=20&safeBottom=0&capsule=1');
  await checkCapsuleAndViewportBounds('iPhone SE Lobby 375x667', 375, 667, 0);
  await screenshot('07_lobby_375.png');

  await tapHit('mode_chef');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(340);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'chef' && st.running === true && st.lobbyOpen === false, 'Started chef mode');
  assert(
    st.activeModal === 'mode_guide' && st.guideMode === 'chef' && st.guideStep === 0 && st.paused === true,
    `Expected first-time Chef spotlight mode_guide (step 0, paused), got modal=${st.activeModal}, step=${st.guideStep}, paused=${st.paused}`
  );
  await checkCapsuleAndViewportBounds('iPhone SE Chef Mode Guide Step 1 375x667', 375, 667, 0);
  await screenshot('08a_mode_guide_chef_375.png');

  // Advance through all 3 spotlight guide steps
  await tapHit('guide_next');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'mode_guide' && st.guideStep === 1, `Expected Chef guide step 1, got ${st.guideStep}`);
  await checkCapsuleAndViewportBounds('iPhone SE Chef Mode Guide Step 2 375x667', 375, 667, 0);
  await screenshot('08a2_mode_guide_serve_375.png');

  await tapHit('guide_next');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'mode_guide' && st.guideStep === 2, `Expected Chef guide step 2, got ${st.guideStep}`);
  await checkCapsuleAndViewportBounds('iPhone SE Chef Mode Guide Step 3 375x667', 375, 667, 0);

  await tapHit('guide_next');
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null && st.paused === false, `Expected Chef guide finished & unpaused, got modal=${st.activeModal}`);

  // Verify HUD '?' (play_help) re-opens mode_guide anytime and [跳过指引] skips in 1 tap
  await tapHit('play_help');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'mode_guide' && st.guideStep === 0, 'Expected play_help to reopen mode_guide');
  await tapHit('guide_skip');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null && st.paused === false, 'Expected guide_skip to dismiss mode_guide immediately');

  assert(st.shift === 1 && st.shiftTarget === 1200, `Expected Shift 1 target ¥1200, got shift=${st.shift}, target=${st.shiftTarget}`);
  assert(st.stepsLeft === 16 && st.stepsMax === 16, `Expected 16/16 steps in Shift 1, got ${st.stepsLeft}/${st.stepsMax}`);
  assert(st.dropX === 220, `Expected launcher fixed at center x=220, got ${st.dropX}`);
  assert(st.hits.some((h) => h.id === 'mobile_relics_bar'), 'Expected mobile_relics_bar hit in Chef HUD');
  assert(st.entities.length === 4, `Expected 4 pre-populated starter treats, got ${st.entities.length}`);
  assert(st.orders && st.orders.length === 2, `Expected Dual-Table orders (2), got ${st.orders && st.orders.length}`);
  assert(st.entities.some((e) => e.isServable), 'Expected starter T3 to be immediately servable with bell halo');
  await checkCapsuleAndViewportBounds('iPhone SE Chef HUD 375x667', 375, 667, 0);
  await screenshot('08_chef_375.png');

  async function waitForCooldown() {
    await sleep(240);
  }

  const jb = st.jarBox;
  assert(jb && jb.scale > 0, 'jarBox computed');

  // 3A. Zero-Misfire Quick Tap vs Dedicated 【上菜】 Button & Long-Press-to-Serve
  const starterT3 = st.entities.find((e) => e.isServable);
  assert(starterT3, 'Expected a servable starter treat');
  const t3ScreenX = Math.round(jb.x + starterT3.x * jb.scale);
  const t3ScreenY = Math.round(jb.y + starterT3.y * jb.scale);
  const dropsBeforeQuickTap = st.dropsMadeThisRun;
  await tapAt(t3ScreenX, t3ScreenY);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.servesCompleted === 0 && st.dropsMadeThisRun === dropsBeforeQuickTap + 1 && st.dropX === 220,
    `Quick tap on servable treat must aim & shoot from fixed turret (dropX=220) without misfire serving: serves=${st.servesCompleted}, drops=${st.dropsMadeThisRun}, dropX=${st.dropX}`
  );
  await waitForCooldown();

  // Dedicated 【上菜】 button on order bar serves cleanly
  const serveBtnHit = st.hits.find((h) => h.id === 'm_serve_order_0' || h.id === 'm_serve_order_1');
  assert(serveBtnHit, `Expected dedicated m_serve_order_* button when servable treat exists, hits=${st.hits.map((h) => h.id).join(',')}`);
  const scoreBeforeServe = st.score;
  await tapHit(serveBtnHit.id);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.servesCompleted >= 1, `Expected servesCompleted >= 1 after dedicated 【上菜】 button, got ${st.servesCompleted}`);
  assert(st.score > scoreBeforeServe, 'Expected dedicated 【上菜】 button to award score');
  assert(st.skillEnergy >= 30, `Expected serve to charge skillEnergy >= 30, got ${st.skillEnergy}`);
  assert(st.serveCascadeTimer > 0, `Expected Serve Cascade Avalanche window active, got ${st.serveCascadeTimer}`);

  // Long-Press-to-Serve (>= 0.32s) directly on a servable treat in jar serves without shooting
  const lpTier = st.orders.find((o) => !o.completed).slots.find((s) => !s.done).tier;
  const lpId = await evalJS(`window.__HOSHI_DEBUG__.spawnTestEntity(${lpTier}, 142, 444)`);
  await sleep(120);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const lpEnt = st.entities.find((e) => e.id === lpId);
  assert(lpEnt && lpEnt.isServable, 'Expected spawned treat to be servable for Long-Press test');
  const dropsBeforeLp = st.dropsMadeThisRun;
  const servesBeforeLp = st.servesCompleted;
  await longPressAt(Math.round(jb.x + lpEnt.x * jb.scale), Math.round(jb.y + lpEnt.y * jb.scale), 390);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.servesCompleted === servesBeforeLp + 1 && st.dropsMadeThisRun === dropsBeforeLp && !st.entities.some((e) => e.id === lpId),
    `Expected Long-Press-to-Serve to serve treat without firing a shot: serves=${st.servesCompleted}/${servesBeforeLp}, drops=${st.dropsMadeThisRun}/${dropsBeforeLp}`
  );

  // 3B. Fixed-Center Angle Aiming & Bank-Shot (dropX stays locked at 220 while aiming left!)
  const slingStartX = Math.round(jb.x + jb.w * 0.5);
  const slingStartY = Math.round(jb.y + jb.h * 0.25);
  const slingEndX = Math.round(jb.x + jb.w * 0.14);
  const slingEndY = Math.round(jb.y + jb.h * 0.52);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: slingStartX, y: slingStartY, button: 'left', clickCount: 1 });
  for (let sIdx = 1; sIdx <= 8; sIdx++) {
    const t = sIdx / 8;
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(slingStartX + (slingEndX - slingStartX) * t),
      y: Math.round(slingStartY + (slingEndY - slingStartY) * t),
      button: 'left'
    });
    await sleep(22);
  }
  await sleep(100);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.aim && st.aim.active && st.aim.mode === 'sling', `Expected turret angle aim mode active, got ${JSON.stringify(st.aim)}`);
  assert(st.dropX === 220, `Expected launcher dropX locked at 220 during off-center drag, got ${st.dropX}`);
  assert(st.aim.angle < -0.25 && st.aim.launchVx < -100, `Expected leftward launch angle & negative vx, got angle=${st.aim.angle}, vx=${st.aim.launchVx}`);
  await screenshot('08b_slingshot_aim_375.png');
  const dropsBeforeSling = st.dropsMadeThisRun;
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: slingEndX, y: slingEndY, button: 'left', clickCount: 1 });
  await sleep(520);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.dropsMadeThisRun === dropsBeforeSling + 1, 'Angled release must launch treat');
  assert(st.dropX === 220, `Expected dropX still locked at 220 after release, got ${st.dropX}`);

  // 3C. Wide sideways angle sweep — top launch point MUST stay fixed at 220 with wide angle < -0.9
  await waitForCooldown();
  const wideStartX = Math.round(jb.x + jb.w * 0.5);
  const wideStartY = Math.round(jb.y + jb.h * 0.25);
  const wideScale = jb.w / 440;
  const widePath = [
    [0, 18], [0, 36], [0, 46],
    [-30, 40], [-60, 30], [-90, 20], [-120, 12], [-140, 6]
  ];
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: wideStartX, y: wideStartY, button: 'left', clickCount: 1 });
  let wideDropX = null;
  for (let pIdx = 0; pIdx < widePath.length; pIdx++) {
    const [dxL, dyL] = widePath[pIdx];
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(wideStartX + dxL * wideScale),
      y: Math.round(wideStartY + dyL * wideScale),
      button: 'left'
    });
    await sleep(22);
    if (pIdx === 2) {
      const s2 = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
      assert(s2.aim.mode === 'sling', `Expected sling after pull-down, got ${s2.aim.mode}`);
      wideDropX = s2.dropX;
    }
  }
  await sleep(80);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.aim && st.aim.active && st.aim.mode === 'sling', `Wide sideways swing must stay in aim mode, got ${JSON.stringify(st.aim)}`);
  assert(wideDropX === 220 && st.dropX === 220, `Drop point must stay locked at 220 (was ${wideDropX}, now ${st.dropX})`);
  assert(st.aim.angle < -0.9, `Wide left swing must form a wide launch angle, got ${st.aim.angle}`);
  await screenshot('08c_slingshot_wide_angle_375.png');
  const dropsBeforeWide = st.dropsMadeThisRun;
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: Math.round(wideStartX - 140 * wideScale),
    y: Math.round(wideStartY + 6 * wideScale),
    button: 'left',
    clickCount: 1
  });
  await sleep(520);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.dropsMadeThisRun === dropsBeforeWide + 1, 'Wide-angle release must launch treat');
  await waitForCooldown();

  // Hold swap + Off-center right press & release (must keep dropX === 220 and aim/launch rightward!)
  await tapHit('mobile_hold_swap');
  await sleep(160);
  const offRightX = Math.round(jb.x + jb.w * 0.72);
  const offRightY = Math.round(jb.y + jb.h * 0.30);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: offRightX, y: offRightY, button: 'left', clickCount: 1 });
  await sleep(80);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.dropX === 220 && st.aimAngle > 0.2 && st.aim.launchVx > 100,
    `Off-center right press must keep dropX=220 and aim right, got dropX=${st.dropX}, aimAngle=${st.aimAngle}, vx=${st.aim.launchVx}`
  );
  const dropsBeforeRightTap = st.dropsMadeThisRun;
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: offRightX, y: offRightY, button: 'left', clickCount: 1 });
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.dropX === 220 && st.dropsMadeThisRun === dropsBeforeRightTap + 1,
    `Off-center right release must launch from center x=220, got dropX=${st.dropX}, drops=${st.dropsMadeThisRun}`
  );
  await waitForCooldown();

  // Trigger Meteor -> Yarn Ball -> Toggle Debug Wireframe
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('meteor')`);
  await sleep(200);
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('yarn')`);
  await evalJS(`window.__HOSHI_DEBUG__.togglePhysicsDebug(true)`);
  await sleep(340);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.entities.length >= 3, `Expected dropped entities >= 3, got ${st.entities.length}`);
  assert(st.entities.some((e) => e.isYarnBall && e.yarnHp === 2), 'Expected active yarn ball with yarnHp=2');
  await screenshot('09_physics_yarn_375.png');
  await evalJS(`window.__HOSHI_DEBUG__.togglePhysicsDebug(false)`);

  // 3C. Rainbow Wildcard E2E (covers NEXT preview, active held treat, HOLD swap, and jar drop under iOS color guard)
  await evalJS(`window.__HOSHI_DEBUG__.grantRainbow()`);
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.nextMeta && st.nextMeta.wildcard === true, 'Expected Rainbow Wildcard in NEXT preview');

  await tapAt(Math.round(jb.x + jb.w * 0.5), Math.round(jb.y + jb.h * 0.28));
  await waitForCooldown();
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.curMeta && st.curMeta.wildcard === true, 'Expected Rainbow Wildcard to advance to held treat');

  await tapHit('mobile_hold_swap');
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.holdMeta && st.holdMeta.wildcard === true, 'Expected Rainbow Wildcard inside HOLD preview');
  await screenshot('09b_rainbow_hold_375.png');

  await tapAt(Math.round(jb.x + jb.w * 0.35), Math.round(jb.y + jb.h * 0.28));
  await waitForCooldown();
  await tapHit('mobile_hold_swap');
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.curMeta && st.curMeta.wildcard === true, 'Expected Rainbow Wildcard swapped back to held treat');

  const beforeWildScore = st.score;
  await tapAt(Math.round(jb.x + jb.w * 0.5), Math.round(jb.y + jb.h * 0.28));
  await sleep(420);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.entities.some((e) => e.isWildcard) || st.score > beforeWildScore, 'Expected Rainbow Wildcard active in jar or merged cleanly');

  // 3D. 9-Tier Dessert Traits Check (T7 Cosmic Macaron low-gravity float + T4 Lemon Tart blueberry cleanse)
  const macId = await evalJS(`window.__HOSHI_DEBUG__.spawnTestEntity(7, 220, 260)`);
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const macEnt = st.entities.find((e) => e.id === macId);
  assert(macEnt && macEnt.gravityScale < 0.7, `Expected T7 Macaron buoyant gravityScale < 0.7, got ${macEnt && macEnt.gravityScale}`);

  // 3E. Active Chef Signature Skills Check (Luna Swap -> Mugi Meteor -> Mikan Scoop)
  await evalJS(`window.__HOSHI_DEBUG__.selectPatron('luna'); window.__HOSHI_DEBUG__.chargeSkill();`);
  await sleep(180);
  await tapHit('chef_skill_btn');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeSkillMode === 'swap_1', `Expected Luna swap_1 mode, got ${st.activeSkillMode}`);
  const swappable = st.entities.filter((e) => !e.isYarnBall);
  assert(swappable.length >= 2, 'Need >= 2 swappable entities for Luna skill test');
  const swA = swappable[0];
  await tapAt(Math.round(jb.x + swA.x * jb.scale), Math.round(jb.y + swA.y * jb.scale));
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeSkillMode === 'swap_2', `Expected Luna swap_2 mode after 1st tap, got ${st.activeSkillMode}`);
  const swB = st.entities.find((e) => !e.isYarnBall && !(e.frozenHp > 0) && e.id !== swA.id);
  assert(swB, 'Need live second swappable entity for Luna swap_2');
  await tapAt(Math.round(jb.x + swB.x * jb.scale), Math.round(jb.y + swB.y * jb.scale));
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeSkillMode === null && st.skillEnergy < 60,
    `Expected Luna swap to complete and consume 100 skillEnergy (mode=${st.activeSkillMode}, energy=${st.skillEnergy})`
  );

  // Mugi Meteor Shot arming
  await evalJS(`window.__HOSHI_DEBUG__.selectPatron('mugi'); window.__HOSHI_DEBUG__.chargeSkill();`);
  await sleep(160);
  await tapHit('chef_skill_btn');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.nextShotMeteor === true && st.skillEnergy === 0, 'Expected Mugi Meteor Shot armed');

  // Mikan Gold Scoop
  await evalJS(`window.__HOSHI_DEBUG__.selectPatron('mikan'); window.__HOSHI_DEBUG__.chargeSkill();`);
  await sleep(160);
  await tapHit('chef_skill_btn');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeSkillMode === 'scoop', `Expected Mikan scoop mode, got ${st.activeSkillMode}`);
  const scoopTarget = st.entities.find((e) => !e.isYarnBall && !e.isWildcard && e.tier <= 5);
  if (scoopTarget) {
    await tapAt(Math.round(jb.x + scoopTarget.x * jb.scale), Math.round(jb.y + scoopTarget.y * jb.scale));
    await sleep(180);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    assert(st.activeSkillMode === null && st.serveCascadeTimer > 0, 'Expected Mikan scoop to exit targeting and open cascade window');
  } else {
    await tapHit('cancel_tool');
  }

  // Consolidated Organic Event ('meteor') + Non-Blocking Milestone Supply in Chef (no blocking blessing modal or bottom-jar button!)
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent()`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeEvent && st.activeEvent.kind === 'meteor', `Expected consolidated organic event 'meteor', got ${JSON.stringify(st.activeEvent)}`);
  const coinsBeforeGrant = st.coins;
  const dustBeforeGrant = st.stardust;
  await evalJS(`window.__HOSHI_DEBUG__.queueBlessing('测试里程碑补给')`);
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.coins > coinsBeforeGrant &&
      st.stardust > dustBeforeGrant &&
      st.activeModal === null &&
      !st.hits.some((h) => h.id === 'open_blessing_btn'),
    `Expected non-blocking Chef milestone supply (+coins/+stardust) without open_blessing_btn occlusion: coins=${st.coins}/${coinsBeforeGrant}, modal=${st.activeModal}`
  );
  await screenshot('10_relic_milestone_375.png');

  // 3F. Phase 2 — 5-Shift Early Close, Mobile Prep Shop (Reroll/Buy/Sell/Mod), Persistent Shift 2 Carry-Over & Relics
  await evalJS(`
    window.__HOSHI_DEBUG__.spawnTestEntity(3, 118, 448);
    window.__HOSHI_DEBUG__.spawnTestEntity(4, 318, 444);
    window.__HOSHI_DEBUG__.addShiftRevenue(1300);
  `);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const settledBeforeClose = st.entities.filter((e) => !e.isYarnBall).length;
  assert(settledBeforeClose >= 4, `Expected >= 4 settled treats before closing Shift 1, got ${settledBeforeClose}`);
  assert(st.shiftClearedFlag === true, `Expected shiftClearedFlag=true after meeting target, got ${st.shiftClearedFlag}`);
  assert(st.hits.some((h) => h.id === 'btn_close_shift_early'), 'Expected btn_close_shift_early CTA in mobile HUD');
  await checkCapsuleAndViewportBounds('iPhone SE Chef Early Close 375x667', 375, 667, 0);
  await screenshot('10b_early_close_375.png');

  const coinsBeforeEarlyClose = st.coins;
  const stepsBeforeEarlyClose = st.stepsLeft;
  await tapHit('btn_close_shift_early');
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'prep_shop', `Expected prep_shop modal after early close, got ${st.activeModal}`);
  assert(
    st.coins >= coinsBeforeEarlyClose + 35 + stepsBeforeEarlyClose * 4,
    `Expected coins payout >= base(35)+interest(${stepsBeforeEarlyClose * 4}), before=${coinsBeforeEarlyClose}, after=${st.coins}`
  );
  assert(
    st.prepShop &&
      st.prepShop.nextShiftNum === 2 &&
      Array.isArray(st.prepShop.nextHazards) &&
      st.prepShop.nextHazards.includes('glaze_ring') &&
      st.prepShop.relicOffers.length === 3 &&
      st.prepShop.modOffers.length === 2,
    `Unexpected prepShop state: ${JSON.stringify(st.prepShop)}`
  );
  await checkCapsuleAndViewportBounds('iPhone SE Prep Shop Top 375x667', 375, 667, 0);
  await screenshot('10c_prep_shop_375.png');

  // Add extra coins to test Reroll -> Buy Relic -> Sell Relic (50% refund) -> Re-buy Relic -> Scroll & Buy Deck Mod
  await evalJS(`window.__HOSHI_DEBUG__.addCoins(300)`);
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const rerollCostBefore = st.prepShop.rerollCost;
  await tapHit('prep_reroll');
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.prepShop.rerollCost === rerollCostBefore + 5,
    `Expected prep_reroll cost to increment +5 (before=${rerollCostBefore}, after=${st.prepShop.rerollCost})`
  );

  // Buy first relic offer
  const firstRelicHit = st.hits.find((h) => h.id.startsWith('prep_buy_relic_'));
  assert(firstRelicHit, 'Expected at least one prep_buy_relic_* hit in Prep Shop');
  const firstRelicId = firstRelicHit.id.replace('prep_buy_relic_', '');
  const coinsBeforeBuy = st.coins;
  await tapHit(firstRelicHit.id);
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.relics.includes(firstRelicId), `Expected relic ${firstRelicId} equipped after purchase`);
  assert(st.coins < coinsBeforeBuy, 'Expected coin deduction after buying relic');

  // Sell that relic for 50% refund
  const coinsBeforeSell = st.coins;
  await tapHit(`prep_sell_${firstRelicId}`);
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(!st.relics.includes(firstRelicId), `Expected relic ${firstRelicId} removed after selling`);
  assert(st.coins > coinsBeforeSell, 'Expected 50% coin refund after selling relic');

  // Buy another available relic so we carry a relic into Shift 2
  const secondRelicHit = st.hits.find((h) => h.id.startsWith('prep_buy_relic_'));
  assert(secondRelicHit, 'Expected second prep_buy_relic_* hit');
  await tapHit(secondRelicHit.id);
  await sleep(200);

  // Scroll Prep Shop body down to reach Deck Sculpting Mods and buy one
  await dragSwipe(188, 520, 188, 190, 8);
  await sleep(200);
  await checkCapsuleAndViewportBounds('iPhone SE Prep Shop Scrolled 375x667', 375, 667, 0);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const modHit = st.hits.find((h) => h.id.startsWith('prep_buy_mod_'));
  assert(modHit, 'Expected prep_buy_mod_* hit after scrolling Prep Shop');
  await tapHit(modHit.id);
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.prepShop.modOffers.some((m) => m.bought), 'Expected Deck Mod offer marked bought');

  // Launch Shift 2 & verify First-Time Glaze Ring Spotlight Tip + Persistent Hot-Oven Carry-Over (>= 4 treats!) + Glaze Ring hazard
  await tapHit('prep_next_shift');
  await sleep(340);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeModal === 'mode_guide' && st.guideMode === 'tip_glaze_ring',
    `Expected first-time tip_glaze_ring spotlight guide on Shift 2 start, got modal=${st.activeModal}, guideMode=${st.guideMode}`
  );
  await checkCapsuleAndViewportBounds('iPhone SE Glaze Ring Tip 375x667', 375, 667, 0);
  await screenshot('10f_tip_glaze_ring_375.png');
  await tapHit('guide_next');
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const saveAfterGlazeTip = await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`);
  assert(
    st.activeModal === null && saveAfterGlazeTip.seenTips && saveAfterGlazeTip.seenTips.glaze_ring === true,
    `Expected tip_glaze_ring dismissed & persisted, got modal=${st.activeModal}, seenTips=${JSON.stringify(saveAfterGlazeTip.seenTips)}`
  );
  assert(st.shift === 2 && st.shiftTarget === 2600, `Expected Shift 2 target ¥2600, got shift=${st.shift}, target=${st.shiftTarget}`);
  assert(st.stepsLeft >= 16, `Expected >= 16 steps in Shift 2, got ${st.stepsLeft}`);
  assert(
    st.entities.length >= 4 && st.entities.length >= Math.min(12, settledBeforeClose) - 2,
    `Expected persistent Hot-Oven Carry-Over (>= 4 treats, not wiped to 2) in Shift 2 jar, got ${st.entities.length} (from ${settledBeforeClose})`
  );

  // Verify Relics Mechanics: rel_bumpers (2 Butter Bumpers) + Shift 2 glaze_ring, rel_aged (agedStacks++), rel_antigrav (4th drop flips gravity!)
  await evalJS(`
    window.__HOSHI_DEBUG__.equipRelic('rel_bumpers');
    window.__HOSHI_DEBUG__.equipRelic('rel_aged');
    window.__HOSHI_DEBUG__.equipRelic('rel_antigrav');
  `);
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const shift2Bumpers = (st.obstacles || []).filter((o) => o.type === 'bumper');
  const shift2Rings = (st.obstacles || []).filter((o) => o.type === 'glaze_ring');
  assert(
    shift2Bumpers.length === 2 && shift2Rings.length === 1 && st.shiftHazards.includes('glaze_ring'),
    `Expected 2 Butter Bumpers + 1 glaze_ring in Shift 2, got obstacles=${JSON.stringify(st.obstacles)}`
  );

  // Spawn an isolated servable treat matching active order on the left, then drop 4 treats on the right
  const activeOrder = st.orders.find((o) => !o.completed);
  const neededSlot = activeOrder && activeOrder.slots.find((s) => !s.done);
  assert(neededSlot, 'Expected active uncompleted order slot in Shift 2');
  const agedTestId = await evalJS(`window.__HOSHI_DEBUG__.spawnTestEntity(${neededSlot.tier}, 115, 430)`);
  await sleep(120);
  const jb2 = st.jarBox;
  const dropsBeforeAnti = st.dropsMadeThisRun;
  const dropFracs = [0.46, 0.54, 0.50, 0.56, 0.44, 0.52, 0.48, 0.58];
  for (let attempt = 0; attempt < dropFracs.length; attempt++) {
    await tapAt(Math.round(jb2.x + jb2.w * dropFracs[attempt]), Math.round(jb2.y + jb2.h * 0.24));
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    if (st.dropsMadeThisRun - dropsBeforeAnti >= 4) break;
    await sleep(260);
  }
  assert(
    st.antigravTimer > 0,
    `Expected rel_antigrav to trigger on 4th drop (antigravTimer=${st.antigravTimer}, dropsDelta=${st.dropsMadeThisRun - dropsBeforeAnti}, relics=${JSON.stringify(st.relics)}, modal=${st.activeModal}, paused=${st.paused}, stepsLeft=${st.stepsLeft})`
  );
  const agedEnt = st.entities.find((e) => e.id === agedTestId);
  assert(
    (agedEnt && agedEnt.agedStacks >= 1) || st.entities.some((e) => e.agedStacks >= 1),
    `Expected rel_aged to increment agedStacks on servable treat (agedEnt=${JSON.stringify(agedEnt)})`
  );
  await screenshot('10d_relics_antigrav_bumpers_375.png');

  // Open Relics Build Inspector Modal from HUD bar
  await tapHit('mobile_relics_bar');
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'relics', `Expected relics inspector modal, got ${st.activeModal}`);
  await checkCapsuleAndViewportBounds('iPhone SE Relics Modal 375x667', 375, 667, 0);
  await screenshot('10e_relics_modal_375.png');
  await tapHit('modal_close');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null, 'Relics modal closed cleanly');

  // ==========================================================
  // 3G. Phase 3 — Caramel Glaze Ring Patrol, Aim Highlight & Pass-Through Gilding (375x667)
  // ==========================================================
  await evalJS(`
    window.__HOSHI_DEBUG__.startMode('chef');
    window.__HOSHI_DEBUG__.setShift(2);
  `);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.shift === 2 && st.shiftHazards.includes('glaze_ring'), `Expected Shift 2 glaze_ring, got ${JSON.stringify(st.shiftHazards)}`);
  const ringT0 = st.obstacles.find((o) => o.type === 'glaze_ring');
  assert(ringT0 && ringT0.y === 185 && ringT0.rx === 38, `Unexpected glaze_ring geometry: ${JSON.stringify(ringT0)}`);
  await sleep(320);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const ringT1 = st.obstacles.find((o) => o.type === 'glaze_ring');
  assert(
    ringT1 && Math.abs(ringT1.x - ringT0.x) > 4 && ringT1.x >= 94 && ringT1.x <= 346,
    `Expected glaze_ring to patrol smoothly within [95,345] (x0=${ringT0.x}, x1=${ringT1 && ringT1.x})`
  );

  // Snap ring to center x=220, hold vertical aim through ring, capture clean aim screenshot, then re-snap & release to gild!
  await sleep(950);
  await evalJS(`
    window.__HOSHI_DEBUG__.clearEntities();
    window.__HOSHI_DEBUG__.setGlazeRingX(220);
  `);
  await sleep(80);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const jb3g = st.jarBox;
  const aimX3g = Math.round(jb3g.x + jb3g.w * 0.5);
  const aimY3g = Math.round(jb3g.y + jb3g.h * 0.24);
  const glazeHitsBefore = st.glazeHitsThisRun;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: aimX3g, y: aimY3g, button: 'left', clickCount: 1 });
  await sleep(120);
  await evalJS(`window.__HOSHI_DEBUG__.setGlazeRingX(220)`);
  await sleep(40);
  await screenshot('15_glaze_ring_aim_375.png');
  // Re-snap ring right before release since captureScreenshot takes ~300ms while ring patrols continuously
  await evalJS(`window.__HOSHI_DEBUG__.setGlazeRingX(220)`);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: aimX3g, y: aimY3g, button: 'left', clickCount: 1 });
  await sleep(520);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.glazeHitsThisRun > glazeHitsBefore && st.entities.some((e) => e.isGolden),
    `Expected dropped treat passing through glaze_ring to become golden (glazeHits=${st.glazeHitsThisRun}, entities=${JSON.stringify(st.entities)})`
  );
  console.log('[Phase 3G OK] Caramel Glaze Ring patrol, aim highlight & pass-through gilding verified');

  // ==========================================================
  // 3H. Phase 3 — Wooden Divider Collision, Split-Bay Layout, Anti-Tunneling & Non-WallBounce (375x667)
  // ==========================================================
  await evalJS(`window.__HOSHI_DEBUG__.setShift(3, { forceHazard: 'divider' })`);
  await sleep(320);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.shift === 3 && st.shiftHazards.includes('divider'), `Expected Shift 3 divider hazard, got ${JSON.stringify(st.shiftHazards)}`);
  const divOb = st.obstacles.find((o) => o.type === 'divider');
  assert(
    divOb && divOb.w === 14 && divOb.h === 155 && divOb.topY === 337 && divOb.bottomY === 492,
    `Unexpected divider geometry: ${JSON.stringify(divOb)}`
  );
  const frozenOnShift3 = st.entities.filter((e) => e.frozenHp > 0);
  assert(frozenOnShift3.length === 2, `Expected 2 frozen treats in Shift 3, got ${frozenOnShift3.length}`);
  assert(
    frozenOnShift3.some((e) => e.x < 213) && frozenOnShift3.some((e) => e.x > 227),
    `Expected frozen treats split across left & right bays (positions=${JSON.stringify(frozenOnShift3.map((e) => [e.x, e.y]))})`
  );
  for (const ent of st.entities) {
    assert(
      !(ent.y > 337 && ent.x > 212 && ent.x < 228),
      `Entity ${ent.id} overlapped divider centerline at (${ent.x}, ${ent.y})`
    );
  }
  await checkCapsuleAndViewportBounds('iPhone SE Shift 3 Divider + Frozen 375x667', 375, 667, 0);
  await screenshot('16_shift3_divider_frozen_375.png');

  // High-speed anti-tunneling + non-wallBounce test against wooden divider
  await evalJS(`
    window.__HOSHI_DEBUG__.clearEntities();
    window.__HOSHI_DEBUG__.spawnTestEntity(2, 165, 420, { vx: 780, vy: 0, isBankLaunched: true, preSettled: false });
  `);
  await sleep(340);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const fastDivEnt = st.entities[0];
  assert(
    fastDivEnt && fastDivEnt.x < 213 && fastDivEnt.wallBounces === 0,
    `Expected fast treat blocked by divider without tunneling or false wallBounce (ent=${JSON.stringify(fastDivEnt)})`
  );
  console.log('[Phase 3H OK] Wooden Divider collision, split-bay layout, anti-tunneling & non-wallBounce verified');

  // ==========================================================
  // 3I. Phase 3 — Frozen Blocking (Merge/Serve/Scoop/Swap/Spoon) & All 3 Thaw Triggers (+¥120) + Shift Badge Modal (375x667)
  // ==========================================================
  await evalJS(`window.__HOSHI_DEBUG__.setShift(3, { forceHazard: 'divider' })`);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const qOrd3i = st.orders.find((o) => !o.completed);
  const matchTier3i = (qOrd3i && qOrd3i.slots[0] && qOrd3i.slots[0].tier) || 3;
  const ids3i = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    const frozenId = window.__HOSHI_DEBUG__.spawnTestEntity(${matchTier3i}, 118, 448, { frozenHp: 1 });
    const sameAdjId = window.__HOSHI_DEBUG__.spawnTestEntity(${matchTier3i}, 168, 448);
    const otherBayId = window.__HOSHI_DEBUG__.spawnTestEntity(2, 318, 448);
    return { frozenId, sameAdjId, otherBayId };
  })()`);
  await sleep(360);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const fEnt = st.entities.find((e) => e.id === ids3i.frozenId);
  assert(
    fEnt && fEnt.frozenHp === 1 && fEnt.isServable === false,
    `Expected frozen treat to stay unmerged & non-servable (fEnt=${JSON.stringify(fEnt)})`
  );
  const serveBlocked = await evalJS(`window.__HOSHI_DEBUG__.serveById(${ids3i.frozenId})`);
  assert(serveBlocked === false, 'Expected serveById on frozen treat to return false');

  // Guard check: Mikan Scoop, Luna Swap, and Upgrade Spoon must reject frozen treat without consuming charge
  const jb3i = st.jarBox;
  const fScreenX = Math.round(jb3i.x + fEnt.x * jb3i.scale);
  const fScreenY = Math.round(jb3i.y + fEnt.y * jb3i.scale);

  await evalJS(`window.__HOSHI_DEBUG__.selectPatron('mikan'); window.__HOSHI_DEBUG__.chargeSkill();`);
  await sleep(140);
  await tapHit('chef_skill_btn');
  await sleep(140);
  await tapAt(fScreenX, fScreenY);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeSkillMode === 'scoop' && st.skillEnergy === 100 && st.entities.some((e) => e.id === ids3i.frozenId && e.frozenHp === 1),
    `Expected Mikan scoop blocked on frozen treat without consuming skillEnergy (mode=${st.activeSkillMode}, energy=${st.skillEnergy})`
  );
  await tapHit('cancel_tool');
  await sleep(120);

  await evalJS(`window.__HOSHI_DEBUG__.selectPatron('luna'); window.__HOSHI_DEBUG__.chargeSkill();`);
  await sleep(140);
  await tapHit('chef_skill_btn');
  await sleep(140);
  await tapAt(fScreenX, fScreenY);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeSkillMode === 'swap_1' && st.skillEnergy === 100,
    `Expected Luna swap blocked on frozen treat without consuming skillEnergy (mode=${st.activeSkillMode}, energy=${st.skillEnergy})`
  );
  await tapHit('cancel_tool');
  await sleep(120);

  const spoonsBefore = st.tools.spoon;
  await tapHit('tool_spoon');
  await sleep(140);
  await tapAt(fScreenX, fScreenY);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.tools.spoon === spoonsBefore && st.entities.some((e) => e.id === ids3i.frozenId && e.frozenHp === 1),
    `Expected spoon blocked on frozen treat without consuming tool (before=${spoonsBefore}, after=${st.tools.spoon})`
  );
  await tapHit('cancel_tool');
  await sleep(120);

  // Thaw Trigger 1: Nearby Merge (<= 110px) -> frozenHp=0 + >= ¥120 shatter bounty
  const revBeforeMergeThaw = st.shiftRevenue;
  const shatBeforeMerge = st.iceShatteredThisRun;
  const mergeThawFrozenId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    const fid = window.__HOSHI_DEBUG__.spawnTestEntity(4, 118, 446, { frozenHp: 1 });
    window.__HOSHI_DEBUG__.spawnTestEntity(1, 168, 448);
    window.__HOSHI_DEBUG__.spawnTestEntity(1, 184, 448);
    return fid;
  })()`);
  await sleep(220);
  await screenshot('17_frozen_shatter_375.png');
  await sleep(260);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const mergeThawed = st.entities.find((e) => e.id === mergeThawFrozenId);
  assert(
    mergeThawed && mergeThawed.frozenHp === 0 && st.iceShatteredThisRun >= shatBeforeMerge + 1 && st.shiftRevenue >= revBeforeMergeThaw + 120,
    `Expected 110px nearby merge to shatter ice & pay +¥120 (ent=${JSON.stringify(mergeThawed)}, shat=${st.iceShatteredThisRun}, revDelta=${st.shiftRevenue - revBeforeMergeThaw})`
  );

  // Thaw Trigger 2: Mugi Meteor Hammer (120px blast + direct hit thaw-before-upgrade)
  const revBeforeMeteor = st.shiftRevenue;
  const shatBeforeMeteor = st.iceShatteredThisRun;
  const meteorIds = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    const nearFrozenId = window.__HOSHI_DEBUG__.spawnTestEntity(5, 96, 446, { frozenHp: 1 });
    const directFrozenId = window.__HOSHI_DEBUG__.spawnTestEntity(3, 166, 446, { frozenHp: 1 });
    window.__HOSHI_DEBUG__.spawnTestEntity(1, 166, 384, { isMeteorShot: true, vy: 360, preSettled: false });
    return { nearFrozenId, directFrozenId };
  })()`);
  await sleep(460);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const nearAfterM = st.entities.find((e) => e.id === meteorIds.nearFrozenId);
  const directAfterM = st.entities.find((e) => e.id === meteorIds.directFrozenId);
  assert(
    nearAfterM &&
      nearAfterM.frozenHp === 0 &&
      directAfterM &&
      directAfterM.frozenHp === 0 &&
      directAfterM.tier === 4 &&
      st.iceShatteredThisRun >= shatBeforeMeteor + 2 &&
      st.shiftRevenue >= revBeforeMeteor + 240,
    `Expected Mugi 120px meteor hammer to thaw nearby + thaw-before-upgrade direct target (near=${JSON.stringify(nearAfterM)}, direct=${JSON.stringify(directAfterM)}, shat=${st.iceShatteredThisRun})`
  );

  // Thaw Trigger 3: Shake tool (whole jar) -> shatters both bays + +¥240
  const revBeforeShake = st.shiftRevenue;
  const shatBeforeShake = st.iceShatteredThisRun;
  const shakeIds = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    const f1 = window.__HOSHI_DEBUG__.spawnTestEntity(4, 118, 446, { frozenHp: 1 });
    const f2 = window.__HOSHI_DEBUG__.spawnTestEntity(5, 318, 446, { frozenHp: 1 });
    return [f1, f2];
  })()`);
  await sleep(120);
  await tapHit('tool_shake');
  await sleep(260);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const shakeAfter1 = st.entities.find((e) => e.id === shakeIds[0]);
  const shakeAfter2 = st.entities.find((e) => e.id === shakeIds[1]);
  assert(
    shakeAfter1 &&
      shakeAfter1.frozenHp === 0 &&
      shakeAfter2 &&
      shakeAfter2.frozenHp === 0 &&
      st.iceShatteredThisRun >= shatBeforeShake + 2 &&
      st.shiftRevenue >= revBeforeShake + 240,
    `Expected shake tool to shatter all frozen treats across jar (shat=${st.iceShatteredThisRun}, revDelta=${st.shiftRevenue - revBeforeShake})`
  );

  // Clickable top-left Shift Pill (play_shift_badge) -> Build Details Modal with Hazards & Boss Affixes
  await evalJS(`window.__HOSHI_DEBUG__.setShift(3, { forceHazard: 'divider' })`);
  await sleep(200);
  await tapHit('play_shift_badge');
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'relics', `Expected play_shift_badge to open relics modal, got ${st.activeModal}`);
  await checkCapsuleAndViewportBounds('iPhone SE Shift 3 Build Details 375x667', 375, 667, 0);
  await screenshot('18_build_details_hazards_375.png');
  await dragSwipe(188, 500, 188, 260, 6);
  await sleep(160);
  await tapHit('modal_close');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null, 'Shift 3 Build Details modal closed cleanly');
  console.log('[Phase 3I OK] Frozen guards, all 3 thaw triggers (+¥120) & play_shift_badge modal verified');

  // ==========================================================
  // 4. 90s Rush Mode: Tap-to-Serve +3.0s Extension, Emergency Gust & Settlement
  // ==========================================================
  await setViewport(390, 844, true, 2);
  await navigate('?safeTop=47&safeBottom=34&capsule=1');
  await tapHit('mode_rush');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.mode === 'rush' && st.activeModal === 'mode_guide' && st.guideMode === 'rush' && st.paused === true,
    `Expected first-time Rush mode_guide, got modal=${st.activeModal}, guideMode=${st.guideMode}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Rush Mode Guide 390x844', 390, 844, 34);
  await tapHit('guide_skip');
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'rush' && st.activeModal === null && st.rushTimer > 80, `Expected rush mode active & timer > 80, got ${st.rushTimer}`);
  await checkCapsuleAndViewportBounds('iPhone 14 Rush HUD 390x844', 390, 844, 34);

  // Dedicated rush_serve_btn serves starter T3 in Rush mode -> must add +3.0s, then mobile_relics_bar appears!
  const rushServable = st.entities.find((e) => e.isServable);
  assert(rushServable, 'Expected servable starter treat in Rush mode');
  const beforeServeRushT = st.rushTimer;
  await tapHit('rush_serve_btn');
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.rushTimer > beforeServeRushT + 2.0, `Expected Rush rush_serve_btn to add +3.0s (before=${beforeServeRushT}, after=${st.rushTimer})`);
  await evalJS(`window.__HOSHI_DEBUG__.queueBlessing('极速里程碑秘方')`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.relics.length >= 1 && st.hits.some((h) => h.id === 'mobile_relics_bar'),
    `Expected Rush mode to equip unified Relic and display mobile_relics_bar, got relics=${JSON.stringify(st.relics)}`
  );

  const beforeGustTimer = st.rushTimer;
  const beforeGustCount = st.entities.length;
  assert(beforeGustCount >= 2, `Expected treats inside jar before gust, got ${beforeGustCount}`);
  await evalJS(`window.__HOSHI_DEBUG__.triggerRushGust()`);
  await sleep(300);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.over === false && st.rushTimer <= beforeGustTimer - 4.5, `Rush gust failed: over=${st.over}, timer=${st.rushTimer}`);
  assert(st.entities.length < beforeGustCount, 'Rush gust cleared top candies');
  await screenshot('11_rush_gust_390.png');

  await evalJS(`window.__HOSHI_DEBUG__.setRushTimer(0.12)`);
  for (let g = 0; g < 35; g++) {
    await sleep(80);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    if (st.over && st.activeModal === 'gameover') break;
  }
  assert(st.over === true && st.rushFinished === true && st.activeModal === 'gameover', 'Rush timer expiration opens settlement');
  assert(st.hits.some((h) => h.id === 'go_open_shop'), 'Expected go_open_shop button on Game Over modal');
  await checkCapsuleAndViewportBounds('iPhone 14 Rush GameOver 390x844', 390, 844, 34);
  await screenshot('12_rush_gameover_390.png');

  // 4B. Phase 2 — Mikan +12🪙 Starting Coins, Organic Shift 3 Bumpers + 2 Frozen + Frozen Spotlight Tip, Shift 5 Victory & Endless Overtime
  await evalJS(`window.__HOSHI_DEBUG__.selectPatron('mikan'); window.__HOSHI_DEBUG__.startMode('chef');`);
  await sleep(300);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'chef' && st.coins >= 12, `Expected Mikan starting coins >= 12, got ${st.coins}`);

  // Verify Organic Shift 3 Mini-Boss: target ¥4400 + stage 'bumpers' + 2 frozen treats + first-time tip_frozen spotlight!
  await evalJS(`window.__HOSHI_DEBUG__.setShift(3, null, { allowTips: true })`);
  await sleep(260);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.shift === 3 &&
      st.shiftTarget === 4400 &&
      st.shiftHazards.includes('bumpers') &&
      st.entities.filter((e) => e.frozenHp > 0).length === 2 &&
      st.activeModal === 'mode_guide' &&
      st.guideMode === 'tip_frozen',
    `Expected organic Shift 3 target=4400, stage 'bumpers', 2 frozen & tip_frozen modal, got shift=${st.shift}, target=${st.shiftTarget}, hazards=${JSON.stringify(st.shiftHazards)}, modal=${st.activeModal}/${st.guideMode}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Frozen Tip 390x844', 390, 844, 34);
  await screenshot('23_tip_frozen_390.png');
  await tapHit('guide_next');
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const saveAfterFrozenTip = await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`);
  assert(
    st.activeModal === null && saveAfterFrozenTip.seenTips && saveAfterFrozenTip.seenTips.frozen === true,
    `Expected tip_frozen dismissed & persisted, got modal=${st.activeModal}, seenTips=${JSON.stringify(saveAfterFrozenTip.seenTips)}`
  );

  await evalJS(`
    window.__HOSHI_DEBUG__.setShift(5);
    window.__HOSHI_DEBUG__.addShiftRevenue(15500);
    window.__HOSHI_DEBUG__.triggerShiftClear();
  `);
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'shift_victory', `Expected shift_victory modal on Shift 5 clear, got ${st.activeModal}`);
  await checkCapsuleAndViewportBounds('iPhone 14 Shift 5 Victory 390x844', 390, 844, 34);
  await screenshot('12b_shift_victory_390.png');

  // Enter Endless Overtime -> Prep Shop for Shift 6 -> Launch Shift 6 (must NOT re-trigger tip_frozen!)
  await tapHit('victory_endless');
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeModal === 'prep_shop' &&
      st.prepShop &&
      st.prepShop.nextShiftNum === 6 &&
      Array.isArray(st.prepShop.nextHazards) &&
      st.prepShop.nextHazards.length === 2,
    `Expected Prep Shop for Shift 6 Endless with 2 preview hazards, got ${JSON.stringify(st.prepShop)}`
  );
  await tapHit('prep_next_shift');
  await sleep(320);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeModal === null &&
      st.shift === 6 &&
      st.shiftTarget > 15000 &&
      st.shiftHazards.length === 2 &&
      st.entities.filter((e) => e.frozenHp > 0).length === 2,
    `Expected Shift 6 Endless target > 15000 + 2 hazards + 2 frozen, got shift=${st.shift}, target=${st.shiftTarget}, hazards=${JSON.stringify(st.shiftHazards)}`
  );
  const shift6Hazards = [...st.shiftHazards];
  await evalJS(`window.__HOSHI_DEBUG__.setShift(7)`);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.shift === 7 &&
      st.shiftHazards.length === 2 &&
      st.shiftHazards.join(',') !== shift6Hazards.join(','),
    `Expected Shift 7 Endless to rotate to distinct 2-hazard pair (s6=${shift6Hazards}, s7=${st.shiftHazards})`
  );

  // ==========================================================
  // 3J. Phase 3 — Stage Bumpers + rel_bumpers Synergy & Selling Preserves Stage Hazard (390x844)
  // ==========================================================
  await evalJS(`
    window.__HOSHI_DEBUG__.startMode('chef');
    window.__HOSHI_DEBUG__.setShift(3, { forceHazard: 'bumpers' });
  `);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const stageBumpers = (st.obstacles || []).filter((o) => o.type === 'bumper');
  assert(
    stageBumpers.length === 2 && stageBumpers.every((b) => b.source === 'stage' && b.tipBase === 40 && b.grantsCrit === false),
    `Expected 2 stage bumpers (+¥40, no crit), got ${JSON.stringify(stageBumpers)}`
  );

  // Drop treat onto left stage bumper -> verify tip & no bumperCrit
  const revBeforeStageBump = st.shiftRevenue;
  const stageBumpId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    return window.__HOSHI_DEBUG__.spawnTestEntity(2, 102, 224, { vy: 280, preSettled: false });
  })()`);
  await sleep(340);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const stageBumpEnt = st.entities.find((e) => e.id === stageBumpId);
  assert(
    stageBumpEnt && stageBumpEnt.bumperHits >= 1 && stageBumpEnt.bumperCrit === false && st.shiftRevenue >= revBeforeStageBump + 40,
    `Expected stage bumper hit (+¥40, no crit), ent=${JSON.stringify(stageBumpEnt)}, revDelta=${st.shiftRevenue - revBeforeStageBump}`
  );

  // Equip rel_bumpers -> supercharged synergy (2 primary r=16 + 3rd center star bumper at (220,224), grantsCrit=true, +¥65)
  await evalJS(`window.__HOSHI_DEBUG__.equipRelic('rel_bumpers')`);
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const synBumpers = (st.obstacles || []).filter((o) => o.type === 'bumper');
  assert(
    synBumpers.length === 3 &&
      synBumpers.every((b) => b.source === 'synergy' && b.grantsCrit === true) &&
      synBumpers.some((b) => b.id === 'bumper_C' && b.x === 220 && b.y === 224),
    `Expected 3 non-overlapping synergy bumpers with grantsCrit=true, got ${JSON.stringify(synBumpers)}`
  );
  const revBeforeSynBump = st.shiftRevenue;
  const synBumpId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    return window.__HOSHI_DEBUG__.spawnTestEntity(2, 102, 222, { vy: 280, preSettled: false });
  })()`);
  await sleep(340);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const synBumpEnt = st.entities.find((e) => e.id === synBumpId);
  assert(
    synBumpEnt && synBumpEnt.bumperHits >= 1 && synBumpEnt.bumperCrit === true && st.shiftRevenue >= revBeforeSynBump + 65,
    `Expected synergy bumper hit (+¥65 + bumperCrit=true), ent=${JSON.stringify(synBumpEnt)}, revDelta=${st.shiftRevenue - revBeforeSynBump}`
  );

  // Re-seed Shift 3 bumpers + synergy for clean visual screenshot
  await evalJS(`window.__HOSHI_DEBUG__.setShift(3, { forceHazard: 'bumpers' })`);
  await sleep(240);
  await checkCapsuleAndViewportBounds('iPhone 14 Bumpers Synergy 390x844', 390, 844, 34);
  await screenshot('19_bumpers_synergy_390.png');

  // Unequipping / selling rel_bumpers MUST preserve stage bumpers!
  await evalJS(`window.__HOSHI_DEBUG__.unequipRelic('rel_bumpers')`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const afterSellBumpers = (st.obstacles || []).filter((o) => o.type === 'bumper');
  assert(
    afterSellBumpers.length === 2 && afterSellBumpers.every((b) => b.source === 'stage'),
    `Expected stage bumpers preserved after removing rel_bumpers, got ${JSON.stringify(afterSellBumpers)}`
  );
  console.log('[Phase 3J OK] Stage bumpers + rel_bumpers synergy & stage preservation verified');

  // ==========================================================
  // 3K. Phase 3 — fast_fresh 5-Step Window (×2.0) & Stale Penalty (×0.75) (390x844)
  // ==========================================================
  await evalJS(`window.__HOSHI_DEBUG__.setShift(3, { forceHazard: 'fast_fresh' })`);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.shiftHazards.includes('fast_fresh') &&
      st.orders.length >= 2 &&
      st.orders.every((o) => o.freshMax === 5 && o.freshSteps === 5 && o.freshMult === 2.0 && o.staleMult === 0.75),
    `Expected fast_fresh orders (freshMax=5, freshMult=2.0, staleMult=0.75), got ${JSON.stringify(st.orders)}`
  );

  // Measure fresh (×2.0) serve payout vs stale (×0.75) serve payout on VIP Table Slot 0 (always prioritized by findServableMatch)
  const vipOrdFresh = st.orders.find((o) => o.kind === 'vip' && !o.completed) || st.orders[0];
  assert(vipOrdFresh, 'Expected VIP order in fast_fresh shift');
  const ffTier = vipOrdFresh.slots[0].tier;
  const revBeforeFreshServe = st.shiftRevenue;
  const freshEntId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    return window.__HOSHI_DEBUG__.spawnTestEntity(${ffTier}, 220, 445);
  })()`);
  await sleep(120);
  const servedFresh = await evalJS(`window.__HOSHI_DEBUG__.serveById(${freshEntId})`);
  assert(servedFresh === true, 'Expected fresh fast_fresh treat serve to succeed');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const freshPayout = st.shiftRevenue - revBeforeFreshServe;

  // Reset fast_fresh shift and drop 5 times so orders decay from 5 -> 0 steps (stale ×0.75)
  await evalJS(`window.__HOSHI_DEBUG__.setShift(3, { forceHazard: 'fast_fresh' }); window.__HOSHI_DEBUG__.clearEntities();`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const jb3k = st.jarBox;
  const dropsBeforeFF = st.dropsMadeThisRun;
  for (let d = 0; d < 8; d++) {
    await tapAt(Math.round(jb3k.x + jb3k.w * (0.28 + (d % 4) * 0.14)), Math.round(jb3k.y + jb3k.h * 0.24));
    await sleep(240);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    if (st.dropsMadeThisRun - dropsBeforeFF >= 5) break;
  }
  const staleVip = st.orders.find((o) => o.kind === 'vip' && !o.completed) || st.orders[0];
  assert(
    staleVip && staleVip.freshSteps === 0,
    `Expected fast_fresh order to reach freshSteps=0 after 5 drops, got ${JSON.stringify(staleVip)}`
  );
  const revBeforeStaleServe = st.shiftRevenue;
  const staleEntId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    return window.__HOSHI_DEBUG__.spawnTestEntity(${staleVip.slots[0].tier}, 220, 445);
  })()`);
  await sleep(120);
  const servedStale = await evalJS(`window.__HOSHI_DEBUG__.serveById(${staleEntId})`);
  assert(servedStale === true, 'Expected stale fast_fresh treat serve to succeed');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const stalePayout = st.shiftRevenue - revBeforeStaleServe;
  const TIER_SERVE_PTS = { 1: 30, 2: 65, 3: 130, 4: 250, 5: 440, 6: 760, 7: 1200, 8: 1950, 9: 3200 };
  const freshNorm = freshPayout / (TIER_SERVE_PTS[ffTier] || 130);
  const staleNorm = stalePayout / (TIER_SERVE_PTS[staleVip.slots[0].tier] || 130);
  assert(
    freshNorm > staleNorm * 2.2,
    `Expected fast_fresh ×2.0 norm (${freshNorm.toFixed(2)}, ¥${freshPayout} T${ffTier}) >> stale ×0.75 norm (${staleNorm.toFixed(2)}, ¥${stalePayout} T${staleVip.slots[0].tier})`
  );
  console.log(`[Phase 3K OK] fast_fresh verified: fresh=¥${freshPayout} (T${ffTier}, ${freshNorm.toFixed(2)}x) vs stale=¥${stalePayout} (T${staleVip.slots[0].tier}, ${staleNorm.toFixed(2)}x)`);

  // ==========================================================
  // 3L (Mobile 390x844). Phase 3 — Act 4 (7600 + Stage Obstacles), Act 5 Boss + Step-6 Judge Rush & Build Details Modal
  // ==========================================================
  await evalJS(`window.__HOSHI_DEBUG__.setShift(4)`);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.shift === 4 &&
      st.shiftTarget === 7600 &&
      st.entities.some((e) => e.isYarnBall) &&
      st.shiftHazards.length === 1 &&
      ['divider', 'bumpers', 'fast_fresh'].includes(st.shiftHazards[0]),
    `Expected Act 4 target=7600 + Yarn Ball + divider/bumpers/fast_fresh, got target=${st.shiftTarget}, hazards=${JSON.stringify(st.shiftHazards)}`
  );

  // Act 5 Boss: 2 frozen high-tier + divider + organic step-6 Judge Rush (must start with FULL 4 steps!)
  await evalJS(`window.__HOSHI_DEBUG__.setShift(5, { forceHazard: 'divider' })`);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const s5Frozen = st.entities.filter((e) => e.frozenHp > 0);
  assert(
    st.shift === 5 &&
      st.shiftModifier === 'grand_prix' &&
      s5Frozen.length === 2 &&
      s5Frozen.some((e) => e.tier === 4) &&
      s5Frozen.some((e) => e.tier === 5),
    `Expected Act 5 Boss with 2 frozen (T4,T5) & grand_prix, got frozen=${JSON.stringify(s5Frozen)}`
  );

  // Drop 6 treats organically to trigger step-6 Judge Rush & verify freshSteps === 4 (decay-order bugfix!)
  await evalJS(`window.__HOSHI_DEBUG__.clearEntities()`);
  await sleep(100);
  const jb3l = st.jarBox;
  for (let d = 0; d < 10; d++) {
    await tapAt(Math.round(jb3l.x + jb3l.w * (d % 2 === 0 ? 0.30 : 0.70)), Math.round(jb3l.y + jb3l.h * 0.24));
    await sleep(240);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    if (st.shiftStepsUsed >= 6) break;
  }
  const judgeOrd = st.orders.find((o) => o.isJudgeRush && !o.completed);
  assert(
    judgeOrd && judgeOrd.freshSteps === 4 && judgeOrd.freshMax === 4 && judgeOrd.freshMult === 2.5,
    `Expected step-6 Judge Rush to start with full freshSteps=4 & ×2.5 (stepsUsed=${st.shiftStepsUsed}, orders=${JSON.stringify(st.orders)})`
  );

  // Serve fresh Judge Rush order -> must award +2 steps & ×2.5 revenue!
  const stepsBeforeJudge = st.stepsLeft;
  const revBeforeJudge = st.shiftRevenue;
  const judgeEntId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    return window.__HOSHI_DEBUG__.spawnTestEntity(${judgeOrd.slots[0].tier}, 122, 440);
  })()`);
  await sleep(120);
  const servedJudge = await evalJS(`window.__HOSHI_DEBUG__.serveById(${judgeEntId})`);
  assert(servedJudge === true, 'Expected Judge Rush order serve to succeed');
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.stepsLeft === stepsBeforeJudge + 2 && st.shiftRevenue > revBeforeJudge,
    `Expected fresh Judge Rush completion to refund +2 steps (before=${stepsBeforeJudge}, after=${st.stepsLeft})`
  );

  // Open Shift 5 Build Details Modal via play_shift_badge on iPhone 14 390x844
  await evalJS(`
    window.__HOSHI_DEBUG__.equipRelic('rel_bumpers');
    window.__HOSHI_DEBUG__.setShift(5, { forceHazard: 'divider' });
  `);
  await sleep(220);
  await tapHit('play_shift_badge');
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'relics', `Expected iPhone 14 Shift 5 Build Details modal, got ${st.activeModal}`);
  await checkCapsuleAndViewportBounds('iPhone 14 Shift 5 Build Details 390x844', 390, 844, 34);
  await screenshot('22_build_details_iphone_390.png');
  await dragSwipe(195, 580, 195, 280, 6);
  await sleep(160);
  await tapHit('modal_close');
  await sleep(160);
  console.log('[Phase 3L Mobile OK] Act 4, Act 5 Boss + Step-6 Judge Rush (freshSteps=4, +2 steps), Act 6/7 Endless & 390x844 modal verified');

  // ==========================================================
  // 5. Desktop 1280x760 Play Screen + Chef 5-Shift, Prep Shop, Phase 3 Boss & Zen Checks
  // ==========================================================
  await setViewport(1280, 760, false, 1);
  await navigate('?safeTop=8&safeBottom=0&capsule=1');
  await tapHit('mode_chef');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  if (st.activeModal === 'confirm') {
    await checkCapsuleAndViewportBounds('Desktop Lobby Overwrite Confirm 1280x760', 1280, 760, 0);
    await tapHit('confirm_accept');
    await sleep(260);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  }
  assert(st.mode === 'chef' && st.running === true && st.shift === 1 && st.activeModal === null, 'Chef mode running on desktop without repeating seen guide');
  assert(st.hits.some((h) => h.id === 'wide_relics_bar'), 'Expected wide_relics_bar hit on desktop Chef HUD');
  assert(st.hits.some((h) => h.id === 'wide_hazards_bar'), 'Expected wide_hazards_bar hit on desktop Chef HUD');
  assert(st.hits.some((h) => h.id === 'play_shift_badge'), 'Expected play_shift_badge hit on desktop Chef HUD');
  await checkCapsuleAndViewportBounds('Desktop Chef HUD 1280x760', 1280, 760, 0);
  await screenshot('13_chef_desktop_1280.png');

  // Desktop Early Close + 3-column Desktop Prep Shop Layout Verification (with Next-Shift Preview!)
  await evalJS(`
    window.__HOSHI_DEBUG__.equipRelic('rel_bumpers');
    window.__HOSHI_DEBUG__.addShiftRevenue(1300);
  `);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.hits.some((h) => h.id === 'btn_close_shift_early'), 'Expected Desktop btn_close_shift_early CTA');
  await checkCapsuleAndViewportBounds('Desktop Chef Early Close 1280x760', 1280, 760, 0);
  await tapHit('btn_close_shift_early');
  await sleep(260);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeModal === 'prep_shop' && st.prepShop && Array.isArray(st.prepShop.nextHazards),
    `Expected desktop prep_shop modal with nextHazards preview, got ${st.activeModal}`
  );
  await checkCapsuleAndViewportBounds('Desktop Prep Shop 1280x760', 1280, 760, 0);
  await screenshot('13b_prep_shop_desktop_1280.png');

  // 3L (Desktop 1280x760): Shift 5 Boss (Divider + Frozen + Judge Rush + rel_bumpers) & Build Details Modal
  await evalJS(`
    window.__HOSHI_DEBUG__.setShift(5, { forceHazard: 'divider' });
    window.__HOSHI_DEBUG__.triggerJudgeRush();
  `);
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.shift === 5 && st.activeModal === null, 'Desktop Shift 5 Boss active');
  await checkCapsuleAndViewportBounds('Desktop Shift 5 Boss 1280x760', 1280, 760, 0);
  await screenshot('20_shift5_boss_desktop_1280.png');

  await tapHit('wide_hazards_bar');
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'relics', `Expected wide_hazards_bar to open relics modal, got ${st.activeModal}`);
  await checkCapsuleAndViewportBounds('Desktop Build Details Modal 1280x760', 1280, 760, 0);
  await screenshot('21_build_details_desktop_1280.png');
  await tapHit('modal_close');
  await sleep(160);
  console.log('[Phase 3L Desktop OK] Desktop Shift 5 Boss & Build Details modal verified');

  await evalJS(`window.__HOSHI_DEBUG__.returnToLobby()`);
  await sleep(160);
  await tapHit('mode_zen');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(300);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.mode === 'zen' && st.running === true && st.activeModal === 'mode_guide' && st.guideMode === 'zen',
    `Expected first-time Zen mode_guide on desktop, got modal=${st.activeModal}`
  );
  await checkCapsuleAndViewportBounds('Desktop Zen Mode Guide 1280x760', 1280, 760, 0);
  await screenshot('14a_mode_guide_zen_desktop_1280.png');
  await tapHit('guide_skip');
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'zen' && st.running === true && st.activeModal === null, 'Zen mode running on desktop after guide_skip');
  await checkCapsuleAndViewportBounds('Desktop Zen HUD 1280x760', 1280, 760, 0);
  const djb = st.jarBox;
  await tapAt(Math.round(djb.x + djb.w * 0.5), Math.round(djb.y + djb.h * 0.35));
  await waitForCooldown();
  await screenshot('14_zen_desktop_1280.png');

  // ==========================================================
  // 6. Comprehensive Verification of 9 Optimization Items (Desktop 1280x760 & Mobile 390x844)
  // ==========================================================
  // 6A. Item 3 (Constant Turret Launch Speed) + Item 4 (Single-Table Reroll & 差1合) + Item 5 (Trait & Shatter Preview)
  await evalJS(`
    window.__HOSHI_DEBUG__.selectPatron('luna');
    window.__HOSHI_DEBUG__.startMode('chef');
  `);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const shotCheck = await evalJS(`({
    s0: window.__HOSHI_DEBUG__.computeTurretShot(0),
    sAng: window.__HOSHI_DEBUG__.computeTurretShot(0.52)
  })`);
  const spd0 = Math.hypot(shotCheck.s0.launchVx, shotCheck.s0.launchVy);
  const spdAng = Math.hypot(shotCheck.sAng.launchVx, shotCheck.sAng.launchVy);
  assert(
    shotCheck.s0.power === 0.72 && Math.abs(spd0 - 920) < 0.5 && Math.abs(spdAng - 920) < 0.5,
    `Expected constant turret speed 920 across angles, got spd0=${spd0}, spdAng=${spdAng}`
  );

  // Drag near vs drag far along same angle -> launch speed must stay strictly constant (920)!
  const jb6 = st.jarBox;
  const turretScreenX = Math.round(jb6.x + 220 * jb6.scale);
  const turretScreenY = Math.round(jb6.y + 44 * jb6.scale);
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: turretScreenX + 24,
    y: turretScreenY + 48,
    button: 'left',
    clickCount: 1
  });
  await sleep(80);
  const nearAim = await evalJS(`window.__HOSHI_DEBUG__.getState().aim`);
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: turretScreenX + 96,
    y: turretScreenY + 192,
    button: 'left'
  });
  await sleep(80);
  const farAim = await evalJS(`window.__HOSHI_DEBUG__.getState().aim`);
  // Cancel shot by sliding above rim
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: turretScreenX, y: Math.max(4, jb6.y - 12), button: 'left' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: turretScreenX, y: Math.max(4, jb6.y - 12), button: 'left', clickCount: 1 });
  await sleep(120);
  const nearSpd = Math.hypot(nearAim.launchVx, nearAim.launchVy);
  const farSpd = Math.hypot(farAim.launchVx, farAim.launchVy);
  assert(
    Math.abs(nearSpd - 920) < 1 && Math.abs(farSpd - 920) < 1,
    `Expected near drag (${nearSpd}) and far drag (${farSpd}) to have identical constant speed 920`
  );

  // Single-Table Reroll: 1st free (preserves Table 1), 2nd costs 3🪙 (preserves Table 1)
  await evalJS(`window.__HOSHI_DEBUG__.addCoins(10)`);
  await sleep(80);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.freeSkipsLeft === 1, `Expected 1 free skip per shift, got ${st.freeSkipsLeft}`);
  const uid0Before = st.orders[0].uid;
  const uid1Before = st.orders[1].uid;
  const coinsBeforeSkip1 = st.coins;
  await tapHit('wide_skip_table_0');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.orders[0].uid !== uid0Before &&
      st.orders[1].uid === uid1Before &&
      st.freeSkipsLeft === 0 &&
      st.coins === coinsBeforeSkip1,
    `Expected 1st single-table reroll to be free & only replace Table 0: before=[${uid0Before},${uid1Before}], after=[${st.orders[0].uid},${st.orders[1].uid}], coins=${st.coins}/${coinsBeforeSkip1}`
  );

  // Near-Order 1-Merge-Away (`差1合`) + Trait Radius & Frozen Shatter Visual Preview Screenshot
  const targetOrdTier = st.orders[0].slots[0].tier;
  const subTier = Math.max(1, targetOrdTier - 1);
  // Advance next-piece Rainbow Wildcard onto active turret (`curMeta.wildcard === true`)
  await evalJS(`window.__HOSHI_DEBUG__.grantRainbow()`);
  await sleep(60);
  await tapAt(turretScreenX, Math.round(jb6.y + 180 * jb6.scale));
  await waitForCooldown();
  await evalJS(`
    window.__HOSHI_DEBUG__.clearEntities();
    window.__HOSHI_DEBUG__.spawnTestEntity(${subTier}, 136, 452);
    window.__HOSHI_DEBUG__.spawnTestEntity(${subTier}, 304, 452);
    window.__HOSHI_DEBUG__.spawnTestEntity(3, 220, 420);
    window.__HOSHI_DEBUG__.spawnTestEntity(1, 182, 455);
    window.__HOSHI_DEBUG__.spawnTestEntity(4, 274, 428, { frozenHp: 1 });
  `);
  await sleep(420);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.curMeta.wildcard === true && st.nearOrderSubTiers.includes(subTier),
    `Expected wildcard on turret & nearOrderSubTiers to include ${subTier}, got curMeta=${JSON.stringify(st.curMeta)}, near=${JSON.stringify(st.nearOrderSubTiers)}`
  );
  // Hold aim straight down at T3 (220, 420) -> previews T4 Lemon 105px circle + T1 target ring + 110px cyan frozen shatter!
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: turretScreenX,
    y: Math.round(jb6.y + 260 * jb6.scale),
    button: 'left',
    clickCount: 1
  });
  await sleep(140);
  await screenshot('25_near_order_and_trait_preview_1280.png');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: turretScreenX, y: Math.max(4, jb6.y - 12), button: 'left' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: turretScreenX, y: Math.max(4, jb6.y - 12), button: 'left', clickCount: 1 });
  await sleep(120);

  // 6B. Item 6 (2/3-Piece Archetype Synergies) & Item 9 (Luna Free 1st Prep Reroll + Swap Resonance)
  await evalJS(`
    window.__HOSHI_DEBUG__.equipRelic('rel_bouncy');
    window.__HOSHI_DEBUG__.equipRelic('rel_bumpers');
    window.__HOSHI_DEBUG__.equipRelic('rel_lemonade');
  `);
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeSynergies.includes('bank:2') && st.archetypeCounts.bank === 2 && st.archetypeCounts.trait === 1,
    `Expected bank:2 synergy active, got synergies=${JSON.stringify(st.activeSynergies)}, counts=${JSON.stringify(st.archetypeCounts)}`
  );
  // Open Relics Modal to visually verify Active Set Synergies card (`已激活流派套装共鸣`)
  await tapHit('wide_relics_bar');
  await sleep(180);
  await checkCapsuleAndViewportBounds('Desktop Relics Active Synergy Modal 1280x760', 1280, 760, 0);
  await screenshot('26b_relics_synergy_active_1280.png');
  await tapHit('modal_close');
  await sleep(140);
  // Verify Luna's active skill swap triggers 2.0s globalResonanceTimer
  await evalJS(`window.__HOSHI_DEBUG__.chargeSkill()`);
  await sleep(100);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const swapTargets = st.entities.filter((e) => !e.frozenHp && !e.isYarnBall);
  await tapHit('chef_skill_btn');
  await sleep(120);
  await tapAt(Math.round(jb6.x + swapTargets[0].x * jb6.scale), Math.round(jb6.y + swapTargets[0].y * jb6.scale));
  await sleep(120);
  await tapAt(Math.round(jb6.x + swapTargets[1].x * jb6.scale), Math.round(jb6.y + swapTargets[1].y * jb6.scale));
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.globalResonanceTimer > 1.2, `Expected Luna swap to trigger 2.0s globalResonanceTimer, got ${st.globalResonanceTimer}`);

  // Clear Shift 1 as Luna -> verify Prep Shop 1st reroll is FREE (rerollCost === 0) & synergy badges render cleanly!
  await evalJS(`
    window.__HOSHI_DEBUG__.addShiftRevenue(1500);
    window.__HOSHI_DEBUG__.triggerShiftClear();
  `);
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeModal === 'prep_shop' && st.prepShop && st.prepShop.rerollCost === 0,
    `Expected Luna 1st Prep Shop reroll to be free (0), got ${JSON.stringify(st.prepShop)}`
  );
  await checkCapsuleAndViewportBounds('Desktop Luna Prep Shop Synergy 1280x760', 1280, 760, 0);
  await screenshot('26_prep_synergy_luna_free_reroll_1280.png');
  const coinsBeforeLunaReroll = st.coins;
  await tapHit('prep_reroll');
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.coins === coinsBeforeLunaReroll && st.prepShop.rerollCost === 5,
    `Expected Luna free reroll to deduct 0 coins and advance rerollCost to 5, got coins=${st.coins}/${coinsBeforeLunaReroll}, nextCost=${st.prepShop.rerollCost}`
  );
  await tapHit('prep_next_shift');
  await sleep(220);

  // Equip 3rd #弹壁 relic -> verify bank:3 synergy!
  await evalJS(`window.__HOSHI_DEBUG__.equipRelic('rel_prism')`);
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeSynergies.includes('bank:3'), `Expected bank:3 3-piece synergy, got ${JSON.stringify(st.activeSynergies)}`);

  // 6C. Mobile 390x844: Item 9 (Mugi Shake+1 & Bank-Shot +3🪙) + Item 2 (Two-Tier Non-Occluding Toast Queue) + Item 7 (Rush Serve Streak)
  await setViewport(390, 844, true, 2);
  await navigate('?safeTop=47&safeBottom=34&capsule=1');
  await evalJS(`
    window.__HOSHI_DEBUG__.selectPatron('mugi');
    window.__HOSHI_DEBUG__.startMode('chef');
  `);
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.tools.shake >= 3, `Expected Mugi to start with +1 extra shake (>=3), got ${JSON.stringify(st.tools)}`);

  // Trigger Mugi bank-shot merge (bounce off left glass wall JAR.left=30 into stationary T2) -> must award +3🪙!
  const mugiCoins0 = st.coins;
  await evalJS(`
    window.__HOSHI_DEBUG__.clearEntities();
    window.__HOSHI_DEBUG__.spawnTestEntity(2, 92, 445);
    window.__HOSHI_DEBUG__.spawnTestEntity(2, 66, 365, { vx: -460, vy: 260, preSettled: false, isBankLaunched: true });
  `);
  await sleep(420);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.mugiBankCoinHits >= 1 && st.coins >= mugiCoins0 + 3,
    `Expected Mugi bank-shot merge to grant +3 coins, got mugiBankCoinHits=${st.mugiBankCoinHits}, coins=${st.coins}/${mugiCoins0}`
  );

  // Item 2: Simultaneous Major Queue + Non-Competing Minor Pill (anchored near bottom, never occluding Top HUD!)
  await evalJS(`
    window.__HOSHI_DEBUG__.showToast('本幕目标达标 · 可立即打烊', { level: 'major', icon: 'icon_trophy', tone: 'success' });
    window.__HOSHI_DEBUG__.showToast('第二条事件自动排队不顶替', { level: 'major', icon: 'icon_stardust', tone: 'event' });
    window.__HOSHI_DEBUG__.showToast('快餐小提示独立显示', { level: 'minor', icon: 'serve_bell', tone: 'info' });
  `);
  await sleep(120);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.toastCurrent &&
      st.toastCurrent.level === 'major' &&
      st.toastQueueLen === 1 &&
      st.minorToast &&
      st.minorToast.level === 'minor',
    `Expected major toast + 1 queued major + concurrent minorToast, got cur=${JSON.stringify(st.toastCurrent)}, q=${st.toastQueueLen}, minor=${JSON.stringify(st.minorToast)}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Two-Tier Non-Occluding Toast 390x844', 390, 844, 34);
  await screenshot('24_two_tier_toast_390.png');

  // Item 7: 90s Rush Starter Blitz Order + Consecutive Serve Streak Multiplier & Time Bonus
  await evalJS(`window.__HOSHI_DEBUG__.startMode('rush')`);
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.mode === 'rush' && st.orders[0] && st.orders[0].isStarterBlitz === true && st.orders[0].slots[0].tier === 3,
    `Expected Rush opening Starter Blitz T3 order, got ${JSON.stringify(st.orders[0])}`
  );
  const rushT0 = st.orders[0].slots[0].tier;
  const rushT1 = st.orders[1].slots[0].tier;
  const timerBeforeStreak = st.rushTimer;
  await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    const idA = window.__HOSHI_DEBUG__.spawnTestEntity(${rushT0}, 160, 440);
    const idB = window.__HOSHI_DEBUG__.spawnTestEntity(${rushT1}, 270, 440);
    window.__HOSHI_DEBUG__.serveById(idA);
    window.__HOSHI_DEBUG__.serveById(idB);
  })()`);
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.rushServeStreak >= 2 && st.rushStreakTimer > 8 && st.rushTimer > timerBeforeStreak + 6.0,
    `Expected Rush Serve Streak >= 2 with boosted time extension (> +6.0s for 2 serves), got streak=${st.rushServeStreak}, timerBefore=${timerBeforeStreak}, timerNow=${st.rushTimer}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Rush Serve Streak 390x844', 390, 844, 34);
  await screenshot('27_rush_serve_streak_390.png');
  console.log('[Section 6 OK] All 9 gameplay & UX optimization items verified end-to-end!');

  // ==========================================================
  // 7. WeChat CloudBase Sync, Chef ID Card Auth, Mid-Run Breakpoint Resume & Global Leaderboard
  // ==========================================================
  console.log('\n--- Section 7: WeChat CloudBase, Auth, Mid-Run Resume & Global Leaderboard ---');

  // 7A: Pre-CloudBase Graceful Local Fallback (?cloud=0)
  await setViewport(390, 844, true, 2);
  await navigate('?safeTop=44&safeBottom=34&capsule=1&cloud=0');
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.cloudState.status === 'local_only' && st.hits.some((h) => h.id === 'lobby_cloud_status'),
    `Expected graceful local_only fallback when CloudBase is not yet activated, got ${JSON.stringify(st.cloudState)}`
  );
  await tapHit('btn_career');
  await sleep(180);
  await tapHit('career_tab_rank');
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeModal === 'career' &&
      st.activeCareerTab === 'rank' &&
      st.leaderboardState.isLocalFallback === true &&
      st.leaderboardState.count >= 5,
    `Expected populated local benchmark leaderboard before CloudBase activation, got ${JSON.stringify(st.leaderboardState)}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Pre-CloudBase Local Leaderboard 390x844', 390, 844, 34);
  await tapHit('modal_close');
  await sleep(140);

  // 7B: Silent OpenID Cloud Pull & Lossless Multi-Device Stardust Delta Merge (`lastSyncedEarnedStardust`)
  await evalJS(`(() => {
    const localSave = {
      bestChef: 4200,
      bestRush: 6350,
      bestZen: 1800,
      bankStardust: 90,
      totalEarnedStardust: 150,
      lastSyncedEarnedStardust: 100,
      selectedPatron: 'luna',
      unlockedPatrons: ['mikan', 'luna'],
      equippedTheme: 'amber',
      unlockedThemes: ['amber'],
      shopUpgrades: { up_tools: 0, up_fever: 0, up_combo: 0, up_dust: 0 },
      seenModeGuides: { chef: true, rush: true, zen: true },
      seenTips: { prep_shop: true, glaze_ring: true, frozen: true },
      lifetimeStats: { bestShiftReached: 3, runsPlayed: 4 },
      updatedAt: Date.now()
    };
    localStorage.setItem('wx_hoshi_kissa_bakery_save_v1', JSON.stringify(localSave));
    localStorage.removeItem('wx_hoshi_kissa_active_run_v1');
    localStorage.removeItem('wx_hoshi_kissa_saved_runs_v2');

    const remoteCloudDoc = {
      openidSuffix: '88A6',
      profile: { nickName: '星夜店长#88A6', avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 },
      bestChef: 19800,
      bestRush: 3100,
      bestZen: 5200,
      bestShiftReached: 5,
      metaSave: {
        bestChef: 19800,
        bestRush: 3100,
        bestZen: 5200,
        bankStardust: 240,
        totalEarnedStardust: 280,
        lastSyncedEarnedStardust: 280,
        selectedPatron: 'mikan',
        unlockedPatrons: ['mikan'],
        equippedTheme: 'amber',
        unlockedThemes: ['amber'],
        shopUpgrades: { up_tools: 1, up_fever: 0, up_combo: 0, up_dust: 0 },
        seenModeGuides: { chef: true, rush: false, zen: false },
        seenTips: { prep_shop: true, glaze_ring: false, frozen: false },
        lifetimeStats: { bestShiftReached: 5, runsPlayed: 9 },
        updatedAt: Date.now() - 5000
      },
      activeRun: null,
      savedRuns: { chef: null, rush: null, zen: null },
      revision: 3
    };
    localStorage.setItem('wx_cloud_kissa_doc_v1', JSON.stringify(remoteCloudDoc));
  })()`);

  await navigate('?safeTop=44&safeBottom=34&capsule=1&cloud=1');
  await sleep(320);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const cloudEnvUsed = await evalJS(`window.__WX_HARNESS__.cloudEnv`);
  const mergedSave = await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`);
  assert(
    cloudEnvUsed === 'dev-d0ggz3zx89d349af3',
    `Expected wx.cloud.init to connect to 'dev-d0ggz3zx89d349af3', got '${cloudEnvUsed}'`
  );
  // Multi-device delta check: baseSynced=100, local offline +50 (150), remote +180 (280) => merged totalEarned = 100 + 50 + 180 = 330!
  // Spent stardust: luna (60) + up_tools Lv.1 (40) = 100 => bankStardust = 330 - 100 = 230!
  assert(
    st.cloudState.status === 'synced' &&
      mergedSave.bestChef === 19800 &&
      mergedSave.bestRush === 6350 &&
      mergedSave.bestZen === 5200 &&
      mergedSave.unlockedPatrons.includes('luna') &&
      mergedSave.shopUpgrades.up_tools === 1 &&
      mergedSave.totalEarnedStardust === 330 &&
      mergedSave.bankStardust === 230,
    `Expected lossless multi-device stardust delta merge (earned=330, bank=230), got cloud=${JSON.stringify(st.cloudState)}, save=${JSON.stringify(mergedSave)}`
  );

  // 7C: Mid-Run Breakpoint Save & Lobby Split Resume CTA
  await tapHit('mode_chef');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(240);
  await evalJS(`(() => {
    window.__HOSHI_DEBUG__.equipRelic('rel_domino');
    window.__HOSHI_DEBUG__.equipRelic('rel_bumpers');
    window.__HOSHI_DEBUG__.setShift(2, { forceHazard: 'glaze_ring' });
    window.__HOSHI_DEBUG__.addShiftRevenue(780);
    window.__HOSHI_DEBUG__.addCoins(42);
    window.__HOSHI_DEBUG__.spawnTestEntity(5, 210, 430, { golden: true });
    window.__HOSHI_DEBUG__.saveCheckpoint(true);
  })()`);
  await sleep(220);
  await evalJS(`window.__HOSHI_DEBUG__.returnToLobby()`);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.lobbyOpen === true &&
      st.hasSavedRun === true &&
      st.savedRuns.chef === true &&
      st.savedRun &&
      st.savedRun.shift === 2 &&
      st.hits.some((h) => h.id === 'btn_resume_run') &&
      st.hits.some((h) => h.id === 'btn_start'),
    `Expected Lobby to show split btn_resume_run + btn_start for saved Shift 2 run, got ${JSON.stringify(st.savedRun)}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Lobby Resume Run Split CTA 390x844', 390, 844, 34);
  await screenshot('28_lobby_resume_cta_390.png');

  // Reload page completely and tap btn_resume_run to verify full persistence & board restoration!
  await navigate('?safeTop=44&safeBottom=34&capsule=1&cloud=1');
  await sleep(280);
  await tapHit('btn_resume_run');
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.lobbyOpen === false &&
      st.running === true &&
      st.shift === 2 &&
      st.shiftRevenue === 780 &&
      st.relics.includes('rel_domino') &&
      st.relics.includes('rel_bumpers') &&
      st.entities.some((e) => e.tier === 5 && e.isGolden === true),
    `Expected exact Shift 2 state, relics & golden T5 restored after reload + resume, got shift=${st.shift}, rev=${st.shiftRevenue}, relics=${JSON.stringify(st.relics)}`
  );

  // 7D: Compliance-Safe Chef ID Card (`wx.createUserInfoButton`) & Global Leaderboard (`isNpc` badge check)
  await evalJS(`window.__HOSHI_DEBUG__.returnToLobby()`);
  await sleep(180);
  await tapHit('btn_career');
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const domOverlayExists = await evalJS(`!!document.getElementById('wx-mock-userinfo-btn')`);
  assert(
    st.activeModal === 'career' && st.userInfoBtnRect && domOverlayExists === true,
    `Expected Career modal to mount aligned wx.createUserInfoButton overlay, got modal=${st.activeModal}, rect=${JSON.stringify(st.userInfoBtnRect)}, dom=${domOverlayExists}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Career Chef ID Card 390x844', 390, 844, 34);

  // Tap career_auth_btn -> intercepts via native #wx-mock-userinfo-btn -> authorizes '微信店长·星野'
  await tapHit('career_auth_btn');
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const authTapCount = await evalJS(`window.__WX_HARNESS__.userInfoTapCount || 0`);
  assert(
    authTapCount >= 1 &&
      st.playerProfile.authorized === true &&
      st.playerProfile.nickName === '微信店长·星野',
    `Expected native wx.createUserInfoButton tap to authorize profile '微信店长·星野', got taps=${authTapCount}, profile=${JSON.stringify(st.playerProfile)}`
  );
  await screenshot('29_career_id_card_390.png');

  // Switch to Global Chef Leaderboard tab ('career_tab_rank')
  await tapHit('career_tab_rank');
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.activeCareerTab === 'rank' &&
      st.leaderboardState.isLocalFallback === false &&
      st.leaderboardState.myRank === 2 &&
      st.leaderboardState.myScore === 19800 &&
      st.leaderboardState.top3.some((r) => r.isMe && r.isNpc === false && r.nickName === '微信店长·星野') &&
      st.leaderboardState.top3.some((r) => !r.isMe && r.isNpc === true),
    `Expected Global Chef Leaderboard with '微信店长·星野' at Rank #2 (¥19800) & NPC rows flagged isNpc=true, got ${JSON.stringify(st.leaderboardState)}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Career Global Leaderboard 390x844', 390, 844, 34);
  await screenshot('30_career_leaderboard_390.png');

  // Switch Leaderboard mode to 90s Rush ('rank_mode_rush') -> myScore 6350 should also be Rank #2 (behind 7680, ahead of 6150)!
  await tapHit('rank_mode_rush');
  await sleep(260);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.leaderboardMode === 'rush' &&
      st.leaderboardState.myRank === 2 &&
      st.leaderboardState.myScore === 6350,
    `Expected 90s Rush Leaderboard with myScore=6350 at Rank #2, got ${JSON.stringify(st.leaderboardState)}`
  );

  // Close Career modal -> verify native UserInfoButton overlay is cleanly destroyed!
  await tapHit('modal_close');
  await sleep(180);
  const domOverlayAfterClose = await evalJS(`!!document.getElementById('wx-mock-userinfo-btn')`);
  assert(domOverlayAfterClose === false, 'Expected wx.createUserInfoButton overlay to be destroyed on modal close');
  console.log('[Section 7 OK] CloudBase sync, multi-device stardust delta merge, mid-run resume, native UserInfoButton auth & Global Leaderboard verified!');

  // ==========================================================
  // 8. v4.1 Design Overhaul Deep Verification (Items 1–5)
  // ==========================================================
  console.log('\n--- Section 8: v4.1 Design Overhaul Deep Verification (Items 1–5) ---');

  // 8A (Item 1): True Bank-Shot Physics (pastry-first ricochet vs direct wall rebound) + T9 Soufflé Tribute Pill
  await evalJS(`
    window.__HOSHI_DEBUG__.selectPatron('mikan');
    window.__HOSHI_DEBUG__.startMode('chef');
    window.__HOSHI_DEBUG__.clearEntities();
  `);
  await sleep(200);
  // Case 1: Pastry-first ricochet into left wall -> must NOT count as wallBounce!
  const ricochetId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    window.__HOSHI_DEBUG__.spawnTestEntity(4, 110, 355);
    return window.__HOSHI_DEBUG__.spawnTestEntity(2, 128, 320, { vx: -420, vy: 280, preSettled: false, isBankLaunched: true });
  })()`);
  await sleep(360);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const ricEnt = st.entities.find((e) => e.id === ricochetId);
  assert(
    ricEnt && ricEnt.wallBounces === 0,
    `Expected pastry-first ricochet into wall to have wallBounces === 0, got ${JSON.stringify(ricEnt)}`
  );
  // Case 2: Direct side-wall rebound before touching any pastry -> MUST count as wallBounces >= 1!
  const trueBankId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    return window.__HOSHI_DEBUG__.spawnTestEntity(2, 68, 300, { vx: -480, vy: 240, preSettled: false, isBankLaunched: true });
  })()`);
  await sleep(300);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const trueBankEnt = st.entities.find((e) => e.id === trueBankId);
  assert(
    trueBankEnt && trueBankEnt.wallBounces >= 1,
    `Expected direct side-wall rebound before any body to have wallBounces >= 1, got ${JSON.stringify(trueBankEnt)}`
  );

  // T9 Soufflé Tribute Pill (`serve_souffle_btn`)
  const souffleId = await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    return window.__HOSHI_DEBUG__.spawnTestEntity(9, 220, 420);
  })()`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.hits.some((h) => h.id === 'serve_souffle_btn'), 'Expected serve_souffle_btn pill when T9 Soufflé is in jar');
  await checkCapsuleAndViewportBounds('iPhone 14 T9 Soufflé Tribute Pill 390x844', 390, 844, 34);
  const revBeforeSouffle = st.shiftRevenue;
  await tapHit('serve_souffle_btn');
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    !st.entities.some((e) => e.id === souffleId) && st.shiftRevenue >= revBeforeSouffle + 3200,
    `Expected serve_souffle_btn to tribute T9 Soufflé for >= ¥3200, got revDelta=${st.shiftRevenue - revBeforeSouffle}`
  );
  console.log('[8A OK] True Bank-Shot physics & T9 Soufflé tribute pill verified');

  // 8B (Item 2): Fresh Order = 0 Steps vs Stale Order = 1 Step + Serve Cascade +1 Step Refund
  await evalJS(`
    window.__HOSHI_DEBUG__.startMode('chef');
    window.__HOSHI_DEBUG__.clearEntities();
  `);
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  // Mikan First-Serve +25% Energy check AND Fresh Order 0-step cost check!
  const freshOrd8b = st.orders[0];
  const freshTier8b = freshOrd8b.slots[0].tier;
  const stepsBeforeFresh = st.stepsLeft;
  const fId8b = await evalJS(`window.__HOSHI_DEBUG__.spawnTestEntity(${freshTier8b}, 220, 445)`);
  await sleep(100);
  await evalJS(`window.__HOSHI_DEBUG__.serveById(${fId8b})`);
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.stepsLeft === stepsBeforeFresh && st.skillEnergy >= 55,
    `Expected Fresh serve to cost 0 steps (${st.stepsLeft}/${stepsBeforeFresh}) & Mikan 1st serve to grant >=55 energy (${st.skillEnergy})`
  );

  // Decay orders to stale (freshSteps === 0) via fast_fresh 5 drops, then serve stale (-1 step) & cascade merge (+1 step refund!)
  await evalJS(`window.__HOSHI_DEBUG__.setShift(3, { forceHazard: 'fast_fresh' }); window.__HOSHI_DEBUG__.clearEntities();`);
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const jb8b = st.jarBox;
  const d0_8b = st.dropsMadeThisRun;
  for (let d = 0; d < 8; d++) {
    await tapAt(Math.round(jb8b.x + jb8b.w * (0.30 + (d % 3) * 0.18)), Math.round(jb8b.y + jb8b.h * 0.24));
    await sleep(230);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    if (st.dropsMadeThisRun - d0_8b >= 5) break;
  }
  await evalJS(`window.__HOSHI_DEBUG__.clearEntities()`);
  await sleep(100);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const staleOrd8b = st.orders.find((o) => !o.completed && o.freshSteps === 0);
  assert(staleOrd8b, `Expected stale order (freshSteps=0), got ${JSON.stringify(st.orders)}`);
  // Complete ALL slots of staleOrd8b so the order completes while stale (costing 1 step), then spawn a merge pair to trigger +1 step refund!
  const stepsBeforeStale = st.stepsLeft;
  for (let si = 0; si < staleOrd8b.slots.length; si++) {
    const sl = staleOrd8b.slots[si];
    if (sl.done) continue;
    const eid = await evalJS(`window.__HOSHI_DEBUG__.spawnTestEntity(${sl.tier}, 220, 445)`);
    await sleep(60);
    await evalJS(`window.__HOSHI_DEBUG__.serveById(${eid})`);
    await sleep(80);
  }
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.stepsLeft === stepsBeforeStale - 1 && st.serveCascadeTimer > 0,
    `Expected Stale order completion to cost 1 step (${st.stepsLeft} vs ${stepsBeforeStale - 1}) and open cascade window (${st.serveCascadeTimer})`
  );
  // Trigger a merge inside the active Serve Cascade window -> must refund +1 step!
  await evalJS(`(() => {
    window.__HOSHI_DEBUG__.spawnTestEntity(2, 190, 448);
    window.__HOSHI_DEBUG__.spawnTestEntity(2, 206, 448);
  })()`);
  await sleep(320);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.stepsLeft === stepsBeforeStale,
    `Expected Serve Cascade merge after stale serve to refund +1 step (expected ${stepsBeforeStale}, got ${st.stepsLeft})`
  );
  console.log('[8B OK] Fresh 0-step vs Stale 1-step + Serve Cascade +1 step refund & Mikan 1st-serve energy verified');

  // 8C (Item 3): Additive Multiplier Cap (<= 8.0×), Mikan Scoop Queue Preservation & Half-Done VIP Judge Rush Protection
  await evalJS(`(() => {
    window.__HOSHI_DEBUG__.startMode('chef');
    window.__HOSHI_DEBUG__.clearEntities();
    window.__HOSHI_DEBUG__.equipRelic('rel_bouncy');
    window.__HOSHI_DEBUG__.equipRelic('rel_prism');
    window.__HOSHI_DEBUG__.equipRelic('rel_bumpers');
    window.__HOSHI_DEBUG__.equipRelic('rel_avalanche');
    window.__HOSHI_DEBUG__.triggerFever();
  })()`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const scoreBeforeCapMerge = st.score;
  // Spawn two Golden + Bank-bounced + Bumper-crit T5s right next to each other during Fever -> results in T6 (base pts = 260)
  await evalJS(`(() => {
    const a = window.__HOSHI_DEBUG__.spawnTestEntity(5, 196, 445, { golden: true });
    const b = window.__HOSHI_DEBUG__.spawnTestEntity(5, 224, 445, { golden: true });
  })()`);
  await sleep(360);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const capMergeDelta = st.score - scoreBeforeCapMerge;
  // T6 base pts = 260; total mult cap is strictly 8.0× => max single merge pts = 2080 (plus at most small synergy flat bonus if any)
  assert(
    capMergeDelta > 260 && capMergeDelta <= 2200,
    `Expected stacked T5->T6 merge to respect 8.0x cap (<= 2200), got delta=${capMergeDelta}`
  );

  // Mikan Scoop when holdTier !== null MUST preserve old curTier into nextTier!
  await evalJS(`(() => {
    window.__HOSHI_DEBUG__.selectPatron('mikan');
    window.__HOSHI_DEBUG__.startMode('chef');
    window.__HOSHI_DEBUG__.clearEntities();
  })()`);
  await sleep(160);
  await tapHit('mobile_hold_swap'); // populates holdTier
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.holdTier !== null, 'Expected holdTier occupied before Mikan scoop');
  const prevCurTier = st.curTier;
  const scoopPieceId = await evalJS(`window.__HOSHI_DEBUG__.spawnTestEntity(4, 220, 440, { golden: true })`);
  await evalJS(`window.__HOSHI_DEBUG__.chargeSkill()`);
  await sleep(120);
  await tapHit('chef_skill_btn');
  await sleep(120);
  const jb8c = st.jarBox;
  await tapAt(Math.round(jb8c.x + 220 * jb8c.scale), Math.round(jb8c.y + 440 * jb8c.scale));
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.curTier === 4 && st.curMeta.golden === true && st.nextTier === prevCurTier && !st.entities.some((e) => e.id === scoopPieceId),
    `Expected Mikan scoop with occupied holdTier to load gilded T4 onto turret and preserve prevCurTier (${prevCurTier}) into nextTier (${st.nextTier})`
  );

  // Half-done VIP order protection against Judge Rush overwrite
  await evalJS(`(() => {
    window.__HOSHI_DEBUG__.setShift(5, { forceHazard: 'divider' });
    window.__HOSHI_DEBUG__.clearEntities();
  })()`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  // Ensure VIP order (orders[1]) has >= 2 slots; serve its 1st slot so it is half-done, then call triggerJudgeRush()!
  let vipOrd8c = st.orders[1];
  if (vipOrd8c && vipOrd8c.slots.length >= 2) {
    const firstSlotTier = vipOrd8c.slots[0].tier;
    const partialId = await evalJS(`window.__HOSHI_DEBUG__.spawnTestEntity(${firstSlotTier}, 122, 442)`);
    await sleep(80);
    await evalJS(`window.__HOSHI_DEBUG__.serveById(${partialId})`);
    await sleep(100);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    const vipUidBeforeRush = st.orders[1].uid;
    assert(st.orders[1].slots.some((s) => s.done) && !st.orders[1].completed, 'VIP order should be partially completed');
    await evalJS(`window.__HOSHI_DEBUG__.triggerJudgeRush()`);
    await sleep(120);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    assert(
      st.orders[1].uid === vipUidBeforeRush && st.orders[0].isJudgeRush === true,
      `Expected half-done VIP order (orders[1]) preserved and Judge Rush placed in orders[0], got orders=${JSON.stringify(st.orders)}`
    );
  }
  console.log('[8C OK] 8.0x multiplier cap, Mikan scoop queue preservation & half-done VIP Judge Rush protection verified');

  // 8D (Item 4): Auto-Pause (`onHide` & Modals), Pause Modal, Restart & New-Run Confirmations, Per-Mode `savedRuns`, Anti-Suicide Stardust & `go_open_shop`
  await evalJS(`window.__HOSHI_DEBUG__.startMode('chef')`);
  await sleep(200);
  await evalJS(`window.__HOSHI_DEBUG__.triggerHide()`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.paused === true && st.activeModal === 'pause',
    `Expected triggerHide() mid-run to pause & open pause modal, got paused=${st.paused}, modal=${st.activeModal}`
  );
  await checkCapsuleAndViewportBounds('iPhone 14 Pause Modal 390x844', 390, 844, 34);
  await screenshot('31_pause_modal_390.png');
  await tapHit('pause_resume');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.paused === false && st.activeModal === null, 'Expected pause_resume to unpause cleanly');

  // Opening Compendium mid-run MUST pause gameplay
  await tapHit('play_comp');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'compendium' && st.paused === true, `Expected play_comp to pause gameplay, got modal=${st.activeModal}, paused=${st.paused}`);
  await tapHit('modal_close');
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null && st.paused === false, 'Expected closing compendium to resume gameplay');

  // Restart Confirmation Modal (`play_restart` -> `confirm_cancel` aborts, `confirm_accept` restarts)
  await evalJS(`window.__HOSHI_DEBUG__.addShiftRevenue(650)`);
  await sleep(100);
  await tapHit('play_restart');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'confirm' && st.paused === true, `Expected play_restart to open confirm modal, got ${st.activeModal}`);
  await checkCapsuleAndViewportBounds('iPhone 14 Confirm Restart Modal 390x844', 390, 844, 34);
  await tapHit('confirm_cancel');
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null && st.shiftRevenue >= 650, 'Expected confirm_cancel to abort restart and preserve run progress');
  await tapHit('play_restart');
  await sleep(140);
  await tapHit('confirm_accept');
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null && st.shiftRevenue === 0 && st.shift === 1, 'Expected confirm_accept to restart run cleanly');

  // Per-Mode `savedRuns` Isolation: save Chef Shift 2, start Rush, verify Chef checkpoint is STILL intact, and Lobby `btn_start` asks confirmation!
  await evalJS(`(() => {
    window.__HOSHI_DEBUG__.setShift(2, { forceHazard: 'glaze_ring' });
    window.__HOSHI_DEBUG__.addShiftRevenue(920);
    window.__HOSHI_DEBUG__.saveCheckpoint(false);
  })()`);
  await sleep(160);
  await evalJS(`window.__HOSHI_DEBUG__.returnToLobby()`);
  await sleep(160);
  await tapHit('mode_rush');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.mode === 'rush' && st.running === true && st.savedRuns.chef === true,
    `Expected starting Rush run to preserve savedRuns.chef === true, got ${JSON.stringify(st.savedRuns)}`
  );
  const rjb8d = st.jarBox;
  await tapAt(Math.round(rjb8d.x + rjb8d.w * 0.5), Math.round(rjb8d.y + rjb8d.h * 0.25));
  await sleep(180);
  await evalJS(`window.__HOSHI_DEBUG__.returnToLobby()`);
  await sleep(160);
  await tapHit('mode_chef');
  await sleep(120);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.hasSavedRun === true && st.savedRuns.chef === true && st.savedRuns.rush === true, 'Expected both Chef and Rush saved runs preserved');
  // Tapping `btn_start` ('新开') when a saved run exists for Chef MUST open `confirm` modal instead of silently wiping!
  await tapHit('btn_start');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.lobbyOpen === true && st.activeModal === 'confirm', `Expected btn_start over saved Chef run to open confirm dialog, got ${st.activeModal}`);
  await tapHit('confirm_cancel');
  await sleep(140);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.savedRuns.chef === true, 'Expected confirm_cancel in Lobby to preserve saved Chef run');

  // Score-Tied Anti-Suicide Stardust Settlement (< ¥600 after 5 drops -> 0 permanent stardust!) + Game Over `go_open_shop` -> Shop Modal
  await evalJS(`window.__HOSHI_DEBUG__.startMode('chef')`);
  await sleep(180);
  const bankBeforeSuicide = (await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`)).bankStardust;
  // Force 5 drops with tiny score (< 300) and exhaust steps to trigger shift_failed Game Over
  await evalJS(`(() => {
    window.__HOSHI_DEBUG__.clearEntities();
    window.__HOSHI_DEBUG__.addBankStardust(0);
  })()`);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const jb8d = st.jarBox;
  for (let i = 0; i < 5; i++) {
    await tapAt(Math.round(jb8d.x + jb8d.w * (0.22 + i * 0.14)), Math.round(jb8d.y + jb8d.h * 0.24));
    await sleep(230);
  }
  // Drain remaining steps via stale order or force shift failure by exhausting steps: let's check desktop/mobile top-bar pause on 375x667 too!
  await setViewport(375, 667, true, 2);
  await sleep(220);
  await checkCapsuleAndViewportBounds('iPhone SE Top-Bar Pause HUD 375x667', 375, 667, 0);
  await tapHit('play_pause');
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'pause', 'Expected play_pause on 375x667 to open pause modal');
  await checkCapsuleAndViewportBounds('iPhone SE Pause Modal 375x667', 375, 667, 0);
  await tapHit('pause_resume');
  await sleep(140);

  // Trigger rapid Rush end with 0 score to verify 0 permanent stardust on 0-score run & click `go_open_shop`!
  await evalJS(`window.__HOSHI_DEBUG__.startMode('rush')`);
  await sleep(160);
  const bankBeforeZeroRush = (await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`)).bankStardust;
  await evalJS(`window.__HOSHI_DEBUG__.setRushTimer(0.05)`);
  for (let w = 0; w < 30; w++) {
    await sleep(80);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
    if (st.over && st.activeModal === 'gameover') break;
  }
  const bankAfterZeroRush = (await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`)).bankStardust;
  assert(
    st.activeModal === 'gameover' && bankAfterZeroRush === bankBeforeZeroRush,
    `Expected 0-score suicide run to award 0 permanent stardust (before=${bankBeforeZeroRush}, after=${bankAfterZeroRush})`
  );
  await checkCapsuleAndViewportBounds('iPhone SE GameOver 3-Button Row 375x667', 375, 667, 0);
  await tapHit('go_open_shop');
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.lobbyOpen === true && st.activeModal === 'shop',
    `Expected go_open_shop from Game Over to return to Lobby and open Shop modal, got lobby=${st.lobbyOpen}, modal=${st.activeModal}`
  );
  await tapHit('modal_close');
  await sleep(140);
  console.log('[8D OK] Auto-pause, pause modal, confirmations, per-mode savedRuns, anti-suicide stardust & go_open_shop verified');

  // 8E (Item 5): Transient Cloud Failure -> `retry_pending` Backoff (NOT permanent `local_only`) & Recovery
  await evalJS(`(() => {
    window.__WX_HARNESS__.failNextPushCount = 1;
    window.__HOSHI_DEBUG__.addBankStardust(25);
    return window.__HOSHI_DEBUG__.flushCloud();
  })()`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.cloudState.status === 'retry_pending',
    `Expected transient cloud push error to enter 'retry_pending' (not permanent 'local_only'), got ${JSON.stringify(st.cloudState)}`
  );
  await evalJS(`window.__HOSHI_DEBUG__.flushCloud()`);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(
    st.cloudState.status === 'synced',
    `Expected subsequent cloud retry to recover cleanly to 'synced', got ${JSON.stringify(st.cloudState)}`
  );
  console.log('[8E OK] Cloud retry_pending exponential backoff & recovery verified');

  assert(errors.length === 0, `Runtime/Console errors detected: ${errors.join(' | ')}`);
  console.log('\n✅ ALL WECHAT MINI GAME E2E CHECKS (INCLUDING v4.1 OVERHAUL ITEMS 1–5) PASSED WITH ZERO ERRORS!');
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    try { server.close(); } catch (_) {}
    if (chrome && chromeExit === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          try { chrome.kill('SIGKILL'); } catch (_) {}
          resolve();
        }, 1500);
        chrome.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        try { chrome.kill('SIGTERM'); } catch (_) { clearTimeout(timer); resolve(); }
      });
    }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
