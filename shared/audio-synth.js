/**
 * Web Audio Synthesizer for Pomodoro Focus Pro
 * Provides rich, zero-dependency procedural chimes, bells, alerts, and ambient audio.
 */

class AudioSynth {
  constructor() {
    this.ctx = null;
    this.ambientSource = null;
    this.ambientGain = null;
    this.ambientInterval = null;
    this.currentAmbientType = null;
  }

  async getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn('AudioContext resume error:', e);
      }
    }
    return this.ctx;
  }

  /**
   * Plays a notification alert sound
   * @param {string} soundType - 'bell' | 'marimba' | 'chime' | 'digital' | 'zen'
   * @param {number} volume - 0 to 100
   */
  async playAlert(soundType = 'bell', volume = 80) {
    try {
      const ctx = await this.getAudioContext();
      const masterGain = ctx.createGain();
      const vol = Math.max(0, Math.min(1, volume / 100));
      masterGain.gain.setValueAtTime(vol, ctx.currentTime);
      masterGain.connect(ctx.destination);

      switch (soundType) {
        case 'marimba':
          this._playMarimba(ctx, masterGain);
          break;
        case 'chime':
          this._playChime(ctx, masterGain);
          break;
        case 'digital':
          this._playDigital(ctx, masterGain);
          break;
        case 'zen':
          this._playZenGong(ctx, masterGain);
          break;
        case 'bell':
        default:
          this._playBell(ctx, masterGain);
          break;
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Harmonic Bell / Singing Bowl
  _playBell(ctx, dest) {
    const now = ctx.currentTime;
    const freqs = [587.33, 1174.66, 1762.0, 2349.3]; // D5 and harmonics
    const weights = [0.6, 0.25, 0.1, 0.05];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(weights[i], now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 2.5);
    });
  }

  // Marimba 2-note melody
  _playMarimba(ctx, dest) {
    const notes = [
      { f: 523.25, t: 0.0 }, // C5
      { f: 659.25, t: 0.15 }, // E5
      { f: 783.99, t: 0.30 }, // G5
      { f: 1046.50, t: 0.45 }, // C6
    ];

    notes.forEach((note) => {
      const startTime = ctx.currentTime + note.t;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, startTime);

      gain.gain.setValueAtTime(0.7, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  }

  // Rising crystalline chime
  _playChime(ctx, dest) {
    const chords = [
      { f: 523.25, delay: 0.0 },  // C5
      { f: 659.25, delay: 0.18 }, // E5
      { f: 783.99, delay: 0.36 }, // G5
      { f: 1046.50, delay: 0.54 } // C6
    ];

    chords.forEach(({ f, delay }) => {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(t);
      osc.stop(t + 1.8);
    });
  }

  // Digital dual-beep
  _playDigital(ctx, dest) {
    [0.0, 0.16].forEach((delay) => {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t); // A5

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.setValueAtTime(0.0, t + 0.09);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  // Deep resonant Zen gong
  _playZenGong(ctx, dest) {
    const now = ctx.currentTime;
    const baseFreq = 146.83; // D3
    const harmonics = [1, 2.76, 5.4, 8.9];
    const decays = [3.5, 2.2, 1.4, 0.8];
    const amps = [0.7, 0.3, 0.15, 0.08];

    harmonics.forEach((h, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * h, now);

      gain.gain.setValueAtTime(amps[i], now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + decays[i]);
    });
  }

  /**
   * Ambient Focus Sounds
   * @param {string} type - 'none' | 'whitenoise' | 'rain' | 'ticking'
   * @param {number} volume - 0 to 100
   */
  async startAmbient(type = 'none', volume = 30) {
    this.stopAmbient();
    if (!type || type === 'none') return;

    try {
      const ctx = await this.getAudioContext();
      this.currentAmbientType = type;
      const vol = Math.max(0, Math.min(1, volume / 100)) * 0.4;

      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.setValueAtTime(vol, ctx.currentTime);
      this.ambientGain.connect(ctx.destination);

      if (type === 'whitenoise' || type === 'rain') {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (type === 'rain') {
            // Brown/Pink filter for gentle soothing rain
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5;
          } else {
            // Soft pink/white noise
            output[i] = (lastOut + (0.05 * white)) / 1.05;
            lastOut = output[i];
            output[i] *= 2.0;
          }
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Lowpass filter for smooth ambient warmth
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(type === 'rain' ? 800 : 1200, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(this.ambientGain);

        whiteNoise.start();
        this.ambientSource = whiteNoise;
      } else if (type === 'ticking') {
        // Procedural soft mechanical clock tick every 1000ms
        const playTick = () => {
          if (this.currentAmbientType !== 'ticking') return;
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const tickGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, t);
          osc.frequency.exponentialRampToValueAtTime(400, t + 0.015);

          tickGain.gain.setValueAtTime(0.08, t);
          tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

          osc.connect(tickGain);
          tickGain.connect(this.ambientGain);

          osc.start(t);
          osc.stop(t + 0.025);
        };

        playTick();
        this.ambientInterval = setInterval(playTick, 1000);
      }
    } catch (e) {
      console.warn('Ambient audio error:', e);
    }
  }

  stopAmbient() {
    this.currentAmbientType = null;
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch (e) {}
      this.ambientSource = null;
    }
    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch (e) {}
      this.ambientGain = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.AudioSynth = AudioSynth;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioSynth;
}
