// cardArt.js
// Renders each reel symbol as an original line-art mythology icon (grape
// cluster, kylix cup, amphora, krater, gem, laurel crown) instead of a
// generic playing-card face. Purely cosmetic — gameplay/probabilities are
// untouched on the server. All icons are simple geometric shapes drawn by
// hand for this project; they don't reproduce any specific commercial
// game's artwork.

(function () {
  // Symbol metadata, ordered low -> high value. `tier` drives the visual
  // treatment (border color, glow) and is reused by the paytable.
  const SYMBOL_META = {
    grape: { tier: 1, label: "Grapes",  accent: "#8577a8" },
    wine:  { tier: 2, label: "Kylix",   accent: "#6fa287" },
    urn:   { tier: 3, label: "Amphora", accent: "#3d5a8a" },
    vase:  { tier: 4, label: "Krater",  accent: "#b5502d" },
    gem:   { tier: 5, label: "Gem",     accent: "#c23b3b" },
    crown: { tier: 6, label: "Crown",   accent: "#d4af37" },
  };

  // Highest value first — handy for the paytable, which reads top to bottom.
  const SYMBOL_ORDER = Object.keys(SYMBOL_META).sort(
    (a, b) => SYMBOL_META[b].tier - SYMBOL_META[a].tier
  );

  const ICONS = {
    grape:
      '<svg viewBox="0 0 40 40" fill="currentColor"><path d="M20 2 q5 -4 9 -1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="13" r="5"/><circle cx="23" cy="11" r="5"/><circle cx="19" cy="20" r="5"/><circle cx="28" cy="19" r="5"/><circle cx="14" cy="24" r="5"/><circle cx="23" cy="29" r="5"/></svg>',
    wine:
      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="20" cy="15" rx="12" ry="4.5"/><path d="M8 15 q0 9 12 9 q12 0 12 -9"/><path d="M7 15 q-5 0 -4 5"/><path d="M33 15 q5 0 4 5"/><path d="M20 24 v7"/><path d="M13 34 h14"/></svg>',
    urn:
      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3 h8 v4 h-8 Z"/><path d="M16 7 q-9 2 -9 13 q0 13 13 13 q13 0 13 -13 q0 -11 -9 -13"/><path d="M7 15 q-4 2 -3 8"/><path d="M33 15 q4 2 3 8"/></svg>',
    vase:
      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5 h22 l-4.5 15 q-6.5 4.5 -13 0 Z"/><path d="M18.5 20 v8 h3 v-8"/><path d="M12.5 32 h15"/><path d="M7 7 q-5 2 -2.5 9"/><path d="M33 7 q5 2 2.5 9"/></svg>',
    gem:
      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M8 14 L20 3 L32 14 L20 37 Z"/><path d="M8 14 H32"/><path d="M14.5 14 L20 3"/><path d="M25.5 14 L20 3"/><path d="M14.5 14 L20 37"/><path d="M25.5 14 L20 37"/></svg>',
    crown:
      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M6 30 L9.5 12 L17 20 L20 6 L23 20 L30.5 12 L34 30 Z"/><path d="M6 30 h28 v5 h-28 Z" fill="currentColor" stroke="none"/><circle cx="20" cy="6" r="2" fill="currentColor" stroke="none"/></svg>',
  };

  function symbolCardHTML(symbolKey) {
    const meta = SYMBOL_META[symbolKey];
    if (!meta) return "";
    return (
      '<div class="pcard pcard-symbol pcard-tier' + meta.tier + '" style="--tier-accent:' + meta.accent + '">' +
      '<span class="pcard-icon">' + ICONS[symbolKey] + "</span>" +
      '<span class="pcard-name">' + meta.label + "</span>" +
      "</div>"
    );
  }

  function scatterCardHTML() {
    return (
      '<div class="pcard pcard-scatter">' +
      '<div class="coin"><span class="coin-dollar">$</span></div>' +
      '<span class="scatter-label">SCATTER</span>' +
      "</div>"
    );
  }

  function wildOrbCardHTML() {
    return (
      '<div class="pcard pcard-wild">' +
      '<svg viewBox="0 0 40 40" width="28" height="28">' +
      '<polygon points="20,2 25,15 38,15 27,23 31,37 20,28 9,37 13,23 2,15 15,15" fill="#ffd166" stroke="#fff" stroke-width="1"/>' +
      "</svg>" +
      '<span class="wild-label">WILD</span>' +
      "</div>"
    );
  }

  // Returns { html, className } for a given symbol key so callers can set
  // both the inner markup and the wrapper class in one call.
  function cardFor(symbolKey) {
    if (symbolKey === "temple") return { html: scatterCardHTML(), className: "card-scatter-wrap" };
    if (symbolKey === "orb") return { html: wildOrbCardHTML(), className: "card-wild-wrap" };
    return { html: symbolCardHTML(symbolKey), className: "card-face-wrap" };
  }

  function randomSymbolKey() {
    const keys = Object.keys(SYMBOL_META);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  window.CardArt = { cardFor, randomSymbolKey, SYMBOL_META, SYMBOL_ORDER, ICONS };
})();