#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const MINIGAME_DIR = path.join(REPO_ROOT, '05-微信小游戏版本');

const CHROMIUM = '/usr/bin/chromium';
const OUT_DIR = '/tmp/minigame_verify';
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
    setInnerAudioOption() {},
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
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
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

  const cdpPort = 9280 + Math.floor(Math.random() * 60);
  const chrome = spawn(
    CHROMIUM,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,760',
      'about:blank'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let wsUrl = null;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      const pages = await res.json();
      if (pages.length > 0 && pages[0].webSocketDebuggerUrl) {
        wsUrl = pages[0].webSocketDebuggerUrl;
        break;
      }
    } catch (_) {}
    await sleep(150);
  }
  if (!wsUrl) throw new Error('Failed to connect to Chromium CDP');

  const ws = new WebSocket(wsUrl);
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
    await send('Page.navigate', { url: `${baseUrl}${query}` });
    for (let i = 0; i < 40; i++) {
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
    assert(info.assetsLoaded === 37 && info.assetsTotal === 37, `${label}: assets ${info.assetsLoaded}/${info.assetsTotal}`);
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
  await checkCapsuleAndViewportBounds('iPhone SE Chef HUD 375x667', 375, 667, 0);
  await screenshot('08_chef_375.png');

  // Hold swap + Drop via simulated touch aim inside jar
  await tapHit('mobile_hold_swap');
  await sleep(160);
  const jb = st.jarBox;
  assert(jb && jb.scale > 0, 'jarBox computed');
  await dragSwipe(Math.round(jb.x + jb.w * 0.4), Math.round(jb.y + jb.h * 0.35), Math.round(jb.x + jb.w * 0.45), Math.round(jb.y + jb.h * 0.35));
  await sleep(500);
  await dragSwipe(Math.round(jb.x + jb.w * 0.6), Math.round(jb.y + jb.h * 0.35), Math.round(jb.x + jb.w * 0.58), Math.round(jb.y + jb.h * 0.35));
  await sleep(500);

  // Trigger Meteor -> Yarn Ball -> Toggle Debug Wireframe
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('meteor')`);
  await sleep(220);
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('yarn')`);
  await evalJS(`window.__HOSHI_DEBUG__.togglePhysicsDebug(true)`);
  await sleep(350);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.entities.length >= 2, `Expected dropped entities >= 2, got ${st.entities.length}`);
  assert(st.entities.some((e) => e.isYarnBall && e.yarnHp === 2), 'Expected active yarn ball with yarnHp=2');
  await screenshot('09_physics_yarn_375.png');
  await evalJS(`window.__HOSHI_DEBUG__.togglePhysicsDebug(false)`);

  // Trigger Chime Event -> Queue Blessing -> Open Blessing 3-Choice Modal
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('chime')`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeEvent && st.activeEvent.kind === 'chime', 'Expected active chime event');
  await evalJS(`window.__HOSHI_DEBUG__.queueBlessing('测试祝福奖励')`);
  await sleep(180);
  await tapHit('open_blessing_btn');
  await sleep(260);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'blessing', `Expected blessing modal, got ${st.activeModal}`);
  await screenshot('10_blessing_375.png');
  const pickHit = st.hits.find((h) => h.id.startsWith('blessing_pick_'));
  assert(pickHit, 'Expected blessing pick button');
  await tapHit(pickHit.id);
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null, 'Blessing modal closed after selection');

  // ==========================================================
  // 4. 90s Rush Mode, Emergency Star-Wind Gust, & Settlement
  // ==========================================================
  await setViewport(390, 844, true, 2);
  await navigate('?safeTop=47&safeBottom=34&capsule=1');
  await tapHit('mode_rush');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'rush' && st.rushTimer > 80, `Expected rush mode timer > 80, got ${st.rushTimer}`);

  // Drop 2 treats so emergency gust has candies to blow away
  const rjb = st.jarBox;
  await dragSwipe(Math.round(rjb.x + rjb.w * 0.42), Math.round(rjb.y + rjb.h * 0.35), Math.round(rjb.x + rjb.w * 0.44), Math.round(rjb.y + rjb.h * 0.35));
  await sleep(420);
  await dragSwipe(Math.round(rjb.x + rjb.w * 0.58), Math.round(rjb.y + rjb.h * 0.35), Math.round(rjb.x + rjb.w * 0.56), Math.round(rjb.y + rjb.h * 0.35));
  await sleep(420);

  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const beforeGustTimer = st.rushTimer;
  const beforeGustCount = st.entities.length;
  assert(beforeGustCount >= 2, 'Expected treats inside jar before gust');
  await evalJS(`window.__HOSHI_DEBUG__.triggerRushGust()`);
  await sleep(260);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.over === false && st.rushTimer <= beforeGustTimer - 4.5, `Rush gust failed: over=${st.over}, timer=${st.rushTimer}`);
  assert(st.entities.length < beforeGustCount, 'Rush gust cleared top candies');
  await screenshot('11_rush_gust_390.png');

  await evalJS(`window.__HOSHI_DEBUG__.setRushTimer(0.12)`);
  await sleep(450);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.over === true && st.rushFinished === true && st.activeModal === 'gameover', 'Rush timer expiration opens settlement');
  await screenshot('12_rush_gameover_390.png');

  // ==========================================================
  // 5. Desktop 1280x760 Play Screen + Zen Mode Check
  // ==========================================================
  await setViewport(1280, 760, false, 1);
  await navigate('?safeTop=8&safeBottom=0&capsule=1');
  await tapHit('mode_zen');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(300);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'zen' && st.running === true, 'Zen mode running on desktop');
  await checkCapsuleAndViewportBounds('Desktop Zen HUD 1280x760', 1280, 760, 0);
  const djb = st.jarBox;
  await dragSwipe(Math.round(djb.x + djb.w * 0.5), Math.round(djb.y + djb.h * 0.35), Math.round(djb.x + djb.w * 0.52), Math.round(djb.y + djb.h * 0.35));
  await sleep(450);
  await screenshot('13_zen_desktop_1280.png');

  assert(errors.length === 0, `Runtime/Console errors detected: ${errors.join(' | ')}`);
  console.log('\n✅ ALL WECHAT MINI GAME E2E CHECKS PASSED WITH ZERO ERRORS!');

  ws.close();
  chrome.kill('SIGTERM');
  server.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
