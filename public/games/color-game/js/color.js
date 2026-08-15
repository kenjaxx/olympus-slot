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
  const betGrid = document.getElementById("betGrid");

  // In-memory stake per color — the single source of truth for what's
  // "in the tile". Quick-bet buttons, 2x/Max, and the custom entry all
  // just call setStake(), which clamps to whatever's actually available.
  const stakes = COLORS.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {});

  const tiles = {};
  COLORS.forEach((c) => {
    const el = document.querySelector(`.color-tile[data-color="${c}"]`);
    tiles[c] = {
      el,
      stakeEl: el.querySelector(".stake-amount"),
      tag: el.querySelector(".result-tag"),
      quickBtns: Array.from(el.querySelectorAll(".qbtn")),
      actionBtns: Array.from(el.querySelectorAll(".abtn")),
      customRow: el.querySelector(".custom-row"),
      customInput: el.querySelector(".custom-input"),
      customSet: el.querySelector(".custom-set"),
      customCancel: el.querySelector(".custom-cancel"),
    };
  });

  ColorCube.mount(cubeContainer);

  function currentBalance() {
    const n = Number((balanceEl.textContent || "0").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  // How much MORE this color could take without pushing total stake
  // past the current balance.
  function availableFor(color) {
    const others = COLORS.reduce((sum, c) => (c === color ? sum : sum + stakes[c]), 0);
    return Math.max(0, currentBalance() - others);
  }

  function renderTile(color) {
    const t = tiles[color];
    t.stakeEl.textContent = stakes[color].toLocaleString();
    t.quickBtns.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.amt) === stakes[color] && stakes[color] > 0);
    });
  }

  function setStake(color, desired) {
    const avail = availableFor(color);
    let amt = Math.round(Number(desired));
    if (!Number.isFinite(amt) || amt < 0) amt = 0;
    amt = Math.min(amt, avail);
    stakes[color] = amt;
    renderTile(color);
    updateTotalStake();
  }

  function updateTotalStake() {
    const total = COLORS.reduce((sum, c) => sum + stakes[c], 0);
    totalStakeEl.textContent = total.toLocaleString();
    return total;
  }

  function closeAllCustomRows(exceptColor) {
    COLORS.forEach((c) => {
      if (c === exceptColor) return;
      tiles[c].customRow.hidden = true;
      tiles[c].actionBtns.forEach((b) => {
        if (b.dataset.action === "custom") b.classList.remove("open");
      });
    });
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
    COLORS.forEach((c) => {
      const t = tiles[c];
      t.quickBtns.forEach((b) => (b.disabled = disabled));
      t.actionBtns.forEach((b) => (b.disabled = disabled));
      t.customSet.disabled = disabled;
      t.customCancel.disabled = disabled;
      t.customInput.disabled = disabled;
      if (disabled) {
        t.customRow.hidden = true;
        t.actionBtns.forEach((b) => {
          if (b.dataset.action === "custom") b.classList.remove("open");
        });
      }
    });
  }

  // ---- Wire up every tile's buttons via one delegated listener ----
  betGrid.addEventListener("click", (e) => {
    const tileEl = e.target.closest(".color-tile");
    if (!tileEl) return;
    const color = tileEl.dataset.color;

    const qbtn = e.target.closest(".qbtn");
    if (qbtn) {
      setStake(color, Number(qbtn.dataset.amt));
      return;
    }

    const abtn = e.target.closest(".abtn");
    if (abtn) {
      const action = abtn.dataset.action;
      if (action === "2x") {
        setStake(color, stakes[color] * 2);
      } else if (action === "max") {
        setStake(color, Number.MAX_SAFE_INTEGER); // clamped down to what's available
      } else if (action === "custom") {
        const t = tiles[color];
        const willOpen = t.customRow.hidden;
        closeAllCustomRows(color);
        t.customRow.hidden = !willOpen;
        abtn.classList.toggle("open", willOpen);
        if (willOpen) {
          t.customInput.value = stakes[color] || "";
          t.customInput.focus();
        }
      }
      return;
    }

    if (e.target.closest(".custom-set")) {
      setStake(color, tiles[color].customInput.value);
      tiles[color].customRow.hidden = true;
      tiles[color].actionBtns.forEach((b) => {
        if (b.dataset.action === "custom") b.classList.remove("open");
      });
      return;
    }

    if (e.target.closest(".custom-cancel")) {
      tiles[color].customRow.hidden = true;
      tiles[color].actionBtns.forEach((b) => {
        if (b.dataset.action === "custom") b.classList.remove("open");
      });
    }
  });

  // Enter key inside a custom input behaves like pressing "Set".
  betGrid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.classList.contains("custom-input")) return;
    e.preventDefault();
    const tileEl = e.target.closest(".color-tile");
    if (!tileEl) return;
    const color = tileEl.dataset.color;
    setStake(color, e.target.value);
    tiles[color].customRow.hidden = true;
    tiles[color].actionBtns.forEach((b) => {
      if (b.dataset.action === "custom") b.classList.remove("open");
    });
  });

  clearBtn.addEventListener("click", () => {
    COLORS.forEach((c) => setStake(c, 0));
    closeAllCustomRows();
    clearResultTags();
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
      if (stakes[c] > 0) bets[c] = stakes[c];
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
  COLORS.forEach((c) => renderTile(c));
  updateTotalStake();
  loadPlayer();
})();