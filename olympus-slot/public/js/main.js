// main.js
// Ties the other modules together: loads player state, wires the Spin
// button, and provides the single spinOnce() routine that both the manual
// Spin button and AutoSpin call.

(function () {
  const betEl = document.getElementById("bet");
  const balanceEl = document.getElementById("balance");
  const fsBadge = document.getElementById("freespinsbadge");
  const fsCount = document.getElementById("fscount");
  const msgEl = document.getElementById("msg");
  const spinBtn = document.getElementById("spinbtn");
  const playerNameEl = document.getElementById("playerName");
  const loadPlayerBtn = document.getElementById("loadPlayer");
  const resetBtn = document.getElementById("resetBtn");
  const loadAmountEl = document.getElementById("loadAmount");
  const topupBtn = document.getElementById("topupBtn");
  const muteBtn = document.getElementById("muteBtn");
  const winBanner = document.getElementById("winBanner");
  const netLineEl = document.getElementById("netLine");

  let currentPlayer = "guest";

  // Tracks an in-progress free-spins bonus round so we can total up every
  // win across it and show one big payoff screen at the end. Null when
  // we're not currently inside a bonus round.
  let freeSpinSession = null;

  muteBtn.addEventListener("click", () => {
    Sound.setMuted(!Sound.isMuted());
    muteBtn.textContent = Sound.isMuted() ? "🔇" : "🔊";
  });

  async function loadPlayer(name) {
    currentPlayer = name || "guest";
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

  loadPlayerBtn.addEventListener("click", () => loadPlayer(playerNameEl.value.trim()));

  resetBtn.addEventListener("click", async () => {
    if (AutoSpin.isRunning()) return;
    const ok = confirm(`Reset ${currentPlayer}'s balance back to 1,000?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/reset/${encodeURIComponent(currentPlayer)}`, { method: "POST" });
      const data = await res.json();
      balanceEl.textContent = data.balance.toLocaleString();
      fsBadge.style.display = data.freeSpins > 0 ? "block" : "none";
      fsCount.textContent = data.freeSpins;
      msgEl.textContent = `${currentPlayer}'s balance reset to ${data.balance.toLocaleString()}`;
    } catch (err) {
      console.error("reset error:", err);
      msgEl.textContent = "Could not reset balance";
    }
  });

  // Adds a player-chosen amount to the current player's balance.
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
      msgEl.textContent = `Added ${amount.toLocaleString()} to ${currentPlayer}'s balance`;
    } catch (err) {
      console.error("topup error:", err);
      msgEl.textContent = "Could not reach server";
    }
  });

  // Runs exactly one spin end-to-end: request -> animate -> update state.
  // Returns { ok, insufficientFunds } so AutoSpin knows whether to continue.
  // Wrapped in try/catch/finally so the spin button and autospin can never
  // get stuck disabled, no matter what goes wrong mid-animation.
  async function spinOnce() {
    const bet = BetControls.getBet();
    spinBtn.disabled = true;
    msgEl.textContent = "Spinning...";
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
        return { ok: false, insufficientFunds: true };
      }
      result = await res.json();
    } catch (e) {
      console.error("spin request error:", e);
      msgEl.textContent = "Could not reach server";
      return { ok: false, insufficientFunds: false };
    } finally {
      // Only re-enable here if we're bailing out before the animation step.
      if (!result) spinBtn.disabled = false;
    }

    try {
      // Open (or continue) a free-spins bonus session and fold this spin's
      // win into the running total.
      if (result.scatterTriggered && !freeSpinSession) {
        freeSpinSession = { totalWin: 0 };
      }
      if (freeSpinSession) {
        freeSpinSession.totalWin += result.win;
      }

      await Reels.runFullSequence(result, bet);

      // Bonus round just ran out of free spins — show the big totalizer.
      if (freeSpinSession && result.freeSpins === 0) {
        const total = freeSpinSession.totalWin;
        freeSpinSession = null;
        await Reels.showFreeSpinTotal(total);
      }
    } catch (err) {
      console.error("spinOnce animation error:", err);
    } finally {
      spinBtn.disabled = false;
    }

    return { ok: true, insufficientFunds: false };
  }

  spinBtn.addEventListener("click", () => {
    if (AutoSpin.isRunning()) return; // manual spin disabled mid-autospin
    spinOnce();
  });

  AutoSpin.init(spinOnce);

  // ---- Boot ----
  Reels.buildStaticGrid(Array.from({ length: 20 }, CardArt.randomSymbolKey));
  loadPlayer(playerNameEl.value.trim());
})();