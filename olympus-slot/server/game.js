// game.js
// All the "manipulation" logic lives here, on the server.
// The browser never sees WIN_RATE or the RNG — it only receives the final result.

const SYMS = ["grape", "wine", "urn", "vase", "gem", "crown"];
const SCATTER = "temple";
const ROWS = 4;
const COLS = 5;

// ---- THE CONTROL KNOB ----
// 0.0 = never win, 1.0 = always win. Change this to tune how often the house pays out.
// In a real deployment, load this from an admin-only config file or database
// instead of hardcoding it, so you can adjust it without redeploying.
let WIN_RATE = 0.50;

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
// Returns everything the client needs to animate + display the result,
// but none of the probability logic that produced it.
function resolveSpin(bet) {
  let totalWin = 0;
  let totalMult = 1;
  const rounds = [];

  // ---- Scatter count for this spin ----
  // This drives both the free-spin trigger AND the near-miss tension effect
  // on the client (3 scatters = "so close", 4+ = trigger).
  let scatterCount;
  const scatterRoll = Math.random();
  if (scatterRoll < WIN_RATE * 0.12) {
    scatterCount = Math.random() < 0.5 ? 4 : 5; // triggers free spins
  } else if (scatterRoll < WIN_RATE * 0.12 + 0.18) {
    scatterCount = 3; // near miss — builds anticipation without paying out
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
    if (orbMult > 0) totalMult += orbMult;

    rounds.push({ clusterSize, orbMult });
    roundNum++;
  }

  const finalWin = Math.round(totalWin * totalMult);

  // Build the visual grid and place the scatter symbols in it so what the
  // player sees actually matches scatterCount.
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