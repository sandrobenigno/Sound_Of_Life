/**
 * RadarCanvas.js
 * Componente de visualização e controle interativo do Radar SOL com suporte a mouse, toque e atalhos.
 * Utiliza o motor vetorial nativo Canvas 2D de alta fidelidade e persistência de fósforo.
 */

import { RadarRenderer } from '../core/RadarRenderer.js';

export class RadarCanvas {
  constructor(container, solCore) {
    this.container = container;
    this.solCore = solCore;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sol-radar-canvas';
    this.container.appendChild(this.canvas);

    this.renderer = new RadarRenderer(this.canvas, this.solCore.geo, {
      logoUrl: 'public/assets/sol.png'
    });

    this.isMouseDown = false;
    this.drawMode = 1; // 1 = ativando células, 0 = apagando células
    this.lastPaintedCell = { col: -1, row: -1 };

    this._bindEvents();
    this.handleResize();
  }

  handleResize() {
    const rect = this.container.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width || 750, rect.height || 750));
    const finalSize = Math.max(320, size);

    if (this.renderer) {
      this.renderer.resize(finalSize, finalSize);
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.handleResize());

    // Interação com Mouse / Pointer / Touch
    this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));

    // Atalhos de teclado
    window.addEventListener('keydown', (e) => {
      // Ignora se o usuário estiver digitando em um input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const key = e.key.toUpperCase();
      if (key === 'C') {
        this.solCore.clear();
      } else if (key === 'I') {
        this.solCore.restart();
      } else if (key === 'P' || e.code === 'Space') {
        e.preventDefault();
        this.solCore.togglePause();
      } else if (key === 'R') {
        this.solCore.randomize();
      } else if (key === 'A') {
        this.solCore.toggleAutoRand();
      } else if (key === 'O') {
        this.solCore.broadcaster.toggleBridgeEnabled();
      }
    });
  }

  _getCanvasCoordinates(e) {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  _onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // Apenas botão principal no mouse
    this.isMouseDown = true;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const pos = this._getCanvasCoordinates(e);
    const centerX = this.renderer ? this.renderer.centerX : this.canvas.width / 2;
    const centerY = this.renderer ? this.renderer.centerY : this.canvas.height / 2;
    const hit = this.solCore.geo.screenToPolarGrid(
      pos.x,
      pos.y,
      centerX,
      centerY
    );

    if (hit.inBounds) {
      const current = this.solCore.gol.getCell(hit.col, hit.row);
      this.drawMode = current === 1 ? 0 : 1;
      this.solCore.setCell(hit.col, hit.row, this.drawMode);
      this.lastPaintedCell = { col: hit.col, row: hit.row };
    }
  }

  _onPointerMove(e) {
    if (!this.isMouseDown) return;
    const pos = this._getCanvasCoordinates(e);
    const centerX = this.renderer ? this.renderer.centerX : this.canvas.width / 2;
    const centerY = this.renderer ? this.renderer.centerY : this.canvas.height / 2;
    const hit = this.solCore.geo.screenToPolarGrid(
      pos.x,
      pos.y,
      centerX,
      centerY
    );

    if (hit.inBounds) {
      if (hit.col !== this.lastPaintedCell.col || hit.row !== this.lastPaintedCell.row) {
        this.solCore.setCell(hit.col, hit.row, this.drawMode);
        this.lastPaintedCell = { col: hit.col, row: hit.row };
      }
    }
  }

  _onPointerUp(e) {
    this.isMouseDown = false;
    this.lastPaintedCell = { col: -1, row: -1 };
    if (e && e.pointerId) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  }

  render() {
    this.renderer.render(this.solCore);
  }
}


