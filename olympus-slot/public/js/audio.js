// audio.js
// Web Audio tones (no audio files needed) + a speech-synthesis announcer.
// AudioContext is created lazily on first spin (browser autoplay rules
// require a user gesture first).

(function () {
  let audioCtx = null;
  let muted = false;
  let chosenVoice = null;
  let userPickedVoice = false;

  // Heuristic shortlist of voice names that tend to sound warm/upbeat
  // across common browsers/OSes. Falls back to any English voice, and the
  // person can always override via the voice dropdown in the header.
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

  function speak(text) {
    if (muted) return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); // avoid overlapping queued lines
    const utter = new SpeechSynthesisUtterance(text);
    if (chosenVoice) utter.voice = chosenVoice;
    // Slightly faster + higher pitch reads as upbeat/excited rather than flat.
    utter.rate = 1.15;
    utter.pitch = 1.2;
    utter.volume = 0.9;
    window.speechSynthesis.speak(utter);
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
    setTimeout(() => speak("Free spins!"), 200);
  }

  function playWinChime() {
    [660, 880].forEach((f, i) => playTone({ freq: f, duration: 0.2, type: "sine", volume: 0.15, delay: i * 0.07 }));
  }

  function playBigWinFanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => playTone({ freq: f, duration: 0.3, type: "sawtooth", volume: 0.12, delay: i * 0.12 }));
    setTimeout(() => speak("Big win!"), 250);
  }

  function setMuted(value) {
    muted = value;
    if (muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
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
    playWinChime,
    playBigWinFanfare,
    setMuted,
    isMuted,
  };
})();
