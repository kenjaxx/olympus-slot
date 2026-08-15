// betControls.js
// Lets the player drag a slider OR type an exact amount; both stay in sync.
// Quick buttons (½ / 2x / Max) jump to common amounts.
//
// No bet can ever exceed the player's current balance. "Max" is exact
// (no step-rounding) so it always lands on your full balance.
//
// During free spins, setDisabled(true) locks every control — the bonus
// round always plays at the bet that triggered it, never the slider.

(function () {
  const MIN_BET = 10;
  const STEP = 10;

  const betRowEl = document.querySelector(".bet-row");
  const sliderEl = document.getElementById("bet");
  const numberEl = document.getElementById("betNumber");
  const halfBtn = document.getElementById("betHalf");
  const doubleBtn = document.getElementById("betDouble");
  const maxBtn = document.getElementById("betMax");
  const balanceEl = document.getElementById("balance");
  const lockHintEl = document.getElementById("betLockHint");

  let hintEl = document.querySelector(".bet-overflow-hint");
  if (!hintEl && betRowEl) {
    hintEl = document.createElement("span");
    hintEl.className = "bet-overflow-hint";
    hintEl.textContent = "Above slider range";
    betRowEl.appendChild(hintEl);
  }

  function currentBalance() {
    const raw = (balanceEl.textContent || "").replace(/,/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : MIN_BET;
  }

  function clamp(value, exact) {
    if (!Number.isFinite(value)) return MIN_BET;

    const balance = currentBalance();
    let result;

    if (exact) {
      result = Math.max(MIN_BET, Math.floor(value));
      if (result > balance) result = Math.max(MIN_BET, Math.floor(balance));
    } else {
      result = Math.max(MIN_BET, Math.round(value / STEP) * STEP);
      if (result > balance) {
        result = Math.floor(balance / STEP) * STEP;
        if (result < MIN_BET) result = MIN_BET;
      }
    }

    return result;
  }

  function setBet(value, exact) {
    const clamped = clamp(value, exact);
    numberEl.value = clamped;
    const sliderMax = Number(sliderEl.max);
    sliderEl.value = Math.min(clamped, sliderMax);
    if (betRowEl) betRowEl.classList.toggle("bet-overflow", clamped > sliderMax);
    return clamped;
  }

  sliderEl.addEventListener("input", () => setBet(Number(sliderEl.value)));
  numberEl.addEventListener("change", () => setBet(Number(numberEl.value) || MIN_BET));

  halfBtn.addEventListener("click", () => setBet(Number(numberEl.value) / 2));
  doubleBtn.addEventListener("click", () => setBet(Number(numberEl.value) * 2));
  maxBtn.addEventListener("click", () => setBet(currentBalance(), true)); // exact — all in

  function getBet() {
    return Number(numberEl.value);
  }

  // Locks/unlocks every bet control — used while a free-spins bonus round
  // is auto-playing, since it always plays at the bet that triggered it.
  function setDisabled(disabled) {
    sliderEl.disabled = disabled;
    numberEl.disabled = disabled;
    halfBtn.disabled = disabled;
    doubleBtn.disabled = disabled;
    maxBtn.disabled = disabled;
    if (betRowEl) betRowEl.classList.toggle("bet-locked", disabled);
    if (lockHintEl) lockHintEl.style.display = disabled ? "block" : "none";
  }

  setBet(Number(numberEl.value) || MIN_BET);

  window.BetControls = { getBet, setBet, setDisabled, MIN_BET };
})();