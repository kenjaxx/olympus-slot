// paytable.js
// Builds and toggles the paytable/info modal from CardArt's symbol
// metadata, so the list always matches whatever icons are on the reels.

(function () {
  const openBtn = document.getElementById("paytableBtn");
  const modal = document.getElementById("paytableModal");
  const closeBtn = document.getElementById("paytableClose");
  const listEl = document.getElementById("paytableList");
  if (!openBtn || !modal || !listEl) return;

  function render() {
    listEl.innerHTML = CardArt.SYMBOL_ORDER.map((key) => {
      const meta = CardArt.SYMBOL_META[key];
      return (
        '<li class="paytable-row">' +
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