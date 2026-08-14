// betControls.js
// Lets the player drag a slider OR type an exact amount; both stay in sync.
// Quick buttons (½ / 2x / Max) jump to common amounts. There's no upper
// cap on the typed bet — the slider just covers a comfortable everyday
// range, and typing (or the Max button) can go past it freely.
//
// When the bet goes past the slider's fixed ceiling, the handle pins at
// the end — which on its own looks like the slider is just stuck. A small
// "MAX RANGE" hint + a highlighted number field make that state legible
// instead of silent.

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

  // Small hint label, injected once rather than baked into index.html so
  // this file stays a self-contained drop-in.
  let hintEl = document.querySelector(".bet-overflow-hint");
  if (!hintEl && betRowEl) {
    hintEl = document.createElement("span");
    hintEl.className = "bet-overflow-hint";
    hintEl.textContent = "Above slider range";
    betRowEl.appendChild(hintEl);
  }

  function clamp(value) {
    if (!Number.isFinite(value)) return MIN_BET;
    const rounded = Math.round(value / STEP) * STEP;
    return Math.max(MIN_BET, rounded);
  }

  function setBet(value) {
    const clamped = clamp(value);
    numberEl.value = clamped;
    const sliderMax = Number(sliderEl.max);
    // The slider's own max is a fixed, comfortable ceiling for dragging —
    // once the bet goes past it (typed, or via Max) the handle just pins
    // at the end while the number field keeps showing the real amount.
    sliderEl.value = Math.min(clamped, sliderMax);
    if (betRowEl) betRowEl.classList.toggle("bet-overflow", clamped > sliderMax);
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

  // Initialize overflow state in case the starting value already exceeds
  // the slider's ceiling (e.g. restored from a future persistence layer).
  setBet(Number(numberEl.value) || MIN_BET);

  window.BetControls = { getBet, setBet, MIN_BET };
})();