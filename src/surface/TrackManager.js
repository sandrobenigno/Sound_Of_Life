/**
 * TrackManager.js
 * Gerencia a lista de até 24 instâncias de Track.
 * Responsável pelo roteamento dos 24 pontos de entrada do SOL para as pistas criadas.
 */

import { Track } from './Track.js';

export const MAX_TRACKS = 24;

export class TrackManager {
  constructor(soundEngine = null) {
    this.soundEngine = soundEngine;
    this.tracks = [];
    this.listeners = new Set();
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyChange() {
    for (const cb of this.listeners) {
      try {
        cb(this.tracks);
      } catch (e) {
        console.error('Erro no callback do TrackManager:', e);
      }
    }
  }

  get count() {
    return this.tracks.length;
  }

  getMappedInputChannels() {
    const set = new Set();
    for (const t of this.tracks) {
      set.add(t.inputChannel);
    }
    return set;
  }

  getAvailableInputChannels() {
    const mapped = this.getMappedInputChannels();
    const available = [];
    for (let i = 0; i < MAX_TRACKS; i++) {
      if (!mapped.has(i)) {
        available.push(i);
      }
    }
    return available;
  }

  getFirstAvailableChannel() {
    const avail = this.getAvailableInputChannels();
    return avail.length > 0 ? avail[0] : 0;
  }

  insertTrack(config = {}, index = this.tracks.length) {
    if (this.tracks.length >= MAX_TRACKS) {
      console.warn(`Limite máximo de ${MAX_TRACKS} pistas atingido.`);
      return null;
    }

    const inputChannel = config.inputChannel !== undefined
      ? config.inputChannel
      : this.getFirstAvailableChannel();

    const defaultName = config.name || `Pista ${inputChannel + 1}`;

    const track = new Track({
      ...config,
      inputChannel,
      name: defaultName
    });

    const targetIdx = Math.max(0, Math.min(this.tracks.length, index));
    this.tracks.splice(targetIdx, 0, track);
    this.notifyChange();
    return track;
  }

  addTrack(config = {}) {
    return this.insertTrack(config, this.tracks.length);
  }

  removeTrack(trackId) {
    const initialLen = this.tracks.length;
    this.tracks = this.tracks.filter(t => t.id !== trackId);
    if (this.tracks.length !== initialLen) {
      this.notifyChange();
      return true;
    }
    return false;
  }

  duplicateTrack(trackId) {
    if (this.tracks.length >= MAX_TRACKS) return null;
    const origIndex = this.tracks.findIndex(t => t.id === trackId);
    if (origIndex === -1) return null;
    const orig = this.tracks[origIndex];

    const json = orig.toJSON();
    delete json.id;
    json.name = `${orig.name} (Cópia)`;
    json.inputChannel = this.getFirstAvailableChannel();

    // Insere a nova pista duplicada imediatamente abaixo da original
    return this.insertTrack(json, origIndex + 1);
  }

  getTrack(trackId) {
    return this.tracks.find(t => t.id === trackId) || null;
  }

  reorder(fromIndex, toIndex) {
    if (
      fromIndex < 0 || fromIndex >= this.tracks.length ||
      toIndex < 0 || toIndex >= this.tracks.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [moved] = this.tracks.splice(fromIndex, 1);
    this.tracks.splice(toIndex, 0, moved);
    this.notifyChange();
  }

  clearAll() {
    this.tracks = [];
    this.notifyChange();
  }

  /**
   * Processa o evento de varredura do radar disparado pelo SOL Core
   */
  onSolStep(eventData) {
    if (!eventData || !eventData.trackStates) return [];

    const anySoloActive = this.tracks.some(t => t.solo);
    const triggeredEvents = [];

    // Dispara apenas as pistas mapeadas para canais atualmente ativos no radar
    for (const track of this.tracks) {
      const ch = track.inputChannel;
      if (ch >= 0 && ch < eventData.trackStates.length && eventData.trackStates[ch]) {
        const triggerResult = track.processTrigger(eventData, this.soundEngine, anySoloActive);
        if (triggerResult) {
          triggeredEvents.push(triggerResult);
        }
      } else {
        track.isTriggered = false;
      }
    }

    return triggeredEvents;
  }

  toJSON() {
    return this.tracks.map(t => t.toJSON());
  }

  fromJSON(tracksData) {
    this.tracks = [];
    if (Array.isArray(tracksData)) {
      for (const tData of tracksData.slice(0, MAX_TRACKS)) {
        this.tracks.push(Track.fromJSON(tData));
      }
    }
    this.notifyChange();
  }
}
