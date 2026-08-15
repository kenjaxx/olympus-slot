(function () {
  const COLORS = ["red", "yellow", "blue", "green", "white", "pink"];
  const currentPlayer = "guest";

  const balanceEl = document.getElementById("balance");
  const lastwinEl = document.getElementById("lastwin");
  const totalStakeEl = document.getElementById("totalStake");
  const msgEl = document.getElementById("msg");
  const rollBtn = document.getElementById("rollBtn");
  const clearBtn = document.getElementById("clearBtn");
  const loadAmountEl = document.getElementById("loadAmount");
  const topupBtn = document.getElementById("topupBtn");
  const cubeContainer = document.getElementById("cubeContainer");

  const tiles = {};
  COLORS.forEach((c) => {
    tiles[c] = {
      el: document.querySelector(`.color-tile[data-color="${c}"]`),
      input: document.querySelector(`.color-tile[data-color="${c}"] input`),
      tag: document.querySelector(`.color-tile[data-color="${c}"] .result-tag`),
    };
  });

  ColorCube.mount(cubeContainer);

  function currentBalance() {
    const n = Number((balanceEl.textContent || "0").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function updateTotalStake() {
    let total = 0;
    COLORS.forEach((c) => {
      const v = Math.max(0, Math.round(Number(tiles[c].input.value) || 0));
      total += v;
    });
    totalStakeEl.textContent = total.toLocaleString();
    return total;
  }

  function clearResultTags() {
    COLORS.forEach((c) => {
      tiles[c].el.classList.remove("wins", "loses");
      tiles[c].tag.textContent = "";
    });
  }

  function setControlsDisabled(disabled) {
    rollBtn.disabled = disabled;
    clearBtn.disabled = disabled;
    COLORS.forEach((c) => (tiles[c].input.disabled = disabled));
  }

  COLORS.forEach((c) => {
    tiles[c].input.addEventListener("input", () => {
      if (Number(tiles[c].input.value) < 0) tiles[c].input.value = 0;
      updateTotalStake();
    });
  });

  clearBtn.addEventListener("click", () => {
    COLORS.forEach((c) => (tiles[c].input.value = 0));
    clearResultTags();
    updateTotalStake();
    msgEl.textContent = "Bets cleared";
  });

  async function loadPlayer() {
    try {
      const res = await fetch(`/api/state/${encodeURIComponent(currentPlayer)}`);
      const data = await res.json();
      balanceEl.textContent = data.balance.toLocaleString();
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
      const data = await res.json();
      if (!res.ok) {
        msgEl.textContent = data.error || "Could not add funds";
        return;
      }
      balanceEl.textContent = data.balance.toLocaleString();
      msgEl.textContent = `Added ${amount.toLocaleString()} to your balance`;
    } catch (err) {
      console.error("topup error:", err);
      msgEl.textContent = "Could not reach server";
    }
  });

  async function roll() {
    const bets = {};
    COLORS.forEach((c) => {
      const amount = Math.round(Number(tiles[c].input.value) || 0);
      if (amount > 0) bets[c] = amount;
    });

    const total = updateTotalStake();
    if (Object.keys(bets).length === 0) {
      msgEl.textContent = "Place a bet on at least one color";
      return;
    }
    if (total > currentBalance()) {
      msgEl.textContent = "Total bet exceeds your balance";
      return;
    }

    setControlsDisabled(true);
    clearResultTags();
    msgEl.textContent = "Rolling…";
    ColorCube.reset();

    let result;
    try {
      const res = await fetch("/api/color/roll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: currentPlayer, bets }),
      });
      result = await res.json();
      if (!res.ok) {
        msgEl.textContent = result.error || "Something went wrong";
        setControlsDisabled(false);
        return;
      }
    } catch (err) {
      console.error("roll request error:", err);
      msgEl.textContent = "Could not reach server";
      setControlsDisabled(false);
      return;
    }

    // Small delay so the reset-to-neutral pose is visible before the
    // tumble kicks off, then animate to the server-decided color.
    await new Promise((r) => setTimeout(r, 150));
    await ColorCube.roll(result.winningColor);

    balanceEl.textContent = result.balance.toLocaleString();
    lastwinEl.textContent = result.totalWin.toLocaleString();

    COLORS.forEach((c) => {
      if (!(c in bets)) return;
      const won = c === result.winningColor;
      tiles[c].el.classList.toggle("wins", won);
      tiles[c].el.classList.toggle("loses", !won);
      tiles[c].tag.textContent = won ? "+" + result.results[c].toLocaleString() : "lost";
    });

    if (result.totalWin > 0) {
      msgEl.textContent = `${capitalize(result.winningColor)} wins! You collected ${result.totalWin.toLocaleString()}`;
    } else {
      msgEl.textContent = `${capitalize(result.winningColor)} wins this round — better luck next roll`;
    }

    setControlsDisabled(false);
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  rollBtn.addEventListener("click", roll);

  // ---- Boot ----
  updateTotalStake();
  loadPlayer();
})();
