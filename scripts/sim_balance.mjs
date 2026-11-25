#!/usr/bin/env node
/**
 * 《一起做猫饼》数值模拟器 / Balance Simulator (v0.10+)
 *
 * Boots the REAL game_app controller headlessly (scripts/lib/headless_app.mjs) and lets three
 * bot skill profiles play every campaign level over many deterministic seeds. Reports score
 * distributions + gameplay KPIs, suggests calibrated star thresholds and can gate CI.
 *
 * Usage:
 *   node scripts/sim_balance.mjs                       # full report (default 16 seeds)
 *   node scripts/sim_balance.mjs --seeds 40 --levels 1-1,1-2
 *   node scripts/sim_balance.mjs --suggest             # print suggested stars per level
 *   node scripts/sim_balance.mjs --write               # write suggested stars into levels_data.js
 *   node scripts/sim_balance.mjs --check --seeds 6     # CI gate (exit 1 on violations)
 *   node scripts/sim_balance.mjs --json out.json --md out.md
 *
 * Calibration rule (docs/07-数值模拟与调参手册.md):
 *   1★ ≈ novice P50 · 2★ ≈ skilled P50 · 3★ ≈ skilled P85 capped by expert P60,
 *   then smoothed so 1★:2★:3★ stays within [1.30, 1.65] : [1.70, 2.30] and monotonic per chapter.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const LEVELS_PATH = path.join(REPO_ROOT, '05-微信小游戏版本', 'src', 'levels_data.js');

// ---------------------------------------------------------------------------------------------
// Bot profiles & assumed meta progression per chapter (what a typical player owns when arriving)
// ---------------------------------------------------------------------------------------------
export const PROFILES = {
  novice: { label: '新手', aps: 0.88, noise: 0.45, skillUse: 0.6, lookahead: 0, smartTray: false, kneadRhythm: 0.0 },
  skilled: { label: '熟练', aps: 1.32, noise: 0.22, skillUse: 0.9, lookahead: 0, smartTray: true, kneadRhythm: 0.44 },
  expert: { label: '高手', aps: 1.95, noise: 0.0, skillUse: 1.0, lookahead: 1, smartTray: true, kneadRhythm: 0.44 }
};

export const META_BY_CHAPTER = {
  1: { catcakeLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 } },
  2: { catcakeLevels: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0, 7: 0 }, deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 0, dev_tools: 1 } },
  3: { catcakeLevels: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 0 }, deviceUpgrades: { dev_tray: 2, dev_flour: 2, dev_teapot: 1, dev_tools: 1 } }
};

const DIRS = ['left', 'right', 'up', 'down'];
const SIM_STEP = 0.1;

// ---------------------------------------------------------------------------------------------
// Worker: play runs
// ---------------------------------------------------------------------------------------------
async function workerMain() {
  const { bootHeadlessApp } = await import('./lib/headless_app.mjs');
  const env = bootHeadlessApp();
  for (let i = 0; i < 4; i++) await new Promise((r) => queueMicrotask(r));
  const { dbg } = env;
  dbg.setHeadlessSim(true);
  const GridEngine = env.require('grid_engine.js');
  const { createRng } = env.require('rng.js');

  const results = [];
  for (const job of workerData.jobs) {
    results.push(playRun(dbg, GridEngine, createRng, job));
  }
  parentPort.postMessage(results);
}

function tileFits(tile, need) {
  if (!tile || (tile.frozenHp || 0) > 0 || tile.frozen === true) return false;
  if (tile.tier !== need.tier) return false;
  if (need.flavor === 'any') return true;
  return tile.flavor === need.flavor || tile.flavor === 'gold';
}

function collectNeeds(os, goal) {
  const needs = [];
  const activeGoal = goal && !goal.done ? goal : null;
  for (let s = 0; s < os.seats.length; s++) {
    const seat = os.seats[s];
    if (!seat || seat.readyToServe) continue;
    const ratio = seat.maxPatience > 0 ? seat.patience / seat.maxPatience : 1;
    let seatMaxTier = 0;
    for (let k = 0; k < seat.slots.length; k++) {
      if (seat.slots[k].tier > seatMaxTier) seatMaxTier = seat.slots[k].tier;
    }
    const isCenterpieceOrder = Boolean(activeGoal && activeGoal.type === 'centerpiece' && seatMaxTier >= activeGoal.target);
    const isSingleSlot = seat.slots.length === 1;
    for (let k = 0; k < seat.slots.length; k++) {
      const slot = seat.slots[k];
      if (slot.matchedTrayIdx === -1 || slot.matchedTrayIdx === undefined || slot.matchedTrayIdx === null) {
        needs.push({
          tier: slot.tier,
          flavor: slot.flavor,
          seatIdx: s,
          ratio,
          isVip: Boolean(seat.isVip),
          isCenterpieceOrder,
          isSingleSlot
        });
      }
    }
  }
  needs.sort((a, b) => {
    if (activeGoal && activeGoal.type === 'centerpiece' && a.isCenterpieceOrder !== b.isCenterpieceOrder) {
      return b.isCenterpieceOrder - a.isCenterpieceOrder;
    }
    if (activeGoal && activeGoal.type === 'hot_serve' && a.isSingleSlot !== b.isSingleSlot) {
      return b.isSingleSlot - a.isSingleSlot;
    }
    return (b.isVip - a.isVip) || (a.ratio - b.ratio);
  });
  return needs;
}

function trayUsefulMask(os) {
  const useful = new Array(os.trayCapacity).fill(false);
  for (const seat of os.seats) {
    if (!seat) continue;
    for (const slot of seat.slots) {
      if (typeof slot.matchedTrayIdx === 'number' && slot.matchedTrayIdx >= 0) useful[slot.matchedTrayIdx] = true;
    }
  }
  return useful;
}

function countEmpty(gs) {
  let n = 0;
  for (let r = 0; r < gs.rows; r++) {
    for (let c = 0; c < gs.cols; c++) {
      const cell = gs.cells[r][c];
      if (cell && cell.type !== 'void' && cell.type !== 'block' && !cell.tile) n++;
    }
  }
  return n;
}

function evalSlide(GridEngine, gs, dir, neededTiers, rng, goalType, goalTarget) {
  const clone = structuredClone(gs);
  const res = GridEngine.slideGrid(clone, dir, { skipSpawn: true, rng });
  if (!res.moved) return null;
  let score = 0.05;
  for (const me of res.mergeEvents || []) {
    const nt = me.newTier || 0;
    let cpBoost = 0;
    if (goalType === 'centerpiece' && goalTarget > 0) {
      if (nt >= goalTarget) cpBoost = 20;
      else if (nt === goalTarget - 1) cpBoost = 8;
      else if (nt === goalTarget - 2) cpBoost = 2.5;
    }
    score += neededTiers.has(nt) ? 3 + nt * 0.3 + cpBoost : 1 + nt * 0.15 + cpBoost;
  }
  const iceWeight = goalType === 'ice_clear' ? 4.5 : 0.8;
  score += (res.brokenIceCells ? res.brokenIceCells.length : 0) * iceWeight;
  score += countEmpty(clone) * 0.04;
  return { score, clone, merges: (res.mergeEvents || []).length };
}

function playRun(dbg, GridEngine, createRng, job) {
  const prof = PROFILES[job.profile];
  const botRng = createRng(job.seed * 7919 + job.profile.length);
  const meta = META_BY_CHAPTER[job.chapter] || META_BY_CHAPTER[1];
  const ok = dbg.startLevel(job.levelId, {
    seed: job.seed,
    skipTutorial: true,
    modeOverrides: {
      mode: 'sim',
      selectedPatron: job.patron || 'mikan',
      catcakeLevels: meta.catcakeLevels,
      deviceUpgrades: meta.deviceUpgrades,
      devTrayLv: meta.deviceUpgrades.dev_tray,
      devTeapotLv: meta.deviceUpgrades.dev_teapot
    }
  });
  if (!ok) return { ...job, error: 'start_failed' };

  const interval = 1 / prof.aps;
  let guard = 0;
  let lastKneadAt = -99;
  let simT = 0;
  while (guard++ < 5000) {
    const v = dbg.getSimView();
    if (v.screen !== 'playing' || !v.orderState) break;
    const os = v.orderState;
    const gs = v.gridState;
    const goal = v.goal || null;
    const goalType = goal && !goal.done ? goal.type : 'score';
    const goalTarget = goal && !goal.done ? Number(goal.target || 0) : 0;
    let acted = false;

    // 1) serve a ready seat (VIP / lowest patience first)
    let bestSeat = -1;
    let bestKey = Infinity;
    for (let s = 0; s < os.seats.length; s++) {
      const seat = os.seats[s];
      if (seat && seat.readyToServe) {
        const key = (seat.isVip ? -2 : 0) + (seat.maxPatience > 0 ? seat.patience / seat.maxPatience : 1);
        if (key < bestKey) {
          bestKey = key;
          bestSeat = s;
        }
      }
    }
    if (bestSeat >= 0 && botRng() > prof.noise * 0.3) {
      dbg.serveSeat(bestSeat);
      acted = true;
    }

    // 2) move a fitting board tile into the tray
    if (!acted) {
      const freeSlot = os.tray.slice(0, os.trayCapacity).findIndex((t) => !t);
      const needs = collectNeeds(os, goal);
      if (freeSlot >= 0 && needs.length > 0) {
        const nowSec = typeof v.nowSec === 'number' ? v.nowSec : simT;
        // Count how many tiles of each tier are currently unfrozen on board
        const tierCounts = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let r = 0; r < gs.rows; r++) {
          for (let c = 0; c < gs.cols; c++) {
            const t = gs.cells[r][c] && gs.cells[r][c].tile;
            if (t && !(t.frozenHp > 0) && t.tier >= 1 && t.tier <= 7) tierCounts[t.tier] += 1;
          }
        }
        outer: for (const need of needs) {
          // On centerpiece goals, skilled/expert bots conserve (target-1) tiles on board until a target tile exists
          if (
            goalType === 'centerpiece' &&
            prof.smartTray &&
            !need.isCenterpieceOrder &&
            tierCounts[goal.target] === 0 &&
            (need.tier === goal.target - 1 || (goal.target >= 5 && need.tier === goal.target - 2 && tierCounts[goal.target - 1] <= 1 && tierCounts[need.tier] <= 2))
          ) {
            continue;
          }
          let pickR = -1;
          let pickC = -1;
          let pickFresh = false;
          for (let r = 0; r < gs.rows; r++) {
            for (let c = 0; c < gs.cols; c++) {
              const cell = gs.cells[r][c];
              if (cell && cell.tile && tileFits(cell.tile, need)) {
                if (!prof.smartTray && botRng() < prof.noise * 0.4) continue;
                const isFresh =
                  typeof cell.tile.bakedAt === 'number' &&
                  nowSec - cell.tile.bakedAt >= 0 &&
                  nowSec - cell.tile.bakedAt <= 6.0;
                // When chasing hot_serve, skilled/expert bots avoid wasting a 1-slot order on a cold tile unless urgent
                if (goalType === 'hot_serve' && prof.smartTray && need.isSingleSlot && !isFresh && need.ratio > 0.28) {
                  continue;
                }
                if (pickR < 0 || (prof.smartTray && isFresh && !pickFresh)) {
                  pickR = r;
                  pickC = c;
                  pickFresh = isFresh;
                  if (!prof.smartTray || pickFresh) break;
                }
              }
            }
            if (pickR >= 0 && (!prof.smartTray || pickFresh)) break;
          }
          if (pickR >= 0) {
            dbg.tapBoardCell(pickR, pickC);
            acted = true;
            break outer;
          }
        }
      }
      // 2b) On centerpiece goals, skilled/expert bots can spend a free spoon to promote (target-1) -> target
      if (
        !acted &&
        goalType === 'centerpiece' &&
        prof.smartTray &&
        v.toolCounts &&
        v.toolCounts.spoon > 0 &&
        typeof dbg.useToolOnCell === 'function'
      ) {
        let spR = -1;
        let spC = -1;
        for (let r = 0; r < gs.rows && spR < 0; r++) {
          for (let c = 0; c < gs.cols; c++) {
            const t = gs.cells[r][c] && gs.cells[r][c].tile;
            if (t && !(t.frozenHp > 0) && t.tier === goal.target - 1) {
              spR = r;
              spC = c;
              break;
            }
          }
        }
        if (spR >= 0) {
          dbg.useToolOnCell('spoon', spR, spC);
          acted = true;
        }
      }
      // 3) tray clogged with useless items -> discard one
      if (!acted && freeSlot < 0 && (os.trashCooldown || 0) <= 0) {
        const useful = trayUsefulMask(os);
        const junk = useful.findIndex((u, i) => !u && os.tray[i]);
        if (junk >= 0) {
          dbg.doubleTapTray(junk);
          acted = true;
        }
      }
    }

    // 4) patron skill
    if (!acted && v.skillEnergy >= 100 && botRng() < prof.skillUse) {
      dbg.castPatronSkill({});
      acted = true;
    }

    // 5) slide / knead decision
    if (!acted) {
      const neededTiers = new Set();
      for (const n of collectNeeds(os, goal)) {
        neededTiers.add(n.tier);
        if (n.tier > 1) neededTiers.add(n.tier - 1);
      }
      if (goalType === 'centerpiece' && goal && goal.target >= 4) {
        neededTiers.add(goal.target);
        neededTiers.add(goal.target - 1);
        neededTiers.add(goal.target - 2);
      }
      let best = null;
      let bestDir = null;
      const moving = [];
      for (const dir of DIRS) {
        const ev = evalSlide(GridEngine, gs, dir, neededTiers, botRng, goalType, goalTarget);
        if (!ev) continue;
        moving.push(dir);
        let s = ev.score + (prof.noise > 0 ? (botRng() - 0.5) * prof.noise * 4 : 0);
        if (prof.lookahead > 0) {
          let la = 0;
          for (const d2 of DIRS) {
            const ev2 = evalSlide(GridEngine, ev.clone, d2, neededTiers, botRng, goalType, goalTarget);
            if (ev2 && ev2.score > la) la = ev2.score;
          }
          s += la * 0.5;
        }
        if (!best || s > best) {
          best = s;
          bestDir = dir;
        }
      }
      const empty = countEmpty(gs);
      const totalPlayable = gs.rows * gs.cols;
      const canKneadGoal = !(goal && goal.type === 'limited_knead' && goal.kneadsUsed >= goal.target);
      const wantsKnead =
        canKneadGoal &&
        empty > 0 &&
        (best === null || best < (goal && goal.type === 'limited_knead' ? 0.35 : 0.9) || empty / totalPlayable > 0.45);
      const rhythmOk = prof.kneadRhythm <= 0 || simT - lastKneadAt >= prof.kneadRhythm;
      if (wantsKnead && rhythmOk) {
        dbg.knead({ realistic: true });
        lastKneadAt = simT;
        acted = true;
      } else if (bestDir) {
        dbg.slide(bestDir);
        acted = true;
      } else if (moving.length > 0) {
        dbg.slide(moving[Math.floor(botRng() * moving.length)]);
        acted = true;
      } else if (canKneadGoal && empty > 0) {
        dbg.knead({ realistic: true });
        lastKneadAt = simT;
        acted = true;
      }
    }

    dbg.advanceTime(interval, SIM_STEP);
    simT += interval;
  }

  const v = dbg.getSimView();
  const lr = v.lastResult || {};
  const st = v.runStats || {};
  return {
    levelId: job.levelId,
    chapter: job.chapter,
    profile: job.profile,
    seed: job.seed,
    score: lr.score || 0,
    stars: lr.starsEarned || 0,
    serves: lr.ordersServed || 0,
    vipServed: lr.vipServed || 0,
    maxCombo: lr.maxCombo || 0,
    walkouts: st.angryWalkouts || 0,
    crits: st.crits ? st.crits.slice() : [0, 0, 0, 0, 0],
    hotServes: st.hotServes || 0,
    feverCount: st.feverCount || 0,
    overheats: st.overheats || 0,
    kneads: st.kneads || 0,
    slides: st.slides || 0,
    goalDone: Boolean(st.goalDone)
  };
}

// ---------------------------------------------------------------------------------------------
// Main thread: orchestrate, aggregate, calibrate, gate
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { seeds: 16, levels: null, profiles: Object.keys(PROFILES), check: false, suggest: false, write: false, json: null, md: null, workers: Math.max(1, Math.min(os.cpus().length, 4)), quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seeds') out.seeds = Math.max(1, parseInt(argv[++i], 10) || 16);
    else if (a === '--levels') out.levels = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--profiles') out.profiles = argv[++i].split(',').map((s) => s.trim()).filter((p) => PROFILES[p]);
    else if (a === '--check') out.check = true;
    else if (a === '--suggest') out.suggest = true;
    else if (a === '--write') out.write = true;
    else if (a === '--json') out.json = argv[++i];
    else if (a === '--md') out.md = argv[++i];
    else if (a === '--workers') out.workers = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === '--quiet') out.quiet = true;
  }
  return out;
}

export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function roundNice(v) {
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 10000) return Math.round(v / 50) * 50;
  return Math.round(v / 100) * 100;
}

export function aggregate(results) {
  const byKey = new Map();
  for (const r of results) {
    const key = `${r.levelId}|${r.profile}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  const agg = {};
  for (const [key, runs] of byKey) {
    const [levelId, profile] = key.split('|');
    const scores = runs.map((r) => r.score).sort((a, b) => a - b);
    const critRuns = runs.map((r) => (r.crits[2] || 0) + (r.crits[3] || 0) + (r.crits[4] || 0));
    agg[levelId] = agg[levelId] || { levelId, chapter: runs[0].chapter, profiles: {} };
    agg[levelId].profiles[profile] = {
      n: runs.length,
      p20: percentile(scores, 0.2),
      p50: percentile(scores, 0.5),
      p60: percentile(scores, 0.6),
      p75: percentile(scores, 0.75),
      p85: percentile(scores, 0.85),
      p90: percentile(scores, 0.9),
      serves: +mean(runs.map((r) => r.serves)).toFixed(1),
      walkouts: +mean(runs.map((r) => r.walkouts)).toFixed(1),
      crits: +mean(critRuns).toFixed(2),
      critRate: +(mean(critRuns) / Math.max(1, mean(runs.map((r) => r.slides)))).toFixed(3),
      hotServes: +mean(runs.map((r) => r.hotServes)).toFixed(1),
      feverCount: +mean(runs.map((r) => r.feverCount)).toFixed(2),
      overheats: +mean(runs.map((r) => r.overheats)).toFixed(1),
      goalRate: +mean(runs.map((r) => (r.goalDone ? 1 : 0))).toFixed(2),
      starRates: [1, 2, 3].map((s) => +mean(runs.map((r) => (r.stars >= s ? 1 : 0))).toFixed(2))
    };
  }
  return agg;
}

// Gentle FTUE onboarding multiplier for the first 3 tutorial levels (reading time + gesture learning).
const ONBOARDING_RAMP = { '1-1': 0.55, '1-2': 0.72, '1-3': 0.86 };

export function suggestStars(levelAgg) {
  const nov = levelAgg.profiles.novice;
  const sk = levelAgg.profiles.skilled;
  const ex = levelAgg.profiles.expert;
  if (!nov || !sk) return null;
  const ramp = ONBOARDING_RAMP[levelAgg.levelId] || 1.0;
  let s1 = nov.p50 * ramp;
  let s2 = Math.max(sk.p50 * ramp, s1 * 1.3);
  let s3 = Math.max(sk.p85 * ramp, s2 * 1.18);
  if (ex) s3 = Math.min(s3, Math.max(ex.p60 * ramp, s2 * 1.15));
  // keep ratios within design band
  s2 = Math.min(Math.max(s2, s1 * 1.30), s1 * 1.65);
  s3 = Math.min(Math.max(s3, s1 * 1.70), s1 * 2.30);
  return [roundNice(s1), roundNice(s2), roundNice(s3)];
}

function smoothMonotonic(levels, suggestions, chapterCaps) {
  // Enforce T2-F02-04 (strictly increasing 1★ across all 30 levels) and L2-6 (3★ * 2.5 <= chapterCap),
  // while keeping 2★/1★ in [1.30, 1.65] and 3★/1★ in [1.70, 2.30].
  let prev = null;
  let prevChapter = null;
  for (const lvl of levels) {
    const s = suggestions[lvl.id];
    if (!s) continue;
    const ch = lvl.chapter;
    const step = s[0] < 1000 ? 50 : s[0] < 10000 ? 100 : 200;
    if (prev) {
      if (s[0] <= prev[0]) s[0] = roundNice(prev[0] + step);
      if (prevChapter === ch) {
        if (s[1] < prev[1] * 0.92) s[1] = roundNice(prev[1] * 0.92);
        if (s[2] < prev[2] * 0.92) s[2] = roundNice(prev[2] * 0.92);
      }
    }
    // Re-apply design ratio band and chapter anti-cheat cap (s3 * 2.5 <= cap)
    const cap = chapterCaps && chapterCaps[ch] ? Math.floor(chapterCaps[ch] / 2.5 / 100) * 100 : Infinity;
    s[1] = roundNice(Math.min(Math.max(s[1], s[0] * 1.32), s[0] * 1.65));
    s[2] = roundNice(Math.min(Math.max(s[2], s[0] * 1.72, s[1] * 1.15), s[0] * 2.30, cap));
    if (s[2] <= s[1]) s[1] = roundNice(Math.min(s[2] - step, s[0] * 1.45));
    if (s[1] <= s[0]) s[0] = roundNice(Math.max(100, s[1] - step));
    prev = s;
    prevChapter = ch;
  }
  return suggestions;
}

export function checkLevel(levelCfg, levelAgg) {
  const issues = [];
  const nov = levelAgg.profiles.novice;
  const sk = levelAgg.profiles.skilled;
  const ex = levelAgg.profiles.expert;
  const [s1, , s3] = levelCfg.stars;
  const ramp = ONBOARDING_RAMP[levelCfg.id] || 1.0;
  if (nov && s1 < nov.p20 * ramp * 0.85) issues.push(`1★ ${s1} 过低 (< 新手 P20 ${nov.p20} ×${ramp}×0.85)`);
  if (nov && s1 > (sk ? sk.p50 : nov.p90)) issues.push(`1★ ${s1} 过高 (> 熟练 P50 ${sk ? sk.p50 : nov.p90})`);
  if (ex && s3 > ex.p90 * 1.1) issues.push(`3★ ${s3} 不可达 (> 高手 P90 ${ex.p90} ×1.1)`);
  if (!ex && sk && s3 > sk.p90 * 1.6) issues.push(`3★ ${s3} 不可达 (> 熟练 P90 ${sk.p90} ×1.6)`);
  if (levelCfg.goal && levelCfg.goal.type && levelCfg.goal.type !== 'score') {
    if (sk && sk.goalRate < 0.65) issues.push(`L2-8 目标可达率过低 (熟练 ${(sk.goalRate * 100).toFixed(0)}% < 65%)`);
  }
  return issues;
}

function renderMarkdown(agg, levels, suggestions, opts) {
  const lines = [];
  lines.push(`# 数值模拟报告`);
  lines.push('');
  lines.push(`- 生成时间：${new Date().toISOString()}`);
  lines.push(`- 每关每档种子数：${opts.seeds}，Bot 档位：${opts.profiles.join(' / ')}`);
  lines.push('');
  lines.push('| 关卡 | 当前星级 | 建议星级 | 新手 P20/P50/P90 | 熟练 P50/P85 | 高手 P60/P90 | 熟练上菜 | 熟练暴击/局 | 熟练热乎 | 熟练热潮 | 目标达成(新/熟) | 新手1★率 | 熟练3★率 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const lvl of levels) {
    const a = agg[lvl.id];
    if (!a) continue;
    const n = a.profiles.novice || {};
    const s = a.profiles.skilled || {};
    const e = a.profiles.expert || {};
    const sug = suggestions[lvl.id];
    lines.push(
      `| ${lvl.id} | ${lvl.stars.join('/')} | ${sug ? sug.join('/') : '-'} | ${n.p20 ?? '-'}/${n.p50 ?? '-'}/${n.p90 ?? '-'} | ${s.p50 ?? '-'}/${s.p85 ?? '-'} | ${e.p60 ?? '-'}/${e.p90 ?? '-'} | ${s.serves ?? '-'} | ${s.crits ?? '-'} | ${s.hotServes ?? '-'} | ${s.feverCount ?? '-'} | ${n.goalRate ?? '-'}/${s.goalRate ?? '-'} | ${n.starRates ? n.starRates[0] : '-'} | ${s.starRates ? s.starRates[2] : '-'} |`
    );
  }
  return lines.join('\n');
}

function writeStarsToLevels(suggestions) {
  let src = fs.readFileSync(LEVELS_PATH, 'utf8');
  let changed = 0;
  for (const [id, stars] of Object.entries(suggestions)) {
    const re = new RegExp(`(id: '${id}',[\\s\\S]*?stars: )\\[[^\\]]*\\]`);
    if (re.test(src)) {
      src = src.replace(re, `$1[${stars.join(', ')}]`);
      changed++;
    }
  }
  fs.writeFileSync(LEVELS_PATH, src);
  return changed;
}

async function mainThread() {
  const opts = parseArgs(process.argv);
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const Levels = require(LEVELS_PATH);
  const levels = Levels.LEVELS.filter((l) => !opts.levels || opts.levels.includes(l.id));

  const jobs = [];
  for (const lvl of levels) {
    for (const profile of opts.profiles) {
      for (let s = 0; s < opts.seeds; s++) {
        jobs.push({ levelId: lvl.id, chapter: lvl.chapter, profile, seed: 1000 + s * 37 + lvl.chapter * 7 });
      }
    }
  }
  const nWorkers = Math.min(opts.workers, jobs.length);
  const chunks = Array.from({ length: nWorkers }, () => []);
  jobs.forEach((j, i) => chunks[i % nWorkers].push(j));
  const t0 = Date.now();
  if (!opts.quiet) console.log(`[sim] ${jobs.length} runs on ${nWorkers} workers ...`);
  const parts = await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise((resolve, reject) => {
          const w = new Worker(__filename, { workerData: { jobs: chunk } });
          w.once('message', resolve);
          w.once('error', reject);
        })
    )
  );
  const results = parts.flat();
  if (!opts.quiet) console.log(`[sim] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const agg = aggregate(results);
  const suggestions = {};
  for (const lvl of levels) {
    if (agg[lvl.id]) {
      const s = suggestStars(agg[lvl.id]);
      if (s) suggestions[lvl.id] = s;
    }
  }
  const chapterCaps = {};
  for (const ch of Levels.CHAPTERS || []) chapterCaps[ch.chapter] = ch.maxScoreAntiCheatCap;
  smoothMonotonic(levels, suggestions, chapterCaps);

  const md = renderMarkdown(agg, levels, suggestions, opts);
  if (!opts.quiet) console.log(md);
  if (opts.md) fs.writeFileSync(opts.md, md);
  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify({ opts, agg, suggestions, results }, null, 1));

  if (opts.write) {
    const n = writeStarsToLevels(suggestions);
    console.log(`[sim] wrote suggested stars for ${n} levels into levels_data.js`);
  }

  if (opts.check) {
    let failures = 0;
    for (const lvl of levels) {
      if (!agg[lvl.id]) continue;
      const issues = checkLevel(lvl, agg[lvl.id]);
      if (issues.length) {
        failures += issues.length;
        console.log(`[sim-check] ${lvl.id}: ${issues.join('; ')}`);
      }
    }
    const errors = results.filter((r) => r.error);
    if (errors.length) {
      failures += errors.length;
      console.log(`[sim-check] ${errors.length} runs failed to start`);
    }
    console.log(failures ? `[sim-check] FAILED (${failures} issues)` : '[sim-check] PASSED');
    process.exit(failures ? 1 : 0);
  }
}

if (isMainThread) {
  mainThread().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  workerMain().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
