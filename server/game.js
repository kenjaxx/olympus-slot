// game.js
// All the "manipulation" logic lives here, on the server.
// The browser never sees WIN_RATE, SCATTER_RATE, or the RNG — it only
// receives the final result.

const SYMS = ["grape", "wine", "urn", "vase", "gem", "crown"];
const SCATTER = "temple";
const ROWS = 4;
const COLS = 5;

// ---- THE CONTROL KNOB (regular wins) ----
// 0.0 = never win, 1.0 = always win.
//
// WIN_RATE auto-adjusts after every spin instead of staying fixed:
//   - A spin that pays out ZERO (a "cold" spin) bumps WIN_RATE up by
//     RATE_STEP (2%), so a losing streak gradually gets "hotter" and a
//     win becomes more likely the longer it's been since the last one.
//   - The moment a spin actually pays out (win > 0), WIN_RATE snaps back
//     down to RESET_WIN_RATE (30%).
// It starts at START_WIN_RATE and stays clamped to [0, 1] throughout.
//
// The admin endpoints (/api/admin/winrate) can still set WIN_RATE by
// hand at any time — the next spin's win/loss will simply keep
// adjusting it from whatever value was set.
//
// NOTE: WIN_RATE is a single module-level value shared by every player
// on the server (this was already true before) — it is not tracked
// per-player.
const START_WIN_RATE = 0.01;
const RESET_WIN_RATE = 0.3; // was 0.2 (20%) — now 30%
const RATE_STEP = 0.02;

// ---- SCATTER CONTROL KNOB ----
// Separate from WIN_RATE. Governs the chance that a spin lands a
// scatter TRIGGER (4+ scatters -> free spins).
//   - Starts (and resets, after any trigger) at SCATTER_START_RATE (10%).
//   - Every "dead" spin — one that does NOT trigger free spins — bumps
//     SCATTER_RATE up by SCATTER_STEP (10%), clamped to 100%.
//   - The moment a scatter trigger actually lands, SCATTER_RATE snaps
//     back down to SCATTER_START_RATE (10%).
const SCATTER_START_RATE = 0.1; // starting scatter-trigger chance = 10%
const SCATTER_STEP = 0.02;       // +10% per dead (non-triggering) spin

// ---- COMBO MULTIPLIER ----
// The multiplier is a combo counter: every tumble round that breaks a
// winning cluster ("tile break") adds +COMBO_STEP to the running
// multiplier, up to a hard cap of MAX_MULTIPLIER. The trail carries
// across an entire free-spins bonus round (via carryMultiplier), the
// same way it did before, but the total can never exceed the cap no
// matter how many breaks happen across the whole round.
const MAX_MULTIPLIER = 50; // was 16
const COMBO_STEP = 1;

let WIN_RATE = START_WIN_RATE;
let SCATTER_RATE = SCATTER_START_RATE;

function setWinRate(rate) {
  WIN_RATE = Math.max(0, Math.min(1, rate));
}

function getWinRate() {
  return WIN_RATE;
}

function setScatterRate(rate) {
  SCATTER_RATE = Math.max(0, Math.min(1, rate));
}

function getScatterRate() {
  return SCATTER_RATE;
}

function randSym() {
  return SYMS[Math.floor(Math.random() * SYMS.length)];
}

function randomGrid() {
  return Array.from({ length: ROWS * COLS }, randSym);
}

// Resolves one full spin, including any chained tumbles, server-side.
//
// `carryMultiplier` is the combo trail accumulated so far during a
// free-spin bonus round (0 for ordinary paid spins). Every winning
// tumble round in THIS spin adds +COMBO_STEP on top of that carry-in,
// clamped so the total multiplier (1 + carry + gained) never exceeds
// MAX_MULTIPLIER. The updated trail is returned as `carryMultiplier` so
// the caller can persist it forward to the next free spin.
function resolveSpin(bet, carryMultiplier) {
  carryMultiplier = Number.isFinite(carryMultiplier) ? carryMultiplier : 0;
  // Defensive clamp in case something upstream (admin endpoint, resumed
  // session, etc.) ever hands back an out-of-range value.
  carryMultiplier = Math.max(0, Math.min(carryMultiplier, MAX_MULTIPLIER - 1));

  let totalWin = 0;
  let comboGained = 0; // combo steps actually gained THIS spin (post-cap)
  const rounds = [];

  // ---- Scatter count for this spin ----
  // scatterRoll < SCATTER_RATE -> a full trigger (4 or 5 scatters).
  // The remaining probability mass is split (in order) between a
  // near-miss (3), a 2-scatter, and a 0/1-scatter outcome, same as before.
  let scatterCount;
  const scatterRoll = Math.random();
  if (scatterRoll < SCATTER_RATE) {
    scatterCount = Math.random() < 0.5 ? 4 : 5; // triggers free spins
  } else if (scatterRoll < SCATTER_RATE + 0.18) {
    scatterCount = 3; // near miss
  } else if (scatterRoll < SCATTER_RATE + 0.18 + 0.25) {
    scatterCount = 2;
  } else {
    scatterCount = Math.random() < 0.5 ? 1 : 0;
  }
  const scatterTriggered = scatterCount >= 4;
  const freeSpinsAwarded = scatterTriggered ? 10 : 0;

  // ---- Tumble/cluster rounds ----
  let roundNum = 0;
  while (roundNum < 3) {
    const willWin = Math.random() < WIN_RATE;
    if (!willWin) break;

    const clusterSize = 8 + Math.floor(Math.random() * 4);
    const clusterWin = bet * (clusterSize / 8) * 0.8;
    totalWin += clusterWin;

    // Combo multiplier: this tile break earns +COMBO_STEP, but only if
    // the running total hasn't already hit the cap.
    const totalSoFar = 1 + carryMultiplier + comboGained;
    const comboGain = totalSoFar < MAX_MULTIPLIER ? COMBO_STEP : 0;
    comboGained += comboGain;

    rounds.push({ clusterSize, comboGain });
    roundNum++;
  }

  const newCarryMultiplier = Math.min(carryMultiplier + comboGained, MAX_MULTIPLIER - 1);
  const totalMult = Math.min(1 + newCarryMultiplier, MAX_MULTIPLIER);
  const finalWin = Math.round(totalWin * totalMult);

  // ---- Auto-adjust WIN_RATE for the NEXT spin, based on this one ----
  if (finalWin > 0) {
    WIN_RATE = RESET_WIN_RATE;
  } else {
    WIN_RATE = Math.min(1, WIN_RATE + RATE_STEP);
  }

  // ---- Auto-adjust SCATTER_RATE for the NEXT spin ----
  if (scatterTriggered) {
    SCATTER_RATE = SCATTER_START_RATE;
  } else {
    SCATTER_RATE = Math.min(1, SCATTER_RATE + SCATTER_STEP);
  }

  const grid = randomGrid();
  const scatterIdxs = new Set();
  while (scatterIdxs.size < scatterCount) {
    scatterIdxs.add(Math.floor(Math.random() * ROWS * COLS));
  }
  scatterIdxs.forEach((i) => (grid[i] = SCATTER));

  return {
    grid,
    scatterCount,
    scatterTriggered,
    freeSpinsAwarded,
    rounds,
    multiplier: totalMult,
    carryMultiplier: newCarryMultiplier,
    win: finalWin,
    maxMultiplier: MAX_MULTIPLIER,
  };
}

module.exports = {
  resolveSpin,
  setWinRate,
  getWinRate,
  setScatterRate,
  getScatterRate,
  SYMS,
  SCATTER,
  ROWS,
  COLS,
  MAX_MULTIPLIER,
};