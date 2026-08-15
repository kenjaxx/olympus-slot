// cube.js
// Builds the 6-face 3D cube and animates it tumbling to land on a given
// color. This module never decides the outcome — main.js always calls
// roll(winningColor) with a color that already came back from the
// server's /api/color/roll response.

(function () {
  // Each color's static face transform, and the inverse container
  // rotation needed to bring that face to the front (facing the viewer).
  // Rotating a face's own transform value's negative brings it to 0deg,
  // i.e. facing forward. Extra multiples of 360deg (added in roll()) spin
  // the cube for show without changing the final resting orientation.
  const FACE_TARGET = {
    red:    { rx: 0,   ry: 0 },
    yellow: { rx: 0,   ry: -180 },
    blue:   { rx: 0,   ry: -90 },
    green:  { rx: 0,   ry: 90 },
    white:  { rx: -90, ry: 0 },
    pink:   { rx: 90,  ry: 0 },
  };

  let cubeEl = null;
  let currentRX = -18; // matches the CSS resting transform
  let currentRY = 0;

  function mount(container) {
    container.innerHTML =
      '<div class="cube-scene"><div class="cube" id="colorCube">' +
      '<div class="cube-face face-front">RED</div>' +
      '<div class="cube-face face-back">YELLOW</div>' +
      '<div class="cube-face face-right">BLUE</div>' +
      '<div class="cube-face face-left">GREEN</div>' +
      '<div class="cube-face face-top">WHITE</div>' +
      '<div class="cube-face face-bottom">PINK</div>' +
      "</div></div>";
    cubeEl = container.querySelector("#colorCube");
  }

  function randTurns() {
    return 2 + Math.floor(Math.random() * 3); // 2-4 extra full spins
  }

  function roll(winningColor) {
    return new Promise((resolve) => {
      if (!cubeEl || !FACE_TARGET[winningColor]) {
        resolve();
        return;
      }

      const target = FACE_TARGET[winningColor];
      const spinX = randTurns() * 360 * (Math.random() < 0.5 ? 1 : -1);
      const spinY = randTurns() * 360 * (Math.random() < 0.5 ? 1 : -1);

      currentRX = target.rx + spinX;
      currentRY = target.ry + spinY;

      cubeEl.classList.add("rolling");
      cubeEl.style.transform = "rotateX(" + currentRX + "deg) rotateY(" + currentRY + "deg)";

      let done = false;
      function finish() {
        if (done) return;
        done = true;
        cubeEl.classList.remove("rolling");
        cubeEl.removeEventListener("transitionend", finish);
        resolve();
      }

      cubeEl.addEventListener("transitionend", finish);
      // Safety timeout in case transitionend doesn't fire (e.g. reduced-motion)
      setTimeout(finish, 1900);
    });
  }

  function reset() {
    if (!cubeEl) return;
    currentRX = -18;
    currentRY = 0;
    cubeEl.style.transition = "none";
    cubeEl.style.transform = "rotateX(-18deg) rotateY(0deg)";
    void cubeEl.offsetWidth;
    cubeEl.style.transition = "";
  }

  window.ColorCube = { mount, roll, reset };
})();
