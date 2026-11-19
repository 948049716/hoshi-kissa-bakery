#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROMIUM = '/usr/bin/chromium';
const TARGET_URL = process.argv[2] || 'file:///home/antigravity/hoshi-kissa-bakery/dist/hoshi-kissa-bakery.html';
const OUT_DIR = '/tmp/game_verify';
fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const userDataDir = '/tmp/chrome_cdp_profile_' + Date.now();
  fs.mkdirSync(userDataDir, { recursive: true });

  const chrome = spawn(
    CHROMIUM,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--remote-debugging-port=9229',
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,760',
      'about:blank'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9229/json/list');
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

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 760,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Page.navigate', { url: TARGET_URL });
  await sleep(1400);

  // 1. Check all images loaded cleanly & take Title Screen screenshot
  const imgCheck = await evalJS(`(() => {
    const imgs = [...document.querySelectorAll('img')].filter(i => i.getAttribute('src'));
    return imgs.map(i => ({ alt: i.alt, ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight }));
  })()`);
  console.log('Loaded images:', JSON.stringify(imgCheck));
  if (imgCheck.some((i) => !i.ok)) {
    throw new Error('Some images failed to load: ' + JSON.stringify(imgCheck.filter((i) => !i.ok)));
  }
  await screenshot('01_title_screen.png');

  // 2. Click Start Game & verify HUD + Order initialized
  await evalJS(`document.getElementById('btn-start-game').click()`);
  await sleep(400);

  // Drop 18 treats across varied columns (with pauses so merges & stacking happen naturally!)
  const rect = await evalJS(`(() => {
    const r = document.getElementById('game-canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  })()`);

  const dropFractions = [0.5, 0.5, 0.44, 0.56, 0.48, 0.52, 0.36, 0.64, 0.48, 0.5, 0.42, 0.58, 0.5, 0.46, 0.54, 0.38, 0.62, 0.5];
  for (const frac of dropFractions) {
    const cx = rect.left + rect.width * frac;
    const cy = rect.top + rect.height * 0.5;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    await sleep(460);
  }
  await sleep(1000);

  // Test Hold Pocket Swap
  const holdBefore = await evalJS(`document.getElementById('hold-name').textContent`);
  await evalJS(`document.getElementById('hold-bubble').click()`);
  await sleep(150);
  const holdAfter = await evalJS(`document.getElementById('hold-name').textContent`);
  console.log('Hold swap:', holdBefore, '->', holdAfter);

  // Test Shake Bell Tool
  const shakeBefore = await evalJS(`document.getElementById('badge-shake').textContent`);
  await evalJS(`document.getElementById('btn-tool-shake').click()`);
  await sleep(500);
  const shakeAfter = await evalJS(`document.getElementById('badge-shake').textContent`);
  console.log('Shake tool:', shakeBefore, '->', shakeAfter);

  // Test Spoon Upgrade Tool targeting on an existing bottom-jar treat
  const spoonBefore = await evalJS(`document.getElementById('badge-spoon').textContent`);
  await evalJS(`document.getElementById('btn-tool-spoon').click()`);
  await sleep(150);
  const bannerVis = await evalJS(`document.getElementById('target-banner').classList.contains('visible')`);
  // Click near bottom center where treats rest
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.85, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.85, button: 'left', clickCount: 1 });
  await sleep(350);
  const spoonAfter = await evalJS(`document.getElementById('badge-spoon').textContent`);
  console.log('Spoon targeting banner:', bannerVis, 'count:', spoonBefore, '->', spoonAfter);

  // 2.5 Verify compound-polygon rigid-body state & capture both normal and wireframe screenshots
  const physState = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  console.log('Physics state:', JSON.stringify(physState));
  if (!physState.entities.length) {
    throw new Error('Expected active physics entities in jar');
  }
  if (!physState.entities.every((e) => e.polyCount >= 1 && Number.isFinite(e.x) && Number.isFinite(e.y))) {
    throw new Error('Invalid compound polygon entity state: ' + JSON.stringify(physState.entities));
  }

  // Test Q/E aim tilt control & ghost silhouette preview
  await evalJS(`window.__HOSHI_DEBUG__.setCurTier(4); window.__HOSHI_DEBUG__.setAimAngle(0.32);`);
  await sleep(160);
  await screenshot('02_gameplay_active.png');

  // Toggle physics wireframe inspector (📐 物理轮廓) to verify compound hulls + CoM + contact normals visually!
  await evalJS(`document.getElementById('btn-debug-phys').click()`);
  await sleep(220);
  const debugState = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  console.log('Debug wireframe enabled:', debugState.debugPhysics, 'active contacts:', debugState.contactCount);
  if (!debugState.debugPhysics) {
    throw new Error('Failed to toggle physics wireframe overlay');
  }
  await screenshot('02b_physics_colliders.png');
  await evalJS(`document.getElementById('btn-debug-phys').click()`);
  await sleep(150);

  // 3. Test Compendium Modal
  await evalJS(`document.getElementById('btn-compendium').click()`);
  await sleep(350);
  await screenshot('03_compendium.png');
  await evalJS(`document.getElementById('btn-close-comp').click()`);
  await sleep(250);

  // 4. Test Mobile Portrait Responsive Layout (430x880)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 430,
    height: 880,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(450);
  await screenshot('04_mobile_layout.png');

  if (errors.length > 0) {
    throw new Error('Runtime browser errors detected:\n' + errors.join('\n'));
  }
  console.log('ALL E2E CHECKS PASSED WITH ZERO ERRORS!');

  ws.close();
  chrome.kill('SIGKILL');
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
