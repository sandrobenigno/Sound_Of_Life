/**
 * WebAudioSynth.js
 * Sintetizador polifônico multi-timbral nativo Web Audio API com envelopes ADSR,
 * filtros ressonantes e síntese FM / Pluck / Sub-Bass.
 */

import { ScaleCatalog } from '../surface/ScaleCatalog.js';

export class WebAudioSynth {
  constructor(audioContext, masterDestination) {
    this.ctx = audioContext;
    this.dest = masterDestination;
  }

  playNote({ note, freq, velocity = 90, duration = 200, soundSource = 'synth:saw', gain = 1.0 }) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const frequency = freq || (note ? ScaleCatalog.noteToFreq(note) : 440);
    const now = this.ctx.currentTime;
    const durSec = Math.max(0.04, duration / 1000);
    const normalizedVel = Math.max(0.05, Math.min(1.0, velocity / 127));

    const [, synthType = 'saw'] = soundSource.split(':');

    switch (synthType) {
      case 'sine':
      case 'triangle':
      case 'saw':
      case 'square':
        this._playBasicOsc(frequency, synthType, normalizedVel, durSec, gain, now);
        break;

      case 'pluck':
        this._playPluck(frequency, normalizedVel, durSec, gain, now);
        break;

      case 'bell':
        this._playBell(frequency, normalizedVel, durSec, gain, now);
        break;

      default:
        this._playBasicOsc(frequency, 'sawtooth', normalizedVel, durSec, gain, now);
    }
  }

  _playBasicOsc(freq, type, vel, dur, gainMultiplier, now) {
    const oscType = type === 'saw' ? 'sawtooth' : type;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, now);

    // Filtro Lowpass dependente da velocity
    filter.type = 'lowpass';
    const cutoff = Math.min(18000, Math.max(400, freq * (2 + vel * 6)));
    filter.frequency.setValueAtTime(cutoff, now);
    filter.Q.setValueAtTime(2.0, now);

    // Envelope ADSR
    const peakGain = 0.25 * vel * gainMultiplier;
    const attack = 0.008;
    const release = Math.max(0.05, dur * 0.4);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peakGain, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(peakGain * 0.7, now + attack + dur * 0.5);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.dest);

    osc.start(now);
    osc.stop(now + dur + release + 0.05);

    // Cleanup
    setTimeout(() => {
      osc.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    }, (dur + release + 0.1) * 1000);
  }

  _playPluck(freq, vel, dur, gainMultiplier, now) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.003, now); // Detune sutil

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 8 * vel, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(150, freq * 0.8), now + dur);
    filter.Q.setValueAtTime(3.5, now);

    const peakGain = 0.3 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peakGain, now + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.1);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.15);
    osc2.stop(now + dur + 0.15);

    setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    }, (dur + 0.2) * 1000);
  }

  _playBell(freq, vel, dur, gainMultiplier, now) {
    // Síntese FM básica (Modulador -> Portadora)
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const masterGain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, now);

    // Relação harmônica 3.5x para timbre metálico/cristalino de sino
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(freq * 3.5, now);

    const modIndex = freq * 2.5 * vel;
    modGain.gain.setValueAtTime(modIndex, now);
    modGain.gain.exponentialRampToValueAtTime(1.0, now + dur * 0.8);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    const peakGain = 0.22 * vel * gainMultiplier;
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(peakGain, now + 0.003);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.5);

    carrier.connect(masterGain);
    masterGain.connect(this.dest);

    modulator.start(now);
    carrier.start(now);
    modulator.stop(now + dur * 1.5 + 0.05);
    carrier.stop(now + dur * 1.5 + 0.05);

    setTimeout(() => {
      modulator.disconnect();
      modGain.disconnect();
      carrier.disconnect();
      masterGain.disconnect();
    }, (dur * 1.5 + 0.1) * 1000);
  }
}
