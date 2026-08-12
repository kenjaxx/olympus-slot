// reels.js
// Everything about drawing and animating the 4x5 grid, plus the win banner.

(function () {
  const ROWS = 4, COLS = 5, CELL_H = 54;

  const reelsEl = document.getElementById("reels");
  const reelsWrapEl = document.querySelector(".reels-wrap");
  const scatterFlashEl = document.getElementById("scatterFlash");
  const msgEl = document.getElementById("msg");
  const balanceEl = document.getElementById("balance");
  const lastwinEl = document.getElementById("lastwin");
  const multEl = document.getElementById("mult");
  const fsBadge = document.getElementById("freespinsbadge");
  const fsCount = document.getElementById("fscount");
  const winBanner = document.getElementById("winBanner");
  const winBannerLabel = document.getElementById("winBannerLabel");
  const winBannerAmount = document.getElementById("winBannerAmount");

  let cells = [];
  let cellSymbols = [];

  function wrapClassFor(symbolKey) {
    return CardArt.cardFor(symbolKey).className;
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
        const { html } = CardArt.cardFor(sym);
        const d = document.createElement("div");
        d.className = "cell";
        d.innerHTML = html;
        col.appendChild(d);
        cells[idx] = d;
      }
      reelsEl.appendChild(col);
    }
  }

  // Smooth reel-drop animation: each column slides down and eases to a
  // stop, staggered left to right, with a soft tick as each lands.
  function animateReelDrop(finalValues) {
    return new Promise((resolve) => {
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
        for (let i = 0; i < extra; i++) stripSyms.push(CardArt.randomSymbolKey());
        for (let r = 0; r < ROWS; r++) stripSyms.push(finalValues[r * COLS + c]);

        stripSyms.forEach((sym) => {
          const cell = document.createElement("div");
          cell.className = "cell";
          cell.innerHTML = CardArt.cardFor(sym).html;
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

        setTimeout(() => Sound.playReelStopTick(c), stopTime);
      }

      setTimeout(() => {
        buildStaticGrid(finalValues);
        resolve();
      }, maxDelay + 80);
    });
  }

  // Flashes a random subset of non-scatter cells to represent a tumble hit.
  // If this round carries a multiplier orb, one flashed cell becomes a wild card.
  function flashHitCells(count, comboIndex, orbMult) {
    return new Promise((resolve) => {
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
        cells[orbIdx].innerHTML = CardArt.cardFor("orb").html;
      }

      Sound.playTumbleHit(comboIndex);

      setTimeout(() => {
        idxs.forEach((i) => cells[i].classList.remove("hit"));
        resolve();
      }, 420);
    });
  }

  function showWinBanner(amount, isBig) {
    winBannerAmount.textContent = amount.toLocaleString();
    winBannerLabel.textContent = isBig ? "BIG WIN" : "WIN";
    winBanner.classList.toggle("big", isBig);
    winBanner.classList.add("show");

    if (isBig) {
      reelsWrapEl.classList.remove("shake");
      void reelsWrapEl.offsetWidth;
      reelsWrapEl.classList.add("shake");
      Sound.playBigWinFanfare();
    } else {
      Sound.playWinChime();
    }

    setTimeout(() => winBanner.classList.remove("show"), 1400);
  }

  // Near-miss tease (3 scatters) or full trigger (4+ scatters), played
  // right after the reels land and before the tumble sequence.
  function runScatterEffect(scatterCount, triggered) {
    return new Promise((resolve) => {
      const scatterIdxs = cellSymbols
        .map((sym, i) => (sym === "temple" ? i : -1))
        .filter((i) => i >= 0);
      const scatterCards = scatterIdxs.map((i) => cells[i].querySelector(".pcard-scatter"));

      if (scatterCount === 3) {
        scatterCards.forEach((el) => el && el.classList.add("tease"));
        Sound.playScatterTease();
        msgEl.textContent = "So close! 3 scatters landed";
        setTimeout(() => {
          scatterCards.forEach((el) => el && el.classList.remove("tease"));
          resolve();
        }, 900);
        return;
      }

      if (triggered) {
        scatterCards.forEach((el) => el && el.classList.add("ignite"));
        scatterFlashEl.classList.remove("flash");
        void scatterFlashEl.offsetWidth;
        scatterFlashEl.classList.add("flash");
        reelsWrapEl.classList.remove("shake");
        void reelsWrapEl.offsetWidth;
        reelsWrapEl.classList.add("shake");
        Sound.playScatterTrigger();
        msgEl.textContent = scatterCount + " scatters landed! Free spins triggered";
        setTimeout(() => {
          scatterCards.forEach((el) => el && el.classList.remove("ignite"));
          resolve();
        }, 1100);
        return;
      }

      resolve();
    });
  }

  // Plays through each tumble round sequentially, then shows the final
  // win banner if there was a payout. Resolves once everything is done.
  function playResultSequence(result, bet) {
    return new Promise((resolve) => {
      let i = 0;

      function nextRound() {
        if (i < result.rounds.length) {
          const round = result.rounds[i];
          flashHitCells(round.clusterSize, i, round.orbMult).then(() => {
            if (round.orbMult > 0) {
              const runningTotal = 1 + result.rounds.slice(0, i + 1).reduce((s, r) => s + r.orbMult, 0);
              Sound.playMultiplierHit(round.orbMult, runningTotal);
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

        if (result.win > 0) {
          const isBig = result.win >= bet * 10;
          showWinBanner(result.win, isBig);
          if (!result.scatterTriggered) {
            msgEl.textContent = "Round complete: " + result.win.toLocaleString() + " won at " + result.multiplier + "x";
          }
        } else if (!result.scatterTriggered && result.scatterCount !== 3) {
          msgEl.textContent = "No win this round";
        }

        resolve();
      }

      nextRound();
    });
  }

  // Orchestrates a full spin's visuals: drop -> scatter effect -> tumbles -> banner.
  async function runFullSequence(result, bet) {
    await animateReelDrop(result.grid);
    await runScatterEffect(result.scatterCount, result.scatterTriggered);
    await playResultSequence(result, bet);
  }

  window.Reels = { buildStaticGrid, runFullSequence };
})();
