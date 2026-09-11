/**
 * SoundEngine.js
 * Roteador unificado de áudio, mixer principal, barramento de efeitos (Stereo Delay & Reverb)
 * e gerenciador do ciclo de vida do AudioContext.
 */

import { WebAudioSynth } from './WebAudioSynth.js';
import { SF2Player } from './SF2Player.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.limiter = null;
    this.voiceBus = null;
    this.fxSendGain = null;
    this.fxWetGain = null;
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

    // 1. Limiter Brickwall (DynamicsCompressor) para evitar qualquer distorção/clipping
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(0, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.001, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.1, this.ctx.currentTime);

    // 2. Master Gain com valor direto e agendado
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    // 3. Barramento Central de Vozes (Recebe o som de todas as pistas)
    this.voiceBus = this.ctx.createGain();
    this.voiceBus.gain.value = 1.0;
    this.voiceBus.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // 4. Sinal Direto (Dry Signal) -> Limiter -> Master
    this.voiceBus.connect(this.limiter);

    // 5. Barramento de Efeitos Espaciais (Delay Estéreo + Reverb)
    this.fxSendGain = this.ctx.createGain();
    this.fxSendGain.gain.value = 0.5;
    this.fxSendGain.gain.setValueAtTime(0.5, this.ctx.currentTime);

    this.fxWetGain = this.ctx.createGain();
    this.fxWetGain.gain.value = 0.25;
    this.fxWetGain.gain.setValueAtTime(0.25, this.ctx.currentTime); // 25% padrão

    this._buildFxChain();

    // Conexão final: Limiter -> Master -> Caixas de som / Fones
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Sub-motores de síntese e SF2 conectados ao Barramento Central
    this.synth = new WebAudioSynth(this.ctx, this.voiceBus);
    this.sf2Player = new SF2Player(this.ctx, this.voiceBus);

    // Desbloqueia áudio no primeiro clique, toque ou tecla em qualquer ponto da página
    const unlockHandler = () => {
      this.unlock();
      ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(evt => {
        window.removeEventListener(evt, unlockHandler);
        document.removeEventListener(evt, unlockHandler);
      });
    };

    ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlockHandler, { once: true, passive: true });
      document.addEventListener(evt, unlockHandler, { once: true, passive: true });
    });
  }

  _buildFxChain() {
    // Conecta o barramento de vozes ao envio de efeitos
    this.voiceBus.connect(this.fxSendGain);

    // Filtro de amortecimento de agudos (Damping)
    const dampingFilter = this.ctx.createBiquadFilter();
    dampingFilter.type = 'lowpass';
    dampingFilter.frequency.setValueAtTime(4500, this.ctx.currentTime);

    // Delay Canal Esquerdo (~180ms)
    const delayL = this.ctx.createDelay();
    delayL.delayTime.setValueAtTime(0.18, this.ctx.currentTime);

    // Delay Canal Direito (~270ms)
    const delayR = this.ctx.createDelay();
    delayR.delayTime.setValueAtTime(0.27, this.ctx.currentTime);

    // Feedback cruzado (Ping-Pong Delay)
    const feedbackL = this.ctx.createGain();
    feedbackL.gain.setValueAtTime(0.35, this.ctx.currentTime);

    const feedbackR = this.ctx.createGain();
    feedbackR.gain.setValueAtTime(0.35, this.ctx.currentTime);

    // Panners estéreo
    const merger = this.ctx.createChannelMerger(2);

    this.fxSendGain.connect(dampingFilter);

    // Roteamento Delay L -> R / R -> L
    dampingFilter.connect(delayL);
    dampingFilter.connect(delayR);

    delayL.connect(feedbackL);
    feedbackL.connect(delayR);

    delayR.connect(feedbackR);
    feedbackR.connect(delayL);

    delayL.connect(merger, 0, 0); // L
    delayR.connect(merger, 0, 1); // R

    // Retorno do efeito ao limiter master
    merger.connect(this.fxWetGain);
    this.fxWetGain.connect(this.limiter);
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

  setFxLevel(val) {
    if (!this.fxWetGain || !this.ctx) return;
    const clamped = Math.max(0, Math.min(1.0, val));
    this.fxWetGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
  }

  getFxLevel() {
    return this.fxWetGain ? this.fxWetGain.gain.value : 0.25;
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
