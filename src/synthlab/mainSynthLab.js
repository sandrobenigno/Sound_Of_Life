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

  // 6.1 Toggle de Animações dos Cabos
  const btnToggleAnim = document.getElementById('btnToggleAnim');
  if (btnToggleAnim) {
    let animActive = true;
    btnToggleAnim.addEventListener('click', () => {
      animActive = !animActive;
      canvasView.setAnimationsEnabled(animActive);
      btnToggleAnim.textContent = animActive ? '✨ Animação: ON' : '⏸️ Animação: OFF';
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
      <div class="piano-toolbar-row">
        <div class="piano-hint-label">🎹 AUDIÇÃO (Teclas: A, W, S, E, D, F, G, H, J, K...)</div>

        <div class="audition-loop-controls">
          <button type="button" class="btn-loop-play" id="btnToggleLoop" title="Iniciar/Parar sequência em loop contínuo para você ajustar os controles enquanto ouve">
            <span class="loop-icon">▶</span> <span class="loop-text">Loop Sequência</span>
          </button>

          <select id="selectLoopPattern" class="loop-pattern-select" title="Escolha a sequência melódica ou acorde para tocar em loop">
            <option value="arp_minor">🎵 Arpejo Menor 7ª (C3 - Eb3 - G3 - Bb3)</option>
            <option value="chord_triad">🌊 Acorde Sustentado (C3 + Eb3 + G3)</option>
            <option value="disco_bass">⚡ Bassline Oitavada (C2 - C3 - Eb2 - G2)</option>
            <option value="pentatonic">✨ Escala Pentatônica (C3 - D3 - F3 - G3 - Bb3 - C4)</option>
            <option value="single_pulse">🫧 Pulso de Teste (C3)</option>
          </select>

          <div class="loop-tempo-box">
            <label for="loopBpmSlider">BPM:</label>
            <input type="range" id="loopBpmSlider" min="60" max="180" step="5" value="120" title="Andamento do Loop">
            <span id="loopBpmVal">120</span>
          </div>
        </div>
      </div>

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

  // Teclado físico: permite tocar mesmo quando o foco está em um range slider
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const isRangeInput = e.target.tagName === 'INPUT' && e.target.type === 'range';

    // Apenas bloqueia teclas se estiver digitando em campos de texto reais
    if (['TEXTAREA', 'SELECT'].includes(e.target.tagName) || (e.target.tagName === 'INPUT' && !isRangeInput)) {
      return;
    }

    if (KEY_MAP[key]) {
      if (isRangeInput) {
        e.preventDefault(); // Impede que a tecla altere o slider acidentalmente
      }
      const note = KEY_MAP[key];
      bridge.playNote({ note, velocity: 100, duration: 300 });

      const el = track.querySelector(`[data-note="${note}"]`);
      if (el) {
        el.classList.add('is-pressed');
        setTimeout(() => el.classList.remove('is-pressed'), 160);
      }
    }
  });

  // -------------------------------------------------------------
  // Motor de Sequência em Loop (Arpejo e Acordes de Teste)
  // -------------------------------------------------------------
  const btnToggleLoop = container.querySelector('#btnToggleLoop');
  const selectLoopPattern = container.querySelector('#selectLoopPattern');
  const loopBpmSlider = container.querySelector('#loopBpmSlider');
  const loopBpmVal = container.querySelector('#loopBpmVal');

  const PATTERNS = {
    arp_minor: ['C3', 'Eb3', 'G3', 'Bb3', 'C4', 'Bb3', 'G3', 'Eb3'],
    chord_triad: [['C3', 'Eb3', 'G3', 'Bb3']],
    disco_bass: ['C2', 'C3', 'C2', 'Eb2', 'F2', 'F#2', 'G2', 'Bb2'],
    pentatonic: ['C3', 'D3', 'F3', 'G3', 'Bb3', 'C4'],
    single_pulse: ['C3']
  };

  let loopInterval = null;
  let loopStep = 0;
  let loopBpm = 120;

  loopBpmSlider.addEventListener('input', (e) => {
    loopBpm = parseInt(e.target.value, 10);
    loopBpmVal.textContent = loopBpm;
    if (loopInterval) {
      _restartLoopTimer();
    }
  });

  function _restartLoopTimer() {
    if (loopInterval) clearInterval(loopInterval);
    const patternKey = selectLoopPattern.value;
    const isChord = patternKey === 'chord_triad';
    // Colcheias para arpejos e semínimas/mínimas para acordes
    const stepMs = isChord ? (60000 / loopBpm) * 2 : (60000 / loopBpm) / 2;

    loopInterval = setInterval(() => {
      const pat = PATTERNS[selectLoopPattern.value] || PATTERNS.arp_minor;
      const item = pat[loopStep % pat.length];
      loopStep++;

      const notes = Array.isArray(item) ? item : [item];
      const dur = isChord ? Math.round(stepMs * 0.9) : Math.round(stepMs * 0.85);

      for (const n of notes) {
        bridge.playNote({ note: n, velocity: 95, duration: dur });

        const el = track.querySelector(`[data-note="${n}"]`);
        if (el) {
          el.classList.add('is-pressed');
          setTimeout(() => el.classList.remove('is-pressed'), Math.min(180, dur * 0.8));
        }
      }
    }, stepMs);
  }

  btnToggleLoop.addEventListener('click', () => {
    if (loopInterval) {
      // Para o Loop
      clearInterval(loopInterval);
      loopInterval = null;
      btnToggleLoop.classList.remove('is-playing');
      btnToggleLoop.innerHTML = '<span class="loop-icon">▶</span> <span class="loop-text">Loop Sequência</span>';
    } else {
      // Inicia o Loop
      loopStep = 0;
      bridge.unlock();
      _restartLoopTimer();
      btnToggleLoop.classList.add('is-playing');
      btnToggleLoop.innerHTML = '<span class="loop-icon">⏹</span> <span class="loop-text">Parar Loop</span>';
    }
  });

  selectLoopPattern.addEventListener('change', () => {
    loopStep = 0;
    if (loopInterval) {
      _restartLoopTimer();
    }
  });
}
