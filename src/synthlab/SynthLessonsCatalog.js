/**
 * SynthLessonsCatalog.js
 * Catálogo de presets didáticos e lições interativas para o SOL Synth Lab.
 * Demonstra na prática os paradigmas de síntese e os 3 instrumentos clássicos do SOL.
 */

export const SYNTH_LESSONS = [
  {
    id: 'lesson_subtractive',
    title: '1. Síntese Subtrativa: Bassline Analógico',
    subtitle: 'Sawtooth cortante + Filtro Lowpass com Ressonância e Envelope',
    description: 'A base do Minimoog e dos synths analógicos clássicos. Uma onda dente de serra rica em harmônicos é lapidada por um filtro que fecha no tempo.',
    patch: {
      name: 'Analog Bassline (Saw + LP)',
      category: 'Bass',
      nodes: [
        { id: 'osc_1', type: 'oscillator', x: 80, y: 140, params: { waveform: 'sawtooth', octave: -1, detune: 0, gain: 0.9 } },
        { id: 'filter_1', type: 'filter', x: 380, y: 140, params: { filterType: 'lowpass', cutoff: 1400, resonance: 4.5, envAmount: 3200 } },
        { id: 'env_1', type: 'envelope', x: 80, y: 380, params: { attack: 0.008, decay: 0.28, sustain: 0.15, release: 0.12 } },
        { id: 'vca_1', type: 'vca', x: 660, y: 140, params: { gain: 0.85 } },
        { id: 'master_1', type: 'master', x: 920, y: 140, params: { volume: 0.85 } }
      ],
      cables: [
        { fromNode: 'osc_1', fromPort: 'audio_out', toNode: 'filter_1', toPort: 'audio_in' },
        { fromNode: 'env_1', fromPort: 'cv_out', toNode: 'filter_1', toPort: 'cutoff_cv' },
        { fromNode: 'env_1', fromPort: 'cv_out', toNode: 'vca_1', toPort: 'gain_cv' },
        { fromNode: 'filter_1', fromPort: 'audio_out', toNode: 'vca_1', toPort: 'audio_in' },
        { fromNode: 'vca_1', fromPort: 'audio_out', toNode: 'master_1', toPort: 'audio_in' }
      ]
    }
  },
  {
    id: 'lesson_pluck',
    title: '2. Síntese de Pluck: Cordas Beliscadas (Dual-Osc)',
    subtitle: 'Sawtooth + Triangle desafinados com decaimento espectral rápido',
    description: 'Emula o estalo mecânico de uma palheta ou corda solta. A desafinação sutil de +5 cents dá corpo acústico vivo, e o filtro despenca em milissegundos.',
    patch: {
      name: 'Cyber Pluck (Dual-Osc Detuned)',
      category: 'Pluck',
      nodes: [
        { id: 'osc_1', type: 'oscillator', x: 80, y: 100, params: { waveform: 'sawtooth', octave: 0, detune: 0, gain: 0.6 } },
        { id: 'osc_2', type: 'oscillator', x: 80, y: 280, params: { waveform: 'triangle', octave: 0, detune: 5, gain: 0.5 } },
        { id: 'mixer_1', type: 'mixer', x: 350, y: 160, params: { ch1: 0.6, ch2: 0.5, ch3: 0, ch4: 0 } },
        { id: 'filter_1', type: 'filter', x: 570, y: 160, params: { filterType: 'lowpass', cutoff: 800, resonance: 3.5, envAmount: 5000 } },
        { id: 'env_1', type: 'envelope', x: 350, y: 400, params: { attack: 0.003, decay: 0.22, sustain: 0.0, release: 0.15 } },
        { id: 'vca_1', type: 'vca', x: 790, y: 160, params: { gain: 0.8 } },
        { id: 'master_1', type: 'master', x: 1020, y: 160, params: { volume: 0.85 } }
      ],
      cables: [
        { fromNode: 'osc_1', fromPort: 'audio_out', toNode: 'mixer_1', toPort: 'in_1' },
        { fromNode: 'osc_2', fromPort: 'audio_out', toNode: 'mixer_1', toPort: 'in_2' },
        { fromNode: 'mixer_1', fromPort: 'audio_out', toNode: 'filter_1', toPort: 'audio_in' },
        { fromNode: 'env_1', fromPort: 'cv_out', toNode: 'filter_1', toPort: 'cutoff_cv' },
        { fromNode: 'env_1', fromPort: 'cv_out', toNode: 'vca_1', toPort: 'gain_cv' },
        { fromNode: 'filter_1', fromPort: 'audio_out', toNode: 'vca_1', toPort: 'audio_in' },
        { fromNode: 'vca_1', fromPort: 'audio_out', toNode: 'master_1', toPort: 'audio_in' }
      ]
    }
  },
  {
    id: 'lesson_fm_bell',
    title: '3. Síntese FM: Sino Metálico Cristalino (Yamaha DX7)',
    subtitle: 'Portadora Senoidal modulada por Moduladora em razão 3.5x',
    description: 'Demonstra a modulação de frequência de John Chowning. Duas ondas senoidais simples colidem para criar dezenas de harmônicos metálicos inarmônicos instantâneos.',
    patch: {
      name: 'Crystal FM Chime (Ratio 3.5x)',
      category: 'Bell / Mallet',
      nodes: [
        { id: 'mod_1', type: 'oscillator', x: 80, y: 120, params: { waveform: 'sine', octave: 0, ratio: 3.5, gain: 1.0 } },
        { id: 'fm_gain', type: 'vca', x: 340, y: 120, params: { gain: 1.0, depth: 850 } },
        { id: 'env_mod', type: 'envelope', x: 80, y: 350, params: { attack: 0.002, decay: 0.45, sustain: 0.05, release: 0.2 } },
        { id: 'carrier_1', type: 'oscillator', x: 570, y: 120, params: { waveform: 'sine', octave: 0, ratio: 1.0, gain: 1.0 } },
        { id: 'env_amp', type: 'envelope', x: 570, y: 350, params: { attack: 0.004, decay: 1.2, sustain: 0.0, release: 0.6 } },
        { id: 'vca_out', type: 'vca', x: 820, y: 120, params: { gain: 0.85 } },
        { id: 'master_1', type: 'master', x: 1040, y: 120, params: { volume: 0.85 } }
      ],
      cables: [
        { fromNode: 'mod_1', fromPort: 'audio_out', toNode: 'fm_gain', toPort: 'audio_in' },
        { fromNode: 'env_mod', fromPort: 'cv_out', toNode: 'fm_gain', toPort: 'gain_cv' },
        { fromNode: 'fm_gain', fromPort: 'audio_out', toNode: 'carrier_1', toPort: 'fm_in' },
        { fromNode: 'carrier_1', fromPort: 'audio_out', toNode: 'vca_out', toPort: 'audio_in' },
        { fromNode: 'env_amp', fromPort: 'cv_out', toNode: 'vca_out', toPort: 'gain_cv' },
        { fromNode: 'vca_out', fromPort: 'audio_out', toNode: 'master_1', toPort: 'audio_in' }
      ]
    }
  },
  {
    id: 'lesson_lfo_mod',
    title: '4. Modulação em Baixa Frequência: Vibrato & Tremolo (LFO)',
    subtitle: 'Oscilador sub-audível gerando ondulação periódica',
    description: 'Entenda a diferença didática: quando o LFO modula a frequência temos VIBRATO; quando modula o volume/amplitude temos TREMOLO.',
    patch: {
      name: 'Retro Space Synth (LFO Vibrato + Tremolo)',
      category: 'Lead / FX',
      nodes: [
        { id: 'lfo_1', type: 'lfo', x: 80, y: 120, params: { waveform: 'sine', frequency: 5.5, depth: 25 } },
        { id: 'osc_1', type: 'oscillator', x: 360, y: 120, params: { waveform: 'sawtooth', octave: 0, detune: 0, gain: 0.85 } },
        { id: 'lfo_tremolo', type: 'lfo', x: 80, y: 340, params: { waveform: 'triangle', frequency: 3.2, depth: 0.4 } },
        { id: 'vca_1', type: 'vca', x: 620, y: 120, params: { gain: 0.75 } },
        { id: 'env_1', type: 'envelope', x: 360, y: 340, params: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 0.4 } },
        { id: 'master_1', type: 'master', x: 880, y: 120, params: { volume: 0.85 } }
      ],
      cables: [
        { fromNode: 'lfo_1', fromPort: 'cv_out', toNode: 'osc_1', toPort: 'pitch_cv' },
        { fromNode: 'osc_1', fromPort: 'audio_out', toNode: 'vca_1', toPort: 'audio_in' },
        { fromNode: 'env_1', fromPort: 'cv_out', toNode: 'vca_1', toPort: 'gain_cv' },
        { fromNode: 'lfo_tremolo', fromPort: 'cv_out', toNode: 'vca_1', toPort: 'mod_cv' },
        { fromNode: 'vca_1', fromPort: 'audio_out', toNode: 'master_1', toPort: 'audio_in' }
      ]
    }
  },
  {
    id: 'lesson_percussion',
    title: '5. Síntese de Percussão: 808 Kick & Snare',
    subtitle: 'Ruído Branco + Queda de Pitch Exponencial',
    description: 'Como sintetizar tambores do zero: um tom senoidal que despenca a afinação em 50ms gera o Bumbo (Kick); ruído branco filtrado gera a Caixa (Snare).',
    patch: {
      name: '808 Synthetic Snare',
      category: 'Percussion',
      nodes: [
        { id: 'noise_1', type: 'noise', x: 80, y: 120, params: { noiseType: 'white', gain: 0.9 } },
        { id: 'filter_1', type: 'filter', x: 340, y: 120, params: { filterType: 'bandpass', cutoff: 2200, resonance: 2.0, envAmount: 1000 } },
        { id: 'env_noise', type: 'envelope', x: 80, y: 340, params: { attack: 0.001, decay: 0.16, sustain: 0.0, release: 0.08 } },
        { id: 'osc_tone', type: 'oscillator', x: 340, y: 340, params: { waveform: 'triangle', octave: -1, detune: 0, gain: 0.4 } },
        { id: 'mixer_1', type: 'mixer', x: 600, y: 160, params: { ch1: 0.8, ch2: 0.4, ch3: 0, ch4: 0 } },
        { id: 'vca_1', type: 'vca', x: 820, y: 160, params: { gain: 0.85 } },
        { id: 'master_1', type: 'master', x: 1040, y: 160, params: { volume: 0.85 } }
      ],
      cables: [
        { fromNode: 'noise_1', fromPort: 'audio_out', toNode: 'filter_1', toPort: 'audio_in' },
        { fromNode: 'filter_1', fromPort: 'audio_out', toNode: 'mixer_1', toPort: 'in_1' },
        { fromNode: 'osc_tone', fromPort: 'audio_out', toNode: 'mixer_1', toPort: 'in_2' },
        { fromNode: 'env_noise', fromPort: 'cv_out', toNode: 'vca_1', toPort: 'gain_cv' },
        { fromNode: 'mixer_1', fromPort: 'audio_out', toNode: 'vca_1', toPort: 'audio_in' },
        { fromNode: 'vca_1', fromPort: 'audio_out', toNode: 'master_1', toPort: 'audio_in' }
      ]
    }
  }
];
