/**
 * PolarGeometry.js
 * Utilitários e cálculos geométricos para conversão Cartesiano <-> Polar na grade do Radar SOL.
 */

export class PolarGeometry {
  constructor(options = {}) {
    this.cols = options.cols || 72; // 72 fatias de 5 graus (360 / 72 = 5)
    this.rows = options.rows || 24; // 24 pistas / anéis concêntricos
    this.diam = options.diam || 750; // Diâmetro externo padrão
    this.sliceAngle = 360 / this.cols; // 5 graus por fatia
    this.updateMetrics(this.diam);
  }

  updateMetrics(diam) {
    this.diam = diam;
    this.dec = (this.diam / this.rows) / 2;
    this.cell = this.dec / 2;
    this.gap = this.diam - (this.dec * this.rows);
    this.label = (this.diam / 3) + (this.dec * 3);
    this.outerRadius = this.diam / 2;
    this.innerRadius = this.gap / 2;
  }

  /**
   * Converte coordenadas cartesianas (relativas ao centro do radar) para (coluna, linha)
   * row 0 = Pista interna (CH 1)
   * row 23 = Pista externa (CH 24)
   */
  cartesianToPolarGrid(x, y) {
    const radius = Math.sqrt(x * x + y * y);
    let angleDeg = Math.atan2(y, x) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    // Verifica se o clique está dentro da área ativa do radar
    if (radius <= this.outerRadius && radius >= this.innerRadius) {
      const col = Math.floor(angleDeg / this.sliceAngle);
      const row = Math.min(this.rows - 1, Math.floor((radius - this.innerRadius) / this.cell));

      if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
        return { col, row, radius, angleDeg, inBounds: true };
      }
    }

    return { col: -1, row: -1, radius, angleDeg, inBounds: false };
  }

  /**
   * Converte coordenadas de tela (clientX, clientY) para (coluna, linha) dado o centro do canvas
   */
  screenToPolarGrid(screenX, screenY, centerX, centerY) {
    const relX = screenX - centerX;
    const relY = screenY - centerY;
    return this.cartesianToPolarGrid(relX, relY);
  }

  /**
   * Retorna as coordenadas cartesianas do centro de uma célula (coluna, linha)
   * row 0 = Pista interna (CH 1)
   * row 23 = Pista externa (CH 24)
   */
  polarGridToCartesian(col, row) {
    const r = this.innerRadius + (row * this.cell) + (this.cell / 2);
    const a = this.sliceAngle * col + (this.sliceAngle / 2);
    const rad = a * (Math.PI / 180);
    return {
      x: r * Math.cos(rad),
      y: r * Math.sin(rad),
      radius: r,
      angleDeg: a,
      cellSize: this.cell
    };
  }

  /**
   * Retorna os pontos inicial e final da linha do scanner no ângulo dado
   */
  getScannerLine(angleDeg) {
    const rad = (angleDeg + (this.sliceAngle / 2)) * (Math.PI / 180);
    return {
      x0: this.innerRadius * Math.cos(rad),
      y0: this.innerRadius * Math.sin(rad),
      x1: this.outerRadius * Math.cos(rad),
      y1: this.outerRadius * Math.sin(rad),
      angleDeg
    };
  }
}
