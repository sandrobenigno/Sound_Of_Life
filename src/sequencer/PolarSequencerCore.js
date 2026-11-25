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

    // Matriz de dados: grid[step][ring] = { active, note, midi, vel, durRatio, color }
    this.grid = [];
    this._initGrid();

    // Histórico de Ações (Undo / Redo)
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.historyListeners = new Set();

    // Ouvintes de eventos
    this.stepListeners = new Set();
    this.changeListeners = new Set();
  }

  _cloneGrid(grid = this.grid) {
    return grid.map(col => col.map(cell => ({ ...cell })));
  }

  /**
   * Salva um instantâneo do grid atual na pilha de Undo
   */
  saveState(actionName = '') {
    this.undoStack.push(this._cloneGrid(this.grid));
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
    this.redoStack.push(this._cloneGrid(this.grid));
    const previous = this.undoStack.pop();
    this.grid = this._cloneGrid(previous);
    this.notifyChange();
    this._notifyHistoryChange();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    this.undoStack.push(this._cloneGrid(this.grid));
    const next = this.redoStack.pop();
    this.grid = this._cloneGrid(next);
    this.notifyChange();
    this._notifyHistoryChange();
    return true;
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

  _initGrid() {
    this.grid = [];
    for (let s = 0; s < this.steps; s++) {
      const col = [];
      for (let r = 0; r < this.rings; r++) {
        col.push({
          active: false,
          note: 'C3',
          midi: 48,
          vel: 90,
          durRatio: 1.0,
          color: '#00ffff'
        });
      }
      this.grid.push(col);
    }
  }

  /**
   * Altera a resolução do sequenciador mantendo os dados existentes onde compatível
   */
  setResolution(newSteps, newRings) {
    const sCount = Math.max(4, Math.min(64, parseInt(newSteps, 10) || 16));
    const rCount = Math.max(2, Math.min(24, parseInt(newRings, 10) || 8));

    if (sCount === this.steps && rCount === this.rings) return;
    this.saveState('Mudar Resolução');

    const oldGrid = this.grid;
    const oldSteps = this.steps;
    const oldRings = this.rings;

    this.steps = sCount;
    this.rings = rCount;
    this.grid = [];

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
      this.grid.push(col);
    }

    if (this.currentStep >= this.steps) {
      this.currentStep = 0;
    }
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
      this.currentStep = (this.currentStep + 1) % this.steps;
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

  toJSON() {
    const cellsData = [];
    for (let s = 0; s < this.steps; s++) {
      for (let r = 0; r < this.rings; r++) {
        const c = this.grid[s][r];
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

    return {
      version: '1.0',
      type: 'sol_polar_sequencer',
      bpm: this.bpm,
      steps: this.steps,
      rings: this.rings,
      stepsPerBeat: this.stepsPerBeat,
      cells: cellsData
    };
  }

  fromJSON(data) {
    if (!data) return;
    this.steps = data.steps || 16;
    this.rings = data.rings || 8;
    this.bpm = data.bpm || 120;
    this.stepsPerBeat = data.stepsPerBeat || 4;

    this._initGrid();

    if (Array.isArray(data.cells)) {
      for (const item of data.cells) {
        if (item.step < this.steps && item.ring < this.rings) {
          this.grid[item.step][item.ring] = {
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

    this.notifyChange();
  }
}
