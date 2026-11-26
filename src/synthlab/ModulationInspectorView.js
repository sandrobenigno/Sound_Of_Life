/**
 * ModulationInspectorView.js
 * Visualizador Tríplice de Modulação: "Antes ➔ Função ➔ Depois".
 * O coração didático do SOL Synth Lab: permite ao aluno ver a forma de onda
 * original, a curva/função matemática que a deforma, e a onda resultante em tempo real.
 */

export class ModulationInspectorView {
  constructor(container, audioBridge, model) {
    this.container = container;
    this.bridge = audioBridge;
    this.model = model;

    this.mode = 'fm'; // 'fm', 'filter_env', 'lfo', 'amp_adsr'
    this.activeTime = 0;

    this.element = document.createElement('div');
    this.element.className = 'mod-inspector-wrapper';
    this.container.appendChild(this.element);

    this._render();
    this._bindEvents();
    this._startLoop();
  }

  setMode(mode) {
    this.mode = mode;
    const select = this.element.querySelector('#inspectorModeSelect');
    if (select) select.value = mode;
    this._updateModeDescription();
  }

  _render() {
    this.element.innerHTML = `
      <div class="mod-inspector-header">
        <div class="inspector-title-group">
          <span class="inspector-badge">MODULAÇÃO</span>
          <h3>INSPEÇÃO EM TEMPO REAL: <span class="highlight-cyan">ANTES ➔ FUNÇÃO ➔ DEPOIS</span></h3>
        </div>

        <div class="inspector-controls">
          <label for="inspectorModeSelect">Fenômeno Didático:</label>
          <select id="inspectorModeSelect" class="inspector-select">
            <option value="fm">Síntese FM (Modulação em Frequência)</option>
            <option value="filter_env">Filtro Subtrativo + Envelope ADSR</option>
            <option value="lfo">LFO (Vibrato / Tremolo)</option>
            <option value="amp_adsr">Envelope de Amplitude (Curva ADSR)</option>
          </select>
        </div>
      </div>

      <div class="mod-inspector-stages">
        <!-- 1. ANTES: Onda Portadora / Entrada -->
        <div class="inspector-stage-card stage-before">
          <div class="stage-tag">1. ANTES (PORTADORA)</div>
          <div class="stage-canvas-box">
            <canvas id="canvasBefore" width="300" height="130"></canvas>
          </div>
          <div class="stage-info" id="infoBefore">
            <span class="info-label">Onda Pura Fundamental</span>
            <span class="info-sub">Senoidal f₀ = 220 Hz (A3)</span>
          </div>
        </div>

        <!-- 2. FUNÇÃO: A Matemática / Modulador -->
        <div class="inspector-stage-card stage-function">
          <div class="stage-tag tag-amber">2. FUNÇÃO MODULADORA</div>
          <div class="stage-canvas-box">
            <canvas id="canvasFunction" width="300" height="130"></canvas>
          </div>
          <div class="stage-info" id="infoFunction">
            <span class="info-label math-formula">y = sin(2π · 3.5f₀ · t)</span>
            <span class="info-sub">Índice β = 850 Hz (Metálico)</span>
          </div>
        </div>

        <!-- 3. DEPOIS: Onda Resultante Modulada -->
        <div class="inspector-stage-card stage-after">
          <div class="stage-tag tag-magenta">3. DEPOIS (RESULTANTE)</div>
          <div class="stage-canvas-box">
            <canvas id="canvasAfter" width="300" height="130"></canvas>
          </div>
          <div class="stage-info" id="infoAfter">
            <span class="info-label">Som Sintetizado em Tempo Real</span>
            <span class="info-sub">Bandas Laterais Harmônicas (DX7)</span>
          </div>
        </div>
      </div>

      <div class="inspector-educational-footer" id="inspectorExplanation">
        <p><strong>💡 Explicação Didática:</strong> Na síntese FM, a onda moduladora altera a velocidade com que a portadora vibra, criando instantaneamente dezenas de novos harmônicos brilhantes e metálicos sem precisar de filtros.</p>
      </div>
    `;

    this.cvsBefore = this.element.querySelector('#canvasBefore');
    this.ctxBefore = this.cvsBefore.getContext('2d');

    this.cvsFunc = this.element.querySelector('#canvasFunction');
    this.ctxFunc = this.cvsFunc.getContext('2d');

    this.cvsAfter = this.element.querySelector('#canvasAfter');
    this.ctxAfter = this.cvsAfter.getContext('2d');

    this._updateModeDescription();
  }

  _bindEvents() {
    const select = this.element.querySelector('#inspectorModeSelect');
    select.addEventListener('change', (e) => {
      this.setMode(e.target.value);
    });
  }

  _updateModeDescription() {
    const expEl = this.element.querySelector('#inspectorExplanation');
    const infoBefore = this.element.querySelector('#infoBefore');
    const infoFunc = this.element.querySelector('#infoFunction');
    const infoAfter = this.element.querySelector('#infoAfter');

    if (this.mode === 'fm') {
      infoBefore.innerHTML = `<span class="info-label">Onda Portadora (Carrier)</span><span class="info-sub">Senoidal f₀ = 220 Hz (A3)</span>`;
      infoFunc.innerHTML = `<span class="info-label math-formula">f(t) = f₀ + I · sin(2π · 3.5f₀ · t)</span><span class="info-sub">Razão Harmônica = 3.5x</span>`;
      infoAfter.innerHTML = `<span class="info-label">Timbre Metálico / Sino</span><span class="info-sub">Novos harmônicos por Bessel</span>`;
      expEl.innerHTML = `<p><strong>💡 Síntese FM:</strong> A oscilação em frequência modula a fase da portadora. Relações fracionárias como 3.5x geram sons inarmônicos metálicos típicos de sinos e pratos!</p>`;

    } else if (this.mode === 'filter_env') {
      infoBefore.innerHTML = `<span class="info-label">Dente de Serra Bruta</span><span class="info-sub">Todos os harmônicos (1f, 2f, 3f, 4f...)</span>`;
      infoFunc.innerHTML = `<span class="info-label math-formula">Cutoff(t) = Base + Env(t) · Amount</span><span class="info-sub">Lowpass com Ressonância Q = 4.5</span>`;
      infoAfter.innerHTML = `<span class="info-label">Bassline / Pluck Lapidado</span><span class="info-sub">Agudos decaem em milissegundos</span>`;
      expEl.innerHTML = `<p><strong>💡 Filtro Subtrativo:</strong> O envelope abre o filtro de agudos no ataque da nota e fecha suavemente, emulando uma corda de baixo ou violão físico.</p>`;

    } else if (this.mode === 'lfo') {
      infoBefore.innerHTML = `<span class="info-label">Onda Contínua Estável</span><span class="info-sub">Afinação ou Volume constante</span>`;
      infoFunc.innerHTML = `<span class="info-label math-formula">LFO(t) = sin(2π · 5.0Hz · t)</span><span class="info-sub">Frequência Sub-Audível (5 Hz)</span>`;
      infoAfter.innerHTML = `<span class="info-label">Vibrato ou Tremolo</span><span class="info-sub">Ondulação periódica e expressiva</span>`;
      expEl.innerHTML = `<p><strong>💡 LFO (Low Frequency):</strong> Osciladores abaixo de 20 Hz não produzem notas musicais diretamente, mas 'empurram' outros controles criando vibração e vida.</p>`;

    } else if (this.mode === 'amp_adsr') {
      infoBefore.innerHTML = `<span class="info-label">Sinal Elétrico Estático</span><span class="info-sub">Amplitude constante contínua</span>`;
      infoFunc.innerHTML = `<span class="info-label math-formula">ADSR: A=5ms, D=250ms, S=20%, R=200ms</span><span class="info-sub">Curva Exponencial de 4 Fases</span>`;
      infoAfter.innerHTML = `<span class="info-label">Dinâmica Musical Natural</span><span class="info-sub">Início, sustentação e cauda do som</span>`;
      expEl.innerHTML = `<p><strong>💡 Envelope ADSR:</strong> Define a energia no tempo. Ataque rápido = percussivo/piano; Ataque lento = cordas suaves/sopros.</p>`;
    }
  }

  _startLoop() {
    const render = () => {
      this.activeTime += 0.03;
      this._drawBeforeScope();
      this._drawFunctionScope();
      this._drawAfterScope();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  _drawBeforeScope() {
    const ctx = this.ctxBefore;
    const w = this.cvsBefore.width;
    const h = this.cvsBefore.height;
    const cy = h / 2;

    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, w, h);

    // Grid suave
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();

    // Desenho da onda inicial (ex: Senoidal ou Saw)
    ctx.beginPath();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 8;

    const cycles = 3;
    for (let x = 0; x < w; x++) {
      const phase = (x / w) * (Math.PI * 2 * cycles) + this.activeTime;
      let y = cy;

      if (this.mode === 'filter_env') {
        // Dente de serra
        const saw = (phase % (Math.PI * 2)) / (Math.PI * 2);
        y = cy - (saw * 2 - 1) * 45;
      } else {
        // Senoidal
        y = cy + Math.sin(phase) * 42;
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawFunctionScope() {
    const ctx = this.ctxFunc;
    const w = this.cvsFunc.width;
    const h = this.cvsFunc.height;
    const cy = h / 2;

    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 183, 3, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffb703';
    ctx.shadowBlur = 8;

    if (this.mode === 'fm') {
      // Moduladora rápida 3.5x
      const cycles = 3 * 3.5;
      for (let x = 0; x < w; x++) {
        const phase = (x / w) * (Math.PI * 2 * cycles) + (this.activeTime * 3.5);
        const y = cy + Math.sin(phase) * 45;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else if (this.mode === 'filter_env' || this.mode === 'amp_adsr') {
      // Curva de envelope ADSR estática/dinâmica
      const pts = [
        { x: 10, y: h - 15 },
        { x: 45, y: 15 },           // Attack
        { x: 130, y: cy + 10 },      // Decay
        { x: 220, y: cy + 10 },      // Sustain
        { x: w - 10, y: h - 15 }     // Release
      ];
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.lineTo(pts[4].x, pts[4].y);
    } else if (this.mode === 'lfo') {
      // Onda LFO suave
      for (let x = 0; x < w; x++) {
        const phase = (x / w) * (Math.PI * 2 * 1.5) + (this.activeTime * 0.4);
        const y = cy + Math.sin(phase) * 42;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawAfterScope() {
    const ctx = this.ctxAfter;
    const w = this.cvsAfter.width;
    const h = this.cvsAfter.height;
    const cy = h / 2;

    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 0, 127, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();

    // Se houver áudio ao vivo do bridge, desenha o osciloscópio real;
    // Caso contrário, calcula matematicamente a onda modulada!
    const realWave = this.bridge ? this.bridge.getMasterWaveformData() : null;
    let hasSignal = false;

    if (realWave) {
      for (let i = 0; i < realWave.length; i += 8) {
        if (Math.abs(realWave[i] - 128) > 3) {
          hasSignal = true;
          break;
        }
      }
    }

    ctx.beginPath();
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 10;

    if (hasSignal && realWave) {
      const step = realWave.length / w;
      for (let x = 0; x < w; x++) {
        const val = realWave[Math.floor(x * step)] / 128.0; // 0..2
        const y = (val - 1.0) * (h * 0.42) + cy;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      // Simulação analítica matemática contínua
      const cycles = 3;
      for (let x = 0; x < w; x++) {
        const phase = (x / w) * (Math.PI * 2 * cycles) + this.activeTime;
        let y = cy;

        if (this.mode === 'fm') {
          // Equação de Chowning: sin(wc*t + I * sin(wm*t))
          const modPhase = phase * 3.5;
          const fmIndex = 1.8;
          y = cy + Math.sin(phase + fmIndex * Math.sin(modPhase)) * 44;

        } else if (this.mode === 'filter_env') {
          // Sawtooth filtrado e amortecido
          const saw = (phase % (Math.PI * 2)) / (Math.PI * 2);
          const raw = (saw * 2 - 1);
          // Amortecimento de harmônicos altos
          const smoothed = Math.sin(phase) * 0.7 + Math.sin(phase * 2) * 0.25;
          y = cy - smoothed * 45;

        } else if (this.mode === 'lfo') {
          // Modulação de amplitude ou pitch
          const lfo = (Math.sin(this.activeTime * 1.5) * 0.35 + 0.65);
          y = cy + Math.sin(phase) * 44 * lfo;

        } else {
          y = cy + Math.sin(phase) * 40;
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
