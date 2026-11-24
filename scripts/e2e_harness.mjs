/**
 * Zero-dependency Headless Chromium CDP E2E Harness for 《一起做猫饼》(Hoshi Kissa Bakery v2.0).
 * Provides:
 * - Zero-/tmp scratch directory resolution & Chromium process lifecycle (`resolveVerifyPaths`, `launchCdpBrowser`)
 * - In-memory `wx-server-sdk` database + dynamic `cloudfunctions/kissa_sync/index.js` host
 * - Built-in v2 contract-compliant `kissa_sync` mock (for `--self-test` & fallback)
 * - Browser `window.wx` & `window.__WX_HARNESS__` shim (`buildWxShimScript`)
 * - Preview & Self-Test HTML servers (`startHarnessServer`)
 * - Unified opaque-box `TestContext` (`createTestContext`) for Tiers 1–5
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
export const DEFAULT_MINIGAME_DIR = path.join(DEFAULT_REPO_ROOT, '05-微信小游戏版本');

export const VIEWPORT_PRESETS = Object.freeze({
  SE_375: Object.freeze({
    width: 375,
    height: 667,
    mobile: true,
    dpr: 2,
    safeTop: 20,
    safeBottom: 0,
    query: '?safeTop=20&safeBottom=0&capsule=1&cloud=1'
  }),
  IPHONE_390: Object.freeze({
    width: 390,
    height: 844,
    mobile: true,
    dpr: 2,
    safeTop: 47,
    safeBottom: 34,
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=1'
  }),
  DESKTOP_1280: Object.freeze({
    width: 1280,
    height: 760,
    mobile: false,
    dpr: 1,
    safeTop: 8,
    safeBottom: 0,
    query: '?safeTop=8&safeBottom=0&capsule=1&cloud=1'
  })
});

export const FEATURE_IDS = Object.freeze([
  'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08',
  'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16'
]);

export const VALID_LEVEL_IDS = Object.freeze(
  [1, 2, 3].flatMap((ch) => Array.from({ length: 10 }, (_, idx) => `${ch}-${idx + 1}`))
);

export const KEY_DEFINITIONS = Object.freeze({
  ArrowLeft:  { key: 'ArrowLeft',  code: 'ArrowLeft',  windowsVirtualKeyCode: 37 },
  ArrowUp:    { key: 'ArrowUp',    code: 'ArrowUp',    windowsVirtualKeyCode: 38 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
  ArrowDown:  { key: 'ArrowDown',  code: 'ArrowDown',  windowsVirtualKeyCode: 40 },
  Space:      { key: ' ',          code: 'Space',      windowsVirtualKeyCode: 32 },
  ' ':        { key: ' ',          code: 'Space',      windowsVirtualKeyCode: 32 },
  Escape:     { key: 'Escape',     code: 'Escape',     windowsVirtualKeyCode: 27 },
  Enter:      { key: 'Enter',      code: 'Enter',      windowsVirtualKeyCode: 13 },
  w:          { key: 'w',          code: 'KeyW',       windowsVirtualKeyCode: 87 },
  W:          { key: 'w',          code: 'KeyW',       windowsVirtualKeyCode: 87 },
  KeyW:       { key: 'w',          code: 'KeyW',       windowsVirtualKeyCode: 87 },
  a:          { key: 'a',          code: 'KeyA',       windowsVirtualKeyCode: 65 },
  A:          { key: 'a',          code: 'KeyA',       windowsVirtualKeyCode: 65 },
  KeyA:       { key: 'a',          code: 'KeyA',       windowsVirtualKeyCode: 65 },
  s:          { key: 's',          code: 'KeyS',       windowsVirtualKeyCode: 83 },
  S:          { key: 's',          code: 'KeyS',       windowsVirtualKeyCode: 83 },
  KeyS:       { key: 's',          code: 'KeyS',       windowsVirtualKeyCode: 83 },
  d:          { key: 'd',          code: 'KeyD',       windowsVirtualKeyCode: 68 },
  D:          { key: 'd',          code: 'KeyD',       windowsVirtualKeyCode: 68 },
  KeyD:       { key: 'd',          code: 'KeyD',       windowsVirtualKeyCode: 68 },
  f:          { key: 'f',          code: 'KeyF',       windowsVirtualKeyCode: 70 },
  F:          { key: 'f',          code: 'KeyF',       windowsVirtualKeyCode: 70 },
  KeyF:       { key: 'f',          code: 'KeyF',       windowsVirtualKeyCode: 70 },
  '1':        { key: '1',          code: 'Digit1',     windowsVirtualKeyCode: 49 },
  Digit1:     { key: '1',          code: 'Digit1',     windowsVirtualKeyCode: 49 },
  '2':        { key: '2',          code: 'Digit2',     windowsVirtualKeyCode: 50 },
  Digit2:     { key: '2',          code: 'Digit2',     windowsVirtualKeyCode: 50 }
});

export const RECIPE_SLOTS_MAP = Object.freeze({
  R01: [{ tier: 1, flavor: 'any' }],
  R02: [{ tier: 2, flavor: 'any' }],
  R03: [{ tier: 1, flavor: 'any' }, { tier: 2, flavor: 'any' }],
  R04: [{ tier: 3, flavor: 'any' }],
  R05: [{ tier: 2, flavor: 'any' }, { tier: 3, flavor: 'any' }],
  R06: [{ tier: 2, flavor: 'any' }, { tier: 2, flavor: 'any' }],
  R07: [{ tier: 4, flavor: 'any' }],
  R08: [{ tier: 1, flavor: 'any' }, { tier: 2, flavor: 'any' }, { tier: 3, flavor: 'any' }],
  R09: [{ tier: 3, flavor: 'any' }, { tier: 4, flavor: 'any' }],
  R10: [{ tier: 2, flavor: 'any' }, { tier: 3, flavor: 'any' }, { tier: 4, flavor: 'any' }],
  R11: [{ tier: 5, flavor: 'any' }],
  R12: [{ tier: 3, flavor: 'any' }, { tier: 5, flavor: 'any' }],
  R13: [{ tier: 2, flavor: 'any' }, { tier: 4, flavor: 'any' }, { tier: 5, flavor: 'any' }],
  R14: [{ tier: 4, flavor: 'any' }, { tier: 5, flavor: 'any' }],
  R15: [{ tier: 2, flavor: 'any' }, { tier: 3, flavor: 'matcha' }],
  R16: [{ tier: 4, flavor: 'matcha' }, { tier: 3, flavor: 'any' }],
  R17: [{ tier: 6, flavor: 'any' }],
  R18: [{ tier: 3, flavor: 'matcha' }, { tier: 6, flavor: 'any' }],
  R19: [{ tier: 4, flavor: 'any' }, { tier: 5, flavor: 'any' }, { tier: 6, flavor: 'any' }],
  R20: [{ tier: 2, flavor: 'any' }, { tier: 4, flavor: 'berry' }],
  R21: [{ tier: 7, flavor: 'any' }],
  R22: [{ tier: 5, flavor: 'berry' }, { tier: 6, flavor: 'any' }],
  R23: [{ tier: 4, flavor: 'matcha' }, { tier: 5, flavor: 'berry' }],
  R24: [{ tier: 5, flavor: 'berry' }, { tier: 6, flavor: 'matcha' }, { tier: 7, flavor: 'any' }]
});

export const V2_SHOP_COSTS = Object.freeze({
  catcake: {
    1: [20, 40, 70, 110],
    2: [25, 50, 85, 130],
    3: [35, 65, 105, 160],
    4: [45, 85, 135, 200],
    5: [60, 110, 170, 250],
    6: [80, 140, 220, 320],
    7: [100, 180, 280, 400]
  },
  device: {
    dev_tray: [60, 150],
    dev_flour: [45, 95, 170],
    dev_teapot: [50, 105, 185],
    dev_tools: [40, 90, 160]
  },
  patron: { mikan: 0, luna: 80, mugi: 120 },
  theme: { amber: 0, sakura: 80, moonlight: 120 }
});

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

export function assert(cond, msg = 'Assertion failed') {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

function stableStringify(val) {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map((item) => stableStringify(item)).join(',') + ']';
  const keys = Object.keys(val).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(val[k])).join(',') + '}';
}

export function assertEq(actual, expected, msg = '') {
  if (Object.is(actual, expected)) return;
  if (
    actual !== null &&
    expected !== null &&
    typeof actual === 'object' &&
    typeof expected === 'object' &&
    stableStringify(actual) === stableStringify(expected)
  ) {
    return;
  }
  const suffix = msg ? ` (${msg})` : '';
  throw new Error(
    `ASSERT_EQ FAILED${suffix}: expected ${stableStringify(expected)}, got ${stableStringify(actual)}`
  );
}

export function assertClose(actual, expected, tol = 1e-2, msg = '') {
  const numActual = Number(actual);
  const numExpected = Number(expected);
  const diff = Math.abs(numActual - numExpected);
  if (!Number.isFinite(numActual) || !Number.isFinite(numExpected) || diff > tol) {
    const suffix = msg ? ` (${msg})` : '';
    throw new Error(
      `ASSERT_CLOSE FAILED${suffix}: expected ${expected} ± ${tol}, got ${actual} (diff=${diff})`
    );
  }
}

export function allUnlockedStars(stars = 3) {
  const val = Math.max(0, Math.min(3, Math.floor(Number(stars) ?? 3)));
  const out = {};
  for (const id of VALID_LEVEL_IDS) {
    out[id] = val;
  }
  return out;
}

export function cellCenterPx(boardLayout, r, c) {
  assert(
    boardLayout && typeof boardLayout.gridX === 'number' && typeof boardLayout.cellSize === 'number',
    `Invalid boardLayout: ${JSON.stringify(boardLayout)}`
  );
  return {
    x: Math.round(boardLayout.gridX + (c + 0.5) * boardLayout.cellSize),
    y: Math.round(boardLayout.gridY + (r + 0.5) * boardLayout.cellSize)
  };
}

export function computeSpentStardustV2(save) {
  if (!save || typeof save !== 'object') return 0;
  let spent = 0;
  const catLevels = save.catcakeLevels || {};
  for (let t = 1; t <= 7; t++) {
    const lv = Math.max(0, Math.min(4, Math.floor(Number(catLevels[t] ?? catLevels[String(t)] ?? 0))));
    const costs = V2_SHOP_COSTS.catcake[t];
    for (let i = 0; i < lv; i++) spent += costs[i];
  }
  const devUps = save.deviceUpgrades || {};
  for (const [k, costs] of Object.entries(V2_SHOP_COSTS.device)) {
    const lv = Math.max(0, Math.min(costs.length, Math.floor(Number(devUps[k] ?? 0))));
    for (let i = 0; i < lv; i++) spent += costs[i];
  }
  const normPatron = (p) => (p === 'patron_luna' || p === 'luna' ? 'luna' : p === 'patron_mugi' || p === 'mugi' ? 'mugi' : 'mikan');
  const seenPatrons = new Set();
  for (const rawP of save.unlockedPatrons || []) {
    const pid = normPatron(rawP);
    if (!seenPatrons.has(pid)) {
      seenPatrons.add(pid);
      spent += V2_SHOP_COSTS.patron[pid] || 0;
    }
  }
  const seenThemes = new Set();
  for (const tid of save.unlockedThemes || []) {
    if (!seenThemes.has(tid) && V2_SHOP_COSTS.theme[tid] !== undefined) {
      seenThemes.add(tid);
      spent += V2_SHOP_COSTS.theme[tid];
    }
  }
  spent += Math.max(0, Math.floor(Number(save.consumableSpentStardust) || 0));
  return spent;
}

export function createCanonicalDefaultSaveV2({ seenAllTutorials = false } = {}) {
  const seen = Boolean(seenAllTutorials);
  return {
    schemaVersion: 2,
    bgmTrack: 'waltz',
    sfxEnabled: true,
    bankStardust: 30,
    totalEarnedStardust: 30,
    lastSyncedEarnedStardust: 30,
    consumableSpentStardust: 0,
    levelStars: {},
    levelBestScores: {},
    highestUnlockedLevel: '1-1',
    catcakeLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
    selectedPatron: 'mikan',
    unlockedPatrons: ['mikan'],
    equippedTheme: 'amber',
    unlockedThemes: ['amber'],
    seenTutorials: {
      intro_slide: seen,
      tray_trash: seen,
      flavor_tile: seen,
      ice_tile: seen
    },
    playerProfile: {
      nickName: '',
      avatarUrl: '',
      avatarPreset: 'mikan',
      authorized: false,
      updatedAt: 0
    },
    lifetimeStats: {
      runsPlayed: 0,
      ordersServed: 0,
      vipServed: 0,
      maxComboEver: 0,
      highestSingleServe: 0,
      totalStars: 0,
      totalCumulativeScore: 0
    },
    updatedAt: 0
  };
}

export function extractQuerySafeMetrics(queryStr = '') {
  const q = String(queryStr || '');
  const sp = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
  return {
    safeTop: sp.has('safeTop') ? Number(sp.get('safeTop')) : 20,
    safeBottom: sp.has('safeBottom') ? Number(sp.get('safeBottom')) : 0,
    showCapsule: sp.get('capsule') !== '0'
  };
}

export function formatViewportKey({
  width,
  height,
  mobile = width < 760,
  dpr = mobile ? 2 : 1,
  safeTop = 'unset',
  safeBottom = 'unset',
  showCapsule = 'unset'
} = {}) {
  return `${Math.round(width)}x${Math.round(height)}:${Boolean(mobile)}:${Number(dpr)}:${safeTop}:${safeBottom}:${showCapsule}`;
}

export function loadBundledModuleFromDisk(minigameDir = DEFAULT_MINIGAME_DIR, relPath = '') {
  const rootDir = path.resolve(minigameDir);
  const allowedPrefix = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
  const raw = String(relPath || '').trim();
  if (!raw) {
    throw new Error('requireBundledModule: relPath must be a non-empty string');
  }

  function assertInsideRoot(candidateAbs, label) {
    if (candidateAbs !== rootDir && !candidateAbs.startsWith(allowedPrefix)) {
      throw new Error(`requireBundledModule: '${label}' escapes minigameDir (${rootDir})`);
    }
  }

  function resolveJsCandidate(absBase, label) {
    assertInsideRoot(absBase, label);
    if (fs.existsSync(absBase) && fs.statSync(absBase).isFile()) {
      return absBase;
    }
    if (!absBase.endsWith('.js')) {
      const withJs = `${absBase}.js`;
      assertInsideRoot(withJs, label);
      if (fs.existsSync(withJs) && fs.statSync(withJs).isFile()) {
        return withJs;
      }
    }
    const idxJs = path.join(absBase, 'index.js');
    assertInsideRoot(idxJs, label);
    if (fs.existsSync(idxJs) && fs.statSync(idxJs).isFile()) {
      return idxJs;
    }
    return null;
  }

  const directAbs = path.resolve(rootDir, raw.startsWith('/') ? '.' + raw : raw);
  let entryFile = resolveJsCandidate(directAbs, raw);
  if (!entryFile && !raw.startsWith('./') && !raw.startsWith('../') && !raw.startsWith('src/') && !raw.startsWith('/')) {
    entryFile = resolveJsCandidate(path.resolve(rootDir, 'src', raw), raw);
  }
  if (!entryFile) {
    throw new Error(`requireBundledModule: cannot find module '${raw}' inside ${rootDir}`);
  }

  const cache = new Map();
  function execCjs(fileAbs) {
    if (cache.has(fileAbs)) {
      return cache.get(fileAbs).exports;
    }
    const code = fs.readFileSync(fileAbs, 'utf8');
    const mod = { exports: {} };
    cache.set(fileAbs, mod);
    const localRequire = (reqId) => {
      const idStr = String(reqId || '').trim();
      if (!idStr.startsWith('./') && !idStr.startsWith('../')) {
        throw new Error(`requireBundledModule: non-relative require('${idStr}') is disallowed in ${fileAbs}`);
      }
      const targetBase = path.resolve(path.dirname(fileAbs), idStr);
      const resolved = resolveJsCandidate(targetBase, idStr);
      if (!resolved) {
        throw new Error(`requireBundledModule: cannot resolve '${idStr}' from ${fileAbs}`);
      }
      return execCjs(resolved);
    };
    const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', code);
    fn(localRequire, mod, mod.exports, fileAbs, path.dirname(fileAbs));
    return mod.exports;
  }

  return execCjs(entryFile);
}

/**
 * Resolves VERIFY_OUT_DIR and CHROME_USER_DATA_DIR with strict zero-/tmp hygiene on devbox
 * and zero filesystem side effects (never calls mkdirSync).
 */
export function resolveVerifyPaths(overrides = {}) {
  const jetskiDir = '/home/antigravity/.gemini/jetski';
  const hasJetski = fs.existsSync(jetskiDir);
  const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

  let outDir;
  if (overrides.outDir) {
    outDir = path.resolve(overrides.outDir);
  } else if (process.env.VERIFY_OUT_DIR) {
    outDir = path.resolve(process.env.VERIFY_OUT_DIR);
  } else if (isGithubActions) {
    outDir = path.join(os.tmpdir(), 'minigame_verify');
  } else if (hasJetski) {
    outDir = path.join(jetskiDir, 'scratch', 'teamwork_tmp', `minigame_verify_${process.pid}`);
  } else {
    outDir = path.join(os.tmpdir(), 'minigame_verify');
  }

  let chromeRoot;
  let autoCreatedChromeRoot = false;
  if (overrides.userDataDirRoot) {
    chromeRoot = path.resolve(overrides.userDataDirRoot);
  } else if (process.env.CHROME_USER_DATA_DIR) {
    chromeRoot = path.resolve(process.env.CHROME_USER_DATA_DIR);
  } else if (hasJetski && !isGithubActions) {
    chromeRoot = path.join(jetskiDir, 'scratch', 'teamwork_tmp', 'chrome_cdp');
    autoCreatedChromeRoot = true;
  } else {
    chromeRoot = os.tmpdir();
  }

  const shortId = `${process.pid.toString(36)}_${(Date.now() % 1679616).toString(36)}`;
  const runScratchDir = path.join(chromeRoot, `r_${shortId}`);
  const nestedTmp = path.join(runScratchDir, 't');

  // Linux AF_UNIX sun_path max is 107 chars; Chrome appends '/com.google.Chrome.XXXXXX/SingletonSocket' (41 chars),
  // requiring TMPDIR <= 65 chars. Keep TMPDIR inside scratch/teamwork_tmp (never /tmp) within <= 63 chars!
  let chromeTmpDir = nestedTmp;
  let separateSocketTmpDir = null;
  if (nestedTmp.length > 64) {
    const shortBase = hasJetski && !isGithubActions
      ? path.join(jetskiDir, 'scratch', 'teamwork_tmp')
      : os.tmpdir();
    chromeTmpDir = path.join(shortBase, `ct_${shortId}`);
    separateSocketTmpDir = chromeTmpDir;
  }

  return {
    outDir,
    chromeRoot,
    autoCreatedChromeRoot,
    runScratchDir,
    separateSocketTmpDir,
    profileDir: path.join(runScratchDir, 'p'),
    chromeTmpDir,
    chromeCacheDir: path.join(runScratchDir, 'c'),
    chromeConfigDir: path.join(runScratchDir, 'g')
  };
}

export function resolveChromiumBinary() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidates.find((p) => fs.existsSync(p)) || '/usr/bin/google-chrome';
}

export function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on('error', reject);
  });
}

export function readPngHeader(absPath) {
  assert(fs.existsSync(absPath), `PNG file does not exist: ${absPath}`);
  const buf = fs.readFileSync(absPath);
  assert(buf.length >= 29, `PNG file too small (${buf.length}B): ${absPath}`);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    assert(buf[i] === sig[i], `Invalid PNG signature byte ${i} in ${absPath}`);
  }
  const chunkType = buf.subarray(12, 16).toString('ascii');
  assert(chunkType === 'IHDR', `Expected IHDR chunk first in PNG ${absPath}, got ${chunkType}`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
    bytes: buf.length
  };
}

export function readJpegHeader(absPath) {
  assert(fs.existsSync(absPath), `JPEG file does not exist: ${absPath}`);
  const buf = fs.readFileSync(absPath);
  assert(buf.length >= 16, `JPEG file too small (${buf.length}B): ${absPath}`);
  assert(buf[0] === 0xff && buf[1] === 0xd8, `Invalid JPEG SOI marker in ${absPath}`);

  let pos = 2;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) {
      pos++;
      continue;
    }
    while (pos < buf.length && buf[pos] === 0xff) pos++;
    if (pos >= buf.length) break;
    const marker = buf[pos];
    pos++;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    assert(pos + 2 <= buf.length, `Truncated JPEG segment in ${absPath}`);
    const segLen = buf.readUInt16BE(pos);
    assert(segLen >= 2 && pos + segLen <= buf.length, `Invalid JPEG segment length ${segLen} in ${absPath}`);
    // SOF0 (baseline), SOF1 (extended sequential), SOF2 (progressive), SOF3 (lossless)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3) {
      assert(segLen >= 8, `Truncated SOF segment in ${absPath}`);
      const precision = buf[pos + 2];
      const height = buf.readUInt16BE(pos + 3);
      const width = buf.readUInt16BE(pos + 5);
      const components = buf[pos + 7];
      return { width, height, precision, components, bytes: buf.length };
    }
    pos += segLen;
  }
  throw new Error(`No SOF0..SOF3 marker found in JPEG ${absPath}`);
}

export function computePackageStats(minigameDir = DEFAULT_MINIGAME_DIR) {
  const clientFiles = [];
  const externalAudioFiles = [];
  const legacyAssetFiles = [];
  const legacySrcFiles = [];
  let clientTotalBytes = 0;

  const LEGACY_ASSET_RE = /^(tier_[1-9](_act|_int)?\.png|title_hero\.jpg|event_yarn_ball\.png|tool_shake\.png|physics_shapes\.json|sprites_meta\.json)$/;
  const LEGACY_SRC_SET = new Set(['physics.js', 'physics_shapes.js', 'jar_renderer.js']);
  const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i;

  function walk(dir, relPrefix = '') {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      if (name === '.DS_Store' || name.startsWith('.git')) continue;
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const full = path.join(dir, name);
      if (entry.isDirectory()) {
        if (rel === 'cloudfunctions' || name === 'node_modules') continue;
        walk(full, rel);
      } else if (entry.isFile()) {
        if (rel === 'cloudbaserc.json' || rel === 'project.private.config.json' || name.endsWith('.md')) {
          continue;
        }
        const sz = fs.statSync(full).size;
        clientTotalBytes += sz;
        clientFiles.push({ path: rel, bytes: sz });
        if (AUDIO_EXT_RE.test(name)) externalAudioFiles.push(rel);
        if (relPrefix === 'assets' && LEGACY_ASSET_RE.test(name)) legacyAssetFiles.push(rel);
        if (relPrefix === 'src' && LEGACY_SRC_SET.has(name)) legacySrcFiles.push(rel);
      }
    }
  }

  walk(minigameDir, '');
  const assetsDir = path.join(minigameDir, 'assets');
  const assetsDirFiles = fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).filter((f) => !f.startsWith('.')).sort()
    : [];

  return {
    clientTotalBytes,
    totalBytes: clientTotalBytes,
    clientBytes: clientTotalBytes,
    bytes: clientTotalBytes,
    clientFilesCount: clientFiles.length,
    clientFiles,
    externalAudioFiles,
    legacyAssetFiles,
    legacySrcFiles,
    assetsDirFiles
  };
}

// ============================================================================
// In-Memory `wx-server-sdk` Database & Real `cloudfunctions/kissa_sync` Host
// ============================================================================

function getByPath(obj, fieldPath) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, fieldPath)) return obj[fieldPath];
  const parts = String(fieldPath).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function setByPath(obj, fieldPath, val, isSetOp = false, isRemoveOp = false) {
  const parts = String(fieldPath).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (isRemoveOp) {
    delete cur[last];
  } else if (isSetOp) {
    cur[last] = structuredClone(val);
  } else {
    cur[last] = val;
  }
}

function makeQueryCmd(op, val) {
  return {
    __wxCmd: 'query',
    op,
    val,
    and(other) {
      return makeQueryCmd('and', [this, other]);
    },
    or(other) {
      return makeQueryCmd('or', [this, other]);
    }
  };
}

function makeUpdateCmd(op, val) {
  return { __wxCmd: 'update', op, val };
}

function evalFieldCond(actual, cond) {
  if (cond && typeof cond === 'object' && cond.__wxCmd === 'query') {
    switch (cond.op) {
      case 'eq': return actual === cond.val;
      case 'neq': return actual !== cond.val;
      case 'gt': return typeof actual === 'number' && actual > cond.val;
      case 'gte': return typeof actual === 'number' && actual >= cond.val;
      case 'lt': return typeof actual === 'number' && actual < cond.val;
      case 'lte': return typeof actual === 'number' && actual <= cond.val;
      case 'in': return Array.isArray(cond.val) && cond.val.includes(actual);
      case 'nin': return Array.isArray(cond.val) && !cond.val.includes(actual);
      case 'exists': return cond.val ? actual !== undefined : actual === undefined;
      case 'not': return !evalFieldCond(actual, cond.val);
      case 'and': return cond.val.every((sub) => evalFieldCond(actual, sub));
      case 'or': return cond.val.some((sub) => evalFieldCond(actual, sub));
      default: return false;
    }
  }
  if (cond instanceof RegExp) {
    return typeof actual === 'string' && cond.test(actual);
  }
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    return Object.entries(cond).every(([k, v]) => evalFieldCond(actual ? actual[k] : undefined, v));
  }
  return actual === cond;
}

function evalDocWhere(doc, whereCond) {
  if (!whereCond || typeof whereCond !== 'object') return true;
  if (whereCond.__wxCmd === 'query') {
    if (whereCond.op === 'and') return whereCond.val.every((c) => evalDocWhere(doc, c));
    if (whereCond.op === 'or') return whereCond.val.some((c) => evalDocWhere(doc, c));
  }
  return Object.entries(whereCond).every(([fieldPath, expected]) => {
    const actual = getByPath(doc, fieldPath);
    return evalFieldCond(actual, expected);
  });
}

function resolveMutationValue(prevVal, spec) {
  if (spec && typeof spec === 'object') {
    if (spec.__serverDate) {
      return { mode: 'assign', val: Date.now() + (Number(spec.offset) || 0) };
    }
    if (spec.__wxCmd === 'update') {
      switch (spec.op) {
        case 'set': return { mode: 'set', val: structuredClone(spec.val) };
        case 'remove': return { mode: 'remove' };
        case 'inc': return { mode: 'assign', val: (Number(prevVal) || 0) + (Number(spec.val) || 0) };
        case 'mul': return { mode: 'assign', val: (Number(prevVal) || 0) * (Number(spec.val) || 0) };
        case 'push': {
          const arr = Array.isArray(prevVal) ? [...prevVal] : [];
          const items = Array.isArray(spec.val) ? spec.val : [spec.val];
          arr.push(...structuredClone(items));
          return { mode: 'assign', val: arr };
        }
        case 'unshift': {
          const arr = Array.isArray(prevVal) ? [...prevVal] : [];
          const items = Array.isArray(spec.val) ? spec.val : [spec.val];
          arr.unshift(...structuredClone(items));
          return { mode: 'assign', val: arr };
        }
        case 'pop': {
          const arr = Array.isArray(prevVal) ? [...prevVal] : [];
          arr.pop();
          return { mode: 'assign', val: arr };
        }
        case 'shift': {
          const arr = Array.isArray(prevVal) ? [...prevVal] : [];
          arr.shift();
          return { mode: 'assign', val: arr };
        }
        default:
          return { mode: 'assign', val: structuredClone(spec.val) };
      }
    }
    if (!Array.isArray(spec)) {
      const nextObj = prevVal && typeof prevVal === 'object' && !Array.isArray(prevVal)
        ? structuredClone(prevVal)
        : {};
      for (const [k, v] of Object.entries(spec)) {
        const sub = resolveMutationValue(nextObj[k], v);
        if (sub.mode === 'remove') delete nextObj[k];
        else nextObj[k] = sub.val;
      }
      return { mode: 'assign', val: nextObj };
    }
  }
  return { mode: 'assign', val: structuredClone(spec) };
}

function applyUpdatePatch(targetDoc, patchData, replaceRoot = false) {
  const base = replaceRoot ? { _id: targetDoc._id } : structuredClone(targetDoc);
  for (const [fieldPath, spec] of Object.entries(patchData || {})) {
    if (fieldPath === '_id') continue;
    const prev = getByPath(base, fieldPath);
    const mut = resolveMutationValue(prev, spec);
    if (mut.mode === 'remove') setByPath(base, fieldPath, undefined, false, true);
    else if (mut.mode === 'set') setByPath(base, fieldPath, mut.val, true, false);
    else setByPath(base, fieldPath, mut.val, false, false);
  }
  base._id = targetDoc._id;
  return base;
}

export function createCloudSdkStore({ minigameDir = DEFAULT_MINIGAME_DIR } = {}) {
  const collections = new Map();
  collections.set('players', new Map());

  const state = {
    openid: 'test_player_openid_88a6',
    appid: 'wx923bf8440b65a1af',
    env: 'dev-d0ggz3zx89d349af3',
    exhaustRevisionLock: false,
    autoIdSeq: 1,
    callCount: 0,
    lastCall: null,
    callLog: []
  };

  function getCol(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }

  const command = {
    eq: (v) => makeQueryCmd('eq', v),
    neq: (v) => makeQueryCmd('neq', v),
    gt: (v) => makeQueryCmd('gt', v),
    gte: (v) => makeQueryCmd('gte', v),
    lt: (v) => makeQueryCmd('lt', v),
    lte: (v) => makeQueryCmd('lte', v),
    in: (arr) => makeQueryCmd('in', Array.isArray(arr) ? arr : []),
    nin: (arr) => makeQueryCmd('nin', Array.isArray(arr) ? arr : []),
    exists: (b) => makeQueryCmd('exists', !!b),
    not: (c) => makeQueryCmd('not', c),
    and: (...args) => makeQueryCmd('and', args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
    or: (...args) => makeQueryCmd('or', args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
    set: (v) => makeUpdateCmd('set', v),
    remove: () => makeUpdateCmd('remove', undefined),
    inc: (n) => makeUpdateCmd('inc', n),
    mul: (n) => makeUpdateCmd('mul', n),
    push: (v) => makeUpdateCmd('push', v),
    pop: () => makeUpdateCmd('pop', undefined),
    shift: () => makeUpdateCmd('shift', undefined),
    unshift: (v) => makeUpdateCmd('unshift', v)
  };

  function buildQuery(colName, querySpec = {}) {
    const wheres = querySpec.wheres || [];
    const orders = querySpec.orders || [];
    const skipNum = querySpec.skipNum || 0;
    const limitNum = querySpec.limitNum ?? 100;
    const fields = querySpec.fields || null;

    function matchAll() {
      const col = getCol(colName);
      const matched = [];
      for (const doc of col.values()) {
        if (wheres.every((w) => evalDocWhere(doc, w))) {
          matched.push(doc);
        }
      }
      if (orders.length > 0) {
        matched.sort((a, b) => {
          for (const { field, dir } of orders) {
            const va = getByPath(a, field);
            const vb = getByPath(b, field);
            if (va === vb) continue;
            if (va === undefined || va === null) return dir === 'asc' ? -1 : 1;
            if (vb === undefined || vb === null) return dir === 'asc' ? 1 : -1;
            const cmp = va < vb ? -1 : 1;
            return dir === 'asc' ? cmp : -cmp;
          }
          return 0;
        });
      }
      return matched;
    }

    return {
      where(cond) {
        return buildQuery(colName, { wheres: [...wheres, cond], orders, skipNum, limitNum, fields });
      },
      orderBy(field, dir = 'asc') {
        const normDir = String(dir).toLowerCase() === 'desc' ? 'desc' : 'asc';
        return buildQuery(colName, { wheres, orders: [...orders, { field, dir: normDir }], skipNum, limitNum, fields });
      },
      skip(n) {
        return buildQuery(colName, { wheres, orders, skipNum: Math.max(0, Number(n) || 0), limitNum, fields });
      },
      limit(n) {
        return buildQuery(colName, { wheres, orders, skipNum, limitNum: Math.max(0, Number(n) || 0), fields });
      },
      field(proj) {
        return buildQuery(colName, { wheres, orders, skipNum, limitNum, fields: proj });
      },
      async count() {
        return { total: matchAll().length };
      },
      async get() {
        const sliced = matchAll().slice(skipNum, skipNum + limitNum);
        const projected = sliced.map((doc) => {
          const copy = structuredClone(doc);
          if (!fields) return copy;
          const out = { _id: copy._id };
          for (const [k, keep] of Object.entries(fields)) {
            if (keep && copy[k] !== undefined) out[k] = copy[k];
          }
          return out;
        });
        return { data: projected };
      },
      async update({ data } = {}) {
        if (state.exhaustRevisionLock && wheres.some((w) => w && Object.prototype.hasOwnProperty.call(w, 'revision'))) {
          return { stats: { updated: 0 } };
        }
        const col = getCol(colName);
        const matched = matchAll();
        for (const doc of matched) {
          col.set(doc._id, applyUpdatePatch(doc, data || {}, false));
        }
        return { stats: { updated: matched.length } };
      },
      async remove() {
        const col = getCol(colName);
        const matched = matchAll();
        for (const doc of matched) col.delete(doc._id);
        return { stats: { removed: matched.length } };
      }
    };
  }

  const wxServerSdk = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init(opts = {}) {
      if (opts && typeof opts.env === 'string' && opts.env !== 'test-env') {
        state.env = opts.env;
      }
    },
    getWXContext() {
      return {
        OPENID: state.openid,
        APPID: state.appid,
        ENV: state.env
      };
    },
    database() {
      return {
        command,
        serverDate: (opts = {}) => ({ __serverDate: true, offset: (opts && opts.offset) || 0 }),
        RegExp: ({ regexp, options } = {}) => new RegExp(regexp || '', options || ''),
        async createCollection(name) {
          getCol(name);
          return { errMsg: 'createCollection:ok' };
        },
        collection(colName) {
          const baseQ = buildQuery(colName);
          return {
            ...baseQ,
            doc(id) {
              const docId = String(id);
              return {
                async get() {
                  const col = getCol(colName);
                  if (!col.has(docId)) {
                    const err = new Error(`document.get:fail document ${docId} does not exist`);
                    err.errCode = -1;
                    throw err;
                  }
                  return { data: structuredClone(col.get(docId)) };
                },
                async set({ data } = {}) {
                  const col = getCol(colName);
                  const existed = col.has(docId);
                  const nextDoc = applyUpdatePatch({ _id: docId }, data || {}, true);
                  col.set(docId, nextDoc);
                  return { _id: docId, stats: { updated: existed ? 1 : 0, created: existed ? 0 : 1 } };
                },
                async update({ data } = {}) {
                  const col = getCol(colName);
                  if (!col.has(docId)) return { stats: { updated: 0 } };
                  const nextDoc = applyUpdatePatch(col.get(docId), data || {}, false);
                  col.set(docId, nextDoc);
                  return { stats: { updated: 1 } };
                },
                async remove() {
                  const col = getCol(colName);
                  const existed = col.delete(docId);
                  return { stats: { removed: existed ? 1 : 0 } };
                }
              };
            },
            async add({ data } = {}) {
              const col = getCol(colName);
              const docId = (data && data._id) ? String(data._id) : `doc_${state.autoIdSeq++}`;
              const nextDoc = applyUpdatePatch({ _id: docId }, data || {}, true);
              col.set(docId, nextDoc);
              return { _id: docId };
            }
          };
        }
      };
    }
  };

  let cachedModule = null;
  let cachedMtimeMs = -1;

  function loadKissaSyncExports() {
    const entryFile = path.join(minigameDir, 'cloudfunctions', 'kissa_sync', 'index.js');
    const stat = fs.statSync(entryFile);
    if (cachedModule && stat.mtimeMs === cachedMtimeMs) {
      return cachedModule;
    }
    const code = fs.readFileSync(entryFile, 'utf8');
    const nodeReq = createRequire(entryFile);
    const mod = { exports: {} };
    const customReq = (id) => {
      if (id === 'wx-server-sdk') return wxServerSdk;
      return nodeReq(id);
    };
    const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', code);
    fn(customReq, mod, mod.exports, entryFile, path.dirname(entryFile));
    cachedModule = mod.exports;
    cachedMtimeMs = stat.mtimeMs;
    return cachedModule;
  }

  async function invokeKissaSync(event = {}) {
    const prevOpenId = state.openid;
    if (event && typeof event.__openid === 'string' && event.__openid) {
      state.openid = event.__openid;
    }
    try {
      const exp = loadKissaSyncExports();
      const res = await exp.main(event, {});
      state.callCount++;
      const entry = {
        action: (event && event.action) || 'pull',
        ok: !!(res && res.ok),
        revision: res && res.revision,
        ts: Date.now()
      };
      state.lastCall = entry;
      state.callLog.push(entry);
      if (state.callLog.length > 50) state.callLog.shift();
      return res;
    } finally {
      state.openid = prevOpenId;
    }
  }

  function handleAdmin(cmd = {}) {
    const action = cmd.action || 'inspect';
    const players = getCol('players');

    if (action === 'reset' || cmd.reset === true) {
      players.clear();
      state.openid = 'test_player_openid_88a6';
      state.exhaustRevisionLock = false;
      state.callCount = 0;
      state.lastCall = null;
      state.callLog.length = 0;
    }

    if (typeof cmd.openid === 'string' && cmd.openid.trim()) {
      state.openid = cmd.openid.trim();
    }
    if (typeof cmd.exhaustRevisionLock === 'boolean') {
      state.exhaustRevisionLock = cmd.exhaustRevisionLock;
    }

    if (cmd.seedCloudDoc !== undefined) {
      if (cmd.seedCloudDoc === null) {
        players.delete(state.openid);
      } else {
        const raw = structuredClone(cmd.seedCloudDoc);
        const docId = state.openid;
        const suffix = raw.openidSuffix || docId.slice(-4).toUpperCase();
        // If caller passed a bare save object (v1 or v2) rather than a full cloud doc wrapper, wrap or preserve appropriately:
        const isWrappedDoc = Object.prototype.hasOwnProperty.call(raw, 'metaSave') || Object.prototype.hasOwnProperty.call(raw, 'revision');
        if (isWrappedDoc) {
          const doc = {
            _id: docId,
            openidSuffix: suffix,
            revision: raw.revision || 1,
            ...raw
          };
          if (doc.metaSave && doc.metaSave.schemaVersion >= 2) {
            if (doc.totalStars === undefined) {
              doc.totalStars = Object.values(doc.metaSave.levelStars || {}).reduce((s, v) => s + (Number(v) || 0), 0);
            }
            if (doc.totalCumulativeScore === undefined) {
              doc.totalCumulativeScore = Object.values(doc.metaSave.levelBestScores || {}).reduce((s, v) => s + (Number(v) || 0), 0);
            }
          }
          players.set(docId, doc);
        } else {
          const isV2 = raw.schemaVersion >= 2;
          const totalStars = isV2
            ? Object.values(raw.levelStars || {}).reduce((s, v) => s + (Number(v) || 0), 0)
            : Number(raw.totalStars || 0);
          const totalCumulativeScore = isV2
            ? Object.values(raw.levelBestScores || {}).reduce((s, v) => s + (Number(v) || 0), 0)
            : Number(raw.totalCumulativeScore || 0);
          players.set(docId, {
            _id: docId,
            openidSuffix: suffix,
            profile: raw.playerProfile || raw.profile || {
              nickName: `星夜店长#${suffix}`,
              avatarUrl: '',
              avatarPreset: 'mikan',
              authorized: false,
              updatedAt: 0
            },
            totalStars,
            totalCumulativeScore,
            bestChef: Number(raw.bestChef || 0),
            bestRush: Number(raw.bestRush || 0),
            bestZen: Number(raw.bestZen || 0),
            metaSave: raw,
            activeRun: raw.activeRun || null,
            revision: Number(raw.revision || 1),
            updatedAt: Date.now()
          });
        }
      }
    }

    if (Array.isArray(cmd.seedRivals)) {
      for (const k of Array.from(players.keys())) {
        if (k !== state.openid) players.delete(k);
      }
      cmd.seedRivals.forEach((r, idx) => {
        const rid = String(r.id || r._id || `rival_${idx + 1}`);
        const stars = Number(r.totalStars ?? r.stars ?? 0);
        const score = Number(r.totalCumulativeScore ?? r.totalScore ?? r.score ?? 0);
        players.set(rid, {
          _id: rid,
          openidSuffix: r.openidSuffix || String(1000 + idx),
          isNpc: !!r.isNpc,
          profile: r.profile || {
            nickName: r.nickName || `甜点店长#${idx + 1}`,
            avatarUrl: r.avatarUrl || '',
            avatarPreset: r.avatarPreset || 'mikan',
            authorized: true,
            updatedAt: Date.now()
          },
          totalStars: stars,
          totalCumulativeScore: score,
          bestChef: score,
          metaSave: r.metaSave || {
            schemaVersion: 2,
            levelStars: {},
            levelBestScores: {},
            lifetimeStats: { totalStars: stars, totalCumulativeScore: score }
          },
          revision: 1,
          updatedAt: Date.now()
        });
      });
    }

    if (action === 'bumpRevision' || cmd.bumpRevision) {
      const bumpOpts = typeof cmd.bumpRevision === 'object' && cmd.bumpRevision ? cmd.bumpRevision : cmd;
      const cur = players.get(state.openid) || {
        _id: state.openid,
        openidSuffix: state.openid.slice(-4).toUpperCase(),
        profile: { nickName: `星夜店长#${state.openid.slice(-4).toUpperCase()}`, avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: Date.now() },
        totalStars: 0,
        totalCumulativeScore: 0,
        metaSave: { schemaVersion: 2, bankStardust: 30, totalEarnedStardust: 30, lastSyncedEarnedStardust: 30, levelStars: {}, levelBestScores: {} },
        revision: 1
      };
      cur.revision = (cur.revision || 1) + (Number(bumpOpts.delta) || 1);
      if (bumpOpts.levelStars && cur.metaSave) {
        cur.metaSave.levelStars = { ...(cur.metaSave.levelStars || {}), ...bumpOpts.levelStars };
        cur.totalStars = Object.values(cur.metaSave.levelStars).reduce((s, v) => s + (Number(v) || 0), 0);
      }
      if (bumpOpts.levelBestScores && cur.metaSave) {
        cur.metaSave.levelBestScores = { ...(cur.metaSave.levelBestScores || {}), ...bumpOpts.levelBestScores };
        cur.totalCumulativeScore = Object.values(cur.metaSave.levelBestScores).reduce((s, v) => s + (Number(v) || 0), 0);
      }
      if (bumpOpts.metaSavePatch && cur.metaSave) {
        cur.metaSave = { ...cur.metaSave, ...bumpOpts.metaSavePatch };
      }
      cur.updatedAt = Date.now();
      players.set(state.openid, cur);
    }

    const playerDoc = players.has(state.openid) ? structuredClone(players.get(state.openid)) : null;
    return {
      ok: true,
      openid: state.openid,
      exhaustRevisionLock: state.exhaustRevisionLock,
      playerDoc,
      totalDocs: players.size,
      rivalsCount: players.size - (playerDoc ? 1 : 0),
      callCount: state.callCount,
      lastCall: state.lastCall,
      callLog: [...state.callLog]
    };
  }

  return {
    wxServerSdk,
    invokeKissaSync,
    handleAdmin,
    state,
    collections
  };
}

// ============================================================================
// Browser `window.__WX_HARNESS__` & `window.wx` Shim (`buildWxShimScript`)
// ============================================================================

export function buildWxShimScript({ defaultUseBuiltInMock = false } = {}) {
  return `(function () {
  const params = new URLSearchParams(location.search);
  let safeTop = Number(params.get('safeTop') !== null ? params.get('safeTop') : 20);
  let safeBottom = Number(params.get('safeBottom') !== null ? params.get('safeBottom') : 0);
  let showCapsule = params.get('capsule') !== '0';
  const audioMode = params.get('audio') || 'default';
  const stripAudioNodes = params.get('stripAudioNodes') === '1';
  const cloudDisabled = params.get('cloud') === '0';

  // 1. Virtual clock offset for deterministic dual-clock stepping
  const origDateNow = Date.now.bind(Date);
  const origPerfNow = performance.now.bind(performance);
  let clockOffsetMs = 0;
  Date.now = function () { return origDateNow() + Math.round(clockOffsetMs); };
  performance.now = function () { return origPerfNow() + clockOffsetMs; };

  // 2. Immediate iOS CanvasGradient hsl()/hsla() guard
  const gradientStats = { totalStops: 0, hslViolations: [] };
  if (typeof CanvasGradient !== 'undefined' && CanvasGradient.prototype && !CanvasGradient.prototype.__hoshiIosColorGuard) {
    const origAddColorStop = CanvasGradient.prototype.addColorStop;
    Object.defineProperty(CanvasGradient.prototype, '__hoshiIosColorGuard', { value: true });
    CanvasGradient.prototype.addColorStop = function (offset, color) {
      gradientStats.totalStops++;
      if (typeof color === 'string') {
        const norm = color.trim().toLowerCase();
        if (norm.startsWith('hsl(') || norm.startsWith('hsla(')) {
          gradientStats.hslViolations.push({ offset, color: String(color) });
          throw new SyntaxError('iOS WeChat Canvas2D rejects hsl()/hsla() color stops: ' + color);
        }
      }
      return origAddColorStop.call(this, offset, color);
    };
  }

  // 3. Immediate Canvas2D Native Color Emoji Guard (catches Emoji_Presentation & VS16 color emojis; allows ★ ☆ ✓ × BMP symbols)
  const emojiStats = { totalCalls: 0, violations: [] };
  const EMOJI_RE = /\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F/u;
  function installEmojiSpy(proto) {
    if (!proto || proto.__hoshiEmojiGuard) return;
    Object.defineProperty(proto, '__hoshiEmojiGuard', { value: true });
    for (const method of ['fillText', 'strokeText']) {
      if (typeof proto[method] !== 'function') continue;
      const orig = proto[method];
      proto[method] = function (text, ...rest) {
        emojiStats.totalCalls++;
        const s = String(text ?? '');
        if (EMOJI_RE.test(s)) {
          emojiStats.violations.push({ method, text: s.slice(0, 80) });
        }
        return orig.call(this, text, ...rest);
      };
    }
  }
  if (typeof CanvasRenderingContext2D !== 'undefined') installEmojiSpy(CanvasRenderingContext2D.prototype);
  if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') installEmojiSpy(OffscreenCanvasRenderingContext2D.prototype);

  // 4. WebAudio & External HTMLAudioElement Spy
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext || null;
  if (audioMode === 'none') {
    try { window.AudioContext = undefined; } catch (_) {}
    try { window.webkitAudioContext = undefined; } catch (_) {}
    try { window.OfflineAudioContext = undefined; } catch (_) {}
  }

  let latestAudioCtx = null;
  const audioStats = {
    convolverSupported: false,
    convolverAttempted: false,
    convolverMissingFallbackUsed: false,
    contextsCreated: 0,
    delaysCreated: 0,
    delayTimesObserved: [],
    compressorsCreated: 0,
    filtersCreated: 0,
    gainsCreated: 0,
    oscillatorsCreated: 0,
    oscillatorsStarted: 0,
    bufferSourcesCreated: 0,
    bufferSourcesStarted: 0,
    lowpassLastTargetHz: null,
    lowpassMinTargetHz: null,
    lastFilterFreqs: [],
    gainTargets: [],
    recentOscTypes: [],
    recentFrequencies: [],
    resumeCalls: 0,
    suspendCalls: 0,
    externalAudioElements: 0
  };

  let seenExternalAudioNodes = new WeakSet();

  function isExternalAudioSrc(s) {
    if (typeof s !== 'string') return false;
    const trimmed = s.trim();
    if (trimmed.length === 0) return false;
    return !trimmed.toLowerCase().startsWith('data:');
  }

  function checkExternalAudioSrc(s, node = null) {
    if (isExternalAudioSrc(s)) {
      if (node && typeof node === 'object') {
        seenExternalAudioNodes.add(node);
      }
      audioStats.externalAudioElements++;
    }
  }

  function scanAudioContainer(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    let nodes = [];
    try {
      nodes = root.querySelectorAll('audio, source');
    } catch (_) {
      return;
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || seenExternalAudioNodes.has(n)) continue;
      const tag = n.tagName ? String(n.tagName).toUpperCase() : '';
      if (tag === 'SOURCE') {
        const pTag = n.parentElement && n.parentElement.tagName ? String(n.parentElement.tagName).toUpperCase() : '';
        if (pTag && pTag !== 'AUDIO') continue;
      } else if (tag !== 'AUDIO') {
        continue;
      }
      const attrSrc = typeof n.getAttribute === 'function' ? n.getAttribute('src') : null;
      const effSrc = attrSrc !== null && attrSrc !== undefined ? attrSrc : (typeof n.src === 'string' ? n.src : '');
      if (isExternalAudioSrc(effSrc)) {
        seenExternalAudioNodes.add(n);
        audioStats.externalAudioElements++;
      }
    }
  }

  function resetAudioStats() {
    audioStats.oscillatorsCreated = 0;
    audioStats.oscillatorsStarted = 0;
    audioStats.bufferSourcesCreated = 0;
    audioStats.bufferSourcesStarted = 0;
    audioStats.gainsCreated = 0;
    audioStats.filtersCreated = 0;
    audioStats.gainTargets.length = 0;
    audioStats.recentOscTypes.length = 0;
    audioStats.recentFrequencies.length = 0;
    audioStats.lastFilterFreqs.length = 0;
    audioStats.resumeCalls = 0;
    audioStats.suspendCalls = 0;
    audioStats.externalAudioElements = 0;
    seenExternalAudioNodes = new WeakSet();
    return getAudioStats();
  }
  audioStats.resetCounts = resetAudioStats;

  function getAudioStats() {
    if (typeof document !== 'undefined') {
      scanAudioContainer(document);
    }
    const snap = {
      ...audioStats,
      delayTimesObserved: [...audioStats.delayTimesObserved],
      lastFilterFreqs: [...audioStats.lastFilterFreqs],
      gainTargets: [...audioStats.gainTargets],
      recentOscTypes: [...audioStats.recentOscTypes],
      recentFrequencies: [...audioStats.recentFrequencies],
      contextState: latestAudioCtx ? latestAudioCtx.state : 'none'
    };
    return snap;
  }

  function recordDelayTime(sec) {
    const rounded = Math.round((Number(sec) || 0) * 1000) / 1000;
    if (rounded > 0 && !audioStats.delayTimesObserved.includes(rounded)) {
      audioStats.delayTimesObserved.push(rounded);
    }
    if (!audioStats.convolverSupported && audioStats.delaysCreated >= 3) {
      audioStats.convolverMissingFallbackUsed = true;
    }
  }

  function wrapAudioParamSetter(param, onVal) {
    if (!param || param.__hoshiWrapped) return;
    Object.defineProperty(param, '__hoshiWrapped', { value: true });
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
      if (typeof param[m] !== 'function') continue;
      const orig = param[m].bind(param);
      param[m] = function (val, ...rest) {
        onVal(Number(val), m);
        return orig(val, ...rest);
      };
    }
    const proto = Object.getPrototypeOf(param);
    const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
    if (desc && desc.set && desc.get) {
      Object.defineProperty(param, 'value', {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) {
          onVal(Number(v), 'value');
          return desc.set.call(this, v);
        }
      });
    }
  }

  function instrumentAudioContext(ctx) {
    if (!ctx || ctx.__hoshiInstrumented) return ctx;
    Object.defineProperty(ctx, '__hoshiInstrumented', { value: true });
    latestAudioCtx = ctx;
    audioStats.contextsCreated++;

    try {
      Object.defineProperty(ctx, 'createConvolver', {
        configurable: true,
        get() {
          audioStats.convolverAttempted = true;
          return undefined;
        }
      });
    } catch (_) {}

    if (stripAudioNodes) {
      try { Object.defineProperty(ctx, 'createDynamicsCompressor', { configurable: true, value: undefined }); } catch (_) {}
      try { Object.defineProperty(ctx, 'createStereoPanner', { configurable: true, value: undefined }); } catch (_) {}
    }

    if (typeof ctx.createDelay === 'function') {
      const origDelay = ctx.createDelay.bind(ctx);
      ctx.createDelay = function (...args) {
        audioStats.delaysCreated++;
        if (!audioStats.convolverSupported && audioStats.delaysCreated >= 3) {
          audioStats.convolverMissingFallbackUsed = true;
        }
        const node = origDelay(...args);
        wrapAudioParamSetter(node.delayTime, (v) => recordDelayTime(v));
        return node;
      };
    }

    if (typeof ctx.createDynamicsCompressor === 'function') {
      const origComp = ctx.createDynamicsCompressor.bind(ctx);
      ctx.createDynamicsCompressor = function (...args) {
        audioStats.compressorsCreated++;
        return origComp(...args);
      };
    }

    if (typeof ctx.createGain === 'function') {
      const origGain = ctx.createGain.bind(ctx);
      ctx.createGain = function (...args) {
        const gainIndex = audioStats.gainsCreated++;
        const node = origGain(...args);
        wrapAudioParamSetter(node.gain, (target, method) => {
          audioStats.gainTargets.push({ gainIndex, target, method });
          if (audioStats.gainTargets.length > 32) audioStats.gainTargets.shift();
        });
        return node;
      };
    }

    let ctxFilterSeq = 0;
    if (typeof ctx.createBiquadFilter === 'function') {
      const origFilter = ctx.createBiquadFilter.bind(ctx);
      ctx.createBiquadFilter = function (...args) {
        const filterIdx = ctxFilterSeq++;
        audioStats.filtersCreated++;
        const node = origFilter(...args);
        let isToneFilter = filterIdx === 0;
        wrapAudioParamSetter(node.frequency, (hz, method) => {
          if (hz === 580 || hz === 12500) isToneFilter = true;
          if (node.type === 'lowpass' && isToneFilter) {
            if (method === 'setValueAtTime' && hz !== 580 && hz !== 12500 && audioStats.lowpassLastTargetHz !== null) {
              return;
            }
            const rounded = Math.round(hz * 100) / 100;
            audioStats.lowpassLastTargetHz = rounded;
            audioStats.lowpassMinTargetHz = audioStats.lowpassMinTargetHz === null
              ? rounded
              : Math.min(audioStats.lowpassMinTargetHz, rounded);
            audioStats.lastFilterFreqs.push(rounded);
            if (audioStats.lastFilterFreqs.length > 32) audioStats.lastFilterFreqs.shift();
          }
        });
        return node;
      };
    }

    if (typeof ctx.createOscillator === 'function') {
      const origOsc = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = function (...args) {
        audioStats.oscillatorsCreated++;
        const osc = origOsc(...args);
        const origStart = osc.start.bind(osc);
        osc.start = function (...sArgs) {
          audioStats.oscillatorsStarted++;
          audioStats.recentOscTypes.push(osc.type || 'sine');
          if (audioStats.recentOscTypes.length > 32) audioStats.recentOscTypes.shift();
          const f = Math.round((Number(osc.frequency && osc.frequency.value) || 0) * 100) / 100;
          audioStats.recentFrequencies.push(f);
          if (audioStats.recentFrequencies.length > 32) audioStats.recentFrequencies.shift();
          return origStart(...sArgs);
        };
        return osc;
      };
    }

    if (typeof ctx.createBufferSource === 'function') {
      const origBufSrc = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = function (...args) {
        audioStats.bufferSourcesCreated++;
        const src = origBufSrc(...args);
        const origStart = src.start.bind(src);
        src.start = function (...sArgs) {
          audioStats.bufferSourcesStarted++;
          return origStart(...sArgs);
        };
        return src;
      };
    }

    if (typeof ctx.resume === 'function') {
      const origResume = ctx.resume.bind(ctx);
      ctx.resume = function (...args) {
        audioStats.resumeCalls++;
        return origResume(...args);
      };
    }
    if (typeof ctx.suspend === 'function') {
      const origSuspend = ctx.suspend.bind(ctx);
      ctx.suspend = function (...args) {
        audioStats.suspendCalls++;
        return origSuspend(...args);
      };
    }
    return ctx;
  }

  if (audioMode !== 'none' && NativeAudioContext) {
    const WrappedAC = function (...args) {
      return instrumentAudioContext(new NativeAudioContext(...args));
    };
    WrappedAC.prototype = NativeAudioContext.prototype;
    window.AudioContext = WrappedAC;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAC;
  }

  if (!window.__hoshiExternalAudioGuardInstalled) {
    Object.defineProperty(window, '__hoshiExternalAudioGuardInstalled', { value: true });
    let inAudioCtor = false;
    const mediaSrcDesc = typeof HTMLMediaElement !== 'undefined'
      ? Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
      : null;
    const sourceSrcDesc = typeof HTMLSourceElement !== 'undefined'
      ? Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src')
      : null;

    const isAudioOrAudioSourceNode = (node) => {
      if (!node || typeof node !== 'object') return false;
      const tag = node.tagName ? String(node.tagName).toUpperCase() : '';
      if (tag === 'AUDIO') return true;
      if (typeof HTMLAudioElement !== 'undefined' && node instanceof HTMLAudioElement) return true;
      if (tag === 'SOURCE') {
        const pTag = node.parentElement && node.parentElement.tagName ? String(node.parentElement.tagName).toUpperCase() : '';
        return !pTag || pTag === 'AUDIO';
      }
      return false;
    };

    const instrumentAudioElementInstance = (el) => {
      if (!el || typeof el !== 'object' || el.__hoshiAudioInstrumented) return el;
      try {
        Object.defineProperty(el, '__hoshiAudioInstrumented', { value: true });
      } catch (_) {}
      if (mediaSrcDesc && mediaSrcDesc.set && mediaSrcDesc.get) {
        try {
          Object.defineProperty(el, 'src', {
            configurable: true,
            enumerable: mediaSrcDesc.enumerable !== false,
            get() { return mediaSrcDesc.get.call(this); },
            set(v) {
              if (!inAudioCtor) {
                checkExternalAudioSrc(v === undefined || v === null ? '' : String(v), this);
              }
              return mediaSrcDesc.set.call(this, v);
            }
          });
        } catch (_) {}
      }
      return el;
    };

    if (mediaSrcDesc && mediaSrcDesc.set && mediaSrcDesc.get && mediaSrcDesc.configurable !== false) {
      try {
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
          configurable: true,
          enumerable: mediaSrcDesc.enumerable !== false,
          get() { return mediaSrcDesc.get.call(this); },
          set(v) {
            if (!inAudioCtor && isAudioOrAudioSourceNode(this)) {
              checkExternalAudioSrc(v === undefined || v === null ? '' : String(v), this);
            }
            return mediaSrcDesc.set.call(this, v);
          }
        });
      } catch (_) {}
    }

    if (sourceSrcDesc && sourceSrcDesc.set && sourceSrcDesc.get && sourceSrcDesc.configurable !== false) {
      try {
        Object.defineProperty(HTMLSourceElement.prototype, 'src', {
          configurable: true,
          enumerable: sourceSrcDesc.enumerable !== false,
          get() { return sourceSrcDesc.get.call(this); },
          set(v) {
            if (!inAudioCtor && isAudioOrAudioSourceNode(this)) {
              checkExternalAudioSrc(v === undefined || v === null ? '' : String(v), this);
            }
            return sourceSrcDesc.set.call(this, v);
          }
        });
      } catch (_) {}
    }

    if (typeof Element !== 'undefined' && Element.prototype) {
      if (typeof Element.prototype.setAttribute === 'function') {
        const origSetAttr = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (attrName, val) {
          if (!inAudioCtor && String(attrName || '').toLowerCase() === 'src' && isAudioOrAudioSourceNode(this)) {
            checkExternalAudioSrc(val === undefined || val === null ? '' : String(val), this);
          }
          return origSetAttr.call(this, attrName, val);
        };
      }
      if (typeof Element.prototype.setAttributeNS === 'function') {
        const origSetAttrNS = Element.prototype.setAttributeNS;
        Element.prototype.setAttributeNS = function (ns, qualifiedName, val) {
          const localAttr = String(qualifiedName || '').toLowerCase().split(':').pop();
          if (!inAudioCtor && localAttr === 'src' && isAudioOrAudioSourceNode(this)) {
            checkExternalAudioSrc(val === undefined || val === null ? '' : String(val), this);
          }
          return origSetAttrNS.call(this, ns, qualifiedName, val);
        };
      }
      const innerHtmlDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      if (innerHtmlDesc && innerHtmlDesc.set && innerHtmlDesc.get && innerHtmlDesc.configurable !== false) {
        try {
          Object.defineProperty(Element.prototype, 'innerHTML', {
            configurable: true,
            enumerable: innerHtmlDesc.enumerable !== false,
            get() { return innerHtmlDesc.get.call(this); },
            set(v) {
              const res = innerHtmlDesc.set.call(this, v);
              if (typeof v === 'string') {
                const low = v.toLowerCase();
                if (low.includes('<audio') || low.includes('<source')) {
                  scanAudioContainer(this);
                }
              }
              return res;
            }
          });
        } catch (_) {}
      }
      if (typeof Element.prototype.insertAdjacentHTML === 'function') {
        const origInsertAdj = Element.prototype.insertAdjacentHTML;
        Element.prototype.insertAdjacentHTML = function (position, text) {
          const res = origInsertAdj.call(this, position, text);
          if (typeof text === 'string') {
            const low = text.toLowerCase();
            if (low.includes('<audio') || low.includes('<source')) {
              scanAudioContainer(this.parentElement || document);
              scanAudioContainer(this);
            }
          }
          return res;
        };
      }
    }

    if (typeof Document !== 'undefined' && Document.prototype) {
      if (typeof Document.prototype.createElement === 'function') {
        const origCreateEl = Document.prototype.createElement;
        Document.prototype.createElement = function (tagName, options) {
          const el = options !== undefined
            ? origCreateEl.call(this, tagName, options)
            : origCreateEl.call(this, tagName);
          if (String(tagName || '').toLowerCase() === 'audio') {
            instrumentAudioElementInstance(el);
          }
          return el;
        };
      }
      if (typeof Document.prototype.createElementNS === 'function') {
        const origCreateElNS = Document.prototype.createElementNS;
        Document.prototype.createElementNS = function (ns, qualifiedName, options) {
          const el = options !== undefined
            ? origCreateElNS.call(this, ns, qualifiedName, options)
            : origCreateElNS.call(this, ns, qualifiedName);
          const localTag = String(qualifiedName || '').toLowerCase().split(':').pop();
          if (localTag === 'audio') {
            instrumentAudioElementInstance(el);
          }
          return el;
        };
      }
    }

    if (typeof window.Audio === 'function' && !window.Audio.__hoshiWrapped) {
      const OrigAudio = window.Audio;
      const WrappedAudio = function (src) {
        let el;
        inAudioCtor = true;
        try {
          el = arguments.length > 0 ? new OrigAudio(src) : new OrigAudio();
        } finally {
          inAudioCtor = false;
        }
        instrumentAudioElementInstance(el);
        if (arguments.length > 0) {
          checkExternalAudioSrc(src === undefined || src === null ? '' : String(src), el);
        }
        return el;
      };
      WrappedAudio.__hoshiWrapped = true;
      WrappedAudio.prototype = OrigAudio.prototype;
      window.Audio = WrappedAudio;
    }
  }

  // 5. Capsule geometry & handlers
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
  let pointerDownActive = false;
  const touchHandlers = { start: [], move: [], end: [], cancel: [] };
  const resizeHandlers = [];
  const keyHandlers = [];
  const showHandlers = [];
  const hideHandlers = [];
  const audioInterruptBeginHandlers = [];
  const audioInterruptEndHandlers = [];
  let shareAppMessageHandler = null;
  let shareTimelineHandler = null;

  // 6. Built-in v2 Contract-Compliant kissa_sync Mock + Real Node Cloud Bridge
  const VALID_IDS = [];
  for (let ch = 1; ch <= 3; ch++) {
    for (let i = 1; i <= 10; i++) VALID_IDS.push(ch + '-' + i);
  }
  const CHAPTER_CAPS = { '1': 35000, '2': 90000, '3': 220000 };
  const MAX_TOTAL_SCORE = 3450000;
  const MAX_OFFLINE_DELTA = 1500;
  const CATCAKE_COSTS = {
    1: [20, 40, 70, 110],
    2: [25, 50, 85, 130],
    3: [35, 65, 105, 160],
    4: [45, 85, 135, 200],
    5: [60, 110, 170, 250],
    6: [80, 140, 220, 320],
    7: [100, 180, 280, 400]
  };
  const DEVICE_COSTS = {
    dev_tray: [60, 150],
    dev_flour: [45, 95, 170],
    dev_teapot: [50, 105, 185],
    dev_tools: [40, 90, 160]
  };
  const V2_PATRON_COSTS = { mikan: 0, luna: 80, mugi: 120 };
  const V2_THEME_COSTS = { amber: 0, sakura: 80, moonlight: 120 };
  const V1_PATRON_COSTS = { mikan: 0, luna: 60, mugi: 100 };
  const V1_UPGRADE_COSTS = {
    up_tools: [40, 90, 160],
    up_fever: [50, 100, 180],
    up_combo: [60, 120, 200],
    up_dust: [45, 95, 170]
  };
  const DEFAULT_MOCK_RIVALS = [
    { id: 'npc_1', nickName: '月光甜点师·小葵', avatarPreset: 'luna', totalStars: 78, totalCumulativeScore: 412800, isNpc: true },
    { id: 'npc_2', nickName: '焦糖布丁喵', avatarPreset: 'mikan', totalStars: 54, totalCumulativeScore: 238600, isNpc: true },
    { id: 'npc_3', nickName: '柴柴烘焙坊', avatarPreset: 'mugi', totalStars: 36, totalCumulativeScore: 142500, isNpc: true },
    { id: 'npc_4', nickName: '星露茶会·奈奈', avatarPreset: 'luna', totalStars: 19, totalCumulativeScore: 68400, isNpc: true },
    { id: 'npc_5', nickName: '晚风舒芙蕾', avatarPreset: 'mikan', totalStars: 8, totalCumulativeScore: 21500, isNpc: true }
  ];

  const cloudConfig = {
    useBuiltInMock: ${Boolean(defaultUseBuiltInMock)},
    failNextPushCount: 0,
    failNextPullCount: 0,
    exhaustRevisionLock: false,
    latencyMs: 6,
    seedRivals: null
  };
  const cloudLog = [];
  let cloudCallCount = 0;
  let lastCloudCall = null;

  function clampInt(v, min, max) {
    const n = Math.floor(Number(v) || 0);
    return Math.max(min, Math.min(max, n));
  }
  function normPatron(id) {
    if (id === 'patron_luna' || id === 'luna') return 'luna';
    if (id === 'patron_mugi' || id === 'mugi') return 'mugi';
    return 'mikan';
  }
  function computeHighestUnlocked(levelStars) {
    let highest = '1-1';
    const total = Object.values(levelStars || {}).reduce((s, v) => s + clampInt(v, 0, 3), 0);
    for (let i = 0; i < VALID_IDS.length; i++) {
      const id = VALID_IDS[i];
      if (id === '1-1') continue;
      const prevId = VALID_IDS[i - 1];
      if (clampInt(levelStars[prevId], 0, 3) < 1) break;
      if (id === '2-1' && total < 18) break;
      if (id === '3-1' && total < 40) break;
      highest = id;
    }
    return highest;
  }
  function computeSpentV2(meta) {
    if (!meta || typeof meta !== 'object') return 0;
    let s = 0;
    const cl = meta.catcakeLevels || {};
    for (let t = 1; t <= 7; t++) {
      const lv = clampInt(cl[t] ?? cl[String(t)], 0, 4);
      for (let i = 0; i < lv; i++) s += CATCAKE_COSTS[t][i];
    }
    const du = meta.deviceUpgrades || {};
    for (const k of Object.keys(DEVICE_COSTS)) {
      const lv = clampInt(du[k], 0, DEVICE_COSTS[k].length);
      for (let i = 0; i < lv; i++) s += DEVICE_COSTS[k][i];
    }
    for (const p of meta.unlockedPatrons || []) s += V2_PATRON_COSTS[normPatron(p)] || 0;
    for (const th of meta.unlockedThemes || []) s += V2_THEME_COSTS[th] || 0;
    s += clampInt(meta.consumableSpentStardust, 0, 999999);
    return s;
  }
  function migrateV1ToV2Mock(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const unlockedPatrons = ['mikan'];
    for (const p of src.unlockedPatrons || []) {
      const np = normPatron(p);
      if (!unlockedPatrons.includes(np)) unlockedPatrons.push(np);
    }
    const unlockedThemes = ['amber'];
    for (const th of src.unlockedThemes || []) {
      if (V2_THEME_COSTS[th] !== undefined && !unlockedThemes.includes(th)) unlockedThemes.push(th);
    }
    let v1Spent = 0;
    for (const p of unlockedPatrons) v1Spent += V1_PATRON_COSTS[p] || 0;
    for (const th of unlockedThemes) v1Spent += V2_THEME_COSTS[th] || 0;
    const ups = src.shopUpgrades || {};
    for (const k of Object.keys(V1_UPGRADE_COSTS)) {
      const lv = clampInt(ups[k], 0, 3);
      for (let i = 0; i < lv; i++) v1Spent += V1_UPGRADE_COSTS[k][i];
    }
    const rawBank = typeof src.bankStardust === 'number' ? Math.max(0, Math.floor(src.bankStardust)) : 30;
    let totalEarned = Math.max(30, clampInt(src.totalEarnedStardust, 0, 999999), rawBank + v1Spent);
    if (unlockedPatrons.includes('luna')) totalEarned += 20;
    if (unlockedPatrons.includes('mugi')) totalEarned += 20;
    if ((Number(src.bestChef) || 0) > 0 || (Number(src.bestRush) || 0) > 0 || (Number(src.bestZen) || 0) > 0) {
      totalEarned += 50;
    }
    const out = {
      schemaVersion: 2,
      bgmTrack: src.bgmTrack === 'bossa' || src.bgmTrack === 'off' ? src.bgmTrack : 'waltz',
      sfxEnabled: typeof src.sfxEnabled === 'boolean' ? src.sfxEnabled : true,
      bankStardust: 0,
      totalEarnedStardust: totalEarned,
      lastSyncedEarnedStardust: totalEarned,
      consumableSpentStardust: 0,
      levelStars: {},
      levelBestScores: {},
      highestUnlockedLevel: '1-1',
      catcakeLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
      selectedPatron: unlockedPatrons.includes(normPatron(src.selectedPatron)) ? normPatron(src.selectedPatron) : 'mikan',
      unlockedPatrons,
      equippedTheme: unlockedThemes.includes(src.equippedTheme) ? src.equippedTheme : 'amber',
      unlockedThemes,
      seenTutorials: { intro_slide: false, tray_trash: false, flavor_tile: false, ice_tile: false },
      playerProfile: src.playerProfile || { nickName: '', avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 },
      lifetimeStats: {
        runsPlayed: clampInt(src.lifetimeStats && src.lifetimeStats.runsPlayed, 0, 999999),
        ordersServed: clampInt(src.lifetimeStats && (src.lifetimeStats.ordersServed ?? src.lifetimeStats.servesTotal), 0, 9999999),
        vipServed: 0,
        maxComboEver: clampInt(src.lifetimeStats && src.lifetimeStats.maxComboEver, 0, 99),
        highestSingleServe: 0,
        totalStars: 0,
        totalCumulativeScore: 0
      },
      updatedAt: Date.now()
    };
    const v2Spent = computeSpentV2(out);
    out.totalEarnedStardust = Math.max(totalEarned, v2Spent);
    out.bankStardust = Math.max(0, out.totalEarnedStardust - v2Spent);
    return out;
  }

  function sanitizeV2Mock(raw, warnings = []) {
    if (!raw || typeof raw !== 'object') return migrateV1ToV2Mock(null);
    if (!raw.schemaVersion || raw.schemaVersion < 2) return migrateV1ToV2Mock(raw);
    const unlockedPatrons = ['mikan'];
    for (const p of raw.unlockedPatrons || []) {
      const np = normPatron(p);
      if (!unlockedPatrons.includes(np)) unlockedPatrons.push(np);
    }
    const unlockedThemes = ['amber'];
    for (const th of raw.unlockedThemes || []) {
      if (V2_THEME_COSTS[th] !== undefined && !unlockedThemes.includes(th)) unlockedThemes.push(th);
    }
    const levelBestScores = {};
    const levelStars = {};
    const inScores = raw.levelBestScores || {};
    const inStars = raw.levelStars || {};
    for (const id of VALID_IDS) {
      const cap = CHAPTER_CAPS[id[0]] || 35000;
      const rawSc = Math.max(0, Math.floor(Number(inScores[id]) || 0));
      if (rawSc > cap) warnings.push('level_score_cap_clamped');
      const sc = Math.min(cap, rawSc);
      if (sc > 0) levelBestScores[id] = sc;
      let st = clampInt(inStars[id], 0, 3);
      if (st > 0 && sc <= 0) {
        warnings.push('stars_without_score_clamped');
        st = 0;
      }
      if (st > 0) levelStars[id] = st;
    }
    const totalStars = Math.min(90, Object.values(levelStars).reduce((s, v) => s + v, 0));
    const totalCumulativeScore = Math.min(MAX_TOTAL_SCORE, Object.values(levelBestScores).reduce((s, v) => s + v, 0));
    const cl = raw.catcakeLevels || {};
    const catcakeLevels = {};
    for (let t = 1; t <= 7; t++) catcakeLevels[t] = clampInt(cl[t] ?? cl[String(t)], 0, 4);
    const du = raw.deviceUpgrades || {};
    const deviceUpgrades = {
      dev_tray: clampInt(du.dev_tray, 0, 2),
      dev_flour: clampInt(du.dev_flour, 0, 3),
      dev_teapot: clampInt(du.dev_teapot, 0, 3),
      dev_tools: clampInt(du.dev_tools, 0, 3)
    };
    const tut = raw.seenTutorials || {};
    const ls = raw.lifetimeStats || {};
    const out = {
      schemaVersion: 2,
      bgmTrack: raw.bgmTrack === 'bossa' || raw.bgmTrack === 'off' ? raw.bgmTrack : 'waltz',
      sfxEnabled: typeof raw.sfxEnabled === 'boolean' ? raw.sfxEnabled : true,
      bankStardust: 0,
      totalEarnedStardust: 30,
      lastSyncedEarnedStardust: clampInt(raw.lastSyncedEarnedStardust, 0, 999999),
      consumableSpentStardust: clampInt(raw.consumableSpentStardust, 0, 999999),
      levelStars,
      levelBestScores,
      highestUnlockedLevel: computeHighestUnlocked(levelStars),
      catcakeLevels,
      deviceUpgrades,
      selectedPatron: unlockedPatrons.includes(normPatron(raw.selectedPatron)) ? normPatron(raw.selectedPatron) : 'mikan',
      unlockedPatrons,
      equippedTheme: unlockedThemes.includes(raw.equippedTheme) ? raw.equippedTheme : 'amber',
      unlockedThemes,
      seenTutorials: {
        intro_slide: !!tut.intro_slide,
        tray_trash: !!tut.tray_trash,
        flavor_tile: !!tut.flavor_tile,
        ice_tile: !!tut.ice_tile
      },
      playerProfile: raw.playerProfile || { nickName: '', avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 },
      lifetimeStats: {
        runsPlayed: clampInt(ls.runsPlayed, 0, 999999),
        ordersServed: clampInt(ls.ordersServed, 0, 9999999),
        vipServed: clampInt(ls.vipServed, 0, 999999),
        maxComboEver: clampInt(ls.maxComboEver, 0, 99),
        highestSingleServe: clampInt(ls.highestSingleServe, 0, 999999),
        totalStars,
        totalCumulativeScore
      },
      updatedAt: clampInt(raw.updatedAt || Date.now(), 0, 9999999999999)
    };
    const spent = computeSpentV2(out);
    const rawBank = typeof raw.bankStardust === 'number' ? Math.max(0, Math.floor(raw.bankStardust)) : 30;
    const rawEarned = clampInt(raw.totalEarnedStardust, 0, 999999);
    out.totalEarnedStardust = Math.max(30, rawEarned > 0 ? rawEarned : rawBank + spent, spent);
    out.bankStardust = Math.max(0, out.totalEarnedStardust - spent);
    return out;
  }

  function runBuiltInKissaSync(payload = {}) {
    const action = payload.action || 'pull';
    const dbKey = '__wx_mock_cloud_db_v2__';
    const openidSuffix = '88A6';
    let myDoc = null;
    try {
      const raw = localStorage.getItem(dbKey) || localStorage.getItem('wx_cloud_kissa_doc_v1');
      myDoc = raw ? JSON.parse(raw) : null;
    } catch (_) {}

    if (action === 'pull') {
      if (!myDoc) {
        const initMeta = sanitizeV2Mock({ schemaVersion: 2, bankStardust: 30, totalEarnedStardust: 30, lastSyncedEarnedStardust: 30 });
        myDoc = {
          openidSuffix,
          profile: { nickName: '星夜店长#' + openidSuffix, avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 },
          totalStars: 0,
          totalCumulativeScore: 0,
          metaSave: initMeta,
          revision: 1
        };
        localStorage.setItem(dbKey, JSON.stringify(myDoc));
        return { ok: true, isNewUser: true, ...myDoc };
      }
      if (!myDoc.metaSave || !myDoc.metaSave.schemaVersion || myDoc.metaSave.schemaVersion < 2) {
        const mig = migrateV1ToV2Mock(myDoc.metaSave || myDoc);
        delete myDoc.activeRun;
        delete myDoc.savedRuns;
        myDoc.metaSave = mig;
        myDoc.totalStars = mig.lifetimeStats.totalStars;
        myDoc.totalCumulativeScore = mig.lifetimeStats.totalCumulativeScore;
        myDoc.openidSuffix = myDoc.openidSuffix || openidSuffix;
        myDoc.profile = myDoc.profile || { nickName: '星夜店长#' + openidSuffix, avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 };
        myDoc.revision = myDoc.revision || 1;
        localStorage.setItem(dbKey, JSON.stringify(myDoc));
      }
      return {
        ok: true,
        isNewUser: false,
        openidSuffix: myDoc.openidSuffix || openidSuffix,
        profile: myDoc.profile,
        totalStars: myDoc.totalStars || 0,
        totalCumulativeScore: myDoc.totalCumulativeScore || 0,
        metaSave: myDoc.metaSave,
        revision: myDoc.revision || 1
      };
    }

    if (action === 'push') {
      if (cloudConfig.exhaustRevisionLock) {
        return { ok: false, conflict: true, reason: 'revision_conflict_retry_exhausted' };
      }
      const warnings = [];
      const baseMeta = myDoc && myDoc.metaSave ? sanitizeV2Mock(myDoc.metaSave) : null;
      const clientMeta = sanitizeV2Mock(payload.metaSave || {}, warnings);
      const rr = payload.runReport;
      if (rr && typeof rr === 'object' && (Number(rr.score) || 0) > 0) {
        const serves = Number(rr.serves ?? rr.ordersServed ?? 0);
        const dur = Number(rr.durationSec) || 0;
        const lid = rr.levelId;
        if (serves < 1) {
          warnings.push('zero_serve_score_rejected');
          if (lid && VALID_IDS.includes(lid)) {
            clientMeta.levelBestScores[lid] = (baseMeta && baseMeta.levelBestScores[lid]) || 0;
            clientMeta.levelStars[lid] = (baseMeta && baseMeta.levelStars[lid]) || 0;
            if (!clientMeta.levelBestScores[lid]) delete clientMeta.levelBestScores[lid];
            if (!clientMeta.levelStars[lid]) delete clientMeta.levelStars[lid];
          } else {
            clientMeta.levelBestScores = baseMeta ? { ...baseMeta.levelBestScores } : {};
            clientMeta.levelStars = baseMeta ? { ...baseMeta.levelStars } : {};
          }
        } else if (dur > 0 && dur < 3 && Number(rr.score) > 3000) {
          warnings.push('implausible_run_duration');
          if (lid && VALID_IDS.includes(lid)) {
            clientMeta.levelBestScores[lid] = (baseMeta && baseMeta.levelBestScores[lid]) || 0;
            clientMeta.levelStars[lid] = (baseMeta && baseMeta.levelStars[lid]) || 0;
          }
        }
      }

      const prevRev = (myDoc && myDoc.revision) || 0;
      const conflictMerged = !!(myDoc && Number(payload.baseRevision) > 0 && Number(payload.baseRevision) < prevRev);
      let merged = clientMeta;
      if (baseMeta) {
        const mStars = {};
        const mScores = {};
        for (const id of VALID_IDS) {
          const st = Math.max(baseMeta.levelStars[id] || 0, clientMeta.levelStars[id] || 0);
          const sc = Math.max(baseMeta.levelBestScores[id] || 0, clientMeta.levelBestScores[id] || 0);
          if (st > 0 && sc > 0) mStars[id] = st;
          if (sc > 0) mScores[id] = sc;
        }
        const mCat = {};
        for (let t = 1; t <= 7; t++) mCat[t] = Math.max(baseMeta.catcakeLevels[t] || 0, clientMeta.catcakeLevels[t] || 0);
        const mDev = {};
        for (const k of Object.keys(DEVICE_COSTS)) mDev[k] = Math.max(baseMeta.deviceUpgrades[k] || 0, clientMeta.deviceUpgrades[k] || 0);
        const uPatrons = Array.from(new Set([...baseMeta.unlockedPatrons, ...clientMeta.unlockedPatrons]));
        const uThemes = Array.from(new Set([...baseMeta.unlockedThemes, ...clientMeta.unlockedThemes]));
        merged = {
          ...clientMeta,
          levelStars: mStars,
          levelBestScores: mScores,
          highestUnlockedLevel: computeHighestUnlocked(mStars),
          catcakeLevels: mCat,
          deviceUpgrades: mDev,
          unlockedPatrons: uPatrons,
          unlockedThemes: uThemes,
          consumableSpentStardust: Math.max(baseMeta.consumableSpentStardust || 0, clientMeta.consumableSpentStardust || 0),
          seenTutorials: {
            intro_slide: !!(baseMeta.seenTutorials.intro_slide || clientMeta.seenTutorials.intro_slide),
            tray_trash: !!(baseMeta.seenTutorials.tray_trash || clientMeta.seenTutorials.tray_trash),
            flavor_tile: !!(baseMeta.seenTutorials.flavor_tile || clientMeta.seenTutorials.flavor_tile),
            ice_tile: !!(baseMeta.seenTutorials.ice_tile || clientMeta.seenTutorials.ice_tile)
          }
        };
        const spent = computeSpentV2(merged);
        const syncBase = clientMeta.lastSyncedEarnedStardust || 0;
        let totalEarned;
        if (syncBase >= 30 && clientMeta.totalEarnedStardust > syncBase && baseMeta.totalEarnedStardust > syncBase) {
          const rawDelta = clientMeta.totalEarnedStardust - syncBase;
          if (rawDelta > MAX_OFFLINE_DELTA) warnings.push('stardust_delta_clamped');
          const delta = Math.min(MAX_OFFLINE_DELTA, rawDelta);
          totalEarned = Math.max(spent, baseMeta.totalEarnedStardust + delta);
        } else if (clientMeta.totalEarnedStardust - baseMeta.totalEarnedStardust > MAX_OFFLINE_DELTA) {
          warnings.push('stardust_delta_clamped');
          totalEarned = Math.max(spent, baseMeta.totalEarnedStardust + MAX_OFFLINE_DELTA);
        } else {
          totalEarned = Math.max(baseMeta.totalEarnedStardust, clientMeta.totalEarnedStardust, spent);
        }
        merged.totalEarnedStardust = totalEarned;
        merged.lastSyncedEarnedStardust = totalEarned;
        merged.bankStardust = Math.max(0, totalEarned - spent);
      } else {
        merged.lastSyncedEarnedStardust = merged.totalEarnedStardust;
      }

      const totalStars = Math.min(90, Object.values(merged.levelStars).reduce((s, v) => s + v, 0));
      const totalCumulativeScore = Math.min(MAX_TOTAL_SCORE, Object.values(merged.levelBestScores).reduce((s, v) => s + v, 0));
      merged.lifetimeStats.totalStars = totalStars;
      merged.lifetimeStats.totalCumulativeScore = totalCumulativeScore;

      const profSrc = payload.profile || (myDoc && myDoc.profile) || {};
      const prof = {
        nickName: typeof profSrc.nickName === 'string' && profSrc.nickName.trim()
          ? profSrc.nickName.trim().slice(0, 16)
          : ('星夜店长#' + openidSuffix),
        avatarUrl: typeof profSrc.avatarUrl === 'string' ? profSrc.avatarUrl.slice(0, 512) : '',
        avatarPreset: ['mikan', 'luna', 'mugi'].includes(profSrc.avatarPreset) ? profSrc.avatarPreset : 'mikan',
        authorized: !!profSrc.authorized,
        updatedAt: Date.now()
      };
      myDoc = {
        openidSuffix,
        profile: prof,
        totalStars,
        totalCumulativeScore,
        metaSave: merged,
        revision: prevRev + 1
      };
      localStorage.setItem(dbKey, JSON.stringify(myDoc));
      return {
        ok: true,
        openidSuffix,
        profile: prof,
        totalStars,
        totalCumulativeScore,
        metaSave: merged,
        revision: myDoc.revision,
        conflictMerged,
        validationWarnings: warnings
      };
    }

    if (action === 'updateProfile') {
      const profIn = payload.profile || {};
      const baseProf = (myDoc && myDoc.profile) || { nickName: '星夜店长#' + openidSuffix, avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 };
      const nick = typeof profIn.nickName === 'string' && profIn.nickName.trim()
        ? profIn.nickName.trim().slice(0, 16)
        : baseProf.nickName;
      const nextProf = {
        nickName: nick,
        avatarUrl: typeof profIn.avatarUrl === 'string' ? profIn.avatarUrl.slice(0, 512) : baseProf.avatarUrl,
        avatarPreset: ['mikan', 'luna', 'mugi'].includes(profIn.avatarPreset) ? profIn.avatarPreset : baseProf.avatarPreset,
        authorized: profIn.authorized !== undefined ? !!profIn.authorized : baseProf.authorized,
        updatedAt: Date.now()
      };
      myDoc = myDoc || {
        openidSuffix,
        totalStars: 0,
        totalCumulativeScore: 0,
        metaSave: sanitizeV2Mock(null),
        revision: 0
      };
      myDoc.profile = nextProf;
      myDoc.revision = (myDoc.revision || 0) + 1;
      if (myDoc.metaSave) myDoc.metaSave.playerProfile = nextProf;
      localStorage.setItem(dbKey, JSON.stringify(myDoc));
      return { ok: true, openidSuffix, profile: nextProf, revision: myDoc.revision };
    }

    if (action === 'leaderboard') {
      const rawType = payload.boardType || payload.mode || 'stars';
      const boardType = (rawType === 'score' || rawType === 'totalScore') ? 'score' : 'stars';
      const baseRivals = Array.isArray(cloudConfig.seedRivals) ? cloudConfig.seedRivals : DEFAULT_MOCK_RIVALS;
      const rows = baseRivals.map((r, i) => ({
        id: r.id || ('npc_' + (i + 1)),
        isMe: false,
        isNpc: r.isNpc !== undefined ? !!r.isNpc : true,
        nickName: r.nickName || ('甜点店长#' + (i + 1)),
        avatarUrl: r.avatarUrl || '',
        avatarPreset: r.avatarPreset || 'mikan',
        totalStars: clampInt(r.totalStars ?? r.stars, 0, 90),
        totalCumulativeScore: clampInt(r.totalCumulativeScore ?? r.totalScore ?? r.score, 0, MAX_TOTAL_SCORE)
      }));
      const myStars = myDoc ? clampInt(myDoc.totalStars, 0, 90) : 0;
      const myScore = myDoc ? clampInt(myDoc.totalCumulativeScore, 0, MAX_TOTAL_SCORE) : 0;
      if (myDoc) {
        rows.push({
          id: 'me',
          isMe: true,
          isNpc: false,
          nickName: (myDoc.profile && myDoc.profile.nickName) || ('星夜店长#' + openidSuffix),
          avatarUrl: (myDoc.profile && myDoc.profile.avatarUrl) || '',
          avatarPreset: (myDoc.profile && myDoc.profile.avatarPreset) || 'mikan',
          totalStars: myStars,
          totalCumulativeScore: myScore
        });
      }
      const eligible = rows.filter((r) =>
        boardType === 'stars'
          ? r.totalStars > 0 && r.totalStars <= 90
          : r.totalCumulativeScore > 0 && r.totalCumulativeScore <= MAX_TOTAL_SCORE
      );
      eligible.sort((a, b) => {
        if (boardType === 'stars') {
          if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
          return b.totalCumulativeScore - a.totalCumulativeScore;
        }
        if (b.totalCumulativeScore !== a.totalCumulativeScore) return b.totalCumulativeScore - a.totalCumulativeScore;
        return b.totalStars - a.totalStars;
      });
      const meIdx = eligible.findIndex((r) => r.isMe);
      const myRank = meIdx >= 0 ? meIdx + 1 : null;
      const list = eligible.slice(0, 50).map((r, idx) => ({
        ...r,
        rank: idx + 1,
        score: boardType === 'stars' ? r.totalStars : r.totalCumulativeScore
      }));
      return {
        ok: true,
        boardType,
        list,
        myRank,
        totalPlayers: eligible.length,
        myStars,
        myScore
      };
    }

    return { ok: false, reason: 'unknown_action:' + action };
  }

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
      cap.style.display = 'flex';
    } else if (cap) {
      cap.style.display = 'none';
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

  window.__WX_HARNESS__ = {
    vibrateCount: 0,
    shareSetupCount: 0,
    shareCallCount: 0,
    lastShareMenuOpts: null,
    lastSharePayload: null,
    sharePayloads: [],
    privacyHookRegistered: false,
    lastFriendCloudKV: [],
    friendCloudHistory: [],
    userInfoTapCount: 0,
    storageWriteCount: 0,
    cloudInited: false,
    cloudEnv: '',
    _activeUserInfoTrigger: null,
    _moduleLoader: null,

    get failNextPushCount() { return cloudConfig.failNextPushCount; },
    set failNextPushCount(v) { cloudConfig.failNextPushCount = Math.max(0, Number(v) || 0); },
    get failNextPullCount() { return cloudConfig.failNextPullCount; },
    set failNextPullCount(v) { cloudConfig.failNextPullCount = Math.max(0, Number(v) || 0); },
    get exhaustRevisionLock() { return cloudConfig.exhaustRevisionLock; },
    set exhaustRevisionLock(v) { cloudConfig.exhaustRevisionLock = !!v; },
    get latencyMs() { return cloudConfig.latencyMs; },
    set latencyMs(v) { cloudConfig.latencyMs = Math.max(0, Number(v) || 0); },

    advanceClockMs(ms) {
      clockOffsetMs += Number(ms) || 0;
      return clockOffsetMs;
    },
    getClockOffsetMs() { return clockOffsetMs; },
    resetClockOffset() { clockOffsetMs = 0; },

    getMenuRect: () => computeCapsuleRect(),
    setSystemMetricsOverride(opts = {}) {
      if (typeof opts.safeTop === 'number') safeTop = opts.safeTop;
      if (typeof opts.safeBottom === 'number') safeBottom = opts.safeBottom;
      if (typeof opts.showCapsule === 'boolean') showCapsule = opts.showCapsule;
      syncOverlay();
      resizeHandlers.forEach((fn) => fn());
    },

    gradientStats,
    hslViolations: gradientStats.hslViolations,
    resetGradientStats() {
      gradientStats.totalStops = 0;
      gradientStats.hslViolations.length = 0;
    },

    emojiStats,
    emojiViolations: emojiStats.violations,
    resetEmojiStats() {
      emojiStats.totalCalls = 0;
      emojiStats.violations.length = 0;
    },

    audioStats,
    audioSpy: audioStats,
    getAudioStats,
    resetAudioStats,

    triggerHide: () => hideHandlers.forEach((fn) => fn()),
    triggerShow: (opts = {}) => showHandlers.forEach((fn) => fn(opts)),
    triggerAudioInterruptionBegin: () => audioInterruptBeginHandlers.forEach((fn) => fn()),
    triggerAudioInterruptionEnd: () => audioInterruptEndHandlers.forEach((fn) => fn()),
    emitTouchCancel() {
      pointerDownActive = false;
      touchHandlers.cancel.forEach((fn) => fn({ touches: [], changedTouches: [], timeStamp: performance.now() }));
    },
    getSharePreview: () => (shareAppMessageHandler ? shareAppMessageHandler() : window.__WX_HARNESS__.lastSharePayload),
    getTimelineSharePreview: () => (shareTimelineHandler ? shareTimelineHandler() : null),
    tapUserInfoButton(customInfo) {
      if (typeof window.__WX_HARNESS__._activeUserInfoTrigger === 'function') {
        window.__WX_HARNESS__._activeUserInfoTrigger(customInfo, true);
        return true;
      }
      return false;
    },

    async setCloudConfig(cfg = {}) {
      if (typeof cfg.useBuiltInMock === 'boolean') cloudConfig.useBuiltInMock = cfg.useBuiltInMock;
      if (cfg.reset) {
        localStorage.removeItem('__wx_mock_cloud_db_v2__');
        localStorage.removeItem('wx_cloud_kissa_doc_v1');
        cloudConfig.seedRivals = null;
        cloudConfig.exhaustRevisionLock = false;
        cloudConfig.failNextPushCount = 0;
        cloudConfig.failNextPullCount = 0;
      }
      if (typeof cfg.failNextPushCount === 'number') cloudConfig.failNextPushCount = Math.max(0, cfg.failNextPushCount);
      if (typeof cfg.failNextPullCount === 'number') cloudConfig.failNextPullCount = Math.max(0, cfg.failNextPullCount);
      if (typeof cfg.exhaustRevisionLock === 'boolean') cloudConfig.exhaustRevisionLock = cfg.exhaustRevisionLock;
      if (typeof cfg.latencyMs === 'number') cloudConfig.latencyMs = Math.max(0, cfg.latencyMs);
      if (cfg.seedCloudDoc !== undefined) {
        if (cfg.seedCloudDoc === null) localStorage.removeItem('__wx_mock_cloud_db_v2__');
        else localStorage.setItem('__wx_mock_cloud_db_v2__', JSON.stringify(cfg.seedCloudDoc));
      }
      if (cfg.seedRivals !== undefined) {
        cloudConfig.seedRivals = Array.isArray(cfg.seedRivals) ? cfg.seedRivals : null;
      }
      if (cloudConfig.useBuiltInMock && cfg.bumpRevision) {
        try {
          const bumpOpts = typeof cfg.bumpRevision === 'object' && cfg.bumpRevision ? cfg.bumpRevision : {};
          const raw = localStorage.getItem('__wx_mock_cloud_db_v2__');
          const cur = raw ? JSON.parse(raw) : {
            openidSuffix: '88A6',
            profile: { nickName: '星夜店长#88A6', avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 },
            totalStars: 0,
            totalCumulativeScore: 0,
            metaSave: sanitizeV2Mock({ schemaVersion: 2, bankStardust: 30, totalEarnedStardust: 30, lastSyncedEarnedStardust: 30 }),
            revision: 1
          };
          cur.revision = (cur.revision || 1) + (Number(bumpOpts.delta) || 1);
          localStorage.setItem('__wx_mock_cloud_db_v2__', JSON.stringify(cur));
        } catch (_) {}
      }
      if (!cloudConfig.useBuiltInMock && !cfg.__skipAdminFetch) {
        try {
          const adminPayload = { ...cfg };
          delete adminPayload.__skipAdminFetch;
          await fetch('/__wx_cloud/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: adminPayload.reset ? 'reset' : (adminPayload.bumpRevision ? 'bumpRevision' : 'config'),
              ...adminPayload
            })
          });
        } catch (_) {}
      }
    },
    clearCloudDb() {
      localStorage.removeItem('__wx_mock_cloud_db_v2__');
      localStorage.removeItem('wx_cloud_kissa_doc_v1');
    },
    getCloudInspector() {
      let dbSnapshot = null;
      try {
        const raw = localStorage.getItem('__wx_mock_cloud_db_v2__');
        dbSnapshot = raw ? JSON.parse(raw) : null;
      } catch (_) {}
      return {
        dbSnapshot,
        cloudConfig: { ...cloudConfig },
        callCount: cloudCallCount,
        lastCall: lastCloudCall,
        callLog: [...cloudLog]
      };
    },
    resetPerTestCounters() {
      window.__WX_HARNESS__.vibrateCount = 0;
      window.__WX_HARNESS__.shareCallCount = 0;
      gradientStats.hslViolations.length = 0;
      emojiStats.violations.length = 0;
      audioStats.externalAudioElements = 0;
      resetAudioStats();
      cloudConfig.failNextPushCount = 0;
      cloudConfig.failNextPullCount = 0;
      cloudConfig.exhaustRevisionLock = false;
    },
    requireModule(relPath) {
      if (typeof window.__WX_HARNESS__._moduleLoader !== 'function') {
        throw new Error('Mini Game CJS module loader is not mounted on this page');
      }
      let p = String(relPath || '').trim();
      if (!p.startsWith('./')) {
        p = p.startsWith('src/') ? './' + p : (p === 'game.js' ? './game.js' : './src/' + p);
      }
      if (!p.endsWith('.js')) p += '.js';
      return window.__WX_HARNESS__._moduleLoader(p);
    }
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
          pointerDownActive = true;
          try { c.setPointerCapture(ev.pointerId); } catch (_) {}
          const rect = c.getBoundingClientRect();
          const t = { clientX: ev.clientX - rect.left, clientY: ev.clientY - rect.top };
          touchHandlers.start.forEach((fn) => fn({ touches: [t], changedTouches: [t], timeStamp: performance.now() }));
        });
        c.addEventListener('pointermove', (ev) => {
          if (!pointerDownActive) return;
          const rect = c.getBoundingClientRect();
          const t = { clientX: ev.clientX - rect.left, clientY: ev.clientY - rect.top };
          touchHandlers.move.forEach((fn) => fn({ touches: [t], changedTouches: [t], timeStamp: performance.now() }));
        });
        c.addEventListener('pointerup', (ev) => {
          if (!pointerDownActive) return;
          pointerDownActive = false;
          try { c.releasePointerCapture(ev.pointerId); } catch (_) {}
          const rect = c.getBoundingClientRect();
          const t = { clientX: ev.clientX - rect.left, clientY: ev.clientY - rect.top };
          touchHandlers.end.forEach((fn) => fn({ touches: [], changedTouches: [t], timeStamp: performance.now() }));
        });
        c.addEventListener('pointercancel', () => {
          pointerDownActive = false;
          touchHandlers.cancel.forEach((fn) => fn({ touches: [], changedTouches: [], timeStamp: performance.now() }));
        });
        window.addEventListener('keydown', (ev) => {
          keyHandlers.forEach((fn) => fn({ key: ev.key, code: ev.code, keyCode: ev.keyCode }));
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
      window.__WX_HARNESS__.storageWriteCount++;
      localStorage.setItem('wx_' + k, typeof v === 'string' ? v : JSON.stringify(v));
    },
    removeStorageSync(k) {
      localStorage.removeItem('wx_' + k);
    },
    clearStorageSync() {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('wx_')) localStorage.removeItem(k);
      }
    },
    getStorageInfoSync() {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('wx_')).map((k) => k.slice(3));
      return { keys, currentSize: Math.max(1, keys.length), limitSize: 10240 };
    },
    setInnerAudioOption() {},
    onNeedPrivacyAuthorization(cb) {
      window.__WX_HARNESS__.privacyHookRegistered = true;
      if (typeof cb === 'function') {
        //Hook registered cleanly without invoking modal unless triggered
      }
    },
    setUserCloudStorage(opts = {}) {
      const kv = Array.isArray(opts.KVDataList) ? opts.KVDataList : [];
      window.__WX_HARNESS__.lastFriendCloudKV = kv;
      window.__WX_HARNESS__.friendCloudHistory.push({ ts: Date.now(), KVDataList: kv });
      if (typeof opts.success === 'function') opts.success({ errMsg: 'setUserCloudStorage:ok' });
      if (typeof opts.complete === 'function') opts.complete();
    },
    createUserInfoButton(cfg = {}) {
      const old = document.getElementById('wx-mock-userinfo-btn');
      if (old) old.remove();
      const el = document.createElement('div');
      el.id = 'wx-mock-userinfo-btn';
      const st = cfg.style || {};
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
      const triggerAuth = (arg, programmatic = false) => {
        if (!programmatic && arg && typeof arg.stopPropagation === 'function') {
          arg.stopPropagation();
          arg.preventDefault();
        }
        window.__WX_HARNESS__.userInfoTapCount = (window.__WX_HARNESS__.userInfoTapCount || 0) + 1;
        let payload;
        if (programmatic && arg !== undefined) {
          if (arg === null) {
            payload = { errMsg: 'getUserInfo:fail auth deny', userInfo: null };
          } else if (typeof arg === 'object' && Object.prototype.hasOwnProperty.call(arg, 'userInfo')) {
            payload = arg;
          } else {
            payload = { userInfo: arg };
          }
        } else if (window.__WX_MOCK_USERINFO_DENY__ === true) {
          payload = { errMsg: 'getUserInfo:fail auth deny', userInfo: null };
        } else if (Object.prototype.hasOwnProperty.call(window, '__WX_MOCK_USERINFO__')) {
          payload = window.__WX_MOCK_USERINFO__ === null
            ? { errMsg: 'getUserInfo:fail auth deny', userInfo: null }
            : { userInfo: window.__WX_MOCK_USERINFO__ };
        } else {
          payload = { userInfo: { nickName: '微信店长·星野', avatarUrl: '' } };
        }
        tapCbs.forEach((fn) => fn(payload));
      };
      window.__WX_HARNESS__._activeUserInfoTrigger = triggerAuth;
      el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      el.addEventListener('pointerup', (ev) => triggerAuth(ev, false));
      return {
        onTap(fn) { if (typeof fn === 'function') tapCbs.push(fn); },
        destroy() {
          el.remove();
          if (window.__WX_HARNESS__._activeUserInfoTrigger === triggerAuth) {
            window.__WX_HARNESS__._activeUserInfoTrigger = null;
          }
        },
        show() { el.style.display = 'block'; },
        hide() { el.style.display = 'none'; }
      };
    },
    cloud: cloudDisabled
      ? undefined
      : {
          init(opts = {}) {
            window.__WX_HARNESS__.cloudInited = true;
            window.__WX_HARNESS__.cloudEnv = opts.env || 'default';
          },
          callFunction({ name, data, success, fail, complete } = {}) {
            const payload = data || {};
            const action = payload.action || 'pull';
            const delay = Math.max(0, Number(cloudConfig.latencyMs) || 0);

            const exec = async () => {
              if (delay > 0) await new Promise((r) => setTimeout(r, delay));
              if (action === 'push' && cloudConfig.failNextPushCount > 0) {
                cloudConfig.failNextPushCount--;
                const simErr = new Error('cloud.callFunction:fail transient network timeout');
                simErr.errMsg = simErr.message;
                throw simErr;
              }
              if (action === 'pull' && cloudConfig.failNextPullCount > 0) {
                cloudConfig.failNextPullCount--;
                const simErr = new Error('cloud.callFunction:fail transient pull timeout');
                simErr.errMsg = simErr.message;
                throw simErr;
              }

              let result;
              if (cloudConfig.useBuiltInMock) {
                result = runBuiltInKissaSync(payload);
              } else {
                const resp = await fetch('/__wx_cloud/' + encodeURIComponent(name || 'kissa_sync'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                if (!resp.ok) {
                  throw new Error('cloud.callFunction HTTP ' + resp.status);
                }
                result = await resp.json();
              }

              cloudCallCount++;
              const rec = { name: name || 'kissa_sync', action, ok: !!(result && result.ok), ts: Date.now() };
              lastCloudCall = rec;
              cloudLog.push(rec);
              if (cloudLog.length > 50) cloudLog.shift();
              return { result };
            };

            const p = exec().then(
              (res) => {
                if (typeof success === 'function') success(res);
                if (typeof complete === 'function') complete(res);
                return res;
              },
              (err) => {
                if (typeof fail === 'function') fail(err);
                if (typeof complete === 'function') complete(err);
                throw err;
              }
            );
            // Attach silent handler so callback-only callers never trigger UnhandledPromiseRejection,
            // while callers doing \`await wx.cloud.callFunction(...)\` still receive the rejected \`p\`!
            p.catch(() => {});
            return p;
          }
        },
    createWebAudioContext() {
      if (audioMode === 'none' || !NativeAudioContext) return null;
      return instrumentAudioContext(new NativeAudioContext());
    },
    onShow(fn) { if (typeof fn === 'function') showHandlers.push(fn); },
    onHide(fn) { if (typeof fn === 'function') hideHandlers.push(fn); },
    onAudioInterruptionBegin(fn) { if (typeof fn === 'function') audioInterruptBeginHandlers.push(fn); },
    onAudioInterruptionEnd(fn) { if (typeof fn === 'function') audioInterruptEndHandlers.push(fn); },
    onTouchStart(fn) { if (typeof fn === 'function') touchHandlers.start.push(fn); },
    onTouchMove(fn) { if (typeof fn === 'function') touchHandlers.move.push(fn); },
    onTouchEnd(fn) { if (typeof fn === 'function') touchHandlers.end.push(fn); },
    onTouchCancel(fn) { if (typeof fn === 'function') touchHandlers.cancel.push(fn); },
    onWindowResize(fn) { if (typeof fn === 'function') resizeHandlers.push(fn); },
    onKeyDown(fn) { if (typeof fn === 'function') keyHandlers.push(fn); },
    vibrateShort() { window.__WX_HARNESS__.vibrateCount++; },
    vibrateLong() { window.__WX_HARNESS__.vibrateCount++; },
    showShareMenu(opts) {
      window.__WX_HARNESS__.shareSetupCount++;
      window.__WX_HARNESS__.lastShareMenuOpts = opts || null;
    },
    onShareAppMessage(fn) { shareAppMessageHandler = typeof fn === 'function' ? fn : null; },
    onShareTimeline(fn) { shareTimelineHandler = typeof fn === 'function' ? fn : null; },
    shareAppMessage(opts) {
      window.__WX_HARNESS__.shareCallCount++;
      window.__WX_HARNESS__.lastSharePayload = opts || null;
      window.__WX_HARNESS__.sharePayloads.push(opts || null);
    }
  };

  syncOverlay();
})();`;
}

// ============================================================================
// Preview HTML, Self-Test HTML & Local Ephemeral HTTP Server
// ============================================================================

const COMMON_HEAD_STYLE = `
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
`;

export function loadMiniGameModuleMap(minigameDir = DEFAULT_MINIGAME_DIR) {
  const srcDir = path.join(minigameDir, 'src');
  const srcFiles = fs.existsSync(srcDir)
    ? fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort().map((f) => `src/${f}`)
    : [];
  const files = ['game.js', ...srcFiles];
  const map = {};
  for (const rel of files) {
    const full = path.join(minigameDir, rel);
    if (fs.existsSync(full)) {
      map[`./${rel}`] = fs.readFileSync(full, 'utf8');
    }
  }
  return map;
}

export function buildPreviewHtml(moduleMap) {
  const jsonModules = JSON.stringify(moduleMap).replace(/<\/script>/gi, '<\\/script>');
  const shimScript = buildWxShimScript({ defaultUseBuiltInMock: false });
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <title>WeChat Mini Game Preview Harness</title>
  <style>${COMMON_HEAD_STYLE}</style>
</head>
<body>
<script>
${shimScript}
(function () {
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
    let resolved = './' + baseParts.filter((p) => p !== '.').join('/');
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

  window.__WX_HARNESS__._moduleLoader = runModule;
  window.__MINI_ENTRY__ = runModule('./game.js');
})();
</script>
</body>
</html>`;
}

export function buildSelfTestHtml() {
  const shimScript = buildWxShimScript({ defaultUseBuiltInMock: true });
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <title>Hoshi Kissa E2E Self-Test Surface</title>
  <style>${COMMON_HEAD_STYLE}</style>
</head>
<body>
<script>
${shimScript}
(function () {
  const canvas = wx.createCanvas();
  const ctx2d = canvas.getContext('2d');
  if (wx.cloud && typeof wx.cloud.init === 'function') {
    wx.cloud.init({ env: 'dev-d0ggz3zx89d349af3', traceUser: true });
  }
  wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
  wx.onShareAppMessage(() => ({
    title: '一起做猫饼 · 治愈猫咪甜品屋',
    imageUrl: 'assets/title_hero_v2.jpg'
  }));
  wx.setUserCloudStorage({
    KVDataList: [
      { key: 'totalStars', value: '3' },
      { key: 'totalScore', value: '1400' }
    ]
  });

  // Inline silent data: URI unlock test (verifies externalAudioElements stays 0)
  try {
    const silentEl = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    silentEl.volume = 0.01;
  } catch (_) {}

  let audioCtx = null;
  let toneFilter = null;
  let userInfoBtn = null;

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    audioCtx = wx.createWebAudioContext();
    if (!audioCtx) return null;
    toneFilter = audioCtx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = 12500;
    toneFilter.connect(audioCtx.destination);
    if (typeof audioCtx.createConvolver !== 'function') {
      [0.029, 0.047, 0.071].forEach((sec) => {
        const dl = audioCtx.createDelay(0.5);
        dl.delayTime.value = sec;
        dl.connect(toneFilter);
      });
    }
    return audioCtx;
  }

  function playBlip(freq = 523.25) {
    const ac = ensureAudio();
    if (!ac || state.hidden) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(0.05, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.08);
    osc.connect(g);
    g.connect(toneFilter);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.09);
  }

  function setModalMuffle(muffled) {
    const ac = ensureAudio();
    if (!ac || !toneFilter) return;
    const now = ac.currentTime;
    toneFilter.frequency.setValueAtTime(toneFilter.frequency.value, now);
    toneFilter.frequency.exponentialRampToValueAtTime(muffled ? 580 : 12500, now + 0.2);
  }

  const state = {
    screen: 'lobby',
    selectedChapter: 1,
    previewLevelId: '1-1',
    currentLevelId: null,
    activeModal: null,
    activeShopTab: 'catcakes',
    leaderboardBoardType: 'stars',
    activeTutorialStep: null,
    score: 0,
    timeLeft: 90,
    ordersServed: 0,
    vipServed: 0,
    comboCount: 0,
    feverActive: false,
    feverEnergy: 0,
    skillEnergy: 0,
    activeTool: null,
    toolCounts: { fork: 1, spoon: 1 },
    trayCapacity: 3,
    tray: [null, null, null],
    seats: [null, null, null],
    preferredSeatIdx: null,
    lastKey: null,
    keyCount: 0,
    hidden: false,
    showCount: 0,
    hideCount: 0,
    cloudStatus: wx.cloud ? 'synced' : 'local_only',
    assetsLoaded: 30,
    assetsTotal: 30,
    hits: [],
    boardLayout: null,
    grid: { rows: 4, cols: 4, cells: [] }
  };

  let saveData = {
    schemaVersion: 2,
    bgmTrack: 'waltz',
    sfxEnabled: true,
    bankStardust: 30,
    totalEarnedStardust: 30,
    lastSyncedEarnedStardust: 30,
    consumableSpentStardust: 0,
    levelStars: {},
    levelBestScores: {},
    highestUnlockedLevel: '1-1',
    catcakeLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
    selectedPatron: 'mikan',
    unlockedPatrons: ['mikan'],
    equippedTheme: 'amber',
    unlockedThemes: ['amber'],
    seenTutorials: { intro_slide: true, tray_trash: true, flavor_tile: true, ice_tile: true },
    playerProfile: { nickName: '', avatarUrl: '', avatarPreset: 'mikan', authorized: false, updatedAt: 0 },
    lifetimeStats: {
      runsPlayed: 0,
      ordersServed: 0,
      vipServed: 0,
      maxComboEver: 0,
      highestSingleServe: 0,
      totalStars: 0,
      totalCumulativeScore: 0
    },
    updatedAt: 0
  };

  function initGrid() {
    state.grid = {
      rows: 4,
      cols: 4,
      cells: Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 4 }, (_, c) => ({ r, c, type: 'normal', tile: null }))
      )
    };
    state.grid.cells[0][0].tile = { tier: 1, flavor: 'plain', frozenHp: 0 };
    state.grid.cells[0][1].tile = { tier: 1, flavor: 'plain', frozenHp: 0 };
    state.grid.cells[1][2].tile = { tier: 1, flavor: 'plain', frozenHp: 0 };
  }
  initGrid();

  function getMetrics() {
    const win = wx.getWindowInfo();
    const width = win.windowWidth;
    const height = win.windowHeight;
    const dpr = Math.min(2, Math.max(1, win.pixelRatio || 1));
    const safeTop = win.safeArea ? win.safeArea.top : 20;
    const safeBottom = win.safeArea ? Math.max(0, height - win.safeArea.bottom) : 0;
    const menuRect = wx.getMenuButtonBoundingClientRect();
    return { width, height, dpr, safeTop, safeBottom, menuRect };
  }

  function syncUserInfoOverlay() {
    if (userInfoBtn) {
      userInfoBtn.destroy();
      userInfoBtn = null;
    }
    if (state.activeModal === 'leaderboard') {
      const m = getMetrics();
      const bx = Math.round(m.width * 0.5 - 60);
      const by = Math.round(m.height * 0.5 - 18);
      userInfoBtn = wx.createUserInfoButton({
        type: 'text',
        text: '',
        style: { left: bx, top: by, width: 120, height: 36 }
      });
      userInfoBtn.onTap((res) => {
        if (res && res.userInfo && res.userInfo.nickName) {
          saveData.playerProfile = {
            ...saveData.playerProfile,
            nickName: String(res.userInfo.nickName).trim().slice(0, 16),
            authorized: true
          };
        }
      });
    }
  }

  function render() {
    const m = getMetrics();
    if (canvas.width !== Math.round(m.width * m.dpr) || canvas.height !== Math.round(m.height * m.dpr)) {
      canvas.width = Math.round(m.width * m.dpr);
      canvas.height = Math.round(m.height * m.dpr);
    }
    ctx2d.save();
    ctx2d.scale(m.dpr, m.dpr);
    const grad = ctx2d.createLinearGradient(0, 0, 0, m.height);
    grad.addColorStop(0, '#2b1b17');
    grad.addColorStop(1, '#4a2c2a');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, m.width, m.height);

    state.hits = [];
    const topY = Math.max(8, (m.menuRect ? m.menuRect.top : m.safeTop + 4));
    const maxRight = m.menuRect ? m.menuRect.left - 10 : m.width - 12;
    const bottomSafeY = m.height - Math.max(10, m.safeBottom + 8);

    // Top bar safe button
    const topBtn = { id: state.screen === 'playing' ? 'pause_btn' : 'lobby_bgm_btn', x: 12, y: topY, w: Math.min(84, maxRight - 14), h: 32 };
    state.hits.push(topBtn);
    ctx2d.fillStyle = '#f5e6d3';
    ctx2d.fillRect(topBtn.x, topBtn.y, topBtn.w, topBtn.h);
    ctx2d.fillStyle = '#3a231c';
    ctx2d.font = 'bold 13px sans-serif';
    ctx2d.fillText('一起做猫饼 ★', topBtn.x + 8, topBtn.y + 20);

    if (window.__SELF_TEST_FORCE_CAPSULE_OVERLAP__ && m.menuRect) {
      state.hits.push({
        id: 'forced_capsule_overlap_btn',
        x: m.menuRect.left + 4,
        y: m.menuRect.top + 2,
        w: 48,
        h: 28
      });
    }

    if (state.screen === 'lobby') {
      const startBtn = { id: 'lobby_start_cta', x: Math.round(m.width * 0.5 - 80), y: Math.round(m.height * 0.5 - 24), w: 160, h: 48 };
      const shopBtn = { id: 'dock_shop', x: 16, y: bottomSafeY - 44, w: 80, h: 40 };
      const lbBtn = { id: 'dock_leaderboard', x: 108, y: bottomSafeY - 44, w: 88, h: 40 };
      state.hits.push(startBtn, shopBtn, lbBtn);
      ctx2d.fillStyle = '#e89f65';
      ctx2d.fillRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);
    } else {
      const cellSize = m.width >= 900 ? 64 : 56;
      const gridW = cellSize * 4;
      const gridX = Math.round((m.width - gridW) * 0.5);
      const gridY = Math.round(m.height * 0.36);
      state.boardLayout = { x: gridX - 8, y: gridY - 8, w: gridW + 16, h: gridW + 16, rows: 4, cols: 4, cellSize, gridX, gridY };
      ctx2d.fillStyle = 'rgba(255, 240, 224, 0.14)';
      ctx2d.fillRect(state.boardLayout.x, state.boardLayout.y, state.boardLayout.w, state.boardLayout.h);

      for (let i = 0; i < 3; i++) {
        state.hits.push({ id: 'seat_' + i, x: 16 + i * 96, y: topY + 42, w: 88, h: 52 });
        state.hits.push({ id: 'tray_slot_' + i, x: gridX + i * 56, y: gridY - 54, w: 48, h: 44 });
      }
      state.hits.push({ id: 'tray_trash_btn', x: gridX + 180, y: gridY - 54, w: 48, h: 44 });
      state.hits.push({ id: 'knead_btn', x: Math.round(m.width * 0.5 - 56), y: bottomSafeY - 46, w: 112, h: 42 });
    }

    if (state.activeModal) {
      state.hits.push({ id: 'modal_backdrop', x: 0, y: 0, w: m.width, h: m.height });
      state.hits.push({ id: 'modal_close', x: Math.min(maxRight - 40, m.width - 60), y: topY + 48, w: 36, h: 36 });
    }
    ctx2d.restore();
  }

  function checkAutoServe() {
    const s0 = state.seats[0];
    if (!s0) return false;
    const matchIdx = state.tray.findIndex((t) => t && t.tier === s0.slots[0].tier);
    if (matchIdx >= 0) {
      state.tray[matchIdx] = null;
      state.ordersServed += 1;
      state.comboCount += 1;
      state.score += 120;
      state.seats[0] = null;
      playBlip(659.25);
      return true;
    }
    return false;
  }

  function slide(dir) {
    let moved = false;
    if (dir === 'left') {
      const a = state.grid.cells[0][0].tile;
      const b = state.grid.cells[0][1].tile;
      if (a && b && a.tier === b.tier) {
        state.grid.cells[0][0].tile = { tier: a.tier + 1, flavor: 'plain', frozenHp: 0 };
        state.grid.cells[0][1].tile = null;
        moved = true;
      }
    } else if (dir === 'right') {
      const a = state.grid.cells[0][0].tile;
      if (a && !state.grid.cells[0][3].tile) {
        state.grid.cells[0][3].tile = a;
        state.grid.cells[0][0].tile = null;
        moved = true;
      }
    }
    playBlip(440);
    render();
    return { moved };
  }

  function knead() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (!state.grid.cells[r][c].tile) {
          state.grid.cells[r][c].tile = { tier: 1, flavor: 'plain', frozenHp: 0 };
          playBlip(392);
          render();
          return { spawned: true, r, c };
        }
      }
    }
    return { spawned: false, reason: 'board_full' };
  }

  function tapBoardCell(r, c) {
    const cell = state.grid.cells[r] && state.grid.cells[r][c];
    if (!cell || !cell.tile) return { placed: false };
    const idx = state.tray.findIndex((x) => x === null);
    if (idx < 0) return { placed: false, reason: 'tray_full' };
    state.tray[idx] = { uid: Date.now(), tier: cell.tile.tier, flavor: cell.tile.flavor };
    cell.tile = null;
    playBlip(587.33);
    checkAutoServe();
    render();
    return { placed: true, slotIdx: idx };
  }

  function doubleTapTray(slotIdx) {
    if (state.tray[slotIdx]) {
      state.tray[slotIdx] = null;
      playBlip(330);
      render();
      return { discarded: true };
    }
    return { discarded: false };
  }

  function startLevel(id = '1-1') {
    state.screen = 'playing';
    state.currentLevelId = id;
    state.activeModal = null;
    state.score = 0;
    state.ordersServed = 0;
    state.comboCount = 0;
    state.tray = [null, null, null];
    state.seats = [
      { customerId: 'cust_ragdoll', recipeId: 'R02', patience: 28, maxPatience: 28, isVip: false, isUrgent: false, slots: [{ tier: 2, flavor: 'any' }] },
      null,
      null
    ];
    initGrid();
    syncUserInfoOverlay();
    render();
    return true;
  }

  function openModal(name) {
    state.activeModal = name;
    setModalMuffle(true);
    syncUserInfoOverlay();
    render();
  }

  function closeModal() {
    state.activeModal = null;
    setModalMuffle(false);
    syncUserInfoOverlay();
    render();
  }

  let gesture = null;
  let lastTrayTap = { slot: -1, ts: 0 };

  wx.onTouchStart((ev) => {
    const t = ev.changedTouches[0];
    if (!t) return;
    ensureAudio();
    gesture = { x0: t.clientX, y0: t.clientY, ts: performance.now(), swiped: false };
  });

  wx.onTouchMove((ev) => {
    const t = ev.changedTouches[0];
    if (!t || !gesture || gesture.swiped || state.screen !== 'playing' || !state.boardLayout) return;
    const dx = t.clientX - gesture.x0;
    const dy = t.clientY - gesture.y0;
    const dist = Math.hypot(dx, dy);
    const b = state.boardLayout;
    const inBoard = gesture.x0 >= b.x && gesture.x0 <= b.x + b.w && gesture.y0 >= b.y && gesture.y0 <= b.y + b.h;
    if (inBoard && dist >= 18 && Math.abs(Math.abs(dx) - Math.abs(dy)) >= 4) {
      gesture.swiped = true;
      if (Math.abs(dx) > Math.abs(dy)) slide(dx > 0 ? 'right' : 'left');
      else slide(dy > 0 ? 'down' : 'up');
    }
  });

  wx.onTouchEnd((ev) => {
    const t = ev.changedTouches[0];
    if (!t || !gesture) return;
    const dt = performance.now() - gesture.ts;
    const dist = Math.hypot(t.clientX - gesture.x0, t.clientY - gesture.y0);
    const wasSwiped = gesture.swiped;
    gesture = null;
    if (wasSwiped || dist >= 14 || dt >= 350) return;

    // Check hits (topmost first)
    for (let i = state.hits.length - 1; i >= 0; i--) {
      const h = state.hits[i];
      if (t.clientX >= h.x && t.clientX <= h.x + h.w && t.clientY >= h.y && t.clientY <= h.y + h.h) {
        if (h.id.startsWith('tray_slot_')) {
          const slotIdx = Number(h.id.replace('tray_slot_', ''));
          const now = performance.now();
          if (lastTrayTap.slot === slotIdx && now - lastTrayTap.ts <= 320) {
            lastTrayTap = { slot: -1, ts: 0 };
            doubleTapTray(slotIdx);
          } else {
            lastTrayTap = { slot: slotIdx, ts: now };
          }
          return;
        }
        handleHit(h.id);
        return;
      }
    }

    if (state.screen === 'playing' && state.boardLayout) {
      const b = state.boardLayout;
      const c = Math.floor((t.clientX - b.gridX) / b.cellSize);
      const r = Math.floor((t.clientY - b.gridY) / b.cellSize);
      if (r >= 0 && r < 4 && c >= 0 && c < 4) {
        tapBoardCell(r, c);
      }
    }
  });

  function handleHit(id) {
    if (id === 'lobby_start_cta') return startLevel('1-1');
    if (id === 'chapter_prev') { state.selectedChapter = Math.max(1, (state.selectedChapter || 1) - 1); render(); return true; }
    if (id === 'chapter_next') { state.selectedChapter = Math.min(3, (state.selectedChapter || 1) + 1); render(); return true; }
    if (id === 'knead_btn') return knead();
    if (id === 'dock_shop') { openModal('shop'); return true; }
    if (id === 'dock_leaderboard') { openModal('leaderboard'); return true; }
    if (id === 'modal_close') { closeModal(); return true; }
    return false;
  }

  wx.onKeyDown(({ key }) => {
    state.lastKey = key;
    state.keyCount += 1;
    if (state.screen === 'playing' && !state.activeModal) {
      if (key === 'ArrowLeft' || key === 'a') slide('left');
      else if (key === 'ArrowRight' || key === 'd') slide('right');
      else if (key === ' ') knead();
    }
  });

  wx.onHide(() => { state.hidden = true; state.hideCount += 1; });
  wx.onShow(() => { state.hidden = false; state.showCount += 1; });
  wx.onWindowResize(() => render());

  const debugApi = {
    version: '2.0',
    getState: () => ({
      ...state,
      metrics: getMetrics(),
      hits: state.hits.map((h) => ({ ...h }))
    }),
    getSaveData: () => JSON.parse(JSON.stringify(saveData)),
    setSaveData: (raw) => {
      saveData = { ...saveData, ...(raw || {}), schemaVersion: 2 };
      wx.setStorageSync('hoshi_kissa_bakery_save_v1', JSON.stringify(saveData));
      return saveData;
    },
    clickHit: (id) => !!handleHit(id),
    openLevelPreview: (id) => { state.previewLevelId = id; openModal('level_preview'); return true; },
    startLevel,
    slide,
    knead,
    tapBoardCell,
    doubleTapTray,
    useToolOnCell: () => ({ ok: true }),
    castPatronSkill: () => ({ ok: true }),
    advanceTime: (sec) => { state.timeLeft = Math.max(0, state.timeLeft - (Number(sec) || 0)); render(); },
    openModal,
    closeModal
  };

  globalThis.__HOSHI_DEBUG__ = debugApi;
  globalThis.__game = debugApi;
  render();
})();
</script>
</body>
</html>`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString('utf8');
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function startHarnessServer({ minigameDir = DEFAULT_MINIGAME_DIR } = {}) {
  const resolvedMinigameDir = path.resolve(minigameDir);
  const cloudStore = createCloudSdkStore({ minigameDir: resolvedMinigameDir });

  const MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };

  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

      if (req.method === 'POST' && urlPath === '/__wx_cloud/admin') {
        const body = await readJsonBody(req);
        const out = cloudStore.handleAdmin(body);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(out));
        return;
      }

      if (req.method === 'POST' && urlPath.startsWith('/__wx_cloud/')) {
        const fnName = urlPath.slice('/__wx_cloud/'.length);
        if (fnName !== 'kissa_sync') {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, reason: 'unknown_cloud_function:' + fnName }));
          return;
        }
        const event = await readJsonBody(req);
        const result = await cloudStore.invokeKissaSync(event);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(result));
        return;
      }

      if (urlPath === '/__self_test.html') {
        const html = buildSelfTestHtml();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
        return;
      }

      if (urlPath === '/__wx_preview.html' || urlPath === '/') {
        const moduleMap = loadMiniGameModuleMap(resolvedMinigameDir);
        const html = buildPreviewHtml(moduleMap);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
        return;
      }

      if (urlPath === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      const full = path.resolve(resolvedMinigameDir, '.' + urlPath);
      const allowedPrefix = resolvedMinigameDir.endsWith(path.sep)
        ? resolvedMinigameDir
        : resolvedMinigameDir + path.sep;
      if (!full.startsWith(allowedPrefix) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
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
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }));
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      resolve({
        server,
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        cloudStore,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

// ============================================================================
// Disk-Hygienic Chromium Launcher & Raw WebSocket CDP Client
// ============================================================================

export async function launchCdpBrowser({
  chromiumPath = resolveChromiumBinary(),
  userDataDirRoot = undefined,
  outDir = undefined
} = {}) {
  const paths = resolveVerifyPaths({ userDataDirRoot, outDir });
  const chromeRootExistedBefore = fs.existsSync(paths.chromeRoot);
  fs.mkdirSync(paths.profileDir, { recursive: true });
  fs.mkdirSync(paths.chromeTmpDir, { recursive: true });
  fs.mkdirSync(paths.chromeCacheDir, { recursive: true });
  fs.mkdirSync(paths.chromeConfigDir, { recursive: true });
  fs.mkdirSync(paths.outDir, { recursive: true });

  const cdpPort = await getFreePort();
  const chromeEnv = {
    ...process.env,
    TMPDIR: paths.chromeTmpDir,
    TMP: paths.chromeTmpDir,
    TEMP: paths.chromeTmpDir,
    XDG_CACHE_HOME: paths.chromeCacheDir,
    XDG_CONFIG_HOME: paths.chromeConfigDir,
    XDG_RUNTIME_DIR: paths.chromeTmpDir
  };
  delete chromeEnv.DBUS_SESSION_BUS_ADDRESS;

  let chrome = null;
  let ws = null;
  let chromeExit = null;
  let closed = false;

  const killProcessGroup = (sig) => {
    if (!chrome || !chrome.pid) return;
    try { process.kill(-chrome.pid, sig); } catch (_) {}
    try { chrome.kill(sig); } catch (_) {}
  };

  const wipeDirs = () => {
    const rmOpts = { recursive: true, force: true, maxRetries: 6, retryDelay: 40 };
    try { fs.rmSync(paths.runScratchDir, rmOpts); } catch (_) {}
    if (paths.separateSocketTmpDir) {
      try { fs.rmSync(paths.separateSocketTmpDir, rmOpts); } catch (_) {}
    }
    if ((paths.autoCreatedChromeRoot || !chromeRootExistedBefore) && fs.existsSync(paths.chromeRoot)) {
      try {
        const rem = fs.readdirSync(paths.chromeRoot);
        if (rem.length === 0) fs.rmdirSync(paths.chromeRoot);
      } catch (_) {}
    }
  };

  const syncKillAndWipe = () => {
    if (chrome && chromeExit === null) {
      killProcessGroup('SIGKILL');
    }
    wipeDirs();
  };

  const onSignal = (sig) => {
    syncKillAndWipe();
    process.exit(sig === 'SIGINT' ? 130 : 143);
  };

  process.on('exit', syncKillAndWipe);
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  process.on('SIGHUP', onSignal);

  const close = async () => {
    if (closed) return;
    closed = true;
    process.off('exit', syncKillAndWipe);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    process.off('SIGHUP', onSignal);

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ id: 999999, method: 'Browser.close', params: {} }));
        await sleep(30);
        ws.close();
      }
    } catch (_) {}

    if (chrome && chromeExit === null) {
      await new Promise((resolve) => {
        const killTimer = setTimeout(() => {
          killProcessGroup('SIGKILL');
          resolve();
        }, 1200);
        chrome.once('exit', () => {
          clearTimeout(killTimer);
          resolve();
        });
        killProcessGroup('SIGTERM');
      });
    }

    killProcessGroup('SIGKILL');
    await sleep(45);
    wipeDirs();
  };

  try {
    chrome = spawn(
      chromiumPath,
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
        '--disable-breakpad',
        '--disable-crash-reporter',
        '--autoplay-policy=no-user-gesture-required',
        '--mute-audio',
        `--disk-cache-dir=${paths.chromeCacheDir}`,
        '--remote-debugging-address=127.0.0.1',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${paths.profileDir}`,
        '--window-size=1280,760',
        'about:blank'
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], env: chromeEnv, detached: true }
    );

    let chromeStderr = '';
    chrome.stderr.on('data', (chunk) => {
      if (chromeStderr.length < 4000) chromeStderr += chunk.toString('utf8');
    });
    chrome.on('error', (err) => {
      chromeStderr += `\n[spawn error] ${err.message}`;
    });
    chrome.on('exit', (code, sig) => {
      chromeExit = `code=${code}, sig=${sig}`;
    });

    const pollCdpJson = () =>
      new Promise((resolve) => {
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
        req.setTimeout(800, () => {
          req.destroy();
          resolve(null);
        });
      });

    let wsUrl = null;
    for (let i = 0; i < 300; i++) {
      if (chromeExit !== null) break;
      const pages = await pollCdpJson();
      if (Array.isArray(pages) && pages.length > 0) {
        const pageTarget = pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl) || pages[0];
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          wsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      }
      await sleep(50);
    }

    if (!wsUrl) {
      throw new Error(
        `Failed to connect to Chromium CDP (bin=${chromiumPath}, exit=${chromeExit || 'running'})\n${chromeStderr}`
      );
    }

    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    let msgId = 1;
    const pending = new Map();
    const listeners = new Map();
    const errors = [];
    const networkErrors = [];
    const requestUrls = new Map();

    ws.addEventListener('message', (ev) => {
      const data = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
        else resolve(data.result);
        return;
      }
      if (!data.method) return;
      const fns = listeners.get(data.method);
      if (fns) {
        for (const fn of fns) {
          try { fn(data.params); } catch (_) {}
        }
      }
      if (data.method === 'Runtime.exceptionThrown') {
        errors.push('EXCEPTION: ' + JSON.stringify(data.params.exceptionDetails));
      } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
        errors.push('CONSOLE.ERROR: ' + JSON.stringify(data.params.args));
      } else if (data.method === 'Network.requestWillBeSent' && data.params && data.params.request) {
        requestUrls.set(data.params.requestId, data.params.request.url);
      } else if (data.method === 'Network.responseReceived' && data.params && data.params.response) {
        const resp = data.params.response;
        if (resp.status >= 400 && !String(resp.url || '').endsWith('/favicon.ico')) {
          networkErrors.push({ url: resp.url, status: resp.status, statusText: resp.statusText || '' });
        }
      } else if (data.method === 'Network.loadingFailed' && data.params) {
        const u = requestUrls.get(data.params.requestId) || '';
        if (!data.params.canceled && !u.endsWith('/favicon.ico')) {
          networkErrors.push({ url: u, status: 0, errorText: data.params.errorText || 'loadingFailed' });
        }
      }
    });

    ws.addEventListener('close', () => {
      for (const { reject } of pending.values()) {
        reject(new Error('CDP WebSocket closed'));
      }
      pending.clear();
    });

    function send(method, params = {}) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error(`Cannot send CDP ${method}: WebSocket not open`));
      }
      const id = msgId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }

    async function evalJS(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error('JS Eval Error: ' + JSON.stringify(res.exceptionDetails));
      }
      return res.result ? res.result.value : undefined;
    }

    const cdp = {
      send,
      evalJS,
      errors,
      networkErrors,
      clearErrors() {
        errors.length = 0;
        networkErrors.length = 0;
      },
      on(method, fn) {
        if (!listeners.has(method)) listeners.set(method, new Set());
        listeners.get(method).add(fn);
      },
      off(method, fn) {
        if (listeners.has(method)) listeners.get(method).delete(fn);
      }
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    return { cdp, paths, close };
  } catch (err) {
    await close();
    throw err;
  }
}

// ============================================================================
// Unified Opaque-Box TestContext (`ctx`) Factory
// ============================================================================

function partitionBoardOrderMatch(cells, reqSlots) {
  const avail = [];
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      const cell = cells[r][c];
      if (cell && cell.tile && (!cell.tile.frozenHp || cell.tile.frozenHp <= 0)) {
        avail.push({ r, c, tier: cell.tile.tier, flavor: cell.tile.flavor || 'plain' });
      }
    }
  }
  const used = new Set();
  const orderedReqs = [...reqSlots].sort((a, b) => {
    const aConstrained = a.flavor && a.flavor !== 'any' ? 0 : 1;
    const bConstrained = b.flavor && b.flavor !== 'any' ? 0 : 1;
    return aConstrained - bConstrained || b.tier - a.tier;
  });

  const matchedTiles = [];
  const missingReqs = [];
  for (const req of orderedReqs) {
    let pick = -1;
    const isConstrained = Boolean(req.flavor && req.flavor !== 'any');
    if (isConstrained) {
      pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === req.flavor);
      if (pick < 0) {
        pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === 'gold');
      }
    } else {
      pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === 'plain');
      if (pick < 0) {
        pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor !== 'gold');
      }
      if (pick < 0) {
        pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === 'gold');
      }
    }
    if (pick >= 0) {
      used.add(pick);
      matchedTiles.push({ ...avail[pick], constrained: isConstrained });
    } else {
      missingReqs.push(req);
    }
  }
  return { matchedTiles, missingReqs };
}

function findBoardMultisetMatch(cells, reqSlots) {
  const { matchedTiles, missingReqs } = partitionBoardOrderMatch(cells, reqSlots);
  return missingReqs.length === 0 ? matchedTiles : null;
}

function scoreSlideDirection(grid, dir, targetTier, targetFlavor, protectedTiles = []) {
  const rows = grid.rows;
  const cols = grid.cols;
  const cells = grid.cells;
  let moved = false;
  let mergeScore = 0;
  let dyeScore = 0;
  let adjIceBonus = 0;
  let protectPenalty = 0;

  const protectedMap = new Map();
  for (const pt of protectedTiles || []) {
    protectedMap.set(`${pt.r},${pt.c}`, pt);
  }

  const targetDyeCells = [];
  if (targetFlavor && targetFlavor !== 'any') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r] && cells[r][c];
        if (cell && (cell.type === targetFlavor || cell.type === 'gold')) {
          targetDyeCells.push({ r, c });
        }
      }
    }
  }

  const isPassable = (cell) => cell && cell.type !== 'void' && cell.type !== 'block' && !(cell.tile && cell.tile.frozenHp > 0);
  const lines = [];

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < rows; r++) {
      let seg = [];
      const order = dir === 'left' ? [...Array(cols).keys()] : [...Array(cols).keys()].reverse();
      for (const c of order) {
        if (isPassable(cells[r][c])) seg.push({ r, c, cell: cells[r][c] });
        else { if (seg.length > 0) { lines.push(seg); seg = []; } }
      }
      if (seg.length > 0) lines.push(seg);
    }
  } else {
    for (let c = 0; c < cols; c++) {
      let seg = [];
      const order = dir === 'up' ? [...Array(rows).keys()] : [...Array(rows).keys()].reverse();
      for (const r of order) {
        if (isPassable(cells[r][c])) seg.push({ r, c, cell: cells[r][c] });
        else { if (seg.length > 0) { lines.push(seg); seg = []; } }
      }
      if (seg.length > 0) lines.push(seg);
    }
  }

  for (const seg of lines) {
    const tiles = seg
      .filter((s) => s.cell.tile)
      .map((s, idx) => ({ ...s.cell.tile, r: s.r, c: s.c, origPos: seg.indexOf(s), idx }));
    let writeIdx = 0;
    for (let i = 0; i < tiles.length; i++) {
      const dest = seg[writeIdx];
      if (i + 1 < tiles.length && tiles[i].tier === tiles[i + 1].tier && tiles[i].tier < 7) {
        moved = true;
        const newTier = tiles[i].tier + 1;
        const pA = protectedMap.get(`${tiles[i].r},${tiles[i].c}`) || null;
        const pB = protectedMap.get(`${tiles[i + 1].r},${tiles[i + 1].c}`) || null;

        if (newTier <= targetTier) {
          mergeScore += newTier * 15;
          if (pA?.constrained || pB?.constrained) {
            protectPenalty += 30;
          }
        } else {
          mergeScore -= 6;
          if (pA) protectPenalty += pA.tier * 45;
          if (pB) protectPenalty += pB.tier * 45;
        }
        if (targetFlavor !== 'any' && (dest.cell.type === targetFlavor || dest.cell.type === 'gold')) {
          dyeScore += 25;
        }
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = dest.r + dr;
          const nc = dest.c + dc;
          if (cells[nr] && cells[nr][nc] && cells[nr][nc].tile && cells[nr][nc].tile.frozenHp > 0) {
            adjIceBonus += 20;
          }
        }
        i++;
      } else {
        if (tiles[i].origPos !== writeIdx) moved = true;
        const p = protectedMap.get(`${tiles[i].r},${tiles[i].c}`) || null;
        if (
          p &&
          p.constrained &&
          p.flavor !== 'gold' &&
          ((p.flavor === 'matcha' && dest.cell.type === 'berry') ||
            (p.flavor === 'berry' && dest.cell.type === 'matcha'))
        ) {
          protectPenalty += 120;
        }
        if (
          !p &&
          tiles[i].tier === targetTier &&
          targetFlavor !== 'any' &&
          tiles[i].flavor !== targetFlavor &&
          tiles[i].flavor !== 'gold'
        ) {
          if (dest.cell.type === targetFlavor || dest.cell.type === 'gold') {
            dyeScore += 45;
          } else if (targetDyeCells.length > 0 && tiles[i].origPos !== writeIdx) {
            const distBefore = Math.min(...targetDyeCells.map((dc) => Math.abs(dc.r - tiles[i].r) + Math.abs(dc.c - tiles[i].c)));
            const distAfter = Math.min(...targetDyeCells.map((dc) => Math.abs(dc.r - dest.r) + Math.abs(dc.c - dest.c)));
            if (distAfter < distBefore) {
              dyeScore += (distBefore - distAfter) * 10;
            }
          }
        }
      }
      writeIdx++;
    }
  }

  if (!moved) return -9999;
  return 1 + mergeScore + dyeScore + adjIceBonus - protectPenalty;
}

export function createTestContext({
  cdp,
  baseUrl,
  repoRoot = DEFAULT_REPO_ROOT,
  minigameDir = DEFAULT_MINIGAME_DIR,
  outDir,
  cloudStore = null
}) {
  let currentRoutePath = '';
  let currentQuery = '';
  let pendingCloudCfg = null;
  let currentVpDims = null;
  let currentSafeOpts = null;
  let currentVpKey = '';

  const waitRaf = async (frames = 1) => {
    try {
      await cdp.evalJS(`new Promise((resolve) => {
        let n = ${Math.max(1, frames)};
        const step = () => {
          if (--n <= 0) resolve(true);
          else requestAnimationFrame(step);
        };
        const t = setTimeout(() => resolve(false), ${Math.max(30, frames * 28)});
        requestAnimationFrame(() => { clearTimeout(t); step(); });
      })`);
    } catch (_) {
      await sleep(16 * frames);
    }
  };

  const ctx = {
    repoRoot,
    minigameDir,
    outDir,
    baseUrl,
    cdp,

    get currentVpKey() {
      return currentVpKey;
    },
    set currentVpKey(val) {
      currentVpKey = String(val || '');
    },

    sleep,
    assert,
    assertEq,
    assertClose,
    allUnlockedStars,
    cellCenterPx,
    readPngHeader,
    readJpegHeader,
    computePackageStats: () => computePackageStats(minigameDir),

    async waitFor(fn, opts = {}) {
      const timeoutMs = opts.timeoutMs ?? 4000;
      const intervalMs = opts.intervalMs ?? 25;
      const label = opts.label || 'waitFor condition';
      const deadline = Date.now() + timeoutMs;
      let lastErr = null;
      while (Date.now() <= deadline) {
        try {
          const val = await fn();
          if (val) return val;
        } catch (err) {
          lastErr = err;
        }
        await sleep(intervalMs);
      }
      throw new Error(`TIMEOUT (${timeoutMs}ms) waiting for ${label}${lastErr ? ': ' + lastErr.message : ''}`);
    },

    async eval(exprOrFn, ...args) {
      if (typeof exprOrFn === 'function') {
        const serializedArgs = JSON.stringify(args);
        return cdp.evalJS(`(${exprOrFn.toString()})(...${serializedArgs})`);
      }
      return cdp.evalJS(String(exprOrFn));
    },

    async getState() {
      return cdp.evalJS(`globalThis.__HOSHI_DEBUG__ ? globalThis.__HOSHI_DEBUG__.getState() : null`);
    },

    async getSaveData() {
      return cdp.evalJS(`globalThis.__HOSHI_DEBUG__ ? globalThis.__HOSHI_DEBUG__.getSaveData() : null`);
    },

    async setSaveData(rawObj) {
      let effectivePayload = rawObj;
      if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj) && rawObj.schemaVersion === undefined) {
        const v1LegacyKeys = [
          'shopUpgrades',
          'bestChef',
          'bestRush',
          'bestZen',
          'bestShiftReached',
          'activeRun',
          'savedRuns'
        ];
        const v2Keys = [
          'levelStars',
          'levelBestScores',
          'catcakeLevels',
          'deviceUpgrades',
          'seenTutorials',
          'consumableSpentStardust',
          'highestUnlockedLevel',
          'bgmTrack',
          'sfxEnabled',
          'playerProfile',
          'lifetimeStats',
          'unlockedPatrons',
          'unlockedThemes',
          'selectedPatron',
          'equippedTheme'
        ];
        const hasV1Key = v1LegacyKeys.some((k) => Object.prototype.hasOwnProperty.call(rawObj, k));
        const hasV2Key = v2Keys.some((k) => Object.prototype.hasOwnProperty.call(rawObj, k));
        if (!hasV1Key && hasV2Key) {
          const cur = (await ctx.getSaveData()) || {};
          effectivePayload = { ...cur, ...rawObj, schemaVersion: 2 };
          if (rawObj.totalEarnedStardust === undefined && rawObj.bankStardust !== undefined) {
            delete effectivePayload.totalEarnedStardust;
          }
        }
      }
      return ctx.eval((payload) => {
        globalThis.__HOSHI_DEBUG__.setSaveData(payload);
        return globalThis.__HOSHI_DEBUG__.getSaveData();
      }, effectivePayload);
    },

    async setupSaveAndStart(levelId, saveOverrides = {}, startOpts = {}) {
      const ov = saveOverrides && typeof saveOverrides === 'object' ? saveOverrides : {};
      const baseSave = createCanonicalDefaultSaveV2({ seenAllTutorials: true });
      const mergedTutorials = {
        ...baseSave.seenTutorials,
        ...(ov.seenTutorials || {})
      };
      const mergedCatcakeLevels = {
        ...baseSave.catcakeLevels,
        ...(ov.catcakeLevels || {})
      };
      const mergedDeviceUpgrades = {
        ...baseSave.deviceUpgrades,
        ...(ov.deviceUpgrades || {})
      };
      const mergedProfile = {
        ...baseSave.playerProfile,
        ...(ov.playerProfile || {})
      };
      const mergedLifetimeStats = {
        ...baseSave.lifetimeStats,
        ...(ov.lifetimeStats || {})
      };
      const selectedPatron = ov.selectedPatron || 'mikan';
      const unlockedPatrons = Array.isArray(ov.unlockedPatrons)
        ? [...ov.unlockedPatrons]
        : (selectedPatron !== 'mikan' ? ['mikan', selectedPatron] : ['mikan']);
      const equippedTheme = ov.equippedTheme || 'amber';
      const unlockedThemes = Array.isArray(ov.unlockedThemes)
        ? [...ov.unlockedThemes]
        : (equippedTheme !== 'amber' ? ['amber', equippedTheme] : ['amber']);

      const savePayload = {
        ...baseSave,
        ...ov,
        levelStars: ov.levelStars ? { ...ov.levelStars } : {},
        levelBestScores: ov.levelBestScores ? { ...ov.levelBestScores } : {},
        catcakeLevels: mergedCatcakeLevels,
        deviceUpgrades: mergedDeviceUpgrades,
        selectedPatron,
        unlockedPatrons,
        equippedTheme,
        unlockedThemes,
        seenTutorials: mergedTutorials,
        playerProfile: mergedProfile,
        lifetimeStats: mergedLifetimeStats
      };

      if (ov.totalEarnedStardust === undefined) {
        let spent = computeSpentStardustV2(savePayload);
        const targetBank = typeof savePayload.bankStardust === 'number' ? Math.max(0, Math.floor(savePayload.bankStardust)) : 30;
        if (typeof ov.bankStardust === 'number' && ov.consumableSpentStardust === undefined && targetBank + spent < 30) {
          const pad = 30 - (targetBank + spent);
          savePayload.consumableSpentStardust = (Number(savePayload.consumableSpentStardust) || 0) + pad;
          spent += pad;
        }
        savePayload.totalEarnedStardust = Math.max(30, targetBank + spent);
      }
      if (ov.lastSyncedEarnedStardust === undefined) {
        savePayload.lastSyncedEarnedStardust = savePayload.totalEarnedStardust;
      }

      await ctx.eval(
        (lid, sv, sOpts) => {
          globalThis.__HOSHI_DEBUG__.setSaveData(sv);
          globalThis.__HOSHI_DEBUG__.startLevel(lid, sOpts);
        },
        levelId,
        savePayload,
        startOpts || {}
      );
      await waitRaf(1);
      return ctx.getState();
    },

    async advanceTime(seconds) {
      await ctx.eval((sec) => {
        globalThis.__HOSHI_DEBUG__.advanceTime(sec);
      }, Number(seconds) || 0);
      await waitRaf(1);
      return ctx.getState();
    },

    async advanceBothClocks(ms) {
      const targetMs = Math.max(0, Number(ms) || 0);
      const realWait = Math.min(25, targetMs);
      const t0 = performance.now();
      if (realWait > 0) await sleep(realWait);
      const realElapsed = performance.now() - t0;
      const virtualRemain = Math.max(0, targetMs - realElapsed);
      await ctx.eval(
        (vMs, sec) => {
          if (window.__WX_HARNESS__ && typeof window.__WX_HARNESS__.advanceClockMs === 'function' && vMs > 0) {
            window.__WX_HARNESS__.advanceClockMs(vMs);
          }
          if (globalThis.__HOSHI_DEBUG__ && typeof globalThis.__HOSHI_DEBUG__.advanceTime === 'function') {
            globalThis.__HOSHI_DEBUG__.advanceTime(sec);
          }
        },
        virtualRemain,
        targetMs / 1000
      );
      await waitRaf(1);
      return ctx.getState();
    },

    async navigate(query = '?safeTop=47&safeBottom=34&capsule=1&cloud=1', routePath = '/__wx_preview.html') {
      const normRoute = routePath.startsWith('/') ? routePath : '/' + routePath;
      const normQuery = !query ? '' : (query.startsWith('?') ? query : '?' + query);
      currentRoutePath = normRoute;
      currentQuery = normQuery;

      try {
        await cdp.evalJS(`window.__HOSHI_DEBUG__ = null;`);
      } catch (_) {}

      await cdp.send('Page.navigate', { url: `${baseUrl}${normRoute}${normQuery}` });
      await ctx.waitFor(
        () =>
          cdp.evalJS(`(() => {
            if (!window.__HOSHI_DEBUG__ || typeof window.__HOSHI_DEBUG__.getState !== 'function') return false;
            const st = window.__HOSHI_DEBUG__.getState();
            return !!(st && st.assetsTotal > 0 && st.assetsLoaded === st.assetsTotal && Array.isArray(st.hits) && st.hits.length > 0);
          })()`),
        { timeoutMs: 8000, intervalMs: 25, label: `navigate(${normRoute}${normQuery})` }
      );
      const qSafe = extractQuerySafeMetrics(normQuery);
      currentSafeOpts = { safeTop: qSafe.safeTop, safeBottom: qSafe.safeBottom, showCapsule: qSafe.showCapsule };
      if (currentVpDims) {
        currentVpKey = formatViewportKey({ ...currentVpDims, ...currentSafeOpts });
      } else {
        currentVpKey = '';
      }
      if (pendingCloudCfg) {
        const cfg = pendingCloudCfg;
        pendingCloudCfg = null;
        await ctx.eval((c) => window.__WX_HARNESS__ && window.__WX_HARNESS__.setCloudConfig(c), cfg);
      }
      await waitRaf(1);
      return ctx.getState();
    },

    async reload() {
      if (!currentRoutePath) {
        return ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1', '/__wx_preview.html');
      }
      try {
        await cdp.evalJS(`window.__HOSHI_DEBUG__ = null;`);
      } catch (_) {}
      await cdp.send('Page.reload', { ignoreCache: false });
      await ctx.waitFor(
        () =>
          cdp.evalJS(`(() => {
            if (!window.__HOSHI_DEBUG__ || typeof window.__HOSHI_DEBUG__.getState !== 'function') return false;
            const st = window.__HOSHI_DEBUG__.getState();
            return !!(st && st.assetsTotal > 0 && st.assetsLoaded === st.assetsTotal && Array.isArray(st.hits) && st.hits.length > 0);
          })()`),
        { timeoutMs: 8000, intervalMs: 25, label: 'reload()' }
      );
      const effectiveSafe = currentSafeOpts || extractQuerySafeMetrics(currentQuery);
      if (currentSafeOpts) {
        try {
          await ctx.eval((so) => {
            if (window.__WX_HARNESS__ && typeof window.__WX_HARNESS__.setSystemMetricsOverride === 'function') {
              window.__WX_HARNESS__.setSystemMetricsOverride(so);
            }
          }, currentSafeOpts);
        } catch (_) {}
      }
      if (currentVpDims) {
        currentVpKey = formatViewportKey({ ...currentVpDims, ...effectiveSafe });
      } else {
        currentVpKey = '';
      }
      await waitRaf(1);
      return ctx.getState();
    },

    async resetGame(opts = {}) {
      const clearCloud = opts.clearCloud !== false;
      const clearLocal = opts.clearLocal !== false;
      const hasExplicitQuery = opts && opts.query !== undefined;
      const targetRoute = opts.routePath || currentRoutePath || '/__wx_preview.html';
      const targetQuery = hasExplicitQuery ? opts.query : (currentQuery || '?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      const preservedSafe = !hasExplicitQuery && currentSafeOpts ? { ...currentSafeOpts } : null;

      if (hasExplicitQuery) {
        const qSafe = extractQuerySafeMetrics(targetQuery);
        currentSafeOpts = { safeTop: qSafe.safeTop, safeBottom: qSafe.safeBottom, showCapsule: qSafe.showCapsule };
      }

      if (clearCloud && cloudStore) {
        cloudStore.handleAdmin({ action: 'reset' });
      }
      cdp.clearErrors();

      if (currentRoutePath !== targetRoute || currentQuery !== targetQuery) {
        if (clearLocal) {
          try {
            await cdp.evalJS(`(() => {
              if (window.wx && wx.clearStorageSync) wx.clearStorageSync();
              if (window.__WX_HARNESS__ && __WX_HARNESS__.clearCloudDb) __WX_HARNESS__.clearCloudDb();
            })()`);
          } catch (_) {}
        }
        const navState = await ctx.navigate(targetQuery, targetRoute);
        if (preservedSafe) {
          currentSafeOpts = preservedSafe;
          try {
            await ctx.eval((so) => {
              if (window.__WX_HARNESS__ && typeof window.__WX_HARNESS__.setSystemMetricsOverride === 'function') {
                window.__WX_HARNESS__.setSystemMetricsOverride(so);
              }
            }, preservedSafe);
          } catch (_) {}
          if (currentVpDims) {
            currentVpKey = formatViewportKey({ ...currentVpDims, ...preservedSafe });
          }
          await waitRaf(1);
          return ctx.getState();
        }
        return navState;
      }

      const cleanSaveJson = JSON.stringify(createCanonicalDefaultSaveV2({ seenAllTutorials: false }));
      const effectiveSafe = currentSafeOpts || extractQuerySafeMetrics(targetQuery);
      const targetSafeJson = JSON.stringify(effectiveSafe);

      const fastOk = await cdp.evalJS(`(() => {
        if (!window.__HOSHI_DEBUG__ || !window.__WX_HARNESS__) return false;
        delete window.__WX_MOCK_USERINFO__;
        delete window.__WX_MOCK_USERINFO_DENY__;
        const uBtn = document.getElementById('wx-mock-userinfo-btn');
        if (uBtn) uBtn.remove();
        window.__WX_HARNESS__.resetClockOffset();
        window.__WX_HARNESS__.resetPerTestCounters();
        if (typeof window.__WX_HARNESS__.setSystemMetricsOverride === 'function') {
          window.__WX_HARNESS__.setSystemMetricsOverride(${targetSafeJson});
        }
        if (${clearCloud}) window.__WX_HARNESS__.clearCloudDb();
        if (${clearLocal} && window.wx && typeof wx.clearStorageSync === 'function') {
          wx.clearStorageSync();
        }
        try {
          if (typeof window.__HOSHI_DEBUG__.closeModal === 'function') window.__HOSHI_DEBUG__.closeModal();
          if (${clearLocal}) {
            window.__HOSHI_DEBUG__.setSaveData(${cleanSaveJson});
          }
          let st = window.__HOSHI_DEBUG__.getState();
          if (st.screen !== 'lobby') {
            if (typeof window.__HOSHI_DEBUG__.returnToLobby === 'function') {
              window.__HOSHI_DEBUG__.returnToLobby();
              st = window.__HOSHI_DEBUG__.getState();
            } else {
              return false;
            }
          }
          if (st.screen === 'lobby' && st.selectedChapter !== undefined && st.selectedChapter !== 1) {
            for (let step = 0; step < 3; step++) {
              const cur = window.__HOSHI_DEBUG__.getState();
              if (cur.selectedChapter === undefined || cur.selectedChapter === 1) break;
              if (typeof window.__HOSHI_DEBUG__.clickHit === 'function') {
                window.__HOSHI_DEBUG__.clickHit('chapter_prev');
              } else {
                break;
              }
            }
          }
          const stAfter = window.__HOSHI_DEBUG__.getState();
          return stAfter.screen === 'lobby' && (stAfter.selectedChapter === undefined || stAfter.selectedChapter === 1);
        } catch (_) {
          return false;
        }
      })()`);

      if (!fastOk) {
        return ctx.reload();
      }
      if (currentVpDims) {
        currentVpKey = formatViewportKey({ ...currentVpDims, ...effectiveSafe });
      }
      cdp.clearErrors();
      await waitRaf(1);
      return ctx.getState();
    },

    async setViewport(width, height, mobile = width < 760, dpr = mobile ? 2 : 1, safeOpts = null) {
      const normW = Math.round(width);
      const normH = Math.round(height);
      const normMobile = Boolean(mobile);
      const normDpr = Number(dpr);
      currentVpDims = { width: normW, height: normH, mobile: normMobile, dpr: normDpr };

      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: normW,
        height: normH,
        deviceScaleFactor: normDpr,
        mobile: normMobile
      });
      if (safeOpts && typeof safeOpts === 'object') {
        const prevSafe = currentSafeOpts || (currentQuery ? extractQuerySafeMetrics(currentQuery) : { safeTop: 20, safeBottom: 0, showCapsule: true });
        currentSafeOpts = {
          safeTop: typeof safeOpts.safeTop === 'number' ? safeOpts.safeTop : prevSafe.safeTop,
          safeBottom: typeof safeOpts.safeBottom === 'number' ? safeOpts.safeBottom : prevSafe.safeBottom,
          showCapsule: typeof safeOpts.showCapsule === 'boolean' ? safeOpts.showCapsule : prevSafe.showCapsule
        };
        try {
          await ctx.eval((so) => {
            if (window.__WX_HARNESS__ && typeof window.__WX_HARNESS__.setSystemMetricsOverride === 'function') {
              window.__WX_HARNESS__.setSystemMetricsOverride(so);
            }
          }, currentSafeOpts);
        } catch (_) {}
        currentVpKey = formatViewportKey({
          ...currentVpDims,
          ...currentSafeOpts
        });
      } else {
        currentVpKey = formatViewportKey({
          ...currentVpDims,
          safeTop: 'unset',
          safeBottom: 'unset',
          showCapsule: 'unset'
        });
      }
      await waitRaf(2);
    },

    async tapCanvas(x, y, opts = {}) {
      const rx = Math.round(x);
      const ry = Math.round(y);
      const holdMs = opts.holdMs ?? 30;
      const settleMs = opts.settleMs ?? 20;
      const clickCount = opts.clickCount ?? 1;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rx, y: ry, button: 'left', buttons: 1, clickCount });
      await sleep(holdMs);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rx, y: ry, button: 'left', buttons: 0, clickCount });
      if (settleMs > 0) await sleep(settleMs);
      await waitRaf(1);
    },

    async doubleTapCanvas(x, y, opts = {}) {
      const rx = Math.round(x);
      const ry = Math.round(y);
      const holdMs = opts.holdMs ?? 22;
      const gapMs = opts.gapMs ?? 80;
      const settleMs = opts.settleMs ?? 25;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rx, y: ry, button: 'left', buttons: 1, clickCount: 1 });
      await sleep(holdMs);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rx, y: ry, button: 'left', buttons: 0, clickCount: 1 });
      await sleep(gapMs);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rx, y: ry, button: 'left', buttons: 1, clickCount: 2 });
      await sleep(holdMs);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rx, y: ry, button: 'left', buttons: 0, clickCount: 2 });
      if (settleMs > 0) await sleep(settleMs);
      await waitRaf(1);
    },

    async swipeCanvas(x1, y1, x2, y2, opts = {}) {
      const steps = Math.max(2, opts.steps ?? 6);
      const stepMs = opts.stepMs ?? 12;
      const settleMs = opts.settleMs ?? 25;
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(x1),
        y: Math.round(y1),
        button: 'left',
        buttons: 1,
        clickCount: 1
      });
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: Math.round(x1 + (x2 - x1) * t),
          y: Math.round(y1 + (y2 - y1) * t),
          button: 'left',
          buttons: 1
        });
        if (stepMs > 0) await sleep(stepMs);
      }
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: Math.round(x2),
        y: Math.round(y2),
        button: 'left',
        buttons: 0,
        clickCount: 1
      });
      if (settleMs > 0) await sleep(settleMs);
      await waitRaf(2);
    },

    async swipeBoard(dir, opts = {}) {
      const st = await ctx.getState();
      assert(st && st.boardLayout, `swipeBoard('${dir}'): boardLayout is null`);
      const b = st.boardLayout;
      const cx = Math.round(b.x + b.w * 0.5);
      const cy = Math.round(b.y + b.h * 0.5);
      const dist = opts.distancePx ?? 64;
      const vec = {
        left: [-dist, 0],
        right: [dist, 0],
        up: [0, -dist],
        down: [0, dist]
      }[dir];
      assert(vec, `Invalid swipeBoard direction: ${dir}`);
      await ctx.swipeCanvas(cx, cy, cx + vec[0], cy + vec[1], opts);
      return ctx.getState();
    },

    async clickHit(hitId, opts = {}) {
      const viaCdp = opts.viaCdp !== false;
      const scrollModalIfNeeded = opts.scrollModalIfNeeded !== false;

      let st = await ctx.getState();
      assert(st && Array.isArray(st.hits), `clickHit('${hitId}'): state.hits unavailable`);
      let rect = st.hits.find((h) => h.id === hitId) || null;

      if (!rect && scrollModalIfNeeded && st.activeModal) {
        const w = (st.metrics && st.metrics.width) || 390;
        const h = (st.metrics && st.metrics.height) || 844;
        const mx = Math.round(w * 0.5);
        const myStart = Math.round(h * 0.65);
        const myEnd = Math.round(h * 0.32);
        for (let attempt = 0; attempt < 5 && !rect; attempt++) {
          await ctx.swipeCanvas(mx, myStart, mx, myEnd, { steps: 5, stepMs: 10, settleMs: 25 });
          st = await ctx.getState();
          rect = st.hits.find((item) => item.id === hitId) || null;
        }
        if (!rect) {
          for (let attempt = 0; attempt < 5 && !rect; attempt++) {
            await ctx.swipeCanvas(mx, myEnd, mx, myStart, { steps: 5, stepMs: 10, settleMs: 25 });
            st = await ctx.getState();
            rect = st.hits.find((item) => item.id === hitId) || null;
          }
        }
      }

      assert(
        rect,
        `Hit '${hitId}' not found in HitRegistry (active: [${(st.hits || []).map((x) => x.id).join(', ')}])`
      );

      if (!viaCdp) {
        await ctx.eval((id) => globalThis.__HOSHI_DEBUG__.clickHit(id), hitId);
        await waitRaf(1);
        return rect;
      }

      await ctx.tapCanvas(rect.x + rect.w * 0.5, rect.y + rect.h * 0.5, opts);
      return rect;
    },

    async tapBoardCell(r, c, opts = { viaCdp: false }) {
      if (opts && opts.viaCdp) {
        const st = await ctx.getState();
        assert(st && st.boardLayout, `tapBoardCell(${r},${c}): boardLayout missing`);
        const pt = cellCenterPx(st.boardLayout, r, c);
        await ctx.tapCanvas(pt.x, pt.y, opts);
        return { viaCdp: true, x: pt.x, y: pt.y };
      }
      const res = await ctx.eval((row, col) => globalThis.__HOSHI_DEBUG__.tapBoardCell(row, col), r, c);
      await waitRaf(1);
      return res;
    },

    async doubleTapTray(slotIdx, opts = { viaCdp: false }) {
      if (opts && opts.viaCdp) {
        const st = await ctx.getState();
        const hit = st && st.hits ? st.hits.find((h) => h.id === `tray_slot_${slotIdx}`) : null;
        assert(hit, `doubleTapTray(${slotIdx}): tray_slot_${slotIdx} not found`);
        await ctx.doubleTapCanvas(hit.x + hit.w * 0.5, hit.y + hit.h * 0.5, opts);
        return { viaCdp: true };
      }
      const res = await ctx.eval((idx) => globalThis.__HOSHI_DEBUG__.doubleTapTray(idx), slotIdx);
      await waitRaf(1);
      return res;
    },

    async pressKey(key) {
      const def = KEY_DEFINITIONS[key] || {
        key: String(key),
        code: String(key),
        windowsVirtualKeyCode: String(key).toUpperCase().charCodeAt(0) || 0
      };
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: def.key,
        code: def.code,
        windowsVirtualKeyCode: def.windowsVirtualKeyCode,
        nativeVirtualKeyCode: def.windowsVirtualKeyCode
      });
      await sleep(12);
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: def.key,
        code: def.code,
        windowsVirtualKeyCode: def.windowsVirtualKeyCode,
        nativeVirtualKeyCode: def.windowsVirtualKeyCode
      });
      await waitRaf(1);
    },

    async slide(dir) {
      const res = await ctx.eval((d) => globalThis.__HOSHI_DEBUG__.slide(d), dir);
      await waitRaf(1);
      return res;
    },

    async knead() {
      const res = await ctx.eval(() => globalThis.__HOSHI_DEBUG__.knead());
      await waitRaf(1);
      return res;
    },

    async useToolOnCell(kind, r, c) {
      const res = await ctx.eval((k, row, col) => globalThis.__HOSHI_DEBUG__.useToolOnCell(k, row, col), kind, r, c);
      await waitRaf(1);
      return res;
    },

    async buyEmergencyTool(kind) {
      const beforeSave = await ctx.getSaveData();
      const btnId = `tool_${kind}_btn`;
      await ctx.clickHit(btnId);
      let st = await ctx.getState();
      if (st && st.activeModal === 'confirm') {
        const confirmHit = (st.hits || []).find(
          (h) =>
            /confirm|ok|yes|buy|accept/i.test(h.id) &&
            !/cancel|close|no|back|backdrop|guard/i.test(h.id)
        ) || (st.hits || []).find(
          (h) =>
            /^(btn_ok|modal_ok|ok_btn|yes_btn)$/i.test(h.id) &&
            !/cancel|close|no|back|backdrop|guard/i.test(h.id)
        );
        if (confirmHit) {
          await ctx.clickHit(confirmHit.id);
        }
      }
      st = await ctx.getState();
      const afterSave = await ctx.getSaveData();
      return {
        state: st,
        save: afterSave,
        spentDelta: (beforeSave ? beforeSave.bankStardust : 0) - (afterSave ? afterSave.bankStardust : 0)
      };
    },

    async castPatronSkill() {
      const res = await ctx.eval(() => globalThis.__HOSHI_DEBUG__.castPatronSkill());
      await waitRaf(1);
      return res;
    },

    async clearBoardExcept(keepCoords = []) {
      const keepSet = new Set(
        (keepCoords || []).map(( item ) => Array.isArray(item) ? `${item[0]},${item[1]}` : `${item.r},${item.c}`)
      );
      await ctx.eval((keepKeys) => {
        const keep = new Set(keepKeys);
        const dbg = globalThis.__HOSHI_DEBUG__;
        const st = dbg.getState();
        // Clear tray first if occupied
        for (let i = 0; i < (st.tray || []).length; i++) {
          if (st.tray[i]) dbg.doubleTapTray(i);
        }
        const cells = st.grid && st.grid.cells ? st.grid.cells : [];
        for (let r = 0; r < cells.length; r++) {
          for (let c = 0; c < cells[r].length; c++) {
            const cell = cells[r][c];
            if (cell && cell.tile && (!cell.tile.frozenHp || cell.tile.frozenHp <= 0) && !keep.has(`${r},${c}`)) {
              dbg.tapBoardCell(r, c);
              const curTray = dbg.getState().tray || [];
              const placedIdx = curTray.findIndex((t) => t !== null);
              if (placedIdx >= 0) dbg.doubleTapTray(placedIdx);
            }
          }
        }
      }, Array.from(keepSet));
      await waitRaf(1);
      return ctx.getState();
    },

    async fulfillCustomerOrder(seatIdx = null, opts = {}) {
      const lockSeat = opts.lockSeat !== false;
      const allowTools = opts.allowTools === true;
      const maxSteps = opts.maxSteps ?? 220;

      let st = await ctx.getState();
      assert(st && st.screen === 'playing', 'fulfillCustomerOrder requires active playing screen');
      const beforeScore = st.score;
      const beforeServed = st.ordersServed;

      // Wait for customer to take a seat if none present yet
      for (let w = 0; w < 6; w++) {
        const hasSeat = seatIdx !== null ? !!st.seats[seatIdx] : st.seats.some(Boolean);
        if (hasSeat || st.timeLeft <= 8.05) break;
        st = await ctx.advanceTime(0.65);
      }

      let targetIdx = seatIdx;
      if (targetIdx === null) {
        const candidates = st.seats
          .map((s, idx) => (s ? { s, idx, slots: s.slots || RECIPE_SLOTS_MAP[s.recipeId] || [] } : null))
          .filter(Boolean);
        if (candidates.length === 0) {
          return { served: false, seatIdx: null, beforeScore, afterScore: st.score, scoreDelta: 0 };
        }
        candidates.sort((a, b) => {
          const maxA = Math.max(...a.slots.map((x) => x.tier));
          const maxB = Math.max(...b.slots.map((x) => x.tier));
          if (maxA !== maxB) return maxA - maxB;
          if (a.slots.length !== b.slots.length) return a.slots.length - b.slots.length;
          return (a.s.patience / Math.max(1, a.s.maxPatience)) - (b.s.patience / Math.max(1, b.s.maxPatience));
        });
        targetIdx = candidates[0].idx;
      }

      const targetSeat = st.seats[targetIdx];
      if (!targetSeat) {
        return { served: false, seatIdx: targetIdx, beforeScore, afterScore: st.score, scoreDelta: 0 };
      }

      const reqSlots = (targetSeat.slots && targetSeat.slots.length > 0
        ? targetSeat.slots
        : RECIPE_SLOTS_MAP[targetSeat.recipeId] || [{ tier: 1, flavor: 'any' }]
      ).map((sl) => ({ tier: sl.tier, flavor: sl.flavor || 'any' }));

      if (lockSeat && st.preferredSeatIdx !== targetIdx) {
        await ctx.eval((id) => globalThis.__HOSHI_DEBUG__.clickHit(id), `seat_${targetIdx}`);
        st = await ctx.getState();
      }

      // Clear existing tray items so partial matches never prematurely trigger another seat while crafting
      for (let i = 0; i < (st.tray || []).length; i++) {
        if (st.tray[i]) {
          await ctx.doubleTapTray(i, { viaCdp: false });
        }
      }
      st = await ctx.getState();

      for (let step = 0; step < maxSteps; step++) {
        const { matchedTiles, missingReqs } = partitionBoardOrderMatch(st.grid.cells, reqSlots);
        if (missingReqs.length === 0) {
          // Synchronously load all required tiles into tray at dt = 0
          await ctx.eval((coords) => {
            for (const pt of coords) {
              globalThis.__HOSHI_DEBUG__.tapBoardCell(pt.r, pt.c);
            }
          }, matchedTiles);
          // Step simulation clock for auto-serve settle + flight
          for (let k = 0; k < 5; k++) {
            st = await ctx.advanceTime(0.16);
            if (st.ordersServed > beforeServed) break;
          }
          return {
            served: st.ordersServed > beforeServed,
            seatIdx: targetIdx,
            beforeScore,
            afterScore: st.score,
            scoreDelta: st.score - beforeScore
          };
        }

        // Determine highest missing requirement (preferring constrained flavor slots when tiers tie)
        const sortedMissing = [...missingReqs].sort((a, b) => {
          if (b.tier !== a.tier) return b.tier - a.tier;
          const aConstrained = a.flavor && a.flavor !== 'any' ? 0 : 1;
          const bConstrained = b.flavor && b.flavor !== 'any' ? 0 : 1;
          return aConstrained - bConstrained;
        });
        const highestReq = sortedMissing[0];
        const protectedSet = new Set(matchedTiles.map((pt) => `${pt.r},${pt.c}`));

        const cells = st.grid.cells;
        let playableEmpty = 0;
        let nonFrozenTiles = [];
        for (let r = 0; r < cells.length; r++) {
          for (let c = 0; c < cells[r].length; c++) {
            const cell = cells[r][c];
            if (!cell || cell.type === 'void' || cell.type === 'block') continue;
            if (!cell.tile) playableEmpty++;
            else if (!cell.tile.frozenHp || cell.tile.frozenHp <= 0) {
              nonFrozenTiles.push({ r, c, tier: cell.tile.tier, flavor: cell.tile.flavor || 'plain' });
            }
          }
        }

        if (allowTools && st.toolCounts && st.toolCounts.spoon > 0) {
          const cand = nonFrozenTiles.find(
            (t) =>
              !protectedSet.has(`${t.r},${t.c}`) &&
              t.tier === highestReq.tier - 1 &&
              (highestReq.flavor === 'any' || t.flavor === highestReq.flavor || t.flavor === 'gold')
          );
          if (cand) {
            await ctx.useToolOnCell('spoon', cand.r, cand.c);
            st = await ctx.getState();
            continue;
          }
        }

        // Evaluate 4 slide directions while penalizing destruction of already-matched unique high-tier tiles
        const dirs = ['left', 'down', 'right', 'up'];
        const scoredDirs = dirs
          .map((d) => ({ dir: d, score: scoreSlideDirection(st.grid, d, highestReq.tier, highestReq.flavor, matchedTiles) }))
          .filter((x) => x.score > -9000)
          .sort((a, b) => b.score - a.score);

        if (
          (nonFrozenTiles.length < 2 ||
            scoredDirs.length === 0 ||
            scoredDirs[0].score < 0 ||
            (scoredDirs[0].score <= 1 && playableEmpty >= 2)) &&
          playableEmpty > 0
        ) {
          await ctx.advanceBothClocks(130);
          await ctx.knead();
          st = await ctx.getState();
          continue;
        }

        if (scoredDirs.length > 0) {
          const canPerturb =
            step % 5 === 4 &&
            scoredDirs.length > 1 &&
            scoredDirs[1].score >= 0 &&
            scoredDirs[0].score - scoredDirs[1].score <= 25;
          const pickIdx = canPerturb ? 1 : 0;
          await ctx.slide(scoredDirs[pickIdx].dir);
          st = await ctx.getState();
          continue;
        }

        // Full board deadlock recovery via tray + trash discard (0 score penalty, sparing matched tiles first)
        if (nonFrozenTiles.length > 0) {
          nonFrozenTiles.sort((a, b) => {
            const ap = protectedSet.has(`${a.r},${a.c}`) ? 1 : 0;
            const bp = protectedSet.has(`${b.r},${b.c}`) ? 1 : 0;
            return ap - bp || a.tier - b.tier;
          });
          const victim = nonFrozenTiles[0];
          await ctx.eval((vr, vc) => {
            const dbg = globalThis.__HOSHI_DEBUG__;
            dbg.tapBoardCell(vr, vc);
            const tIdx = (dbg.getState().tray || []).findIndex((x) => x !== null);
            if (tIdx >= 0) dbg.doubleTapTray(tIdx);
          }, victim.r, victim.c);
          st = await ctx.getState();
        } else {
          break;
        }
      }

      st = await ctx.getState();
      return {
        served: st.ordersServed > beforeServed,
        seatIdx: targetIdx,
        beforeScore,
        afterScore: st.score,
        scoreDelta: st.score - beforeScore
      };
    },

    async getHarnessState() {
      const browserSnap = await cdp.evalJS(`(() => {
        if (!window.__WX_HARNESS__) return null;
        const h = window.__WX_HARNESS__;
        const audio = h.getAudioStats();
        return {
          vibrateCount: h.vibrateCount,
          shareSetupCount: h.shareSetupCount,
          shareCallCount: h.shareCallCount,
          lastShareMenuOpts: h.lastShareMenuOpts,
          lastSharePayload: h.lastSharePayload,
          sharePreview: h.getSharePreview(),
          timelineSharePreview: h.getTimelineSharePreview(),
          privacyHookRegistered: h.privacyHookRegistered,
          lastFriendCloudKV: h.lastFriendCloudKV,
          friendCloudHistory: h.friendCloudHistory,
          userInfoTapCount: h.userInfoTapCount,
          storageWriteCount: h.storageWriteCount,
          cloudInited: h.cloudInited,
          cloudEnv: h.cloudEnv,
          clockOffsetMs: h.getClockOffsetMs(),
          menuRect: h.getMenuRect(),
          gradientStats: { totalStops: h.gradientStats.totalStops, hslViolations: [...h.gradientStats.hslViolations] },
          hslViolations: [...h.gradientStats.hslViolations],
          emojiStats: { totalCalls: h.emojiStats.totalCalls, violations: [...h.emojiStats.violations] },
          emojiViolations: [...h.emojiStats.violations],
          audioStats: audio,
          audioSpy: audio,
          cloudInspector: h.getCloudInspector()
        };
      })()`);
      return {
        ...(browserSnap || {}),
        nodeCloudInspector: cloudStore ? cloudStore.handleAdmin({ action: 'inspect' }) : null
      };
    },

    async resetAudioStats() {
      return cdp.evalJS(`window.__WX_HARNESS__ ? window.__WX_HARNESS__.resetAudioStats() : null`);
    },

    async setCloudConfig(cfg = {}) {
      let handledNodeAdmin = false;
      if (cloudStore && cfg.useBuiltInMock !== true) {
        cloudStore.handleAdmin({
          action: cfg.reset ? 'reset' : (cfg.bumpRevision ? 'bumpRevision' : 'config'),
          ...cfg
        });
        handledNodeAdmin = true;
      }
      const hasPage = await cdp.evalJS(`Boolean(window.__WX_HARNESS__)`);
      if (hasPage) {
        const browserCfg = handledNodeAdmin ? { ...cfg, __skipAdminFetch: true } : cfg;
        await ctx.eval((c) => window.__WX_HARNESS__.setCloudConfig(c), browserCfg);
      } else {
        pendingCloudCfg = {
          ...(pendingCloudCfg || {}),
          ...cfg,
          ...(handledNodeAdmin ? { __skipAdminFetch: true } : {})
        };
      }
    },

    async callCloud(data = {}, opts = {}) {
      const fnName = opts.name || 'kissa_sync';
      if (opts.directNode && cloudStore) {
        const res = await cloudStore.invokeKissaSync(data);
        if (res && typeof res === 'object') {
          Object.defineProperty(res, 'result', { value: res, enumerable: false, configurable: true });
        }
        return res;
      }
      const wrapped = await ctx.eval(
        async (name, payload) => {
          if (!window.wx || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
            throw new Error('wx.cloud is unavailable');
          }
          return await wx.cloud.callFunction({ name, data: payload });
        },
        fnName,
        data
      );
      const out = wrapped && wrapped.result !== undefined ? wrapped.result : wrapped;
      if (out && typeof out === 'object') {
        Object.defineProperty(out, 'result', { value: out, enumerable: false, configurable: true });
      }
      return out;
    },

    async flushCloudSync(waitMs = 2200) {
      const deadline = Date.now() + waitMs;
      let st = await ctx.getState();
      while (Date.now() < deadline) {
        if (st && (st.cloudStatus === 'synced' || st.cloudStatus === 'local_only')) {
          break;
        }
        await sleep(60);
        try {
          st = await ctx.advanceBothClocks(120);
        } catch (_) {
          st = await ctx.getState();
        }
      }
      return st;
    },

    requireBundledModule(relPath) {
      return loadBundledModuleFromDisk(minigameDir, relPath);
    },

    async inspectImagePixels(assetRelUrl, regions = []) {
      const normUrl = assetRelUrl.startsWith('/') || assetRelUrl.startsWith('http')
        ? assetRelUrl
        : '/' + assetRelUrl;
      return ctx.eval(
        async (url, regs) => {
          const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('Failed to load image: ' + url));
            el.src = url;
          });
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const cv = document.createElement('canvas');
          cv.width = w;
          cv.height = h;
          const c2d = cv.getContext('2d', { willReadFrequently: true });
          c2d.drawImage(img, 0, 0);
          const full = c2d.getImageData(0, 0, w, h).data;

          const boxMaxAlpha = (x0, y0, bw, bh) => {
            let maxA = 0;
            for (let y = Math.max(0, y0); y < Math.min(h, y0 + bh); y++) {
              for (let x = Math.max(0, x0); x < Math.min(w, x0 + bw); x++) {
                const a = full[(y * w + x) * 4 + 3];
                if (a > maxA) maxA = a;
              }
            }
            return maxA;
          };

          const cornersMaxAlpha = Math.max(
            boxMaxAlpha(0, 0, 4, 4),
            boxMaxAlpha(Math.max(0, w - 4), 0, 4, 4),
            boxMaxAlpha(0, Math.max(0, h - 4), 4, 4),
            boxMaxAlpha(Math.max(0, w - 4), Math.max(0, h - 4), 4, 4)
          );

          let perimeter3pxMaxAlpha = 0;
          let opaque128 = 0;
          let opaque96 = 0;
          let l1Total = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const a = full[i + 3];
              if (a > 128) opaque128++;
              if (a > 96) opaque96++;
              if (x < 3 || x >= w - 3 || y < 3 || y >= h - 3) {
                if (a > perimeter3pxMaxAlpha) perimeter3pxMaxAlpha = a;
              }
              l1Total += full[i] + full[i + 1] + full[i + 2] + a;
            }
          }

          const regionStats = (regs || []).map((rg, idx) => {
            const rx = Math.max(0, Math.floor(rg.x || 0));
            const ry = Math.max(0, Math.floor(rg.y || 0));
            const rw = Math.max(1, Math.min(w - rx, Math.floor(rg.w || 1)));
            const rh = Math.max(1, Math.min(h - ry, Math.floor(rg.h || 1)));
            const thresh = rg.alphaThreshold ?? 128;
            let minAlpha = 255;
            let maxAlpha = 0;
            let sumAlpha = 0;
            let sumR = 0, sumG = 0, sumB = 0;
            let cntThresh = 0, cnt96 = 0, cnt220 = 0;
            const totalPx = rw * rh;
            for (let y = ry; y < ry + rh; y++) {
              for (let x = rx; x < rx + rw; x++) {
                const i = (y * w + x) * 4;
                const a = full[i + 3];
                if (a < minAlpha) minAlpha = a;
                if (a > maxAlpha) maxAlpha = a;
                sumAlpha += a;
                sumR += full[i];
                sumG += full[i + 1];
                sumB += full[i + 2];
                if (a > thresh) cntThresh++;
                if (a > 96) cnt96++;
                if (a > 220) cnt220++;
              }
            }
            const cellCornersMaxAlpha = Math.max(
              boxMaxAlpha(rx, ry, Math.min(4, rw), Math.min(4, rh)),
              boxMaxAlpha(rx + Math.max(0, rw - 4), ry, Math.min(4, rw), Math.min(4, rh)),
              boxMaxAlpha(rx, ry + Math.max(0, rh - 4), Math.min(4, rw), Math.min(4, rh)),
              boxMaxAlpha(rx + Math.max(0, rw - 4), ry + Math.max(0, rh - 4), Math.min(4, rw), Math.min(4, rh))
            );
            return {
              name: rg.name || `region_${idx}`,
              x: rx,
              y: ry,
              w: rw,
              h: rh,
              minAlpha,
              maxAlpha,
              meanAlpha: sumAlpha / totalPx,
              opaqueRatio: cntThresh / totalPx,
              opaqueRatio96: cnt96 / totalPx,
              opaqueRatio220: cnt220 / totalPx,
              cornersMaxAlpha: cellCornersMaxAlpha,
              meanR: sumR / totalPx,
              meanG: sumG / totalPx,
              meanB: sumB / totalPx
            };
          });

          return {
            naturalWidth: w,
            naturalHeight: h,
            cornersMaxAlpha,
            perimeter3pxMaxAlpha,
            opaqueRatio128: opaque128 / Math.max(1, w * h),
            opaqueRatio96: opaque96 / Math.max(1, w * h),
            l1Total,
            regionStats
          };
        },
        normUrl,
        regions
      );
    },

    async captureScreenshot(name) {
      fs.mkdirSync(outDir, { recursive: true });
      const cleanName = String(name || 'screenshot').endsWith('.png') ? String(name) : `${name}.png`;
      const outPath = path.join(outDir, cleanName);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(data, 'base64');
      fs.writeFileSync(outPath, buf);
      const hdr = readPngHeader(outPath);
      assert(hdr.bytes > 1024, `Screenshot ${cleanName} unexpectedly small (${hdr.bytes}B)`);
      return { path: outPath, bytes: hdr.bytes, width: hdr.width, height: hdr.height };
    },

    async checkBounds(label = 'bounds', opts = {}) {
      const info = await cdp.evalJS(`(() => {
        const st = window.__HOSHI_DEBUG__.getState();
        const win = window.wx.getWindowInfo();
        const cap = window.wx.getMenuButtonBoundingClientRect();
        const docEl = document.documentElement;
        const h = window.__WX_HARNESS__;
        const audio = h && typeof h.getAudioStats === 'function' ? h.getAudioStats() : (h && h.audioStats ? h.audioStats : null);
        return {
          hits: st.hits || [],
          assetsLoaded: st.assetsLoaded,
          assetsTotal: st.assetsTotal,
          metrics: st.metrics || null,
          win,
          cap,
          scrollW: docEl ? docEl.scrollWidth : window.innerWidth,
          scrollH: docEl ? docEl.scrollHeight : window.innerHeight,
          innerW: window.innerWidth,
          innerH: window.innerHeight,
          hslViolations: h && h.gradientStats ? [...(h.gradientStats.hslViolations || [])] : [],
          emojiViolations: h && h.emojiStats ? [...(h.emojiStats.violations || [])] : [],
          externalAudioElements: audio ? Number(audio.externalAudioElements) || 0 : 0
        };
      })()`);

      const width = opts.width ?? (info.metrics ? info.metrics.width : info.win.windowWidth);
      const height = opts.height ?? (info.metrics ? info.metrics.height : info.win.windowHeight);
      const safeBottom = opts.safeBottom ?? (info.metrics ? info.metrics.safeBottom : Math.max(0, height - info.win.safeArea.bottom));

      if (opts.checkAssets !== false) {
        assert(
          info.assetsTotal > 0 && info.assetsLoaded === info.assetsTotal,
          `${label}: assets not ready (${info.assetsLoaded}/${info.assetsTotal})`
        );
        if (typeof opts.expectedAssetsTotal === 'number') {
          assertEq(info.assetsTotal, opts.expectedAssetsTotal, `${label}: expectedAssetsTotal`);
        }
      }

      if (opts.checkCompatGuards !== false) {
        assert(
          info.hslViolations.length === 0,
          `${label}: iOS hsl()/hsla() gradient violation: ${JSON.stringify(info.hslViolations[0])}`
        );
        assert(
          info.emojiViolations.length === 0,
          `${label}: native color emoji Canvas violation: ${JSON.stringify(info.emojiViolations[0])}`
        );
        assert(
          info.externalAudioElements === 0,
          `${label}: external HTMLAudioElement violation (count=${info.externalAudioElements})`
        );
      }

      assert(
        info.scrollW <= info.innerW + 1 && info.scrollH <= info.innerH + 1,
        `${label}: unexpected document scrollbars (${info.scrollW}x${info.scrollH} > ${info.innerW}x${info.innerH})`
      );

      const SKIP_GUARDS = new Set([
        'modal_backdrop',
        'modal_body_guard',
        'tutorial_backdrop',
        'spotlight_backdrop',
        'guide_backdrop',
        'confirm_backdrop'
      ]);

      let checked = 0;
      for (const h of info.hits) {
        if (SKIP_GUARDS.has(h.id)) continue;
        checked++;
        assert(h.x >= -1 && h.y >= -1, `${label}: hit '${h.id}' out of top-left (${h.x}, ${h.y})`);
        assert(h.x + h.w <= width + 2, `${label}: hit '${h.id}' exceeds viewport width (${h.x + h.w} > ${width})`);
        assert(
          h.y + h.h <= height - safeBottom + 2,
          `${label}: hit '${h.id}' intrudes into bottom safe area (${h.y + h.h} > ${height - safeBottom})`
        );
        if (info.cap) {
          const overlapY = h.y < info.cap.bottom + 2 && h.y + h.h > info.cap.top - 2;
          if (overlapY) {
            const overlapX = h.x < info.cap.right + 2 && h.x + h.w > info.cap.left - 2;
            assert(
              !overlapX,
              `${label}: hit '${h.id}' (${h.x},${h.y},${h.w}x${h.h}) overlaps WeChat capsule (${JSON.stringify(info.cap)})`
            );
            if (h.x < info.cap.left) {
              assert(
                h.x + h.w <= info.cap.left - 8 + 2,
                `${label}: hit '${h.id}' violates 8px capsule clearance (right=${h.x + h.w} > ${info.cap.left - 8})`
              );
            }
          }
        }
      }

      return {
        label,
        width,
        height,
        safeBottom,
        hitsChecked: checked,
        assetsLoaded: info.assetsLoaded,
        assetsTotal: info.assetsTotal,
        menuRect: info.cap
      };
    }
  };

  return ctx;
}
