/**
 * mainSequencer.js
 * Ponto de entrada e orquestrador do SOL Sequenciador Melódico Polar.
 */

import { SoundEngine } from '../audio/SoundEngine.js';
import { PolarSequencerCore } from './PolarSequencerCore.js';
import { PianoPalette } from './PianoPalette.js';
import { SequencerCanvas } from './SequencerCanvas.js';
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

  // 3. Montagem da Paleta de Piano (5 oitavas: C0 a C5)
  const paletteContainer = document.getElementById('paletteContainer');
  const palette = new PianoPalette(paletteContainer, soundEngine);

  // 4. Montagem do Disco Polar Canvas
  const radarContainer = document.getElementById('radarContainer');
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

  // Atalhos de Teclado
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      btnPlay.click();
    } else if (e.code === 'Escape') {
      btnStop.click();
    }
  });

  // 7. Popula um belo padrão inicial de demonstração (Demo Arpeggio & Bass)
  _setupDemoPattern(core);
});

function _setupDemoPattern(core) {
  // Padrão melódico inicial em Dó Menor Pentatônica / 16 passos
  // Anel 0 (Sub Bass / Grave)
  core.setCell(0, 0, { active: true, note: 'C1', midi: 24, vel: 110, durRatio: 1.2 });
  core.setCell(4, 0, { active: true, note: 'G1', midi: 31, vel: 95, durRatio: 1.0 });
  core.setCell(8, 0, { active: true, note: 'A#1', midi: 34, vel: 100, durRatio: 1.0 });
  core.setCell(12, 0, { active: true, note: 'F1', midi: 29, vel: 95, durRatio: 1.0 });

  // Anel 2 (Arp)
  core.setCell(2, 2, { active: true, note: 'D#2', midi: 39, vel: 90, durRatio: 0.8 });
  core.setCell(6, 2, { active: true, note: 'G2', midi: 43, vel: 90, durRatio: 0.8 });
  core.setCell(10, 2, { active: true, note: 'C3', midi: 48, vel: 95, durRatio: 0.8 });
  core.setCell(14, 2, { active: true, note: 'D#3', midi: 51, vel: 90, durRatio: 0.8 });

  // Anel 4 (Piano Melody)
  core.setCell(0, 4, { active: true, note: 'C3', midi: 48, vel: 95, durRatio: 1.0 });
  core.setCell(3, 4, { active: true, note: 'D#3', midi: 51, vel: 85, durRatio: 0.8 });
  core.setCell(7, 4, { active: true, note: 'G3', midi: 55, vel: 90, durRatio: 1.0 });
  core.setCell(11, 4, { active: true, note: 'A#3', midi: 58, vel: 85, durRatio: 0.8 });

  // Anel 6 (High Bells / Chime)
  core.setCell(8, 6, { active: true, note: 'C4', midi: 60, vel: 80, durRatio: 1.5 });
  core.setCell(15, 6, { active: true, note: 'G4', midi: 67, vel: 85, durRatio: 1.5 });
}
