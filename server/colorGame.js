// colorGame.js
// Server-side logic for the Color Game — genuinely uses all 3 dice.
//
// Mechanic: three dice are rolled, each independently landing on one of
// six colors. For every color the player bet on, count how many of the
// 3 dice show that color:
//   0 matches -> the stake on that color is lost entirely
//   1 match   -> pays 1:1  (stake returned + 1x stake profit)
//   2 matches -> pays 1:2  (stake returned + 2x stake profit)
//   3 matches -> pays 1:3  (stake returned + 3x stake profit)
//
// PAYOUT_PER_MATCH is the "1" in "1:1" and is tunable the same way the
// other odds knobs in this project are — never sent to the browser
// until after a roll's dice are already decided.

const COLORS = ["red", "yellow", "blue", "green", "white", "pink"];

// Profit multiplier per matching die. Total credited back for a color
// with `matches` hits = amount * (1 + matches * PAYOUT_PER_MATCH).
let PAYOUT_PER_MATCH = 1;

// Per-color weights let you bias the dice (all equal = fair dice).
// Weights don't need to sum to anything in particular — they're
// normalized at roll time, and applied independently to each of the 3
// dice (so biasing "red" makes it more likely on EVERY die, not just
// an overall single roll).
let COLOR_WEIGHTS = COLORS.reduce((acc, c) => {
  acc[c] = 1;
  return acc;
}, {});

function setPayoutPerMatch(mult) {
  const n = Number(mult);
  if (Number.isFinite(n) && n > 0) PAYOUT_PER_MATCH = n;
}

function getPayoutPerMatch() {
  return PAYOUT_PER_MATCH;
}

function setWeight(color, weight) {
  if (!COLORS.includes(color)) return;
  const n = Number(weight);
  COLOR_WEIGHTS[color] = Number.isFinite(n) && n >= 0 ? n : COLOR_WEIGHTS[color];
}

function getWeights() {
  return { ...COLOR_WEIGHTS };
}

function rollOneDie() {
  const total = COLORS.reduce((s, c) => s + COLOR_WEIGHTS[c], 0);
  if (total <= 0) return COLORS[Math.floor(Math.random() * COLORS.length)];
  let r = Math.random() * total;
  for (const c of COLORS) {
    r -= COLOR_WEIGHTS[c];
    if (r <= 0) return c;
  }
  return COLORS[COLORS.length - 1];
}

function rollDice() {
  return [rollOneDie(), rollOneDie(), rollOneDie()];
}

// bets: { red: 20, blue: 10, ... } — amounts already validated and
// deducted from the player's balance by the caller before this runs.
function resolveRoll(bets) {
  const dice = rollDice();
  let totalWin = 0;
  const results = {}; // color -> total credited back (0 if no match)
  const matches = {}; // color -> how many of the 3 dice matched it

  for (const color of Object.keys(bets)) {
    const amount = bets[color];
    const hitCount = dice.filter((d) => d === color).length;
    matches[color] = hitCount;

    if (hitCount > 0) {
      const win = Math.round(amount * (1 + hitCount * PAYOUT_PER_MATCH));
      results[color] = win;
      totalWin += win;
    } else {
      results[color] = 0;
    }
  }

  return { dice, results, matches, totalWin, payoutPerMatch: PAYOUT_PER_MATCH };
}

module.exports = {
  COLORS,
  resolveRoll,
  setPayoutPerMatch,
  getPayoutPerMatch,
  setWeight,
  getWeights,
};