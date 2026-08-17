// color.js
// Drives the Color Game UI: a horizontal row of bet-amount chips (20 / 50 /
// 100 / 500 / 1000 / Custom) picks how much a tap is worth, then tapping a
// color chip adds that amount to that color's stake. Tap the little ✕ on a
// color chip to clear just that color, or "Clear bets" to reset everything.
//
// The server (server/colorGame.js via /api/color/roll) rolls THREE dice and
// decides, per bet color, how many of those 3 dice matched (0-3). This file
// mirrors that: it reads `result.dice` (array of 3 colors) and
// `result.matches` / `result.results` (keyed by the colors you bet on),
// and renders all 3 dice + a per-bet breakdown in the win banner.

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
  // NOTE: the HTML exposes the 3 dice as #winDie0/#winDie1/#winDie2 (there
  // is no single #winBannerSwatch anymore — that was the old 1-die API).
  const winDiceEls = [
    document.getElementById("winDie0"),
    document.getElementById("winDie1"),
    document.getElementById("winDie2"),
  ];
  const winBannerLabelEl = document.getElementById("winBannerLabel");
  const winBannerTextEl = document.getElementById("winBannerText");
  const winBetLinesEl = document.getElementById("winBetLines");

  const historyRowEl = document.getElementById("historyRow");
  const historyDotsEl = document.getElementById("historyDots");

  // In-memory stake per color — the single source of truth for what's
  // currently "on the table" for that color.
  const stakes = COLORS.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {});

  // ---- Recent-rolls history (persisted locally so it survives a refresh) ----
  // Each history entry is now a 3-color array (one full roll), not a
  // single color — bumped the storage key so old single-color history
  // (from the previous version of this file) doesn't get misread.
  const HISTORY_KEY = "colorGameHistory_v2";
  const HISTORY_MAX = 20;
  let history = [];

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      history = Array.isArray(parsed)
        ? parsed.filter((entry) => Array.isArray(entry) && entry.length === 3 && entry.every((c) => COLORS.includes(c)))
        : [];
    } catch (err) {
      history = [];
    }
    renderHistory();
  }

  function pushHistory(dice) {
    history.push(dice);
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
      .map((dice, i) => {
        const isLatest = i === history.length - 1;
        const dots = dice
          .map((c) => `<span class="history-dot sw-${c}" title="${capitalize(c)}"></span>`)
          .join("");
        return `<span class="history-roll${isLatest ? " latest" : ""}">${dots}</span>`;
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

  // ---- Win banner helpers ----
  function setWinDiceState(diceOrPending) {
    winDiceEls.forEach((el, i) => {
      if (!el) return;
      if (diceOrPending === "pending") {
        el.className = "win-die-swatch swatch-pending";
        el.textContent = "?";
      } else {
        const color = diceOrPending[i];
        el.className = "win-die-swatch sw-" + color;
        el.textContent = "";
      }
    });
  }

  // Renders one line per color the player bet on: how many of the 3 dice
  // matched it, and whether it won or lost.
  function renderBetLines(bets, results, matches) {
    if (!winBetLinesEl) return;
    winBetLinesEl.innerHTML = Object.keys(bets)
      .map((color) => {
        const hitCount = matches[color] || 0;
        const payout = results[color] || 0;
        const won = payout > 0;
        return (
          '<li class="bet-line ' + (won ? "bet-line-win" : "bet-line-lose") + '">' +
          '<span class="bet-line-color sw-' + color + '"></span>' +
          '<span class="bet-line-name">' + capitalize(color) + "</span>" +
          '<span class="bet-line-detail">' +
          (hitCount > 0 ? hitCount + " match" + (hitCount > 1 ? "es" : "") : "no match") +
          "</span>" +
          '<span class="bet-line-amount">' +
          (won ? "+" + payout.toLocaleString() : "lost " + bets[color].toLocaleString()) +
          "</span>" +
          "</li>"
        );
      })
      .join("");
  }

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
    setWinDiceState("pending");
    winBannerLabelEl.textContent = "Rolling…";
    winBannerTextEl.textContent = "Revealing all 3 dice…";
    if (winBetLinesEl) winBetLinesEl.innerHTML = "";

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

    // The server now returns `dice` (an array of 3 colors), not a single
    // `winningColor`. Guard defensively in case of a malformed response.
    const dice =
      Array.isArray(result.dice) && result.dice.length === 3 ? result.dice : ["red", "red", "red"];

    // TEMP DEBUG — remove once the server is confirmed to be returning
    // `dice` correctly. If you see "dice missing from server response!"
    // in the console, the server is still running the OLD winningColor
    // logic (not restarted, or the wrong colorGame.js is loaded).
    if (!Array.isArray(result.dice) || result.dice.length !== 3) {
      console.warn("dice missing from server response! Raw result:", result);
    } else {
      console.log("roll result from server:", result);
    }

    // Small delay so the reset-to-neutral pose is visible before the
    // tumble kicks off, then animate all 3 dice to the server-decided result.
    await new Promise((r) => setTimeout(r, 150));
    try {
      await ColorCube.roll(dice);
    } catch (err) {
      console.error("cube roll animation error:", err);
    }

    balanceEl.textContent = result.balance.toLocaleString();
    lastwinEl.textContent = result.totalWin.toLocaleString();

    const results = result.results || {};
    const matches = result.matches || {};

    COLORS.forEach((c) => {
      if (!(c in bets)) return;
      const won = (results[c] || 0) > 0;
      chips[c].el.classList.toggle("wins", won);
      chips[c].el.classList.toggle("loses", !won);
      chips[c].tagEl.textContent = won ? "+" + results[c].toLocaleString() : "lost";
    });

    // ---- Reveal banner: shows all 3 dice plus a line-by-line breakdown
    // of how each of the player's bets did. ----
    winBannerEl.classList.remove("revealing");
    setWinDiceState(dice);

    const anyWin = result.totalWin > 0;
    winBannerLabelEl.textContent =
      dice.map(capitalize).join(" · ") + (anyWin ? " — you won!" : " — no matches");
    winBannerTextEl.textContent = anyWin
      ? `Your bets returned ${result.totalWin.toLocaleString()} total.`
      : "None of your bet colors matched a die this round.";
    renderBetLines(bets, results, matches);

    winBannerEl.classList.toggle("win-hit", anyWin);
    winBannerEl.classList.toggle("win-miss", !anyWin);
    void winBannerEl.offsetWidth; // restart animation
    winBannerEl.classList.add("pop");

    pushHistory(dice);

    // Stakes are consumed by the roll — clear them for the next round.
    COLORS.forEach((c) => (stakes[c] = 0));
    COLORS.forEach((c) => renderColor(c));
    updateTotalStake();

    if (anyWin) {
      msgEl.textContent = `Dice landed on ${dice.map(capitalize).join(", ")}! You collected ${result.totalWin.toLocaleString()}`;
    } else {
      msgEl.textContent = `Dice landed on ${dice.map(capitalize).join(", ")} — better luck next roll`;
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