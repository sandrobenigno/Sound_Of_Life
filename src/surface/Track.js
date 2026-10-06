/**
 * Track.js
 * Classe Track individual representando uma pista de áudio associada a um ponto de entrada do SOL (0 a 23).
 */

import { CircularList } from './CircularList.js';
import { ScaleCatalog } from './ScaleCatalog.js';

let trackIdCounter = 1;

export class Track {
  constructor(config = {}) {
    this.id = config.id || `track_${Date.now()}_${trackIdCounter++}`;

    // Canais de entrada do SOL (0 a 23)
    if (Array.isArray(config.inputChannels) && config.inputChannels.length > 0) {
      this.inputChannels = Array.from(new Set(config.inputChannels.map(Number)))
        .filter(c => !isNaN(c) && c >= 0 && c < 24)
        .sort((a, b) => a - b);
      if (this.inputChannels.length === 0) this.inputChannels = [0];
    } else if (config.inputChannel !== undefined) {
      const ch = parseInt(config.inputChannel, 10);
      this.inputChannels = (!isNaN(ch) && ch >= 0 && ch < 24) ? [ch] : [0];
    } else {
      this.inputChannels = [0];
    }

    const firstCh = this.inputChannels[0];
    this.name = config.name || `Pista ${firstCh + 1}`;

    // Fonte Sonora (Synth interno ou SoundFont SF2)
    this.soundSource = config.soundSource || 'synth:saw'; // synth:sine, synth:triangle, synth:saw, synth:square, synth:pluck, synth:bell, sf2:0, sf2:1, etc.

    // Configuração de Escala & Lista Circular
    this.rootNote = config.rootNote || 'C';
    this.rootOctave = config.rootOctave !== undefined ? config.rootOctave : 3;
    this.scaleKey = config.scaleKey || 'pentatonic_minor';
    this.octavesCount = config.octavesCount !== undefined ? config.octavesCount : 2;

    this.advanceMode = config.advanceMode || 'sequential_forward'; // sequential_forward, sequential_backward, random, pendulum, direct
    this.circularList = new CircularList([], this.advanceMode);

    if (config.notes && Array.isArray(config.notes) && config.notes.length > 0) {
      this.circularList.setItems(config.notes);
    } else {
      this.rebuildNotesFromScale();
    }

    // Dinâmica e Articulação
    this.velocity = config.velocity !== undefined ? config.velocity : 90; // 1 a 127
    this.velocityMode = config.velocityMode || 'fixed'; // fixed, random_range, radius_scaled
    this.velocityRange = config.velocityRange || [60, 110];
    this.duration = config.duration !== undefined ? config.duration : 220; // em milissegundos
    this.probability = config.probability !== undefined ? config.probability : 100; // 0 a 100%

    // Mixagem
    this.gain = config.gain !== undefined ? config.gain : 0.8;
    this.mute = config.mute ?? false;
    this.solo = config.solo ?? false;

    // Estado visual transitório
    this.isTriggered = false;
    this.lastTriggerNote = null;
    this.lastTriggerTime = 0;
    this.lastTriggerChannel = firstCh;
  }

  get inputChannel() {
    return this.inputChannels[0] ?? 0;
  }

  set inputChannel(val) {
    const ch = parseInt(val, 10);
    if (!isNaN(ch) && ch >= 0 && ch < 24) {
      this.inputChannels = [ch];
    }
  }

  hasChannel(channelIndex) {
    return this.inputChannels.includes(channelIndex);
  }

  toggleChannel(channelIndex) {
    const ch = parseInt(channelIndex, 10);
    if (isNaN(ch) || ch < 0 || ch >= 24) return;
    if (this.inputChannels.includes(ch)) {
      if (this.inputChannels.length > 1) {
        this.inputChannels = this.inputChannels.filter(c => c !== ch);
      }
    } else {
      this.inputChannels = [...this.inputChannels, ch].sort((a, b) => a - b);
    }
  }

  setInputChannels(channelsArray) {
    if (!Array.isArray(channelsArray) || channelsArray.length === 0) {
      this.inputChannels = [0];
      return;
    }
    const clean = Array.from(new Set(channelsArray.map(Number)))
      .filter(c => !isNaN(c) && c >= 0 && c < 24)
      .sort((a, b) => a - b);
    this.inputChannels = clean.length > 0 ? clean : [0];
  }

  getChannelSummary() {
    if (!this.inputChannels || this.inputChannels.length === 0) return 'Nenhum';
    if (this.inputChannels.length === 24) return 'Todos (24)';
    if (this.inputChannels.length === 1) return `CH ${this.inputChannels[0] + 1}`;
    if (this.inputChannels.length <= 3) {
      return `CH ${this.inputChannels.map(c => c + 1).join(', ')}`;
    }
    return `${this.inputChannels.length} Canais (${this.inputChannels.slice(0, 2).map(c => c + 1).join(',') }...)`;
  }

  rebuildNotesFromScale() {
    if (this.scaleKey === 'custom') return;
    const notes = ScaleCatalog.generateScaleNotes(
      this.rootNote,
      this.rootOctave,
      this.scaleKey,
      this.octavesCount
    );
    this.circularList.setItems(notes);
  }

  setCustomNotes(notesArrayOrStr) {
    const validNotes = ScaleCatalog.parseNoteList(notesArrayOrStr);
    if (validNotes.length > 0) {
      this.scaleKey = 'custom';
      this.circularList.setItems(validNotes);
    }
  }

  getNotes() {
    return this.circularList.getItems();
  }

  /**
   * Processa um gatilho recebido do SOL Core
   */
  processTrigger(eventData, soundEngine, anySoloActive = false, triggeringChannel = null) {
    // 1. Verificações de Mute / Solo
    if (this.mute) return null;
    if (anySoloActive && !this.solo) return null;

    // 2. Probabilidade de disparo
    if (this.probability < 100 && (Math.random() * 100) > this.probability) {
      return null;
    }

    // 3. Obtenção da próxima nota na lista circular
    const note = this.circularList.next(this.advanceMode, eventData.sliceIndex);
    if (!note) return null;

    // 4. Cálculo da Velocity
    const activeCh = triggeringChannel !== null ? triggeringChannel : this.inputChannel;
    let vel = this.velocity;
    if (this.velocityMode === 'random_range') {
      const [minV, maxV] = this.velocityRange;
      vel = Math.floor(minV + Math.random() * (maxV - minV));
    } else if (this.velocityMode === 'radius_scaled') {
      // 24 canais: quanto mais externo, maior
      vel = Math.floor(40 + (activeCh / 23) * 80);
    }
    vel = Math.max(1, Math.min(127, vel));

    // 5. Disparo no Sound Engine
    if (soundEngine) {
      soundEngine.playNote({
        note: note,
        velocity: vel,
        duration: this.duration,
        soundSource: this.soundSource,
        gain: this.gain,
        channel: activeCh
      });
    }

    // Feedback visual
    this.isTriggered = true;
    this.lastTriggerNote = note;
    this.lastTriggerTime = Date.now();
    this.lastTriggerChannel = activeCh;

    return {
      trackId: this.id,
      inputChannel: activeCh,
      inputChannels: [...this.inputChannels],
      note,
      velocity: vel,
      duration: this.duration
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      inputChannel: this.inputChannel,
      inputChannels: [...this.inputChannels],
      soundSource: this.soundSource,
      rootNote: this.rootNote,
      rootOctave: this.rootOctave,
      scaleKey: this.scaleKey,
      octavesCount: this.octavesCount,
      advanceMode: this.advanceMode,
      notes: this.getNotes(),
      velocity: this.velocity,
      velocityMode: this.velocityMode,
      velocityRange: [...this.velocityRange],
      duration: this.duration,
      probability: this.probability,
      gain: this.gain,
      mute: this.mute,
      solo: this.solo
    };
  }

  static fromJSON(data) {
    return new Track(data);
  }
}
