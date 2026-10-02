/**
 * AudioManager — every sound is synthesised with the Web Audio API, so the
 * game ships with zero audio files and no licensing questions.
 *
 *   audio.play('coin', { pitch: 1.2 })
 *   audio.setSoundEnabled(bool) / audio.setMusicEnabled(bool)
 *   audio.loadSample('coin', 'audio/coin.mp3')   // optional: replace a synth
 *
 * The context is created on the first user gesture (browser autoplay rules)
 * and suspended while the game is paused or hidden.
 */
(function (GR) {
  'use strict';

  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

  class AudioManager {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.soundOn = true;
      this.musicOn = true;
      this.samples = {};
      this.lastPlayed = {};
      this.noise = null;
      this.music = null;
    }

    /** Must be called from a user gesture (tap / click / key). */
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
          this.ctx = new AC();
        } catch (e) {
          return;
        }
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.soundOn ? 0.7 : 0;
        this.sfxGain.connect(this.master);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicOn ? 0.32 : 0;
        this.musicGain.connect(this.master);
        this.noise = this.makeNoise();
        this.music = new MusicLoop(this);
        if (this.musicOn) this.music.start();
        const files = (GR.CONFIG && GR.CONFIG.AUDIO_SAMPLES) || {};
        Object.keys(files).forEach((name) => this.loadSample(name, files[name]));
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    suspend() {
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    setSoundEnabled(on) {
      this.soundOn = on;
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.02);
    }

    setMusicEnabled(on) {
      this.musicOn = on;
      if (!this.ctx) return;
      this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.05);
      if (on) this.music.start();
      else this.music.stop();
    }

    setIntensity(level) {
      if (this.music) this.music.intensity = level;
    }

    /** Optional: replace a synthesised sound with an audio file. */
    loadSample(name, url) {
      if (!this.ctx) return Promise.resolve(false);
      return fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((decoded) => {
          this.samples[name] = decoded;
          return true;
        })
        .catch(() => false);
    }

    makeNoise() {
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    play(name, opts) {
      if (!this.ctx || !this.soundOn || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const minGap = name === 'coinTick' ? 0.045 : 0.025;
      if (this.lastPlayed[name] && now - this.lastPlayed[name] < minGap) return;
      this.lastPlayed[name] = now;
      if (this.samples[name]) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.samples[name];
        if (opts && opts.pitch) src.playbackRate.value = opts.pitch;
        src.connect(this.sfxGain);
        src.start();
        return;
      }
      const fn = SFX[name];
      if (fn) fn(this, now, opts || {});
    }

    // ---- synthesis building blocks ----

    tone(type, freq, start, dur, vol, freqEnd, dest) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, start);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.012, dur * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g);
      g.connect(dest || this.sfxGain);
      o.start(start);
      o.stop(start + dur + 0.02);
    }

    noiseBurst(start, dur, vol, filterType, f0, f1, dest) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType || 'lowpass';
      filter.frequency.setValueAtTime(f0, start);
      if (f1) filter.frequency.exponentialRampToValueAtTime(f1, start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(dest || this.sfxGain);
      src.start(start, Math.random() * 0.5);
      src.stop(start + dur + 0.02);
    }
  }

  /** Sound recipes. Each gets (audio, startTime, opts). */
  const SFX = {
    click: (a, t) => a.tone('triangle', 880, t, 0.06, 0.25, 1320),
    launch: (a, t) => {
      a.noiseBurst(t, 0.18, 0.35, 'bandpass', 700, 2600);
      a.tone('triangle', 260, t, 0.12, 0.2, 140);
    },
    grab: (a, t) => {
      a.tone('square', 330, t, 0.07, 0.12, 300);
      a.tone('square', 495, t + 0.005, 0.06, 0.08, 470);
      a.noiseBurst(t, 0.05, 0.25, 'highpass', 3000);
    },
    grabHeavy: (a, t) => {
      a.tone('sine', 110, t, 0.3, 0.5, 55);
      a.noiseBurst(t, 0.2, 0.4, 'lowpass', 900, 200);
    },
    reel: (a, t) => a.tone('square', 1700, t, 0.012, 0.025),
    coin: (a, t, o) => {
      const p = o.pitch || 1;
      a.tone('square', 988 * p, t, 0.07, 0.09);
      a.tone('square', 1319 * p, t + 0.07, 0.16, 0.09);
      a.tone('sine', 1319 * p, t + 0.07, 0.25, 0.12);
    },
    coinTick: (a, t) => a.tone('sine', 1760 + Math.random() * 300, t, 0.05, 0.06),
    diamond: (a, t, o) => {
      const p = o.pitch || 1;
      [76, 80, 83, 88].forEach((n, i) => a.tone('triangle', NOTE(n) * p, t + i * 0.055, 0.28, 0.16));
      a.noiseBurst(t + 0.1, 0.3, 0.06, 'highpass', 7000);
    },
    rock: (a, t) => {
      a.tone('sine', 150, t, 0.18, 0.4, 90);
      a.noiseBurst(t, 0.12, 0.25, 'lowpass', 600);
    },
    miss: (a, t) => a.tone('triangle', 300, t, 0.14, 0.08, 200),
    comboBreak: (a, t) => {
      a.tone('triangle', 520, t, 0.1, 0.12, 400);
      a.tone('triangle', 390, t + 0.09, 0.16, 0.12, 280);
    },
    combo: (a, t, o) => {
      const base = 72 + Math.min(10, (o.combo || 2) * 2);
      a.tone('square', NOTE(base), t, 0.06, 0.07);
      a.tone('square', NOTE(base + 7), t + 0.06, 0.12, 0.07);
    },
    explosion: (a, t) => {
      a.noiseBurst(t, 0.9, 0.9, 'lowpass', 2400, 120);
      a.tone('sine', 90, t, 0.6, 0.8, 30);
    },
    bag: (a, t) => [67, 71, 74, 79].forEach((n, i) => a.tone('triangle', NOTE(n), t + i * 0.05, 0.14, 0.13)),
    booster: (a, t) => {
      a.tone('sawtooth', 220, t, 0.35, 0.1, 880);
      a.tone('triangle', 440, t + 0.1, 0.3, 0.12, 1320);
    },
    freeze: (a, t) => [88, 91, 95, 100].forEach((n, i) => a.tone('sine', NOTE(n), t + i * 0.04, 0.5, 0.08)),
    tick: (a, t, o) => a.tone('square', o.last ? 1200 : 900, t, 0.04, 0.08),
    levelComplete: (a, t) => {
      [60, 64, 67, 72].forEach((n, i) => a.tone('square', NOTE(n), t + i * 0.1, 0.18, 0.1));
      [72, 76, 79].forEach((n) => a.tone('triangle', NOTE(n), t + 0.42, 0.7, 0.12));
    },
    levelFail: (a, t) => {
      [67, 63, 60].forEach((n, i) => a.tone('triangle', NOTE(n), t + i * 0.16, 0.3, 0.16));
      a.tone('sine', NOTE(48), t + 0.48, 0.7, 0.18);
    },
    upgrade: (a, t) => [60, 64, 67, 72, 76].forEach((n, i) => a.tone('triangle', NOTE(n), t + i * 0.05, 0.2, 0.13)),
    achievement: (a, t) => {
      [79, 83, 86].forEach((n, i) => a.tone('square', NOTE(n), t + i * 0.08, 0.14, 0.07));
      a.tone('triangle', NOTE(91), t + 0.24, 0.5, 0.12);
    },
    error: (a, t) => a.tone('square', 140, t, 0.16, 0.12, 110),
    star: (a, t, o) => a.tone('triangle', NOTE(76 + (o.i || 0) * 4), t, 0.25, 0.15),
  };

  /**
   * Tiny generative music loop: bass + plucked arpeggio + soft hats over a
   * four-chord progression, scheduled ahead with the audio clock.
   */
  class MusicLoop {
    constructor(audio) {
      this.audio = audio;
      this.timer = null;
      this.step = 0;
      this.nextTime = 0;
      this.intensity = 0; // 0 = menu, 1 = gameplay, 2 = last seconds
    }

    start() {
      if (this.timer) return;
      this.nextTime = this.audio.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 40);
    }

    stop() {
      clearInterval(this.timer);
      this.timer = null;
    }

    schedule() {
      const a = this.audio;
      if (!a.ctx || a.ctx.state !== 'running') return;
      const bpm = this.intensity >= 2 ? 132 : 108;
      const stepDur = 60 / bpm / 2; // eighth notes
      const chords = [
        [57, 60, 64, 69], // Am
        [53, 57, 60, 65], // F
        [48, 55, 60, 64], // C
        [55, 59, 62, 67], // G
      ];
      while (this.nextTime < a.ctx.currentTime + 0.2) {
        const t = this.nextTime;
        const bar = Math.floor(this.step / 8) % 4;
        const s = this.step % 8;
        const chord = chords[bar];
        const dest = a.musicGain;
        if (s === 0 || s === 4 || (s === 6 && this.intensity > 0)) {
          a.tone('triangle', NOTE(chord[0] - 12), t, stepDur * 1.8, 0.32, null, dest);
        }
        const arp = [0, 1, 2, 3, 2, 1, 3, 2][s];
        if (this.intensity > 0 || s % 2 === 0) {
          a.tone('square', NOTE(chord[arp] + 12), t, stepDur * 0.9, 0.05, null, dest);
        }
        if (this.intensity > 0 && s % 2 === 1) a.noiseBurst(t, 0.03, 0.06, 'highpass', 8000, null, dest);
        this.nextTime += stepDur;
        this.step++;
      }
    }
  }

  GR.AudioManager = AudioManager;
})((window.GR = window.GR || {}));
