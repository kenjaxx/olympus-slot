// autospin.js
// Repeatedly triggers a spin function until the count runs out, the player
// hits Stop, or a spin comes back unable to proceed (e.g. low balance).
// The loop itself is defensive: if spinOnceFn ever throws or rejects
// unexpectedly, autospin stops cleanly instead of freezing the UI forever.

(function () {
  const countSel = document.getElementById("autospinCount");
  const btn = document.getElementById("autospinBtn");
  const badge = document.getElementById("autospinbadge");
  const leftEl = document.getElementById("autospinsleft");

  const PAUSE_BETWEEN_SPINS_MS = 450;

  let running = false;
  let remaining = 0;
  let spinOnceFn = null;

  function updateBadge() {
    if (running && remaining > 0) {
      badge.style.display = "block";
      leftEl.textContent = remaining;
    } else {
      badge.style.display = "none";
    }
  }

  function stop() {
    running = false;
    btn.textContent = "Start";
    btn.classList.remove("running");
    updateBadge();
  }

  async function loop() {
    while (running && remaining > 0) {
      remaining--;
      updateBadge();

      let outcome = null;
      try {
        outcome = spinOnceFn ? await spinOnceFn() : null;
      } catch (err) {
        console.error("autospin: spin threw, stopping", err);
        outcome = null;
      }

      if (!outcome || !outcome.ok) {
        stop();
        return;
      }
      if (!running) return;
      await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_SPINS_MS));
    }
    stop();
  }

  function start() {
    if (running || !spinOnceFn) return;
    remaining = Number(countSel.value) || 10;
    running = true;
    btn.textContent = "Stop";
    btn.classList.add("running");
    updateBadge();
    loop();
  }

  btn.addEventListener("click", () => {
    if (running) stop();
    else start();
  });

  function init(spinFn) {
    spinOnceFn = spinFn;
  }

  function isRunning() {
    return running;
  }

  window.AutoSpin = { init, isRunning, stop };
})();