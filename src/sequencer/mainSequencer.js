/**
 * mainSequencer.js
 * Ponto de entrada e orquestrador do SOL Sequenciador Melódico Polar.
 */

import { SoundEngine } from '../audio/SoundEngine.js';
import { PolarSequencerCore } from './PolarSequencerCore.js';
import { PianoPalette } from './PianoPalette.js';
import { SequencerCanvas } from './SequencerCanvas.js';
import { SequencerPatternBar } from './SequencerPatternBar.js';
import { SequencerTrackManager } from './SequencerTrackManager.js';
import { SequencerSurfaceView } from './SequencerSurfaceView.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('🪐 Inicializando SOL Sequenciador Melódico Polar...');

  // 1. Instanciação do Sound Engine compartilhado
  const soundEngine = new SoundEngine();

  // 2. Instanciação do Core do Sequenciador (Padrão: 16 passos x 8 anéis)
  const core = new PolarSequencerCore({
    steps: 16,
    rings: 8,
    bpm: 110,
    stepsPerBeat: 4
  });

  // 3. Montagem da Paleta de Piano (Universal 88 Teclas A0 a C8)
  const paletteContainer = document.getElementById('paletteContainer');
  const palette = new PianoPalette(paletteContainer, soundEngine, core);

  // 4. Montagem do Disco Polar Canvas e da Barra de Patterns
  const radarContainer = document.getElementById('radarContainer');
  const patternBar = new SequencerPatternBar(radarContainer, core);
  const canvasComponent = new SequencerCanvas(radarContainer, core, palette);

  // 5. Montagem do Gerenciador de Pistas e da Musical Surface
  const trackManager = new SequencerTrackManager(core, soundEngine, palette);
  palette.setTrackManager(trackManager);

  const surfaceContainer = document.getElementById('surfaceContainer');
  const surfaceView = new SequencerSurfaceView(surfaceContainer, trackManager, soundEngine, palette);

  // 6. Bind da Barra Superior de Transporte & Controles
  const btnPlay = document.getElementById('btnPlay');
  const btnStop = document.getElementById('btnStop');
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmDisplay = document.getElementById('bpmDisplay');
  const selectSteps = document.getElementById('selectSteps');
  const selectRings = document.getElementById('selectRings');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnTopUndo = document.getElementById('btnTopUndo');
  const btnTopRedo = document.getElementById('btnTopRedo');
  const masterVolSlider = document.getElementById('masterVolSlider');
  const masterVolDisplay = document.getElementById('masterVolDisplay');
  const masterFxSlider = document.getElementById('masterFxSlider');
  const masterFxDisplay = document.getElementById('masterFxDisplay');
  const btnLoadSf2 = document.getElementById('btnLoadSf2');
  const fileInputSf2 = document.getElementById('fileInputSf2');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const fileInputSeq = document.getElementById('fileInputSeq');

  // Play / Pause
  btnPlay.addEventListener('click', () => {
    soundEngine.unlock();
    const isPlaying = core.togglePlay();
    btnPlay.classList.toggle('active', isPlaying);
    btnPlay.innerHTML = isPlaying
      ? '<span class="btn-icon">⏸</span> <span>Pausar</span>'
      : '<span class="btn-icon">▶</span> <span>Tocar</span>';
  });

  // Stop
  btnStop.addEventListener('click', () => {
    core.stop();
    btnPlay.classList.remove('active');
    btnPlay.innerHTML = '<span class="btn-icon">▶</span> <span>Tocar</span>';
  });

  // BPM
  bpmSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    core.setBpm(val);
    bpmDisplay.textContent = val;
  });

  // Resolução de Steps (Fatias)
  selectSteps.addEventListener('change', (e) => {
    const s = parseInt(e.target.value, 10);
    core.setResolution(s, core.rings);
    canvasComponent.handleResize();
  });

  // Resolução de Rings (Anéis)
  selectRings.addEventListener('change', (e) => {
    const r = parseInt(e.target.value, 10);
    core.setResolution(core.steps, r);
    canvasComponent.handleResize();
  });

  // Desfazer / Refazer no Cabeçalho Superior
  if (btnTopUndo) {
    btnTopUndo.addEventListener('click', () => core.undo());
  }
  if (btnTopRedo) {
    btnTopRedo.addEventListener('click', () => core.redo());
  }

  core.onHistoryChange(({ canUndo, canRedo }) => {
    if (btnTopUndo) {
      btnTopUndo.disabled = !canUndo;
      btnTopUndo.classList.toggle('disabled', !canUndo);
    }
    if (btnTopRedo) {
      btnTopRedo.disabled = !canRedo;
      btnTopRedo.classList.toggle('disabled', !canRedo);
    }
  });

  // Limpar Tudo
  btnClearAll.addEventListener('click', () => {
    if (confirm('Deseja limpar todas as notas do disco?')) {
      core.clearAll();
    }
  });

  // Master Volume
  masterVolSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    soundEngine.setMasterVolume(v);
    masterVolDisplay.textContent = `${Math.round(v * 100)}%`;
  });

  // FX Level
  masterFxSlider.addEventListener('input', (e) => {
    const fx = parseFloat(e.target.value);
    soundEngine.setFxLevel(fx);
    masterFxDisplay.textContent = `${Math.round(fx * 100)}%`;
  });

  // Carregamento de SoundFont .sf2
  btnLoadSf2.addEventListener('click', () => {
    fileInputSf2.click();
  });

  fileInputSf2.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      btnLoadSf2.textContent = '⏳ Carregando...';
      await soundEngine.loadCustomSf2File(file);
      btnLoadSf2.textContent = `📦 ${file.name.slice(0, 10)}...`;
      surfaceView.render();
      alert(`SoundFont "${file.name}" carregado com sucesso!`);
    } catch (err) {
      alert(`Erro ao carregar SoundFont: ${err.message}`);
      btnLoadSf2.textContent = '📂 Carregar .SF2';
    }
  });

  // Exportar Sequência (.solseq.json)
  btnExport.addEventListener('click', () => {
    const data = {
      ...core.toJSON(),
      tracks: trackManager.toJSON(),
      fxLevel: soundEngine.getFxLevel()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sequencia_polar_${Date.now()}.solseq.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Importar Sequência (.solseq.json)
  btnImport.addEventListener('click', () => {
    fileInputSeq.click();
  });

  fileInputSeq.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        core.fromJSON(json);
        if (json.tracks) trackManager.fromJSON(json.tracks);
        if (json.fxLevel !== undefined) soundEngine.setFxLevel(json.fxLevel);

        selectSteps.value = core.steps;
        selectRings.value = core.rings;
        bpmSlider.value = core.bpm;
        bpmDisplay.textContent = core.bpm;
        canvasComponent.handleResize();
        surfaceView.render();
      } catch (err) {
        alert('Arquivo de sequência inválido: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Atalhos de Teclado Globais
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

    // Espaço = Play/Pause, Esc = Stop
    if (e.code === 'Space') {
      e.preventDefault();
      btnPlay.click();
    } else if (e.code === 'Escape') {
      btnStop.click();
    }
    // Desfazer (Ctrl+Z) / Refazer (Ctrl+Y ou Ctrl+Shift+Z)
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        core.redo();
      } else {
        core.undo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      core.redo();
    }
    // Alternância musical de Patterns quantizada (Teclas numéricas 1 a 9 e 0)
    else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === '1') core.selectPattern(0);
      else if (e.key === '2') core.selectPattern(1);
      else if (e.key === '3') core.selectPattern(2);
      else if (e.key === '4') core.selectPattern(3);
      else if (e.key === '5') core.selectPattern(4);
      else if (e.key === '6') core.selectPattern(5);
      else if (e.key === '7') core.selectPattern(6);
      else if (e.key === '8') core.selectPattern(7);
      else if (e.key === '9') core.selectPattern(8);
      else if (e.key === '0') core.selectPattern(9);
      // Seleção rápida de ferramentas (Q = Inserir, W = Tocar/Mover, E = Borracha)
      else if (e.key.toLowerCase() === 'q') palette.setTool('insert');
      else if (e.key.toLowerCase() === 'w') palette.setTool('move');
      else if (e.key.toLowerCase() === 'e') palette.setTool('erase');
    }
  });

  // 7. Popula padrões iniciais de demonstração (P1, P2, P3 e P4)
  _setupDemoPattern(core);
});

function _setupDemoPattern(core) {
  // Padrão 1 (P1): Base Groove Dó Menor
  core.selectPattern(0, true);
  core.setCell(0, 0, { active: true, note: 'C1', midi: 24, vel: 110, durRatio: 1.2 });
  core.setCell(4, 0, { active: true, note: 'G1', midi: 31, vel: 95, durRatio: 1.0 });
  core.setCell(8, 0, { active: true, note: 'A#1', midi: 34, vel: 100, durRatio: 1.0 });
  core.setCell(12, 0, { active: true, note: 'F1', midi: 29, vel: 95, durRatio: 1.0 });

  core.setCell(2, 2, { active: true, note: 'D#2', midi: 39, vel: 90, durRatio: 0.8 });
  core.setCell(6, 2, { active: true, note: 'G2', midi: 43, vel: 90, durRatio: 0.8 });
  core.setCell(10, 2, { active: true, note: 'C3', midi: 48, vel: 95, durRatio: 0.8 });
  core.setCell(14, 2, { active: true, note: 'D#3', midi: 51, vel: 90, durRatio: 0.8 });

  core.setCell(0, 4, { active: true, note: 'C3', midi: 48, vel: 95, durRatio: 1.0 });
  core.setCell(3, 4, { active: true, note: 'D#3', midi: 51, vel: 85, durRatio: 0.8 });
  core.setCell(7, 4, { active: true, note: 'G3', midi: 55, vel: 90, durRatio: 1.0 });
  core.setCell(11, 4, { active: true, note: 'A#3', midi: 58, vel: 85, durRatio: 0.8 });

  core.setCell(8, 6, { active: true, note: 'C4', midi: 60, vel: 80, durRatio: 1.5 });
  core.setCell(15, 6, { active: true, note: 'G4', midi: 67, vel: 85, durRatio: 1.5 });

  // Padrão 2 (P2): Variação Rítmica mais dinâmica
  core.selectPattern(1, true);
  core.setCell(0, 0, { active: true, note: 'C1', midi: 24, vel: 110, durRatio: 1.0 });
  core.setCell(3, 0, { active: true, note: 'C1', midi: 24, vel: 85, durRatio: 0.8 });
  core.setCell(6, 0, { active: true, note: 'D#1', midi: 27, vel: 95, durRatio: 1.0 });
  core.setCell(10, 0, { active: true, note: 'F1', midi: 29, vel: 95, durRatio: 1.0 });
  core.setCell(14, 0, { active: true, note: 'G1', midi: 31, vel: 100, durRatio: 1.0 });

  core.setCell(1, 2, { active: true, note: 'G2', midi: 43, vel: 85, durRatio: 0.7 });
  core.setCell(5, 2, { active: true, note: 'A#2', midi: 46, vel: 90, durRatio: 0.7 });
  core.setCell(9, 2, { active: true, note: 'C3', midi: 48, vel: 90, durRatio: 0.7 });
  core.setCell(13, 2, { active: true, note: 'F3', midi: 53, vel: 95, durRatio: 0.7 });

  core.setCell(2, 4, { active: true, note: 'D#3', midi: 51, vel: 90, durRatio: 1.0 });
  core.setCell(6, 4, { active: true, note: 'G3', midi: 55, vel: 90, durRatio: 1.0 });
  core.setCell(10, 4, { active: true, note: 'A#3', midi: 58, vel: 90, durRatio: 1.0 });
  core.setCell(14, 4, { active: true, note: 'D4', midi: 62, vel: 95, durRatio: 1.0 });

  core.setCell(4, 6, { active: true, note: 'D#4', midi: 63, vel: 80, durRatio: 1.2 });
  core.setCell(12, 6, { active: true, note: 'A#4', midi: 70, vel: 85, durRatio: 1.2 });

  // Padrão 3 (P3): Clímax Harmônico
  core.selectPattern(2, true);
  core.setCell(0, 0, { active: true, note: 'G#0', midi: 20, vel: 110, durRatio: 1.5 });
  core.setCell(8, 0, { active: true, note: 'A#0', midi: 22, vel: 110, durRatio: 1.5 });

  core.setCell(0, 2, { active: true, note: 'C3', midi: 48, vel: 90, durRatio: 1.2 });
  core.setCell(4, 2, { active: true, note: 'D#3', midi: 51, vel: 90, durRatio: 1.2 });
  core.setCell(8, 2, { active: true, note: 'F3', midi: 53, vel: 95, durRatio: 1.2 });
  core.setCell(12, 2, { active: true, note: 'G3', midi: 55, vel: 95, durRatio: 1.2 });

  core.setCell(2, 4, { active: true, note: 'G3', midi: 55, vel: 95, durRatio: 1.0 });
  core.setCell(6, 4, { active: true, note: 'C4', midi: 60, vel: 95, durRatio: 1.0 });
  core.setCell(10, 4, { active: true, note: 'D#4', midi: 63, vel: 95, durRatio: 1.0 });
  core.setCell(14, 4, { active: true, note: 'G4', midi: 67, vel: 100, durRatio: 1.0 });

  core.setCell(0, 6, { active: true, note: 'C5', midi: 72, vel: 85, durRatio: 2.0 });
  core.setCell(8, 6, { active: true, note: 'D5', midi: 74, vel: 85, durRatio: 2.0 });

  // Retorna para o Padrão 1 como padrão ativo inicial
  core.selectPattern(0, true);
  core.clearHistory?.(); // ou reinicia o histórico para este estado limpo
}
