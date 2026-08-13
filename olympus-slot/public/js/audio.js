// audio.js
// Web Audio tones (no audio files needed) + a speech-synthesis announcer.
// AudioContext is created lazily on first spin (browser autoplay rules
// require a user gesture first).
//
// Speech is queued rather than interrupted: calling speak() while a line is
// already playing used to call speechSynthesis.cancel(), which chopped off
// whatever was currently being said (e.g. "6x" got killed mid-word the
// instant "Big win!" fired right after it). Now the currently-playing line
// always finishes; only the next *pending* line gets replaced, so during a
// fast autospin session the queue never backs up into a long ramble either.

(function () {
  let audioCtx = null;
  let muted = false;
  let chosenVoice = null;
  let userPickedVoice = false;

  let speaking = false;
  let pendingText = null;

  const PREFERRED_VOICE_HINTS = [
    "Google US English",
    "Samantha",
    "Victoria",
    "Ava",
    "Aria",
    "Jenny",
    "Zira",
    "Female",
    "Google UK English Female",
  ];

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playTone({ freq = 440, duration = 0.15, type = "sine", volume = 0.15, delay = 0, glideTo = null }) {
    if (muted) return;
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (glideTo) {
      osc.frequency.linearRampToValueAtTime(glideTo, ctx.currentTime + delay + duration);
    }
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  }

  function pickBestVoice(voices) {
    for (const hint of PREFERRED_VOICE_HINTS) {
      const match = voices.find((v) => v.name.indexOf(hint) !== -1);
      if (match) return match;
    }
    return voices.find((v) => v.lang && v.lang.indexOf("en") === 0) || voices[0] || null;
  }

  function populateVoiceSelect(voices) {
    const sel = document.getElementById("voiceSelect");
    if (!sel || sel.dataset.filled) return;
    voices
      .filter((v) => !v.lang || v.lang.indexOf("en") === 0)
      .forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = v.name;
        sel.appendChild(opt);
      });
    sel.dataset.filled = "1";
    sel.addEventListener("change", () => {
      if (!sel.value) {
        userPickedVoice = false;
        chosenVoice = pickBestVoice(window.speechSynthesis.getVoices());
        return;
      }
      const voices2 = window.speechSynthesis.getVoices();
      chosenVoice = voices2.find((v) => v.name === sel.value) || chosenVoice;
      userPickedVoice = true;
    });
  }

  function refreshVoices() {
    if (!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    populateVoiceSelect(voices);
    if (!userPickedVoice) chosenVoice = pickBestVoice(voices);
  }

  if ("speechSynthesis" in window) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  function speakNow(text) {
    const utter = new SpeechSynthesisUtterance(text);
    if (chosenVoice) utter.voice = chosenVoice;
    // Slower than the very first version — 1.15 read as rushed/clipped on
    // lines like "Big win!". 0.92 stays upbeat but is actually intelligible.
    utter.rate = 0.92;
    utter.pitch = 1.15;
    utter.volume = 0.9;

    speaking = true;
    const advance = () => {
      speaking = false;
      if (pendingText) {
        const next = pendingText;
        pendingText = null;
        speakNow(next);
      }
    };
    utter.onend = advance;
    utter.onerror = advance;

    window.speechSynthesis.speak(utter);
  }

  // Queues a line to be spoken. If something is already playing, this line
  // just becomes "next up" (replacing any previous pending line) — it never
  // interrupts what's currently being said.
  function speak(text) {
    if (muted) return;
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      pendingText = text;
      return;
    }
    speakNow(text);
  }

  function playReelStopTick(index) {
    playTone({ freq: 300 + index * 20, duration: 0.08, type: "square", volume: 0.08 });
  }

  function playTumbleHit(comboIndex) {
    const base = 440 + comboIndex * 60;
    playTone({ freq: base, duration: 0.18, type: "triangle", volume: 0.14, glideTo: base * 1.3 });
  }

  function playMultiplierHit(orbValue, runningTotal) {
    const steps = Math.min(6, Math.max(2, Math.round(orbValue / 3)));
    for (let s = 0; s < steps; s++) {
      playTone({
        freq: 500 + s * 90 + orbValue * 4,
        duration: 0.12,
        type: "square",
        volume: 0.13,
        delay: s * 0.05,
      });
    }
    setTimeout(() => speak(runningTotal + " times!"), steps * 50 + 80);
  }

  function playScatterTease() {
    playTone({ freq: 220, duration: 0.5, type: "sawtooth", volume: 0.08, glideTo: 340 });
  }

  function playScatterTrigger() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => playTone({ freq: f, duration: 0.28, type: "sine", volume: 0.16, delay: i * 0.09 }));
  }

  // Bright, ringing bell-like chord used when the free-spins TRIGGER
  // overlay appears — distinct from playScatterTrigger's quick chime so
  // the big "you won free spins" moment feels like its own event.
  function playBellRing(freeSpinsAwarded) {
    const notes = [1046.5, 1318.5, 1568, 2093];
    notes.forEach((f, i) => {
      playTone({ freq: f, duration: 0.9, type: "sine", volume: 0.14, delay: i * 0.1, glideTo: f * 0.985 });
      playTone({ freq: f * 2, duration: 0.5, type: "sine", volume: 0.05, delay: i * 0.1 });
    });
    const count = Number.isFinite(freeSpinsAwarded) ? freeSpinsAwarded : 10;
    setTimeout(() => speak(`Free spins! You have ${count} free spins!`), 350);
  }

  function playWinChime() {
    [660, 880].forEach((f, i) => playTone({ freq: f, duration: 0.2, type: "sine", volume: 0.15, delay: i * 0.07 }));
  }

  function playBigWinFanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => playTone({ freq: f, duration: 0.3, type: "sawtooth", volume: 0.12, delay: i * 0.12 }));
    setTimeout(() => speak("Big win!"), 250);
  }

  function playPopBurst(count) {
    if (muted) return;
    const n = Math.min(6, count);
    for (let i = 0; i < n; i++) {
      playTone({
        freq: 700 + Math.random() * 500,
        duration: 0.06,
        type: "square",
        volume: 0.08,
        delay: i * 0.02,
      });
    }
  }

  function playSuspenseBuildup(duration) {
    if (muted) return;
    const steps = Math.max(3, Math.floor(duration / 90));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      playTone({
        freq: 130 + t * 300,
        duration: 0.08,
        type: "triangle",
        volume: 0.05 + t * 0.09,
        delay: (s * duration) / 1000 / steps,
      });
    }
  }

  function playFreeSpinTotalFanfare() {
    const notes = [392, 523, 659, 784, 988, 1175];
    notes.forEach((f, i) => playTone({ freq: f, duration: 0.35, type: "sawtooth", volume: 0.13, delay: i * 0.15 }));
    setTimeout(() => speak("Total win!"), notes.length * 150 + 350);
  }

  function setMuted(value) {
    muted = value;
    if (muted && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      speaking = false;
      pendingText = null;
    }
  }

  function isMuted() {
    return muted;
  }

  window.Sound = {
    speak,
    playReelStopTick,
    playTumbleHit,
    playMultiplierHit,
    playScatterTease,
    playScatterTrigger,
    playBellRing,
    playWinChime,
    playBigWinFanfare,
    playPopBurst,
    playSuspenseBuildup,
    playFreeSpinTotalFanfare,
    setMuted,
    isMuted,
  };
})();