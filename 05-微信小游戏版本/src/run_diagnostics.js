/**
 * Result-screen post-run diagnostics (v0.11 M2).
 * Pure function taking settlement result + runStats, returning compact highlight pills
 * and a single actionable Chinese tip (100% covered by kissa_round.ttf).
 */
'use strict';

function buildRunDiagnostics(res, stats) {
  const s = stats || {};
  const crits = Array.isArray(s.crits) ? s.crits : [0, 0, 0, 0, 0];
  const maxCrit = crits[4] > 0 ? 4 : crits[3] > 0 ? 3 : crits[2] > 0 ? 2 : 0;
  const totalCrits = (crits[2] || 0) + (crits[3] || 0) + (crits[4] || 0);
  const totalItems = Math.max(0, Number(s.totalItemsServed) || 0);
  const hotItems = Math.max(0, Number(s.hotItems) || 0);
  const hotPct = totalItems > 0 ? Math.round((hotItems / totalItems) * 100) : 0;
  const feverCount = Math.max(0, Number(s.feverCount) || 0);
  const overheats = Math.max(0, Number(s.overheats) || 0);
  const walkouts = Math.max(0, Number(s.angryWalkouts) || 0);

  const critLabel =
    maxCrit >= 4 ? '星光暴击' : maxCrit === 3 ? '三重烘焙' : maxCrit === 2 ? '双重烘焙' : '无暴击';
  const highlights = [
    `暴击 ${totalCrits} (${critLabel})`,
    `热乎率 ${hotPct}%`,
    `热潮 ${feverCount} 次`
  ];

  let tip = '节奏出色，继续冲刺三星！';
  if (res && res.goalUnmet) {
    tip = '关卡目标未完成，先看顶部目标栏！';
  } else if (overheats >= 3) {
    tip = `过热 ${overheats} 次，揉面别太急，稳住金色温区可得保底`;
  } else if (walkouts >= 2) {
    tip = `有 ${walkouts} 位顾客等急生气，红灯急单先出餐`;
  } else if (totalItems >= 4 && hotPct < 35) {
    tip = `${100 - hotPct}% 的猫饼端上时已冷掉，试试合成后马上上菜`;
  } else if (totalCrits === 0 && (Number(s.slides) || 0) >= 8) {
    tip = '多把两对中阶猫饼排在同一方向，一滑可引发烘焙暴击';
  } else if (res && res.starsEarned >= 3) {
    tip = '手速稳、热乎高，完美店长水准！';
  }

  return { highlights, tip, maxCrit, totalCrits, hotPct, feverCount, overheats };
}

module.exports = { buildRunDiagnostics };
