/**
 * ScaleCatalog.js
 * Teoria musical, gerador de escalas e conversor de notas/frequências/MIDI.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = {
  pentatonic_minor: { name: 'Pentatônica Menor', intervals: [0, 3, 5, 7, 10] },
  pentatonic_major: { name: 'Pentatônica Maior', intervals: [0, 2, 4, 7, 9] },
  minor: { name: 'Menor Natural (Eólio)', intervals: [0, 2, 3, 5, 7, 8, 10] },
  major: { name: 'Maior (Jônio)', intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian: { name: 'Dórico', intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: 'Frígio', intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: 'Lídio', intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: 'Mixolídio', intervals: [0, 2, 4, 5, 7, 9, 10] },
  harmonic_minor: { name: 'Menor Harmônica', intervals: [0, 2, 3, 5, 7, 8, 11] },
  blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  hirajoshi: { name: 'Hirajoshi (Japonesa)', intervals: [0, 2, 3, 7, 8] },
  insen: { name: 'Insen (Japonesa)', intervals: [0, 1, 5, 7, 10] },
  arabic: { name: 'Árabe / Double Harmonic', intervals: [0, 1, 4, 5, 7, 8, 11] },
  whole_tone: { name: 'Tons Inteiros', intervals: [0, 2, 4, 6, 8, 10] },
  chromatic: { name: 'Cromática', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  custom: { name: 'Personalizada (Manual)', intervals: [] }
};

export class ScaleCatalog {
  static noteToMidi(noteStr) {
    if (typeof noteStr !== 'string') return 60;
    const match = noteStr.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
    if (!match) return 60;

    let [, name, oct] = match;
    name = name.toUpperCase();
    if (name === 'DB') name = 'C#';
    if (name === 'EB') name = 'D#';
    if (name === 'GB') name = 'F#';
    if (name === 'AB') name = 'G#';
    if (name === 'BB') name = 'A#';

    const noteIndex = NOTE_NAMES.indexOf(name);
    if (noteIndex === -1) return 60;

    const octave = parseInt(oct, 10);
    return (octave + 1) * 12 + noteIndex;
  }

  static midiToNote(midi) {
    const noteIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
  }

  static midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  static noteToFreq(noteStr) {
    return this.midiToFreq(this.noteToMidi(noteStr));
  }

  /**
   * Gera um array de nomes de notas para uma escala e extensão de oitavas
   */
  static generateScaleNotes(root = 'C', rootOctave = 3, scaleKey = 'pentatonic_minor', octavesCount = 2) {
    const scale = SCALES[scaleKey] || SCALES.pentatonic_minor;
    if (scaleKey === 'custom' || !scale.intervals.length) {
      return ['C3', 'D#3', 'F3', 'G3', 'A#3', 'C4'];
    }

    const baseMidi = this.noteToMidi(`${root}${rootOctave}`);
    const notes = [];

    for (let oct = 0; oct < octavesCount; oct++) {
      for (const interval of scale.intervals) {
        const midi = baseMidi + (oct * 12) + interval;
        if (midi <= 127) {
          notes.push(this.midiToNote(midi));
        }
      }
    }

    // Adiciona a nota fundamental da oitava final para fechar o ciclo
    const topMidi = baseMidi + (octavesCount * 12);
    if (topMidi <= 127) {
      notes.push(this.midiToNote(topMidi));
    }

    return notes;
  }

  static parseNoteList(input) {
    const rawList = Array.isArray(input)
      ? input
      : (typeof input === 'string' ? input.trim().split(/[,\s]+/) : []);

    const result = [];
    for (const item of rawList) {
      if (!item) continue;
      const match = item.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
      if (match) {
        const midi = this.noteToMidi(item);
        if (!isNaN(midi) && midi >= 0 && midi <= 127) {
          result.push(this.midiToNote(midi));
        }
      }
    }
    return result;
  }
}
