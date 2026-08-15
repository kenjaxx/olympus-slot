// cube.js
// Renders three tumbling dice that roll onto a wooden table and land
// inside an open, teal treasure-box tray — a decorative flourish wrapped
// around the actual result. This module never decides the outcome:
// main.js always calls roll(winningColor) with a color that already
// came back from the server's /api/color/roll response.
//
// The CENTER die always lands on the winning color, so it's a direct,
// glanceable readout of the round's result. The two side dice land on
// independently-random colors purely for visual flavor (real dice in a
// tray rarely land uniform), and are re-randomized on every roll.
//
// Every die rests at a fixed isometric tilt (BASE_TILT_X/Y) on top of
// whatever rotation brings its winning face to the front — so you
// always see the top edge and a side edge of the cube, like a real die
// sitting on a table, instead of a single face viewed dead-on (which
// just reads as a flat colored square).

(function () {
  const COLORS = ["red", "yellow", "blue", "green", "white", "pink"];

  const BASE_TILT_X = -16;
  const BASE_TILT_Y = 24;

  // Each color's static face transform, and the inverse rotation needed
  // to bring that face to the front (facing the viewer). Extra multiples
  // of 360deg (added per roll) spin the die for show without changing
  // its final resting orientation; BASE_TILT is added on top so the cube
  // never rests perfectly square-on to the camera.
  const FACE_TARGET = {
    red:    { rx: 0,   ry: 0 },
    yellow: { rx: 0,   ry: -180 },
    blue:   { rx: 0,   ry: -90 },
    green:  { rx: 0,   ry: 90 },
    white:  { rx: -90, ry: 0 },
    pink:   { rx: 90,  ry: 0 },
  };

  // Resting layout of the 3 dice inside the tray: lateral offset (px),
  // depth offset (translateZ, for a bit of front/back stagger) and a
  // small resting spin so they don't all look robotically identical —
  // matches how real thrown dice settle touching each other.
  const DIE_LAYOUT = [
    { dx: -30, dz: -6,  tilt: -9 },
    { dx: 0,   dz: 10,  tilt: 5  },
    { dx: 30,  dz: -10, tilt: -4 },
  ];

  let dice = []; // { el, rx, ry } current rotation state per die
  let boxEl = null;

  function randomColor(exclude) {
    let c;
    do {
      c = COLORS[Math.floor(Math.random() * COLORS.length)];
    } while (c === exclude && COLORS.length > 1);
    return c;
  }

  function faceHTML() {
    return (
      '<div class="die-face face-front"></div>' +
      '<div class="die-face face-back"></div>' +
      '<div class="die-face face-right"></div>' +
      '<div class="die-face face-left"></div>' +
      '<div class="die-face face-top"></div>' +
      '<div class="die-face face-bottom"></div>'
    );
  }

  function mount(container) {
    container.innerHTML =
      '<div class="dice-lane">' +
        '<div class="table-surface"></div>' +
        '<div class="table-shadow"></div>' +
        '<div class="dice-box" id="diceBox">' +
          '<div class="box-lid"><div class="lid-handle"></div></div>' +
          '<div class="box-tray">' +
            '<div class="tray-shine"></div>' +
            '<div class="die" id="die0">' + faceHTML() + "</div>" +
            '<div class="die" id="die1">' + faceHTML() + "</div>" +
            '<div class="die" id="die2">' + faceHTML() + "</div>" +
          "</div>" +
          '<div class="box-rim-front"></div>' +
        "</div>" +
        '<div class="table-edge"></div>' +
      "</div>";

    boxEl = container.querySelector("#diceBox");
    dice = [0, 1, 2].map((i) => ({
      el: container.querySelector("#die" + i),
      rx: -18,
      ry: 0,
    }));

    reset();
  }

  function randTurns() {
    return 2 + Math.floor(Math.random() * 3); // 2-4 extra full spins
  }

  // Positions every die just above/behind the lid, mid-tumble and half
  // transparent, ready to be animated "down onto the table" by roll().
  function reset() {
    if (!dice.length) return;
    dice.forEach((d, i) => {
      const layout = DIE_LAYOUT[i];
      d.el.style.transition = "none";
      d.el.style.opacity = "0";
      d.el.classList.remove("rolling", "landed");
      d.rx = -60 + Math.random() * 40;
      d.ry = Math.random() * 360;
      d.el.style.transform =
        "translate3d(" + layout.dx + "px, -150px, " + (layout.dz - 40) + "px) " +
        "rotateX(" + d.rx + "deg) rotateY(" + d.ry + "deg) scale(0.7)";
      void d.el.offsetWidth; // force reflow so the next transform actually transitions
      d.el.style.opacity = "1";
    });
    if (boxEl) boxEl.classList.remove("impact");
  }

  function roll(winningColor) {
    return new Promise((resolve) => {
      if (!dice.length) {
        resolve();
        return;
      }

      const results = [
        randomColor(winningColor),
        winningColor, // center die always shows the real result
        randomColor(winningColor),
      ];

      const promises = dice.map((d, i) => {
        const layout = DIE_LAYOUT[i];
        const target = FACE_TARGET[results[i]] || FACE_TARGET.red;
        const spinX = randTurns() * 360 * (Math.random() < 0.5 ? 1 : -1);
        const spinY = randTurns() * 360 * (Math.random() < 0.5 ? 1 : -1);

        d.rx = target.rx + spinX + BASE_TILT_X;
        d.ry = target.ry + spinY + BASE_TILT_Y;

        return new Promise((res) => {
          d.el.classList.add("rolling");

          requestAnimationFrame(() => {
            d.el.style.transition =
              "transform 1.05s cubic-bezier(0.22, 0.9, 0.28, 1.1), opacity 0.3s ease";
            d.el.style.transform =
              "translate3d(" + layout.dx + "px, 0px, " + layout.dz + "px) " +
              "rotateX(" + d.rx + "deg) rotateY(" + d.ry + "deg) rotateZ(" + layout.tilt + "deg) scale(1)";
          });

          let done = false;
          function finish() {
            if (done) return;
            done = true;
            d.el.classList.remove("rolling");
            d.el.classList.add("landed");
            d.el.removeEventListener("transitionend", onEnd);
            res();
          }
          function onEnd(e) {
            if (e.propertyName === "transform") finish();
          }
          d.el.addEventListener("transitionend", onEnd);
          // Safety net in case transitionend never fires (e.g. reduced motion).
          setTimeout(finish, 1300);
        });
      });

      Promise.all(promises).then(() => {
        if (boxEl) {
          boxEl.classList.remove("impact");
          void boxEl.offsetWidth;
          boxEl.classList.add("impact");
        }
        setTimeout(resolve, 120);
      });
    });
  }

  window.ColorCube = { mount, roll, reset };
})();