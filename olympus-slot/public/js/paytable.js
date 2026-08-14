// paytable.js
// Builds and toggles the paytable/info modal from CardArt's symbol
// metadata, so the list always matches whatever icons are on the reels.
// Rows stagger in on open (via a CSS animation-delay set per row) instead
// of all appearing at once, so the sheet feels considered rather than
// just "list dumped on screen".

(function () {
  const openBtn = document.getElementById("paytableBtn");
  const modal = document.getElementById("paytableModal");
  const closeBtn = document.getElementById("paytableClose");
  const listEl = document.getElementById("paytableList");
  if (!openBtn || !modal || !listEl) return;

  const ROW_STAGGER_MS = 45;

  function render() {
    listEl.innerHTML = CardArt.SYMBOL_ORDER.map((key, i) => {
      const meta = CardArt.SYMBOL_META[key];
      const delay = (i * ROW_STAGGER_MS) / 1000;
      return (
        '<li class="paytable-row" style="--row-delay:' + delay + 's">' +
        '<span class="paytable-icon" style="color:' + meta.accent + '">' + CardArt.ICONS[key] + "</span>" +
        '<span class="paytable-label">' + meta.label + "</span>" +
        '<span class="paytable-tier">Tier ' + meta.tier + " / 6</span>" +
        "</li>"
      );
    }).join("");
  }

  function open() {
    render();
    modal.classList.add("show");
  }
  function close() {
    modal.classList.remove("show");
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();