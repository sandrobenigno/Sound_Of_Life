/**
 * PolarSequencerCore.js
 * Motor lógico central do Sequenciador Polar.
 * Gerencia a matriz dimensional de células melódicas (steps x rings),
 * o clock de reprodução por BPM/subdivisão e o avanço do feixe de varredura.
 */

import { ScaleCatalog } from '../surface/ScaleCatalog.js';

export class PolarSequencerCore {
  constructor(options = {}) {
    this.steps = options.steps || 16; // Fatias radiais / passos de tempo (8, 12, 16, 24, 32, 48)
    this.rings = options.rings || 8;  // Trilhas concêntricas / vozes (4, 6, 8, 12, 16)
    this.bpm = options.bpm || 120;
    this.stepsPerBeat = options.stepsPerBeat || 4; // 4 = semicolcheias (16th notes) em 4/4

    this.isPlaying = false;
    this.currentStep = 0;
    this.currentAngle = 0; // 0 a 360 graus suave para renderização visual

    this.lastTickTime = 0;
    this.accumulatedTime = 0;

    // Gerenciamento de Patterns (Slots 1 a 10 / Mapeados em 1-9 e 0)
    this.numPatterns = 10;
    this.patterns = [];
    this.activePatternIndex = 0;
    this.queuedPatternIndex = null; // Pattern na fila para transição quantizada no compasso
    this.patternListeners = new Set();

    // Matriz de dados ativa: grid[step][ring] aponta para o pattern ativo
    this.grid = [];
    this._initPatterns();

    // Histórico de Ações (Undo / Redo)
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.historyListeners = new Set();

    // Ouvintes de eventos
    this.stepListeners = new Set();
    this.changeListeners = new Set();
  }

  _createEmptyGrid(steps = this.steps, rings = this.rings) {
    const grid = [];
    for (let s = 0; s < steps; s++) {
      const col = [];
      for (let r = 0; r < rings; r++) {
        col.push({
          active: false,
          note: 'C3',
          midi: 48,
          vel: 90,
          durRatio: 1.0,
          color: '#00ffff'
        });
      }
      grid.push(col);
    }
    return grid;
  }

  _initPatterns() {
    this.patterns = [];
    for (let i = 0; i < this.numPatterns; i++) {
      this.patterns.push(this._createEmptyGrid());
    }
    this.activePatternIndex = 0;
    this.queuedPatternIndex = null;
    this.grid = this.patterns[0];
  }

  _initGrid() {
    this._initPatterns();
  }

  _cloneGrid(grid = this.grid) {
    return grid.map(col => col.map(cell => ({ ...cell })));
  }

  /**
   * Salva um instantâneo de todos os patterns e do pattern ativo na pilha de Undo
   */
  saveState(actionName = '') {
    const snapshot = {
      activePatternIndex: this.activePatternIndex,
      patterns: this.patterns.map(p => this._cloneGrid(p))
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this._notifyHistoryChange();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return false;
    const current = {
      activePatternIndex: this.activePatternIndex,
      patterns: this.patterns.map(p => this._cloneGrid(p))
    };
    this.redoStack.push(current);
    const prev = this.undoStack.pop();
    this.patterns = prev.patterns.map(p => this._cloneGrid(p));
    this.activePatternIndex = Math.min(this.numPatterns - 1, prev.activePatternIndex || 0);
    this.grid = this.patterns[this.activePatternIndex];
    this.queuedPatternIndex = null;
    this.notifyChange();
    this._notifyPatternChange();
    this._notifyHistoryChange();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const current = {
      activePatternIndex: this.activePatternIndex,
      patterns: this.patterns.map(p => this._cloneGrid(p))
    };
    this.undoStack.push(current);
    const next = this.redoStack.pop();
    this.patterns = next.patterns.map(p => this._cloneGrid(p));
    this.activePatternIndex = Math.min(this.numPatterns - 1, next.activePatternIndex || 0);
    this.grid = this.patterns[this.activePatternIndex];
    this.queuedPatternIndex = null;
    this.notifyChange();
    this._notifyPatternChange();
    this._notifyHistoryChange();
    return true;
  }

  /**
   * Seleciona um pattern com suporte a quantização musical (espera o fim do compasso se estiver tocando)
   */
  selectPattern(index, immediate = false) {
    if (index < 0 || index >= this.numPatterns) return;
    if (index === this.activePatternIndex && this.queuedPatternIndex === null) return;

    if (!this.isPlaying || immediate) {
      this.queuedPatternIndex = null;
      this.activePatternIndex = index;
      this.grid = this.patterns[index];
      this._notifyPatternChange();
      this.notifyChange();
    } else {
      // Alterna o status da fila: se já estava na fila, cancela
      if (this.queuedPatternIndex === index) {
        this.queuedPatternIndex = null;
      } else {
        this.queuedPatternIndex = index;
      }
      this._notifyPatternChange();
    }
  }

  /**
   * Copia o conteúdo de um pattern para outro
   */
  copyPattern(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.numPatterns) return false;
    if (toIndex < 0 || toIndex >= this.numPatterns) return false;
    if (fromIndex === toIndex) return false;

    this.saveState(`Copiar P${fromIndex + 1} -> P${toIndex + 1}`);
    this.patterns[toIndex] = this._cloneGrid(this.patterns[fromIndex]);
    if (this.activePatternIndex === toIndex) {
      this.grid = this.patterns[toIndex];
    }
    this._notifyPatternChange();
    this.notifyChange();
    return true;
  }

  /**
   * Limpa o conteúdo de um pattern específico
   */
  clearPattern(index = this.activePatternIndex) {
    if (index < 0 || index >= this.numPatterns) return;
    this.saveState(`Limpar P${index + 1}`);
    const p = this.patterns[index];
    for (let s = 0; s < this.steps; s++) {
      for (let r = 0; r < this.rings; r++) {
        p[s][r].active = false;
      }
    }
    this._notifyPatternChange();
    this.notifyChange();
  }

  hasPatternContent(index) {
    const p = this.patterns[index];
    if (!p) return false;
    for (let s = 0; s < this.steps; s++) {
      for (let r = 0; r < this.rings; r++) {
        if (p[s] && p[s][r] && p[s][r].active) return true;
      }
    }
    return false;
  }

  onPatternChange(cb) {
    this.patternListeners.add(cb);
    try {
      cb({
        activePatternIndex: this.activePatternIndex,
        queuedPatternIndex: this.queuedPatternIndex,
        numPatterns: this.numPatterns
      });
    } catch (_) {}
    return () => this.patternListeners.delete(cb);
  }

  _notifyPatternChange() {
    const payload = {
      activePatternIndex: this.activePatternIndex,
      queuedPatternIndex: this.queuedPatternIndex,
      numPatterns: this.numPatterns
    };
    for (const cb of this.patternListeners) {
      try { cb(payload); } catch (e) {
        console.error('[PolarSequencer] Erro no listener de pattern:', e);
      }
    }
  }

  onHistoryChange(cb) {
    this.historyListeners.add(cb);
    try {
      cb({ canUndo: this.canUndo(), canRedo: this.canRedo() });
    } catch (_) {}
    return () => this.historyListeners.delete(cb);
  }

  _notifyHistoryChange() {
    const payload = { canUndo: this.canUndo(), canRedo: this.canRedo() };
    for (const cb of this.historyListeners) {
      try { cb(payload); } catch (e) {
        console.error('[PolarSequencer] Erro no listener de histórico:', e);
      }
    }
  }

  /**
   * Altera a resolução do sequenciador mantendo os dados existentes em todos os patterns
   */
  setResolution(newSteps, newRings) {
    const sCount = Math.max(4, Math.min(64, parseInt(newSteps, 10) || 16));
    const rCount = Math.max(2, Math.min(24, parseInt(newRings, 10) || 8));

    if (sCount === this.steps && rCount === this.rings) return;
    this.saveState('Mudar Resolução');

    const oldSteps = this.steps;
    const oldRings = this.rings;
    const oldPatterns = this.patterns;

    this.steps = sCount;
    this.rings = rCount;
    this.patterns = [];

    for (let i = 0; i < this.numPatterns; i++) {
      const oldGrid = oldPatterns[i] || [];
      const newGrid = [];
      for (let s = 0; s < this.steps; s++) {
        const col = [];
        for (let r = 0; r < this.rings; r++) {
          if (s < oldSteps && r < oldRings && oldGrid[s] && oldGrid[s][r]) {
            col.push({ ...oldGrid[s][r] });
          } else {
            col.push({
              active: false,
              note: 'C3',
              midi: 48,
              vel: 90,
              durRatio: 1.0,
              color: '#00ffff'
            });
          }
        }
        newGrid.push(col);
      }
      this.patterns.push(newGrid);
    }

    this.grid = this.patterns[this.activePatternIndex];
    if (this.currentStep >= this.steps) {
      this.currentStep = 0;
    }
    this._notifyPatternChange();
    this.notifyChange();
  }

  setBpm(bpm) {
    this.bpm = Math.max(20, Math.min(300, parseInt(bpm, 10) || 120));
    this.notifyChange();
  }

  getStepDurationMs() {
    // 60000ms / (BPM * stepsPerBeat)
    return (60000 / (this.bpm * this.stepsPerBeat));
  }

  getCell(step, ring) {
    if (step < 0 || step >= this.steps || ring < 0 || ring >= this.rings) return null;
    return this.grid[step][ring];
  }

  setCell(step, ring, cellData) {
    if (step < 0 || step >= this.steps || ring < 0 || ring >= this.rings) return;
    this.grid[step][ring] = {
      ...this.grid[step][ring],
      ...cellData
    };
    this.notifyChange();
  }

  toggleCellWithBrush(step, ring, brush) {
    if (step < 0 || step >= this.steps || ring < 0 || ring >= this.rings) return null;
    const cell = this.grid[step][ring];

    if (brush.eraseMode) {
      cell.active = false;
    } else {
      // Se já estava ativo com a mesma nota, apaga (toggle intuitivo)
      if (cell.active && cell.note === brush.note) {
        cell.active = false;
      } else {
        cell.active = true;
        cell.note = brush.note;
        cell.midi = brush.midi !== undefined ? brush.midi : ScaleCatalog.noteToMidi(brush.note);
        cell.vel = brush.vel !== undefined ? brush.vel : 90;
        cell.color = brush.color || '#00ffff';
      }
    }

    this.notifyChange();
    return cell;
  }

  moveCell(fromStep, fromRing, toStep, toRing) {
    if (fromStep < 0 || fromStep >= this.steps || fromRing < 0 || fromRing >= this.rings) return false;
    if (toStep < 0 || toStep >= this.steps || toRing < 0 || toRing >= this.rings) return false;
    if (fromStep === toStep && fromRing === toRing) return false;

    const sourceCell = this.grid[fromStep][fromRing];
    if (!sourceCell || !sourceCell.active) return false;

    // Transfere os dados da nota para a nova célula de destino
    this.grid[toStep][toRing] = {
      ...sourceCell,
      active: true
    };

    // Desativa a célula de origem
    this.grid[fromStep][fromRing] = {
      ...sourceCell,
      active: false
    };

    this.notifyChange();
    return true;
  }

  clearAll() {
    this.saveState('Limpar Tudo');
    for (let s = 0; s < this.steps; s++) {
      for (let r = 0; r < this.rings; r++) {
        this.grid[s][r].active = false;
      }
    }
    this.notifyChange();
  }

  play() {
    this.isPlaying = true;
    this.lastTickTime = performance.now();
    this.accumulatedTime = 0;
  }

  pause() {
    this.isPlaying = false;
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  stop() {
    this.isPlaying = false;
    this.currentStep = 0;
    this.currentAngle = 0;
    this.notifyChange();
  }

  /**
   * Atualização de frame (chamada no requestAnimationFrame)
   */
  update(timestamp = performance.now()) {
    if (!this.isPlaying) return;

    if (!this.lastTickTime) {
      this.lastTickTime = timestamp;
      return;
    }

    const delta = timestamp - this.lastTickTime;
    this.lastTickTime = timestamp;
    this.accumulatedTime += delta;

    const stepMs = this.getStepDurationMs();

    // Rotação contínua suave do scanner (0 a 360 graus)
    const stepAngleSpan = 360 / this.steps;
    this.currentAngle = (this.currentAngle + (360 / (stepMs * this.steps)) * delta) % 360;

    // Dispara passos discretos conforme o relógio acumula tempo
    while (this.accumulatedTime >= stepMs) {
      this.accumulatedTime -= stepMs;
      this._triggerCurrentStep();

      const nextStep = (this.currentStep + 1) % this.steps;
      // Se está virando o compasso (downbeat / passo 0) e há pattern enfileirado, troca suavemente!
      if (nextStep === 0 && this.queuedPatternIndex !== null) {
        this.activePatternIndex = this.queuedPatternIndex;
        this.grid = this.patterns[this.activePatternIndex];
        this.queuedPatternIndex = null;
        this._notifyPatternChange();
        this.notifyChange();
      }
      this.currentStep = nextStep;
    }
  }

  _triggerCurrentStep() {
    const s = this.currentStep;
    const ringEvents = [];

    for (let r = 0; r < this.rings; r++) {
      const cell = this.grid[s][r];
      if (cell && cell.active) {
        ringEvents.push({
          ring: r,
          step: s,
          note: cell.note,
          midi: cell.midi,
          vel: cell.vel,
          durRatio: cell.durRatio,
          color: cell.color
        });
      }
    }

    const eventPayload = {
      step: s,
      totalSteps: this.steps,
      totalRings: this.rings,
      angle: (s / this.steps) * 360,
      ringEvents,
      bpm: this.bpm,
      stepDurationMs: this.getStepDurationMs()
    };

    for (const listener of this.stepListeners) {
      try {
        listener(eventPayload);
      } catch (e) {
        console.error('[PolarSequencer] Erro no listener de step:', e);
      }
    }
  }

  onStep(cb) {
    this.stepListeners.add(cb);
    return () => this.stepListeners.delete(cb);
  }

  onChange(cb) {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  notifyChange() {
    for (const cb of this.changeListeners) {
      try {
        cb(this);
      } catch (e) {
        console.error('[PolarSequencer] Erro no listener de change:', e);
      }
    }
  }

  _serializeGrid(grid) {
    const cellsData = [];
    if (!grid) return cellsData;
    for (let s = 0; s < this.steps; s++) {
      for (let r = 0; r < this.rings; r++) {
        const c = grid[s] ? grid[s][r] : null;
        if (c && c.active) {
          cellsData.push({
            step: s,
            ring: r,
            note: c.note,
            midi: c.midi,
            vel: c.vel,
            durRatio: c.durRatio
          });
        }
      }
    }
    return cellsData;
  }

  toJSON() {
    return {
      version: '1.1',
      type: 'sol_polar_sequencer',
      bpm: this.bpm,
      steps: this.steps,
      rings: this.rings,
      stepsPerBeat: this.stepsPerBeat,
      activePatternIndex: this.activePatternIndex,
      patterns: this.patterns.map(p => this._serializeGrid(p)),
      cells: this._serializeGrid(this.grid)
    };
  }

  fromJSON(data) {
    if (!data) return;
    this.steps = data.steps || 16;
    this.rings = data.rings || 8;
    this.bpm = data.bpm || 120;
    this.stepsPerBeat = data.stepsPerBeat || 4;

    this._initPatterns();

    if (Array.isArray(data.patterns) && data.patterns.length > 0) {
      for (let i = 0; i < Math.min(this.numPatterns, data.patterns.length); i++) {
        const pCells = data.patterns[i];
        if (Array.isArray(pCells)) {
          for (const item of pCells) {
            if (item.step < this.steps && item.ring < this.rings) {
              this.patterns[i][item.step][item.ring] = {
                active: true,
                note: item.note || ScaleCatalog.midiToNote(item.midi || 60),
                midi: item.midi !== undefined ? item.midi : ScaleCatalog.noteToMidi(item.note),
                vel: item.vel !== undefined ? item.vel : 90,
                durRatio: item.durRatio || 1.0,
                color: '#00ffff'
              };
            }
          }
        }
      }
      this.activePatternIndex = Math.min(this.numPatterns - 1, data.activePatternIndex || 0);
    } else if (Array.isArray(data.cells)) {
      // Compatibilidade retroativa com arquivos v1.0
      for (const item of data.cells) {
        if (item.step < this.steps && item.ring < this.rings) {
          this.patterns[0][item.step][item.ring] = {
            active: true,
            note: item.note || ScaleCatalog.midiToNote(item.midi || 60),
            midi: item.midi !== undefined ? item.midi : ScaleCatalog.noteToMidi(item.note),
            vel: item.vel !== undefined ? item.vel : 90,
            durRatio: item.durRatio || 1.0,
            color: '#00ffff'
          };
        }
      }
      this.activePatternIndex = 0;
    }

    this.grid = this.patterns[this.activePatternIndex];
    this.queuedPatternIndex = null;
    this._notifyPatternChange();
    this.notifyChange();
  }
}
