/**
 * PianoPalette.js
 * Teclado interativo de 5 oitavas (C0 a C5 - 61 teclas).
 * Atua como "Paleta de Cores" para seleção de notas melódicas com preview auditivo imediato
 * e atribuição para o pincel do sequenciador polar.
 */

import { ScaleCatalog, NOTE_NAMES } from '../surface/ScaleCatalog.js';

export const OCTAVE_COLORS = {
  0: '#3a86ff', // Azul profundo
  1: '#00f5d4', // Ciano / Turquesa
  2: '#70e000', // Verde / Esmeralda
  3: '#ffbe0b', // Âmbar / Dourado
  4: '#ff006e', // Magenta / Rosa neon
  5: '#ffffff'  // Branco
};

export class PianoPalette {
  constructor(container, soundEngine = null) {
    this.container = container;
    this.soundEngine = soundEngine;

    this.activeNote = 'C3';
    this.activeMidi = 48;
    this.activeVel = 90;
    this.eraseMode = false;

    this.listeners = new Set();
    this.keyElements = new Map(); // noteStr -> DOM element

    this._render();
  }

  getBrush() {
    return {
      note: this.activeNote,
      midi: this.activeMidi,
      vel: this.activeVel,
      color: this.getNoteColor(this.activeNote),
      eraseMode: this.eraseMode
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
          <div class="brush-indicator" id="paletteBrushDisplay" title="Nota ativa selecionada no pincel">
            <span class="brush-dot" style="background: ${this.getNoteColor(this.activeNote)};"></span>
            <span class="brush-label">PINCEL:</span>
            <span class="brush-note" id="brushNoteText">${this.activeNote}</span>
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

            <div class="palette-octave-legend">
              <span class="oct-tag" style="--c: ${OCTAVE_COLORS[0]}">Oit 0</span>
              <span class="oct-tag" style="--c: ${OCTAVE_COLORS[1]}">Oit 1</span>
              <span class="oct-tag" style="--c: ${OCTAVE_COLORS[2]}">Oit 2</span>
              <span class="oct-tag" style="--c: ${OCTAVE_COLORS[3]}">Oit 3</span>
              <span class="oct-tag" style="--c: ${OCTAVE_COLORS[4]}">Oit 4</span>
              <span class="oct-tag" style="--c: ${OCTAVE_COLORS[5]}">Oit 5</span>
            </div>
          </div>
        </div>

        <div class="piano-keyboard-scroll" id="pianoScrollArea">
          <div class="piano-keyboard" id="pianoKeyboard"></div>
        </div>
      </div>
    `;

    this._generateKeys();
    this._bindEvents();
    this._highlightActiveKey();

    // Rola suavemente para centralizar a Oitava 3 inicialmente
    setTimeout(() => {
      const c3Key = this.keyElements.get('C3');
      const scrollArea = this.container.querySelector('#pianoScrollArea');
      if (c3Key && scrollArea) {
        scrollArea.scrollLeft = c3Key.offsetLeft - scrollArea.clientWidth / 2 + 30;
      }
    }, 100);
  }

  _generateKeys() {
    const keyboardEl = this.container.querySelector('#pianoKeyboard');
    keyboardEl.innerHTML = '';
    this.keyElements.clear();

    // 5 oitavas de C0 (12) a C5 (72) = 61 teclas
    const startMidi = 12; // C0
    const endMidi = 72;   // C5

    let whiteKeyIndex = 0;

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
        // Posicionamento relativo à tecla branca anterior
        keyEl.innerHTML = `<span class="key-name">${noteStr}</span>`;
      } else {
        keyEl.innerHTML = `
          <span class="key-name ${noteStr.startsWith('C') ? 'key-root-name' : ''}">${noteStr}</span>
        `;
        whiteKeyIndex++;
      }

      keyboardEl.appendChild(keyEl);
      this.keyElements.set(noteStr, keyEl);
    }
  }

  _bindEvents() {
    const btnErase = this.container.querySelector('#btnEraseMode');
    const velSlider = this.container.querySelector('#paletteVelSlider');
    const velDisplay = this.container.querySelector('#paletteVelDisplay');

    btnErase.addEventListener('click', () => {
      this.eraseMode = !this.eraseMode;
      btnErase.classList.toggle('active', this.eraseMode);
      this._updateBrushDisplay();
      this.notify();
    });

    velSlider.addEventListener('input', (e) => {
      this.activeVel = parseInt(e.target.value, 10);
      velDisplay.textContent = this.activeVel;
      this.notify();
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

  selectNote(noteStr, midi = null, playPreview = true) {
    this.activeNote = noteStr;
    this.activeMidi = midi !== null ? midi : ScaleCatalog.noteToMidi(noteStr);
    this.eraseMode = false;

    const btnErase = this.container.querySelector('#btnEraseMode');
    if (btnErase) btnErase.classList.remove('active');

    this._updateBrushDisplay();
    this._highlightActiveKey();

    if (playPreview && this.soundEngine) {
      this.soundEngine.unlock();
      this.soundEngine.playNote({
        note: this.activeNote,
        velocity: this.activeVel,
        duration: 260,
        soundSource: 'synth:pluck',
        gain: 0.8
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
