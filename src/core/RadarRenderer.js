/**
 * RadarRenderer.js
 * Renderizador Canvas 2D de alta performance reproduzindo com fidelidade a estética
 * de radar fosforescente do Processing original (estilo sci-fi / osciloscópio / radar).
 */

export class RadarRenderer {
  constructor(canvas, geometry, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.geo = geometry;
    this.options = {
      showLeds: options.showLeds ?? true,
      showHeader: options.showHeader ?? true,
      logoUrl: options.logoUrl || 'assets/sol.png',
      ...options
    };

    this.logo = new Image();
    this.logoLoaded = false;
    this.logo.onload = () => {
      this.logoLoaded = true;
    };
    this.logo.src = this.options.logoUrl;

    // Estados para efeitos visuais
    this.lastTriggerStates = new Array(this.geo.rows).fill(false);
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    // Diâmetro balanceado com margem/padding suave ao redor do disco
    const targetDiam = Math.max(260, Math.min(width - 24, height - 64));
    this.geo.updateMetrics(targetDiam);
  }

  /**
   * Renderiza um frame completo
   */
  render(solCore) {
    const { ctx, canvas, geo } = this;
    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Fading background para efeito de persistência fosforescente do feixe
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX, centerY);

    // 2. Desenho das faixas circulares e fatias do Radar
    this._drawRadarGrid(ctx, geo);

    // 3. Desenho do miolo central com logo e autor
    this._drawCenterLabel(ctx, geo);

    // 4. Desenho das células ativas do Game of Life
    this._drawActiveCells(ctx, geo, solCore.gol);

    // 5. Desenho do feixe do scanner de radar
    this._drawScanner(ctx, geo, solCore.frame);

    // 6. Sinalização de Pause
    if (solCore.onPause) {
      this._drawPauseIndicator(ctx, geo);
    }

    ctx.restore();

    // 7. Header informativo (se habilitado)
    if (this.options.showHeader) {
      this._drawHeader(ctx);
    }

    // 8. Painel inferior esquerdo de LEDs dos 24 canais
    if (this.options.showLeds) {
      this._drawChannelLeds(ctx, width, height, solCore.frame, solCore.currentTrackStates);
    }
  }

  _drawRadarGrid(ctx, geo) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 80, 80, 0.8)';

    // Trilhas concêntricas
    let currentTrack = geo.diam;
    for (let x = 0; x <= geo.rows; x++) {
      ctx.beginPath();
      ctx.arc(0, 0, currentTrack / 2, 0, Math.PI * 2);
      ctx.stroke();
      currentTrack -= geo.dec;
    }

    // Fatias angulares (5 graus cada)
    for (let a = 0; a < 360; a += geo.sliceAngle) {
      const ar = (Math.PI / 180) * a;
      const px0 = geo.innerRadius * Math.cos(ar);
      const py0 = geo.innerRadius * Math.sin(ar);
      const px1 = geo.outerRadius * Math.cos(ar);
      const py1 = geo.outerRadius * Math.sin(ar);

      ctx.beginPath();
      ctx.moveTo(px0, py0);
      ctx.lineTo(px1, py1);
      ctx.stroke();
    }
  }

  _drawCenterLabel(ctx, geo) {
    const labelRadius = geo.label / 2;
    // Fator de escala proporcional ao tamanho do radar (baseado no label original de 296px)
    const scale = geo.label / 296;

    // 1. Disco central
    ctx.fillStyle = 'rgba(0, 100, 128, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Anéis escuros concêntricos proporcionais
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, 3 * scale);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, labelRadius - (4 * scale)), 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, labelRadius - (10 * scale)), 0, Math.PI * 2);
    ctx.stroke();

    // 3. Recorte circular (clip) para manter tudo estritamente dentro do disco central
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, labelRadius - (2 * scale)), 0, Math.PI * 2);
    ctx.clip();

    // 4. Logo central exatamente centralizado no ponto (0, 0) - alinhando o 'O' de SOL no centro
    if (this.logoLoaded) {
      const imgW = geo.label * 0.78;
      const imgH = imgW * (80 / 200); // Preserva o aspect ratio da imagem
      ctx.drawImage(this.logo, -imgW / 2, -imgH / 2, imgW, imgH);
    }

    // 5. Texto do Autor ampliado e elevado mais próximo ao centro
    const fontSize = Math.max(10, Math.round(17 * scale));
    ctx.fillStyle = '#00ffff';
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('By Sandro Benigno', 0, labelRadius * 0.44);

    ctx.restore();

    // 6. Miolo central preto exatamente no centro do 'O' do logo SOL
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, geo.dec / 2), 0, Math.PI * 2);
    ctx.fill();
  }

  _drawActiveCells(ctx, geo, gol) {
    for (let col = 0; col < gol.cols; col++) {
      for (let row = 0; row < gol.rows; row++) {
        if (gol.getCell(col, row) === 1) {
          this._drawCell(ctx, geo, col, row);
        }
      }
    }
  }

  _drawCell(ctx, geo, col, row) {
    const pos = geo.polarGridToCartesian(col, row);
    const cellSize = pos.cellSize;

    // Célula externa fosforescente
    ctx.fillStyle = 'rgba(0, 128, 0, 0.7)';
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, cellSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Brilho central estocástico (idêntico ao Processing original: cell/random(1,5))
    const innerSparkle = cellSize / (1.5 + Math.random() * 2);
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, innerSparkle / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawScanner(ctx, geo, frame) {
    const isTick = frame % 5 === 0;
    const scanner = geo.getScannerLine(frame);

    ctx.lineWidth = 4;
    ctx.strokeStyle = isTick ? '#00ffff' : 'rgba(0, 128, 128, 0.8)';
    ctx.beginPath();
    ctx.moveTo(scanner.x0, scanner.y0);
    ctx.lineTo(scanner.x1, scanner.y1);
    ctx.stroke();

    // Efeito sutil de gradiente de varredura
    const rad = (frame + geo.sliceAngle / 2) * (Math.PI / 180);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, geo.outerRadius, rad - 0.2, rad);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawPauseIndicator(ctx, geo) {
    const scale = geo.label / 296;
    const fontSize = Math.max(10, Math.round(15 * scale));
    // Ponto médio exato do vão escuro entre o disco central e a primeira trilha do radar
    const gapMidpoint = ((geo.label / 2) + geo.innerRadius) / 2;

    ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[ PAUSED ]', 0, gapMidpoint);
  }

  _drawHeader(ctx) {
    ctx.save();
    ctx.translate(18, 12);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = 'rgba(0, 220, 240, 0.85)';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText("Controlador de Música Generativa baseado no Conway's Game of Life", 0, 0);

    ctx.restore();
  }

  _drawRoundedRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  _drawChannelLeds(ctx, width, height, frame, trackStates) {
    const availableWidth = width - 36;
    const total = trackStates ? trackStates.length : 24;
    const gap = 3;
    const chipW = Math.min(18, Math.max(12, Math.floor((availableWidth - (total - 1) * gap) / total)));
    const chipH = Math.min(18, Math.max(12, chipW));
    const spc = chipW + gap;
    const startX = 18;
    const startY = height - 12 - chipH;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Rótulo e Ângulo na mesma linha acima dos chips
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText('Channels OUT', startX, startY - 9);

    ctx.fillStyle = 'rgba(0, 255, 255, 0.95)';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText(`${frame}°`, startX + 90, startY - 9);

    for (let x = 0; x < total; x++) {
      const posX = startX + x * spc;
      const posY = startY;
      const isActive = trackStates && trackStates[x];

      if (isActive) {
        // Chip Ativo: Fundo verde #00ff66 com glow suave e discreto
        ctx.save();
        ctx.shadowColor = 'rgba(0, 255, 102, 0.4)';
        ctx.shadowBlur = 3;
        ctx.fillStyle = '#00ff66';
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 1;
        this._drawRoundedRect(ctx, posX, posY, chipW, chipH, 3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Número do canal em preto (como na Musical Surface)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.fillText((x + 1).toString(), posX + chipW / 2, posY + chipH / 2 + 0.5);
      } else {
        // Chip Inativo: Fundo escuro #11222e, borda ciano e texto ciano
        ctx.fillStyle = '#11222e';
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        this._drawRoundedRect(ctx, posX, posY, chipW, chipH, 3);
        ctx.fill();
        ctx.stroke();

        // Número do canal em ciano suave
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.fillText((x + 1).toString(), posX + chipW / 2, posY + chipH / 2 + 0.5);
      }
    }

    ctx.restore();
  }
}


