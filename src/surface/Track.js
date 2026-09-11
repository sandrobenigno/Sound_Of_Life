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
    this.name = config.name || `Pista ${config.inputChannel !== undefined ? config.inputChannel + 1 : 1}`;
    this.inputChannel = config.inputChannel !== undefined ? config.inputChannel : 0; // 0 a 23

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
  processTrigger(eventData, soundEngine, anySoloActive = false) {
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
    let vel = this.velocity;
    if (this.velocityMode === 'random_range') {
      const [minV, maxV] = this.velocityRange;
      vel = Math.floor(minV + Math.random() * (maxV - minV));
    } else if (this.velocityMode === 'radius_scaled') {
      // 24 canais: quanto mais externo, maior ou menor
      vel = Math.floor(40 + (this.inputChannel / 23) * 80);
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
        channel: this.inputChannel
      });
    }

    // Feedback visual
    this.isTriggered = true;
    this.lastTriggerNote = note;
    this.lastTriggerTime = Date.now();

    return {
      trackId: this.id,
      inputChannel: this.inputChannel,
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
