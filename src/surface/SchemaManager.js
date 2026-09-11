/**
 * SchemaManager.js
 * Gerenciamento de esquemas/presets de pistas (Exportação/Importação em JSON,
 * Esquema Padrão em localStorage e Presets de Fábrica).
 */

export const FACTORY_DEFAULT_SCHEMA = {
  version: '1.0',
  timestamp: '2026-09-11T12:40:48.014Z',
  name: 'sol_schema_2026-09-11',
  fps: 30,
  autoRand: true,
  fxLevel: 0.25,
  tracks: [
    {
      id: 'track_1789130185891_1',
      name: 'Pista 1 - Sub Bass',
      inputChannel: 0,
      soundSource: 'sf2:slapbass',
      rootNote: 'C',
      rootOctave: 1,
      scaleKey: 'pentatonic_minor',
      octavesCount: 1,
      advanceMode: 'sequential_forward',
      notes: [
        'C1',
        'D#1',
        'F1',
        'G1',
        'A#1',
        'C2'
      ],
      velocity: 93,
      velocityMode: 'fixed',
      velocityRange: [80, 120],
      duration: 580,
      probability: 100,
      gain: 0.9,
      mute: false,
      solo: false
    },
    {
      id: 'track_1789130185891_2',
      name: 'Pista 2 - Bassline',
      inputChannel: 2,
      soundSource: 'synth:saw',
      rootNote: 'C',
      rootOctave: 2,
      scaleKey: 'pentatonic_minor',
      octavesCount: 1,
      advanceMode: 'sequential_forward',
      notes: [
        'C2',
        'D#2',
        'F2',
        'G2',
        'A#2',
        'C3'
      ],
      velocity: 95,
      velocityMode: 'fixed',
      velocityRange: [70, 110],
      duration: 250,
      probability: 100,
      gain: 0.85,
      mute: false,
      solo: false
    },
    {
      id: 'track_1789130185891_3',
      name: 'Pista 3 - Pluck Mid',
      inputChannel: 6,
      soundSource: 'synth:pluck',
      rootNote: 'C',
      rootOctave: 3,
      scaleKey: 'chromatic',
      octavesCount: 2,
      advanceMode: 'pendulum',
      notes: [
        'C3',
        'C#3',
        'D3',
        'D#3',
        'E3',
        'F3',
        'F#3',
        'G3',
        'G#3',
        'A3',
        'A#3',
        'B3',
        'C4',
        'C#4',
        'D4',
        'D#4',
        'E4',
        'F4',
        'F#4',
        'G4',
        'G#4',
        'A4',
        'A#4',
        'B4',
        'C5'
      ],
      velocity: 85,
      velocityMode: 'random_range',
      velocityRange: [65, 105],
      duration: 180,
      probability: 90,
      gain: 0.75,
      mute: false,
      solo: false
    },
    {
      id: 'track_1789130185891_4',
      name: 'Pista 4 - Arp High',
      inputChannel: 12,
      soundSource: 'sf2:epiano',
      rootNote: 'C',
      rootOctave: 4,
      scaleKey: 'pentatonic_minor',
      octavesCount: 2,
      advanceMode: 'random',
      notes: [
        'C4',
        'D#4',
        'F4',
        'G4',
        'A#4',
        'C5',
        'D#5',
        'F5',
        'G5',
        'A#5',
        'C6'
      ],
      velocity: 80,
      velocityMode: 'random_range',
      velocityRange: [60, 100],
      duration: 120,
      probability: 85,
      gain: 0.7,
      mute: false,
      solo: false
    },
    {
      id: 'track_1789130185891_5',
      name: 'Pista 5 - Chime Top',
      inputChannel: 18,
      soundSource: 'sf2:strings',
      rootNote: 'C',
      rootOctave: 5,
      scaleKey: 'chromatic',
      octavesCount: 1,
      advanceMode: 'sequential_forward',
      notes: [
        'C5',
        'C#5',
        'D5',
        'D#5',
        'E5',
        'F5',
        'F#5',
        'G5',
        'G#5',
        'A5',
        'A#5',
        'B5',
        'C6'
      ],
      velocity: 90,
      velocityMode: 'fixed',
      velocityRange: [70, 110],
      duration: 400,
      probability: 75,
      gain: 0.65,
      mute: false,
      solo: false
    }
  ]
};

const STORAGE_KEY = 'sol_default_schema_v1';

export class SchemaManager {
  /**
   * Exporta a configuração atual para um arquivo .sol.json baixado no navegador
   */
  static exportToFile(trackManager, solCore, soundEngine = null, filename = 'sound_of_life_schema.sol.json') {
    const schema = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      name: filename.replace('.sol.json', '').replace('.json', ''),
      fps: solCore ? solCore.targetFps : 30,
      autoRand: solCore ? solCore.autoRand : true,
      fxLevel: soundEngine ? soundEngine.getFxLevel() : 0.25,
      tracks: trackManager.toJSON()
    };

    const jsonStr = JSON.stringify(schema, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : `${filename}.sol.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importa um arquivo JSON de esquema
   */
  static async importFromFile(file, trackManager, solCore, soundEngine = null) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const schema = JSON.parse(e.target.result);
          this.applySchema(schema, trackManager, solCore, soundEngine);
          resolve(schema);
        } catch (err) {
          reject(new Error(`Arquivo JSON inválido: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsText(file);
    });
  }

  /**
   * Aplica um objeto de esquema ao TrackManager, SolCore e SoundEngine
   */
  static applySchema(schema, trackManager, solCore, soundEngine = null) {
    if (!schema || !Array.isArray(schema.tracks)) {
      throw new Error('Formato de esquema inválido.');
    }

    if (solCore) {
      if (schema.fps) {
        solCore.setFps(schema.fps);
      }
      if (schema.autoRand !== undefined) {
        solCore.setAutoRand(schema.autoRand);
      }
    }

    if (soundEngine) {
      soundEngine.setFxLevel(schema.fxLevel !== undefined ? schema.fxLevel : 0.25);
    }

    trackManager.fromJSON(schema.tracks);
  }

  /**
   * Salva o esquema atual como Esquema Padrão no localStorage
   */
  static saveAsDefault(trackManager, solCore, soundEngine = null) {
    const schema = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      name: 'Esquema Padrão do Usuário',
      fps: solCore ? solCore.targetFps : 30,
      fxLevel: soundEngine ? soundEngine.getFxLevel() : 0.25,
      tracks: trackManager.toJSON()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
    return true;
  }

  /**
   * Carrega o esquema padrão oficial de fábrica
   */
  static loadDefault(trackManager, solCore, soundEngine = null) {
    this.applySchema(FACTORY_DEFAULT_SCHEMA, trackManager, solCore, soundEngine);
    return FACTORY_DEFAULT_SCHEMA;
  }

  /**
   * Restaura o esquema original de fábrica
   */
  static resetToFactory(trackManager, solCore, soundEngine = null) {
    this.applySchema(FACTORY_DEFAULT_SCHEMA, trackManager, solCore, soundEngine);
  }
}
