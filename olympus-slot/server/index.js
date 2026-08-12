const express = require("express");
const path = require("path");
const game = require("./game");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Very simple in-memory "database" — swap for a real DB (SQLite/Postgres)
// if you want balances to survive a server restart.
const players = {
  // "mom": { balance: 1000, freeSpins: 0 },
  // "dad": { balance: 1000, freeSpins: 0 },
};

// The client bet is free-form, so the server still enforces a sane floor
// and rejects garbage input — but there's no upper cap. Bigger bets pay out
// on exactly the same ratio as small ones (see game.js — every payout is a
// straight multiple of `bet`), so nothing about the odds changes with size.
const MIN_BET = 10;

function getPlayer(name) {
  if (!players[name]) {
    players[name] = { balance: 1000, freeSpins: 0 };
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
  const numericBet = Math.round(Number(bet));

  if (!player || !Number.isFinite(numericBet) || !Number.isSafeInteger(numericBet) || numericBet < MIN_BET) {
    return res.status(400).json({ error: `player and a bet of at least ${MIN_BET} are required` });
  }

  const p = getPlayer(player);
  const usingFreeSpin = p.freeSpins > 0;

  if (!usingFreeSpin && p.balance < numericBet) {
    return res.status(400).json({ error: "insufficient balance" });
  }

  if (usingFreeSpin) {
    p.freeSpins -= 1;
  } else {
    p.balance -= numericBet;
  }

  const result = game.resolveSpin(numericBet);

  if (result.freeSpinsAwarded) {
    p.freeSpins += result.freeSpinsAwarded;
  }
  p.balance += result.win;

  res.json({
    ...result,
    balance: p.balance,
    freeSpins: p.freeSpins,
  });
});

// Reset a player's balance back to the starting amount (handy for testing/demoing)
app.post("/api/reset/:player", (req, res) => {
  players[req.params.player] = { balance: 1000, freeSpins: 0 };
  res.json(players[req.params.player]);
});

// ---- Admin-only endpoints ----
// Protect these with a real password/auth before deploying anywhere public.
// For now, a shared secret header is enough for local/personal use.
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