// cube.js
// Renders three tumbling dice that fall onto a wooden table and land
// inside an open, teal treasure-box tray — a decorative flourish wrapped
// around the actual result.
//
// IMPORTANT: all three dice show the REAL server-decided colors. main.js/
// color.js always call roll([colorA, colorB, colorC]) with the exact
// array that came back from the server's /api/color/roll response.
//
// ---------------------------------------------------------------------
// BOUNCE PHYSICS
// ---------------------------------------------------------------------
// Instead of one straight "fly from the lid to the final pose" transition,
// each die now falls under gravity, bounces off the tray floor 3 times
// with decreasing peak height, and settles on the target face. This is
// done with a chain of short CSS transitions (no physics engine needed):
//   - "down" phases use an accelerating easing curve (gravity pulling it
//     toward the floor)
//   - "up" phases use a decelerating easing curve (arcing up and slowing
//     at the peak, like a real bounce)
//   - each phase also nudges the die's rotation further toward its final
//     target face, so the spin visibly slows down as the bounces get
//     smaller — the die looks like it's "deciding" on a face instead of
//     just being teleported onto one
//   - each phase carries its own scale(x, y) so the die squashes flat on
//     impact and stretches slightly as it launches upward, all baked
//     into the single transform string per phase (no separate keyframe
//     animation fighting with the transition)
// Every impact also triggers a tray shake, biggest on the first (real)
// landing and progressively smaller on each following bounce.

(function () {
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

  // Easing curves used for the bounce arcs.
  const EASE_FALL = "cubic-bezier(0.55, 0.06, 0.9, 0.45)"; // accelerating — gravity pulling down
  const EASE_RISE  = "cubic-bezier(0.16, 1, 0.3, 1)";        // decelerating — arcing up to a peak

  // The bounce sequence itself: each entry is one CSS-transition step.
  //   y     — vertical offset from rest (negative = up in the air, small
  //           positive = a brief "into the floor" impact squash)
  //   frac  — how far (0-1) along the die's total rotation this step
  //           should have reached by the time it completes
  //   dur   — duration of this step, ms
  //   ease  — which easing curve to use
  //   sx/sy — squash/stretch scale applied for this step
  const BOUNCE_PHASES = [
    { y: 6,   frac: 0.25, dur: 340, ease: EASE_FALL, sx: 1.14, sy: 0.80 }, // fall + 1st impact
    { y: -62, frac: 0.45, dur: 210, ease: EASE_RISE, sx: 0.94, sy: 1.06 }, // bounce 1 rise
    { y: 5,   frac: 0.60, dur: 190, ease: EASE_FALL, sx: 1.10, sy: 0.86 }, // bounce 1 impact
    { y: -30, frac: 0.76, dur: 155, ease: EASE_RISE, sx: 0.96, sy: 1.04 }, // bounce 2 rise
    { y: 4,   frac: 0.86, dur: 140, ease: EASE_FALL, sx: 1.07, sy: 0.90 }, // bounce 2 impact
    { y: -11, frac: 0.94, dur: 115, ease: EASE_RISE, sx: 0.98, sy: 1.02 }, // bounce 3 rise
    { y: 0,   frac: 1.00, dur: 130, ease: EASE_FALL, sx: 1.00, sy: 1.00 }, // settle
  ];

  // Which phase indices above end with the die hitting the tray floor,
  // and how hard the tray should shake for each (biggest on the first
  // real landing, tapering off).
  const IMPACT_PHASE_INDEXES = [0, 2, 4, 6];
  const IMPACT_MAGNITUDES = [1, 0.55, 0.3, 0.4]; // last = the final settle thud

  const STAGGER_MS = 45; // slight per-die start delay so all 3 don't land in lockstep

  let dice = []; // { el, rx, ry } current rotation state per die
  let boxEl = null;

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

  function safeVibrate(pattern) {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch (err) {
      // Some browsers throw if called outside a user-gesture context.
    }
  }

  // Positions every die just above/behind the lid, mid-tumble and half
  // transparent, ready to be dropped and bounced by roll().
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

  function buildTransform(dx, y, dz, rx, ry, tilt, sx, sy) {
    return (
      "translate3d(" + dx + "px, " + y + "px, " + dz + "px) " +
      "rotateX(" + rx + "deg) rotateY(" + ry + "deg) rotateZ(" + tilt + "deg) " +
      "scale(" + sx + ", " + sy + ")"
    );
  }

  // Runs one CSS-transition step on a die and resolves once it lands
  // (via transitionend, with a timeout fallback in case the transition
  // never fires — e.g. reduced-motion environments).
  function stepTransform(el, transformStr, duration, easing) {
    return new Promise((resolve) => {
      el.style.transition = "transform " + duration + "ms " + easing;

      requestAnimationFrame(() => {
        el.style.transform = transformStr;
      });

      let done = false;
      function finish(e) {
        if (done) return;
        if (e && e.propertyName && e.propertyName !== "transform") return;
        done = true;
        el.removeEventListener("transitionend", finish);
        resolve();
      }
      el.addEventListener("transitionend", finish);
      setTimeout(finish, duration + 90);
    });
  }

  // Shakes the tray — magnitude scales a CSS custom property the
  // trayImpact keyframe reads, so the same animation can be reused at
  // different intensities for each bounce.
  function triggerTrayImpact(magnitude) {
    if (!boxEl) return;
    boxEl.style.setProperty("--impact-mag", magnitude);
    boxEl.classList.remove("impact");
    void boxEl.offsetWidth; // restart animation
    boxEl.classList.add("impact");
  }

  // Runs the full fall -> bounce -> bounce -> bounce -> settle sequence
  // for a single die, landing exactly on `colorResult`'s face.
  async function animateDieBounce(d, index, colorResult) {
    const layout = DIE_LAYOUT[index];
    const target = FACE_TARGET[colorResult] || FACE_TARGET.red;

    const spinX = randTurns() * 360 * (Math.random() < 0.5 ? 1 : -1);
    const spinY = randTurns() * 360 * (Math.random() < 0.5 ? 1 : -1);

    const startRx = d.rx;
    const startRy = d.ry;
    const finalRx = target.rx + spinX + BASE_TILT_X;
    const finalRy = target.ry + spinY + BASE_TILT_Y;

    function rotAtFraction(fraction) {
      return {
        rx: startRx + (finalRx - startRx) * fraction,
        ry: startRy + (finalRy - startRy) * fraction,
      };
    }

    d.el.classList.add("rolling");

    if (index > 0) {
      await new Promise((r) => setTimeout(r, index * STAGGER_MS));
    }

    for (let p = 0; p < BOUNCE_PHASES.length; p++) {
      const phase = BOUNCE_PHASES[p];
      const rot = rotAtFraction(phase.frac);
      const transformStr = buildTransform(
        layout.dx, phase.y, layout.dz,
        rot.rx, rot.ry, layout.tilt,
        phase.sx, phase.sy
      );

      await stepTransform(d.el, transformStr, phase.dur, phase.ease);

      const impactIdx = IMPACT_PHASE_INDEXES.indexOf(p);
      if (impactIdx !== -1) {
        triggerTrayImpact(IMPACT_MAGNITUDES[impactIdx]);
        safeVibrate(impactIdx === 0 ? 18 : 8);
      }
    }

    d.rx = finalRx;
    d.ry = finalRy;
    d.el.classList.remove("rolling");
    d.el.classList.add("landed");
  }

  // diceColors: an array of exactly 3 color keys, in order, already
  // decided by the server — one per die. This is the real game result;
  // nothing here is randomized for show except the bounce choreography.
  function roll(diceColors) {
    return new Promise((resolve) => {
      if (!dice.length) {
        resolve();
        return;
      }

      const results =
        Array.isArray(diceColors) && diceColors.length === 3
          ? diceColors
          : ["red", "red", "red"]; // defensive fallback only — should never actually trigger

      const diePromises = dice.map((d, i) => animateDieBounce(d, i, results[i]));

      Promise.all(diePromises).then(() => {
        setTimeout(resolve, 120);
      });
    });
  }

  window.ColorCube = { mount, roll, reset };
})();