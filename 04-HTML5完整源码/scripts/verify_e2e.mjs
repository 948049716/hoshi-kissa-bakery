#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const CHROMIUM = '/usr/bin/chromium';
const DEFAULT_HTML = path.join(REPO_ROOT, 'hoshi-kissa-bakery.html');
const TARGET_URL = process.argv[2] || `file://${DEFAULT_HTML}`;
const OUT_DIR = '/tmp/game_verify';
fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function run() {
  const userDataDir = '/tmp/chrome_cdp_profile_' + Date.now();
  fs.mkdirSync(userDataDir, { recursive: true });

  const port = 9229 + Math.floor(Math.random() * 50);
  const chrome = spawn(
    CHROMIUM,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,760',
      'about:blank'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let wsUrl = null;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
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
    await sleep(320);
  }

  async function checkZeroScroll(label, screenId) {
    const m = await evalJS(`(() => {
      const doc = document.documentElement;
      const el = document.getElementById('${screenId}');
      const footer = el ? el.querySelector('.lobby-footer, .tools-dock') : null;
      const fRect = footer ? footer.getBoundingClientRect() : null;
      return {
        innerW: window.innerWidth,
        innerH: window.innerHeight,
        docScrollH: doc.scrollHeight,
        docScrollW: doc.scrollWidth,
        elScrollH: el ? el.scrollHeight : 0,
        elClientH: el ? el.clientHeight : 0,
        footerBottom: fRect ? Math.round(fRect.bottom) : 0,
        footerVisible: fRect ? (fRect.bottom <= window.innerHeight + 2 && fRect.height > 10) : true
      };
    })()`);
    console.log(`[Layout ${label}]`, JSON.stringify(m));
    assert(m.docScrollH <= m.innerH + 2, `${label}: docScrollH(${m.docScrollH}) > innerH(${m.innerH})`);
    assert(m.elScrollH <= m.elClientH + 2, `${label}: #${screenId} scrollHeight(${m.elScrollH}) > clientHeight(${m.elClientH})`);
    assert(m.footerVisible, `${label}: bottom controls clipped! footerBottom=${m.footerBottom} > innerH=${m.innerH}`);
  }

  async function checkAllLoadedImages(label) {
    const imgs = await evalJS(`(() => {
      return [...document.querySelectorAll('img')]
        .filter(i => {
          const s = i.getAttribute('src');
          return s && s.trim().length > 0;
        })
        .map(i => ({
          id: i.id || '',
          alt: i.alt || '',
          ok: i.complete && i.naturalWidth > 0,
          w: i.naturalWidth,
          h: i.naturalHeight
        }));
    })()`);
    const bad = imgs.filter((i) => !i.ok);
    console.log(`[Images ${label}] total=${imgs.length}, failed=${bad.length}`);
    assert(imgs.length > 0, `${label}: expected > 0 loaded images`);
    assert(bad.length === 0, `${label}: failed images: ${JSON.stringify(bad)}`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await setViewport(1280, 760, false, 1);

  console.log('Navigating to:', TARGET_URL);
  await send('Page.navigate', { url: TARGET_URL });
  await sleep(1400);

  // =========================================================
  // A. LOBBY SCREEN & ZERO-SCROLL CHECK (Desktop + Mobile)
  // =========================================================
  const initState = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(initState.lobbyOpen === true, 'Expected Lobby to be open on launch');
  await checkAllLoadedImages('Lobby Desktop');
  await checkZeroScroll('Lobby Desktop 1280x760', 'lobby-screen');
  await screenshot('01_lobby_desktop.png');

  // Check Mobile 375x667 (iPhone SE compact) & 390x844 (iPhone 14) on Lobby
  await setViewport(375, 667, true, 2);
  await checkZeroScroll('Lobby Mobile 375x667', 'lobby-screen');
  await screenshot('01b_lobby_mobile_375.png');

  await setViewport(390, 844, true, 2);
  await checkZeroScroll('Lobby Mobile 390x844', 'lobby-screen');
  await screenshot('01c_lobby_mobile_390.png');

  await setViewport(1280, 760, false, 1);

  // =========================================================
  // B. LOBBY INTERACTIONS, HELP/CAREER MODALS & SHOP PERSISTENCE
  // =========================================================
  const speechBefore = await evalJS(`document.getElementById('lobby-patron-speech').textContent`);
  await evalJS(`document.getElementById('lobby-patron-portrait').click()`);
  await sleep(150);
  const speechAfter = await evalJS(`document.getElementById('lobby-patron-speech').textContent`);
  console.log('Patron tap dialogue:', speechBefore, '->', speechAfter);

  // Open & close Help modal
  await evalJS(`document.getElementById('btn-lobby-help').click()`);
  await sleep(200);
  assert(await evalJS(`document.getElementById('help-modal').classList.contains('is-open')`), 'Help modal should open');
  await evalJS(`document.getElementById('btn-close-help').click()`);
  await sleep(150);

  // Open & close Career modal
  await evalJS(`document.getElementById('btn-open-career').click()`);
  await sleep(200);
  assert(await evalJS(`document.getElementById('career-modal').classList.contains('is-open')`), 'Career modal should open');
  await screenshot('02c_career_modal.png');
  await evalJS(`document.getElementById('btn-close-career').click()`);
  await sleep(150);

  // Grant test stardust & test Patisserie Shop (Upgrades + Themes + Patrons)
  await evalJS(`window.__HOSHI_DEBUG__.addBankStardust(280)`);
  await evalJS(`document.getElementById('btn-open-shop').click()`);
  await sleep(250);
  assert(await evalJS(`document.getElementById('shop-modal').classList.contains('is-open')`), 'Shop modal should open');

  // Buy up_tools Lv.1 & up_fever Lv.1
  await evalJS(`document.querySelector('[data-shop-id="up_tools"]').click()`);
  await sleep(120);
  await evalJS(`document.querySelector('[data-shop-id="up_fever"]').click()`);
  await sleep(180);
  await screenshot('02_shop_upgrades.png');

  // Switch to Themes tab, unlock & equip Sakura Jar
  await evalJS(`document.querySelector('.shop-tab[data-tab="themes"]').click()`);
  await sleep(200);
  await evalJS(`document.querySelector('[data-shop-id="sakura"]').click()`);
  await sleep(220);
  const themeNow = await evalJS(`document.getElementById('cafe-stage').dataset.theme`);
  assert(themeNow === 'sakura', `Expected sakura theme equipped, got ${themeNow}`);
  await screenshot('02b_shop_themes.png');

  // Switch to Patrons tab, unlock & select Luna (眠眠星兔)
  await evalJS(`document.querySelector('.shop-tab[data-tab="patrons"]').click()`);
  await sleep(200);
  await checkAllLoadedImages('Shop Patrons');
  await evalJS(`document.querySelector('[data-shop-id="luna"]').click()`);
  await sleep(220);
  await screenshot('02d_shop_patrons.png');

  await evalJS(`document.getElementById('btn-close-shop').click()`);
  await sleep(200);

  // Reload page & verify localStorage persistence!
  await send('Page.reload', { ignoreCache: false });
  await sleep(1300);
  const reloadedSave = await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`);
  console.log('Reloaded save:', JSON.stringify({
    bankStardust: reloadedSave.bankStardust,
    shopUpgrades: reloadedSave.shopUpgrades,
    equippedTheme: reloadedSave.equippedTheme,
    selectedPatron: reloadedSave.selectedPatron
  }));
  assert(reloadedSave.shopUpgrades.up_tools === 1, 'Expected up_tools === 1 after reload');
  assert(reloadedSave.shopUpgrades.up_fever === 1, 'Expected up_fever === 1 after reload');
  assert(reloadedSave.equippedTheme === 'sakura', 'Expected sakura theme persisted after reload');
  assert(reloadedSave.selectedPatron === 'luna', 'Expected luna patron persisted after reload');

  // =========================================================
  // C. CHEF MODE + UPGRADES/PATRON PASSIVES + ALL 3 SHOP EVENTS
  // =========================================================
  await evalJS(`document.getElementById('btn-start-game').click()`);
  await sleep(450);
  await checkZeroScroll('Play Desktop 1280x760', 'play-screen');

  const chefStart = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  console.log('Chef start state:', JSON.stringify({
    mode: chefStart.mode,
    tools: chefStart.tools,
    feverEnergy: chefStart.feverEnergy,
    dropsUntilRainbow: chefStart.dropsUntilRainbow
  }));
  assert(chefStart.mode === 'chef', 'Expected chef mode');
  assert(chefStart.tools.shake === 3, `Expected up_tools Lv1 -> shake=3, got ${chefStart.tools.shake}`);
  assert(chefStart.feverEnergy === 18, `Expected up_fever Lv1 -> feverEnergy=18, got ${chefStart.feverEnergy}`);
  assert(chefStart.dropsUntilRainbow === 10, `Expected Luna passive -> dropsUntilRainbow=10, got ${chefStart.dropsUntilRainbow}`);

  const rect = await evalJS(`(() => {
    const r = document.getElementById('game-canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  })()`);

  // Drop 10 treats to populate the jar
  const dropFracs = [0.5, 0.5, 0.43, 0.57, 0.48, 0.52, 0.36, 0.64, 0.46, 0.54];
  for (const frac of dropFracs) {
    const cx = rect.left + rect.width * frac;
    const cy = rect.top + rect.height * 0.5;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    await sleep(360);
  }
  await sleep(600);

  // Test Hold swap & Spoon tool
  await evalJS(`document.getElementById('hold-bubble').click()`);
  await sleep(140);
  await evalJS(`document.getElementById('btn-tool-spoon').click()`);
  await sleep(140);
  assert(await evalJS(`document.getElementById('target-banner').classList.contains('visible')`), 'Target banner visible for spoon');
  await evalJS(`document.getElementById('btn-cancel-target').click()`);
  await sleep(120);

  // Event 1: Meteor Wish Night
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('meteor')`);
  await sleep(300);
  const meteorState = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(meteorState.activeEvent && meteorState.activeEvent.kind === 'meteor', 'Meteor event should be active');
  assert(await evalJS(`document.getElementById('event-banner').classList.contains('visible')`), 'Event banner visible for meteor');

  // Event 2: Mischief Yarn Ball (Rigid Body + HP=2 + Shatter via Shake Bell)
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('yarn')`);
  await sleep(750);
  const yarnState = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const yarnBody = yarnState.entities.find((e) => e.isYarnBall);
  console.log('Yarn body state:', JSON.stringify(yarnBody));
  assert(yarnBody && yarnBody.polyCount >= 1 && yarnBody.yarnHp === 2, 'Expected rigid-body Yarn Ball with polyCount>=1 and yarnHp=2');
  await screenshot('03_gameplay_sakura_yarn.png');

  // Toggle physics wireframe with Yarn Ball inside jar
  await evalJS(`document.getElementById('btn-debug-phys').click()`);
  await sleep(220);
  await screenshot('03b_physics_wireframe_yarn.png');
  await evalJS(`document.getElementById('btn-debug-phys').click()`);
  await sleep(120);

  // Crack yarn ball twice with Shake Bell -> shatter & reward!
  const scoreBeforeYarn = yarnState.score;
  await evalJS(`document.getElementById('btn-tool-shake').click()`);
  await sleep(280);
  const yarnMid = await evalJS(`window.__HOSHI_DEBUG__.getState().entities.find(e => e.isYarnBall)`);
  assert(yarnMid && yarnMid.yarnHp === 1, `Expected yarnHp=1 after first shake, got ${JSON.stringify(yarnMid)}`);
  await evalJS(`document.getElementById('btn-tool-shake').click()`);
  await sleep(350);
  const afterYarn = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(afterYarn.yarnBrokenThisRun >= 1, 'Expected yarnBrokenThisRun >= 1 after shattering yarn ball');
  assert(afterYarn.score > scoreBeforeYarn, 'Expected score to increase after shattering yarn ball');

  // Event 3: Golden Chime
  await evalJS(`window.__HOSHI_DEBUG__.triggerEvent('chime')`);
  await sleep(250);
  const chimeState = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  assert(chimeState.activeEvent && chimeState.activeEvent.kind === 'chime', 'Golden Chime event should be active');

  // =========================================================
  // D. 90-SECOND RUSH MODE (Timer, Emergency Gust, Settlement & Bank)
  // =========================================================
  await evalJS(`document.getElementById('btn-back-lobby').click()`);
  await sleep(350);
  assert((await evalJS(`window.__HOSHI_DEBUG__.getState()`)).lobbyOpen === true, 'Returned to Lobby');

  // Select 90s Rush mode & Start
  await evalJS(`document.querySelector('.lobby-mode-card[data-mode="rush"]').click()`);
  await sleep(120);
  await evalJS(`document.getElementById('btn-start-game').click()`);
  await sleep(400);

  const rushInit = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  console.log('Rush start state:', JSON.stringify({
    mode: rushInit.mode,
    rushTimer: rushInit.rushTimer,
    dropsUntilRainbow: rushInit.dropsUntilRainbow
  }));
  assert(rushInit.mode === 'rush', 'Expected rush mode');
  assert(rushInit.rushTimer > 85 && rushInit.rushTimer <= 90, `Unexpected rushTimer: ${rushInit.rushTimer}`);
  assert(rushInit.dropsUntilRainbow === 6, `Expected Rush(8) - Luna(2) = 6, got ${rushInit.dropsUntilRainbow}`);

  // Drop 7 rapid treats (ensuring >= 5 drops for guaranteed bank stardust!)
  for (let i = 0; i < 7; i++) {
    const cx = rect.left + rect.width * (0.35 + (i % 4) * 0.1);
    const cy = rect.top + rect.height * 0.5;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    await sleep(220);
  }
  await sleep(450);
  await screenshot('04_rush_gameplay.png');

  // Verify Rush Emergency Star-Wind Gust (clears top 3~4 treats, deducts ~5s, does NOT end run)
  const beforeGust = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  await evalJS(`window.__HOSHI_DEBUG__.triggerRushGust()`);
  await sleep(280);
  const afterGust = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  console.log('Rush Gust:', {
    beforeCount: beforeGust.entities.length,
    afterCount: afterGust.entities.length,
    beforeT: beforeGust.rushTimer,
    afterT: afterGust.rushTimer,
    over: afterGust.over
  });
  assert(afterGust.over === false, 'Emergency gust must NOT trigger game over');
  assert(afterGust.entities.length < beforeGust.entities.length, 'Emergency gust must clear top treats');
  assert(afterGust.rushTimer <= beforeGust.rushTimer - 4.5, 'Emergency gust must deduct 5s');

  // Fast-forward Rush Timer to 0.25s -> verify End-of-Run Settlement & Permanent Stardust Deposit!
  const bankBeforeRushEnd = (await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`)).bankStardust;
  await evalJS(`window.__HOSHI_DEBUG__.setRushTimer(0.25)`);
  await sleep(600);
  const settledState = await evalJS(`window.__HOSHI_DEBUG__.getState()`);
  const goOpen = await evalJS(`document.getElementById('gameover-modal').classList.contains('is-open')`);
  const goTitle = await evalJS(`document.getElementById('go-heading').textContent`);
  const bankAfterRushEnd = (await evalJS(`window.__HOSHI_DEBUG__.getSaveData()`)).bankStardust;
  console.log('Rush Settlement:', { goOpen, goTitle, bankBeforeRushEnd, bankAfterRushEnd });
  assert(settledState.over === true && goOpen, 'Expected gameover modal to open when rush timer hits 0');
  assert(goTitle.includes('90秒狂欢'), `Expected 90秒狂欢 title, got ${goTitle}`);
  assert(bankAfterRushEnd > bankBeforeRushEnd, `Expected bankStardust to increase (${bankBeforeRushEnd} -> ${bankAfterRushEnd})`);
  await screenshot('05_gameover_settlement.png');

  // Return to Lobby from Game Over
  await evalJS(`document.getElementById('btn-go-lobby').click()`);
  await sleep(320);
  assert((await evalJS(`window.__HOSHI_DEBUG__.getState()`)).lobbyOpen === true, 'Returned to Lobby from Game Over');

  // =========================================================
  // E. ZEN MODE & MOBILE GAMEPLAY ZERO-SCROLL CHECK (375x667)
  // =========================================================
  await evalJS(`document.querySelector('.lobby-mode-card[data-mode="zen"]').click()`);
  await sleep(100);
  await evalJS(`document.getElementById('btn-start-game').click()`);
  await sleep(350);
  assert((await evalJS(`window.__HOSHI_DEBUG__.getState()`)).mode === 'zen', 'Expected zen mode');

  // Also test Mobile Rush HUD at 375x667 and 390x844
  await evalJS(`window.__HOSHI_DEBUG__.startMode('rush')`);
  await sleep(250);
  await setViewport(375, 667, true, 2);
  await checkZeroScroll('Play Mobile Rush 375x667', 'play-screen');
  await screenshot('06_mobile_gameplay_375.png');

  await setViewport(390, 844, true, 2);
  await checkZeroScroll('Play Mobile Rush 390x844', 'play-screen');
  await screenshot('06b_mobile_gameplay_390.png');

  await checkAllLoadedImages('Final Check');

  if (errors.length > 0) {
    throw new Error('Runtime browser errors detected:\n' + errors.join('\n'));
  }
  console.log('ALL 3.0 PLAN B E2E CHECKS PASSED WITH ZERO ERRORS!');

  ws.close();
  chrome.kill('SIGKILL');
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
