/**
 * SchemaManager.js
 * Gerenciamento de esquemas/presets de pistas (Exportação/Importação em JSON,
 * Esquema Padrão em localStorage e Presets de Fábrica).
 */

export const FACTORY_DEFAULT_SCHEMA = {
  version: '1.0',
  name: 'Esquema Padrão SOL',
  bpm: 30,
  tracks: [
    {
      name: 'Pista 1 - Sub Bass',
      inputChannel: 0,
      soundSource: 'synth:triangle',
      rootNote: 'C',
      rootOctave: 1,
      scaleKey: 'pentatonic_minor',
      octavesCount: 1,
      advanceMode: 'sequential_forward',
      velocity: 110,
      velocityMode: 'fixed',
      velocityRange: [80, 120],
      duration: 350,
      probability: 100,
      gain: 0.9,
      mute: false,
      solo: false
    },
    {
      name: 'Pista 2 - Bassline',
      inputChannel: 2,
      soundSource: 'synth:saw',
      rootNote: 'C',
      rootOctave: 2,
      scaleKey: 'pentatonic_minor',
      octavesCount: 1,
      advanceMode: 'sequential_forward',
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
      name: 'Pista 3 - Pluck Mid',
      inputChannel: 6,
      soundSource: 'synth:pluck',
      rootNote: 'C',
      rootOctave: 3,
      scaleKey: 'pentatonic_minor',
      octavesCount: 2,
      advanceMode: 'pendulum',
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
      name: 'Pista 4 - Arp High',
      inputChannel: 12,
      soundSource: 'synth:square',
      rootNote: 'C',
      rootOctave: 4,
      scaleKey: 'pentatonic_minor',
      octavesCount: 2,
      advanceMode: 'random',
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
      name: 'Pista 5 - Chime Top',
      inputChannel: 18,
      soundSource: 'synth:bell',
      rootNote: 'C',
      rootOctave: 5,
      scaleKey: 'pentatonic_minor',
      octavesCount: 1,
      advanceMode: 'sequential_forward',
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
  static exportToFile(trackManager, solCore, filename = 'sound_of_life_schema.sol.json') {
    const schema = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      name: filename.replace('.sol.json', '').replace('.json', ''),
      fps: solCore ? solCore.targetFps : 30,
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
  static async importFromFile(file, trackManager, solCore) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const schema = JSON.parse(e.target.result);
          this.applySchema(schema, trackManager, solCore);
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
   * Aplica um objeto de esquema ao TrackManager e ao SolCore
   */
  static applySchema(schema, trackManager, solCore) {
    if (!schema || !Array.isArray(schema.tracks)) {
      throw new Error('Formato de esquema inválido.');
    }

    if (solCore && schema.fps) {
      solCore.setFps(schema.fps);
    }

    trackManager.fromJSON(schema.tracks);
  }

  /**
   * Salva o esquema atual como Esquema Padrão no localStorage
   */
  static saveAsDefault(trackManager, solCore) {
    const schema = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      name: 'Esquema Padrão do Usuário',
      fps: solCore ? solCore.targetFps : 30,
      tracks: trackManager.toJSON()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
    return true;
  }

  /**
   * Carrega o esquema padrão (do localStorage ou de fábrica)
   */
  static loadDefault(trackManager, solCore) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const schema = JSON.parse(saved);
        this.applySchema(schema, trackManager, solCore);
        return schema;
      }
    } catch (e) {
      console.warn('Erro ao carregar esquema salvo, usando padrão de fábrica:', e);
    }

    // Fallback: Factory Default
    this.applySchema(FACTORY_DEFAULT_SCHEMA, trackManager, solCore);
    return FACTORY_DEFAULT_SCHEMA;
  }

  /**
   * Restaura o esquema original de fábrica
   */
  static resetToFactory(trackManager, solCore) {
    localStorage.removeItem(STORAGE_KEY);
    this.applySchema(FACTORY_DEFAULT_SCHEMA, trackManager, solCore);
  }
}
