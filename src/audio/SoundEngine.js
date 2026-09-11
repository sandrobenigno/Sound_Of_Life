/**
 * SoundEngine.js
 * Roteador unificado de áudio, mixer principal, efeitos master (compressor limiter e reverb)
 * e gerenciador do ciclo de vida do AudioContext.
 */

import { WebAudioSynth } from './WebAudioSynth.js';
import { SF2Player } from './SF2Player.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.limiter = null;
    this.reverbGain = null;
    this.synth = null;
    this.sf2Player = null;
    this.isUnlocked = false;

    this._initAudio();
  }

  _initAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API não é suportada neste navegador.');
      return;
    }

    this.ctx = new AudioContextClass();

    // 1. Limiter Brickwall (DynamicsCompressor) para evitar qualquer saturação/clipping
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(0, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.001, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.1, this.ctx.currentTime);

    // 2. Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    // 3. Efeito Delay / Reverb Master Sutil
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.25, this.ctx.currentTime);

    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.3, this.ctx.currentTime);

    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    // Conexões Master
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Sub-motores de síntese e SF2
    this.synth = new WebAudioSynth(this.ctx, this.limiter);
    this.sf2Player = new SF2Player(this.ctx, this.limiter);

    // Desbloqueia áudio no primeiro clique/toque do usuário
    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.isUnlocked = true;
        });
      } else {
        this.isUnlocked = true;
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  unlock() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().then(() => {
        this.isUnlocked = true;
        return true;
      });
    }
    this.isUnlocked = true;
    return Promise.resolve(true);
  }

  setMasterVolume(val) {
    if (!this.masterGain || !this.ctx) return;
    const clamped = Math.max(0, Math.min(1.5, val));
    this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
  }

  getAvailableSoundSources() {
    const synths = [
      { id: 'synth:saw', name: '⚡ Synth: Saw Lead (Rico/Brilhante)', group: 'Sintetizador' },
      { id: 'synth:square', name: '🕹️ Synth: Square Chiptune (Retro)', group: 'Sintetizador' },
      { id: 'synth:triangle', name: '🌊 Synth: Triangle Sub (Suave)', group: 'Sintetizador' },
      { id: 'synth:sine', name: '🫧 Synth: Pure Sine (Puro)', group: 'Sintetizador' },
      { id: 'synth:pluck', name: '✨ Synth: Synth Pluck (Curto)', group: 'Sintetizador' },
      { id: 'synth:bell', name: '🔔 Synth: FM Chime Bell (Metálico)', group: 'Sintetizador' }
    ];

    const sf2s = this.sf2Player ? this.sf2Player.getAvailablePresets().map(p => ({
      id: p.id,
      name: p.name,
      group: 'SoundFont (SF2)'
    })) : [];

    return [...synths, ...sf2s];
  }

  playNote(params) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const { soundSource = 'synth:saw' } = params;

    if (soundSource.startsWith('sf2')) {
      if (this.sf2Player) {
        this.sf2Player.playNote(params);
      }
    } else {
      if (this.synth) {
        this.synth.playNote(params);
      }
    }
  }
}
