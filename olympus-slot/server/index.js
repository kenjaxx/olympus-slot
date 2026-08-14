const express = require("express");
const path = require("path");
const game = require("./game");

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