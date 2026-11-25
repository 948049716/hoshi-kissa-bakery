/**
 * Deterministic seeded RNG utilities (mulberry32 + labelled stream forking).
 *
 * - createRng(seed)          -> () => float in [0, 1)
 * - forkRng(seed, label)     -> independent stream derived from (seed, label)
 * - createLevelRngs(seed)    -> { grid, customer, event, misc } streams for one run
 * - dailySeed(dateKey)       -> stable 32-bit seed for a 'YYYY-MM-DD' (UTC+8) key
 * - dateKeyUtc8(ms)          -> 'YYYY-MM-DD' in China Standard Time
 *
 * All gameplay modules already accept an injectable `rng`; passing these streams makes
 * a whole run reproducible (daily challenge fairness, balance simulation, replays).
 */
'use strict';

function hash32(str) {
  // FNV-1a 32-bit + final avalanche
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return (Math.floor(Math.abs(seed)) >>> 0) || 0x9e3779b9;
  }
  if (typeof seed === 'string' && seed.length > 0) {
    return hash32(seed) || 0x9e3779b9;
  }
  return 0x9e3779b9;
}

function createRng(seed) {
  let a = normalizeSeed(seed);
  return function mulberry32() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function forkRng(seed, label) {
  return createRng(hash32(`${normalizeSeed(seed)}:${String(label)}`));
}

function createLevelRngs(seed) {
  if (seed === undefined || seed === null) {
    return { seed: null, grid: Math.random, customer: Math.random, event: Math.random, misc: Math.random };
  }
  const s = normalizeSeed(seed);
  return {
    seed: s,
    grid: forkRng(s, 'grid'),
    customer: forkRng(s, 'customer'),
    event: forkRng(s, 'event'),
    misc: forkRng(s, 'misc')
  };
}

function dateKeyUtc8(ms) {
  const t = typeof ms === 'number' && Number.isFinite(ms) ? ms : Date.now();
  const d = new Date(t + 8 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dailySeed(dateKey) {
  return hash32(`hoshi-daily-${dateKey || dateKeyUtc8()}`);
}

/** Picks an item from [[value, weight], ...] with the given rng. */
function pickWeighted(table, rng) {
  const r = typeof rng === 'function' ? rng : Math.random;
  let total = 0;
  for (let i = 0; i < table.length; i++) total += Math.max(0, Number(table[i][1]) || 0);
  if (!(total > 0)) return table.length > 0 ? table[0][0] : undefined;
  let roll = r() * total;
  for (let i = 0; i < table.length; i++) {
    roll -= Math.max(0, Number(table[i][1]) || 0);
    if (roll < 0) return table[i][0];
  }
  return table[table.length - 1][0];
}

/** Fisher-Yates shuffle copy. */
function shuffled(arr, rng) {
  const r = typeof rng === 'function' ? rng : Math.random;
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

module.exports = {
  hash32,
  createRng,
  forkRng,
  createLevelRngs,
  dateKeyUtc8,
  dailySeed,
  pickWeighted,
  shuffled
};
