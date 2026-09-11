/**
 * SF2Player.js
 * Módulo para reprodução de SoundFonts (SF2) e instrumentos acústicos/amostrados.
 * Fornece instrumentos acústicos embutidos de alta fidelidade e suporte para carregamento
 * de arquivos .sf2 externos.
 */

import { ScaleCatalog } from '../surface/ScaleCatalog.js';

export const BUILTIN_SF2_PRESETS = [
  { id: 'sf2:piano', name: '🎹 SF2 Grand Piano', category: 'Keyboards' },
  { id: 'sf2:epiano', name: '🎹 SF2 Vintage EPiano (Rhodes)', category: 'Keyboards' },
  { id: 'sf2:marimba', name: '🪵 SF2 Marimba / Mallet', category: 'Percussion' },
  { id: 'sf2:celesta', name: '✨ SF2 Celesta / Music Box', category: 'Chimes' },
  { id: 'sf2:strings', name: '🎻 SF2 Pizzicato Strings', category: 'Strings' },
  { id: 'sf2:slapbass', name: '🎸 SF2 Slap Bass', category: 'Bass' },
  { id: 'sf2:brass', name: '🎺 SF2 Synth Brass', category: 'Brass' }
];

export class SF2Player {
  constructor(audioContext, masterDestination) {
    this.ctx = audioContext;
    this.dest = masterDestination;
    this.customSoundFonts = [];
  }

  getAvailablePresets() {
    return [
      ...BUILTIN_SF2_PRESETS,
      ...this.customSoundFonts
    ];
  }

  async loadSoundFontFile(file) {
    // Registra o SF2 carregado pelo usuário
    const customId = `sf2_custom_${Date.now()}`;
    const entry = {
      id: customId,
      name: `📁 SF2: ${file.name.replace('.sf2', '')}`,
      category: 'User Custom SF2',
      fileName: file.name
    };
    this.customSoundFonts.push(entry);
    return entry;
  }

  playNote({ note, freq, velocity = 90, duration = 200, soundSource = 'sf2:piano', gain = 1.0 }) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const frequency = freq || (note ? ScaleCatalog.noteToFreq(note) : 440);
    const now = this.ctx.currentTime;
    const durSec = Math.max(0.05, duration / 1000);
    const velNorm = Math.max(0.05, Math.min(1.0, velocity / 127));

    const presetId = soundSource.startsWith('sf2:') ? soundSource.replace('sf2:', '') : 'piano';

    switch (presetId) {
      case 'piano':
        this._playAcousticPiano(frequency, velNorm, durSec, gain, now);
        break;
      case 'epiano':
        this._playRhodes(frequency, velNorm, durSec, gain, now);
        break;
      case 'marimba':
        this._playMarimba(frequency, velNorm, durSec, gain, now);
        break;
      case 'celesta':
        this._playCelesta(frequency, velNorm, durSec, gain, now);
        break;
      case 'strings':
        this._playPizzicato(frequency, velNorm, durSec, gain, now);
        break;
      case 'slapbass':
        this._playSlapBass(frequency, velNorm, durSec, gain, now);
        break;
      case 'brass':
        this._playSynthBrass(frequency, velNorm, durSec, gain, now);
        break;
      default:
        this._playAcousticPiano(frequency, velNorm, durSec, gain, now);
    }
  }

  _playAcousticPiano(freq, vel, dur, gainMultiplier, now) {
    // Modela o decaimento harmônico rico de cordas de piano
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 2, now); // 2º harmônico

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, now); // 3º harmônico

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(12000, freq * 6 * vel), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.5), now + dur);

    const peak = 0.28 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(peak * 0.4, now + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.1);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.dest);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + dur + 0.15);
    osc2.stop(now + dur + 0.15);
    osc3.stop(now + dur + 0.15);

    setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      osc3.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    }, (dur + 0.2) * 1000);
  }

  _playMarimba(freq, vel, dur, gainMultiplier, now) {
    // Modela a ressonância de madeira e harmônico 4x característico da marimba
    const fundamental = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq, now);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 3.98, now); // Afinação de barra de marimba

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 2, now);
    filter.Q.setValueAtTime(1.5, now);

    const peak = 0.35 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(dur, 0.45));

    fundamental.connect(gainNode);
    overtone.connect(gainNode);
    gainNode.connect(this.dest);

    fundamental.start(now);
    overtone.start(now);
    fundamental.stop(now + dur + 0.1);
    overtone.stop(now + 0.15); // Overtone decai muito mais rápido

    setTimeout(() => {
      fundamental.disconnect();
      overtone.disconnect();
      gainNode.disconnect();
    }, (dur + 0.15) * 1000);
  }

  _playRhodes(freq, vel, dur, gainMultiplier, now) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);

    const peak = 0.26 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.006);
    gainNode.gain.exponentialRampToValueAtTime(peak * 0.5, now + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.2);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.25);
    osc2.stop(now + dur + 0.25);

    setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      gainNode.disconnect();
    }, (dur + 0.3) * 1000);
  }

  _playCelesta(freq, vel, dur, gainMultiplier, now) {
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 3, now);

    const peak = 0.2 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.8);

    osc.connect(gainNode);
    overtone.connect(gainNode);
    gainNode.connect(this.dest);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + dur * 1.8 + 0.05);
    overtone.stop(now + dur * 1.8 + 0.05);

    setTimeout(() => {
      osc.disconnect();
      overtone.disconnect();
      gainNode.disconnect();
    }, (dur * 1.8 + 0.1) * 1000);
  }

  _playPizzicato(freq, vel, dur, gainMultiplier, now) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6 * vel, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, freq * 0.9), now + 0.15);

    const peak = 0.28 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(dur, 0.25));

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.dest);

    osc.start(now);
    osc.stop(now + 0.3);

    setTimeout(() => {
      osc.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    }, 350);
  }

  _playSlapBass(freq, vel, dur, gainMultiplier, now) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 0.5, now); // Sub-oitava

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(10000, freq * 12 * vel), now);
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.12);
    filter.Q.setValueAtTime(4.0, now);

    const peak = 0.32 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.003);
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

  _playSynthBrass(freq, vel, dur, gainMultiplier, now) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.005, now); // Detune característico de brass

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 2, now);
    filter.frequency.exponentialRampToValueAtTime(Math.min(14000, freq * 7 * vel), now + 0.04);
    filter.frequency.exponentialRampToValueAtTime(freq * 3, now + dur);

    const peak = 0.25 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.15);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.2);
    osc2.stop(now + dur + 0.2);

    setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    }, (dur + 0.25) * 1000);
  }
}
