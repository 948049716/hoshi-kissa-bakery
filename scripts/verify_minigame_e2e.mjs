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
  console.log('Launching headless browser:', CHROMIUM);
  const chromeEnv = { ...process.env };
  delete chromeEnv.DBUS_SESSION_BUS_ADDRESS;
  const chrome = spawn(
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
  let chromeExit = null;
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
    try { chrome.kill('SIGKILL'); } catch (_) {}
    try { server.close(); } catch (_) {}
    throw new Error(
      `Failed to connect to Chromium CDP (bin=${CHROMIUM}, exit=${chromeExit || 'still running'})\n${chromeStderr}`
    );
  }

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
  assert(st.shift === 1 && st.shiftTarget === 1200, `Expected Shift 1 target ¥1200, got shift=${st.shift}, target=${st.shiftTarget}`);
  assert(st.stepsLeft === 16 && st.stepsMax === 16, `Expected 16/16 steps in Shift 1, got ${st.stepsLeft}/${st.stepsMax}`);
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

  // 3A. True Tap-to-Serve on starter T3 -> triggers removal, score, skillEnergy, and Serve Cascade window!
  const starterT3 = st.entities.find((e) => e.isServable);
  assert(starterT3, 'Expected a servable starter treat');
  const t3ScreenX = Math.round(jb.x + starterT3.x * jb.scale);
  const t3ScreenY = Math.round(jb.y + starterT3.y * jb.scale);
  const scoreBeforeServe = st.score;
  await tapAt(t3ScreenX, t3ScreenY);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.servesCompleted >= 1, `Expected servesCompleted >= 1 after tap-to-serve, got ${st.servesCompleted}`);
  assert(st.score > scoreBeforeServe, 'Expected tap-to-serve to award score');
  assert(st.skillEnergy >= 30, `Expected tap-to-serve to charge skillEnergy >= 30, got ${st.skillEnergy}`);
  assert(st.serveCascadeTimer > 0, `Expected Serve Cascade Avalanche window active, got ${st.serveCascadeTimer}`);
  assert(!st.entities.some((e) => e.id === starterT3.id), 'Served treat must be physically removed from jar');

  // 3B. Pull-Down Direct-Aim Slingshot Bank-Shot (preview screenshot + actual wall bounce!)
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
  assert(st.aim && st.aim.active && st.aim.mode === 'sling', `Expected slingshot aim mode active, got ${JSON.stringify(st.aim)}`);
  await screenshot('08b_slingshot_aim_375.png');
  const dropsBeforeSling = st.dropsMadeThisRun;
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: slingEndX, y: slingEndY, button: 'left', clickCount: 1 });
  await sleep(520);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.dropsMadeThisRun === dropsBeforeSling + 1, 'Slingshot release must launch treat');

  // Hold swap + Quick vertical tap-drop
  await tapHit('mobile_hold_swap');
  await sleep(160);
  await tapAt(Math.round(jb.x + jb.w * 0.72), Math.round(jb.y + jb.h * 0.30));
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
  const swB = st.entities.find((e) => !e.isYarnBall && e.id !== swA.id);
  assert(swB, 'Need live second swappable entity for Luna swap_2');
  await tapAt(Math.round(jb.x + swB.x * jb.scale), Math.round(jb.y + swB.y * jb.scale));
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeSkillMode === null && st.skillEnergy === 0, 'Expected Luna swap to complete and consume skillEnergy');

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

  // Trigger Chime Event -> Queue Blessing -> Open Blessing 3-Choice Modal
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('chime')`);
  await sleep(160);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeEvent && st.activeEvent.kind === 'chime', 'Expected active chime event');
  if (st.pendingBlessings <= 0) {
    await evalJS(`window.__HOSHI_DEBUG__.queueBlessing('测试祝福奖励')`);
    await sleep(180);
  }
  await tapHit('open_blessing_btn');
  await sleep(260);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'blessing', `Expected blessing modal, got ${st.activeModal}`);
  await screenshot('10_blessing_375.png');
  for (let bGuard = 0; bGuard < 5 && st.activeModal === 'blessing'; bGuard++) {
    const pickHit = st.hits.find((h) => h.id.startsWith('blessing_pick_'));
    assert(pickHit, 'Expected blessing pick button');
    await tapHit(pickHit.id);
    await sleep(240);
    st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  }
  assert(st.activeModal === null, 'Blessing modal closed after selection');

  // 3F. Phase 2 — 5-Shift Early Close, Mobile Prep Shop (Reroll/Buy/Sell/Mod), Shift 2 Carry-Over & Relics
  await evalJS(`window.__HOSHI_DEBUG__.addShiftRevenue(1300)`);
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
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
    st.prepShop && st.prepShop.nextShiftNum === 2 && st.prepShop.relicOffers.length === 3 && st.prepShop.modOffers.length === 2,
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
  await dragSwipe(188, 520, 188, 220, 8);
  await sleep(200);
  await checkCapsuleAndViewportBounds('iPhone SE Prep Shop Scrolled 375x667', 375, 667, 0);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const modHit = st.hits.find((h) => h.id.startsWith('prep_buy_mod_'));
  assert(modHit, 'Expected prep_buy_mod_* hit after scrolling Prep Shop');
  await tapHit(modHit.id);
  await sleep(200);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.prepShop.modOffers.some((m) => m.bought), 'Expected Deck Mod offer marked bought');

  // Launch Shift 2 & verify Hot-Oven Carry-Over
  await tapHit('prep_next_shift');
  await sleep(340);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null, 'Prep Shop closed on Shift 2 start');
  assert(st.shift === 2 && st.shiftTarget === 2600, `Expected Shift 2 target ¥2600, got shift=${st.shift}, target=${st.shiftTarget}`);
  assert(st.stepsLeft >= 16, `Expected >= 16 steps in Shift 2, got ${st.stepsLeft}`);
  assert(st.entities.length >= 2, `Expected Hot-Oven Carry-Over treats in Shift 2 jar, got ${st.entities.length}`);

  // Verify Relics Mechanics: rel_bumpers (2 Butter Bumpers), rel_aged (agedStacks++), rel_antigrav (4th drop flips gravity!)
  await evalJS(`
    window.__HOSHI_DEBUG__.equipRelic('rel_bumpers');
    window.__HOSHI_DEBUG__.equipRelic('rel_aged');
    window.__HOSHI_DEBUG__.equipRelic('rel_antigrav');
  `);
  await sleep(180);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.obstacles && st.obstacles.length === 2, `Expected 2 Butter Bumpers from rel_bumpers, got ${st.obstacles && st.obstacles.length}`);

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
  // 4. 90s Rush Mode: Tap-to-Serve +3.0s Extension, Emergency Gust & Settlement
  // ==========================================================
  await setViewport(390, 844, true, 2);
  await navigate('?safeTop=47&safeBottom=34&capsule=1');
  await tapHit('mode_rush');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(280);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'rush' && st.rushTimer > 80, `Expected rush mode timer > 80, got ${st.rushTimer}`);
  await checkCapsuleAndViewportBounds('iPhone 14 Rush HUD 390x844', 390, 844, 34);

  // Tap-to-Serve starter T3 in Rush mode -> must add +3.0s!
  const rushServable = st.entities.find((e) => e.isServable);
  assert(rushServable, 'Expected servable starter treat in Rush mode');
  const rjb = st.jarBox;
  const beforeServeRushT = st.rushTimer;
  await tapAt(Math.round(rjb.x + rushServable.x * rjb.scale), Math.round(rjb.y + rushServable.y * rjb.scale));
  await sleep(220);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.rushTimer > beforeServeRushT + 2.0, `Expected Rush tap-to-serve to add +3.0s (before=${beforeServeRushT}, after=${st.rushTimer})`);

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
  await screenshot('12_rush_gameover_390.png');

  // 4B. Phase 2 — Mikan +10🪙 Starting Coins, Shift 5 Grand Prix Victory & Endless Overtime (Shift 6)
  await evalJS(`window.__HOSHI_DEBUG__.selectPatron('mikan'); window.__HOSHI_DEBUG__.startMode('chef');`);
  await sleep(300);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'chef' && st.coins >= 10, `Expected Mikan starting coins >= 10, got ${st.coins}`);

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

  // Enter Endless Overtime -> Prep Shop for Shift 6 -> Launch Shift 6
  await tapHit('victory_endless');
  await sleep(240);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === 'prep_shop' && st.prepShop && st.prepShop.nextShiftNum === 6, 'Expected Prep Shop for Shift 6 Endless Overtime');
  await tapHit('prep_next_shift');
  await sleep(320);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.activeModal === null && st.shift === 6 && st.shiftTarget > 15000, `Expected Shift 6 Endless target > 15000, got shift=${st.shift}, target=${st.shiftTarget}`);

  // ==========================================================
  // 5. Desktop 1280x760 Play Screen + Chef 5-Shift, Prep Shop & Zen Checks
  // ==========================================================
  await setViewport(1280, 760, false, 1);
  await navigate('?safeTop=8&safeBottom=0&capsule=1');
  await tapHit('mode_chef');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(300);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'chef' && st.running === true && st.shift === 1, 'Chef mode running on desktop at Shift 1');
  assert(st.hits.some((h) => h.id === 'wide_relics_bar'), 'Expected wide_relics_bar hit on desktop Chef HUD');
  await checkCapsuleAndViewportBounds('Desktop Chef HUD 1280x760', 1280, 760, 0);
  await screenshot('13_chef_desktop_1280.png');

  // Desktop Early Close + 3-column Desktop Prep Shop Layout Verification
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
  assert(st.activeModal === 'prep_shop', `Expected desktop prep_shop modal, got ${st.activeModal}`);
  await checkCapsuleAndViewportBounds('Desktop Prep Shop 1280x760', 1280, 760, 0);
  await screenshot('13b_prep_shop_desktop_1280.png');

  await evalJS(`window.__HOSHI_DEBUG__.returnToLobby()`);
  await sleep(160);
  await tapHit('mode_zen');
  await sleep(120);
  await tapHit('btn_start');
  await sleep(300);
  st = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(st.mode === 'zen' && st.running === true, 'Zen mode running on desktop');
  await checkCapsuleAndViewportBounds('Desktop Zen HUD 1280x760', 1280, 760, 0);
  const djb = st.jarBox;
  await tapAt(Math.round(djb.x + djb.w * 0.5), Math.round(djb.y + djb.h * 0.35));
  await waitForCooldown();
  await screenshot('14_zen_desktop_1280.png');

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
