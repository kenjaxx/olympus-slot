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
  const netLineEl = document.getElementById("netLine");

  let cells = [];
  let cellSymbols = [];

  function wrapClassFor(symbolKey) {
    return CardArt.cardFor(symbolKey).className;
  }

  // Animates a number climbing from its current displayed value up to
  // `to` over `duration` ms — the "ticking up" feel real slot UIs use
  // instead of just snapping a number into place.
  function animateCount(el, to, duration, prefix) {
    const from = Number((el.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
    if (from === to) {
      el.textContent = (prefix || "") + to.toLocaleString();
      return;
    }
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const val = Math.round(from + (to - from) * eased);
      el.textContent = (prefix || "") + val.toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
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

  // Reel-drop animation: symbols fall from top to bottom and settle, like
  // a classic cascading slot reel. Each strip is built with the FINAL rows
  // first (top of the strip) followed by a buffer of random filler rows
  // below them. The strip starts shifted up so the viewport is looking at
  // the random buffer, then eases down to translateY(0) — at which point
  // the final rows land exactly in view. Columns are staggered left to
  // right, with a soft tick as each one lands.
  function animateReelDrop(finalValues) {
    return new Promise((resolve) => {
      reelsEl.innerHTML = "";
      const extra = 10;
      const colDelays = [0, 120, 240, 360, 480];
      let maxDelay = 0;
      const dropDistance = extra * (CELL_H + 6);

      for (let c = 0; c < COLS; c++) {
        const viewport = document.createElement("div");
        viewport.style.cssText =
          "overflow:hidden; height:" + (CELL_H * ROWS + (ROWS - 1) * 6) + "px; border-radius:6px;";

        const strip = document.createElement("div");
        strip.style.cssText =
          "display:flex; flex-direction:column; gap:6px; transform: translateY(-" + dropDistance + "px); transition: none;";

        const stripSyms = [];
        for (let r = 0; r < ROWS; r++) stripSyms.push(finalValues[r * COLS + c]);
        for (let i = 0; i < extra; i++) stripSyms.push(CardArt.randomSymbolKey());

        stripSyms.forEach((sym) => {
          const cell = document.createElement("div");
          cell.className = "cell";
          cell.innerHTML = CardArt.cardFor(sym).html;
          strip.appendChild(cell);
        });

        viewport.appendChild(strip);
        reelsEl.appendChild(viewport);

        const duration = 900 + c * 150;
        const stopTime = colDelays[c] + duration;
        maxDelay = Math.max(maxDelay, stopTime);

        setTimeout(() => {
          strip.style.transition = "transform " + duration + "ms cubic-bezier(0.15, 0.85, 0.35, 1)";
          strip.style.transform = "translateY(0px)";
        }, colDelays[c] + 20);

        setTimeout(() => {
          Sound.playReelStopTick(c);
          viewport.classList.add("landed");
          setTimeout(() => viewport.classList.remove("landed"), 220);
        }, stopTime);
      }

      setTimeout(() => {
        buildStaticGrid(finalValues);
        resolve();
      }, maxDelay + 80);
    });
  }

  // Spawns a quick radial burst of gold sparks from the center of a cell —
  // the little "impact" flourish that sells a hit.
  function spawnSparks(cellEl, count) {
    const wrapRect = reelsWrapEl.getBoundingClientRect();
    const cellRect = cellEl.getBoundingClientRect();
    const cx = cellRect.left - wrapRect.left + cellRect.width / 2;
    const cy = cellRect.top - wrapRect.top + cellRect.height / 2;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 22 + Math.random() * 16;
      const spark = document.createElement("span");
      spark.className = "spark";
      spark.style.left = cx + "px";
      spark.style.top = cy + "px";
      spark.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      spark.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      reelsWrapEl.appendChild(spark);
      setTimeout(() => spark.remove(), 550);
    }
  }

  // Expanding ring shockwave from the center of the reels — reserved for
  // big wins, on top of the coin shower and shake.
  function spawnShockwave() {
    const ring = document.createElement("div");
    ring.className = "shockwave";
    reelsWrapEl.appendChild(ring);
    setTimeout(() => ring.remove(), 650);
  }

  // Drops a handful of small gold coins from the top of the reels for a
  // couple hundred ms — the "signature" flourish for a real win.
  function spawnCoinShower(count) {
    const wrapWidth = reelsWrapEl.clientWidth;
    for (let i = 0; i < count; i++) {
      const coin = document.createElement("div");
      coin.className = "coin-particle";
      coin.style.left = Math.random() * (wrapWidth - 14) + "px";
      const duration = 900 + Math.random() * 500;
      const delay = Math.random() * 300;
      coin.style.animationDuration = duration + "ms";
      coin.style.animationDelay = delay + "ms";
      reelsWrapEl.appendChild(coin);
      setTimeout(() => coin.remove(), duration + delay + 50);
    }
  }

  // Flashes a random subset of non-scatter cells to represent a tumble hit,
  // with a bouncy pop + a burst of sparks so it actually feels like an
  // impact instead of a plain color swap. If this round carries a
  // multiplier orb, one flashed cell becomes a wild card.
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
      idxs.forEach((i) => {
        cells[i].classList.add("hit");
        spawnSparks(cells[i], 5);
      });

      if (orbMult > 0 && idxs.size > 0) {
        const orbIdx = [...idxs][Math.floor(Math.random() * idxs.size)];
        cells[orbIdx].innerHTML = CardArt.cardFor("orb").html;
        spawnSparks(cells[orbIdx], 8);
      }

      Sound.playTumbleHit(comboIndex);

      setTimeout(() => {
        idxs.forEach((i) => cells[i].classList.remove("hit"));
        resolve();
      }, 420);
    });
  }

  // `amount` is what's shown in the banner — pass the NET gain (win - bet),
  // not the raw payout, so the banner only celebrates when it should.
  function showWinBanner(amount, isBig) {
    winBannerAmount.textContent = "+0";
    winBannerLabel.textContent = isBig ? "BIG WIN" : "WIN";
    winBanner.classList.remove("show");
    void winBanner.offsetWidth; // restart the entrance animation every time
    winBanner.classList.toggle("big", isBig);
    winBanner.classList.add("show");
    animateCount(winBannerAmount, amount, isBig ? 900 : 550, "+");
    spawnCoinShower(isBig ? 26 : 12);

    if (isBig) {
      reelsWrapEl.classList.remove("shake");
      void reelsWrapEl.offsetWidth;
      reelsWrapEl.classList.add("shake");
      spawnShockwave();
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
        animateCount(lastwinEl, result.win, 500);
        multEl.textContent = result.multiplier + "x";

        if (result.freeSpins > 0) {
          fsBadge.style.display = "block";
          fsCount.textContent = result.freeSpins;
        } else {
          fsBadge.style.display = "none";
        }

        // What actually matters to your wallet: payout minus what you bet.
        // A payout that's smaller than the bet is still a net loss, even
        // though `result.win > 0` — so it must NOT trigger the win banner.
        const net = result.win - bet;
        netLineEl.textContent =
          net === 0 ? "Net: 0" : "Net: " + (net > 0 ? "+" : "") + net.toLocaleString();
        netLineEl.classList.toggle("positive", net > 0);
        netLineEl.classList.toggle("negative", net < 0);

        if (net > 0) {
          const isBig = net >= bet * 10;
          showWinBanner(net, isBig);
          if (!result.scatterTriggered) {
            msgEl.textContent = "Round complete: " + result.win.toLocaleString() + " won at " + result.multiplier + "x (net +" + net.toLocaleString() + ")";
          }
        } else if (result.win > 0) {
          // Paid something back, but less than the bet — a real loss dressed
          // up as a partial return. No banner, no fanfare.
          if (!result.scatterTriggered) {
            msgEl.textContent = "Returned " + result.win.toLocaleString() + " — net " + net.toLocaleString();
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
    reelsWrapEl.classList.add("spinning");
    await animateReelDrop(result.grid);
    reelsWrapEl.classList.remove("spinning");
    await runScatterEffect(result.scatterCount, result.scatterTriggered);
    await playResultSequence(result, bet);
  }

  window.Reels = { buildStaticGrid, runFullSequence };
})();