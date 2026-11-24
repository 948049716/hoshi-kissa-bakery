# Project: 《一起做猫饼》(Hoshi Kissa Bakery v2.0)

## Architecture

### Overview
《一起做猫饼》v2.0 refactors the WeChat Mini Game (`05-微信小游戏版本/`) from a continuous 2D physics merge jar (`v1/v4.1`) into a **shaped-grid 2048 baking + 3-seat real-time dessert service campaign game** with **3 chapters × 10 = 30 levels**, **7-tier Cat-Cakes (`C1~C7`)**, **4 flavors (`plain`, `matcha`, `berry`, `gold`)**, **8 animal customers (`R01~R24` recipes)**, **4-tab Kissa Shop (`5,220 ⭐` cap)**, **lossless v1→v2 save migration**, and **WeChat CloudBase (`kissa_sync`) dual leaderboards (`stars` & `score`)**.

### Core Architectural Iron Laws
1. **Pure Serve-Only Scoring Iron Law**: `orderState.score` (mirrored to `gameState.score`) is **ONLY** incremented inside `order_service.matchTrayToCustomer` when a customer's complete order is served. Grid slides, merges, knead spawns, ice shatters, tray placements, double-tap trash discards, utensils (`fork`/`spoon`), and patron active skills MUST award strictly **`0`** score. Server-side `kissa_sync` also rejects/clamps any `runReport` with `score > 0 && serves < 1`.
2. **Flat CommonJS Module Layout**: All Mini Game runtime modules live flat under `05-微信小游戏版本/src/*.js` using `'use strict'` + CommonJS (`require` / `module.exports`) so WeChat Mini Game runtime, Node.js unit tests (`scripts/test_v2_core.mjs`), headless Chromium CDP harness (`scripts/verify_minigame_e2e.mjs`), and GitHub Actions CI (`node --check 05-微信小游戏版本/src/*.js`) work identically without build steps.
3. **WeChat Mini Game & iOS Compatibility**:
   - Total client package under `05-微信小游戏版本/` (excluding `cloudfunctions/`) MUST remain `< 2.5 MB` (hard WeChat main-package ceiling `< 4 MB`).
   - Zero `hsl()`/`hsla()` strings in `CanvasGradient.addColorStop` (always `#hex`, `rgb()`, `rgba()`, or `UI.hslToRgbColor`).
   - Zero native Unicode emoji rendered on Canvas (use `ui_atlas_1..3.png`, `board_tiles_atlas.png`, `customers_atlas.png`, `catcake_1..7*.png`, or vector Canvas badges).
   - Strict WeChat top-right capsule clearance (`right <= menuRect.left - 8`) and bottom safe-area clearance (`bottom <= height - Math.max(10, safeBottom + 8)`) across `375×667`, `390×844`, and `1280×760`.
   - Zero external audio files (`100%` procedural Web Audio synthesis in `src/audio.js` with Schroeder delay reverb fallback when `ctx.createConvolver` is absent).

### Module Data Flow
```
[constants.js] + [levels_data.js]
       │
       ├──► [grid_engine.js] (pure shaped-2048 state, slide, merge, dye, ice, knead, tools, patron board skills; 0 score)
       ├──► [order_service.js] (3 customer seats, tray 3~4 slots, multiset match, combo/fever, SOLE score formula)
       ├──► [save_sync.js] ◄──► [platform.js] ◄──► [cloudfunctions/kissa_sync/index.js]
       │
       ▼
[game_app.js] (controller, gesture arbitration FSM, timer/settlement, onboarding, __HOSHI_DEBUG__)
       │
       ├──► [screens_ui.js] (3-chapter map lobby + capsule-safe 4-band / 3-col HUD)
       ├──► [board_renderer.js] (customers bar, tray+trash strip, shaped board, animations)
       ├──► [modals_ui.js] (level_preview, level_result, 4-tab shop, compendium, dual leaderboard, pause, help, spotlight)
       └──► [audio.js] + [ui_draw.js]
```

---

## Feature Inventory
Every Survey feature is assigned to an explicit Implementation Milestone (none unassigned) and covered by the parallel E2E Testing Track.

| # | Feature ID | Feature | Description | Milestone | Source |
|---|------------|---------|-------------|-----------|--------|
| 1 | `F01` | v2.0 Storybook Art Assets & Extraction Pipeline | Generate 5 raw watercolor sheets (`v2_catcakes_base_sheet.jpg`, `v2_catcakes_happy_sheet.jpg`, `v2_customers_sheet.jpg`, `v2_board_tiles_sheet.jpg`, `v2_title_hero_raw.jpg`), run `scripts/extract_assets.py --v2` to export 14 `192×192` catcake PNGs, `customers_atlas.png` (`1024×512`), `board_tiles_atlas.png` (`512×256` with hollow `tile_gold` center), zero-text `title_hero_v2.jpg` (`1280×720`), QA contact sheet (`01-游戏效果图/v2_assets_qa_preview.jpg`) & showcase (`01-游戏效果图/v2_assets_showcase.png`); post-cutover delete 30 legacy `tier_1~9*`/jar files. | M1 (gen/extract), M4 (post-cutover cleanup) | `ORIGINAL_REQUEST`, `04` §1–5, `extract_assets.py` |
| 2 | `F02` | 7-Tier Cat-Cake Catalog & 30-Level Dataset | `C1~C7` (`Lv.0~4` prices & upgrade costs `3,670⭐`), 24 recipes (`R01~R24`), 8 customers, 4 devices, 3 patrons (`mikan`, `luna`, `mugi`), 3 procedural board themes (`amber`, `sakura`, `moonlight`), and 3 chapters × 10 = 30 shaped-grid levels (`1-1`..`3-10`) satisfying all 5 L2 static invariants. | M1 | `01` §1/§4/§6, `02` §1–4, `05` §2.2/§3.3, `06` §3 |
| 3 | `F03` | Shaped-Grid 2048 Slide & Non-Chaining Merge | `3×3` to `5×5` grid with `. # X G M B I` cells; `#`, `X`, and `frozenHp > 0` segment rows/cols; single-step non-chaining merge (`C1..C6 → tier+1`, `C7+C7` capped); valid slide (`moved:true`) spawns 1 `C1`/`C2`, grants `+8%` skill on `>=C5` merge, `0` score; blocked slide (`moved:false`) shakes & spawns `0`. | M2 | `01` §2.1–2.2, `05` §3.1, `06` UT-G01..G07 |
| 4 | `F04` | Flavor Inheritance, Special Cell Dyeing & Orthogonal Ice | `plain`/`matcha`/`berry`/`gold` (`gold` wildcard); cross-flavor same-tier `<C7` always merges (`gold` > moving flavor > stationary flavor > `plain`); `G/M/B` cell dyeing (`gold` never downgraded on `M/B`); post-slide 4-neighbor orthogonal merge shatters `I` (`frozenHp 1→0` without sliding in same step). | M2 | `01` §1.2/§2.1, `05` §3.1, `06` UT-G08..G10 |
| 5 | `F05` | Independent Knead Button (`🐾 揉面补料`) | `0.12s` debounced button + `Space` shortcut spawns 1 `C1`/`C2` (`c2Rate` from `dev_flour` + `luna` `+8%`) on random empty playable cell with `G/M/B` dye (`0` score); returns `board_full` toast gracefully when full. | M2, M4 | `01` §2.2–2.3, `03` §3.2, `05` §3.1, `06` UT-G11 |
| 6 | `F06` | Serving Tray (`3–4` Slots) & Double-Tap Trash (`🗑️`) | Single-tap non-frozen board tile moves it into leftmost empty tray slot (`3` default, `4` at `dev_tray >= 1`), freeing board cell; double-tap (`<=320ms`) tray slot discards into trash basket (`0` score penalty, deadlock recovery). | M2, M4 | `01` §3.1/§3.3, `03` §3.2/§4, `06` L3-3/L3-4 |
| 7 | `F07` | Subset Multiset Order Matching & Customer Priority | Greedy multiset matching: constrained flavor (`matcha`/`berry`) matches exact first then `gold`; `'any'` matches `plain` → flavored → `gold` last; `0.10s` auto-serve; tie-break: manual `preferredSeatIdx` (`🎯`) > lowest `patience/maxPatience` (`>=0.10` gap) > `isVip` > `isUrgent` > lowest `seatIdx`. | M2, M4 | `01` §3.2, `05` §3.2, `06` UT-O02..O05 |
| 8 | `F08` | Pure Serve-Only Scoring Formula, Combo & Starlight Fever | Sole scoring path on completed serve (`round(itemSum * comboSizeMult * patienceTipMult * serveComboMult * customerMult * patronMult * deviceMult * feverMult)`); `10s` serve combo (`1.00..1.50`); serve-only Fever charge (`+20/+25/+35%` → `10s` `×1.35` score & `×0.5` patience decay). | M2, M4 | `00` §1.2, `01` §4.3–4.4, `02` §3, `06` UT-O01/O06 |
| 9 | `F09` | 3-Seat Real-Time Customer Waves, Rush Hour & Closing Guard | Seats `0,1` (`<=0.5s`) & Seat `2` (`3.0s`); turnover `1.2–2.2s` (`0.8s` in Rush Hour `55%–15%` or to `15s` in `3-10`); `<8.0s` stops new spawns; dynamic accessible-order guarantee; angry walkout at `0` patience resets `combo=0` with `0` score deduction; VIP awards `+5 ⭐`. | M2, M4 | `01` §4.1–4.2, `05` §3.2, `06` UT-O07 |
| 10 | `F10` | Procedural Web Audio BGM & 20 Tactile SFX | Retain `StarlightAudio` dual C-major BGM (`waltz`, `bossa`, `off`), modal `580Hz` muffle, Schroeder non-Convolver fallback, 13 existing SFX, plus 7 new v2 SFX (`playGridSlide`, `playGridBlocked`, `playKneadSpawn`, `playTrayPlace`, `playTrayTrash`, `playCustomerAngry`, `playStarUnlock`). | M2 | `04` §6.1–6.2, `src/audio.js` |
| 11 | `F11` | Lossless v1→v2 Save Migration & Multi-Device Sync | Upgrade `hoshi_kissa_bakery_save_v1` to `schemaVersion: 2`; `migrateV1ToV2` refunds 100% legacy `shopUpgrades`, compensates `luna`/`mugi` `+20⭐`, grants `+50⭐` veteran gift (`UT-S01 → 230⭐`); enforces `bankStardust = totalEarned - computeSpentStardust`; additive `<=1500` offline delta merge (`UT-S02`). | M3 | `05` §4.1–4.2, `06` UT-S01/UT-S02 |
| 12 | `F12` | WeChat CloudBase `kissa_sync` v2 & Dual Leaderboards | Server-side `migrateV1ToV2`, v2 shop cost audit, chapter score caps (`35k/90k/220k`), `serves >= 1` anti-cheat, optimistic `revision` lock, `stars` (`总星数进度榜`) & `score` (`累计营业榜`) Top-50 + `myRank`, offline `local_only` NPC fallback & `retry_pending` backoff. | M3 | `05` §5.1–5.3, `03` §7.5 |
| 13 | `F13` | 3-Chapter 30-Level Campaign Lobby, Gates & Settlement | Rebrand to `一起做猫饼`, purge `rush`/`zen` modes; 3-chapter winding 10-node map (`Ch2`: `1-10` + `18★`; `Ch3`: `2-10` + `40★`); `level_preview` modal; `level_result` 1–3★ modal with first-star (`[15,20,30]/[20,25,35]/[25,35,45]`) + repeatable clear/VIP/3★ or `>=1`-serve fail consolation stardust. | M4 | `00` §1–2, `01` §6.1, `02` §4–5, `03` §2/§7.1–7.2 |
| 14 | `F14` | 4-Tab Kissa Shop, Compendium & Dual Leaderboard UI | 4-tab Kissa Shop (`猫饼研发` `3,670⭐`, `后厨设备` `1,150⭐`, `搭档` `200⭐`, `皮肤` `200⭐` = `5,220⭐`, affordability red dot); 2-tab Compendium (`7阶猫饼` + `24道菜谱`); Dual Leaderboard + Profile authorization card; updated Pause/Help modals. | M4 | `01` §6.2, `02` §1–2, `03` §7.3–7.5 |
| 15 | `F15` | 3 Chef Patrons & 2 Emergency Utensils (`fork` & `spoon`) | Active + passive skills for `mikan` (`+45%` patience + `5s` freeze; `+8%` score), `luna` (clear `C1` + sort + next serve `×1.50`; `+8%` `C2`), `mugi` (thaw all ice + upgrade 2 tiles `+1` `gold`; `>=3` combo `+0.10`); `fork` (delete tile or thaw ice, `15⭐` emergency buy) & `spoon` (`+1` tier on `C1~C6`, `20⭐` emergency buy, limit `1`/level). | M2, M4 | `01` §5.1–5.2, `03` §3.2–3.3/§4.1 |
| 16 | `F16` | Responsive Multi-Viewport HUD, Gesture FSM & 6-Step Guide | Zero-scroll layouts at `375×667`, `390×844` (capsule & safeBottom compliant), and `1280×760` (3-column wide + keyboard shortcuts `WASD/Arrows`, `Space`, `1/2`, `F`); gesture arbitration (`>=18px` slide vs `<14px & <350ms` tap vs `<=320ms` double-tap); 6-step non-blocking spotlight tutorials (`1-1`×3, `1-3`, `2-1`, `3-1`). | M4 | `03` §1/§3–6, `06` L3-7/L3-8 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| `M1` | 美术资产生产与数据基建 (Art Assets & Static Data Foundation) | Generate 5 high-craft storybook watercolor v2 raw sheets in `03-游戏素材-原始原图与WebP/`, run `scripts/extract_assets.py --v2` (ensuring hollow `tile_gold` center & zero white halos) to export 17 v2 assets to `02-*` & `05-*/assets/` + QA previews in `01-游戏效果图/`; implement `05-微信小游戏版本/src/constants.js` & `src/levels_data.js` (30 levels, 24 recipes, 5 L2 invariants). | none | `DONE` (`PASS` / Auditor `CLEAN` — 44 deliverables: `v2_assets_showcase.png`, `v2_assets_qa_preview.jpg`, 5 raw sheets, 34 master+runtime assets `377 KB`, `constants.js`, `levels_data.js`) |
| `M2` | 纯逻辑引擎、棋盘渲染与音效升级 (Core Engine, Board Renderer & Audio) | Implement `src/grid_engine.js`, `src/order_service.js` (strict Serve-Only Scoring Iron Law), `src/board_renderer.js`, additive v2 sprite/badge helpers in `src/ui_draw.js`, and 7 new C-major synth SFX in `src/audio.js`. | `M1` | `DONE` (`5/5 PASS` / Auditor `CLEAN` — `sub_orch_m2_r4/handoff.md`: `grid_engine.js`, `order_service.js`, `board_renderer.js`, `ui_draw.js`, `audio.js`, `69,514` unseen forensic + `25,112` full-suite + `48,561` engine/economy + `220/220` 3-mode PCM checks PASS) |
| `M3` | 存档迁移与微信云开发重构 (Save v2 Migration, Cloud Sync & Platform) | Implement `schemaVersion: 2` & `migrateV1ToV2` in `src/save_sync.js` (`consumableSpentStardust` conservation, `UT-S01`/`UT-S02`), update `src/platform.js` (v2 share cover `title_hero_v2.jpg`, friend cloud KV, v2 mock cloud/NPCs), refactor `cloudfunctions/kissa_sync/index.js` (`stars` & `score` dual leaderboards + v2 anti-cheat), and fix `scripts/upload_minigame.mjs` cloud ignores. | `M1` (parallel with `M2`) | `DONE` (`5/5 PASS` / Auditor `CLEAN` — `sub_orch_m3_r4/handoff.md`: `save_sync.js`, `platform.js`, `cloudfunctions/kissa_sync/index.js`, `scripts/upload_minigame.mjs`, `>3.66M` assertions & `100%` 3-way stateful parity) |
| `M4` | 30关大厅、小铺外围系统、全量切换与单测 (UI/App Cutover, Cleanup & Unit Suite) | Refactor `src/screens_ui.js`, `src/modals_ui.js`, and `src/game_app.js` (3-chapter map, 4-tab Kissa Shop, preview/result/compendium/leaderboard modals, gesture FSM, patrons, utensils, 6-step spotlight guide, `__HOSHI_DEBUG__`); post-cutover delete legacy physics/jar code & 30 `tier_1~9*` assets; implement `scripts/test_v2_core.mjs` (L1 + L2) and update `.github/workflows/minigame-ci.yml`. | `M1`, `M2`, `M3` | `IN_PROGRESS` (`577e7734c4187e6bf73f7e055e628ea5` — `sub_orch_m4_r4` Exploring -> Implementing -> 5-Agent Gate) |
| `E2E` | E2E Testing Track (Opaque-Box 4-Tier Suite) | Author `TEST_INFRA.md`, upgrade `scripts/verify_minigame_e2e.mjs` (scratch-safe `CHROME_USER_DATA_DIR` + `--tier 1\|2\|3\|4\|all` + `--self-test`) and modular `scripts/e2e_tier{1..4}.mjs` covering all 16 features (`>=80` T1, `>=80` T2, `>=16` T3, `>=8` T4 incl. all 8 `06` L3 scenarios), and publish `TEST_READY.md`. | none (parallel Dual Track) | `DONE` (`5/5 PASS` / Auditor `CLEAN` — `TEST_READY.md` published: `96` T1 + `96` T2 + `18` T3 + `10` T4 = `220` cases across `F01..F16`, `5,262/5,262` MC `100%`) |
| `M5` | Final Milestone (Phase 1: 100% E2E Pass + Phase 2: Tier 5 Adversarial Hardening) | **Phase 1**: Sequentially pass 100% of E2E Tiers 1 → 2 → 3 → 4 (`verify_minigame_e2e.mjs`) + `test_v2_core.mjs`. **Phase 2**: White-box Challenger → Worker → Reviewer loop generating adversarial tests & fixing any edge-case bugs until 0 gaps remain. | `M4`, `E2E` (`TEST_READY.md`) | `PLANNED` |

---

## Code Layout & Exclusive Write Ownership

All source, asset, cloud, and script paths are partitioned with strict non-overlapping write ownership per concurrent milestone:

- **M1 (`美术资产生产与数据基建`)**:
  - `03-游戏素材-原始原图与WebP/v2_catcakes_base_sheet.jpg`
  - `03-游戏素材-原始原图与WebP/v2_catcakes_happy_sheet.jpg`
  - `03-游戏素材-原始原图与WebP/v2_customers_sheet.jpg`
  - `03-游戏素材-原始原图与WebP/v2_board_tiles_sheet.jpg`
  - `03-游戏素材-原始原图与WebP/v2_title_hero_raw.jpg`
  - `scripts/extract_assets.py` *(only if needed for `tile_gold` enclosed center hole transparency)*
  - `02-游戏素材-精修透明PNG/{catcake_1..7.png,catcake_1..7_happy.png,customers_atlas.png,board_tiles_atlas.png,title_hero_v2.jpg}`
  - `05-微信小游戏版本/assets/{catcake_1..7.png,catcake_1..7_happy.png,customers_atlas.png,board_tiles_atlas.png,title_hero_v2.jpg}`
  - `01-游戏效果图/{v2_assets_qa_preview.jpg,v2_assets_showcase.png}`
  - `05-微信小游戏版本/src/constants.js`
  - `05-微信小游戏版本/src/levels_data.js`
- **M2 (`纯逻辑引擎、棋盘渲染与音效升级`)**:
  - `05-微信小游戏版本/src/grid_engine.js` *(new)*
  - `05-微信小游戏版本/src/order_service.js` *(new)*
  - `05-微信小游戏版本/src/board_renderer.js` *(new)*
  - `05-微信小游戏版本/src/audio.js`
  - `05-微信小游戏版本/src/ui_draw.js`
- **M3 (`存档迁移与微信云开发重构`)**:
  - `05-微信小游戏版本/src/save_sync.js`
  - `05-微信小游戏版本/src/platform.js`
  - `05-微信小游戏版本/cloudfunctions/kissa_sync/index.js`
  - `scripts/upload_minigame.mjs`
- **M4 (`30关大厅、小铺外围系统、全量切换与单测`)**:
  - `05-微信小游戏版本/src/screens_ui.js`
  - `05-微信小游戏版本/src/modals_ui.js`
  - `05-微信小游戏版本/src/game_app.js`
  - `scripts/test_v2_core.mjs` *(new)*
  - `.github/workflows/minigame-ci.yml`
  - Post-cutover deletions ONLY: `05-微信小游戏版本/src/{physics.js,physics_shapes.js,jar_renderer.js}`, `scripts/extract_physics_shapes.py`, `02-游戏素材-精修透明PNG/{tier_1..9*.png,event_yarn_ball.png,tool_shake.png,physics_shapes.json,sprites_meta.json}`, `05-微信小游戏版本/assets/{tier_1..9*.png,title_hero.jpg,event_yarn_ball.png,tool_shake.png}`
- **E2E (`E2E Testing Track`)**:
  - `TEST_INFRA.md`, `TEST_READY.md` *(at repo root)*
  - `scripts/verify_minigame_e2e.mjs`
  - `scripts/e2e_harness.mjs`, `scripts/e2e_tier1.mjs`, `scripts/e2e_tier2.mjs`, `scripts/e2e_tier3.mjs`, `scripts/e2e_tier4.mjs` *(flat in `scripts/` so `node --check scripts/*.mjs` checks all)*
- **M5 (`Final Milestone`)**:
  - Sequential E2E pass bugfixes across `05-微信小游戏版本/` & `scripts/` + Tier 5 adversarial test module `scripts/e2e_tier5_adversarial.mjs` (and/or `scripts/test_v2_core.mjs` additions).

---

## Interface Contracts

### 1. `src/constants.js` ↔ All Modules
```js
module.exports = {
  STORAGE_KEY: 'hoshi_kissa_bakery_save_v1',
  GAME_TITLE: '一起做猫饼',
  CATCAKES,               // Array[7] (index 0..6 => tier 1..7): { tier, id:'C1'..'C7', name, color, basePrice, upgradeCosts:[c1,c2,c3,c4], unlockLevel, src:'assets/catcake_1.png', happySrc:'assets/catcake_1_happy.png', desc }
  CATCAKE_MAP,            // Record<1..7, CatcakeDef>
  CATCAKE_UPGRADE_COSTS,  // { 1:[20,40,70,110], 2:[25,50,85,130], 3:[35,65,105,160], 4:[45,85,135,200], 5:[60,110,170,250], 6:[80,140,220,320], 7:[100,180,280,400] } (sum = 3670)
  getCatcakePrice,        // (tier, upgradeLv = 0) => Math.round(basePrice * (1 + 0.2 * clamp(upgradeLv, 0, 4)))
  FLAVORS,                // { plain:{id:'plain',name:'原味',mult:1.0}, matcha:{id:'matcha',name:'宇治抹茶',mult:1.35}, berry:{id:'berry',name:'甜心草莓',mult:1.35}, gold:{id:'gold',name:'星光金箔',mult:1.50,isWildcard:true} }
  COMBO_SIZE_MULTS,       // { 1: 1.00, 2: 1.18, 3: 1.35 }
  SERVE_COMBO_MULTS,      // [1.00, 1.10, 1.22, 1.35, 1.50] (10.0s window)
  SERVE_COMBO_WINDOW_SEC: 10.0,
  PATIENCE_TIP_BANDS,     // { greenThreshold: 0.55, greenMult: 1.30, yellowThreshold: 0.25, yellowMult: 1.00, redMult: 0.85 }
  FEVER_CONFIG,           // { durationSec: 10.0, scoreMult: 1.35, patienceDecayMult: 0.5, gainNormal: 20, gainGreen: 25, gainVip: 35 }
  SHOP_DEVICES,           // Array[4]: dev_tray, dev_flour, dev_teapot, dev_tools
  DEVICE_UPGRADE_COSTS,   // { dev_tray:[60,150], dev_flour:[45,95,170], dev_teapot:[50,105,185], dev_tools:[40,90,160] } (sum = 1150)
  CUSTOMERS,              // Array[8]: cust_ragdoll, cust_orange, cust_silver, cust_rabbit, cust_fox (bountyMult:1.25, isUrgent:true), cust_raccoon, cust_shiba, cust_critic (bountyMult:1.50, isVip:true, rewardDustBonus:5)
  CUSTOMER_MAP,           // Record<customerId, CustomerDef>
  CUSTOMERS_ATLAS_RECTS,  // Record<customerId, { x, y, w:256, h:256 }> on 1024x512 customers_atlas.png
  BOARD_TILES_ATLAS_RECTS,// Record<'tile_gold'|'tile_matcha'|'tile_berry'|'tile_block'|'tile_ice'|'btn_knead'|'btn_trash'|'badge_flavor_set', { x, y, w:128, h:128 }> on 512x256 board_tiles_atlas.png
  PATRONS,                // Array[3] with canonical id IN ['mikan', 'luna', 'mugi'] (cost 0, 80, 120; src 'assets/chef_mikan.png', 'assets/patron_luna.png', 'assets/patron_mugi.png')
  PATRON_COSTS,           // { mikan: 0, luna: 80, mugi: 120 } (sum = 200)
  normalizePatronId,      // ('chef_mikan'->'mikan', 'patron_luna'->'luna', 'patron_mugi'->'mugi', default 'mikan')
  TOOLS,                  // { fork:{id:'fork',name:'泡泡清格叉',cost:15,maxBuyPerLevel:1,src:'assets/tool_fork.png'}, spoon:{id:'spoon',name:'升阶魔法勺',cost:20,maxBuyPerLevel:1,src:'assets/tool_spoon.png'} }
  BOARD_THEMES,           // { amber:{id:'amber',cost:0,...}, sakura:{id:'sakura',cost:80,...}, moonlight:{id:'moonlight',cost:120,...} }
  BOARD_THEME_LIST,       // Array[3]
  THEME_COSTS,            // { amber: 0, sakura: 80, moonlight: 120 } (sum = 200)
  ASSET_PATHS,            // Only v2 + retained assets (30 runtime files post-cleanup); NO tier_1..9, NO title_hero.jpg, NO event_yarn_ball.png, NO tool_shake.png
  UI_ATLAS_RECTS, UI_ATLAS_2_RECTS, UI_ATLAS_3_RECTS,
  TUTORIAL_STEPS,         // 6 spotlight steps ('intro_slide' pt 1..3 on '1-1', 'tray_trash' on '1-3', 'flavor_tile' on '2-1', 'ice_tile' on '3-1')
  ACHIEVEMENTS,
  DEFAULT_NPC_RIVALS,     // Offline leaderboard fallback entries with { nickName, avatarPreset, totalStars, totalCumulativeScore, isNpc: true }
  getChefRank
};
```

### 2. `src/levels_data.js` ↔ Engine / UI / Save / QA
```js
module.exports = {
  CHAPTERS,               // Array[3]: Ch1(unlockStars:0, prevLevelReq:null, firstStarDust:[15,20,30], baseClearDust:10), Ch2(18, '1-10', [20,25,35], 14), Ch3(40, '2-10', [25,35,45], 18)
  RECIPES,                // Record<'R01'..'R24', RecipeDef>
  RECIPE_LIST,            // Array[24]
  LEVELS,                 // Array[30] ordered '1-1'..'1-10', '2-1'..'2-10', '3-1'..'3-10'
  LEVEL_MAP,              // Record<levelId, LevelConfig>
  VALID_LEVEL_IDS,        // Array[30] of strings
  getLevelById,           // (id) => LevelConfig | null
  getNextLevelId,         // (id) => string | null ('1-10'->'2-1', '2-10'->'3-1', '3-10'->null)
  computeTotalStars,      // (levelStars) => number (0..90)
  isChapterUnlocked,      // (chapterNum, levelStars) => { unlocked: boolean, reason: string, requiredStars: number, prevLevelReq: string|null }
  isLevelUnlocked         // (levelId, levelStars) => { unlocked: boolean, reason: string }
};
```
Each `LevelConfig` has: `{ id, chapter, indexInChapter, name, durationSec, stars:[s1,s2,s3], baseClearDust, firstStarDust:[d1,d2,d3], matrix:string[], presets:Array<{r,c,tier,flavor,frozen}>, allowedRecipes:string[], urgentRate:number, vipQuota:number, vipQuotaRange:[number,number], vipFixedRecipeId:string|null, rushEndSec:number|null, desc:string }`.

### 3. `src/grid_engine.js` ↔ `game_app.js` / `board_renderer.js` / Unit Tests
- Zero DOM/Canvas dependencies; deterministic when `rng` function is passed. **Zero score fields or score mutations.**
```js
module.exports = {
  createGridState,        // (levelCfg, preplaced = levelCfg.presets) => GridState { rows, cols, nextUid, cells: Cell[][] }
  slideGrid,              // (state, dir, spawnOpts = { c2Rate: 0.10, rng: Math.random, skipSpawn: false }) => { moved: boolean, mergeEvents, moveEvents, brokenIceCells, spawned, skillChargeGain }
  kneadSpawn,             // (state, spawnOpts = { c2Rate: 0.10, rng: Math.random }) => { spawned: boolean, r?, c?, tile?, reason? }
  removeTileAt,           // (state, r, c, opts = { allowShatterIce: false }) => { removed: boolean, shatteredIce: boolean, tile: Tile|null, reason?: string }
  upgradeTileAt,          // (state, r, c) => { upgraded: boolean, tile: Tile|null, skillChargeGain: number, reason?: string }
  shatterAdjacentIce,     // (state, r, c) => Array<{ r, c, tile }>
  resolveMergedFlavor,    // (movingTile, targetTile, destCellType) => 'plain'|'matcha'|'berry'|'gold'
  applyCellDye,           // (tile, cellType) => FlavorId ('gold' never downgrades on 'matcha'|'berry')
  canAnyMove,             // (state) => boolean
  getMaxBoardTier,        // (state) => number
  applyLunaBoardTidy,     // (state) => { clearedCount: number, movedTiles: number }
  applyMugiBoardBlast     // (state, rng = Math.random) => { shatteredCells: Array<{r,c}>, upgradedCells: Array<{r,c,tier}> }
};
```

### 4. `src/order_service.js` ↔ `game_app.js` / `board_renderer.js` / Unit Tests
- Manages 3 seats, 3–4 slot tray, multiset matching, combo/fever, and the **SOLE** score calculation in the game:
```js
module.exports = {
  createOrderState,       // (levelCfg, saveData, rng = Math.random) => OrderState
  stepCustomers,          // (state, dt, opts = { freezeActive: false, boardMaxTier: 2, boardFlavors: [], rng: Math.random }) => { spawnedSeats, angryLeftSeats, comboExpired, feverEnded }
  tryPlaceToTray,         // (state, tile) => { placed: boolean, slotIdx: number, reason?: 'tray_full'|'invalid_tile' }
  discardTraySlot,        // (state, slotIdx) => { discarded: boolean, tile: TrayTile|null }
  matchCustomerWithTray,  // (order, tray) => { fullMatch: boolean, slotMatches: Array<number|null>, usedTrayIndices: number[], usedTiles: TrayTile[] }
  refreshAllOrderMarks,   // (state) => void (updates slotMatches on all seated customers for UI checkmarks & board gold rings)
  getNeededBoardTiers,    // (state) => { allNeeded: Array<{tier,flavor}>, preferredNeeded: Array<{tier,flavor}> }
  matchTrayToCustomer,    // (state, scoreCtx) => { served: boolean, seatIdx?: number, order?: CustomerOrder, usedTrayIndices?: number[], scoreGain?: number, dustBonus?: number, triggeredFever?: boolean, skillChargeGain?: number }
  computeServeScore,      // (order, usedTiles, scoreCtx) => number (single outer Math.round)
  applyMikanComfortTea,   // (state) => { boostedSeats: number, freezeSec: 5.0 }
  computeLevelSettlement  // (levelCfg, orderState, prevStars) => { cleared: boolean, starsEarned: 0|1|2|3, newStarsDelta: number, firstStarDustAward: number, clearDustAward: number, vipDustAward: number, threeStarBonusDust: number, consolationDust: number, totalDustAward: number }
};
```

### 5. `src/board_renderer.js` & `src/audio.js` ↔ `screens_ui.js` / `game_app.js`
- `board_renderer.js` exports: `{ computeBoardLayout, renderCustomersBar, renderTrayStrip, renderBoardStage, hitTestBoardCell }`.
- `audio.js` (`StarlightAudio`) preserves all existing BGM/SFX methods and adds:
  - `playGridSlide()`, `playGridBlocked()`, `playKneadSpawn()`, `playTrayPlace()`, `playTrayTrash()`, `playCustomerAngry()`, `playStarUnlock(starIndex)`.

### 6. `src/save_sync.js`, `src/platform.js` & `cloudfunctions/kissa_sync/index.js`
- `save_sync.js` exports:
  ```js
  module.exports = {
    SCHEMA_VERSION: 2,
    MAX_OFFLINE_STARDUST_DELTA: 1500,
    createDefaultSave,          // () => v2Save (schemaVersion:2, bankStardust:30, totalEarnedStardust:30, consumableSpentStardust:0, ...)
    migrateV1ToV2,              // (raw) => v2Save (reconstructs v1TotalEarned +20 luna +20 mugi +50 veteran gift, refunds 100% shopUpgrades)
    computeSpentStardust,       // (save) => catcakeSpent + deviceSpent + patronSpent + themeSpent + (save.consumableSpentStardust || 0)
    normalizeSaveData,          // (raw) => v2Save (runs migrateV1ToV2 if !schemaVersion || schemaVersion < 2; enforces bank = totalEarned - spent)
    mergeSaveData,              // (localRaw, cloudRaw) => v2Save (lossless union + <=1500 offline delta)
    loadLocalSave,              // (platform) => v2Save (also cleans up legacy hoshi_kissa_active_run* keys)
    saveLocalSave,              // (platform, save) => v2Save
    recordLevelSettlementToSave // (save, levelId, score, starsEarned, totalDustAward, runStats) => v2Save
  };
  ```
- `cloudfunctions/kissa_sync/index.js` actions:
  - `'pull'`: returns normalized `schemaVersion: 2` player doc (auto-migrating v1 cloud docs).
  - `'push'`: validates `levelStars` (`0..3`, `totalStars <= 90`), per-chapter `levelBestScores` caps (`1-* <= 35000`, `2-* <= 90000`, `3-* <= 220000`, `totalCumulativeScore <= 3450000`), `runReport` (`serves >= 1` required if `score > 0`), shop costs + `consumableSpentStardust`, optimistic `revision` lock.
  - `'updateProfile'`: updates `nickName`, `avatarUrl`, `avatarPreset`, `authorized`.
  - `'leaderboard'`: accepts `boardType: 'stars' | 'score'` (`'stars'` default; also tolerates `'totalScore'` alias → `'score'`), returns `{ ok: true, boardType, list: Top50[], myRank, totalPlayers }`.

### 7. E2E & Debug Harness Contract (`globalThis.__HOSHI_DEBUG__` & Canonical `HitRegistry` IDs)
To ensure 100% opaque-box compatibility between `M4` (`game_app.js`/`screens_ui.js`/`modals_ui.js`) and `E2E` (`scripts/verify_minigame_e2e.mjs`), `game_app.js` MUST expose `globalThis.__HOSHI_DEBUG__` (and alias `globalThis.__game = globalThis.__HOSHI_DEBUG__`):
```js
globalThis.__HOSHI_DEBUG__ = {
  version: '2.0',
  getState: () => ({
    screen,                     // 'lobby' | 'playing' | 'result'
    selectedChapter,            // 1 | 2 | 3
    previewLevelId,             // e.g. '1-1'
    currentLevelId,             // e.g. '1-1' | null
    activeModal,                // null | 'level_preview' | 'level_result' | 'shop' | 'compendium' | 'leaderboard' | 'pause' | 'help' | 'confirm'
    activeShopTab,              // 'catcakes' | 'devices' | 'patrons' | 'themes'
    leaderboardBoardType,       // 'stars' | 'score'
    activeTutorialStep,         // null | string ('intro_slide_1', 'intro_slide_2', 'intro_slide_3', 'tray_trash', 'flavor_tile', 'ice_tile')
    score,                      // number (MUST equal orderState.score during play; 0 before first serve)
    timeLeft,                   // number (seconds remaining)
    ordersServed,               // number
    vipServed,                  // number
    comboCount,                 // number
    feverActive,                // boolean
    feverEnergy,                // 0..100
    skillEnergy,                // 0..100
    activeTool,                 // null | 'fork' | 'spoon'
    toolCounts,                 // { fork: number, spoon: number }
    trayCapacity,               // 3 | 4
    tray,                       // Array<{ uid, tier, flavor } | null>
    seats,                      // Array[3] of { customerId, recipeId, patience, maxPatience, isVip, isUrgent, slots } | null
    preferredSeatIdx,           // null | 0 | 1 | 2
    grid,                       // { rows, cols, cells: Array<Array<{ r, c, type, tile: { tier, flavor, frozenHp } | null }>> }
    boardLayout,                // { x, y, w, h, rows, cols, cellSize, gridX, gridY } | null
    lastResult,                 // Settlement summary object when Result modal open
    cloudStatus,                // 'idle' | 'syncing' | 'synced' | 'retry_pending' | 'local_only'
    assetsLoaded,               // number
    assetsTotal,                // number (30 after v1 legacy cleanup)
    metrics,                    // { width, height, dpr, safeTop, safeBottom, menuRect }
    hits                        // Array<{ id, x, y, w, h }> from current frame's HitRegistry
  }),
  getSaveData: () => saveData,  // Live v2 save object
  setSaveData: (rawObj) => ..., // Normalizes/migrates & applies saveData (for E2E save/migration setup)
  clickHit: (hitId) => boolean, // Synthesizes tap on registered HitRegistry item by id
  openLevelPreview: (levelId) => boolean,
  startLevel: (levelId, opts) => boolean, // Starts level directly (closing preview if open)
  slide: (dir) => object,       // Triggers 'left'|'right'|'up'|'down' slide through app controller
  knead: () => object,          // Triggers knead action through app controller
  tapBoardCell: (r, c) => object,// Triggers single-tap on board cell (r, c)
  doubleTapTray: (slotIdx) => object, // Triggers double-tap discard on tray slot
  useToolOnCell: (kind, r, c) => object, // Arms & applies 'fork'|'spoon' on (r, c)
  castPatronSkill: () => object, // Triggers patron skill if skillEnergy >= 100 (or opts.forceCharge in test setup)
  advanceTime: (seconds) => void,// Deterministically steps simulation timer/customers/animations forward
  openModal: (modalName) => void,
  closeModal: () => void
};
```
**Canonical `HitRegistry` IDs** (must be registered cleanly within `[0, width] × [0, height - safeBottom]` and non-overlapping with `menuRect`):
- **Lobby**: `chapter_prev`, `chapter_next`, `level_node_1-1`..`level_node_3-10`, `lobby_start_cta`, `lobby_patron_switch`, `dock_shop`, `dock_compendium`, `dock_leaderboard`, `dock_themes`, `lobby_bgm_btn`, `lobby_sfx_btn`, `lobby_help_btn`.
- **Play HUD**: `pause_btn`, `seat_0`, `seat_1`, `seat_2`, `tray_slot_0`..`tray_slot_3`, `tray_trash_btn`, `knead_btn`, `tool_fork_btn`, `tool_spoon_btn`, `patron_skill_btn`.
- **Modals**: `modal_close`, `preview_start_btn`, `preview_patron_mikan`, `preview_patron_luna`, `preview_patron_mugi`, `result_retry_btn`, `result_shop_btn`, `result_next_btn`, `shop_tab_catcakes`, `shop_tab_devices`, `shop_tab_patrons`, `shop_tab_themes`, `shop_buy_catcake_1`..`7`, `shop_buy_dev_tray`, `shop_buy_dev_flour`, `shop_buy_dev_teapot`, `shop_buy_dev_tools`, `shop_buy_patron_luna`, `shop_buy_patron_mugi`, `shop_equip_patron_mikan`..`mugi`, `shop_buy_theme_sakura`, `shop_buy_theme_moonlight`, `shop_equip_theme_amber`..`moonlight`, `compendium_tab_catcakes`, `compendium_tab_recipes`, `leaderboard_tab_stars`, `leaderboard_tab_score`.
