// betControls.js
// Lets the player drag a slider OR type an exact amount; both stay in sync.
// Quick buttons (½ / 2x / Max) jump to common amounts. There's no upper
// cap on the typed bet — the slider just covers a comfortable everyday
// range, and typing (or the Max button) can go past it freely.

(function () {
  const MIN_BET = 10;
  const STEP = 10;

  const sliderEl = document.getElementById("bet");
  const numberEl = document.getElementById("betNumber");
  const halfBtn = document.getElementById("betHalf");
  const doubleBtn = document.getElementById("betDouble");
  const maxBtn = document.getElementById("betMax");
  const balanceEl = document.getElementById("balance");

  function clamp(value) {
    if (!Number.isFinite(value)) return MIN_BET;
    const rounded = Math.round(value / STEP) * STEP;
    return Math.max(MIN_BET, rounded);
  }

  function setBet(value) {
    const clamped = clamp(value);
    numberEl.value = clamped;
    // The slider's own max is a fixed, comfortable ceiling for dragging —
    // once the bet goes past it (typed, or via Max) the handle just pins
    // at the end while the number field keeps showing the real amount.
    sliderEl.value = Math.min(clamped, Number(sliderEl.max));
    return clamped;
  }

  function currentBalance() {
    const raw = (balanceEl.textContent || "").replace(/,/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : MIN_BET;
  }

  sliderEl.addEventListener("input", () => setBet(Number(sliderEl.value)));
  numberEl.addEventListener("change", () => setBet(Number(numberEl.value) || MIN_BET));

  halfBtn.addEventListener("click", () => setBet(Number(numberEl.value) / 2));
  doubleBtn.addEventListener("click", () => setBet(Number(numberEl.value) * 2));
  maxBtn.addEventListener("click", () => setBet(currentBalance())); // all-in

  function getBet() {
    return Number(numberEl.value);
  }

  window.BetControls = { getBet, setBet, MIN_BET };
})();