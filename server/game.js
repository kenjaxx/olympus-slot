// game.js
// All the "manipulation" logic lives here, on the server.
// The browser never sees WIN_RATE or the RNG — it only receives the final result.

const SYMS = ["grape", "wine", "urn", "vase", "gem", "crown"];
const SCATTER = "temple";
const ROWS = 4;
const COLS = 5;

// ---- THE CONTROL KNOB ----
// 0.0 = never win, 1.0 = always win.
//
// WIN_RATE now auto-adjusts after every spin instead of staying fixed:
//   - A spin that pays out ZERO (a "cold" spin) bumps WIN_RATE up by
//     RATE_STEP (2%), so a losing streak gradually gets "hotter" and a
//     win becomes more likely the longer it's been since the last one.
//   - The moment a spin actually pays out (win > 0), WIN_RATE snaps back
//     down to RESET_WIN_RATE (20%).
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
const RESET_WIN_RATE = 0.2;
const RATE_STEP = 0.02;

let WIN_RATE = START_WIN_RATE;

function setWinRate(rate) {
  WIN_RATE = Math.max(0, Math.min(1, rate));
}

function getWinRate() {
  return WIN_RATE;
}

function randSym() {
  return SYMS[Math.floor(Math.random() * SYMS.length)];
}

function randomGrid() {
  return Array.from({ length: ROWS * COLS }, randSym);
}

// Resolves one full spin, including any chained tumbles, server-side.
//
// `carryMultiplier` is the multiplier trail accumulated so far during a
// free-spin bonus round (0 for ordinary paid spins). Any orb multipliers
// won this spin are ADDED on top of that carry-in and returned as
// `carryMultiplier` in the result, so the caller can persist it forward
// to the next free spin — mirroring how real scatter-slot bonus rounds
// build up one big multiplier across the whole round instead of
// resetting it every spin.
function resolveSpin(bet, carryMultiplier) {
  carryMultiplier = Number.isFinite(carryMultiplier) ? carryMultiplier : 0;

  let totalWin = 0;
  let spinOrbTotal = 0;
  const rounds = [];

  // ---- Scatter count for this spin ----
  let scatterCount;
  const scatterRoll = Math.random();
  if (scatterRoll < WIN_RATE * 0.12) {
    scatterCount = Math.random() < 0.5 ? 4 : 5; // triggers free spins
  } else if (scatterRoll < WIN_RATE * 0.12 + 0.18) {
    scatterCount = 3; // near miss
  } else if (scatterRoll < WIN_RATE * 0.12 + 0.18 + 0.25) {
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
    let orbMult = 0;
    if (Math.random() < 0.4) {
      const orbCount = 1 + Math.floor(Math.random() * 2);
      const vals = [2, 3, 5, 10, 25];
      for (let k = 0; k < orbCount; k++) {
        orbMult += vals[Math.floor(Math.random() * vals.length)];
      }
    }

    const clusterWin = bet * (clusterSize / 8) * 0.8;
    totalWin += clusterWin;
    if (orbMult > 0) spinOrbTotal += orbMult;

    rounds.push({ clusterSize, orbMult });
    roundNum++;
  }

  const newCarryMultiplier = carryMultiplier + spinOrbTotal;
  const totalMult = 1 + newCarryMultiplier;
  const finalWin = Math.round(totalWin * totalMult);

  // ---- Auto-adjust WIN_RATE for the NEXT spin, based on this one ----
  if (finalWin > 0) {
    WIN_RATE = RESET_WIN_RATE;
  } else {
    WIN_RATE = Math.min(1, WIN_RATE + RATE_STEP);
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
  };
}

module.exports = {
  resolveSpin,
  setWinRate,
  getWinRate,
  SYMS,
  SCATTER,
  ROWS,
  COLS,
};