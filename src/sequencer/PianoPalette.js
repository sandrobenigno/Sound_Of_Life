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
  constructor(container, soundEngine = null) {
    this.container = container;
    this.soundEngine = soundEngine;
    this.trackManager = null;

    this.activeNote = 'C3';
    this.activeMidi = 48;
    this.activeVel = 90;
    this.eraseMode = false;
    this.selectedRingIndex = 0; // Anel/Pista de referência para o som

    this.listeners = new Set();
    this.ringChangeListeners = new Set();
    this.keyElements = new Map(); // noteStr -> DOM element

    this._render();
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
      eraseMode: this.eraseMode,
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
            <div class="palette-track-ref" title="Selecione qual pista/timbre do rack será reproduzido pelo teclado">
              <span class="track-ref-label">🎧 SOM:</span>
              <select id="paletteTrackSelect" class="palette-track-dropdown"></select>
            </div>
          </div>

          <div class="palette-tools">
            <button type="button" class="btn btn-palette-tool ${this.eraseMode ? 'active' : ''}" id="btnEraseMode" title="Modo Borracha: Clique nas células do disco para apagá-las">
              🧹 Borracha
            </button>

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
    const btnErase = this.container.querySelector('#btnEraseMode');
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

    // Botão de borracha
    btnErase.addEventListener('click', () => {
      this.eraseMode = !this.eraseMode;
      btnErase.classList.toggle('active', this.eraseMode);
      this._updateBrushDisplay();
      this.notify();
    });

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
    this.eraseMode = false;

    const btnErase = this.container.querySelector('#btnEraseMode');
    if (btnErase) btnErase.classList.remove('active');

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

    if (this.eraseMode) {
      if (brushDot) brushDot.style.background = '#ff4d4d';
      if (brushNoteText) brushNoteText.textContent = 'BORRACHA (APAGAR)';
    } else {
      const color = this.getNoteColor(this.activeNote);
      if (brushDot) brushDot.style.background = color;
      if (brushNoteText) brushNoteText.textContent = this.activeNote;
    }
  }

  _highlightActiveKey() {
    for (const [note, el] of this.keyElements) {
      el.classList.toggle('is-brush-active', !this.eraseMode && note === this.activeNote);
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
