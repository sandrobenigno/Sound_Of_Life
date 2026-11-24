/**
 * SequencerTrackManager.js
 * Gerencia as pistas de áudio associadas aos anéis concêntricos do Sequenciador Polar.
 * Cada pista representa uma voz com seu próprio timbre, ganho, mute e solo,
 * e dispara a nota específica gravada na célula do anel correspondente.
 */

export class SequencerTrack {
  constructor(config = {}) {
    this.ringIndex = config.ringIndex !== undefined ? config.ringIndex : 0;
    this.name = config.name || `Anel ${this.ringIndex + 1}`;
    this.soundSource = config.soundSource || 'synth:saw';
    this.gain = config.gain !== undefined ? config.gain : 0.8;
    this.duration = config.duration !== undefined ? config.duration : 220;
    this.mute = config.mute ?? false;
    this.solo = config.solo ?? false;

    this.isTriggered = false;
    this.lastTriggerNote = null;
    this.lastTriggerTime = 0;
  }

  toJSON() {
    return {
      ringIndex: this.ringIndex,
      name: this.name,
      soundSource: this.soundSource,
      gain: this.gain,
      duration: this.duration,
      mute: this.mute,
      solo: this.solo
    };
  }
}

export class SequencerTrackManager {
  constructor(core, soundEngine, palette = null) {
    this.core = core;
    this.soundEngine = soundEngine;
    this.palette = palette;

    this.tracks = [];
    this.listeners = new Set();

    this._syncTracksWithRings();

    // Sincroniza se a resolução do disco mudar
    this.core.onChange(() => {
      if (this.tracks.length !== this.core.rings) {
        this._syncTracksWithRings();
        this.notifyChange();
      }
    });

    // Escuta disparos a cada passo do feixe de varredura
    this.core.onStep((eventData) => this.onSequencerStep(eventData));
  }

  _syncTracksWithRings() {
    const targetRings = this.core.rings;
    const oldTracks = this.tracks;
    this.tracks = [];

    const defaultSounds = [
      'synth:saw',     // Anel 1 (Grave)
      'sf2:slapbass',  // Anel 2
      'synth:square',  // Anel 3
      'sf2:piano',     // Anel 4
      'synth:pluck',   // Anel 5
      'sf2:rhodes',    // Anel 6
      'sf2:marimba',   // Anel 7
      'synth:bell',    // Anel 8 (Agudo)
      'synth:sine',
      'sf2:strings',
      'sf2:brass',
      'sf2:celesta'
    ];

    for (let r = 0; r < targetRings; r++) {
      if (r < oldTracks.length) {
        this.tracks.push(oldTracks[r]);
      } else {
        const sound = defaultSounds[r % defaultSounds.length];
        this.tracks.push(new SequencerTrack({
          ringIndex: r,
          name: `Anel ${r + 1}`,
          soundSource: sound,
          gain: 0.85,
          duration: 220
        }));
      }
    }
  }

  onSequencerStep(eventData) {
    if (!eventData || !eventData.ringEvents || !this.soundEngine) return;

    const anySolo = this.tracks.some(t => t.solo);

    for (const ev of eventData.ringEvents) {
      const track = this.tracks[ev.ring];
      if (!track) continue;

      if (track.mute) continue;
      if (anySolo && !track.solo) continue;

      // Dispara a nota exata na SoundEngine usando o instrumento desta pista
      const noteDuration = (eventData.stepDurationMs * (ev.durRatio || 1.0));

      this.soundEngine.playNote({
        note: ev.note,
        velocity: ev.vel,
        duration: Math.max(50, noteDuration),
        soundSource: track.soundSource,
        gain: track.gain,
        channel: track.ringIndex
      });

      // Feedback visual na pista
      track.isTriggered = true;
      track.lastTriggerNote = ev.note;
      track.lastTriggerTime = Date.now();

      // Pisca a tecla correspondente no teclado do piano
      if (this.palette) {
        this.palette.flashKey(ev.note);
      }
    }
  }

  getTrack(ringIndex) {
    return this.tracks[ringIndex] || null;
  }

  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  notifyChange() {
    for (const cb of this.listeners) {
      try { cb(this.tracks); } catch (_) {}
    }
  }

  toJSON() {
    return this.tracks.map(t => t.toJSON());
  }

  fromJSON(tracksData) {
    if (!Array.isArray(tracksData)) return;
    for (let i = 0; i < tracksData.length && i < this.tracks.length; i++) {
      const d = tracksData[i];
      const t = this.tracks[i];
      if (d.name) t.name = d.name;
      if (d.soundSource) t.soundSource = d.soundSource;
      if (d.gain !== undefined) t.gain = d.gain;
      if (d.duration !== undefined) t.duration = d.duration;
      if (d.mute !== undefined) t.mute = d.mute;
      if (d.solo !== undefined) t.solo = d.solo;
    }
    this.notifyChange();
  }
}
