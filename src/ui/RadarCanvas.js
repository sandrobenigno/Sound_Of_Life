/**
 * RadarCanvas.js
 * Componente de visualização e controle interativo do Radar SOL com suporte a mouse, toque e atalhos.
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
    this.renderer.resize(finalSize, finalSize);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.handleResize());

    // Interação com Mouse / Pointer
    this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', () => this._onPointerUp());

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
      }
    });
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
    if (e.button !== 0) return; // Apenas botão esquerdo
    this.isMouseDown = true;
    const pos = this._getCanvasCoordinates(e);
    const hit = this.solCore.geo.screenToPolarGrid(
      pos.x,
      pos.y,
      this.canvas.width / 2,
      this.canvas.height / 2
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
    const hit = this.solCore.geo.screenToPolarGrid(
      pos.x,
      pos.y,
      this.canvas.width / 2,
      this.canvas.height / 2
    );

    if (hit.inBounds) {
      if (hit.col !== this.lastPaintedCell.col || hit.row !== this.lastPaintedCell.row) {
        this.solCore.setCell(hit.col, hit.row, this.drawMode);
        this.lastPaintedCell = { col: hit.col, row: hit.row };
      }
    }
  }

  _onPointerUp() {
    this.isMouseDown = false;
    this.lastPaintedCell = { col: -1, row: -1 };
  }

  render() {
    this.renderer.render(this.solCore);
  }
}
