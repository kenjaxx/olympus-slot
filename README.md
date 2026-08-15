# Olympus Slot (play money)

A mythology-themed slot game for personal use — play-money only, no real
transactions. Built to give the "casino feel" without any real money at
stake.

## How it works

- The frontend (`public/`) only handles animation and display.
- All spin outcomes — including how often a spin wins — are decided on the
  server in `server/game.js`. The browser never receives or can inspect the
  win-rate logic.
- Balances are tracked per player name, in memory, on the server.

## Setup

1. Install [Node.js](https://nodejs.org) (v18+).
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open `http://localhost:3000` in your browser.

## Adjusting the win rate

Edit `WIN_RATE` in `server/game.js` (a value from 0 to 1), or use the admin
API:

```
curl -X POST http://localhost:3000/api/admin/winrate \
  -H "Content-Type: application/json" \
  -H "x-admin-key: changeme" \
  -d '{"rate": 0.5}'
```

Set a real `ADMIN_KEY` environment variable before using this anywhere
other than your own machine.

## Notes

- Balances reset if the server restarts (in-memory only). Swap in SQLite or
  a JSON file if you want them to persist — see `server/index.js`.
- This is for personal/private use. If you ever deploy it somewhere
  publicly reachable, add real authentication before sharing the link with
  anyone.
