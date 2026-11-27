/**
 * SynthAudioBridge.js
 * Conecta o modelo lógico do grafo à Web Audio API em tempo real.
 * Instancia nós nativos de áudio, calcula modulações de frequência (FM),
 * envelopes ADSR, filtros e expõe a interface padrão de disparo:
 * playNote({ note, freq, velocity, duration, gain })
 */

import { ScaleCatalog } from '../surface/ScaleCatalog.js';

export class SynthAudioBridge {
  constructor(model, audioContext = null, destination = null) {
    this.model = model;
    this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.destination = destination || this.ctx.destination;

    // Barramento Master
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    // Limitador suave anti-clip no Master
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(0, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.05, this.ctx.currentTime);

    // Analisador Master para Osciloscópio e FFT
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 1024;
    this.masterAnalyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.destination);

    // Analisadores auxiliares para a inspeção "Antes ➔ Função ➔ Depois"
    this.preAnalyser = this.ctx.createAnalyser();
    this.preAnalyser.fftSize = 512;
    this.postAnalyser = this.ctx.createAnalyser();
    this.postAnalyser.fftSize = 512;

    this.activeVoices = new Set();
  }

  unlock() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Dispara uma nota respeitando o contrato técnico universal do Sound of Life
   */
  playNote({ note, freq, velocity = 90, duration = 240, gain = 1.0 }) {
    this.unlock();

    const frequency = freq || (note ? ScaleCatalog.noteToFreq(note) : 440);
    const now = this.ctx.currentTime;
    const durSec = Math.max(0.04, duration / 1000);
    const normalizedVel = Math.max(0.05, Math.min(1.0, velocity / 127));

    this._spawnVoice(frequency, normalizedVel, durSec, gain, now);
  }

  _spawnVoice(baseFreq, vel, durSec, globalGain, now) {
    const nodes = this.model.nodes;
    const cables = this.model.cables;

    if (nodes.size === 0) return;

    // Map temporário para esta voz: nodeId -> WebAudio Node(s)
    const voiceInstances = new Map();
    const cleanupNodes = [];

    // 1. Instanciação dos Nós de Áudio desta voz
    for (const [id, nodeData] of nodes.entries()) {
      const p = nodeData.params;

      if (nodeData.type === 'oscillator') {
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        const octaveMult = Math.pow(2, p.octave || 0);
        const ratioMult = p.ratio || 1.0;
        const targetFreq = baseFreq * octaveMult * ratioMult;

        osc.type = p.waveform || 'sawtooth';
        osc.frequency.setValueAtTime(targetFreq, now);
        if (p.detune) osc.detune.setValueAtTime(p.detune, now);

        oscGain.gain.setValueAtTime(p.gain !== undefined ? p.gain : 0.8, now);
        osc.connect(oscGain);

        voiceInstances.set(id, {
          main: oscGain,
          source: osc,
          freqParam: osc.frequency,
          detuneParam: osc.detune,
          targetFreq: targetFreq
        });

        osc.start(now);
        cleanupNodes.push(osc, oscGain);

      } else if (nodeData.type === 'noise') {
        const bufferSize = this.ctx.sampleRate * Math.min(3, durSec + 0.5);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (p.noiseType === 'pink') {
            // Filtro simples de ruído rosa (Paul Kellet 1-pole filter approximation)
            lastOut = (lastOut * 0.95) + (white * 0.05);
            output[i] = lastOut * 3.0;
          } else {
            output[i] = white;
          }
        }

        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(p.gain !== undefined ? p.gain : 0.8, now);

        noiseSrc.connect(noiseGain);
        voiceInstances.set(id, { main: noiseGain, source: noiseSrc });

        noiseSrc.start(now);
        cleanupNodes.push(noiseSrc, noiseGain);

      } else if (nodeData.type === 'filter') {
        const filter = this.ctx.createBiquadFilter();
        filter.type = p.filterType || 'lowpass';

        const keyTrackMult = parseFloat(p.keyTrack) || 0;
        let baseCutoff;
        if (keyTrackMult > 0) {
          // Rastreia a nota musical tocada no teclado/loop (fundamental para física de sopro)
          baseCutoff = Math.max(20, Math.min(18000, baseFreq * keyTrackMult * ((p.cutoff || 440) / 440)));
        } else {
          baseCutoff = Math.max(20, Math.min(20000, p.cutoff || 1800));
        }

        filter.frequency.setValueAtTime(baseCutoff, now);
        filter.Q.setValueAtTime(p.resonance || 3.0, now);

        voiceInstances.set(id, {
          main: filter,
          cutoffParam: filter.frequency,
          baseCutoff,
          envAmount: p.envAmount || 3000
        });
        cleanupNodes.push(filter);

      } else if (nodeData.type === 'envelope') {
        // Objeto virtual de Envelope com parâmetros ADSR
        voiceInstances.set(id, {
          isEnvelope: true,
          attack: Math.max(0.001, p.attack || 0.005),
          decay: Math.max(0.01, p.decay || 0.25),
          sustain: Math.max(0, Math.min(1.0, p.sustain !== undefined ? p.sustain : 0.2)),
          release: Math.max(0.01, p.release || 0.2)
        });

      } else if (nodeData.type === 'lfo') {
        const lfoOsc = this.ctx.createOscillator();
        const lfoDepth = this.ctx.createGain();

        lfoOsc.type = p.waveform || 'sine';
        lfoOsc.frequency.setValueAtTime(p.frequency || 5.0, now);
        lfoDepth.gain.setValueAtTime(p.depth || 30, now);

        lfoOsc.connect(lfoDepth);
        voiceInstances.set(id, { main: lfoDepth, source: lfoOsc });

        lfoOsc.start(now);
        cleanupNodes.push(lfoOsc, lfoDepth);

      } else if (nodeData.type === 'vca') {
        const vcaGain = this.ctx.createGain();
        vcaGain.gain.setValueAtTime(p.gain !== undefined ? p.gain : 0.8, now);

        voiceInstances.set(id, {
          main: vcaGain,
          gainParam: vcaGain.gain,
          baseGain: p.gain !== undefined ? p.gain : 0.8,
          depth: p.depth || 500
        });
        cleanupNodes.push(vcaGain);

      } else if (nodeData.type === 'mixer') {
        const mixerOut = this.ctx.createGain();
        const ch1 = this.ctx.createGain();
        const ch2 = this.ctx.createGain();
        const ch3 = this.ctx.createGain();
        const ch4 = this.ctx.createGain();

        ch1.gain.setValueAtTime(p.ch1 !== undefined ? p.ch1 : 0.7, now);
        ch2.gain.setValueAtTime(p.ch2 !== undefined ? p.ch2 : 0.7, now);
        ch3.gain.setValueAtTime(p.ch3 !== undefined ? p.ch3 : 0.5, now);
        ch4.gain.setValueAtTime(p.ch4 !== undefined ? p.ch4 : 0.5, now);

        ch1.connect(mixerOut);
        ch2.connect(mixerOut);
        ch3.connect(mixerOut);
        ch4.connect(mixerOut);

        voiceInstances.set(id, {
          main: mixerOut,
          channels: { in_1: ch1, in_2: ch2, in_3: ch3, in_4: ch4 }
        });
        cleanupNodes.push(mixerOut, ch1, ch2, ch3, ch4);

      } else if (nodeData.type === 'master') {
        const mGain = this.ctx.createGain();
        mGain.gain.setValueAtTime((p.volume || 0.85) * globalGain, now);
        mGain.connect(this.masterGain);

        voiceInstances.set(id, { main: mGain });
        cleanupNodes.push(mGain);
      }
    }

    // 2. Conexão dos Cabos do Grafo
    for (const cable of cables) {
      const srcInst = voiceInstances.get(cable.fromNode);
      const dstInst = voiceInstances.get(cable.toNode);
      if (!srcInst || !dstInst) continue;

      // Caso A: Saída de Áudio para Entrada de Áudio
      if (srcInst.main && dstInst.main && cable.toPort === 'audio_in') {
        srcInst.main.connect(dstInst.main);
        continue;
      }

      // Caso B: Entrada em canal específico do Mixer
      if (srcInst.main && dstInst.channels && dstInst.channels[cable.toPort]) {
        srcInst.main.connect(dstInst.channels[cable.toPort]);
        continue;
      }

      // Caso C: Modulação FM (Áudio/Oscilador -> Entrada FM do Oscilador Portador)
      if (srcInst.main && dstInst.freqParam && cable.toPort === 'fm_in') {
        srcInst.main.connect(dstInst.freqParam);
        continue;
      }

      // Caso D: Modulação de Pitch CV (LFO -> Oscilador)
      if (srcInst.main && dstInst.detuneParam && cable.toPort === 'pitch_cv') {
        srcInst.main.connect(dstInst.detuneParam);
        continue;
      }

      // Caso E1: Envelope ADSR modulando Cutoff do Filtro
      if (srcInst.isEnvelope && dstInst.cutoffParam && cable.toPort === 'cutoff_cv') {
        const base = dstInst.baseCutoff || 1000;
        const amount = (dstInst.envAmount || 3000) * vel;
        const peakCutoff = Math.max(40, Math.min(18000, base + amount));

        dstInst.cutoffParam.setValueAtTime(base, now);
        dstInst.cutoffParam.exponentialRampToValueAtTime(peakCutoff, now + srcInst.attack);
        dstInst.cutoffParam.exponentialRampToValueAtTime(
          Math.max(40, base + amount * srcInst.sustain),
          now + srcInst.attack + srcInst.decay
        );
        dstInst.cutoffParam.exponentialRampToValueAtTime(
          Math.max(30, base * 0.8),
          now + durSec + srcInst.release
        );
        continue;
      }

      // Caso E2: Oscilador fornecendo Pitch/Frequência Dinâmica ou Modulação ao Filtro (Cutoff CV)
      if (srcInst.targetFreq && dstInst.cutoffParam && cable.toPort === 'cutoff_cv') {
        // Define a frequência central do filtro exatamente para a nota do oscilador
        dstInst.cutoffParam.setValueAtTime(srcInst.targetFreq, now);

        // Se o cabo veio da saída de áudio (audio_out), conecta também modulação em taxa de áudio (Filter Audio FM)
        if (cable.fromPort === 'audio_out' && srcInst.main) {
          const fmDepth = this.ctx.createGain();
          fmDepth.gain.setValueAtTime(srcInst.targetFreq * 0.45, now);
          srcInst.main.connect(fmDepth);
          fmDepth.connect(dstInst.cutoffParam);
          cleanupNodes.push(fmDepth);
        }
        continue;
      }

      // Caso E3: LFO modulando Cutoff do Filtro (Sweeping / Wah-wah)
      if (srcInst.main && dstInst.cutoffParam && cable.toPort === 'cutoff_cv') {
        srcInst.main.connect(dstInst.cutoffParam);
        continue;
      }

      // Caso F: Envelope ADSR modulando Ganho do VCA (Envelope de Amplitude)
      if (srcInst.isEnvelope && dstInst.gainParam && cable.toPort === 'gain_cv') {
        const peak = (dstInst.baseGain || 0.8) * vel * globalGain;
        dstInst.gainParam.setValueAtTime(0.0001, now);
        dstInst.gainParam.exponentialRampToValueAtTime(peak, now + srcInst.attack);
        dstInst.gainParam.exponentialRampToValueAtTime(
          Math.max(0.0001, peak * srcInst.sustain),
          now + srcInst.attack + srcInst.decay
        );
        dstInst.gainParam.exponentialRampToValueAtTime(
          0.0001,
          now + durSec + srcInst.release
        );
        continue;
      }

      // Caso G: LFO modulando VCA (Tremolo / Mod CV)
      if (srcInst.main && dstInst.gainParam && cable.toPort === 'mod_cv') {
        srcInst.main.connect(dstInst.gainParam);
        continue;
      }
    }

    // 3. Agendamento do desligamento e limpeza da voz
    const maxRelease = 0.5;
    const stopTime = now + durSec + maxRelease + 0.1;

    for (const [id, inst] of voiceInstances.entries()) {
      if (inst.source) {
        try { inst.source.stop(stopTime); } catch (_) {}
      }
    }

    setTimeout(() => {
      for (const node of cleanupNodes) {
        try { node.disconnect(); } catch (_) {}
      }
    }, (durSec + maxRelease + 0.2) * 1000);
  }

  getMasterWaveformData() {
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteTimeDomainData(data);
    return data;
  }

  getMasterFrequencyData() {
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteFrequencyData(data);
    return data;
  }
}
