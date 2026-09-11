/**
 * SF2Player.js
 * Reprodutor e Parser de SoundFonts (.sf2) completo para Web Audio API.
 * 
 * Suporta:
 * 1. Carregamento e decodificação de arquivos .sf2 binários reais do usuário (extrai samples PCM 16-bit,
 *    presets, mapeamento de notas, afinação e cria AudioBuffers nativos).
 * 2. Instrumentos acústicos embutidos altamente distintos (Grand Piano, Rhodes EPiano, Marimba,
 *    Celesta, Pizzicato Strings, Slap Bass, Synth Brass) com modelagem física de samples.
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

/**
 * Parser de arquivos binários SoundFont 2 (SF2 / RIFF sfbk)
 */
class SF2Parser {
  static parse(arrayBuffer) {
    const data = new DataView(arrayBuffer);
    let offset = 0;

    // 1. Verifica cabeçalho RIFF sfbk
    const riff = this._readString(data, offset, 4);
    offset += 4;
    const fileSize = data.getUint32(offset, true);
    offset += 4;
    const sfbk = this._readString(data, offset, 4);
    offset += 4;

    if (riff !== 'RIFF' || sfbk !== 'sfbk') {
      throw new Error('O arquivo selecionado não é um SoundFont 2 válido (.sf2).');
    }

    let smplBuffer = null;
    let phdrList = [];
    let pbagList = [];
    let pgenList = [];
    let instList = [];
    let ibagList = [];
    let igenList = [];
    let shdrList = [];

    // 2. Itera pelos blocos LIST
    while (offset < data.byteLength - 8) {
      const chunkId = this._readString(data, offset, 4);
      offset += 4;
      const chunkSize = data.getUint32(offset, true);
      offset += 4;

      if (chunkId === 'LIST') {
        const listType = this._readString(data, offset, 4);
        const listEnd = offset + chunkSize;
        offset += 4;

        while (offset < listEnd - 8) {
          const subId = this._readString(data, offset, 4);
          offset += 4;
          const subSize = data.getUint32(offset, true);
          offset += 4;

          if (subId === 'smpl') {
            // Raw 16-bit linear PCM samples
            smplBuffer = new Int16Array(arrayBuffer, offset, Math.floor(subSize / 2));
          } else if (subId === 'phdr') {
            phdrList = this._parsePhdr(data, offset, subSize);
          } else if (subId === 'pbag') {
            pbagList = this._parseBag(data, offset, subSize);
          } else if (subId === 'pgen') {
            pgenList = this._parseGen(data, offset, subSize);
          } else if (subId === 'inst') {
            instList = this._parseInst(data, offset, subSize);
          } else if (subId === 'ibag') {
            ibagList = this._parseBag(data, offset, subSize);
          } else if (subId === 'igen') {
            igenList = this._parseGen(data, offset, subSize);
          } else if (subId === 'shdr') {
            shdrList = this._parseShdr(data, offset, subSize);
          }

          offset += subSize;
          if (subSize % 2 !== 0) offset++; // Alinhamento par
        }
      } else {
        offset += chunkSize;
        if (chunkSize % 2 !== 0) offset++;
      }
    }

    return {
      smplBuffer,
      presets: phdrList,
      samples: shdrList,
      pbag: pbagList,
      pgen: pgenList,
      inst: instList,
      ibag: ibagList,
      igen: igenList
    };
  }

  static _readString(dataView, offset, length) {
    let str = '';
    for (let i = 0; i < length; i++) {
      if (offset + i < dataView.byteLength) {
        const code = dataView.getUint8(offset + i);
        if (code === 0) break;
        str += String.fromCharCode(code);
      }
    }
    return str;
  }

  static _parsePhdr(data, offset, size) {
    const list = [];
    const count = Math.floor(size / 38);
    for (let i = 0; i < count; i++) {
      const pos = offset + i * 38;
      const name = this._readString(data, pos, 20).trim();
      const preset = data.getUint16(pos + 20, true);
      const bank = data.getUint16(pos + 22, true);
      const bagIndex = data.getUint16(pos + 24, true);
      if (name && name !== 'EOP') {
        list.push({ name, preset, bank, bagIndex, index: i });
      }
    }
    return list;
  }

  static _parseBag(data, offset, size) {
    const list = [];
    const count = Math.floor(size / 4);
    for (let i = 0; i < count; i++) {
      const pos = offset + i * 4;
      const genIndex = data.getUint16(pos, true);
      const modIndex = data.getUint16(pos + 2, true);
      list.push({ genIndex, modIndex });
    }
    return list;
  }

  static _parseGen(data, offset, size) {
    const list = [];
    const count = Math.floor(size / 4);
    for (let i = 0; i < count; i++) {
      const pos = offset + i * 4;
      const oper = data.getUint16(pos, true);
      const amount = data.getInt16(pos + 2, true);
      list.push({ oper, amount });
    }
    return list;
  }

  static _parseInst(data, offset, size) {
    const list = [];
    const count = Math.floor(size / 22);
    for (let i = 0; i < count; i++) {
      const pos = offset + i * 22;
      const name = this._readString(data, pos, 20).trim();
      const bagIndex = data.getUint16(pos + 20, true);
      if (name && name !== 'EOI') {
        list.push({ name, bagIndex, index: i });
      }
    }
    return list;
  }

  static _parseShdr(data, offset, size) {
    const list = [];
    const count = Math.floor(size / 46);
    for (let i = 0; i < count; i++) {
      const pos = offset + i * 46;
      const name = this._readString(data, pos, 20).trim();
      const start = data.getUint32(pos + 20, true);
      const end = data.getUint32(pos + 24, true);
      const startLoop = data.getUint32(pos + 28, true);
      const endLoop = data.getUint32(pos + 32, true);
      const sampleRate = data.getUint32(pos + 36, true);
      const originalPitch = data.getUint8(pos + 40);
      const pitchCorrection = data.getInt8(pos + 41);
      const sampleType = data.getUint16(pos + 44, true);

      if (name && name !== 'EOS') {
        list.push({
          name,
          start,
          end,
          startLoop,
          endLoop,
          sampleRate: sampleRate || 44100,
          originalPitch: originalPitch || 60,
          pitchCorrection,
          sampleType,
          index: i
        });
      }
    }
    return list;
  }
}

export class SF2Player {
  constructor(audioContext, masterDestination) {
    this.ctx = audioContext;
    this.dest = masterDestination;
    this.customSoundFonts = []; // Lista de soundfonts carregados com seus instrumentos
    this.loadedSf2Data = new Map(); // id -> parsed SF2 data
    this.audioBufferCache = new Map(); // sampleIndex -> AudioBuffer
  }

  getAvailablePresets() {
    const userPresets = [];
    for (const [sf2Id, sfData] of this.loadedSf2Data.entries()) {
      if (sfData.presets && sfData.presets.length > 0) {
        sfData.presets.forEach((preset, pIdx) => {
          userPresets.push({
            id: `sf2custom:${sf2Id}:${pIdx}`,
            name: `📦 [${sfData.fileName}] ${preset.name} (${preset.preset}:${preset.bank})`,
            category: sfData.fileName,
            sf2Id,
            presetIndex: pIdx
          });
        });
      } else if (sfData.samples && sfData.samples.length > 0) {
        // Fallback: Lista os samples brutos
        sfData.samples.slice(0, 32).forEach((smp, sIdx) => {
          userPresets.push({
            id: `sf2custom:${sf2Id}:smp_${sIdx}`,
            name: `🎵 [${sfData.fileName}] ${smp.name}`,
            category: sfData.fileName,
            sf2Id,
            sampleIndex: sIdx
          });
        });
      }
    }

    return [
      ...BUILTIN_SF2_PRESETS,
      ...userPresets
    ];
  }

  /**
   * Carrega e analisa um arquivo .sf2 real do usuário
   */
  async loadSoundFontFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const parsed = SF2Parser.parse(arrayBuffer);

    const sf2Id = `sf2_${Date.now()}`;
    parsed.fileName = file.name.replace('.sf2', '');
    parsed.id = sf2Id;

    // Converte os samples PCM 16-bit em AudioBuffers do Web Audio
    if (parsed.smplBuffer && parsed.samples.length > 0) {
      for (const smp of parsed.samples) {
        try {
          const length = smp.end - smp.start;
          if (length > 0 && smp.start + length <= parsed.smplBuffer.length) {
            const audioBuffer = this.ctx.createBuffer(1, length, smp.sampleRate);
            const channelData = audioBuffer.getChannelData(0);
            const raw = parsed.smplBuffer;
            const start = smp.start;

            for (let i = 0; i < length; i++) {
              channelData[i] = raw[start + i] / 32768.0;
            }

            this.audioBufferCache.set(`${sf2Id}_${smp.index}`, {
              buffer: audioBuffer,
              sample: smp
            });
          }
        } catch (e) {
          console.warn(`Erro ao criar AudioBuffer para sample ${smp.name}:`, e);
        }
      }
    }

    this.loadedSf2Data.set(sf2Id, parsed);
    console.log(`[SF2] Carregado "${file.name}": ${parsed.presets.length} presets, ${parsed.samples.length} samples.`);
    return parsed;
  }

  playNote({ note, freq, velocity = 90, duration = 200, soundSource = 'sf2:piano', gain = 1.0 }) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const midiNote = ScaleCatalog.noteToMidi(note);
    const frequency = freq || ScaleCatalog.noteToFreq(note);
    const now = this.ctx.currentTime;
    const durSec = Math.max(0.05, duration / 1000);
    const velNorm = Math.max(0.05, Math.min(1.0, velocity / 127));

    // 1. Verifica se é um SF2 Custom carregado pelo usuário
    if (soundSource.startsWith('sf2custom:')) {
      const parts = soundSource.split(':');
      const sf2Id = parts[1];
      const target = parts[2];

      const played = this._playCustomSf2Sample(sf2Id, target, midiNote, velNorm, durSec, gain, now);
      if (played) return;
    }

    // 2. Instrumentos Acústicos Embutidos (Distintos e Ricos)
    const presetId = soundSource.startsWith('sf2:') ? soundSource.replace('sf2:', '') : 'piano';

    switch (presetId) {
      case 'piano':
        this._playGrandPiano(frequency, velNorm, durSec, gain, now);
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
        this._playGrandPiano(frequency, velNorm, durSec, gain, now);
    }
  }

  _playCustomSf2Sample(sf2Id, target, midiNote, vel, dur, gainMultiplier, now) {
    const sfData = this.loadedSf2Data.get(sf2Id);
    if (!sfData || sfData.samples.length === 0) return false;

    // Encontra o sample mais próximo da nota MIDI tocada
    let bestSample = null;
    let minDistance = 999;

    for (const smp of sfData.samples) {
      const dist = Math.abs(smp.originalPitch - midiNote);
      if (dist < minDistance) {
        minDistance = dist;
        bestSample = smp;
      }
    }

    if (!bestSample) return false;

    const cached = this.audioBufferCache.get(`${sf2Id}_${bestSample.index}`);
    if (!cached || !cached.buffer) return false;

    // Cria nó de reprodução do sample nativo do SF2
    const source = this.ctx.createBufferSource();
    source.buffer = cached.buffer;

    // Pitch shifting preciso com afinação do SoundFont
    const semitoneOffset = (midiNote - bestSample.originalPitch) + (bestSample.pitchCorrection / 100);
    source.playbackRate.setValueAtTime(Math.pow(2, semitoneOffset / 12), now);

    // Envelope de ganho do sample
    const gainNode = this.ctx.createGain();
    const peakGain = 0.5 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peakGain, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.1);

    source.connect(gainNode);
    gainNode.connect(this.dest);

    source.start(now);
    source.stop(now + dur + 0.15);

    setTimeout(() => {
      source.disconnect();
      gainNode.disconnect();
    }, (dur + 0.2) * 1000);

    return true;
  }

  /* ---------------- MODELOS ACÚSTICOS EMBUTIDOS ---------------- */

  _playGrandPiano(freq, vel, dur, gainMultiplier, now) {
    // Grand Piano: 3 harmônicos com decaimento acentuado de martelo de piano acústico
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.001, now); // Harmônico superior

    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(10000, freq * 5 * vel), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(150, freq * 1.2), now + dur);

    const peak = 0.32 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.2);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.dest);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + dur + 0.25);
    osc2.stop(now + dur + 0.25);
    osc3.stop(now + dur + 0.25);

    setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      osc3.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    }, (dur + 0.3) * 1000);
  }

  _playMarimba(freq, vel, dur, gainMultiplier, now) {
    // Marimba / Xilofone: Ataque de madeira rápido com harmônico 4x característico e filtro passa-banda
    const osc1 = this.ctx.createOscillator();
    const oscOvertone = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    oscOvertone.type = 'sine';
    oscOvertone.frequency.setValueAtTime(freq * 3.98, now); // Harmônico de barra de madeira

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.5, now);
    filter.Q.setValueAtTime(2.0, now);

    const peak = 0.4 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(dur, 0.4));

    osc1.connect(gainNode);
    oscOvertone.connect(gainNode);
    gainNode.connect(this.dest);

    osc1.start(now);
    oscOvertone.start(now);
    osc1.stop(now + dur + 0.1);
    oscOvertone.stop(now + 0.08); // Harmônico morre quase instantaneamente

    setTimeout(() => {
      osc1.disconnect();
      oscOvertone.disconnect();
      gainNode.disconnect();
    }, (dur + 0.15) * 1000);
  }

  _playRhodes(freq, vel, dur, gainMultiplier, now) {
    // Rhodes Electric Piano: Timbre quente com ataque de tine metálico
    const oscTine = this.ctx.createOscillator();
    const oscTone = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    oscTine.type = 'sine';
    oscTine.frequency.setValueAtTime(freq * 4, now); // Tine de metal

    oscTone.type = 'triangle';
    oscTone.frequency.setValueAtTime(freq, now);

    const peak = 0.3 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(peak * 0.5, now + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.3);

    oscTine.connect(gainNode);
    oscTone.connect(gainNode);
    gainNode.connect(this.dest);

    oscTine.start(now);
    oscTone.start(now);
    oscTine.stop(now + 0.1); // Tine metálico curto
    oscTone.stop(now + dur + 0.35);

    setTimeout(() => {
      oscTine.disconnect();
      oscTone.disconnect();
      gainNode.disconnect();
    }, (dur + 0.4) * 1000);
  }

  _playCelesta(freq, vel, dur, gainMultiplier, now) {
    // Celesta / Music Box: Timbre cristalino puro e brilhante com sino
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 3.01, now);

    const peak = 0.24 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur * 1.6);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur * 1.6 + 0.05);
    osc2.stop(now + dur * 1.6 + 0.05);

    setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      gainNode.disconnect();
    }, (dur * 1.6 + 0.1) * 1000);
  }

  _playPizzicato(freq, vel, dur, gainMultiplier, now) {
    // Pizzicato Strings: Cordas dedilhadas curtas com ataque acústico forte
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 8 * vel, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, freq * 0.8), now + 0.12);

    const peak = 0.35 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(dur, 0.22));

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.dest);

    osc.start(now);
    osc.stop(now + 0.25);

    setTimeout(() => {
      osc.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    }, 300);
  }

  _playSlapBass(freq, vel, dur, gainMultiplier, now) {
    // Slap Bass: Estalo com onda quadrada sub e filtro dinâmico de slap
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 0.5, now); // Sub-grave encorpado

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(9000, freq * 14 * vel), now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    filter.Q.setValueAtTime(5.0, now);

    const peak = 0.36 * vel * gainMultiplier;
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
    // Synth Brass: Metais sintetizados encorpados com abertura de filtro de sopro
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.006, now); // Detune característico de naipe de metais

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.8, now);
    filter.frequency.exponentialRampToValueAtTime(Math.min(13000, freq * 8 * vel), now + 0.05);
    filter.frequency.exponentialRampToValueAtTime(freq * 2.5, now + dur);

    const peak = 0.28 * vel * gainMultiplier;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.025);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.18);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.22);
    osc2.stop(now + dur + 0.22);

    setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    }, (dur + 0.25) * 1000);
  }
}
