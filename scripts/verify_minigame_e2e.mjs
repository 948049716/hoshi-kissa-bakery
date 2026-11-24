#!/usr/bin/env node
/**
 * 《一起做猫饼》(Hoshi Kissa Bakery v2.0) Opaque-Box 4-Tier E2E Runner & Self-Test CLI.
 *
 * Supported CLI Flags:
 *   node scripts/verify_minigame_e2e.mjs                  # Run all tiers (1 -> 2 -> 3 -> 4 [+ 5 if present])
 *   node scripts/verify_minigame_e2e.mjs --tier 1         # Run Tier 1 (supports 1|2|3|4|5|all or 1,2)
 *   node scripts/verify_minigame_e2e.mjs --feature F07    # Filter by feature ID (F01..F16)
 *   node scripts/verify_minigame_e2e.mjs --case T1-F07-01 # Run exact test case ID(s)
 *   node scripts/verify_minigame_e2e.mjs --filter multiset# Case-insensitive substring filter
 *   node scripts/verify_minigame_e2e.mjs --out-dir <dir>  # Override VERIFY_OUT_DIR output path
 *   node scripts/verify_minigame_e2e.mjs --list           # Zero-browser inventory & F01..F16 coverage matrix gate
 *   node scripts/verify_minigame_e2e.mjs --dry-run        # Alias for --list (zero browser spawns, zero dirs)
 *   node scripts/verify_minigame_e2e.mjs --self-test      # 12-check harness & CDP infrastructure self-test
 *   node scripts/verify_minigame_e2e.mjs --help           # Show CLI usage help
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DEFAULT_REPO_ROOT,
  DEFAULT_MINIGAME_DIR,
  VIEWPORT_PRESETS,
  FEATURE_IDS,
  assert,
  assertEq,
  readPngHeader,
  extractQuerySafeMetrics,
  formatViewportKey,
  createCloudSdkStore,
  startHarnessServer,
  launchCdpBrowser,
  createTestContext
} from './e2e_harness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printUsage() {
  console.log(`Usage: node scripts/verify_minigame_e2e.mjs [options]

Options:
  --tier <1..5|all>     Run specific tier(s), e.g. --tier 1 or --tier 1,2 or --tier all
  --feature <F01..F16>  Filter by comma-separated feature ID(s)
  --case <ID[,ID...]>   Filter by exact comma-separated test case ID(s)
  --filter <substring>  Case-insensitive substring filter on test ID/title/features
  --out-dir <path>      Override VERIFY_OUT_DIR for screenshots & e2e_summary.json
  --list, --dry-run     Zero-browser inventory & F01..F16 coverage matrix validation
  --self-test           Run 12-check harness & CDP infrastructure self-test
  --help, -h            Display this help message`);
}

function failCli(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function readRequiredFlagValue(argv, idx, flagName, disallowLeadingDash = true) {
  const raw = argv[idx];
  if (raw.includes('=')) {
    const val = raw.slice(raw.indexOf('=') + 1).trim();
    if (!val) {
      failCli(`Missing or empty value for ${flagName}`);
    }
    return { val, nextIdx: idx };
  }
  if (idx + 1 >= argv.length) {
    failCli(`Missing value for ${flagName}`);
  }
  const nextRaw = argv[idx + 1];
  if ((disallowLeadingDash ? nextRaw.startsWith('-') : nextRaw.startsWith('--')) || !nextRaw.trim()) {
    failCli(`Missing or invalid value '${nextRaw}' for ${flagName}`);
  }
  return { val: nextRaw.trim(), nextIdx: idx + 1 };
}

function parseCliArgs(argv) {
  const opts = {
    tiers: null,
    filter: '',
    cases: [],
    features: [],
    outDir: undefined,
    list: false,
    selfTest: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw === '--help' || raw === '-h') {
      opts.help = true;
    } else if (raw === '--list' || raw === '--dry-run') {
      opts.list = true;
    } else if (raw === '--self-test') {
      opts.selfTest = true;
    } else if (raw === '--tier' || raw.startsWith('--tier=')) {
      const { val, nextIdx } = readRequiredFlagValue(argv, i, '--tier', true);
      i = nextIdx;
      const tokens = val.split(',').map((s) => s.trim());
      if (tokens.some((t) => !t)) {
        failCli(`Invalid empty token in --tier '${val}'`);
      }
      if (tokens.length === 1 && tokens[0] === 'all') {
        opts.tiers = null;
      } else {
        const parsedTiers = [];
        for (const tok of tokens) {
          if (!/^[1-5]$/.test(tok)) {
            failCli(`Invalid --tier token '${tok}' in '${val}' (expected 'all' or 1..5)`);
          }
          const n = Number(tok);
          if (!parsedTiers.includes(n)) parsedTiers.push(n);
        }
        opts.tiers = parsedTiers;
      }
    } else if (raw === '--filter' || raw.startsWith('--filter=')) {
      const { val, nextIdx } = readRequiredFlagValue(argv, i, '--filter', false);
      i = nextIdx;
      opts.filter = val;
    } else if (raw === '--case' || raw.startsWith('--case=')) {
      const { val, nextIdx } = readRequiredFlagValue(argv, i, '--case', true);
      i = nextIdx;
      const items = val.split(',').map((s) => s.trim());
      if (items.length === 0 || items.some((s) => !s)) {
        failCli(`Invalid or empty case ID in --case '${val}'`);
      }
      opts.cases.push(...items);
    } else if (raw === '--feature' || raw.startsWith('--feature=')) {
      const { val, nextIdx } = readRequiredFlagValue(argv, i, '--feature', true);
      i = nextIdx;
      const items = val.split(',').map((s) => s.trim().toUpperCase());
      if (items.length === 0 || items.some((s) => !s)) {
        failCli(`Invalid or empty feature ID in --feature '${val}'`);
      }
      opts.features.push(...items);
    } else if (raw === '--out-dir' || raw.startsWith('--out-dir=')) {
      const { val, nextIdx } = readRequiredFlagValue(argv, i, '--out-dir', false);
      i = nextIdx;
      opts.outDir = path.resolve(val);
      process.env.VERIFY_OUT_DIR = opts.outDir;
    } else {
      failCli(`Unknown or unexpected CLI argument: '${raw}'`);
    }
  }

  return opts;
}

function defaultQueryForViewport(vp) {
  if (vp && typeof vp.query === 'string' && vp.query) return vp.query;
  if (!vp) return VIEWPORT_PRESETS.IPHONE_390.query;
  if (vp.width >= 900) return VIEWPORT_PRESETS.DESKTOP_1280.query;
  if (vp.height <= 700) return VIEWPORT_PRESETS.SE_375.query;
  return VIEWPORT_PRESETS.IPHONE_390.query;
}

function extractTestsFromModule(mod, tierNum, filePath) {
  const candidates = [
    mod[`TIER${tierNum}_TESTS`],
    mod[`tier${tierNum}Tests`],
    mod.TESTS,
    mod.tests,
    mod.default
  ];
  for (const cand of candidates) {
    if (Array.isArray(cand)) return cand;
  }
  for (const val of Object.values(mod)) {
    if (Array.isArray(val) && val.every((x) => x && typeof x === 'object' && typeof x.id === 'string')) {
      return val;
    }
  }
  throw new Error(`Module ${filePath} did not export a test array (expected TIER${tierNum}_TESTS or default array)`);
}

async function loadTierSuites(requestedTiers = null) {
  const tierFiles = [
    { tier: 1, file: path.join(__dirname, 'e2e_tier1.mjs'), required: true },
    { tier: 2, file: path.join(__dirname, 'e2e_tier2.mjs'), required: true },
    { tier: 3, file: path.join(__dirname, 'e2e_tier3.mjs'), required: true },
    { tier: 4, file: path.join(__dirname, 'e2e_tier4.mjs'), required: true },
    { tier: 5, file: path.join(__dirname, 'e2e_tier5_adversarial.mjs'), required: false }
  ];

  const allCases = [];
  for (const spec of tierFiles) {
    if (requestedTiers && !requestedTiers.includes(spec.tier)) continue;
    if (!fs.existsSync(spec.file)) {
      if (spec.required) {
        throw new Error(`Missing required tier module: ${spec.file}`);
      }
      continue;
    }
    const mod = await import(pathToFileURL(spec.file).href);
    const list = extractTestsFromModule(mod, spec.tier, spec.file);
    for (const tc of list) {
      allCases.push(tc);
    }
  }
  return allCases;
}

function validateAndSummarizeInventory(cases) {
  const errors = [];
  const seenIds = new Set();
  const byTier = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const matrix = {};
  for (const f of FEATURE_IDS) {
    matrix[f] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }

  for (const tc of cases) {
    if (!tc || typeof tc !== 'object') {
      errors.push('Invalid non-object TestCase entry');
      continue;
    }
    if (typeof tc.id !== 'string' || !tc.id.trim()) {
      errors.push(`TestCase missing string id: ${JSON.stringify(tc)}`);
      continue;
    }
    if (seenIds.has(tc.id)) {
      errors.push(`Duplicate TestCase id: ${tc.id}`);
    }
    seenIds.add(tc.id);

    if (!Number.isInteger(tc.tier) || tc.tier < 1 || tc.tier > 5) {
      errors.push(`${tc.id}: invalid tier '${tc.tier}' (expected 1..5)`);
      continue;
    }
    if (!Array.isArray(tc.features) || tc.features.length === 0) {
      errors.push(`${tc.id}: features must be a non-empty array of F01..F16`);
    } else {
      for (const f of tc.features) {
        if (!FEATURE_IDS.includes(f)) {
          errors.push(`${tc.id}: unknown feature ID '${f}'`);
        } else {
          matrix[f][tc.tier]++;
        }
      }
    }
    if (typeof tc.title !== 'string' || !tc.title.trim()) {
      errors.push(`${tc.id}: missing non-empty title`);
    }
    if (typeof tc.run !== 'function') {
      errors.push(`${tc.id}: missing async run(ctx) function`);
    }
    byTier[tc.tier].push(tc);
  }

  return { errors, byTier, matrix };
}

async function runListCommand() {
  const allCases = await loadTierSuites([1, 2, 3, 4, 5]);
  const { errors, byTier, matrix } = validateAndSummarizeInventory(allCases);

  console.log('=== Hoshi Kissa v2.0 Opaque-Box E2E Test Inventory ===\n');
  for (const tc of allCases) {
    console.log(`  [Tier ${tc.tier}] ${tc.id.padEnd(12)} (${(tc.features || []).join(',').padEnd(11)}) ${tc.title}`);
  }

  console.log('\n=== Feature × Tier Coverage Matrix (F01..F16) ===');
  console.log('| Feature | Tier 1 (>=5) | Tier 2 (>=5) | Tier 3 (>=1) | Tier 4 | Total |');
  console.log('| :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const f of FEATURE_IDS) {
    const row = matrix[f];
    const sum = row[1] + row[2] + row[3] + row[4] + row[5];
    console.log(
      `| ${f}   | ${String(row[1]).padStart(12)} | ${String(row[2]).padStart(12)} | ${String(row[3]).padStart(12)} | ${String(row[4]).padStart(6)} | ${String(sum).padStart(5)} |`
    );
  }

  const gateErrors = [...errors];
  if (byTier[1].length < 80) gateErrors.push(`Tier 1 count ${byTier[1].length} < 80 minimum`);
  if (byTier[2].length < 80) gateErrors.push(`Tier 2 count ${byTier[2].length} < 80 minimum`);
  if (byTier[3].length < 16) gateErrors.push(`Tier 3 count ${byTier[3].length} < 16 minimum`);
  if (byTier[4].length < 8) gateErrors.push(`Tier 4 count ${byTier[4].length} < 8 minimum`);

  for (const f of FEATURE_IDS) {
    if (matrix[f][1] < 5) gateErrors.push(`Feature ${f} has only ${matrix[f][1]} Tier 1 tests (< 5)`);
    if (matrix[f][2] < 5) gateErrors.push(`Feature ${f} has only ${matrix[f][2]} Tier 2 tests (< 5)`);
    if (matrix[f][3] < 1) gateErrors.push(`Feature ${f} has only ${matrix[f][3]} Tier 3 tests (< 1)`);
  }

  console.log(
    `\nTotals: T1=${byTier[1].length}, T2=${byTier[2].length}, T3=${byTier[3].length}, T4=${byTier[4].length}` +
      (byTier[5].length > 0 ? `, T5=${byTier[5].length}` : '') +
      ` | Grand Total = ${allCases.length}`
  );

  if (gateErrors.length > 0) {
    console.error('\n[FAIL] Coverage / Schema Gate Violations:');
    for (const e of gateErrors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('[PASS] All F01..F16 schema & 4-tier coverage gates satisfied (0 browser launches, 0 dirs created).');
}

// ============================================================================
// 12-Check Harness & CDP Self-Test (`--self-test`, ST-01..ST-12)
// ============================================================================

async function runSelfTest(cliOpts = {}) {
  const tmpSnapshotBefore = fs.existsSync('/tmp') ? fs.readdirSync('/tmp').sort() : [];
  const serverHandle = await startHarnessServer({ minigameDir: DEFAULT_MINIGAME_DIR });
  let browserHandle = null;
  const results = [];

  async function check(id, title, fn) {
    const t0 = Date.now();
    try {
      await fn();
      const ms = Date.now() - t0;
      results.push({ id, title, ok: true, ms });
      console.log(`[PASS] ${id} (${ms}ms) — ${title}`);
    } catch (err) {
      const ms = Date.now() - t0;
      results.push({ id, title, ok: false, ms, error: err && err.stack ? err.stack : String(err) });
      console.error(`[FAIL] ${id} (${ms}ms) — ${title}\n  ${err && err.message ? err.message : err}`);
    }
  }

  try {
    browserHandle = await launchCdpBrowser({ outDir: cliOpts.outDir });
    const { cdp, paths } = browserHandle;
    const ctx = createTestContext({
      cdp,
      baseUrl: serverHandle.baseUrl,
      repoRoot: DEFAULT_REPO_ROOT,
      minigameDir: DEFAULT_MINIGAME_DIR,
      outDir: paths.outDir,
      cloudStore: serverHandle.cloudStore
    });

    // ST-01: Boot /__self_test.html on 390x844, verify __HOSHI_DEBUG__ v0.9.0 contract, requireBundledModule & bounds
    await check('ST-01', 'Boot /__self_test.html (390x844 dpr=2), __HOSHI_DEBUG__ v0.9.0 alias, requireBundledModule & capsule-safe bounds', async () => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      const st = await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1', '/__self_test.html');
      const meta = await ctx.eval(() => ({
        version: globalThis.__HOSHI_DEBUG__.version,
        sameRef: globalThis.__game === globalThis.__HOSHI_DEBUG__
      }));
      assertEq(meta.version, '0.9.0', 'debug version');
      assert(meta.sameRef, '__game must alias __HOSHI_DEBUG__');
      assertEq(st.assetsLoaded, 69, 'assetsLoaded');
      assertEq(st.assetsTotal, 69, 'assetsTotal');
      const constsMod = await ctx.requireBundledModule('./src/constants.js');
      assertEq(typeof constsMod.getCatcakePrice, 'function', 'requireBundledModule must preserve exported JS functions');
      assertEq(constsMod.getCatcakePrice(1, 1), 35, 'getCatcakePrice(1, 1) must equal 35');
      const b = await ctx.checkBounds('ST-01_390x844', { expectedAssetsTotal: 69 });
      assert(b.hitsChecked >= 4, 'expected interactive hits on lobby');
    });

    // ST-02: Positive capsule collision detection in ctx.checkBounds()
    await check('ST-02', 'Positive capsule overlap detection & recovery in ctx.checkBounds()', async () => {
      await ctx.eval(() => {
        window.__SELF_TEST_FORCE_CAPSULE_OVERLAP__ = true;
        window.dispatchEvent(new Event('resize'));
      });
      let caught = null;
      try {
        await ctx.checkBounds('ST-02_expected_overlap');
      } catch (err) {
        caught = err;
      }
      assert(caught && /capsule/i.test(caught.message), 'checkBounds must throw on capsule collision');
      await ctx.eval(() => {
        window.__SELF_TEST_FORCE_CAPSULE_OVERLAP__ = false;
        window.dispatchEvent(new Event('resize'));
      });
      await ctx.checkBounds('ST-02_recovered');
    });

    // ST-03: iOS CanvasGradient hsl()/hsla() guard & native emoji guard (including VS16 color emojis)
    await check('ST-03', 'iOS CanvasGradient hsl()/hsla() SyntaxError guard & Canvas native emoji spy (Emoji_Presentation + VS16)', async () => {
      const guardRes = await ctx.eval(() => {
        const cv = document.createElement('canvas');
        const c2 = cv.getContext('2d');
        const g = c2.createLinearGradient(0, 0, 10, 10);
        let threwHsl = false;
        let threwHsla = false;
        try { g.addColorStop(0, 'hsl(120, 50%, 50%)'); } catch (e) { threwHsl = e instanceof SyntaxError; }
        try { g.addColorStop(1, 'hsla(10, 80%, 50%, 0.5)'); } catch (e) { threwHsla = e instanceof SyntaxError; }
        c2.fillText('★ ☆ ✓ × · — → ← ↑ ↓', 2, 8);
        const bmpViolations = window.__WX_HARNESS__.emojiStats.violations.length;
        c2.fillText('🐾', 2, 8);
        const pawViolations = window.__WX_HARNESS__.emojiStats.violations.length;
        for (const vs16Emoji of ['🗑️', '❄️', '❤️', '⚠️']) {
          c2.fillText(vs16Emoji, 2, 8);
        }
        const totalEmojiViolations = window.__WX_HARNESS__.emojiStats.violations.length;
        const hslCount = window.__WX_HARNESS__.gradientStats.hslViolations.length;
        window.__WX_HARNESS__.resetGradientStats();
        window.__WX_HARNESS__.resetEmojiStats();
        return {
          threwHsl,
          threwHsla,
          hslCount,
          bmpViolations,
          pawViolations,
          totalEmojiViolations,
          afterResetHsl: window.__WX_HARNESS__.gradientStats.hslViolations.length,
          afterResetEmoji: window.__WX_HARNESS__.emojiStats.violations.length
        };
      });
      assert(guardRes.threwHsl && guardRes.threwHsla, 'hsl() and hsla() must throw SyntaxError');
      assertEq(guardRes.hslCount, 2, 'hslViolations recorded');
      assertEq(guardRes.bmpViolations, 0, 'BMP symbols ★ ☆ ✓ × · — → ← ↑ ↓ must be allowed');
      assertEq(guardRes.pawViolations, 1, 'color emoji 🐾 must be flagged');
      assertEq(guardRes.totalEmojiViolations, 5, 'VS16 color emojis 🗑️ ❄️ ❤️ ⚠️ must also be flagged');
      assertEq(guardRes.afterResetHsl, 0, 'resetGradientStats');
      assertEq(guardRes.afterResetEmoji, 0, 'resetEmojiStats');
    });

    // ST-04: WebAudio missing-Convolver Schroeder fallback, modal 580Hz muffle & data: URI exclusion
    await check('ST-04', 'WebAudio missing-createConvolver fallback, 580Hz/12500Hz filter spy & 0 external audio files', async () => {
      await ctx.clickHit('dock_shop');
      await ctx.clickHit('modal_close');
      await ctx.clickHit('lobby_start_cta');
      await ctx.slide('left');
      const hs = await ctx.getHarnessState();
      const a = hs.audioStats;
      assertEq(a.convolverSupported, false, 'convolverSupported must be false');
      assertEq(a.convolverMissingFallbackUsed, true, 'convolverMissingFallbackUsed');
      assert(a.delaysCreated >= 3, `expected >= 3 DelayNodes, got ${a.delaysCreated}`);
      assert(a.delayTimesObserved.includes(0.029) && a.delayTimesObserved.includes(0.047) && a.delayTimesObserved.includes(0.071), 'Schroeder delay taps observed');
      assert(a.oscillatorsStarted >= 1, 'oscillator synthesis started');
      assertEq(a.lowpassMinTargetHz, 580, 'modal muffle 580Hz recorded');
      assertEq(a.lowpassLastTargetHz, 12500, 'modal close 12500Hz restored');
      assertEq(a.externalAudioElements, 0, 'data: URI unlock must not count as external audio file');

      const audioTrapCheck = await ctx.eval(() => {
        const h = window.__WX_HARNESS__;
        const el = document.createElement('audio');
        el.src = 'data:audio/wav;base64,AA==';
        el.setAttribute('playsinline', '');
        const afterDataUri = h.getAudioStats().externalAudioElements;

        el.setAttribute('src', '/__synthetic_trap.mp3');
        const afterSetAttr = h.getAudioStats().externalAudioElements;
        el.removeAttribute('src');

        const el2 = document.createElement('audio');
        el2.src = '/__synthetic_trap2.ogg';
        const afterPropSrc = h.getAudioStats().externalAudioElements;
        el2.removeAttribute('src');

        const box = document.createElement('div');
        box.innerHTML = '<audio src="/__synthetic_trap3.wav"></audio>';
        const afterInnerHtml = h.getAudioStats().externalAudioElements;
        box.querySelectorAll('audio').forEach((n) => n.removeAttribute('src'));

        h.resetAudioStats();
        const afterReset = h.getAudioStats().externalAudioElements;
        return { afterDataUri, afterSetAttr, afterPropSrc, afterInnerHtml, afterReset };
      });
      await ctx.sleep(25);
      ctx.cdp.clearErrors();
      assertEq(audioTrapCheck.afterDataUri, 0, 'createElement("audio") with data: URI + playsinline must stay 0');
      assert(audioTrapCheck.afterSetAttr >= 1, `setAttribute("src", ...) must increment externalAudioElements, got ${audioTrapCheck.afterSetAttr}`);
      assert(audioTrapCheck.afterPropSrc >= 2, `el2.src assignment must increment externalAudioElements (>=2), got ${audioTrapCheck.afterPropSrc}`);
      assert(audioTrapCheck.afterInnerHtml >= 3, `innerHTML <audio src=...> must increment externalAudioElements (>=3), got ${audioTrapCheck.afterInnerHtml}`);
      assertEq(audioTrapCheck.afterReset, 0, 'resetAudioStats must reset externalAudioElements to 0');
      assertEq((await ctx.getHarnessState()).audioStats.externalAudioElements, 0, 'externalAudioElements remains 0 after ST-04 cleanup');
    });

    // ST-05: Real CDP touch gestures & Serve-Only Scoring mini-FSM
    await check('ST-05', 'Real CDP swipe, knead, tap-to-tray, double-tap trash (0 pts) & auto-serve (+120 pts)', async () => {
      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1', '/__self_test.html');
      await ctx.clickHit('lobby_start_cta');
      let st = await ctx.swipeBoard('left');
      assertEq(st.grid.cells[0][0].tile.tier, 2, 'C1+C1 merged to C2');
      assertEq(st.score, 0, 'slide merge awards 0 score');

      await ctx.clickHit('knead_btn');
      st = await ctx.getState();
      assertEq(st.score, 0, 'knead awards 0 score');

      await ctx.tapBoardCell(1, 2, { viaCdp: true });
      st = await ctx.getState();
      assert(st.tray[0] && st.tray[0].tier === 1, 'non-matching C1 placed into tray[0]');
      assertEq(st.score, 0, 'tray placement awards 0 score');

      await ctx.doubleTapTray(0, { viaCdp: true });
      st = await ctx.getState();
      assertEq(st.tray[0], null, 'double-tap discarded tray[0]');
      assertEq(st.score, 0, 'trash discard has 0 score penalty');

      await ctx.tapBoardCell(0, 0, { viaCdp: true });
      st = await ctx.getState();
      assertEq(st.ordersServed, 1, 'matching C2 served customer');
      assertEq(st.score, 120, 'completed serve awarded 120 score');
    });

    // ST-06: Desktop 1280x760 live viewport switch & keyboard dispatch
    await check('ST-06', 'Desktop 1280x760 live viewport resize, bounds & CDP keyboard dispatch (Space, ArrowRight)', async () => {
      await ctx.setViewport(1280, 760, false, 1, { safeTop: 8, safeBottom: 0, showCapsule: true });
      await ctx.checkBounds('ST-06_desktop_1280');
      await ctx.pressKey('Space');
      await ctx.pressKey('ArrowRight');
      const st = await ctx.getState();
      assert(st.keyCount >= 2, `expected keyCount >= 2, got ${st.keyCount}`);
      assertEq(st.lastKey, 'ArrowRight', 'ArrowRight key dispatched');
      assert(st.grid.cells[0][3].tile && st.grid.cells[0][3].tile.tier === 1, 'Space kneaded (0,0) then ArrowRight slid tile to (0,3)');
    });

    // ST-07: Screenshot capture & PNG header verification
    await check('ST-07', 'Screenshot capture to VERIFY_OUT_DIR with valid PNG IHDR & byte size', async () => {
      const shot = await ctx.captureScreenshot('self_test_smoke.png');
      assert(fs.existsSync(shot.path), 'screenshot file exists');
      const hdr = readPngHeader(shot.path);
      assertEq(hdr.width, 1280, 'screenshot width');
      assertEq(hdr.height, 760, 'screenshot height');
      assert(hdr.bytes > 1024, 'screenshot bytes > 1024');
    });

    // ST-08: v2 kissa_sync pull migration (UT-S01 -> 230 stardust, 430 totalEarnedStardust in v0.9.0)
    await check('ST-08', 'kissa_sync v1->v2 pull migration (UT-S01 exact 230 stardust)', async () => {
      await ctx.setCloudConfig({
        useBuiltInMock: true,
        reset: true,
        seedCloudDoc: {
          bankStardust: 50,
          unlockedPatrons: ['mikan', 'luna'],
          unlockedThemes: ['amber', 'sakura'],
          shopUpgrades: { up_tools: 2 },
          bestChef: 8000
        }
      });
      const pullRes = await ctx.callCloud({ action: 'pull' });
      assert(pullRes.ok, 'pull ok');
      assertEq(pullRes.metaSave.schemaVersion, 2, 'migrated schemaVersion');
      assertEq(pullRes.metaSave.totalEarnedStardust, 430, 'UT-S01 totalEarnedStardust');
      assertEq(pullRes.metaSave.bankStardust, 230, 'UT-S01 bankStardust');
    });

    // ST-09: kissa_sync push 5,650 shop audit, 35k cap & serves >= 1 anti-cheat
    await check('ST-09', 'kissa_sync push 5,650 shop conservation, chapter cap clamp & serves>=1 anti-cheat', async () => {
      await ctx.setCloudConfig({ useBuiltInMock: true, reset: true });
      await ctx.callCloud({ action: 'pull' });

      const fullShopRes = await ctx.callCloud({
        action: 'push',
        metaSave: {
          schemaVersion: 2,
          totalEarnedStardust: 5695,
          lastSyncedEarnedStardust: 5695,
          bankStardust: 0,
          consumableSpentStardust: 45,
          catcakeLevels: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4 },
          deviceUpgrades: { dev_tray: 2, dev_flour: 3, dev_teapot: 3, dev_tools: 3 },
          unlockedPatrons: ['mikan', 'luna', 'mugi'],
          unlockedThemes: ['amber', 'sakura', 'moonlight'],
          levelBestScores: { '1-1': 99999, '1-2': 2500 },
          levelStars: { '1-1': 3, '1-2': 3 }
        },
        runReport: { levelId: '1-2', score: 2500, serves: 0, durationSec: 90 }
      });
      assert(fullShopRes.ok, 'push ok');
      assertEq(fullShopRes.metaSave.bankStardust, 0, '5650 shop + 45 consumable = 5695 exact 0 bank');
      assertEq(fullShopRes.metaSave.levelBestScores['1-1'], 35000, 'Ch.1 score cap clamped to 35000');
      assert(!fullShopRes.metaSave.levelBestScores['1-2'], 'zero-serve score on 1-2 rejected');
      assert(fullShopRes.validationWarnings.includes('zero_serve_score_rejected'), 'zero_serve_score_rejected warning');
    });

    // ST-10: Transient push failure injection + in-memory wx-server-sdk query verification
    await check('ST-10', 'Transient failNextPushCount error recovery & in-memory wx-server-sdk query operators', async () => {
      await ctx.setCloudConfig({ useBuiltInMock: true, failNextPushCount: 1 });
      const cbFail = await ctx.eval(
        () =>
          new Promise((resolve) => {
            wx.cloud.callFunction({
              name: 'kissa_sync',
              data: { action: 'push', metaSave: { schemaVersion: 2, bankStardust: 15, totalEarnedStardust: 15 } },
              success: () => resolve({ failed: false }),
              fail: (err) => resolve({ failed: true, msg: err.message || String(err) })
            });
          })
      );
      assert(cbFail.failed && /timeout/i.test(cbFail.msg), '1st push failed transiently without unhandled rejection');

      const retryRes = await ctx.callCloud({
        action: 'push',
        metaSave: { schemaVersion: 2, bankStardust: 15, totalEarnedStardust: 15 }
      });
      assert(retryRes.ok && retryRes.revision >= 2, '2nd push succeeded with incremented revision');

      // Also verify Node in-memory wx-server-sdk multi-field orderBy & command operators directly
      const sdkStore = createCloudSdkStore({ minigameDir: DEFAULT_MINIGAME_DIR });
      const db = sdkStore.wxServerSdk.database();
      const _ = db.command;
      await db.collection('players').doc('u1').set({ data: { totalStars: 24, totalCumulativeScore: 30000, rev: 1 } });
      await db.collection('players').doc('u2').set({ data: { totalStars: 24, totalCumulativeScore: 42000, rev: 1 } });
      await db.collection('players').doc('u1').update({ data: { rev: _.inc(2) } });
      const q = await db
        .collection('players')
        .where({ totalStars: _.gt(10).and(_.lte(90)) })
        .orderBy('totalStars', 'desc')
        .orderBy('totalCumulativeScore', 'desc')
        .get();
      assertEq(q.data.map((d) => d._id), ['u2', 'u1'], 'wx-server-sdk multi-field orderBy tie-break');
      assertEq(q.data[1].rev, 3, 'wx-server-sdk _.inc operator');
    });

    // ST-11: Dual leaderboards ('stars', 'score', 'totalScore' alias) + ?cloud=0 & ?audio=none
    await check('ST-11', 'Dual leaderboards (stars/score/totalScore alias) + ?cloud=0 & ?audio=none modes', async () => {
      await ctx.setCloudConfig({
        useBuiltInMock: true,
        reset: true,
        seedRivals: [
          { id: 'rA', nickName: 'RivalA', totalStars: 30, totalCumulativeScore: 20000 },
          { id: 'rB', nickName: 'RivalB', totalStars: 12, totalCumulativeScore: 55000 }
        ]
      });
      await ctx.callCloud({
        action: 'push',
        metaSave: {
          schemaVersion: 2,
          totalEarnedStardust: 100,
          lastSyncedEarnedStardust: 100,
          levelBestScores: { '1-1': 1500, '1-2': 25000 },
          levelStars: { '1-1': 3, '1-2': 3 }
        }
      });

      const lbStars = await ctx.callCloud({ action: 'leaderboard', boardType: 'stars' });
      const lbScore = await ctx.callCloud({ action: 'leaderboard', boardType: 'score' });
      const lbAlias = await ctx.callCloud({ action: 'leaderboard', boardType: 'totalScore' });

      assertEq(lbStars.boardType, 'stars', 'stars boardType');
      assertEq(lbStars.list[0].id, 'rA', 'rA #1 on stars');
      assertEq(lbStars.myRank, 3, 'player #3 on stars (6 < 12 < 30)');

      assertEq(lbScore.boardType, 'score', 'score boardType');
      assertEq(lbScore.list[0].id, 'rB', 'rB #1 on score (55000)');
      assertEq(lbScore.myRank, 2, 'player #2 on score (26500 > 20000)');
      assertEq(lbAlias.boardType, 'score', 'totalScore normalized to score');

      const offlineSt = await ctx.navigate('?cloud=0&audio=none', '/__self_test.html');
      const flags = await ctx.eval(() => ({
        hasCloud: Boolean(window.wx.cloud),
        audioCtx: window.wx.createWebAudioContext()
      }));
      assertEq(flags.hasCloud, false, '?cloud=0 disables wx.cloud');
      assertEq(offlineSt.cloudStatus, 'local_only', 'offline cloudStatus');
      assertEq(flags.audioCtx, null, '?audio=none disables createWebAudioContext');
    });

    // ST-12: UserInfoButton DOM overlay CDP tap, lifecycle hooks, share payload & 0 CDP errors
    await check('ST-12', 'UserInfoButton DOM overlay CDP tap, onHide/onShow lifecycle, share payload & 0 errors', async () => {
      await ctx.setViewport(390, 844, true, 2);
      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1', '/__self_test.html');
      await ctx.clickHit('dock_leaderboard');
      const btnRect = await ctx.eval(() => {
        window.__WX_MOCK_USERINFO__ = { nickName: '星野店长', avatarUrl: '' };
        const el = document.getElementById('wx-mock-userinfo-btn');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
      });
      assert(btnRect, '#wx-mock-userinfo-btn mounted on leaderboard');
      await ctx.tapCanvas(btnRect.x, btnRect.y);

      const sv = await ctx.getSaveData();
      assertEq(sv.playerProfile.authorized, true, 'UserInfoButton authorized profile');
      assertEq(sv.playerProfile.nickName, '星野店长', 'UserInfoButton nickName saved');

      await ctx.eval(() => {
        window.__WX_HARNESS__.triggerHide();
        window.__WX_HARNESS__.triggerShow();
      });
      const st = await ctx.getState();
      assert(st.hideCount >= 1 && st.showCount >= 1, 'onHide and onShow callbacks fired');

      const hs = await ctx.getHarnessState();
      assert(hs.userInfoTapCount >= 1, 'userInfoTapCount incremented');
      assert(hs.sharePreview && hs.sharePreview.title.includes('一起做猫饼'), 'v2 share title');
      assertEq(
        hs.sharePreview.imageUrl,
        'assets/ui_v090/08_首屏主视觉与结算辅助件/01_首屏纯主视觉底图_title_hero_v2.webp',
        'v2 share imageUrl'
      );
      assertEq(ctx.cdp.errors.length, 0, `expected 0 CDP errors, got ${JSON.stringify(ctx.cdp.errors)}`);
    });
  } finally {
    const scratchDirToVerify = browserHandle ? browserHandle.paths.runScratchDir : null;
    const sockDirToVerify = browserHandle ? browserHandle.paths.separateSocketTmpDir : null;
    if (browserHandle) await browserHandle.close();
    await serverHandle.close();
    if (scratchDirToVerify && fs.existsSync(scratchDirToVerify)) {
      console.error(`[FAIL] Leftover scratch dir: ${scratchDirToVerify}`);
      results.push({ id: 'CLEANUP', title: 'Scratch profile cleanup', ok: false, ms: 0, error: `Leftover ${scratchDirToVerify}` });
    }
    if (sockDirToVerify && fs.existsSync(sockDirToVerify)) {
      console.error(`[FAIL] Leftover socket tmp dir: ${sockDirToVerify}`);
      results.push({ id: 'CLEANUP_SOCK', title: 'Socket tmp cleanup', ok: false, ms: 0, error: `Leftover ${sockDirToVerify}` });
    }
  }

  // Verify /tmp was untouched when scratch dirs are outside /tmp
  const outEnv = process.env.VERIFY_OUT_DIR || '';
  const chromeEnv = process.env.CHROME_USER_DATA_DIR || '';
  if (!outEnv.startsWith('/tmp') && !chromeEnv.startsWith('/tmp') && fs.existsSync('/tmp')) {
    const tmpAfter = fs.readdirSync('/tmp').sort();
    const addedInTmp = tmpAfter.filter((f) => !tmpSnapshotBefore.includes(f));
    if (addedInTmp.length > 0) {
      console.error(`[FAIL] /tmp hygiene violation — newly created entries in /tmp: ${addedInTmp.join(', ')}`);
      process.exit(1);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n=== E2E Harness Self-Test Summary: ${passed}/${results.length} PASSED ===`);
  if (failed > 0 || passed < 12) {
    process.exit(1);
  }
}

// ============================================================================
// Full 4-Tier Suite Execution Loop
// ============================================================================

async function runSuite(cliOpts) {
  const allCases = await loadTierSuites(cliOpts.tiers);
  const { errors: schemaErrors } = validateAndSummarizeInventory(allCases);
  if (schemaErrors.length > 0) {
    console.error('[FAIL] TestCase schema errors:');
    for (const e of schemaErrors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const filtered = allCases.filter((tc) => {
    if (cliOpts.cases.length > 0 && !cliOpts.cases.includes(tc.id)) return false;
    if (cliOpts.features.length > 0 && !cliOpts.features.some((f) => tc.features.includes(f))) return false;
    if (cliOpts.filter) {
      const needle = cliOpts.filter.toLowerCase();
      const hay = `${tc.id} ${tc.title} ${(tc.features || []).join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    console.error('[FAIL] Zero test cases matched CLI filters.');
    process.exit(1);
  }

  filtered.sort((a, b) => a.tier - b.tier);

  const serverHandle = await startHarnessServer({ minigameDir: DEFAULT_MINIGAME_DIR });
  let browserHandle = null;
  const runResults = [];
  const suiteStart = Date.now();

  try {
    browserHandle = await launchCdpBrowser({ outDir: cliOpts.outDir });
    const { cdp, paths } = browserHandle;
    const ctx = createTestContext({
      cdp,
      baseUrl: serverHandle.baseUrl,
      repoRoot: DEFAULT_REPO_ROOT,
      minigameDir: DEFAULT_MINIGAME_DIR,
      outDir: paths.outDir,
      cloudStore: serverHandle.cloudStore
    });

    let activeTierHeader = -1;
    let forceReloadNext = false;

    for (const tc of filtered) {
      if (tc.tier !== activeTierHeader) {
        activeTierHeader = tc.tier;
        console.log(`\n--- Executing Tier ${tc.tier} ---`);
      }

      const vp = tc.viewport || VIEWPORT_PRESETS.IPHONE_390;
      const vpMobile = vp.mobile !== undefined ? Boolean(vp.mobile) : vp.width < 760;
      const vpDpr = vp.dpr || (vpMobile ? 2 : 1);
      const query = tc.query || defaultQueryForViewport(vp);
      const qSafe = extractQuerySafeMetrics(query);
      const safeTop = vp.safeTop !== undefined ? Number(vp.safeTop) : qSafe.safeTop;
      const safeBottom = vp.safeBottom !== undefined ? Number(vp.safeBottom) : qSafe.safeBottom;
      const showCapsule = vp.showCapsule !== undefined ? Boolean(vp.showCapsule) : qSafe.showCapsule;
      const vpKey = formatViewportKey({
        width: vp.width,
        height: vp.height,
        mobile: vpMobile,
        dpr: vpDpr,
        safeTop,
        safeBottom,
        showCapsule
      });
      const t0 = Date.now();

      try {
        if (ctx.currentVpKey !== vpKey) {
          await ctx.setViewport(vp.width, vp.height, vpMobile, vpDpr, {
            safeTop,
            safeBottom,
            showCapsule
          });
        }

        if (tc.freshReload || forceReloadNext) {
          forceReloadNext = false;
          serverHandle.cloudStore.handleAdmin({ action: 'reset' });
          try {
            await cdp.evalJS(`(() => {
              if (window.wx && wx.clearStorageSync) wx.clearStorageSync();
              if (window.__WX_HARNESS__ && __WX_HARNESS__.clearCloudDb) __WX_HARNESS__.clearCloudDb();
            })()`);
          } catch (_) {}
          ctx.cdp.clearErrors();
          await ctx.navigate(query, '/__wx_preview.html');
        } else {
          await ctx.resetGame({ clearCloud: true, clearLocal: true, routePath: '/__wx_preview.html', query });
        }

        ctx.cdp.clearErrors();
        const perTestTimeoutMs = tc.timeoutMs ?? 60_000;
        let watchdogTimer = null;
        let timedOut = false;
        try {
          await Promise.race([
            tc.run(ctx),
            new Promise((_, reject) => {
              watchdogTimer = setTimeout(() => {
                timedOut = true;
                reject(new Error(`Per-test watchdog timeout exceeded (${perTestTimeoutMs}ms) in ${tc.id}`));
              }, perTestTimeoutMs);
            })
          ]);
        } finally {
          if (watchdogTimer) clearTimeout(watchdogTimer);
          if (timedOut) forceReloadNext = true;
        }

        // Mandatory post-test quality & compatibility gates
        if (!tc.allowConsoleError && ctx.cdp.errors.length > 0) {
          throw new Error(`Console/Runtime errors detected (${ctx.cdp.errors.length}): ${ctx.cdp.errors[0]}`);
        }
        if (!tc.allowNetworkError && ctx.cdp.networkErrors.length > 0) {
          throw new Error(`Network errors detected: ${JSON.stringify(ctx.cdp.networkErrors[0])}`);
        }

        const guardSnap = await cdp.evalJS(`(() => {
          if (!window.__WX_HARNESS__) return { hsl: [], emoji: [], externalAudioElements: 0 };
          const audio = typeof window.__WX_HARNESS__.getAudioStats === 'function'
            ? window.__WX_HARNESS__.getAudioStats()
            : (window.__WX_HARNESS__.audioStats || {});
          return {
            hsl: window.__WX_HARNESS__.gradientStats.hslViolations || [],
            emoji: window.__WX_HARNESS__.emojiStats.violations || [],
            externalAudioElements: Number(audio.externalAudioElements) || 0
          };
        })()`);
        if (guardSnap.hsl.length > 0) {
          throw new Error(`iOS hsl()/hsla() gradient violation: ${JSON.stringify(guardSnap.hsl[0])}`);
        }
        if (guardSnap.emoji.length > 0) {
          throw new Error(`Native color emoji Canvas violation: ${JSON.stringify(guardSnap.emoji[0])}`);
        }
        if (guardSnap.externalAudioElements > 0) {
          throw new Error(`External HTMLAudioElement violation: externalAudioElements=${guardSnap.externalAudioElements} (expected 0)`);
        }

        const ms = Date.now() - t0;
        runResults.push({ id: tc.id, tier: tc.tier, features: tc.features, title: tc.title, ok: true, ms });
        console.log(`  [PASS] ${tc.id} (${ms}ms) — ${tc.title}`);
      } catch (err) {
        const ms = Date.now() - t0;
        const msg = err && err.message ? err.message : String(err);
        runResults.push({ id: tc.id, tier: tc.tier, features: tc.features, title: tc.title, ok: false, ms, error: msg });
        console.error(`  [FAIL] ${tc.id} (${ms}ms) — ${tc.title}\n    -> ${msg}`);
      }
    }

    const passed = runResults.filter((r) => r.ok).length;
    const failed = runResults.length - passed;
    const summaryPayload = {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - suiteStart,
      total: runResults.length,
      passed,
      failed,
      results: runResults
    };
    fs.mkdirSync(paths.outDir, { recursive: true });
    fs.writeFileSync(path.join(paths.outDir, 'e2e_summary.json'), JSON.stringify(summaryPayload, null, 2));

    console.log(`\n=== E2E Execution Summary: ${passed}/${runResults.length} PASSED (${summaryPayload.durationMs}ms) ===`);
    if (failed > 0) {
      console.error('Failed cases:');
      for (const f of runResults.filter((r) => !r.ok)) {
        console.error(`  - [Tier ${f.tier}] ${f.id}: ${f.error}`);
      }
      process.exitCode = 1;
    }
  } finally {
    if (browserHandle) await browserHandle.close();
    await serverHandle.close();
  }
}

async function main() {
  const cliOpts = parseCliArgs(process.argv.slice(2));
  if (cliOpts.help) {
    printUsage();
    return;
  }
  if (cliOpts.selfTest) {
    await runSelfTest(cliOpts);
    return;
  }
  if (cliOpts.list) {
    await runListCommand();
    return;
  }
  await runSuite(cliOpts);
}

main().catch((err) => {
  console.error('[FATAL] E2E Runner Error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
