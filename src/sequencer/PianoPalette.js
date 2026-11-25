/**
 * PianoPalette.js
 * Teclado interativo de 88 teclas (A0 a C8).
 * Padrão acústico universal compatível com 100% dos SoundFonts SF2 e sintetizadores.
 * Permite selecionar qual pista do rack serve de referência sonora para o teclado.
 */

import { ScaleCatalog } from '../surface/ScaleCatalog.js';

export const OCTAVE_COLORS = {
  0: '#3a86ff', // Azul clássico (A0, A#0, B0)
  1: '#00f5d4', // Ciano / Turquesa
  2: '#70e000', // Verde / Esmeralda
  3: '#aacc00', // Verde-amarelado / Chartreuse
  4: '#ffbe0b', // Dourado / Âmbar (Dó Central C4)
  5: '#fb5607', // Laranja
  6: '#ff006e', // Rosa neon / Magenta
  7: '#8338ec', // Violeta / Púrpura
  8: '#ffffff'  // Branco cristalino (C8)
};

export class PianoPalette {
  constructor(container, soundEngine = null, core = null) {
    this.container = container;
    this.soundEngine = soundEngine;
    this.core = core;
    this.trackManager = null;

    this.activeNote = 'C3';
    this.activeMidi = 48;
    this.activeVel = 90;
    this.activeTool = 'insert'; // 'insert' | 'move' | 'erase'
    this.selectedRingIndex = 0; // Anel/Pista de referência para o som

    this.listeners = new Set();
    this.ringChangeListeners = new Set();
    this.toolChangeListeners = new Set();
    this.keyElements = new Map(); // noteStr -> DOM element

    this._render();
    if (this.core) {
      this._bindCore(this.core);
    }
  }

  setCore(core) {
    this.core = core;
    this._bindCore(core);
  }

  _bindCore(core) {
    if (!core) return;
    core.onHistoryChange(({ canUndo, canRedo }) => {
      const btnUndo = this.container.querySelector('#btnUndo');
      const btnRedo = this.container.querySelector('#btnRedo');
      if (btnUndo) {
        btnUndo.disabled = !canUndo;
        btnUndo.classList.toggle('disabled', !canUndo);
      }
      if (btnRedo) {
        btnRedo.disabled = !canRedo;
        btnRedo.classList.toggle('disabled', !canRedo);
      }
    });
  }

  setTool(toolName) {
    if (!['insert', 'move', 'erase'].includes(toolName)) return;
    this.activeTool = toolName;

    const btnInsert = this.container.querySelector('#btnToolInsert');
    const btnMove = this.container.querySelector('#btnToolMove');
    const btnErase = this.container.querySelector('#btnToolErase');

    if (btnInsert) btnInsert.classList.toggle('active', this.activeTool === 'insert');
    if (btnMove) btnMove.classList.toggle('active', this.activeTool === 'move');
    if (btnErase) btnErase.classList.toggle('active', this.activeTool === 'erase');

    this._updateBrushDisplay();
    this._highlightActiveKey();
    this._notifyToolChange();
    this.notify();
  }

  get eraseMode() {
    return this.activeTool === 'erase';
  }

  set eraseMode(val) {
    this.setTool(val ? 'erase' : 'insert');
  }

  onToolChange(cb) {
    this.toolChangeListeners.add(cb);
    try { cb(this.activeTool); } catch (_) {}
    return () => this.toolChangeListeners.delete(cb);
  }

  _notifyToolChange() {
    for (const cb of this.toolChangeListeners) {
      try { cb(this.activeTool); } catch (_) {}
    }
  }

  setTrackManager(trackManager) {
    this.trackManager = trackManager;
    if (this.trackManager) {
      this.trackManager.onChange(() => {
        this._updateTrackDropdown();
      });
    }
    this._updateTrackDropdown();
  }

  setSelectedRing(ringIndex) {
    this.selectedRingIndex = Math.max(0, parseInt(ringIndex, 10) || 0);
    const selectEl = this.container.querySelector('#paletteTrackSelect');
    if (selectEl && parseInt(selectEl.value, 10) !== this.selectedRingIndex) {
      selectEl.value = this.selectedRingIndex;
    }
    this._notifyRingChange();
  }

  _notifyRingChange() {
    for (const cb of this.ringChangeListeners) {
      try { cb(this.selectedRingIndex); } catch (_) {}
    }
  }

  onRingChange(cb) {
    this.ringChangeListeners.add(cb);
    return () => this.ringChangeListeners.delete(cb);
  }

  getBrush() {
    return {
      note: this.activeNote,
      midi: this.activeMidi,
      vel: this.activeVel,
      color: this.getNoteColor(this.activeNote),
      tool: this.activeTool,
      eraseMode: this.activeTool === 'erase',
      targetRing: this.selectedRingIndex
    };
  }

  getNoteColor(noteStr) {
    if (!noteStr) return '#00ffff';
    const match = noteStr.match(/-?\d+/);
    const oct = match ? parseInt(match[0], 10) : 3;
    return OCTAVE_COLORS[oct] || '#00ffff';
  }

  _render() {
    this.container.innerHTML = `
      <div class="piano-palette-wrapper">
        <div class="palette-toolbar">
          <div class="palette-top-controls">
            <!-- Pincel Atual -->
            <div class="brush-indicator" id="paletteBrushDisplay" title="Nota ativa selecionada no pincel">
              <span class="brush-dot" style="background: ${this.getNoteColor(this.activeNote)};"></span>
              <span class="brush-label">PINCEL:</span>
              <span class="brush-note" id="brushNoteText">${this.activeNote}</span>
            </div>

            <!-- Seletor de Pista de Referência de Som -->
            <div class="palette-track-ref" title="Selecione qual pista/timbre do rack será reproduzido pelo teclado e pela ferramenta Tocar/Mover">
              <span class="track-ref-label">🎧 SOM:</span>
              <select id="paletteTrackSelect" class="palette-track-dropdown"></select>
            </div>
          </div>

          <div class="palette-tools">
            <!-- Grupo de Ferramentas do Cursor -->
            <div class="seq-toolset" role="group" aria-label="Ferramentas do cursor">
              <button type="button" class="btn btn-palette-tool is-tool-btn ${this.activeTool === 'insert' ? 'active' : ''}" id="btnToolInsert" title="Inserir / Pintar Nota no Disco (Cruz)">
                <span class="tool-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="21"></line><line x1="3" y1="12" x2="21" y2="12"></line></svg>
                </span>
                <span>Inserir</span>
              </button>

              <button type="button" class="btn btn-palette-tool is-tool-btn ${this.activeTool === 'move' ? 'active' : ''}" id="btnToolMove" title="Tocar / Mover Nota (Mãozinha): Clique para ouvir o timbre da pista ou arraste para mover a nota no disco">
                <span class="tool-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M6 14v-2a2 2 0 0 0-4 0v5a7 7 0 0 0 7 7h3a7 7 0 0 0 7-7v-3a2 2 0 0 0-4 0"/></svg>
                </span>
                <span>Tocar/Mover</span>
              </button>

              <button type="button" class="btn btn-palette-tool is-tool-btn ${this.activeTool === 'erase' ? 'active' : ''}" id="btnToolErase" title="Borracha: Clique ou arraste sobre as células para apagá-las">
                <span class="tool-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 7l3 3a2.1 2.1 0 0 1 0 3L11 23H3v-8L13 5l5 2z" fill="rgba(255, 77, 121, 0.35)" stroke="#ff4d79"/>
                    <path d="M8 18l5-5" stroke="#ffffff"/>
                  </svg>
                </span>
                <span>Borracha</span>
              </button>
            </div>

            <!-- Grupo Histórico (Undo / Redo) -->
            <div class="seq-history-group" role="group" aria-label="Histórico">
              <button type="button" class="btn btn-palette-tool btn-undo" id="btnUndo" title="Desfazer última alteração (Ctrl+Z)" disabled>
                <span class="tool-icon">↩️</span>
                <span>Desfazer</span>
              </button>
              <button type="button" class="btn btn-palette-tool btn-redo" id="btnRedo" title="Refazer alteração (Ctrl+Y ou Ctrl+Shift+Z)" disabled>
                <span class="tool-icon">↪️</span>
                <span>Refazer</span>
              </button>
            </div>

            <div class="palette-vel-group">
              <label for="paletteVelSlider">VEL:</label>
              <input type="range" id="paletteVelSlider" min="1" max="127" value="${this.activeVel}" title="Velocity do pincel">
              <span id="paletteVelDisplay">${this.activeVel}</span>
            </div>

            <div class="palette-octave-legend" id="octaveJumpContainer" title="Clique para rolar até a oitava desejada">
              <span class="oct-tag oct-jump-btn" data-oct="0" style="--c: ${OCTAVE_COLORS[0]}">Oit 0</span>
              <span class="oct-tag oct-jump-btn" data-oct="1" style="--c: ${OCTAVE_COLORS[1]}">Oit 1</span>
              <span class="oct-tag oct-jump-btn" data-oct="2" style="--c: ${OCTAVE_COLORS[2]}">Oit 2</span>
              <span class="oct-tag oct-jump-btn" data-oct="3" style="--c: ${OCTAVE_COLORS[3]}">Oit 3</span>
              <span class="oct-tag oct-jump-btn" data-oct="4" style="--c: ${OCTAVE_COLORS[4]}">Oit 4 (C4)</span>
              <span class="oct-tag oct-jump-btn" data-oct="5" style="--c: ${OCTAVE_COLORS[5]}">Oit 5</span>
              <span class="oct-tag oct-jump-btn" data-oct="6" style="--c: ${OCTAVE_COLORS[6]}">Oit 6</span>
              <span class="oct-tag oct-jump-btn" data-oct="7" style="--c: ${OCTAVE_COLORS[7]}">Oit 7</span>
              <span class="oct-tag oct-jump-btn" data-oct="8" style="--c: ${OCTAVE_COLORS[8]}">Oit 8</span>
            </div>
          </div>
        </div>

        <div class="piano-keyboard-scroll" id="pianoScrollArea" title="Dica: Use a rodinha do mouse ou arraste para rolar pelas 88 teclas">
          <div class="piano-keyboard" id="pianoKeyboard"></div>
        </div>
      </div>
    `;

    this._generate88Keys();
    this._bindEvents();
    this._highlightActiveKey();
    this._updateTrackDropdown();

    // Rola suavemente para centralizar a Oitava 3 / 4 inicialmente
    setTimeout(() => {
      this.scrollToNote('C3');
    }, 120);
  }

  _updateTrackDropdown() {
    const selectEl = this.container.querySelector('#paletteTrackSelect');
    if (!selectEl) return;

    if (!this.trackManager || !this.trackManager.tracks || this.trackManager.tracks.length === 0) {
      selectEl.innerHTML = `<option value="0">Anel 1 (Padrão)</option>`;
      return;
    }

    let html = '';
    this.trackManager.tracks.forEach(track => {
      const isSel = track.ringIndex === this.selectedRingIndex;
      // Nome amigável do som
      const srcName = track.soundSource.replace('synth:', 'Synth ').replace('sf2:', 'SF2 ');
      html += `<option value="${track.ringIndex}" ${isSel ? 'selected' : ''}>Anel ${track.ringIndex + 1}: ${track.name} (${srcName})</option>`;
    });

    selectEl.innerHTML = html;
  }

  _generate88Keys() {
    const keyboardEl = this.container.querySelector('#pianoKeyboard');
    keyboardEl.innerHTML = '';
    this.keyElements.clear();

    // Piano Padrão Universal de 88 Teclas: A0 (MIDI 21) até C8 (MIDI 108)
    const startMidi = 21;  // A0
    const endMidi = 108;   // C8

    for (let midi = startMidi; midi <= endMidi; midi++) {
      const noteStr = ScaleCatalog.midiToNote(midi);
      const isBlack = noteStr.includes('#');
      const match = noteStr.match(/-?\d+/);
      const oct = match ? parseInt(match[0], 10) : 0;
      const color = OCTAVE_COLORS[oct] || '#ffffff';

      const keyEl = document.createElement('div');
      keyEl.className = `piano-key ${isBlack ? 'black-key' : 'white-key'}`;
      keyEl.dataset.note = noteStr;
      keyEl.dataset.midi = midi;
      keyEl.style.setProperty('--oct-color', color);

      if (isBlack) {
        keyEl.innerHTML = `<span class="key-name">${noteStr}</span>`;
      } else {
        const isRootC = noteStr.startsWith('C') || noteStr === 'A0';
        keyEl.innerHTML = `
          <span class="key-name ${isRootC ? 'key-root-name' : ''}">${noteStr}</span>
        `;
      }

      keyboardEl.appendChild(keyEl);
      this.keyElements.set(noteStr, keyEl);
    }
  }

  _bindEvents() {
    const btnToolInsert = this.container.querySelector('#btnToolInsert');
    const btnToolMove = this.container.querySelector('#btnToolMove');
    const btnToolErase = this.container.querySelector('#btnToolErase');
    const btnUndo = this.container.querySelector('#btnUndo');
    const btnRedo = this.container.querySelector('#btnRedo');

    const velSlider = this.container.querySelector('#paletteVelSlider');
    const velDisplay = this.container.querySelector('#paletteVelDisplay');
    const scrollArea = this.container.querySelector('#pianoScrollArea');
    const trackSelect = this.container.querySelector('#paletteTrackSelect');

    // Seletor de Pista
    if (trackSelect) {
      trackSelect.addEventListener('change', (e) => {
        this.setSelectedRing(parseInt(e.target.value, 10));
      });
    }

    // Ferramentas do cursor
    if (btnToolInsert) {
      btnToolInsert.addEventListener('click', () => this.setTool('insert'));
    }
    if (btnToolMove) {
      btnToolMove.addEventListener('click', () => this.setTool('move'));
    }
    if (btnToolErase) {
      btnToolErase.addEventListener('click', () => this.setTool('erase'));
    }

    // Botões Desfazer / Refazer
    if (btnUndo) {
      btnUndo.addEventListener('click', () => {
        if (this.core) this.core.undo();
      });
    }
    if (btnRedo) {
      btnRedo.addEventListener('click', () => {
        if (this.core) this.core.redo();
      });
    }

    // Slider de velocidade
    velSlider.addEventListener('input', (e) => {
      this.activeVel = parseInt(e.target.value, 10);
      velDisplay.textContent = this.activeVel;
      this.notify();
    });

    // Rolagem horizontal suave com a roda do mouse sobre o teclado
    scrollArea.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollArea.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // Pílulas de salto rápido de oitavas
    this.container.querySelectorAll('.oct-jump-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const oct = btn.dataset.oct;
        const targetNote = oct === '0' ? 'A0' : `C${oct}`;
        this.scrollToNote(targetNote);
      });
    });

    // Clique nas teclas do piano
    this.container.querySelector('#pianoKeyboard').addEventListener('pointerdown', (e) => {
      const keyEl = e.target.closest('.piano-key');
      if (!keyEl) return;

      const note = keyEl.dataset.note;
      const midi = parseInt(keyEl.dataset.midi, 10);

      this.selectNote(note, midi, true);
    });
  }

  scrollToNote(noteStr) {
    const keyEl = this.keyElements.get(noteStr);
    const scrollArea = this.container.querySelector('#pianoScrollArea');
    if (keyEl && scrollArea) {
      scrollArea.scrollTo({
        left: keyEl.offsetLeft - scrollArea.clientWidth / 2 + 20,
        behavior: 'smooth'
      });
    }
  }

  selectNote(noteStr, midi = null, playPreview = true) {
    this.activeNote = noteStr;
    this.activeMidi = midi !== null ? midi : ScaleCatalog.noteToMidi(noteStr);

    // Se estava na borracha, ao selecionar uma nota no teclado volta automaticamente para Inserir
    if (this.activeTool === 'erase') {
      this.setTool('insert');
    }

    this._updateBrushDisplay();
    this._highlightActiveKey();

    // Toca o som usando o timbre da pista de referência ativa
    if (playPreview && this.soundEngine) {
      this.soundEngine.unlock();

      let targetSource = 'synth:saw';
      let targetGain = 0.85;

      if (this.trackManager) {
        const track = this.trackManager.getTrack(this.selectedRingIndex);
        if (track) {
          targetSource = track.soundSource;
          targetGain = track.gain;
        }
      }

      this.soundEngine.playNote({
        note: this.activeNote,
        velocity: this.activeVel,
        duration: 280,
        soundSource: targetSource,
        gain: targetGain
      });
    }

    this.notify();
  }

  _updateBrushDisplay() {
    const brushDot = this.container.querySelector('.brush-dot');
    const brushNoteText = this.container.querySelector('#brushNoteText');

    if (this.activeTool === 'erase') {
      if (brushDot) brushDot.style.background = '#ff4d79';
      if (brushNoteText) brushNoteText.textContent = 'BORRACHA (APAGAR)';
    } else if (this.activeTool === 'move') {
      if (brushDot) brushDot.style.background = '#00ff88';
      if (brushNoteText) brushNoteText.textContent = 'TOCAR / MOVER (✋)';
    } else {
      const color = this.getNoteColor(this.activeNote);
      if (brushDot) brushDot.style.background = color;
      if (brushNoteText) brushNoteText.textContent = this.activeNote;
    }
  }

  _highlightActiveKey() {
    for (const [note, el] of this.keyElements) {
      el.classList.toggle('is-brush-active', this.activeTool === 'insert' && note === this.activeNote);
    }
  }

  /**
   * Pisca temporariamente uma tecla quando ela é disparada pelo sequenciador
   */
  flashKey(noteStr) {
    const el = this.keyElements.get(noteStr);
    if (!el) return;
    el.classList.add('is-firing');
    setTimeout(() => {
      el.classList.remove('is-firing');
    }, 140);
  }

  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  notify() {
    const brush = this.getBrush();
    for (const cb of this.listeners) {
      try { cb(brush); } catch (_) {}
    }
  }
}
