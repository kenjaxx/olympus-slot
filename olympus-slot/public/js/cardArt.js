// cardArt.js
// Renders symbols as standard playing-card faces (rank + suit), drawn as
// small original SVG icons. This is generic public-domain-style card
// iconography — not a reproduction of any specific commercial game's art.

(function () {
  const SUIT_PATH = {
    spade: '<path d="M20 4 C10 14 4 22 4 29 a10 10 0 0 0 20 3 a10 10 0 0 0 20 -3 c0 -7 -6 -15 -16 -25 Z" transform="translate(-4 0)"/>',
    heart: '<path d="M20 34 C4 22 4 10 13 7 C18 5 20 10 20 10 C20 10 22 5 27 7 C36 10 36 22 20 34 Z"/>',
    diamond: '<path d="M20 2 L34 20 L20 38 L6 20 Z"/>',
    club: '<circle cx="20" cy="12" r="8"/><circle cx="11" cy="24" r="8"/><circle cx="29" cy="24" r="8"/><rect x="17" y="22" width="6" height="13"/>',
  };

  // Which reel symbol (from server/game.js SYMS) maps to which rank/suit.
  // Purely cosmetic — gameplay/probabilities are untouched on the server.
  const RANK_SUIT_MAP = {
    grape: { rank: "9", suit: "spade" },
    wine: { rank: "10", suit: "heart" },
    urn: { rank: "J", suit: "diamond" },
    vase: { rank: "Q", suit: "club" },
    gem: { rank: "K", suit: "spade" },
    crown: { rank: "A", suit: "heart" },
  };

  function suitSvg(suit, size) {
    return (
      '<svg viewBox="0 0 40 40" width="' + size + '" height="' + size + '" class="suit-icon">' +
      SUIT_PATH[suit] +
      "</svg>"
    );
  }

  function playingCardHTML(symbolKey) {
    const info = RANK_SUIT_MAP[symbolKey];
    if (!info) return "";
    const { rank, suit } = info;
    const isRed = suit === "heart" || suit === "diamond";
    return (
      '<div class="pcard pcard-' + (isRed ? "heart" : "spade") + '">' +
      '<span class="pcard-rank pcard-rank-tl">' + rank + "</span>" +
      '<span class="pcard-suit-tl">' + suitSvg(suit, 13) + "</span>" +
      '<span class="pcard-suit-center">' + suitSvg(suit, 32) + "</span>" +
      '<span class="pcard-suit-br">' + suitSvg(suit, 13) + "</span>" +
      '<span class="pcard-rank pcard-rank-br">' + rank + "</span>" +
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
    return { html: playingCardHTML(symbolKey), className: "card-face-wrap" };
  }

  function randomSymbolKey() {
    const keys = Object.keys(RANK_SUIT_MAP);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  window.CardArt = { cardFor, randomSymbolKey, RANK_SUIT_MAP };
})();