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
  const muteBtn = document.getElementById("muteBtn");
  const winBanner = document.getElementById("winBanner");
  const netLineEl = document.getElementById("netLine");

  let currentPlayer = "guest";

  muteBtn.addEventListener("click", () => {
    Sound.setMuted(!Sound.isMuted());
    muteBtn.textContent = Sound.isMuted() ? "🔇" : "🔊";
  });

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

  // Runs exactly one spin end-to-end: request -> animate -> update state.
  // Returns { ok, insufficientFunds } so AutoSpin knows whether to continue.
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
        spinBtn.disabled = false;
        return { ok: false, insufficientFunds: true };
      }
      result = await res.json();
    } catch (e) {
      msgEl.textContent = "Could not reach server";
      spinBtn.disabled = false;
      return { ok: false, insufficientFunds: false };
    }

    await Reels.runFullSequence(result, bet);
    spinBtn.disabled = false;
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