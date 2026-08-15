// reels.js
// Everything about drawing and animating the 4x5 grid, plus the win banner.
// Turbo mode has been removed — every spin always plays the full-quality
// cascade/tumble/suspense animation at normal speed.
//
// PERF NOTES (read before changing this file):
//   - buildStaticGrid/animateReelDrop build columns in a DocumentFragment
//     and append it ONCE, instead of calling reelsEl.appendChild() in a
//     loop — each individual appendChild into a live, visible container
//     can force a layout pass, so batching this is the single biggest
//     win here (20 cells + up to ~120 filler cells per spin, previously
//     inserted one at a time).
//   - The reel-drop filler count ("extra") was cut from 10 to 6 rows —
//     40% fewer throwaway DOM nodes created and destroyed every spin.
//   - Decorative-only effects (sparks, coin shower) are skipped while the
//     tab is hidden (document.hidden) — no visible cost to skipping them
//     when nobody can see them, but it avoids burning CPU in a
//     backgrounded tab during autospin.

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

  const DEFAULT_MAX_MULTIPLIER = 16;

  let cells = [];
  let cellSymbols = [];

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // True while the tab/window isn't visible — used to skip purely
  // decorative particle work that nobody can see anyway.
  function isHidden() {
    return typeof document !== "undefined" && document.hidden;
  }

  function animateCount(el, to, duration, prefix) {
    const from = Number((el.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
    if (from === to) {
      el.textContent = (prefix || "") + to.toLocaleString();
      return;
    }
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (to - from) * eased);
      el.textContent = (prefix || "") + val.toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Builds the static (non-animated) grid using a single DocumentFragment
  // so all 20 cells hit the live DOM in one append, not 20 separate ones.
  function buildStaticGrid(values) {
    reelsEl.innerHTML = "";
    cells = [];
    cellSymbols = values.slice();

    const frag = document.createDocumentFragment();
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
      frag.appendChild(col);
    }
    reelsEl.appendChild(frag);
  }

  // Full cascading reel-drop animation. Each column strip gets a quick
  // overshoot-and-settle bounce right as it lands. Columns are built
  // fully off-DOM (in a fragment) before being attached, and the filler
  // row count is trimmed to keep per-spin DOM churn down.
  function animateReelDrop(finalValues) {
    return new Promise((resolve) => {
      reelsEl.innerHTML = "";
      const extra = 6; // was 10 — fewer throwaway filler cells per column
      const colDelays = [0, 120, 240, 360, 480];
      let maxDelay = 0;
      const dropDistance = extra * (CELL_H + 6);

      const frag = document.createDocumentFragment();
      const viewports = [];
      const strips = [];

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

        const stripFrag = document.createDocumentFragment();
        stripSyms.forEach((sym) => {
          const cell = document.createElement("div");
          cell.className = "cell";
          cell.innerHTML = CardArt.cardFor(sym).html;
          stripFrag.appendChild(cell);
        });
        strip.appendChild(stripFrag);

        viewport.appendChild(strip);
        frag.appendChild(viewport);
        viewports.push(viewport);
        strips.push(strip);
      }

      reelsEl.appendChild(frag);

      for (let c = 0; c < COLS; c++) {
        const strip = strips[c];
        const viewport = viewports[c];
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

          strip.style.transition = "none";
          void strip.offsetWidth;
          strip.classList.add("reel-strip-settle");
        }, stopTime);
      }

      setTimeout(() => {
        buildStaticGrid(finalValues);
        resolve();
      }, maxDelay + 80);
    });
  }

  function spawnSparks(cellEl, count, color) {
    if (isHidden()) return;
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
      if (color) spark.style.setProperty("--spark-color", color);
      reelsWrapEl.appendChild(spark);
      setTimeout(() => spark.remove(), 550);
    }
  }

  // Colored ring that snaps onto a hit tile and expands outward, matched
  // to that symbol's tier accent color.
  function spawnHitRing(cellEl, color) {
    if (isHidden()) return;
    const ring = document.createElement("div");
    ring.className = "hit-ring";
    ring.style.setProperty("--ring-color", color || "var(--gold-bright)");
    cellEl.appendChild(ring);
    setTimeout(() => ring.remove(), 520);
  }

  // Quick light streak across a hit tile.
  function spawnHitGlint(cellEl) {
    if (isHidden()) return;
    const glint = document.createElement("div");
    glint.className = "hit-glint";
    cellEl.appendChild(glint);
    setTimeout(() => glint.remove(), 520);
  }

  // Looks up a symbol's tier accent color from CardArt's metadata, with
  // a gold fallback for scatter/wild/unknown keys.
  function accentForSymbol(sym) {
    const meta = CardArt.SYMBOL_META[sym];
    return meta ? meta.accent : "#f3d980";
  }

  function spawnShockwave() {
    if (isHidden()) return;
    const ring = document.createElement("div");
    ring.className = "shockwave";
    reelsWrapEl.appendChild(ring);
    setTimeout(() => ring.remove(), 650);
  }

  function spawnCoinShower(count) {
    if (isHidden()) return;
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

  // Flies a "+Ngain x" label from a reel cell to the multiplier stat box,
  // then pops/glows the multiplier value on arrival showing the new
  // cumulative total. Falls back to a plain pop if there's no origin cell.
  function animateMultiplierHit(newValue, orbCellIdx, gain) {
    return new Promise((resolve) => {
      const originEl = orbCellIdx >= 0 && cells[orbCellIdx] ? cells[orbCellIdx] : null;

      function pop() {
        multEl.textContent = newValue + "x";
        multEl.classList.remove("mult-pop");
        void multEl.offsetWidth; // restart animation
        multEl.classList.add("mult-pop");
        resolve();
      }

      if (!originEl || isHidden()) {
        pop();
        return;
      }

      const orect = originEl.getBoundingClientRect();
      const trect = multEl.getBoundingClientRect();
      const fly = document.createElement("div");
      fly.className = "mult-fly";
      fly.textContent = "+" + (gain || 1) + "x";
      fly.style.left = orect.left + orect.width / 2 + "px";
      fly.style.top = orect.top + orect.height / 2 + "px";
      document.body.appendChild(fly);

      requestAnimationFrame(() => {
        const dx = (trect.left + trect.width / 2) - (orect.left + orect.width / 2);
        const dy = (trect.top + trect.height / 2) - (orect.top + orect.height / 2);
        fly.style.transform = "translate(" + dx + "px, " + dy + "px) scale(0.4)";
        fly.style.opacity = "0";
      });

      setTimeout(() => {
        fly.remove();
        pop();
      }, 420);
    });
  }

  // ---- Cascade: pop the hit tiles, then drop fresh ones into their place ----
  // Purely visual — dramatizes the tumble round the server already computed,
  // never changes odds or adds extra wins.
  async function popAndRefill(idxs) {
    try {
      idxs.forEach((i) => cells[i].classList.add("pop"));
      Sound.playPopBurst(idxs.length);

      await wait(260);

      idxs.forEach((i) => {
        const newSym = CardArt.randomSymbolKey();
        cellSymbols[i] = newSym;
        const el = cells[i];
        el.className = "cell"; // reset to neutral — clears the frozen "pop" state
        el.innerHTML = CardArt.cardFor(newSym).html;
        void el.offsetWidth; // force reflow so the drop-in animation actually restarts
        el.classList.add("drop-in");
      });

      await wait(380);

      idxs.forEach((i) => cells[i] && cells[i].classList.remove("drop-in"));
    } catch (err) {
      console.error("popAndRefill error:", err);
      idxs.forEach((i) => {
        if (!cells[i]) return;
        cells[i].className = "cell";
        cells[i].innerHTML = CardArt.cardFor(cellSymbols[i] || CardArt.randomSymbolKey()).html;
      });
    }
  }

  // Flashes a random subset of NON-scatter cells to represent a tumble hit.
  // Each hit tile gets a color-matched ring burst + glint + sparks, matched
  // to that symbol's tier — higher-tier hits visually pop more. If this
  // round is a combo "tile break" that earns +1x (comboGain > 0), one
  // flashed cell becomes an orb card — returns that cell's index (or -1)
  // so the caller can animate the multiplier flying from that exact tile.
  async function flashHitCells(count, comboIndex, comboGain) {
    let orbCellIdx = -1;
    try {
      const eligible = cellSymbols
        .map((sym, i) => ({ sym, i }))
        .filter((c) => c.sym !== "temple")
        .map((c) => c.i);

      const idxs = new Set();
      while (idxs.size < Math.min(count, eligible.length)) {
        idxs.add(eligible[Math.floor(Math.random() * eligible.length)]);
      }
      const idxList = [...idxs];

      idxList.forEach((i) => {
        const color = accentForSymbol(cellSymbols[i]);
        cells[i].classList.add("hit");
        spawnSparks(cells[i], 4, color);
        spawnHitRing(cells[i], color);
        spawnHitGlint(cells[i]);
      });

      if (comboGain > 0 && idxList.length > 0) {
        const orbIdx = idxList[Math.floor(Math.random() * idxList.length)];
        cells[orbIdx].innerHTML = CardArt.cardFor("orb").html;
        spawnSparks(cells[orbIdx], 6, "#ffd166");
        spawnHitRing(cells[orbIdx], "#ffd166");
        orbCellIdx = orbIdx;
      }

      Sound.playTumbleHit(comboIndex);

      await wait(420);

      idxList.forEach((i) => cells[i].classList.remove("hit"));
      await popAndRefill(idxList);
    } catch (err) {
      console.error("flashHitCells error:", err);
    }
    return orbCellIdx;
  }

  function showWinBanner(amount, isBig) {
    winBannerAmount.textContent = "+0";
    winBannerLabel.textContent = isBig ? "BIG WIN" : "WIN";
    winBanner.classList.remove("show");
    void winBanner.offsetWidth;
    winBanner.classList.toggle("big", isBig);
    winBanner.classList.add("show");
    animateCount(winBannerAmount, amount, isBig ? 1100 : 550, "+");
    spawnCoinShower(isBig ? 22 : 8); // was 34/12 — fewer particles, same effect

    if (isBig) {
      reelsWrapEl.classList.remove("shake");
      void reelsWrapEl.offsetWidth;
      reelsWrapEl.classList.add("shake");
      spawnShockwave();
      setTimeout(spawnShockwave, 180);
      Sound.playBigWinFanfare();
    } else {
      Sound.playWinChime();
    }

    setTimeout(() => winBanner.classList.remove("show"), isBig ? 1900 : 1400);
  }

  // Dims the reels, adds a pulsing vignette + rising drumroll — a beat of
  // suspense right before a real win reveals itself.
  async function buildSuspense(duration) {
    try {
      reelsWrapEl.classList.add("suspense");
      Sound.playSuspenseBuildup(duration);
      await wait(duration);
    } finally {
      reelsWrapEl.classList.add("fading-out");
      await wait(220);
      reelsWrapEl.classList.remove("suspense", "fading-out");
    }
  }

  // Big full-screen "you won free spins!" moment: ringing bell, coin
  // shower, and a Continue button. Auto-advances so autospin never gets
  // stuck waiting on a click.
  function showFreeSpinTriggerOverlay(freeSpinsAwarded) {
    return new Promise((resolve) => {
      const overlay = document.getElementById("fsTriggerOverlay");
      const countEl = document.getElementById("fsAwardCount");
      const continueBtn = document.getElementById("fsTriggerContinue");
      if (!overlay || !continueBtn) {
        resolve();
        return;
      }

      const count = freeSpinsAwarded || 10;
      if (countEl) countEl.textContent = count;

      overlay.classList.remove("closing");
      overlay.classList.add("show");
      Sound.playBellRing(count);
      spawnCoinShower(18); // was 28

      let done = false;
      function close() {
        if (done) return;
        done = true;
        continueBtn.removeEventListener("click", close);
        overlay.classList.add("closing");
        setTimeout(() => {
          overlay.classList.remove("show", "closing");
          resolve();
        }, 200);
      }
      continueBtn.addEventListener("click", close);
      setTimeout(close, 4500);
    });
  }

  async function runScatterEffect(scatterCount, triggered, freeSpinsAwarded) {
    try {
      const scatterIdxs = cellSymbols
        .map((sym, i) => (sym === "temple" ? i : -1))
        .filter((i) => i >= 0);
      const scatterCards = scatterIdxs.map((i) => cells[i].querySelector(".pcard-scatter"));

      if (scatterCount === 3) {
        scatterCards.forEach((el) => el && el.classList.add("tease"));
        Sound.playScatterTease();
        msgEl.textContent = "So close! 3 scatters landed";
        await wait(900);
        scatterCards.forEach((el) => el && el.classList.remove("tease"));
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
        await wait(900);
        scatterCards.forEach((el) => el && el.classList.remove("ignite"));

        await showFreeSpinTriggerOverlay(freeSpinsAwarded);
        return;
      }
    } catch (err) {
      console.error("runScatterEffect error:", err);
    }
  }

  async function playResultSequence(result, bet) {
    const maxMult = result.maxMultiplier || DEFAULT_MAX_MULTIPLIER;
    try {
      let runningMult = 1;
      for (let i = 0; i < result.rounds.length; i++) {
        const round = result.rounds[i];
        const orbCellIdx = await flashHitCells(round.clusterSize, i, round.comboGain);
        if (round.comboGain > 0) {
          runningMult += round.comboGain;
          Sound.playMultiplierHit(round.comboGain, runningMult);
          await animateMultiplierHit(runningMult, orbCellIdx, round.comboGain);
        }
      }
    } catch (err) {
      console.error("playResultSequence tumble error:", err);
    }

    balanceEl.textContent = result.balance.toLocaleString();
    animateCount(lastwinEl, result.win, 500);
    multEl.textContent = result.multiplier + "x"; // reconcile with the server's final figure
    multEl.classList.toggle("maxed", result.multiplier >= maxMult);

    if (result.freeSpins > 0) {
      fsBadge.style.display = "block";
      fsCount.textContent = result.freeSpins;
    } else {
      fsBadge.style.display = "none";
    }

    const net = result.win - bet;
    netLineEl.textContent =
      net === 0 ? "Net: 0" : "Net: " + (net > 0 ? "+" : "") + net.toLocaleString();
    netLineEl.classList.toggle("positive", net > 0);
    netLineEl.classList.toggle("negative", net < 0);

    if (net > 0) {
      const isBig = net >= bet * 10;
      const suspenseDuration = isBig ? 1100 : 450;
      try {
        await buildSuspense(suspenseDuration);
      } catch (err) {
        console.error("suspense error:", err);
      }
      showWinBanner(net, isBig);
      if (!result.scatterTriggered) {
        msgEl.textContent =
          "Round complete: " + result.win.toLocaleString() + " won at " + result.multiplier + "x (net +" + net.toLocaleString() + ")";
      }
    } else if (result.win > 0) {
      if (!result.scatterTriggered) {
        msgEl.textContent = "Returned " + result.win.toLocaleString() + " — net " + net.toLocaleString();
      }
    } else if (!result.scatterTriggered && result.scatterCount !== 3) {
      msgEl.textContent = "No win this round";
    }
  }

  // Big count-up screen shown once a free-spins bonus round finishes,
  // totaling every win across the whole round like a real scatter slot.
  function showFreeSpinTotal(amount) {
    return new Promise((resolve) => {
      const overlay = document.getElementById("freeSpinTotalOverlay");
      const amountEl = document.getElementById("fsTotalAmount");
      const continueBtn = document.getElementById("fsTotalContinue");
      if (!overlay || !amountEl || !continueBtn) {
        resolve();
        return;
      }

      amountEl.textContent = "0";
      overlay.classList.remove("closing");
      overlay.classList.add("show");
      Sound.playFreeSpinTotalFanfare();

      setTimeout(() => animateCount(amountEl, amount, 2200), 500);

      let done = false;
      function close() {
        if (done) return;
        done = true;
        continueBtn.removeEventListener("click", close);
        overlay.classList.add("closing");
        setTimeout(() => {
          overlay.classList.remove("show", "closing");
          resolve();
        }, 200);
      }
      continueBtn.addEventListener("click", close);
      setTimeout(close, 4200);
    });
  }

  // Orchestrates a full spin's visuals: drop -> scatter effect -> tumbles -> banner.
  async function runFullSequence(result, bet) {
    try {
      reelsWrapEl.classList.add("spinning");
      await animateReelDrop(result.grid);
      reelsWrapEl.classList.remove("spinning");
      await runScatterEffect(result.scatterCount, result.scatterTriggered, result.freeSpinsAwarded);
      await playResultSequence(result, bet);
    } catch (err) {
      console.error("runFullSequence error:", err);
      buildStaticGrid(result.grid);
      balanceEl.textContent = result.balance.toLocaleString();
      lastwinEl.textContent = result.win.toLocaleString();
      multEl.textContent = result.multiplier + "x";
    } finally {
      reelsWrapEl.classList.remove("spinning");
    }
  }

  window.Reels = { buildStaticGrid, runFullSequence, showFreeSpinTotal };
})();