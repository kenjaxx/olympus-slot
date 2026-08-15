// intro.js
// Drives the loading -> instructions -> start flow for this game's landing
// page. The "loading" is simulated progress (there's nothing heavy to
// actually preload here), then the instructions screen fades in. Clicking
// "Start Game" sends the player into the real game at index.html.

(function () {
  const loadingScreen = document.getElementById("loadingScreen");
  const introScreen = document.getElementById("introScreen");
  const barFill = document.getElementById("loadingBarFill");
  const statusEl = document.getElementById("loadingStatus");
  const startBtn = document.getElementById("startGameBtn");

  const STATUS_STEPS = [
    "Loading assets…",
    "Warming up the reels…",
    "Polishing the gold…",
    "Almost there…",
  ];

  let progress = 0;
  let statusIndex = 0;

  function tick() {
    // Random-ish increments so the bar doesn't feel mechanically linear.
    progress = Math.min(100, progress + 6 + Math.random() * 14);
    barFill.style.width = progress + "%";

    const targetStatusIndex = Math.min(
      STATUS_STEPS.length - 1,
      Math.floor((progress / 100) * STATUS_STEPS.length)
    );
    if (targetStatusIndex !== statusIndex) {
      statusIndex = targetStatusIndex;
      statusEl.textContent = STATUS_STEPS[statusIndex];
    }

    if (progress < 100) {
      setTimeout(tick, 140 + Math.random() * 120);
    } else {
      setTimeout(finishLoading, 220);
    }
  }

  function finishLoading() {
    loadingScreen.classList.add("fade-out");
    setTimeout(() => {
      loadingScreen.style.display = "none";
      introScreen.classList.add("show");
    }, 400);
  }

  startBtn.addEventListener("click", () => {
    startBtn.disabled = true;
    startBtn.textContent = "Entering…";
    window.location.href = "index.html";
  });

  setTimeout(tick, 200);
})();