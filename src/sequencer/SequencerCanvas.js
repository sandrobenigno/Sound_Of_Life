/**
 * SequencerCanvas.js
 * Componente interativo que gerencia o Canvas do Sequenciador Polar,
 * captura eventos de mouse/touch para pintar e apagar células com o pincel ativo,
 * e controla o loop de animação do scanner.
 */

import { SequencerRadarRenderer } from './SequencerRadarRenderer.js';

export class SequencerCanvas {
  constructor(container, core, palette) {
    this.container = container;
    this.core = core;
    this.palette = palette;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sol-sequencer-canvas';
    this.container.appendChild(this.canvas);

    this.renderer = new SequencerRadarRenderer(this.canvas, this.core, {
      logoUrl: 'public/assets/sol.png'
    });

    if (this.palette) {
      this.renderer.selectedRingIndex = this.palette.selectedRingIndex || 0;
      this.palette.onRingChange((ring) => {
        this.renderer.selectedRingIndex = ring;
      });
    }

    this.isPointerDown = false;
    this.lastPainted = { step: -1, ring: -1 };

    this._bindEvents();
    this.handleResize();
    this._startLoop();
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
    window.addEventListener('pointerup', () => this._onPointerUp());
    window.addEventListener('pointercancel', () => this._onPointerUp());
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

    if (hit.inBounds) {
      this._applyBrushToCell(hit.step, hit.ring);
      this.lastPainted = { step: hit.step, ring: hit.ring };
    }
  }

  _onPointerMove(e) {
    if (!this.isPointerDown) return;
    const coords = this._getCanvasCoordinates(e);
    const hit = this.renderer.screenToStepRing(coords.x, coords.y);

    if (hit.inBounds) {
      if (hit.step !== this.lastPainted.step || hit.ring !== this.lastPainted.ring) {
        this._applyBrushToCell(hit.step, hit.ring);
        this.lastPainted = { step: hit.step, ring: hit.ring };
      }
    }
  }

  _onPointerUp() {
    this.isPointerDown = false;
    this.lastPainted = { step: -1, ring: -1 };
  }

  _applyBrushToCell(step, ring) {
    const brush = this.palette.getBrush();
    this.core.toggleCellWithBrush(step, ring, brush);

    // Se pintou uma nota, dá um feedback auditivo suave
    if (!brush.eraseMode && this.palette.soundEngine) {
      this.palette.soundEngine.unlock();
      this.palette.soundEngine.playNote({
        note: brush.note,
        velocity: Math.max(40, brush.vel),
        duration: 140,
        soundSource: 'synth:pluck',
        gain: 0.4
      });
    }
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
