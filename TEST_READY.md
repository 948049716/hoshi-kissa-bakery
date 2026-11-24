# E2E Test Suite Readiness Sign-Off (`TEST_READY.md`)

- **Project**: 《一起做猫饼》(Hoshi Kissa Bakery · `v0.8.0` Baseline Sign-Off; `v0.9.0` Spec Pending Code Sync) — Branch `gameplay_redesign_dessert_service`
- **Track**: E2E Testing Track — Opaque-Box 4-Tier Headless Chromium CDP Suite (`sub_orch_e2e_r3`)
- **Gate Status**: **`OVERALL GATE PASS` (`v0.8.0` Baseline: `5/5` Cycle-4 Final Verification Wave: `CLEAN` + `APPROVE`×2 + `PASS`×2)**
- **Published At**: `2026-11-24T04:02:00Z` *(Version labels normalized to pre-launch `v0.8.0 -> v0.9.0`; see [docs/v0.9.0-版本调整计划书.md](./docs/v0.9.0-版本调整计划书.md) for upcoming `v0.9.0` assertion updates)*
- **Infra & Traceability Spec**: [TEST_INFRA.md](./TEST_INFRA.md) | **Global Contract**: [PROJECT.md](./PROJECT.md) §7

---

## 1. Test Runner Commands (Milestone M5 & GitHub Actions CI)

### Full 4-Tier Suite (Default CI Entrypoint — `220` Cases)
```bash
node scripts/verify_minigame_e2e.mjs
```

### Sequential Tiered Execution (M5 Phase 1 — Zero-`/tmp` Scratch Isolation)
```bash
# 0. Syntax & zero-browser 220-case inventory / F01..F16 matrix check (0 dirs created)
for f in scripts/*.mjs; do node --check "$f"; done
node scripts/verify_minigame_e2e.mjs --list

# 1. 12-check CDP & harness self-test against /__self_test.html
CHROME_USER_DATA_DIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_chrome" \
VERIFY_OUT_DIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out" \
TMPDIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_tmp" \
node scripts/verify_minigame_e2e.mjs --self-test

# 2. Sequential Tiers 1 -> 2 -> 3 -> 4 (and optional Tier 5 in M5 Phase 2)
CHROME_USER_DATA_DIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_chrome" \
TMPDIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_tmp" \
node scripts/verify_minigame_e2e.mjs --tier 1 --out-dir "$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out"

CHROME_USER_DATA_DIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_chrome" \
TMPDIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_tmp" \
node scripts/verify_minigame_e2e.mjs --tier 2 --out-dir "$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out"

CHROME_USER_DATA_DIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_chrome" \
TMPDIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_tmp" \
node scripts/verify_minigame_e2e.mjs --tier 3 --out-dir "$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out"

CHROME_USER_DATA_DIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_chrome" \
TMPDIR="$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_tmp" \
node scripts/verify_minigame_e2e.mjs --tier 4 --out-dir "$HOME/.gemini/jetski/scratch/teamwork_tmp/e2e_out"

# 3. Targeted debugging by feature, exact case ID, or title substring
node scripts/verify_minigame_e2e.mjs --tier 1,2 --feature F07
node scripts/verify_minigame_e2e.mjs --case T1-F10-02,T2-F09-03,T4-05
node scripts/verify_minigame_e2e.mjs --filter "multiset"
```

---

## 2. 4-Tier Coverage Summary (`96 + 96 + 18 + 10 = 220` Total Cases)

| Tier | Module | Scope | Gate Floor | Actual Count | Assertions / Invariants Enforced |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **Tier 1** | [scripts/e2e_tier1.mjs](./scripts/e2e_tier1.mjs) | Isolated Feature Happy-Path E2E (`6` primary cases × `16` features) | `>= 80` & `>= 5/feat` | **`96`** (`6..16` tagged/feat) | Core user flows, Serve-Only Scoring Iron Law (`score === 0` on non-serves), real CDP touch/keyboard inputs, WebAudio synthesis, cloud sync |
| **Tier 2** | [scripts/e2e_tier2.mjs](./scripts/e2e_tier2.mjs) | Boundary, Negative, Anti-Cheat & Error-Recovery E2E (`6` primary cases × `16` features) | `>= 80` & `>= 5/feat` | **`96`** (`6..11` tagged/feat) | Clamping, `<30⭐` insufficient stardust rejections, `kissa_sync` `serves >= 1` & chapter caps, `8.0s` closing guard, max-tier `C7+C7`, legacy v1 corruption recovery |
| **Tier 3** | [scripts/e2e_tier3.mjs](./scripts/e2e_tier3.mjs) | Cross-Feature Pairwise (`Fxx × Fyy`) Runtime Interaction E2E (`T3-01..T3-18`) | `>= 16` & `>= 1/feat` | **`18`** (`1..5` tagged/feat) | Shaped grid × dye/ice, knead × `dev_flour`/`luna`, tray × multiset priority, Fever × patience/score, patron skills × utensils, spotlight × audio muffle |
| **Tier 4** | [scripts/e2e_tier4.mjs](./scripts/e2e_tier4.mjs) | End-to-End Player Journeys (`T4-01..T4-10`, incl. 1-to-1 `docs/06-测试与端到端验收规格书.md` §4 `L3-1..L3-8`) | `>= 8` | **`10`** (`1..5` tagged/feat) | `T4-01..T4-08` (`L3-1..L3-8`), `T4-09` (veteran v1→v2 `670⭐` → Shop → `3-10` Boss → Dual Cloud Leaderboards), `T4-10` (deadlock recovery + offline→online delta merge & retry) |
| **Total** | `scripts/verify_minigame_e2e.mjs` + `e2e_harness.mjs` | Zero-npm raw CDP WebSocket runner + `60s` watchdog + unconditional iOS/emoji/audio gates | `>= 184` | **`220`** (`1,660` direct `ctx.assert*` in `tc.run`) | `0` `console.error`, `0` uncaught exceptions, `0` HTTP `4xx`/`5xx`, `0` `hsl()`/`hsla()` stops, `0` native color emojis, `0` external audio elements, `0` `/tmp` writes |

---

## 3. Complete `F01..F16` Feature Checklist

- [x] **`F01` — Storybook Art Assets & Extraction Pipeline (`v0.8.0`)** (`T1-F01-01..06`, `T2-F01-01..06`, `T3-18`, `T4-07`, `T4-08`): 14 `192×192` catcake PNGs, `customers_atlas.png` (`1024×512`), `board_tiles_atlas.png` (`512×256` with hollow `tile_gold` center `alpha === 0`), `title_hero_v2.jpg` (`1280×720`), QA showcase/preview, `30` runtime assets (`<= 2.5 MB`), `0` legacy `tier_1..9*`/jar files.
- [x] **`F02` — 7-Tier Cat-Cake Catalog & 30-Level Dataset** (`T1-F02-01..06`, `T2-F02-01..06`, `T3-11`, `T4-01`, `T4-06`, `T4-09`): `C1~C7` (`Lv.0~4`, `3,670⭐`), `24` recipes (`R01~R24`), `8` customers, `4` devices (`1,150⭐`), `3` patrons (`200⭐`), `3` themes (`200⭐`), and `30` levels (`1-1..3-10`) satisfying all 5 L2 static invariants.
- [x] **`F03` — Shaped-Grid 2048 Slide & Non-Chaining Merge** (`T1-F03-01..06`, `T2-F03-01..06`, `T3-01`, `T3-08`, `T4-02`, `T4-09`): `#`, `X`, and `frozenHp > 0` row/col segmentation, single-step non-chaining merge (`UT-G01..G07`), `C7+C7` cap, `+8%` skill on `>= C5` merge, `0` score on slides/merges.
- [x] **`F04` — Flavor Inheritance, Special Cell Dyeing & Orthogonal Ice** (`T1-F04-01..06`, `T2-F04-01..06`, `T3-01`, `T3-02`, `T3-07`, `T4-09`): Cross-flavor merge priority (`gold` > moving > stationary > `plain`), `G/M/B` dyeing (`gold` never downgraded on `M/B`), 4-neighbor orthogonal post-slide ice shatter (`UT-G08..G10`).
- [x] **`F05` — Independent Knead Button (`🐾 揉面补料`)** (`T1-F05-01..06`, `T2-F05-01..06`, `T3-02`, `T3-09`, `T4-02`, `T4-04`): `0.12s` debounce, `Space` shortcut, `c2Rate` (`dev_flour` + `luna` `+8%`), `G/M/B` landing dye, `board_full` graceful handling, `0` score (`UT-G11`).
- [x] **`F06` — Serving Tray (`3–4` Slots) & Double-Tap Trash (`🗑️`)** (`T1-F06-01..06`, `T2-F06-01..06`, `T3-03`, `T3-10`, `T3-17`, `T4-03`, `T4-04`, `T4-06`, `T4-10`): Single-tap non-frozen tile to leftmost empty tray slot (`3` default, `4` at `dev_tray >= 1`), `<= 320ms` double-tap discard (`0` score penalty), full-board deadlock recovery (`L3-3`, `L3-4`).
- [x] **`F07` — Subset Multiset Order Matching & Customer Priority** (`T1-F07-01..06`, `T2-F07-01..06`, `T3-03`, `T3-04`, `T4-03`, `T4-09`): Constrained flavor (`exact` → `gold`), `'any'` (`plain` → flavored → `gold`), `0.10s` auto-serve, tie-break (`preferredSeatIdx` > `>=0.10` lowest patience ratio > `isVip` > `isUrgent` > lowest `seatIdx`, `UT-O02..O05`).
- [x] **`F08` — Pure Serve-Only Scoring Formula, Combo & Starlight Fever** (`T1-F08-01..06`, `T2-F08-01..06`, `T3-04`, `T3-05`, `T3-06`, `T4-02`, `T4-03`, `T4-09`): Sole scoring path on completed serve (`UT-O01`, `UT-O06`), `10.0s` serve combo (`1.00..1.50`), serve-only Fever (`+20/+25/+35%` → `10s` `×1.35` score & `×0.5` patience decay).
- [x] **`F09` — 3-Seat Real-Time Customer Waves, Rush Hour & Closing Guard** (`T1-F09-01..06`, `T2-F09-01..06`, `T3-05`, `T3-12`, `T4-03`, `T4-05`, `T4-09`): Initial staggered seating, `1.2–2.2s` normal / `0.8s` Rush Hour turnover, `< 8.0s` closing guard, accessible-order guarantee, `0`-patience angry walkout (`combo -> 0`, `0` score penalty, `UT-O07`), VIP `+5⭐`.
- [x] **`F10` — Procedural Web Audio BGM & 20 Tactile SFX** (`T1-F10-01..06`, `T2-F10-01..06`, `T3-16`, `T4-08`): `waltz`/`bossa`/`off` BGM cycling & persistence, `580 Hz` modal muffle / `12500 Hz` restore, missing-`createConvolver` Schroeder delay fallback, `wx.onHide`/`wx.onShow` pause/resume, `7` new v2 SFX, `0` external audio elements.
- [x] **`F11` — Lossless v1→v2 Save Migration & Multi-Device Sync** (`T1-F11-01..06`, `T2-F11-01..06`, `T3-13`, `T3-14`, `T4-06`, `T4-09`, `T4-10`): `schemaVersion: 2`, `100%` v1 `shopUpgrades` refund + `luna`/`mugi` `+20⭐` + `+50⭐` veteran gift (`UT-S01 -> 230⭐`), `bank = totalEarned - spent` (`totalEarned >= 30`), `<= 1500` offline delta union (`UT-S02`).
- [x] **`F12` — WeChat CloudBase `kissa_sync` v2 & Dual Leaderboards** (`T1-F12-01..06`, `T2-F12-01..06`, `T3-15`, `T4-09`, `T4-10`): `pull`/`push`/`updateProfile`/`leaderboard` (`stars` & `score` + `totalScore` alias), `35k/90k/220k` chapter caps, `serves >= 1` anti-cheat, optimistic `revision` lock, offline `local_only` NPC fallback & `retry_pending` recovery.
- [x] **`F13` — 3-Chapter 30-Level Campaign Lobby, Gates & Settlement** (`T1-F13-01..06`, `T2-F13-01..06`, `T3-12`, `T3-15`, `T4-01`, `T4-05`, `T4-09`): Rebrand `一起做猫饼`, purge `rush`/`zen`, 3-chapter map (`Ch.2`: `1-10` + `18★`; `Ch.3`: `2-10` + `40★`), `level_preview` & `level_result` first-star/clear/VIP/3★/consolation stardust (`L3-1`, `L3-5`).
- [x] **`F14` — 4-Tab Kissa Shop, Compendium & Dual Leaderboard UI** (`T1-F14-01..06`, `T2-F14-01..06`, `T3-09`, `T3-10`, `T3-11`, `T3-13`, `T3-18`, `T4-06`, `T4-07`, `T4-09`): `5,220⭐` 4-tab Kissa Shop (`3,670 + 1,150 + 200 + 200`), 2-tab Compendium (`7` catcakes + `24` recipes), Dual Leaderboard & `UserInfoButton` profile authorization, Pause/Confirm/Help modals (`L3-6`).
- [x] **`F15` — 3 Chef Patrons & 2 Emergency Utensils (`fork` & `spoon`)** (`T1-F15-01..06`, `T2-F15-01..06`, `T3-06`, `T3-07`, `T3-08`, `T3-14`, `T4-09`, `T4-10`): Active + passive skills for `mikan`, `luna`, and `mugi`; `fork` (`15⭐` emergency buy, delete/thaw) & `spoon` (`20⭐` emergency buy, `+1` tier on `C1~C6`, limit `1`/level), `0` direct score.
- [x] **`F16` — Responsive Multi-Viewport HUD, Gesture FSM & 6-Step Guide** (`T1-F16-01..06`, `T2-F16-01..06`, `T3-16`, `T3-17`, `T4-02`, `T4-03`, `T4-04`, `T4-07`, `T4-08`): `375×667`, `390×844` (capsule & `safeBottom` compliant), and `1280×760` (3-column + keyboard `WASD/Arrows`, `Space`, `1/2`, `F`), gesture FSM (`>=18px` slide vs `<14px & <350ms` tap vs `<=320ms` double-tap), 6-step non-blocking spotlight tutorials (`L3-7`, `L3-8`).

---

## 4. Cycle-4 Independent 5-Agent Gate Sign-Off (`5 / 5 PASS`)

| Role | Subagent | Verdict | Key Verification Evidence |
| :--- | :--- | :---: | :--- |
| **Forensic Integrity Auditor** *(Evaluated FIRST)* | `e2e_r3_auditor_1` (`1552bacd8598270c234943fda3fa7969`) | **`CLEAN`** | `21,698` lines / `220` cases / `1,660` direct `ctx.assert*` (`1,678` file-wide) audited; `0` dilution/bypasses/tautologies/clones, `12/12` `--self-test`, `DOMParser+importNode` `<audio>` trap caught, `0` `/tmp` writes (`e2e_r3_auditor_1/handoff.md`) |
| **Primary Full-Suite Reviewer** | `e2e_r3_c4_reviewer_1` (`5f987718ab6012f2987c74a6bd87b204`) | **`APPROVE`** | `8/8` `node --check`, `220` `--list`/`--dry-run` (`0` dirs), `12/12` negative CLI `exit 1`, `12/12` `--self-test`, `9/9` live M1 CDP cases, `7/7` external audio traps, `15/15` live WebAudio, `701/701` MC (`e2e_r3_c4_reviewer_1/handoff.md`) |
| **Secondary Real-Engine & Spec Reviewer** | `e2e_r3_c4_reviewer_2` (`9fd9d05addfcfaaaee5ea44766dd0d9d`) | **`APPROVE`** | `5,262/5,262` (`100.00%`) literal `tc.run(ctx)` real-engine MC across Mode A & Mode B (`1,502/1,502` on `T2-F09-03`), `25/25` live WebAudio, `100%` `06` §4 `L3-1..L3-8` & `PROJECT.md` §7 fidelity (`e2e_r3_c4_reviewer_2/handoff.md`) |
| **Empirical CLI, Live Audio & Modal Challenger** | `e2e_r3_c4_challenger_1` (`3eb96068d0aad47dc7ac8a3171151ccb`) | **`PASS`** | `69/69` hostile CLI gates `exit 1` (`0` dirs), `19/19` sandbox escapes blocked, `75` hit-lookup audit + `15/15` live CDP modal/spotlight runs, `56/56` live Chromium `src/audio.js` runs across all 13 `F10` cases (`e2e_r3_c4_challenger_1/handoff.md`) |
| **Adversarial Failure-Trap & Hygiene Challenger** | `e2e_r3_c4_challenger_2` (`84f7937f9c268876e981996490c1d147`) | **`PASS`** | `14` external audio vectors, `22/22` CLI runner trap outcomes + `timeoutMs` watchdog recovery, `400/400` `T2-F14-04` + `402/402` `T2-F09-03` MC, `25/25` live WebAudio, `SIGINT`/`SIGTERM` zero-`/tmp` proof (`e2e_r3_c4_challenger_2/handoff.md`) |
