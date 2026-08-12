// betControls.js
// Lets the player drag a slider OR type an exact amount; both stay in sync.
// Quick buttons (½ / 2x / Max) jump to common amounts.

(function () {
  const MIN_BET = 10;
  const MAX_BET = 2000;
  const STEP = 10;

  const sliderEl = document.getElementById("bet");
  const numberEl = document.getElementById("betNumber");
  const halfBtn = document.getElementById("betHalf");
  const doubleBtn = document.getElementById("betDouble");
  const maxBtn = document.getElementById("betMax");

  function clamp(value) {
    const rounded = Math.round(value / STEP) * STEP;
    return Math.max(MIN_BET, Math.min(MAX_BET, rounded));
  }

  function setBet(value) {
    const clamped = clamp(value);
    numberEl.value = clamped;
    // Slider's own max stays smaller than the absolute max so dragging feels
    // precise; typing a bigger number still works via the number input.
    if (clamped > Number(sliderEl.max)) {
      sliderEl.value = sliderEl.max;
    } else {
      sliderEl.value = clamped;
    }
    return clamped;
  }

  sliderEl.addEventListener("input", () => setBet(Number(sliderEl.value)));
  numberEl.addEventListener("change", () => setBet(Number(numberEl.value) || MIN_BET));

  halfBtn.addEventListener("click", () => setBet(Number(numberEl.value) / 2));
  doubleBtn.addEventListener("click", () => setBet(Number(numberEl.value) * 2));
  maxBtn.addEventListener("click", () => setBet(MAX_BET));

  function getBet() {
    return Number(numberEl.value);
  }

  window.BetControls = { getBet, setBet, MIN_BET, MAX_BET };
})();
