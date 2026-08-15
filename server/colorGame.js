// colorGame.js
// Server-side logic for the Color Game. Same philosophy as game.js: the
// browser never sees the odds or the RNG roll — it only receives the
// final winning color and the payout result.

const COLORS = ["red", "yellow", "blue", "green", "white", "pink"];

// Fair odds for 1-in-6 would be 6x. Paying out at 5x bakes in a house
// edge, same idea as a real color-game table. Adjustable via
// setPayoutMultiplier for the same reason WIN_RATE is adjustable in
// game.js (personal/demo tuning, not something the client can see).
let PAYOUT_MULTIPLIER = 5;

// Per-color weights let you bias the box (all equal = a fair box).
// Weights don't need to sum to anything in particular — they're
// normalized at roll time.
let COLOR_WEIGHTS = COLORS.reduce((acc, c) => {
  acc[c] = 1;
  return acc;
}, {});

function setPayoutMultiplier(mult) {
  const n = Number(mult);
  if (Number.isFinite(n) && n > 0) PAYOUT_MULTIPLIER = n;
}

function getPayoutMultiplier() {
  return PAYOUT_MULTIPLIER;
}

function setWeight(color, weight) {
  if (!COLORS.includes(color)) return;
  const n = Number(weight);
  COLOR_WEIGHTS[color] = Number.isFinite(n) && n >= 0 ? n : COLOR_WEIGHTS[color];
}

function getWeights() {
  return { ...COLOR_WEIGHTS };
}

function pickColor() {
  const total = COLORS.reduce((s, c) => s + COLOR_WEIGHTS[c], 0);
  if (total <= 0) return COLORS[Math.floor(Math.random() * COLORS.length)];
  let r = Math.random() * total;
  for (const c of COLORS) {
    r -= COLOR_WEIGHTS[c];
    if (r <= 0) return c;
  }
  return COLORS[COLORS.length - 1];
}

// bets: { red: 20, blue: 10, ... } — amounts already validated and
// deducted from the player's balance by the caller before this runs.
function resolveRoll(bets) {
  const winningColor = pickColor();
  let totalWin = 0;
  const results = {};

  for (const color of Object.keys(bets)) {
    const amount = bets[color];
    if (color === winningColor) {
      const win = Math.round(amount * PAYOUT_MULTIPLIER);
      results[color] = win;
      totalWin += win;
    } else {
      results[color] = 0;
    }
  }

  return { winningColor, results, totalWin, payoutMultiplier: PAYOUT_MULTIPLIER };
}

module.exports = {
  COLORS,
  resolveRoll,
  setPayoutMultiplier,
  getPayoutMultiplier,
  setWeight,
  getWeights,
};