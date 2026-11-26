/**
 * mainSynthLab.js
 * Ponto de entrada e orquestrador do SOL Synth Lab.
 * Conecta a bancada modular, o inspector de modulação, o teclado ao vivo e a exportação para o SOL.
 */

import { SynthGraphModel } from './SynthGraphModel.js';
import { SynthAudioBridge } from './SynthAudioBridge.js';
import { SynthCanvasView } from './SynthCanvasView.js';
import { ModulationInspectorView } from './ModulationInspectorView.js';
import { SYNTH_LESSONS } from './SynthLessonsCatalog.js';
import { ScaleCatalog } from '../surface/ScaleCatalog.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('🧪 Inicializando SOL Synth Lab (Síntese Modular Web)...');

  // 1. Inicializa o Modelo e a Ponte de Áudio Web Audio API
  const model = new SynthGraphModel();
  const bridge = new SynthAudioBridge(model);

  // 2. Monta o Canvas Interativo com Cabos Bézier
  const canvasContainer = document.getElementById('synthCanvasContainer');
  const canvasView = new SynthCanvasView(canvasContainer, model, bridge);

  // 3. Monta o Inspetor de Modulação "Antes ➔ Função ➔ Depois"
  const inspectorContainer = document.getElementById('inspectorContainer');
  const inspectorView = new ModulationInspectorView(inspectorContainer, bridge, model);

  // 4. Carrega a Lição / Preset Inicial (Subtrativo Analógico)
  _loadLessonPreset(SYNTH_LESSONS[0], model, inspectorView);

  // 5. Barra de Adicionar Nós
  document.querySelectorAll('.btn-add-node').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.nodeType;
      // Adiciona próximo ao centro visível
      const posX = 150 + Math.random() * 200;
      const posY = 100 + Math.random() * 150;
      model.addNode(type, posX, posY);
    });
  });

  // 6. Seletor de Lições Didáticas
  const selectLesson = document.getElementById('selectLesson');
  if (selectLesson) {
    selectLesson.innerHTML = SYNTH_LESSONS.map((l, idx) => `
      <option value="${l.id}">${l.title}</option>
    `).join('');

    selectLesson.addEventListener('change', (e) => {
      const lesson = SYNTH_LESSONS.find(l => l.id === e.target.value);
      if (lesson) {
        _loadLessonPreset(lesson, model, inspectorView);
      }
    });
  }

  // 7. Exportar para o Sound of Life (.solsynth.json)
  const btnExport = document.getElementById('btnExportPatch');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const patchData = model.toJSON();
      const jsonStr = JSON.stringify(patchData, null, 2);

      // Salva no localStorage para acesso imediato no mesmo navegador
      try {
        localStorage.setItem('solsynth_latest_patch', jsonStr);
      } catch (_) {}

      // Baixa arquivo físico
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${patchData.name.toLowerCase().replace(/\s+/g, '_')}_patch.solsynth.json`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`✅ Timbre "${patchData.name}" exportado!\nSalvo no arquivo .solsynth.json e armazenado na memória da sessão para o Sequenciador Polar.`);
    });
  }

  // 8. Importar Patch (.solsynth.json)
  const btnImport = document.getElementById('btnImportPatch');
  const fileInput = document.getElementById('fileInputPatch');

  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target.result);
          model.fromJSON(json);
          alert(`Patch "${json.name}" carregado com sucesso!`);
        } catch (err) {
          alert(`Erro ao abrir patch: ${err.message}`);
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  // 9. Limpar Bancada
  const btnClear = document.getElementById('btnClearCanvas');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (confirm('Deseja limpar todos os nós da bancada?')) {
        model.clear();
        model.addNode('master', 850, 150);
      }
    });
  }

  // 10. Monta o Teclado de Piano Inferior para Tocar ao Vivo
  const keyboardContainer = document.getElementById('pianoKeyboardContainer');
  _setupBottomPiano(keyboardContainer, bridge);
});

function _loadLessonPreset(lesson, model, inspectorView) {
  if (!lesson || !lesson.patch) return;
  model.fromJSON(lesson.patch);

  if (lesson.id === 'lesson_subtractive') inspectorView.setMode('filter_env');
  else if (lesson.id === 'lesson_pluck') inspectorView.setMode('filter_env');
  else if (lesson.id === 'lesson_fm_bell') inspectorView.setMode('fm');
  else if (lesson.id === 'lesson_lfo_mod') inspectorView.setMode('lfo');
  else if (lesson.id === 'lesson_percussion') inspectorView.setMode('amp_adsr');
}

function _setupBottomPiano(container, bridge) {
  if (!container) return;

  const OCTAVE_COLORS = {
    0: '#3a86ff', 1: '#00f5d4', 2: '#70e000', 3: '#aacc00',
    4: '#ffbe0b', 5: '#fb5607', 6: '#ff006e', 7: '#8338ec', 8: '#ffffff'
  };

  container.innerHTML = `
    <div class="synth-piano-bar">
      <div class="piano-hint-label">🎹 TECLADO DE AUDIÇÃO AO VIVO (Clique para tocar ou use as teclas do computador):</div>
      <div class="piano-keys-scroll" id="pianoKeysScroll">
        <div class="piano-keys-track" id="pianoKeysTrack"></div>
      </div>
    </div>
  `;

  const track = container.querySelector('#pianoKeysTrack');
  const scrollArea = container.querySelector('#pianoKeysScroll');

  // Teclado universal de 61 teclas (C1 a C6 / MIDI 24 a 84)
  for (let midi = 24; midi <= 84; midi++) {
    const noteStr = ScaleCatalog.midiToNote(midi);
    const isBlack = noteStr.includes('#');
    const match = noteStr.match(/-?\d+/);
    const oct = match ? parseInt(match[0], 10) : 3;
    const color = OCTAVE_COLORS[oct] || '#fff';

    const key = document.createElement('div');
    key.className = `piano-mini-key ${isBlack ? 'black-key' : 'white-key'}`;
    key.dataset.note = noteStr;
    key.dataset.midi = midi;
    key.style.setProperty('--oct-color', color);

    if (noteStr.startsWith('C') || isBlack) {
      key.innerHTML = `<span class="mini-key-label">${noteStr}</span>`;
    }

    key.addEventListener('pointerdown', () => {
      bridge.playNote({ note: noteStr, velocity: 100, duration: 320 });
      key.classList.add('is-pressed');
      setTimeout(() => key.classList.remove('is-pressed'), 180);
    });

    track.appendChild(key);
  }

  // Centraliza em C3 inicialmente
  setTimeout(() => {
    scrollArea.scrollLeft = 380;
  }, 100);

  // Mapeamento das teclas do computador (Linha A, W, S, E, D, F...)
  const KEY_MAP = {
    'a': 'C3', 'w': 'C#3', 's': 'D3', 'e': 'D#3', 'd': 'E3',
    'f': 'F3', 't': 'F#3', 'g': 'G3', 'y': 'G#3', 'h': 'A3',
    'u': 'A#3', 'j': 'B3', 'k': 'C4', 'o': 'C#4', 'l': 'D4'
  };

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (KEY_MAP[key]) {
      const note = KEY_MAP[key];
      bridge.playNote({ note, velocity: 100, duration: 300 });

      const el = track.querySelector(`[data-note="${note}"]`);
      if (el) {
        el.classList.add('is-pressed');
        setTimeout(() => el.classList.remove('is-pressed'), 160);
      }
    }
  });
}
