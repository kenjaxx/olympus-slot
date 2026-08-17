// color.js
// Drives the Color Game UI: a horizontal row of bet-amount chips (20 / 50 /
// 100 / 500 / 1000 / Custom) picks how much a tap is worth, then tapping a
// color chip adds that amount to that color's stake. Tap the little ✕ on a
// color chip to clear just that color, or "Clear bets" to reset everything.
//
// The server (server/colorGame.js via /api/color/roll) still decides the
// winning color and payouts — this file only builds the bet payload and
// renders the response.

(function () {
  const COLORS = ["red", "yellow", "blue", "green", "white", "pink"];
  const currentPlayer = "guest";
  const DEFAULT_AMOUNT = 100;

  const balanceEl = document.getElementById("balance");
  const lastwinEl = document.getElementById("lastwin");
  const totalStakeEl = document.getElementById("totalStake");
  const msgEl = document.getElementById("msg");
  const rollBtn = document.getElementById("rollBtn");
  const clearBtn = document.getElementById("clearBtn");
  const loadAmountEl = document.getElementById("loadAmount");
  const topupBtn = document.getElementById("topupBtn");
  const cubeContainer = document.getElementById("cubeContainer");

  const amountChips = Array.from(document.querySelectorAll(".amount-chip"));
  const customBtn = document.getElementById("customAmountBtn");
  const customRow = document.getElementById("customAmountRow");
  const customInput = document.getElementById("customAmountInput");
  const customSetBtn = document.getElementById("customAmountSet");
  const customCancelBtn = document.getElementById("customAmountCancel");

  const colorGrid = document.getElementById("colorGrid");

  const winBannerEl = document.getElementById("winBanner");
  const winBannerSwatchEl = document.getElementById("winBannerSwatch");
  const winBannerLabelEl = document.getElementById("winBannerLabel");
  const winBannerTextEl = document.getElementById("winBannerText");

  const historyRowEl = document.getElementById("historyRow");
  const historyDotsEl = document.getElementById("historyDots");

  // In-memory stake per color — the single source of truth for what's
  // currently "on the table" for that color.
  const stakes = COLORS.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {});

  // ---- Recent-rolls history (persisted locally so it survives a refresh) ----
  const HISTORY_KEY = "colorGameHistory_v1";
  const HISTORY_MAX = 20;
  let history = [];

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      history = Array.isArray(parsed) ? parsed.filter((c) => COLORS.includes(c)) : [];
    } catch (err) {
      history = [];
    }
    renderHistory();
  }

  function pushHistory(color) {
    history.push(color);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (err) {
      // localStorage unavailable (private mode, etc.) — history just won't persist.
    }
    renderHistory();
  }

  function renderHistory() {
    if (!history.length) {
      historyRowEl.hidden = true;
      return;
    }
    historyRowEl.hidden = false;
    historyDotsEl.innerHTML = history
      .map((c, i) => {
        const isLatest = i === history.length - 1;
        return `<span class="history-dot sw-${c}${isLatest ? " latest" : ""}" title="${capitalize(c)}"></span>`;
      })
      .join("");
    historyDotsEl.scrollLeft = historyDotsEl.scrollWidth;
  }

  const chips = {};
  COLORS.forEach((c) => {
    const el = document.querySelector(`.color-chip[data-color="${c}"]`);
    chips[c] = {
      el,
      stakeEl: el.querySelector(".chip-stake"),
      clearEl: el.querySelector(".chip-clear"),
      tagEl: el.querySelector(".chip-tag"),
    };
  });

  let selectedAmount = DEFAULT_AMOUNT;

  ColorCube.mount(cubeContainer);

  // ---- Balance helpers ----
  function currentBalance() {
    const n = Number((balanceEl.textContent || "0").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  // How much MORE a given color could take without pushing total stake
  // past the current balance.
  function availableFor(color) {
    const others = COLORS.reduce((sum, c) => (c === color ? sum : sum + stakes[c]), 0);
    return Math.max(0, currentBalance() - others);
  }

  function updateTotalStake() {
    const total = COLORS.reduce((sum, c) => sum + stakes[c], 0);
    totalStakeEl.textContent = total.toLocaleString();
    return total;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---- Amount chip row ----
  function setActiveAmountChip(matchAmt) {
    amountChips.forEach((btn) => {
      const isCustom = btn === customBtn;
      btn.classList.toggle("active", !isCustom && Number(btn.dataset.amt) === matchAmt);
    });
  }

  function selectPresetAmount(amt) {
    selectedAmount = amt;
    setActiveAmountChip(amt);
    customBtn.classList.remove("active");
    customRow.hidden = true;
  }

  amountChips.forEach((btn) => {
    if (btn === customBtn) return;
    btn.addEventListener("click", () => selectPresetAmount(Number(btn.dataset.amt)));
  });

  customBtn.addEventListener("click", () => {
    amountChips.forEach((b) => b.classList.remove("active"));
    customBtn.classList.add("active");
    customRow.hidden = false;
    customInput.value = selectedAmount || "";
    customInput.focus();
    customInput.select();
  });

  function applyCustomAmount() {
    const v = Math.round(Number(customInput.value));
    if (!Number.isFinite(v) || v <= 0) {
      msgEl.textContent = "Enter a valid custom amount";
      return;
    }
    selectedAmount = v;
    customRow.hidden = true;
    msgEl.textContent = `Bet amount set to ${v.toLocaleString()}`;
  }

  customSetBtn.addEventListener("click", applyCustomAmount);
  customCancelBtn.addEventListener("click", () => {
    customRow.hidden = true;
    setActiveAmountChip(selectedAmount);
  });
  customInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCustomAmount();
    } else if (e.key === "Escape") {
      customRow.hidden = true;
      setActiveAmountChip(selectedAmount);
    }
  });

  // ---- Color grid ----
  function renderColor(color) {
    const t = chips[color];
    t.stakeEl.textContent = stakes[color].toLocaleString();
    t.el.classList.toggle("has-stake", stakes[color] > 0);
    t.clearEl.hidden = stakes[color] === 0;
  }

  function addStake(color) {
    if (colorGrid.classList.contains("disabled")) return;
    const avail = availableFor(color);
    if (avail <= 0) {
      msgEl.textContent = "Not enough balance left to bet more";
      return;
    }
    const amt = Math.min(selectedAmount, avail);
    stakes[color] += amt;
    renderColor(color);
    updateTotalStake();
    msgEl.textContent = `Added ${amt.toLocaleString()} to ${capitalize(color)}`;
  }

  function clearStake(color) {
    stakes[color] = 0;
    renderColor(color);
    updateTotalStake();
  }

  COLORS.forEach((c) => {
    const t = chips[c];

    t.el.addEventListener("click", (e) => {
      if (e.target.closest(".chip-clear")) return; // handled below
      addStake(c);
    });
    t.el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        addStake(c);
      }
    });

    t.clearEl.addEventListener("click", (e) => {
      e.stopPropagation();
      clearStake(c);
    });
  });

  function clearResultTags() {
    COLORS.forEach((c) => {
      chips[c].el.classList.remove("wins", "loses");
      chips[c].tagEl.textContent = "";
    });
  }

  clearBtn.addEventListener("click", () => {
    COLORS.forEach((c) => clearStake(c));
    clearResultTags();
    msgEl.textContent = "Bets cleared";
  });

  function setControlsDisabled(disabled) {
    rollBtn.disabled = disabled;
    clearBtn.disabled = disabled;
    amountChips.forEach((b) => (b.disabled = disabled));
    customSetBtn.disabled = disabled;
    customCancelBtn.disabled = disabled;
    customInput.disabled = disabled;
    colorGrid.classList.toggle("disabled", disabled);
    COLORS.forEach((c) => (chips[c].el.tabIndex = disabled ? -1 : 0));
    if (disabled) customRow.hidden = true;
  }

  // ---- Balance loading / top-up ----
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

  // ---- Roll ----
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

    winBannerEl.classList.remove("win-hit", "win-miss", "pop");
    winBannerEl.classList.add("revealing");
    winBannerSwatchEl.className = "win-banner-swatch swatch-pending";
    winBannerSwatchEl.textContent = "?";
    winBannerLabelEl.textContent = "Rolling…";
    winBannerTextEl.textContent = "Revealing the winning color…";

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

    const wonColor = result.winningColor;
    const betOnWinner = (bets[wonColor] || 0) > 0;

    COLORS.forEach((c) => {
      if (!(c in bets)) return;
      const won = c === wonColor;
      chips[c].el.classList.toggle("wins", won);
      chips[c].el.classList.toggle("loses", !won);
      chips[c].tagEl.textContent = won ? "+" + result.results[c].toLocaleString() : "lost";
    });

    // ---- Reveal banner: explicitly states what won and whether the
    // player's own bet matched it, instead of leaving that to a guess. ----
    winBannerEl.classList.remove("revealing");
    winBannerSwatchEl.className = "win-banner-swatch sw-" + wonColor;
    winBannerSwatchEl.textContent = "";
    winBannerLabelEl.textContent = capitalize(wonColor) + " wins!";

    if (betOnWinner) {
      winBannerTextEl.textContent =
        `Your ${bets[wonColor].toLocaleString()} bet on ${capitalize(wonColor)} paid out ${result.results[wonColor].toLocaleString()}.`;
    } else {
      const yourColors = Object.keys(bets).map(capitalize).join(", ");
      winBannerTextEl.textContent = yourColors
        ? `You bet on ${yourColors} — no match this round, so those stakes were lost.`
        : `No bets landed on ${capitalize(wonColor)} this round.`;
    }
    winBannerEl.classList.toggle("win-hit", betOnWinner);
    winBannerEl.classList.toggle("win-miss", !betOnWinner);
    void winBannerEl.offsetWidth; // restart animation
    winBannerEl.classList.add("pop");

    pushHistory(wonColor);

    // Stakes are consumed by the roll — clear them for the next round.
    COLORS.forEach((c) => (stakes[c] = 0));
    COLORS.forEach((c) => renderColor(c));
    updateTotalStake();

    if (betOnWinner) {
      msgEl.textContent = `${capitalize(wonColor)} wins! You collected ${result.totalWin.toLocaleString()}`;
    } else {
      msgEl.textContent = `${capitalize(wonColor)} wins this round — better luck next roll`;
    }

    setControlsDisabled(false);
  }

  rollBtn.addEventListener("click", roll);

  // ---- Boot ----
  selectPresetAmount(DEFAULT_AMOUNT);
  COLORS.forEach((c) => renderColor(c));
  updateTotalStake();
  loadHistory();
  loadPlayer();
})();