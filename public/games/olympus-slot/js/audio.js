// audio.js
// Web Audio tones (no audio files needed) + a speech-synthesis announcer,
// plus a jolly background music loop.
//
// IMPORTANT: mute only affects the background MUSIC. All sound effects
// (reel ticks, tumble hits, multiplier stingers, scatter cues, win
// chimes/fanfares, the spoken announcer lines, and haptics) always play,
// regardless of mute state — playTone() itself has no mute check at all;
// only the music scheduler checks `musicMuted` before calling it.
//
// AudioContext is created lazily on first sound (browser autoplay rules
// require a user gesture first) — main.js kicks this off on the player's
// first click on the game page.

(function () {
  let audioCtx = null;
  let musicMuted = false;
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

  // No mute check in here on purpose — this is shared by both sound
  // effects (always on) and music (gated by the caller, see the music
  // section below).
  function playTone({ freq = 440, duration = 0.15, type = "sine", volume = 0.15, delay = 0, glideTo = null }) {
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

  // Haptics are a sound-effect-adjacent cue, not music — always active.
  function vibrate(pattern) {
    if (!("vibrate" in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch (err) {
      // Some browsers throw if called outside a user-gesture context.
    }
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

  // The announcer voice is a sound effect, not music — always active.
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      pendingText = text;
      return;
    }
    speakNow(text);
  }

  function playReelStopTick(index) {
    playTone({ freq: 300 + index * 20, duration: 0.08, type: "square", volume: 0.08 });
    vibrate(8);
  }

  function playTumbleHit(comboIndex) {
    const base = 440 + comboIndex * 60;
    playTone({ freq: base, duration: 0.18, type: "triangle", volume: 0.14, glideTo: base * 1.3 });
    vibrate(15);
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
    vibrate([10, 30, 10, 30]);
    setTimeout(() => speak(runningTotal + " times!"), steps * 50 + 80);
  }

  function playScatterTease() {
    playTone({ freq: 220, duration: 0.5, type: "sawtooth", volume: 0.08, glideTo: 340 });
    vibrate(25);
  }

  function playScatterTrigger() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => playTone({ freq: f, duration: 0.28, type: "sine", volume: 0.16, delay: i * 0.09 }));
    vibrate([20, 40, 20, 40, 60]);
  }

  function playBellRing(freeSpinsAwarded) {
    const notes = [1046.5, 1318.5, 1568, 2093];
    notes.forEach((f, i) => {
      playTone({ freq: f, duration: 0.9, type: "sine", volume: 0.14, delay: i * 0.1, glideTo: f * 0.985 });
      playTone({ freq: f * 2, duration: 0.5, type: "sine", volume: 0.05, delay: i * 0.1 });
    });
    vibrate([30, 60, 30, 60, 30, 100]);
    const count = Number.isFinite(freeSpinsAwarded) ? freeSpinsAwarded : 10;
    setTimeout(() => speak(`Free spins! You have ${count} free spins!`), 350);
  }

  function playWinChime() {
    [660, 880].forEach((f, i) => playTone({ freq: f, duration: 0.2, type: "sine", volume: 0.15, delay: i * 0.07 }));
    vibrate(20);
  }

  function playBigWinFanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => playTone({ freq: f, duration: 0.3, type: "sawtooth", volume: 0.12, delay: i * 0.12 }));
    vibrate([40, 60, 40, 60, 80]);
    setTimeout(() => speak("Big win!"), 250);
  }

  function playPopBurst(count) {
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
    vibrate([30, 50, 30, 50, 30, 50]);
    setTimeout(() => speak("Total win!"), notes.length * 150 + 350);
  }

  // -----------------------------------------------------------------
  // Background music — a bright, bouncy circus/carnival-style loop.
  // This is the ONLY thing the mute toggle controls. `musicMuted` is
  // checked here, before each note — playTone itself is never gated.
  // -----------------------------------------------------------------
  const TEMPO_BPM = 130;
  const BEAT_SEC = 60 / TEMPO_BPM;
  const EIGHTH_SEC = BEAT_SEC / 2;

  const NOTE = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5,
  };

  const PHRASE_A = [
    NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6,
    NOTE.C6, NOTE.G5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5,
  ];
  const PHRASE_B = [
    NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.E5, NOTE.G5,
    NOTE.F5, NOTE.A5, NOTE.G5, NOTE.F5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.D5,
  ];
  const BASSLINE = [
    NOTE.C4, null, NOTE.G4, null, NOTE.C4, null, NOTE.F4, null,
    NOTE.C4, null, NOTE.G4, null, NOTE.F4, null, NOTE.G4, null,
  ];

  let musicRunning = false;
  let musicTimer = null;
  let phraseToggle = false;

  function playMusicStep(freq, isBass) {
    if (musicMuted) return;
    if (freq == null) return;
    if (isBass) {
      playTone({ freq: freq / 2, duration: BEAT_SEC * 0.9, type: "sine", volume: 0.05 });
    } else {
      playTone({ freq, duration: EIGHTH_SEC * 0.85, type: "triangle", volume: 0.075 });
      if (Math.random() < 0.3) {
        playTone({ freq: freq * 2, duration: EIGHTH_SEC * 0.4, type: "sine", volume: 0.02 });
      }
    }
  }

  function scheduleMusicPhrase() {
    if (!musicRunning) return;
    const phrase = phraseToggle ? PHRASE_B : PHRASE_A;
    phraseToggle = !phraseToggle;

    phrase.forEach((freq, i) => {
      const atMs = i * EIGHTH_SEC * 1000;
      setTimeout(() => playMusicStep(freq, false), atMs);
      setTimeout(() => playMusicStep(BASSLINE[i], true), atMs);
    });

    musicTimer = setTimeout(scheduleMusicPhrase, phrase.length * EIGHTH_SEC * 1000);
  }

  function startBackgroundMusic() {
    if (musicRunning) return;
    musicRunning = true;
    phraseToggle = false;
    scheduleMusicPhrase();
  }

  function stopBackgroundMusic() {
    musicRunning = false;
    clearTimeout(musicTimer);
    musicTimer = null;
  }

  // Controls ONLY the music — sound effects, haptics, and speech are
  // unaffected by this.
  function setMuted(value) {
    musicMuted = value;
  }

  function isMuted() {
    return musicMuted;
  }

  window.Sound = {
    speak,
    vibrate,
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
    startBackgroundMusic,
    stopBackgroundMusic,
    setMuted,
    isMuted,
  };
})();