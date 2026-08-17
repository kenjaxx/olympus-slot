const express = require("express");
const path = require("path");
const game = require("./game");
const colorGame = require("./colorGame");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Very simple in-memory "database" — swap for a real DB (SQLite/Postgres)
// if you want balances to survive a server restart.
const players = {};

const MIN_BET = 10;

function getPlayer(name) {
  if (!players[name]) {
    players[name] = {
      balance: 1000,
      freeSpins: 0,
      freeSpinBet: 0,        // bet locked in when the bonus was triggered
      freeSpinMultiplier: 0, // multiplier trail accumulated across the bonus round
    };
  }
  return players[name];
}

// ---- Player-facing endpoints ----

app.get("/api/state/:player", (req, res) => {
  const p = getPlayer(req.params.player);
  res.json(p);
});

app.post("/api/spin", (req, res) => {
  const { player, bet } = req.body;
  if (!player) {
    return res.status(400).json({ error: "player is required" });
  }

  const p = getPlayer(player);
  const usingFreeSpin = p.freeSpins > 0;

  let numericBet;
  if (usingFreeSpin) {
    // Free spins ALWAYS use the bet that triggered the bonus round — the
    // slider/quick-buttons have no effect here, exactly like a real
    // scatter-slot bonus round.
    numericBet = p.freeSpinBet || MIN_BET;
  } else {
    numericBet = Math.round(Number(bet));
    if (!Number.isFinite(numericBet) || !Number.isSafeInteger(numericBet) || numericBet < MIN_BET) {
      return res.status(400).json({ error: `player and a bet of at least ${MIN_BET} are required` });
    }
    if (p.balance < numericBet) {
      return res.status(400).json({ error: "insufficient balance" });
    }
  }

  if (usingFreeSpin) {
    p.freeSpins -= 1;
  } else {
    p.balance -= numericBet;
  }

  // Carry the accumulated bonus-round multiplier into this spin (0 for
  // ordinary paid spins, since the trail only exists during free spins).
  const carryIn = usingFreeSpin ? p.freeSpinMultiplier || 0 : 0;
  const result = game.resolveSpin(numericBet, carryIn);

  if (result.freeSpinsAwarded) {
    if (!usingFreeSpin) {
      // A fresh bonus round just started on a paid spin — lock in the
      // bet for every free spin that follows, and start the multiplier
      // trail at zero.
      p.freeSpinBet = numericBet;
      p.freeSpinMultiplier = 0;
    }
    // If this happens WHILE already in free spins, it's a retrigger —
    // more spins are added and the multiplier trail keeps building.
    p.freeSpins += result.freeSpinsAwarded;
  }

  if (usingFreeSpin) {
    p.freeSpinMultiplier = result.carryMultiplier;
  }

  p.balance += result.win;

  if (p.freeSpins === 0) {
    // Bonus round fully finished — clear the trail and the locked bet
    // so the next trigger starts fresh.
    p.freeSpinMultiplier = 0;
    p.freeSpinBet = 0;
  }

  res.json({
    ...result,
    balance: p.balance,
    freeSpins: p.freeSpins,
    usingFreeSpin,
    betUsed: numericBet,
  });
});

// Reset a player's balance back to the starting amount (handy for testing/demoing)
app.post("/api/reset/:player", (req, res) => {
  players[req.params.player] = {
    balance: 1000,
    freeSpins: 0,
    freeSpinBet: 0,
    freeSpinMultiplier: 0,
  };
  res.json(players[req.params.player]);
});

// ---- Color Game endpoint ----
// Body: { player, bets: { red: 20, blue: 10, ... } }
// Any subset of the 6 colors can carry a bet in the same round. Three
// dice are rolled server-side; every bet color is paid according to how
// many of the 3 dice matched it (see colorGame.js for the payout table).
// A color with zero matches loses its entire stake (already deducted).
app.post("/api/color/roll", (req, res) => {
  const { player, bets } = req.body;
  if (!player) {
    return res.status(400).json({ error: "player is required" });
  }
  if (!bets || typeof bets !== "object" || Array.isArray(bets)) {
    return res.status(400).json({ error: "bets object is required" });
  }

  const p = getPlayer(player);

  // Validate + total the bets server-side. Unknown colors are rejected
  // outright; non-positive amounts are just skipped.
  let total = 0;
  const cleanBets = {};
  for (const [color, amountRaw] of Object.entries(bets)) {
    if (!colorGame.COLORS.includes(color)) {
      return res.status(400).json({ error: `unknown color: ${color}` });
    }
    const amount = Math.round(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    cleanBets[color] = amount;
    total += amount;
  }

  if (Object.keys(cleanBets).length === 0) {
    return res.status(400).json({ error: "place at least one bet" });
  }
  if (total < MIN_BET) {
    return res.status(400).json({ error: `total bet must be at least ${MIN_BET}` });
  }
  if (p.balance < total) {
    return res.status(400).json({ error: "insufficient balance" });
  }

  p.balance -= total;
  const result = colorGame.resolveRoll(cleanBets);
  p.balance += result.totalWin;

  res.json({
    ...result, // dice, results, matches, totalWin, payoutPerMatch
    bets: cleanBets,
    totalBet: total,
    balance: p.balance,
  });
});

// ---- Admin-only endpoints ----
const ADMIN_KEY = process.env.ADMIN_KEY || "changeme";

app.get("/api/admin/winrate", (req, res) => {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.sendStatus(403);
  res.json({ winRate: game.getWinRate() });
});

app.post("/api/admin/winrate", (req, res) => {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.sendStatus(403);
  const { rate } = req.body;
  game.setWinRate(rate);
  res.json({ winRate: game.getWinRate() });
});

app.get("/api/admin/color-odds", (req, res) => {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.sendStatus(403);
  res.json({ weights: colorGame.getWeights(), payoutPerMatch: colorGame.getPayoutPerMatch() });
});

app.post("/api/admin/color-odds", (req, res) => {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.sendStatus(403);
  const { color, weight, payoutPerMatch } = req.body;
  if (color) colorGame.setWeight(color, weight);
  if (payoutPerMatch !== undefined) colorGame.setPayoutPerMatch(payoutPerMatch);
  res.json({ weights: colorGame.getWeights(), payoutPerMatch: colorGame.getPayoutPerMatch() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Olympus slot running at http://localhost:${PORT}`);
});

// Adds a player-chosen amount to a player's balance (the "Add funds" UI control).
app.post("/api/topup/:player", (req, res) => {
  const p = getPlayer(req.params.player);
  const amount = Math.round(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  p.balance += amount;
  res.json(p);
});