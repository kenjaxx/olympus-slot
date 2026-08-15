// main.js
// Ties the other modules together: loads player state, wires the Spin
// and mute buttons, starts background music on first interaction, and
// runs spins.
//
// spinOnce() plays one requested spin — but if that spin triggers (or is
// already inside) a free-spins bonus round, it automatically keeps
// playing every remaining free spin on its own, using the bet locked in
// by the server at trigger time, with the bet controls disabled for the
// whole round. This mirrors how real scatter-slot bonus rounds auto-play
// to completion instead of requiring a click per spin.

(function () {
  const betEl = document.getElementById("bet");
  const balanceEl = document.getElementById("balance");
  const fsBadge = document.getElementById("freespinsbadge");
  const fsCount = document.getElementById("fscount");
  const msgEl = document.getElementById("msg");
  const spinBtn = document.getElementById("spinbtn");
  const autospinBtn = document.getElementById("autospinBtn");
  const loadAmountEl = document.getElementById("loadAmount");
  const topupBtn = document.getElementById("topupBtn");
  const winBanner = document.getElementById("winBanner");
  const netLineEl = document.getElementById("netLine");
  const muteBtn = document.getElementById("muteBtn");

  const currentPlayer = "guest";

  // Tracks an in-progress free-spins bonus round so we can total up every
  // win across it and show one big payoff screen at the end.
  let freeSpinSession = null;

  function initAudioOnce() {
    Sound.startBackgroundMusic();
    document.removeEventListener("pointerdown", initAudioOnce);
  }
  document.addEventListener("pointerdown", initAudioOnce, { once: true });

   muteBtn.addEventListener("click", () => {
    const next = !Sound.isMuted();
    Sound.setMuted(next);
    muteBtn.textContent = next ? "🔕" : "🎵";
    muteBtn.setAttribute("aria-pressed", String(next));
  });

  async function loadPlayer() {
    try {
      const res = await fetch(`/api/state/${encodeURIComponent(currentPlayer)}`);
      const data = await res.json();
      balanceEl.textContent = data.balance.toLocaleString();
      if (data.freeSpins > 0) {
        fsBadge.style.display = "block";
        fsCount.textContent = data.freeSpins;
      } else {
        fsBadge.style.display = "none";
      }
    } catch (err) {
      console.error("loadPlayer error:", err);
      msgEl.textContent = "Could not load player";
    }
  }

  topupBtn.addEventListener("click", async () => {
    const amount = Math.round(Number(loadAmountEl.value));
    if (!Number.isFinite(amount) || amount <= 0) {
      msgEl.textContent = "Enter a positive amount to add";
      return;
    }
    try {
      const res = await fetch(`/api/topup/${encodeURIComponent(currentPlayer)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        msgEl.textContent = err.error || "Could not add funds";
        return;
      }
      const data = await res.json();
      balanceEl.textContent = data.balance.toLocaleString();
      msgEl.textContent = `Added ${amount.toLocaleString()} to your balance`;
    } catch (err) {
      console.error("topup error:", err);
      msgEl.textContent = "Could not reach server";
    }
  });

  // Locks bet controls + the autospin Start button while a bonus round is
  // auto-playing, so nothing can interfere with it mid-round.
  function lockForBonus(locked) {
    BetControls.setDisabled(locked);
    if (autospinBtn) autospinBtn.disabled = locked;
  }

  // Runs exactly one spin request against the server + its animation.
  // Returns the parsed result object, or null if the request failed
  // (message already shown to the player).
  async function performOneSpin() {
    const bet = BetControls.getBet();
    winBanner.classList.remove("show");
    netLineEl.textContent = "";
    netLineEl.classList.remove("positive", "negative");

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
        return null;
      }
      result = await res.json();
    } catch (e) {
      console.error("spin request error:", e);
      msgEl.textContent = "Could not reach server";
      return null;
    }

    try {
      if (result.freeSpinsAwarded && !freeSpinSession) {
        freeSpinSession = { totalWin: 0 };
        lockForBonus(true);
      }
      if (freeSpinSession) {
        freeSpinSession.totalWin += result.win;
      }

      // Use the bet the server actually charged (result.betUsed) rather
      // than the slider's current value — during free spins these can
      // differ, since the slider is ignored server-side.
      await Reels.runFullSequence(result, result.betUsed);

      if (freeSpinSession && result.freeSpins === 0) {
        const total = freeSpinSession.totalWin;
        freeSpinSession = null;
        lockForBonus(false);
        await Reels.showFreeSpinTotal(total);
      }
    } catch (err) {
      console.error("spin animation error:", err);
      if (freeSpinSession) {
        freeSpinSession = null;
        lockForBonus(false);
      }
    }

    return result;
  }

  // Public entry point used by the Spin button and AutoSpin. Plays the
  // requested spin, then — if it triggered or continued a free-spins
  // bonus — automatically keeps spinning at the locked bet until the
  // whole bonus round is finished before returning.
  async function spinOnce() {
    spinBtn.disabled = true;
    msgEl.textContent = "Spinning...";

    let result = await performOneSpin();
    if (!result) {
      spinBtn.disabled = false;
      return { ok: false, insufficientFunds: true };
    }

    while (result.freeSpins > 0) {
      await new Promise((resolve) => setTimeout(resolve, 550));
      result = await performOneSpin();
      if (!result) break;
    }

    spinBtn.disabled = false;
    return { ok: true, insufficientFunds: false };
  }

  spinBtn.addEventListener("click", () => {
    if (AutoSpin.isRunning()) return;
    spinOnce();
  });

  AutoSpin.init(spinOnce);

  // ---- Boot ----
  Reels.buildStaticGrid(Array.from({ length: 20 }, CardArt.randomSymbolKey));
  loadPlayer();
})();