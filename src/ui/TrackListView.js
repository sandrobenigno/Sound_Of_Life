/**
 * TrackListView.js
 * Visualização e controle das pistas de áudio em formato de rack/linhas verticais (de cima para baixo).
 * Permite adicionar até 24 pistas, configurar canais de entrada, SF2/synths, escalas e modos.
 */

import { SCALES, NOTE_NAMES } from '../surface/ScaleCatalog.js';

export class TrackListView {
  constructor(container, trackManager, soundEngine) {
    this.container = container;
    this.trackManager = trackManager;
    this.soundEngine = soundEngine;

    this.trackManager.onChange(() => this.render());
    this._initLayout();
    this.render();

    // Loop de animação para feedback visual em tempo real dos LEDs de trigger
    this._startBlinkLoop();
  }

  _initLayout() {
    this.container.innerHTML = `
      <div class="tracks-header">
        <div class="tracks-header-title">
          <h3>🎛️ MUSICAL SURFACE (PISTAS)</h3>
          <span class="track-counter" id="trackCounter">0 / 24</span>
        </div>
        <div class="tracks-header-actions">
          <button id="btnAddTrack" class="btn btn-primary">+ Adicionar Pista</button>
        </div>
      </div>
      <div class="channel-map-bar" id="channelMapBar" title="Pontos de entrada do SOL (Canais 1 a 24). Verde = Mapeado em uma pista, Cinza = Disponível"></div>
      <div class="tracks-list" id="tracksListContainer"></div>
    `;

    this.container.querySelector('#btnAddTrack').addEventListener('click', () => {
      this.soundEngine.unlock();
      this.trackManager.addTrack();
    });
  }

  render() {
    const listEl = this.container.querySelector('#tracksListContainer');
    const counterEl = this.container.querySelector('#trackCounter');
    const addBtn = this.container.querySelector('#btnAddTrack');
    const mapBarEl = this.container.querySelector('#channelMapBar');

    const tracks = this.trackManager.tracks;
    counterEl.textContent = `${tracks.length} / 24 Pistas`;
    addBtn.disabled = tracks.length >= 24;

    // Renderiza a barra de mapeamento dos 24 canais
    this._renderChannelMapBar(mapBarEl);

    if (tracks.length === 0) {
      listEl.innerHTML = `
        <div class="tracks-empty">
          <p>Nenhuma pista adicionada.</p>
          <p>Clique no botão <strong>+ Adicionar Pista</strong> acima para criar uma nova linha de áudio e associá-la a um canal do radar.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    tracks.forEach((track, index) => {
      const row = this._createTrackRow(track, index, tracks.length);
      listEl.appendChild(row);
    });
  }

  _renderChannelMapBar(container) {
    const mapped = this.trackManager.getMappedInputChannels();
    let html = '<div class="map-bar-label">Canais SOL:</div><div class="map-bar-chips">';
    for (let ch = 0; ch < 24; ch++) {
      const isMapped = mapped.has(ch);
      html += `<span class="ch-chip ${isMapped ? 'ch-mapped' : 'ch-free'}" title="Canal ${ch + 1}: ${isMapped ? 'Mapeado' : 'Livre'}">${ch + 1}</span>`;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  _createTrackRow(track, index, totalTracks) {
    const row = document.createElement('div');
    row.className = `track-row ${track.mute ? 'is-muted' : ''} ${track.solo ? 'is-solo' : ''}`;
    row.id = `track-row-${track.id}`;

    const sources = this.soundEngine.getAvailableSoundSources();
    const availableChannels = this.trackManager.getAvailableInputChannels();

    // Opções de Canais (0 a 23)
    let channelOptions = '';
    for (let c = 0; c < 24; c++) {
      const isCurrent = c === track.inputChannel;
      const isAvailable = availableChannels.includes(c);
      channelOptions += `<option value="${c}" ${isCurrent ? 'selected' : ''}>${isCurrent ? '● ' : (isAvailable ? '○ ' : '× ')}Canal ${c + 1}</option>`;
    }

    // Opções de Fontes Sonoras (Synths e SF2s)
    let soundOptions = '';
    sources.forEach(src => {
      const isSelected = src.id === track.soundSource;
      soundOptions += `<option value="${src.id}" ${isSelected ? 'selected' : ''}>${src.name}</option>`;
    });

    // Opções de Escalas
    let scaleOptions = '';
    Object.entries(SCALES).forEach(([key, scale]) => {
      const isSelected = key === track.scaleKey;
      scaleOptions += `<option value="${key}" ${isSelected ? 'selected' : ''}>${scale.name}</option>`;
    });

    // Opções de Notas Fundamentais
    let rootNoteOptions = '';
    NOTE_NAMES.forEach(n => {
      rootNoteOptions += `<option value="${n}" ${n === track.rootNote ? 'selected' : ''}>${n}</option>`;
    });

    row.innerHTML = `
      <div class="track-header-cell">
        <div class="track-led" id="led-${track.id}" title="Trigger LED"></div>
        <span class="track-note-display" id="note-display-${track.id}">--</span>
      </div>

      <div class="track-cell track-input-cell">
        <label class="cell-label">PONTO ENTRADA</label>
        <select class="input-select track-channel-select">
          ${channelOptions}
        </select>
      </div>

      <div class="track-cell track-name-cell">
        <label class="cell-label">NOME DA PISTA</label>
        <input type="text" class="input-text track-name-input" value="${track.name}">
      </div>

      <div class="track-cell track-source-cell">
        <label class="cell-label">TIMBRE / SF2</label>
        <select class="input-select track-source-select">
          ${soundOptions}
        </select>
      </div>

      <div class="track-cell track-scale-cell">
        <label class="cell-label">ESCALA / NOTAS</label>
        <div class="scale-inline-group">
          <select class="input-select track-root-select" style="width: 58px;" title="Nota Fundamental">
            ${rootNoteOptions}
          </select>
          <select class="input-select track-oct-select" style="width: 72px;" title="Oitava">
            ${[1,2,3,4,5,6].map(oct => `<option value="${oct}" ${oct === track.rootOctave ? 'selected' : ''}>Oit ${oct}</option>`).join('')}
          </select>
          <select class="input-select track-scale-select">
            ${scaleOptions}
          </select>
        </div>
      </div>

      <div class="track-cell track-mode-cell">
        <label class="cell-label">MODO AVANÇO</label>
        <select class="input-select track-mode-select">
          <option value="sequential_forward" ${track.advanceMode === 'sequential_forward' ? 'selected' : ''}>Seq ➡️</option>
          <option value="sequential_backward" ${track.advanceMode === 'sequential_backward' ? 'selected' : ''}>Rev ⬅️</option>
          <option value="random" ${track.advanceMode === 'random' ? 'selected' : ''}>Random 🎲</option>
          <option value="pendulum" ${track.advanceMode === 'pendulum' ? 'selected' : ''}>Pêndulo ↔️</option>
          <option value="direct" ${track.advanceMode === 'direct' ? 'selected' : ''}>Fatia 🎯</option>
        </select>
      </div>

      <div class="track-cell track-dynamics-cell">
        <label class="cell-label">VEL / GATE</label>
        <div class="slider-group">
          <span title="Velocity">V:${track.velocity}</span>
          <input type="range" class="track-vel-slider" min="1" max="127" value="${track.velocity}">
          <span title="Duração (Gate)">G:${track.duration}ms</span>
          <input type="range" class="track-gate-slider" min="40" max="800" step="20" value="${track.duration}">
        </div>
      </div>

      <div class="track-cell track-mix-cell">
        <label class="cell-label">MIX</label>
        <div class="mix-buttons">
          <button class="btn-toggle btn-mute ${track.mute ? 'active' : ''}">M</button>
          <button class="btn-toggle btn-solo ${track.solo ? 'active' : ''}">S</button>
        </div>
      </div>

      <div class="track-cell track-actions-cell">
        <label class="cell-label">AÇÕES</label>
        <div class="action-buttons">
          <button class="btn-icon btn-dup" title="Duplicar Pista">📋</button>
          <button class="btn-icon btn-up" ${index === 0 ? 'disabled' : ''} title="Mover para Cima">⬆️</button>
          <button class="btn-icon btn-down" ${index === totalTracks - 1 ? 'disabled' : ''} title="Mover para Baixo">⬇️</button>
          <button class="btn-icon btn-del" title="Excluir Pista">🗑️</button>
        </div>
      </div>
    `;

    this._bindRowEvents(row, track, index);
    return row;
  }

  _bindRowEvents(row, track, index) {
    // Canal
    row.querySelector('.track-channel-select').addEventListener('change', (e) => {
      track.inputChannel = parseInt(e.target.value, 10);
      this.trackManager.notifyChange();
    });

    // Nome
    row.querySelector('.track-name-input').addEventListener('input', (e) => {
      track.name = e.target.value;
    });

    // Fonte Sonora
    row.querySelector('.track-source-select').addEventListener('change', (e) => {
      this.soundEngine.unlock();
      track.soundSource = e.target.value;
    });

    // Root Note
    row.querySelector('.track-root-select').addEventListener('change', (e) => {
      track.rootNote = e.target.value;
      track.rebuildNotesFromScale();
    });

    // Root Octave
    row.querySelector('.track-oct-select').addEventListener('change', (e) => {
      track.rootOctave = parseInt(e.target.value, 10);
      track.rebuildNotesFromScale();
    });

    // Escala
    row.querySelector('.track-scale-select').addEventListener('change', (e) => {
      track.scaleKey = e.target.value;
      track.rebuildNotesFromScale();
    });

    // Modo de Avanço
    row.querySelector('.track-mode-select').addEventListener('change', (e) => {
      track.advanceMode = e.target.value;
    });

    // Velocity Slider
    row.querySelector('.track-vel-slider').addEventListener('input', (e) => {
      track.velocity = parseInt(e.target.value, 10);
      const span = row.querySelector('.track-dynamics-cell span:first-child');
      if (span) span.textContent = `V:${track.velocity}`;
    });

    // Gate Slider
    row.querySelector('.track-gate-slider').addEventListener('input', (e) => {
      track.duration = parseInt(e.target.value, 10);
      const span = row.querySelector('.track-dynamics-cell span:nth-child(3)');
      if (span) span.textContent = `G:${track.duration}ms`;
    });

    // Mute
    row.querySelector('.btn-mute').addEventListener('click', () => {
      track.mute = !track.mute;
      this.trackManager.notifyChange();
    });

    // Solo
    row.querySelector('.btn-solo').addEventListener('click', () => {
      track.solo = !track.solo;
      this.trackManager.notifyChange();
    });

    // Duplicar
    row.querySelector('.btn-dup').addEventListener('click', () => {
      this.soundEngine.unlock();
      this.trackManager.duplicateTrack(track.id);
    });

    // Mover Cima
    row.querySelector('.btn-up').addEventListener('click', () => {
      this.trackManager.reorder(index, index - 1);
    });

    // Mover Baixo
    row.querySelector('.btn-down').addEventListener('click', () => {
      this.trackManager.reorder(index, index + 1);
    });

    // Excluir
    row.querySelector('.btn-del').addEventListener('click', () => {
      this.trackManager.removeTrack(track.id);
    });
  }

  _startBlinkLoop() {
    const updateLeds = () => {
      const now = Date.now();
      for (const track of this.trackManager.tracks) {
        const led = document.getElementById(`led-${track.id}`);
        const noteDisp = document.getElementById(`note-display-${track.id}`);

        if (led && noteDisp) {
          const isRecentlyTriggered = (now - track.lastTriggerTime) < 150;
          if (isRecentlyTriggered) {
            led.classList.add('active');
            noteDisp.textContent = track.lastTriggerNote || '--';
            noteDisp.classList.add('active');
          } else {
            led.classList.remove('active');
            noteDisp.classList.remove('active');
          }
        }
      }
      requestAnimationFrame(updateLeds);
    };

    requestAnimationFrame(updateLeds);
  }
}
