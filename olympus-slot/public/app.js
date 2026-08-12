const EMOJI = {
  grape: "🍇",
  wine: "🍷",
  urn: "⚱️",
  vase: "🏺",
  gem: "💎",
  crown: "👑",
  temple: "🏛️",
  orb: "⚡",
};

const ROWS = 4, COLS = 5, CELL_H = 54;

const reelsEl = document.getElementById("reels");
const betEl = document.getElementById("bet");
const betOut = document.getElementById("betout");
const balanceEl = document.getElementById("balance");
const lastwinEl = document.getElementById("lastwin");
const multEl = document.getElementById("mult");
const msgEl = document.getElementById("msg");
const spinBtn = document.getElementById("spinbtn");
const fsBadge = document.getElementById("freespinsbadge");
const fsCount = document.getElementById("fscount");
const playerNameEl = document.getElementById("playerName");
const loadPlayerBtn = document.getElementById("loadPlayer");

let cells = [];
let currentPlayer = "guest";

function randSym() {
  const keys = ["grape", "wine", "urn", "vase", "gem", "crown"];
  return keys[Math.floor(Math.random() * keys.length)];
}

function buildStaticGrid(values) {
  reelsEl.innerHTML = "";
  cells = [];
  for (let c = 0; c < COLS; c++) {
    const col = document.createElement("div");
    col.style.cssText = "display:flex; flex-direction:column; gap:6px;";
    for (let r = 0; r < ROWS; r++) {
      const idx = r * COLS + c;
      const d = document.createElement("div");
      d.className = "cell";
      d.textContent = EMOJI[values[idx]] || "?";
      col.appendChild(d);
      cells[idx] = d;
    }
    reelsEl.appendChild(col);
  }
}

buildStaticGrid(Array.from({ length: ROWS * COLS }, randSym));

betEl.addEventListener("input", () => (betOut.textContent = betEl.value));

async function loadPlayer(name) {
  currentPlayer = name || "guest";
  const res = await fetch(`/api/state/${encodeURIComponent(currentPlayer)}`);
  const data = await res.json();
  balanceEl.textContent = data.balance.toLocaleString();
  if (data.freeSpins > 0) {
    fsBadge.style.display = "block";
    fsCount.textContent = data.freeSpins;
  } else {
    fsBadge.style.display = "none";
  }
}

loadPlayerBtn.addEventListener("click", () => loadPlayer(playerNameEl.value.trim()));
loadPlayer(playerNameEl.value.trim());

// Smooth reel-drop animation: each column slides down and eases to a stop,
// staggered left to right like a real slot machine.
function animateReelDrop(finalValues, onDone) {
  reelsEl.innerHTML = "";
  const extra = 10;
  const colDelays = [0, 120, 240, 360, 480];
  let maxDelay = 0;

  for (let c = 0; c < COLS; c++) {
    const viewport = document.createElement("div");
    viewport.style.cssText =
      "overflow:hidden; height:" + (CELL_H * ROWS + (ROWS - 1) * 6) + "px; border-radius:6px;";

    const strip = document.createElement("div");
    strip.style.cssText = "display:flex; flex-direction:column; gap:6px; transform: translateY(0px); transition: none;";

    const stripSyms = [];
    for (let i = 0; i < extra; i++) stripSyms.push(randSym());
    for (let r = 0; r < ROWS; r++) stripSyms.push(finalValues[r * COLS + c]);

    stripSyms.forEach((sym) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = EMOJI[sym] || "?";
      strip.appendChild(cell);
    });

    viewport.appendChild(strip);
    reelsEl.appendChild(viewport);

    const dropDistance = extra * (CELL_H + 6);
    const duration = 900 + c * 150;
    maxDelay = Math.max(maxDelay, colDelays[c] + duration);

    setTimeout(() => {
      strip.style.transition = "transform " + duration + "ms cubic-bezier(0.15, 0.85, 0.35, 1)";
      strip.style.transform = "translateY(-" + dropDistance + "px)";
    }, colDelays[c] + 20);
  }

  setTimeout(() => {
    buildStaticGrid(finalValues);
    onDone();
  }, maxDelay + 80);
}

async function spin() {
  const bet = parseInt(betEl.value, 10);
  spinBtn.disabled = true;
  msgEl.textContent = "Spinning...";

  let result;
  try {
    const res = await fetch("/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: currentPlayer, bet }),
    });
    if (!res.ok) {
      const err = await res.json();
      msgEl.textContent = err.error || "Something went wrong";
      spinBtn.disabled = false;
      return;
    }
    result = await res.json();
  } catch (e) {
    msgEl.textContent = "Could not reach server";
    spinBtn.disabled = false;
    return;
  }

  animateReelDrop(result.grid, () => {
    balanceEl.textContent = result.balance.toLocaleString();
    lastwinEl.textContent = result.win.toLocaleString();
    multEl.textContent = result.multiplier + "x";

    if (result.freeSpins > 0) {
      fsBadge.style.display = "block";
      fsCount.textContent = result.freeSpins;
    } else {
      fsBadge.style.display = "none";
    }

    if (result.scatterTriggered) {
      msgEl.textContent = "4 temples landed! Free spins triggered";
    } else if (result.win > 0) {
      msgEl.textContent = "Round complete: " + result.win.toLocaleString() + " won at " + result.multiplier + "x";
    } else {
      msgEl.textContent = "No win this round";
    }

    spinBtn.disabled = false;
  });
}

spinBtn.addEventListener("click", spin);
