# E2E Test Infrastructure & Traceability Specification (`TEST_INFRA.md`)

## 1. Overview & Opaque-Box Testing Philosophy

> **Version Alignment Note**: External product versioning has been standardized to pre-launch SemVer (`v0.8.0` active code baseline → **`v0.9.0` economy & utensil overhaul** → `v1.0.0` public launch). References to `v2` in script names (`test_v2_core.mjs`), asset filenames, and `schemaVersion: 2` denote the Generation-2 shaped-grid architecture. When implementing `v0.9.0` code changes ([docs/v0.9.0-版本调整计划书.md](docs/v0.9.0-版本调整计划书.md)), update numeric assertions (`5,650 ⭐` shop cap, `15 ⭐` initial dust, `8.0s` trash cooldown, `applyForkAction` 5 modes, `unlockLevel` shop gating, and client↔cloud parity) accordingly.

The 《一起做猫饼》(Hoshi Kissa Bakery `v0.8.0` baseline → `v0.9.0`) End-to-End (E2E) test suite validates the WeChat Mini Game client (`05-微信小游戏版本/`) and CloudBase function (`05-微信小游戏版本/cloudfunctions/kissa_sync/index.js`) **strictly as an opaque box** inside real headless Chromium via raw Chrome DevTools Protocol (CDP) WebSockets (`Page`, `Runtime`, `Input`, `Emulation`, `Network`) with **zero external npm test dependencies**.

Every test case interacts exclusively through:
1. **Real CDP Hardware/Browser Inputs**: Touch/pointer gestures (`mousePressed` → `mouseMoved` → `mouseReleased`, double-tap `<= 320ms`), keyboard shortcuts (`Input.dispatchKeyEvent`), live viewport overrides (`375×667`, `390×844`, `1280×760`), and offscreen `<canvas>` / binary image header inspection.
2. **WeChat Mini Game Runtime Shim (`window.wx` & `window.__WX_HARNESS__`)**: Faithful emulation of `wx.createCanvas`, `wx.getWindowInfo`, `wx.getMenuButtonBoundingClientRect` (`87×32` top-right capsule), `wx_*` `localStorage`, `wx.createWebAudioContext` (with `createConvolver = undefined`), `wx.createUserInfoButton`, `wx.setUserCloudStorage`, `wx.onShow`/`wx.onHide`, and dual-capable `wx.cloud.callFunction({ name: 'kissa_sync' })` backed by an in-memory `wx-server-sdk` database running the real `cloudfunctions/kissa_sync/index.js`.
3. **Public Debug & HitRegistry Contract (`PROJECT.md` §7)**: `globalThis.__HOSHI_DEBUG__` (aliased to `globalThis.__game`) and canonical `HitRegistry` IDs — never mutating private module state or injecting synthetic grid matrices.

### Enforcement of the 3 Core Architectural Iron Laws
Every test case across all tiers is subject to automatic runtime & static guardrails enforcing the 3 Global Iron Laws (`PROJECT.md`):
1. **Pure Serve-Only Scoring Iron Law**: `score` MUST remain `0` across all grid slides, merges, knead spawns, ice shatters, tray placements, trash discards, utensils (`fork`/`spoon`), and patron active skills — incrementing **solely** when a seated customer's complete order is served (`kissa_sync` also rejects `score > 0 && serves < 1`).
2. **Flat CommonJS Module Layout**: `05-微信小游戏版本/game.js` and flat `05-微信小游戏版本/src/*.js` execute identically inside the synchronous CJS preview loader (`/__wx_preview.html`), Node unit suite (`scripts/test_v2_core.mjs`), and GitHub Actions (`node --check`).
3. **WeChat Mini Game & iOS Compatibility**:
   - Client bundle under `05-微信小游戏版本/` (excluding `cloudfunctions/`) `<= 3.5 MB` raw (`< 4 MB` WeChat ceiling), `69` runtime assets, `0` external audio files.
   - Automatic `SyntaxError` guard + telemetry on `CanvasGradient.prototype.addColorStop` for `hsl()`/`hsla()` strings (`0` `hslViolations`).
   - Automatic `CanvasRenderingContext2D.prototype.fillText`/`strokeText` spy flagging native color emojis `/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u` (including VS16 color emojis such as `🗑️`, `❄️`, `❤️`, `⚠️`) while permitting BMP typographic glyphs `★ ☆ ✓ ×` (`0` `emojiStats.violations`).
   - Strict top-right capsule clearance (`right <= menuRect.left - 8`) and bottom safe-area clearance (`bottom <= height - safeBottom`).

---

## 2. Modular File Layout (`scripts/`)

All E2E modules live flat under `scripts/*.mjs` so `for f in scripts/*.mjs; do node --check "$f"; done` validates the entire suite:

| File | Responsibility |
| :--- | :--- |
| `scripts/verify_minigame_e2e.mjs` | CLI entrypoint & orchestrator (`--tier`, `--list` / `--dry-run`, `--self-test`, `--filter`, `--case`, `--feature`, `--out-dir`, `--help`), strict unknown-arg rejection, `F01..F16` coverage gate validator, session-reusing test runner with `60s` per-test timeout watchdog, and unconditional post-test iOS/emoji/external-audio gates. |
| `scripts/e2e_harness.mjs` | Zero-`/tmp` Chromium CDP launcher, ephemeral HTTP static + cloud server, in-memory `wx-server-sdk` engine (`POST /__wx_cloud/kissa_sync` & `/__wx_cloud/admin`), Node CJS `requireBundledModule` sandbox, `window.__WX_HARNESS__` + built-in v2 `kissa_sync` mock, `/__self_test.html`, and unified `TestContext` (`ctx`) helpers (`fulfillCustomerOrder`, `checkBounds`, `inspectImagePixels`, etc.). |
| `scripts/e2e_tier1.mjs` | **Tier 1 — Feature Happy-Path Suite**: `96` isolated E2E tests (`6` per feature across `F01..F16`; gate `>= 80` & `>= 5/feature`). |
| `scripts/e2e_tier2.mjs` | **Tier 2 — Boundary, Negative & Robustness Suite**: `96` edge-case, anti-cheat, clamping, and error-recovery E2E tests (`6` per feature across `F01..F16`; gate `>= 80` & `>= 5/feature`). |
| `scripts/e2e_tier3.mjs` | **Tier 3 — Cross-Feature Pairwise Suite**: `18` `Fxx × Fyy` runtime interaction tests covering all 16 features (`gate >= 16` & `>= 1/feature`). |
| `scripts/e2e_tier4.mjs` | **Tier 4 — Real-World Player Journey Suite**: `10` end-to-end player journeys including 1-to-1 `docs/06-测试与端到端验收规格书.md` §4 L3 scenarios `T4-01..T4-08` + veteran boss/cloud & offline→online sync (`gate >= 8`). |
| `scripts/e2e_tier5_adversarial.mjs` | *(Optional, M5 Phase 2)* White-box adversarial regression cases automatically included when `--tier all` or `--tier 5` is invoked. |

---

## 3. CLI Flags & Usage Reference

```bash
# 1. Syntax check all E2E infrastructure & tier modules
for f in scripts/*.mjs; do node --check "$f"; done

# 2. Zero-browser inventory & F01..F16 4-tier coverage matrix gate (creates 0 directories)
node scripts/verify_minigame_e2e.mjs --list
node scripts/verify_minigame_e2e.mjs --dry-run

# 3. Pre-cutover 12-check CDP & harness self-test against /__self_test.html
VERIFY_OUT_DIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out" \
CHROME_USER_DATA_DIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/chrome_cdp" \
node scripts/verify_minigame_e2e.mjs --self-test

# 4. Sequential Tiered Execution (M5 Phase 1; supports --out-dir <path> override)
node scripts/verify_minigame_e2e.mjs --tier 1 --out-dir "$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out"
node scripts/verify_minigame_e2e.mjs --tier 2 --out-dir "$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out"
node scripts/verify_minigame_e2e.mjs --tier 3 --out-dir "$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out"
node scripts/verify_minigame_e2e.mjs --tier 4 --out-dir "$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out"

# 5. Targeted filtering by feature, exact case ID, or substring (plus --help)
node scripts/verify_minigame_e2e.mjs --tier 1,2 --feature F07
node scripts/verify_minigame_e2e.mjs --case T2-F01-01,T4-05
node scripts/verify_minigame_e2e.mjs --filter "multiset"
node scripts/verify_minigame_e2e.mjs --help

# 6. Full Suite (default when invoked with no arguments, used by GitHub Actions CI)
node scripts/verify_minigame_e2e.mjs
```

---

## 4. Environment Variables & Zero-`/tmp` Disk Hygiene

On developer/agent Linux VMs, Chromium's `--disable-dev-shm-usage` normally spills shared-memory files into `/tmp` unless child environment variables are redirected. `scripts/e2e_harness.mjs` enforces **strict zero-`/tmp` disk hygiene**:

| Variable | Resolution Order | Cleanup / Lifecycle |
| :--- | :--- | :--- |
| `CHROME_PATH` / `CHROME_BIN` | Explicit env var → `/usr/bin/google-chrome` → `/usr/bin/chromium`. | Read-only binary lookup. |
| `CHROME_USER_DATA_DIR` | `process.env.CHROME_USER_DATA_DIR` → on devbox (`/home/antigravity/.gemini/jetski` present & `GITHUB_ACTIONS !== 'true'`), `~/.gemini/jetski/scratch/teamwork_tmp/chrome_cdp` → `os.tmpdir()` in GitHub Actions CI. | Creates `AF_UNIX`-safe per-run `r_<shortId>/{p,t,c,g}` (plus short `ct_<shortId>` socket dir when `nestedTmp.length > 64`), sets child `TMPDIR`, `TMP`, `TEMP`, `XDG_CACHE_HOME`, `XDG_CONFIG_HOME`, `XDG_RUNTIME_DIR`, and `rm -rf`s `r_<shortId>` / `ct_<shortId>` (plus any newly created empty `CHROME_USER_DATA_DIR` shell) in `finally` + `SIGINT`/`SIGTERM`/`SIGHUP`/`exit`. |
| `VERIFY_OUT_DIR` | `--out-dir <path>` → `process.env.VERIFY_OUT_DIR` → if `GITHUB_ACTIONS === 'true'`, `${os.tmpdir()}/minigame_verify` (matching `.github/workflows/minigame-ci.yml`) → on devbox, `~/.gemini/jetski/scratch/teamwork_tmp/minigame_verify_<pid>`. | Deferred to active browser runs (`--list` / `--dry-run` creates **zero** directories). Holds captured PNGs and `e2e_summary.json`. |

---

## 5. Pass / Fail Semantics & Unified `TestContext` (`ctx`) Contract

### Pass / Fail Gate Rules
- **Strict CLI Validation**: Unknown `--*` flags, unexpected positional arguments, empty `--tier`/`--filter`/`--case`/`--feature`/`--out-dir` values, or invalid `--tier` tokens immediately fail with exit code `1` before spawning a browser.
- **`--self-test`**: Runs all 12 infrastructure assertions (`ST-01..ST-12`) against `/__self_test.html` and verifies zero `/tmp` leakage. Exits `0` iff `12/12` pass.
- **`--list` / `--dry-run`**: Validates unique IDs, valid `F01..F16` tags, and minimum counts (`T1 >= 80` & `>= 5/feat`, `T2 >= 80` & `>= 5/feat`, `T3 >= 16` & `>= 1/feat`, `T4 >= 8`). Exits `0` iff all gates pass.
- **`--tier` / Full Run**: A test case passes **only** if `await tc.run(ctx)` completes within the `60,000ms` per-test watchdog timeout without throwing **AND**:
  1. `ctx.cdp.errors.length === 0` (`0` `console.error` calls and `0` `Runtime.exceptionThrown` events, unless `tc.allowConsoleError === true`);
  2. `ctx.cdp.networkErrors.length === 0` (`0` HTTP `4xx`/`5xx` or failed asset loads, unless `tc.allowNetworkError === true`);
  3. `window.__WX_HARNESS__.gradientStats.hslViolations.length === 0` (`0` `hsl()`/`hsla()` color stops — enforced unconditionally and in `ctx.checkBounds()`);
  4. `window.__WX_HARNESS__.emojiStats.violations.length === 0` (`0` native color emojis rendered on Canvas — enforced unconditionally and in `ctx.checkBounds()`);
  5. `window.__WX_HARNESS__.audioStats.externalAudioElements === 0` (`0` external audio file elements — enforced unconditionally and in `ctx.checkBounds()`).
  Any single failed test case sets process exit code to `1`.

### Unified `ctx` (`TestContext`) Methods
- **Paths & Low-Level CDP**: `ctx.repoRoot`, `ctx.minigameDir`, `ctx.outDir`, `ctx.baseUrl`, `ctx.cdp` (`send`, `evalJS`, `errors`, `networkErrors`, `clearErrors()`).
- **Assertions & Async Polling**: `ctx.sleep(ms)`, `ctx.assert(cond, msg)`, `ctx.assertEq(actual, expected, msg)`, `ctx.assertClose(actual, expected, tol, msg)`, `ctx.waitFor(fn, opts)`, `ctx.eval(exprOrFn, ...args)`.
- **State, Save & Lifecycle**: `ctx.getState()`, `ctx.getSaveData()`, `ctx.setSaveData(rawObj)`, `ctx.allUnlockedStars(stars = 3)`, `ctx.setupSaveAndStart(levelId, saveOverrides, startOpts)`, `ctx.advanceTime(seconds)`, `ctx.advanceBothClocks(ms)`, `ctx.resetGame(opts)`, `ctx.navigate(query, routePath)`, `ctx.reload()`, `ctx.setViewport(width, height, mobile, dpr, safeOpts)`.
- **Input & Organic Gameplay**: `ctx.clickHit(hitId, opts)`, `ctx.tapCanvas(x, y, opts)`, `ctx.cellCenterPx(boardLayout, r, c)`, `ctx.tapBoardCell(r, c, opts)`, `ctx.doubleTapCanvas(x, y, opts)`, `ctx.doubleTapTray(slotIdx, opts)`, `ctx.swipeCanvas(x1, y1, x2, y2, opts)`, `ctx.swipeBoard(dir, opts)`, `ctx.pressKey(key)`, `ctx.slide(dir)`, `ctx.knead()`, `ctx.useToolOnCell(kind, r, c)`, `ctx.buyEmergencyTool(kind)`, `ctx.castPatronSkill()`, `ctx.clearBoardExcept(keepCoords)`, `ctx.fulfillCustomerOrder(seatIdx, opts)`.
- **Harness, Cloud, Asset & Layout Inspectors**: `ctx.getHarnessState()`, `ctx.resetAudioStats()`, `ctx.setCloudConfig(cfg)`, `ctx.callCloud(data, opts)`, `ctx.flushCloudSync(waitMs)`, `ctx.requireBundledModule(relPath)`, `ctx.readPngHeader(absPath)`, `ctx.readJpegHeader(absPath)`, `ctx.inspectImagePixels(assetRelUrl, regions)`, `ctx.computePackageStats()`, `ctx.captureScreenshot(name)`, `ctx.checkBounds(label, opts)`.

---

## 6. Complete `F01..F16` 4-Tier Traceability Matrix (`220` Total Cases)

- **Tier 1 (`scripts/e2e_tier1.mjs`)**: `16 features × 6 cases = 96` isolated happy-path E2E tests (`T1-F01-01..06` through `T1-F16-01..06`).
- **Tier 2 (`scripts/e2e_tier2.mjs`)**: `16 features × 6 cases = 96` boundary, negative & anti-regression E2E tests (`T2-F01-01..06` through `T2-F16-01..06`).
- **Tier 3 (`scripts/e2e_tier3.mjs`)**: `18` cross-feature pairwise (`Fxx × Fyy`) E2E tests (`T3-01..T3-18`).
- **Tier 4 (`scripts/e2e_tier4.mjs`)**: `10` end-to-end player journeys (`T4-01..T4-10`, where `T4-01..T4-08` map 1-to-1 to `docs/06-测试与端到端验收规格书.md` §4 `L3-1..L3-8`).
- **Grand Total**: `96 + 96 + 18 + 10 = 220` E2E test cases.

| Feature ID | Feature Name | Spec Sources | Tier 1 Cases (`6/feat`) | Tier 2 Cases (`6/feat`) | Tier 3 Pairwise (`Fxx×Fyy`) | Tier 4 Scenarios |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| `F01` | Storybook Art Assets & Extraction Pipeline (`v0.8.0`) | `ORIGINAL_REQUEST`, `04` §1–5, `extract_assets.py` | `T1-F01-01..06` | `T2-F01-01..06` | `T3-18` | `T4-07, T4-08` |
| `F02` | 7-Tier Cat-Cake Catalog & 30-Level Dataset | `01` §1/§4/§6, `02` §1–4, `05` §2.2/§3.3, `06` §3 | `T1-F02-01..06` | `T2-F02-01..06` | `T3-11` | `T4-01, T4-06, T4-09` |
| `F03` | Shaped-Grid 2048 Slide & Non-Chaining Merge | `01` §2.1–2.2, `05` §3.1, `06` UT-G01..G07 | `T1-F03-01..06` | `T2-F03-01..06` | `T3-01, T3-08` | `T4-02, T4-09` |
| `F04` | Flavor Inheritance, Special Cell Dyeing & Orthogonal Ice | `01` §1.2/§2.1, `05` §3.1, `06` UT-G08..G10 | `T1-F04-01..06` | `T2-F04-01..06` | `T3-01, T3-02, T3-07` | `T4-09` |
| `F05` | Independent Knead Button (`🐾 揉面补料`) | `01` §2.2–2.3, `03` §3.2, `05` §3.1, `06` UT-G11 | `T1-F05-01..06` | `T2-F05-01..06` | `T3-02, T3-09` | `T4-02, T4-04` |
| `F06` | Serving Tray (`3–4` Slots) & Double-Tap Trash (`🗑️`) | `01` §3.1/§3.3, `03` §3.2/§4, `06` L3-3/L3-4 | `T1-F06-01..06` | `T2-F06-01..06` | `T3-03, T3-10, T3-17` | `T4-03, T4-04, T4-06, T4-10` |
| `F07` | Subset Multiset Order Matching & Customer Priority | `01` §3.2, `05` §3.2, `06` UT-O02..O05 | `T1-F07-01..06` | `T2-F07-01..06` | `T3-03, T3-04` | `T4-03, T4-09` |
| `F08` | Pure Serve-Only Scoring Formula, Combo & Starlight Fever | `00` §1.2, `01` §4.3–4.4, `02` §3, `06` UT-O01/O06 | `T1-F08-01..06` | `T2-F08-01..06` | `T3-04, T3-05, T3-06` | `T4-02, T4-03, T4-09` |
| `F09` | 3-Seat Real-Time Customer Waves, Rush Hour & Closing Guard | `01` §4.1–4.2, `05` §3.2, `06` UT-O07 | `T1-F09-01..06` | `T2-F09-01..06` | `T3-05, T3-12` | `T4-03, T4-05, T4-09` |
| `F10` | Procedural Web Audio BGM & 20 Tactile SFX | `04` §6.1–6.2, `src/audio.js` | `T1-F10-01..06` | `T2-F10-01..06` | `T3-16` | `T4-08` |
| `F11` | Lossless v1→v2 Save Migration & Multi-Device Sync | `05` §4.1–4.2, `06` UT-S01/UT-S02 | `T1-F11-01..06` | `T2-F11-01..06` | `T3-13, T3-14` | `T4-06, T4-09, T4-10` |
| `F12` | WeChat CloudBase `kissa_sync` v2 & Dual Leaderboards | `05` §5.1–5.3, `03` §7.5 | `T1-F12-01..06` | `T2-F12-01..06` | `T3-15` | `T4-09, T4-10` |
| `F13` | 3-Chapter 30-Level Campaign Lobby, Gates & Settlement | `00` §1–2, `01` §6.1, `02` §4–5, `03` §2/§7.1–7.2 | `T1-F13-01..06` | `T2-F13-01..06` | `T3-12, T3-15` | `T4-01, T4-05, T4-09` |
| `F14` | 4-Tab Kissa Shop, Compendium & Dual Leaderboard UI | `01` §6.2, `02` §1–2, `03` §7.3–7.5 | `T1-F14-01..06` | `T2-F14-01..06` | `T3-09, T3-10, T3-11, T3-13, T3-18` | `T4-06, T4-07, T4-09` |
| `F15` | 3 Chef Patrons & 2 Emergency Utensils (`fork` & `spoon`) | `01` §5.1–5.2, `03` §3.2–3.3/§4.1 | `T1-F15-01..06` | `T2-F15-01..06` | `T3-06, T3-07, T3-08, T3-14` | `T4-09, T4-10` |
| `F16` | Responsive Multi-Viewport HUD, Gesture FSM & 6-Step Guide | `03` §1/§3–6, `06` L3-7/L3-8 | `T1-F16-01..06` | `T2-F16-01..06` | `T3-16, T3-17` | `T4-02, T4-03, T4-04, T4-07, T4-08` |
