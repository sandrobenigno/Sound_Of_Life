/**
 * SequencerCanvas.js
 * Componente interativo que gerencia o Canvas do Sequenciador Polar,
 * suporte às ferramentas do cursor (Inserir, Tocar/Mover, Borracha),
 * cursores visuais temáticos e histórico de alterações (Undo/Redo).
 */

import { SequencerRadarRenderer } from './SequencerRadarRenderer.js';

// SVG Eraser Cursor customizado em formato Data URL
const ERASER_CURSOR_DATA = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23ff4d79' stroke='%23ffffff' stroke-width='1.5' stroke-linejoin='round' d='M16.24 3.56l4.95 4.95a2 2 0 0 1 0 2.83L11.5 21H3v-8.5l9.69-9.69a2 2 0 0 1 2.83 0z'/%3E%3Cpath fill='%23ffffff' opacity='0.5' d='M9.5 9l5.5 5.5'/%3E%3Cpath fill='%2300e5ff' d='M3 21h8.5l-3.5-3.5H3z'/%3E%3C/svg%3E\") 4 20, cell, crosshair";

export class SequencerCanvas {
  constructor(container, core, palette) {
    this.container = container;
    this.core = core;
    this.palette = palette;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sol-sequencer-canvas tool-insert';
    this.container.appendChild(this.canvas);

    this.renderer = new SequencerRadarRenderer(this.canvas, this.core, {
      logoUrl: 'public/assets/sol.png'
    });

    if (this.palette) {
      this.renderer.selectedRingIndex = this.palette.selectedRingIndex || 0;
      this.palette.onRingChange((ring) => {
        this.renderer.selectedRingIndex = ring;
      });

      this.palette.onToolChange((tool) => {
        this._updateCursor(tool);
      });
    }

    this.isPointerDown = false;
    this.lastPainted = { step: -1, ring: -1 };
    this.draggedCell = null; // { fromStep, fromRing, cellData }
    this.isStrokeActive = false;

    this._bindEvents();
    this._updateCursor(this.palette ? this.palette.activeTool : 'insert');
    this.handleResize();
    this._startLoop();
  }

  _updateCursor(tool = 'insert', isDragging = false) {
    this.canvas.classList.remove('tool-insert', 'tool-move', 'tool-erase', 'is-dragging');

    if (tool === 'erase') {
      this.canvas.classList.add('tool-erase');
      this.canvas.style.cursor = ERASER_CURSOR_DATA;
    } else if (tool === 'move') {
      this.canvas.classList.add('tool-move');
      if (isDragging) {
        this.canvas.classList.add('is-dragging');
        this.canvas.style.cursor = 'grabbing';
      } else {
        this.canvas.style.cursor = 'grab';
      }
    } else {
      // Inserir (cruz)
      this.canvas.classList.add('tool-insert');
      this.canvas.style.cursor = 'crosshair';
    }
  }

  handleResize() {
    const rect = this.container.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width || 560, rect.height || 560));
    const finalSize = Math.max(300, size);
    this.renderer.resize(finalSize, finalSize);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.handleResize());

    this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));
  }

  _getCanvasCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  _onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.isPointerDown = true;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const coords = this._getCanvasCoordinates(e);
    const hit = this.renderer.screenToStepRing(coords.x, coords.y);
    const tool = this.palette ? this.palette.activeTool : 'insert';

    if (!hit.inBounds) return;

    if (tool === 'insert') {
      // Iniciar traço de inserção com snapshot para Undo
      this.core.saveState('Inserir Nota');
      this.isStrokeActive = true;
      this._applyBrushToCell(hit.step, hit.ring);
      this.lastPainted = { step: hit.step, ring: hit.ring };

    } else if (tool === 'erase') {
      // Iniciar traço de borracha com snapshot para Undo
      this.core.saveState('Apagar Nota');
      this.isStrokeActive = true;
      this.core.toggleCellWithBrush(hit.step, hit.ring, { eraseMode: true });
      this.lastPainted = { step: hit.step, ring: hit.ring };

    } else if (tool === 'move') {
      // Ferramenta Tocar (Soar a Nota) / Mover (Mãozinha)
      const cell = this.core.getCell(hit.step, hit.ring);
      if (cell && cell.active) {
        this.draggedCell = {
          fromStep: hit.step,
          fromRing: hit.ring,
          cellData: { ...cell }
        };
        this._updateCursor('move', true);

        // 1. Soar a nota imediatamente com o instrumento da sua trilha
        this._playCellAudition(cell, hit.ring);

        // 2. Destaca visualmente a tecla no piano
        if (this.palette) {
          this.palette.flashKey(cell.note);
          this.palette.setSelectedRing(hit.ring);
        }

        // 3. Define a célula fantasma inicial
        this.renderer.setDragGhost({
          step: hit.step,
          ring: hit.ring,
          note: cell.note
        });
      }
    }
  }

  _onPointerMove(e) {
    if (!this.isPointerDown) return;
    const coords = this._getCanvasCoordinates(e);
    const hit = this.renderer.screenToStepRing(coords.x, coords.y);
    const tool = this.palette ? this.palette.activeTool : 'insert';

    if (tool === 'insert' && hit.inBounds) {
      if (hit.step !== this.lastPainted.step || hit.ring !== this.lastPainted.ring) {
        this._applyBrushToCell(hit.step, hit.ring);
        this.lastPainted = { step: hit.step, ring: hit.ring };
      }
    } else if (tool === 'erase' && hit.inBounds) {
      if (hit.step !== this.lastPainted.step || hit.ring !== this.lastPainted.ring) {
        this.core.toggleCellWithBrush(hit.step, hit.ring, { eraseMode: true });
        this.lastPainted = { step: hit.step, ring: hit.ring };
      }
    } else if (tool === 'move' && this.draggedCell) {
      if (hit.inBounds) {
        this.renderer.setDragGhost({
          step: hit.step,
          ring: hit.ring,
          note: this.draggedCell.cellData.note
        });
      } else {
        this.renderer.setDragGhost(null);
      }
    }
  }

  _onPointerUp(e) {
    const tool = this.palette ? this.palette.activeTool : 'insert';

    if (tool === 'move' && this.draggedCell) {
      if (e) {
        const coords = this._getCanvasCoordinates(e);
        const hit = this.renderer.screenToStepRing(coords.x, coords.y);

        if (hit.inBounds && (hit.step !== this.draggedCell.fromStep || hit.ring !== this.draggedCell.fromRing)) {
          // Move a nota para o novo destino com snapshot de Undo
          this.core.saveState('Mover Nota');
          this.core.moveCell(this.draggedCell.fromStep, this.draggedCell.fromRing, hit.step, hit.ring);

          // Toca o som no novo anel como confirmação
          this._playCellAudition(this.draggedCell.cellData, hit.ring);
          if (this.palette) {
            this.palette.flashKey(this.draggedCell.cellData.note);
            this.palette.setSelectedRing(hit.ring);
          }
        }
      }

      this.renderer.setDragGhost(null);
      this.draggedCell = null;
      this._updateCursor('move', false);
    }

    this.isPointerDown = false;
    this.isStrokeActive = false;
    this.lastPainted = { step: -1, ring: -1 };
  }

  _applyBrushToCell(step, ring) {
    const brush = this.palette ? this.palette.getBrush() : { eraseMode: false, note: 'C3', vel: 90 };
    this.core.toggleCellWithBrush(step, ring, brush);

    // Se pintou uma nota, dá um feedback auditivo suave
    if (!brush.eraseMode && this.palette && this.palette.soundEngine) {
      let soundSource = 'synth:pluck';
      let gain = 0.45;
      if (this.palette.trackManager) {
        const track = this.palette.trackManager.getTrack(ring);
        if (track) {
          soundSource = track.soundSource;
          gain = track.gain * 0.7;
        }
      }

      this.palette.soundEngine.unlock();
      this.palette.soundEngine.playNote({
        note: brush.note,
        velocity: Math.max(40, brush.vel),
        duration: 160,
        soundSource,
        gain
      });
    }
  }

  _playCellAudition(cell, ring) {
    if (!this.palette || !this.palette.soundEngine) return;

    let soundSource = 'synth:saw';
    let gain = 0.85;

    if (this.palette.trackManager) {
      const track = this.palette.trackManager.getTrack(ring);
      if (track) {
        soundSource = track.soundSource;
        gain = track.gain;
      }
    }

    this.palette.soundEngine.unlock();
    this.palette.soundEngine.playNote({
      note: cell.note,
      velocity: cell.vel || 90,
      duration: 320,
      soundSource,
      gain
    });
  }

  _startLoop() {
    const loop = (timestamp) => {
      this.core.update(timestamp);
      this.renderer.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
