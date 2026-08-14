// lobby.js
// Handles the search box, category filter pills, and a small toast for
// tapping locked ("Coming Soon") game cards.

(function () {
  const searchEl = document.getElementById("gameSearch");
  const pillsEl = document.getElementById("filterPills");
  const cards = Array.from(document.querySelectorAll(".game-card"));
  const noResultsEl = document.getElementById("noResults");
  const toastEl = document.getElementById("toast");

  let activeFilter = "all";

  function applyFilters() {
    const query = (searchEl.value || "").trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach((card) => {
      const name = card.dataset.name || "";
      const cat = card.dataset.cat || "";
      const matchesQuery = !query || name.includes(query);
      const matchesFilter = activeFilter === "all" || cat === activeFilter;
      const show = matchesQuery && matchesFilter;
      card.style.display = show ? "" : "none";
      if (show) visibleCount++;
    });

    noResultsEl.style.display = visibleCount === 0 ? "block" : "none";
  }

  searchEl.addEventListener("input", applyFilters);

  pillsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    pillsEl.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    applyFilters();
  });

  let toastTimer = null;
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  cards.forEach((card) => {
    if (!card.classList.contains("locked")) return;
    card.addEventListener("click", () => {
      const title = card.querySelector("h3");
      showToast((title ? title.textContent : "This game") + " is coming soon!");
    });
  });
})();