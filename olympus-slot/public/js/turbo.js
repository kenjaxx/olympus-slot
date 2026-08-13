// turbo.js
// A simple on/off toggle that speeds up (or skips) the reel/tumble/suspense
// animations so a spin resolves almost instantly. Purely visual — it never
// touches odds, bet, or balance logic.

(function () {
  const btn = document.getElementById("turboBtn");
  if (!btn) return;

  let on = false;

  function apply() {
    btn.textContent = on ? "⚡ Turbo: ON" : "⚡ Turbo: OFF";
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const wrap = document.querySelector(".reels-wrap");
    if (wrap) wrap.classList.toggle("turbo", on);
  }

  btn.addEventListener("click", () => {
    on = !on;
    apply();
  });

  apply();

  window.Turbo = { isOn: () => on };
})();