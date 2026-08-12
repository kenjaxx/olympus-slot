const CARD_META = {
  grape: { letter: "Α", cls: "card-grape" },
  wine:  { letter: "Β", cls: "card-wine" },
  urn:   { letter: "Γ", cls: "card-urn" },
  vase:  { letter: "Δ", cls: "card-vase" },
  gem:   { letter: "Ω", cls: "card-gem" },
  crown: { letter: "Κ", cls: "card-crown" },
};

const ROWS = 4, COLS = 5, CELL_H = 54;

const reelsEl = document.getElementById("reels");
const reelsWrapEl = document.querySelector(".reels-wrap");
const scatterFlashEl = document.getElementById("scatterFlash");
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
const muteBtn = document.getElementById("muteBtn");
const winBanner = document.getElementById("winBanner");
const winBannerLabel = document.getElementById("winBannerLabel");
const winBannerAmount = document.getElementById("winBannerAmount");

let cells = [];       // DOM elements for the current static grid
let cellSymbols = []; // symbol key per cell, parallel to `cells`
let currentPlayer = "guest";
let muted = false;

// ---------------------------------------------------------------------
// Sound engine — synthesized with Web Audio API, no audio files needed.
// AudioContext must be created after a user gesture (browser autoplay
// rules), so it's lazily created on the first spin click.
// ---------------------------------------------------------------------
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone({ freq = 440, duration = 0.15, type = "sine", volume = 0.15, delay = 0, glideTo = null }) {
  if (muted) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  if (glideTo) {
    osc.frequency.linearRampToValueAtTime(glideTo, ctx.currentTime + delay + duration);
  }
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.02);
}

function speak(text) {
  if (muted) return;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel(); // avoid overlapping queued lines
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.15;
  utter.pitch = 1.05;
  utter.volume = 0.85;
  window.speechSynthesis.speak(utter);
}

function playReelStopTick(index) {
  playTone({ freq: 300 + index * 20, duration: 0.08, type: "square", volume: 0.08 });
}

function playTumbleHit(comboIndex) {
  const base = 440 + comboIndex * 60;
  playTone({ freq: base, duration: 0.18, type: "triangle", volume: 0.14, glideTo: base * 1.3 });
}

// Distinct "multiplier landed" cue — a quick rising arpeggio scaled to the
// orb's value, plus a spoken callout like "ten times!".
function playMultiplierHit(orbValue, runningTotal) {
  const steps = Math.min(6, Math.max(2, Math.round(orbValue / 3)));
  for (let s = 0; s < steps; s++) {
    playTone({
      freq: 500 + s * 90 + orbValue * 4,
      duration: 0.12,
      type: "square",
      volume: 0.13,
      delay: s * 0.05,
    });
  }
  setTimeout(() => speak(runningTotal + " times!"), steps * 50 + 80);
}

function playScatterTease() {
  // suspenseful upward sweep — used on the 3-scatter near miss
  playTone({ freq: 220, duration: 0.5, type: "sawtooth", volume: 0.08, glideTo: 340 });
}

function playScatterTrigger() {
  const notes = [523, 659, 784, 1046, 1318];
  notes.forEach((f, i) => playTone({ freq: f, duration: 0.28, type: "sine", volume: 0.16, delay: i * 0.09 }));
}

function playWinChime() {
  [660, 880].forEach((f, i) => playTone({ freq: f, duration: 0.2, type: "sine", volume: 0.15, delay: i * 0.07 }));
}

function playBigWinFanfare() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => playTone({ freq: f, duration: 0.3, type: "sawtooth", volume: 0.12, delay: i * 0.12 }));
}

muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.textContent = muted ? "🔇" : "🔊";
  if (muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
});

// ---------------------------------------------------------------------
// Grid rendering — card tiles instead of emoji
// ---------------------------------------------------------------------

function randSym() {
  const keys = Object.keys(CARD_META);
  return keys[Math.floor(Math.random() * keys.length)];
}

function cardInnerHTML(sym) {
  if (sym === "temple") {
    return (
      '<div class="temple-icon"><div class="roof"></div>' +
      '<div class="pillars"><span></span><span></span><span></span><span></span></div>' +
      '<div class="base"></div></div>'
    );
  }
  if (sym === "orb") {
    return '<div class="orb-icon"></div>';
  }
  const meta = CARD_META[sym];
  return '<span class="card-letter">' + (meta ? meta.letter : "?") + "</span>";
}

function cardClass(sym) {
  if (sym === "temple") return "card-temple";
  if (sym === "orb") return "card-orb";
  return (CARD_META[sym] && CARD_META[sym].cls) || "";
}

function buildStaticGrid(values) {
  reelsEl.innerHTML = "";
  cells = [];
  cellSymbols = values.slice();
  for (let c = 0; c < COLS; c++) {
    const col = document.createElement("div");
    col.style.cssText = "display:flex; flex-direction:column; gap:6px;";
    for (let r = 0; r < ROWS; r++) {
      const idx = r * COLS + c;
      const sym = values[idx];
      const d = document.createElement("div");
      d.className = "cell " + cardClass(sym);
      d.innerHTML = cardInnerHTML(sym);
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
// staggered left to right like a real slot machine. Plays a soft tick as
// each column lands.
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
      cell.className = "cell " + cardClass(sym);
      cell.innerHTML = cardInnerHTML(sym);
      strip.appendChild(cell);
    });

    viewport.appendChild(strip);
    reelsEl.appendChild(viewport);

    const dropDistance = extra * (CELL_H + 6);
    const duration = 900 + c * 150;
    const stopTime = colDelays[c] + duration;
    maxDelay = Math.max(maxDelay, stopTime);

    setTimeout(() => {
      strip.style.transition = "transform " + duration + "ms cubic-bezier(0.15, 0.85, 0.35, 1)";
      strip.style.transform = "translateY(-" + dropDistance + "px)";
    }, colDelays[c] + 20);

    setTimeout(() => playReelStopTick(c), stopTime);
  }

  setTimeout(() => {
    buildStaticGrid(finalValues);
    onDone();
  }, maxDelay + 80);
}

// Flashes a random subset of NON-scatter cells to represent a tumble hit.
// If this round carries a multiplier orb, one flashed cell becomes an orb card.
function flashHitCells(count, comboIndex, orbMult, onDone) {
  const eligible = cellSymbols
    .map((sym, i) => ({ sym, i }))
    .filter((c) => c.sym !== "temple")
    .map((c) => c.i);

  const idxs = new Set();
  while (idxs.size < Math.min(count, eligible.length)) {
    idxs.add(eligible[Math.floor(Math.random() * eligible.length)]);
  }
  idxs.forEach((i) => cells[i].classList.add("hit"));

  if (orbMult > 0 && idxs.size > 0) {
    const orbIdx = [...idxs][Math.floor(Math.random() * idxs.size)];
    cells[orbIdx].className = "cell hit card-orb";
    cells[orbIdx].innerHTML = cardInnerHTML("orb");
  }

  playTumbleHit(comboIndex);

  setTimeout(() => {
    idxs.forEach((i) => cells[i].classList.remove("hit"));
    onDone();
  }, 420);
}

function showWinBanner(amount, isBig) {
  winBannerAmount.textContent = amount.toLocaleString();
  winBannerLabel.textContent = isBig ? "BIG WIN" : "WIN";
  winBanner.classList.toggle("big", isBig);
  winBanner.classList.add("show");

  if (isBig) {
    reelsWrapEl.classList.remove("shake");
    void reelsWrapEl.offsetWidth; // restart animation
    reelsWrapEl.classList.add("shake");
    playBigWinFanfare();
  } else {
    playWinChime();
  }

  setTimeout(() => winBanner.classList.remove("show"), 1400);
}

// Near-miss tease (3 scatters) or full trigger (4+ scatters) effect,
// played right after the reels land and before the tumble sequence.
function runScatterEffect(scatterCount, triggered, onDone) {
  const templeIdxs = cellSymbols
    .map((sym, i) => (sym === "temple" ? i : -1))
    .filter((i) => i >= 0);

  if (scatterCount === 3) {
    templeIdxs.forEach((i) => cells[i].classList.add("tease"));
    playScatterTease();
    msgEl.textContent = "So close! 3 temples landed";
    setTimeout(() => {
      templeIdxs.forEach((i) => cells[i].classList.remove("tease"));
      onDone();
    }, 900);
    return;
  }

  if (triggered) {
    templeIdxs.forEach((i) => cells[i].classList.add("ignite"));
    scatterFlashEl.classList.remove("flash");
    void scatterFlashEl.offsetWidth;
    scatterFlashEl.classList.add("flash");
    reelsWrapEl.classList.remove("shake");
    void reelsWrapEl.offsetWidth;
    reelsWrapEl.classList.add("shake");
    playScatterTrigger();
    setTimeout(() => speak("Free spins!"), 200);
    msgEl.textContent = scatterCount + " temples landed! Free spins triggered";
    setTimeout(() => {
      templeIdxs.forEach((i) => cells[i].classList.remove("ignite"));
      onDone();
    }, 1100);
    return;
  }

  onDone();
}

// Plays through each tumble round sequentially for visual/audio feedback,
// then shows the final win banner if there was a payout.
function playResultSequence(result) {
  let i = 0;
  function nextRound() {
    if (i < result.rounds.length) {
      const round = result.rounds[i];
      flashHitCells(round.clusterSize, i, round.orbMult, () => {
        if (round.orbMult > 0) {
          const runningTotal = 1 + result.rounds.slice(0, i + 1).reduce((s, r) => s + r.orbMult, 0);
          playMultiplierHit(round.orbMult, runningTotal);
        }
        i++;
        nextRound();
      });
    } else {
      finish();
    }
  }

  function finish() {
    balanceEl.textContent = result.balance.toLocaleString();
    lastwinEl.textContent = result.win.toLocaleString();
    multEl.textContent = result.multiplier + "x";

    if (result.freeSpins > 0) {
      fsBadge.style.display = "block";
      fsCount.textContent = result.freeSpins;
    } else {
      fsBadge.style.display = "none";
    }

    const bet = parseInt(betEl.value, 10);
    if (result.win > 0) {
      const isBig = result.win >= bet * 10;
      showWinBanner(result.win, isBig);
      if (!result.scatterTriggered) {
        msgEl.textContent = "Round complete: " + result.win.toLocaleString() + " won at " + result.multiplier + "x";
      }
    } else if (!result.scatterTriggered && result.scatterCount !== 3) {
      msgEl.textContent = "No win this round";
    }

    spinBtn.disabled = false;
  }

  nextRound();
}

async function spin() {
  const bet = parseInt(betEl.value, 10);
  spinBtn.disabled = true;
  msgEl.textContent = "Spinning...";
  winBanner.classList.remove("show");

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
    runScatterEffect(result.scatterCount, result.scatterTriggered, () => {
      playResultSequence(result);
    });
  });
}

spinBtn.addEventListener("click", spin);