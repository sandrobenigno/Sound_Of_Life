/**
 * SequencerRadarRenderer.js
 * Renderizador Canvas 2D de alta fidelidade para o Disco Polar Sequenciador.
 * Desenha setores angulares, trilhas concêntricas, células melódicas com texto de nota e cores de oitava,
 * além do feixe de varredura com persistência de fósforo.
 */

import { OCTAVE_COLORS } from './PianoPalette.js';

export class SequencerRadarRenderer {
  constructor(canvas, core, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.core = core;

    this.width = options.width || 600;
    this.height = options.height || 600;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;

    this.logoImg = null;
    if (options.logoUrl) {
      this.logoImg = new Image();
      this.logoImg.src = options.logoUrl;
    }

    this.selectedRingIndex = 0; // Anel ativo de referência

    this.resize(this.width, this.height);
  }

  resize(w, h) {
    this.width = Math.max(300, Math.floor(w));
    this.height = Math.max(300, Math.floor(h));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;

    this.outerRadius = (Math.min(this.width, this.height) / 2) * 0.94;
    this.innerRadius = this.outerRadius * 0.22;
    this.ringWidth = (this.outerRadius - this.innerRadius) / Math.max(1, this.core.rings);
  }

  /**
   * Converte tela (screenX, screenY) para (step, ring)
   */
  screenToStepRing(screenX, screenY) {
    const relX = screenX - this.centerX;
    const relY = screenY - this.centerY;
    const radius = Math.sqrt(relX * relX + relY * relY);

    if (radius < this.innerRadius || radius > this.outerRadius) {
      return { inBounds: false, step: -1, ring: -1 };
    }

    let angleDeg = Math.atan2(relY, relX) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    const sliceAngle = 360 / this.core.steps;
    const step = Math.floor(angleDeg / sliceAngle) % this.core.steps;
    const ring = Math.min(this.core.rings - 1, Math.floor((radius - this.innerRadius) / this.ringWidth));

    return { inBounds: true, step, ring, angleDeg, radius };
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = this.centerX;
    const cy = this.centerY;
    const steps = this.core.steps;
    const rings = this.core.rings;
    const sliceAngle = (2 * Math.PI) / steps;

    this.ringWidth = (this.outerRadius - this.innerRadius) / Math.max(1, rings);

    // 1. Limpeza do fundo com rastro fosforescente suave
    ctx.fillStyle = 'rgba(2, 6, 12, 0.45)';
    ctx.fillRect(0, 0, w, h);

    // 2. Desenho do disco base
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, this.outerRadius, 0, Math.PI * 2);
    ctx.arc(cx, cy, this.innerRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = '#060d17';
    ctx.fill();
    ctx.restore();

    // 3. Grid de Anéis (Trilhas)
    ctx.save();
    for (let r = 0; r <= rings; r++) {
      const rad = this.innerRadius + r * this.ringWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = r === rings || r === 0 ? 'rgba(0, 255, 255, 0.4)' : 'rgba(0, 255, 255, 0.12)';
      ctx.lineWidth = r === rings || r === 0 ? 1.5 : 0.8;
      ctx.stroke();
    }
    ctx.restore();

    // 3.1 Realce do Anel de Referência (Som do Teclado)
    if (this.selectedRingIndex !== null && this.selectedRingIndex >= 0 && this.selectedRingIndex < rings) {
      const rIn = this.innerRadius + this.selectedRingIndex * this.ringWidth;
      const rOut = rIn + this.ringWidth;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
      ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(255, 183, 3, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 183, 3, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Grid de Fatias (Steps)
    ctx.save();
    for (let s = 0; s < steps; s++) {
      const ang = s * sliceAngle;
      const isBeat = s % 4 === 0;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * this.innerRadius, cy + Math.sin(ang) * this.innerRadius);
      ctx.lineTo(cx + Math.cos(ang) * this.outerRadius, cy + Math.sin(ang) * this.outerRadius);
      ctx.strokeStyle = isBeat ? 'rgba(0, 255, 255, 0.35)' : 'rgba(0, 255, 255, 0.08)';
      ctx.lineWidth = isBeat ? 1.5 : 0.8;
      ctx.stroke();
    }
    ctx.restore();

    // 5. Células Melódicas Ativas
    ctx.save();
    for (let s = 0; s < steps; s++) {
      const startAng = s * sliceAngle;
      const endAng = startAng + sliceAngle;

      for (let r = 0; r < rings; r++) {
        const cell = this.core.getCell(s, r);
        if (!cell || !cell.active) continue;

        const rIn = this.innerRadius + r * this.ringWidth;
        const rOut = rIn + this.ringWidth;

        // Cor baseada na oitava da nota
        const match = cell.note.match(/-?\d+/);
        const oct = match ? parseInt(match[0], 10) : 3;
        const cellColor = OCTAVE_COLORS[oct] || '#00ffff';

        // Desenho do setor preenchido
        ctx.beginPath();
        ctx.arc(cx, cy, rOut - 1, startAng, endAng);
        ctx.arc(cx, cy, rIn + 1, endAng, startAng, true);
        ctx.closePath();

        ctx.fillStyle = cellColor;
        ctx.shadowColor = cellColor;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.85;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // Texto da nota centralizado na célula
        const midAng = (startAng + endAng) / 2;
        const midR = (rIn + rOut) / 2;
        const textX = cx + Math.cos(midAng) * midR;
        const textY = cy + Math.sin(midAng) * midR;

        ctx.font = `bold ${Math.max(8, Math.min(13, Math.floor(this.ringWidth * 0.45)))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText(cell.note, textX, textY);
      }
    }
    ctx.restore();

    // 6. Feixe de Varredura (Scanner fosforescente)
    ctx.save();
    const beamAngleRad = (this.core.currentAngle * Math.PI) / 180;
    const trailSpanRad = (sliceAngle * 1.5);

    // Gradiente angular de rastro fosforescente
    const grad = ctx.createRadialGradient(cx, cy, this.innerRadius, cx, cy, this.outerRadius);
    grad.addColorStop(0, 'rgba(0, 255, 136, 0.15)');
    grad.addColorStop(1, 'rgba(0, 255, 255, 0.35)');

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, this.outerRadius, beamAngleRad - trailSpanRad, beamAngleRad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Linha de laser primária do scanner
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(beamAngleRad) * this.innerRadius, cy + Math.sin(beamAngleRad) * this.innerRadius);
    ctx.lineTo(cx + Math.cos(beamAngleRad) * this.outerRadius, cy + Math.sin(beamAngleRad) * this.outerRadius);
    ctx.strokeStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 7. Núcleo Central
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, this.innerRadius - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#020509';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (this.logoImg && this.logoImg.complete && this.logoImg.naturalWidth > 0) {
      const logoSize = (this.innerRadius * 1.35);
      ctx.drawImage(this.logoImg, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`P ${this.core.currentStep + 1}/${steps}`, cx, cy - 6);
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(`${this.core.bpm} BPM`, cx, cy + 9);
    }
    ctx.restore();
  }
}
