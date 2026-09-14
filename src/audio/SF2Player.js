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

    const rawParsed = {
      smplBuffer,
      phdrList,
      pbagList,
      pgenList,
      instList,
      ibagList,
      igenList,
      shdrList,
      samples: shdrList
    };

    // Compila a árvore relacional completa: Preset -> Zonas -> Instrumento -> Zonas -> Samples
    rawParsed.compiledPresets = this.buildPresetTree(rawParsed);

    return rawParsed;
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
      list.push({ name, preset, bank, bagIndex, index: i });
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
      list.push({ genIndex, modIndex, index: i });
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
      list.push({ oper, amount, index: i });
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
      list.push({ name, bagIndex, index: i });
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
    return list;
  }

  static _parseZoneGenerators(genList, start, end) {
    const zone = {
      keyRange: [0, 127],
      velRange: [0, 127],
      hasKeyRange: false,
      hasVelRange: false,
      fineTune: 0,
      attenuation: 0
    };

    for (let g = start; g < end && g < genList.length; g++) {
      const gen = genList[g];
      switch (gen.oper) {
        case 41: // instrument
          zone.instrumentIndex = gen.amount;
          break;
        case 53: // sampleID
          zone.sampleIndex = gen.amount;
          break;
        case 43: // keyRange
          zone.keyRange = [gen.amount & 0xFF, (gen.amount >> 8) & 0xFF];
          zone.hasKeyRange = true;
          break;
        case 44: // velRange
          zone.velRange = [gen.amount & 0xFF, (gen.amount >> 8) & 0xFF];
          zone.hasVelRange = true;
          break;
        case 51: // overridingRootKey
          if (gen.amount >= 0 && gen.amount <= 127) {
            zone.rootKey = gen.amount;
          }
          break;
        case 52: // fineTune
          zone.fineTune = gen.amount;
          break;
        case 54: // sampleModes
          zone.sampleModes = gen.amount;
          break;
        case 56: // scaleTuning
          zone.scaleTuning = gen.amount;
          break;
        case 8: // initialAttenuation
          zone.attenuation = gen.amount;
          break;
      }
    }
    return zone;
  }

  /**
   * Compila a árvore relacional completa SF2 para cada Preset
   */
  static buildPresetTree(parsed) {
    const { phdrList, pbagList, pgenList, instList, ibagList, igenList, shdrList } = parsed;
    const compiledPresets = [];

    const presetCount = phdrList.length > 0 && phdrList[phdrList.length - 1].name === 'EOP'
      ? phdrList.length - 1
      : phdrList.length;

    for (let i = 0; i < presetCount; i++) {
      const phdr = phdrList[i];
      if (phdr.name === 'EOP') continue;

      const pbagStart = phdr.bagIndex;
      const pbagEnd = (i + 1 < phdrList.length) ? phdrList[i + 1].bagIndex : pbagList.length;

      let globalPZone = null;
      const compiledZones = [];

      for (let pb = pbagStart; pb < pbagEnd && pb < pbagList.length; pb++) {
        const pgenStart = pbagList[pb].genIndex;
        const pgenEnd = (pb + 1 < pbagList.length) ? pbagList[pb + 1].genIndex : pgenList.length;
        const pZone = this._parseZoneGenerators(pgenList, pgenStart, pgenEnd);

        // Se a zona de preset não possui instrumento (oper 41), ela é global
        if (pZone.instrumentIndex === undefined) {
          globalPZone = pZone;
          continue;
        }

        // Aplica defaults da zona global do preset se aplicável
        if (globalPZone) {
          if (!pZone.hasKeyRange && globalPZone.hasKeyRange) pZone.keyRange = [...globalPZone.keyRange];
          if (!pZone.hasVelRange && globalPZone.hasVelRange) pZone.velRange = [...globalPZone.velRange];
          if (pZone.fineTune === 0 && globalPZone.fineTune !== 0) pZone.fineTune = globalPZone.fineTune;
          if (pZone.attenuation === 0 && globalPZone.attenuation !== 0) pZone.attenuation = globalPZone.attenuation;
        }

        const instIdx = pZone.instrumentIndex;
        if (instIdx >= 0 && instIdx < instList.length) {
          const inst = instList[instIdx];
          if (inst.name === 'EOI') continue;

          const ibagStart = inst.bagIndex;
          const ibagEnd = (instIdx + 1 < instList.length) ? instList[instIdx + 1].bagIndex : ibagList.length;

          let globalIZone = null;

          for (let ib = ibagStart; ib < ibagEnd && ib < ibagList.length; ib++) {
            const igenStart = ibagList[ib].genIndex;
            const igenEnd = (ib + 1 < ibagList.length) ? ibagList[ib + 1].genIndex : igenList.length;
            const iZone = this._parseZoneGenerators(igenList, igenStart, igenEnd);

            // Se a zona do instrumento não possui sample (oper 53), ela é global
            if (iZone.sampleIndex === undefined) {
              globalIZone = iZone;
              continue;
            }

            // Aplica defaults da zona global do instrumento
            if (globalIZone) {
              if (!iZone.hasKeyRange && globalIZone.hasKeyRange) iZone.keyRange = [...globalIZone.keyRange];
              if (!iZone.hasVelRange && globalIZone.hasVelRange) iZone.velRange = [...globalIZone.velRange];
              if (iZone.fineTune === 0 && globalIZone.fineTune !== 0) iZone.fineTune = globalIZone.fineTune;
              if (iZone.attenuation === 0 && globalIZone.attenuation !== 0) iZone.attenuation = globalIZone.attenuation;
              if (iZone.rootKey === undefined && globalIZone.rootKey !== undefined) iZone.rootKey = globalIZone.rootKey;
              if (iZone.sampleModes === undefined && globalIZone.sampleModes !== undefined) iZone.sampleModes = globalIZone.sampleModes;
            }

            const smpIdx = iZone.sampleIndex;
            if (smpIdx >= 0 && smpIdx < shdrList.length) {
              const smp = shdrList[smpIdx];
              if (smp.name === 'EOS') continue;

              // Calcula interseção de keyRange e velRange
              const keyMin = Math.max(pZone.keyRange[0], iZone.keyRange[0]);
              const keyMax = Math.min(pZone.keyRange[1], iZone.keyRange[1]);
              if (keyMin > keyMax) continue;

              const velMin = Math.max(pZone.velRange[0], iZone.velRange[0]);
              const velMax = Math.min(pZone.velRange[1], iZone.velRange[1]);
              if (velMin > velMax) continue;

              const rootKey = (iZone.rootKey !== undefined)
                ? iZone.rootKey
                : ((pZone.rootKey !== undefined) ? pZone.rootKey : (smp.originalPitch || 60));

              const fineTune = (iZone.fineTune || 0) + (pZone.fineTune || 0) + (smp.pitchCorrection || 0);

              compiledZones.push({
                keyRange: [keyMin, keyMax],
                velRange: [velMin, velMax],
                sampleIndex: smpIdx,
                sampleName: smp.name,
                sample: smp,
                rootKey,
                fineTune,
                scaleTuning: iZone.scaleTuning ?? 100,
                sampleModes: iZone.sampleModes ?? 0,
                attenuation: (iZone.attenuation || 0) + (pZone.attenuation || 0)
              });
            }
          }
        }
      }

      compiledPresets.push({
        name: phdr.name,
        preset: phdr.preset,
        bank: phdr.bank,
        zones: compiledZones
      });
    }

    return compiledPresets;
  }
}

export class SF2Player {
  constructor(audioContext, masterDestination) {
    this.ctx = audioContext;
    this.dest = masterDestination;
    this.customSoundFonts = [];
    this.loadedSf2Data = new Map(); // id -> parsed SF2 data
    this.audioBufferCache = new Map(); // `${sf2Id}_${sampleIndex}` -> AudioBuffer
  }

  getAvailablePresets() {
    const userPresets = [];
    for (const [sf2Id, sfData] of this.loadedSf2Data.entries()) {
      if (sfData.compiledPresets && sfData.compiledPresets.length > 0) {
        sfData.compiledPresets.forEach((preset, pIdx) => {
          const bankStr = preset.bank > 0 ? ` [Bnk ${preset.bank}]` : '';
          userPresets.push({
            id: `sf2custom:${sf2Id}:${pIdx}`,
            name: `📦 [${sfData.fileName}] ${preset.name}${bankStr}`,
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
   * Carrega e analisa um arquivo .sf2 real do usuário de forma ultra rápida com lazy caching
   */
  async loadSoundFontFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const parsed = SF2Parser.parse(arrayBuffer);

    const sf2Id = `sf2_${Date.now()}`;
    parsed.fileName = file.name.replace(/\.sf2$/i, '');
    parsed.id = sf2Id;

    this.loadedSf2Data.set(sf2Id, parsed);
    console.log(`[SF2] Carregado "${file.name}": ${parsed.compiledPresets ? parsed.compiledPresets.length : 0} presets compilados, ${parsed.samples.length} samples brutos.`);
    return parsed;
  }

  /**
   * Decodifica sob demanda (lazy) o AudioBuffer do sample solicitado e o armazena em cache
   */
  _getOrCreateAudioBuffer(sf2Id, sampleIndex) {
    const cacheKey = `${sf2Id}_${sampleIndex}`;
    const cached = this.audioBufferCache.get(cacheKey);
    if (cached) return cached;

    const sfData = this.loadedSf2Data.get(sf2Id);
    if (!sfData || !sfData.smplBuffer || !sfData.samples[sampleIndex]) return null;

    const smp = sfData.samples[sampleIndex];
    const length = smp.end - smp.start;
    if (length <= 0 || smp.start + length > sfData.smplBuffer.length) return null;

    try {
      const audioBuffer = this.ctx.createBuffer(1, length, smp.sampleRate || 44100);
      const channelData = audioBuffer.getChannelData(0);
      const raw = sfData.smplBuffer;
      const start = smp.start;

      for (let i = 0; i < length; i++) {
        channelData[i] = raw[start + i] / 32768.0;
      }

      const item = { buffer: audioBuffer, sample: smp };
      this.audioBufferCache.set(cacheKey, item);
      return item;
    } catch (e) {
      console.warn(`[SF2] Erro ao decodificar buffer para sample ${smp.name}:`, e);
      return null;
    }
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
    if (!sfData) return false;

    // 1. Identifica o preset alvo
    let targetPreset = null;
    const presetIdx = parseInt(target, 10);
    if (!isNaN(presetIdx) && sfData.compiledPresets && sfData.compiledPresets[presetIdx]) {
      targetPreset = sfData.compiledPresets[presetIdx];
    } else if (sfData.compiledPresets && sfData.compiledPresets.length > 0) {
      targetPreset = sfData.compiledPresets[0];
    }

    if (!targetPreset || !targetPreset.zones || targetPreset.zones.length === 0) {
      // Fallback para samples brutos se o SF2 não tiver presets compilados
      if (sfData.samples && sfData.samples.length > 0) {
        let bestSample = null;
        let minDistance = 999;
        for (const smp of sfData.samples) {
          const dist = Math.abs(smp.originalPitch - midiNote);
          if (dist < minDistance) {
            minDistance = dist;
            bestSample = smp;
          }
        }
        if (bestSample) {
          const cached = this._getOrCreateAudioBuffer(sf2Id, bestSample.index);
          if (cached && cached.buffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = cached.buffer;
            const semitoneOffset = (midiNote - bestSample.originalPitch) + (bestSample.pitchCorrection / 100);
            source.playbackRate.setValueAtTime(Math.pow(2, semitoneOffset / 12), now);
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
              try { source.disconnect(); gainNode.disconnect(); } catch (_) {}
            }, (dur + 0.2) * 1000);
            return true;
          }
        }
      }
      return false;
    }

    // 2. Procura as zonas do preset que correspondem à nota MIDI e velocity
    const velMidi = Math.round(vel * 127);
    let matchingZones = targetPreset.zones.filter(z =>
      midiNote >= z.keyRange[0] && midiNote <= z.keyRange[1] &&
      velMidi >= z.velRange[0] && velMidi <= z.velRange[1]
    );

    // Fallback de velocity se não houver camada específica
    if (matchingZones.length === 0) {
      matchingZones = targetPreset.zones.filter(z =>
        midiNote >= z.keyRange[0] && midiNote <= z.keyRange[1]
      );
    }

    // Fallback de proximidade de nota DENTRO DO MESMO INSTRUMENTO se a nota estiver fora do range
    if (matchingZones.length === 0) {
      let closestZone = null;
      let minPitchDiff = 999;
      for (const z of targetPreset.zones) {
        const diff = Math.min(
          Math.abs(z.keyRange[0] - midiNote),
          Math.abs(z.keyRange[1] - midiNote),
          Math.abs(z.rootKey - midiNote)
        );
        if (diff < minPitchDiff) {
          minPitchDiff = diff;
          closestZone = z;
        }
      }
      if (closestZone) {
        matchingZones = [closestZone];
      }
    }

    if (matchingZones.length === 0) return false;

    // 3. Toca as zonas correspondentes (até 2 para stereo/layers)
    const zonesToPlay = matchingZones.slice(0, 2);
    let anyPlayed = false;

    for (const zone of zonesToPlay) {
      const cached = this._getOrCreateAudioBuffer(sf2Id, zone.sampleIndex);
      if (!cached || !cached.buffer) continue;

      const buffer = cached.buffer;
      const smp = cached.sample;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      // Pitch shifting preciso com afinação do SoundFont e da zona
      const rootKey = zone.rootKey ?? smp.originalPitch ?? 60;
      const fineTune = zone.fineTune || 0;
      const scaleTuning = (zone.scaleTuning ?? 100) / 100;
      const semitoneOffset = (midiNote - rootKey) * scaleTuning + (fineTune / 100);
      const playbackRate = Math.max(0.01, Math.pow(2, semitoneOffset / 12));
      source.playbackRate.setValueAtTime(playbackRate, now);

      // Looping se habilitado na amostra
      if (zone.sampleModes === 1 || zone.sampleModes === 3) {
        const loopStartSec = (smp.startLoop - smp.start) / smp.sampleRate;
        const loopEndSec = (smp.endLoop - smp.start) / smp.sampleRate;
        if (loopStartSec >= 0 && loopEndSec > loopStartSec && loopEndSec <= buffer.duration) {
          source.loop = true;
          source.loopStart = loopStartSec;
          source.loopEnd = loopEndSec;
        }
      }

      // Ganho e atenuação do SF2
      const attenDb = (zone.attenuation || 0) / 100; // centibels -> dB
      const attenLinear = Math.pow(10, -attenDb / 20);
      const gainNode = this.ctx.createGain();
      const peakGain = Math.min(1.0, 0.5 * vel * gainMultiplier * attenLinear);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.12);

      source.connect(gainNode);
      gainNode.connect(this.dest);

      source.start(now);
      source.stop(now + dur + 0.15);

      setTimeout(() => {
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch (_) {}
      }, (dur + 0.25) * 1000);

      anyPlayed = true;
    }

    return anyPlayed;
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
