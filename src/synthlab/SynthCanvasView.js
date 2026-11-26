/**
 * SynthCanvasView.js
 * Canvas interativo e renderizador gráfico da bancada modular.
 * Desenha os nós, controles táteis, portas magnéticas e cabos Bézier com física e partículas de sinal.
 */

import { NODE_TYPES } from './SynthGraphModel.js';

export class SynthCanvasView {
  constructor(container, model, audioBridge) {
    this.container = container;
    this.model = model;
    this.bridge = audioBridge;

    // Viewport Pan & Zoom
    this.panX = 30;
    this.panY = 30;
    this.zoom = 1.0;

    // Estado de Interação
    this.draggedNode = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    this.pendingCable = null; // { fromNode, fromPort, currentX, currentY }
    this.socketElements = new Map(); // `${nodeId}:${portId}` -> DOM element
    this.socketOffsets = new Map();  // `${nodeId}:${portId}` -> { relX, relY }
    this.enableAnimations = true;

    this.animationFrame = null;
    this.particleOffset = 0;

    this._setupDOM();
    this._bindEvents();
    this._startLoop();

    this._bindModelEvents();
    this.render();
  }

  setAnimationsEnabled(enabled) {
    this.enableAnimations = !!enabled;
  }

  _bindModelEvents() {
    this.model.onChange((event) => {
      if (!event) {
        this.render();
        return;
      }

      const { type, payload } = event;

      // 1. Mudança de parâmetro (slider/knob): NUNCA recriar o DOM!
      // Recriar o DOM durante o arraste destruía o <input> sob o cursor do mouse
      if (type === 'param_change') {
        this._updateParamDisplay(payload);
        return;
      }

      // 2. Movimento de nó (arrasto do card): atualiza apenas style.left e style.top
      if (type === 'node_move') {
        const card = document.getElementById(`node-${payload.id}`);
        if (card) {
          card.style.left = `${payload.x}px`;
          card.style.top = `${payload.y}px`;
        }
        return;
      }

      // 3. Conexão / desconexão de cabos: redesenhado suavemente no canvas
      if (type === 'cable_add' || type === 'cable_remove') {
        return;
      }

      // 4. Adição/remoção de nós, clear ou carga de novo patch: re-renderiza o rack
      this.render();
    });
  }

  _updateParamDisplay(payload) {
    if (!payload) return;
    const { nodeId, paramKey, value } = payload;
    const card = document.getElementById(`node-${nodeId}`);
    if (!card) return;

    const input = card.querySelector(`[data-param="${paramKey}"]`);
    if (input && document.activeElement !== input) {
      input.value = value;
    }

    const row = input?.closest('.control-row') || input?.closest('.adsr-col');
    const valText = row?.querySelector('.val-text') || row?.querySelector('.adsr-val');
    if (valText) {
      if (paramKey === 'cutoff') valText.textContent = `${value} Hz`;
      else if (paramKey === 'resonance') valText.textContent = `${value}`;
      else if (paramKey === 'gain' || paramKey === 'volume') valText.textContent = `${Math.round(value * 100)}%`;
      else if (['attack', 'decay', 'release'].includes(paramKey)) valText.textContent = `${Math.round(value * 1000)}ms`;
      else if (paramKey === 'sustain') valText.textContent = `${Math.round(value * 100)}%`;
    }
  }

  _setupDOM() {
    this.container.classList.add('synth-canvas-viewport');

    // Canvas de Fundo para Cabos Bézier e Partículas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'synth-cables-canvas';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Camada DOM para os Nós Modulares
    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'synth-nodes-layer';
    this.container.appendChild(this.nodesLayer);

    this.resize();

    // Observador de Redimensionamento Automático (detecta quando painéis/teclado mudam a altura do viewport)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(this.container);
    }
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    if (w > 0 && h > 0) {
      if (this.width !== w || this.height !== h) {
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
        this._cacheSocketOffsets();
      }
    }
  }

  _bindEvents() {
    // 1. Pan do Canvas
    this.container.addEventListener('pointerdown', (e) => {
      if (e.target === this.container || e.target === this.canvas || e.target === this.nodesLayer) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.container.setPointerCapture(e.pointerId);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStart.x;
        this.panY = e.clientY - this.panStart.y;
        this._updateTransform();
      } else if (this.draggedNode) {
        const newX = (e.clientX - this.panX) / this.zoom - this.dragOffset.x;
        const newY = (e.clientY - this.panY) / this.zoom - this.dragOffset.y;
        this.model.setNodePosition(this.draggedNode.id, newX, newY);
      } else if (this.pendingCable) {
        const rect = this.container.getBoundingClientRect();
        this.pendingCable.currentX = (e.clientX - rect.left - this.panX) / this.zoom;
        this.pendingCable.currentY = (e.clientY - rect.top - this.panY) / this.zoom;
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
      }
      if (this.draggedNode) {
        this.draggedNode = null;
      }
      if (this.pendingCable) {
        this._handleDropCable(e);
        this.pendingCable = null;
      }
    });

    // Zoom com a roda do mouse
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoom = Math.max(0.4, Math.min(2.0, this.zoom * zoomFactor));
      this._updateTransform();
    }, { passive: false });
  }

  _updateTransform() {
    this.nodesLayer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.nodesLayer.style.transformOrigin = '0 0';
  }

  render() {
    this._renderNodes();
    this._updateTransform();
  }

  _renderNodes() {
    this.nodesLayer.innerHTML = '';
    this.socketElements.clear();

    for (const node of this.model.nodes.values()) {
      const def = NODE_TYPES[node.type];
      if (!def) continue;

      const card = document.createElement('div');
      card.className = `synth-node-card type-${node.type}`;
      card.id = `node-${node.id}`;
      card.style.left = `${node.x}px`;
      card.style.top = `${node.y}px`;
      card.style.setProperty('--node-accent', def.color);

      // Header com título e botão de fechar (exceto master)
      let headerHtml = `
        <div class="node-header" data-drag-handle="true">
          <span class="node-badge" style="background: ${def.color};">${def.badge}</span>
          <span class="node-title">${def.name}</span>
          ${node.type !== 'master' ? `<button type="button" class="btn-node-close" data-node-id="${node.id}" title="Excluir nó">✕</button>` : ''}
        </div>
      `;

      // Corpo com Inlets à esquerda, Controles no meio e Outlets à direita
      let bodyHtml = `<div class="node-body">`;

      // Coluna de Entradas (Inlets)
      bodyHtml += `<div class="node-inlets-col">`;
      for (const inlet of def.inlets) {
        bodyHtml += `
          <div class="socket-wrapper socket-inlet" title="Entrada: ${inlet.name}">
            <div class="socket-pin pin-${inlet.type}" data-node-id="${node.id}" data-port-id="${inlet.id}" data-direction="in"></div>
            <span class="socket-label">${inlet.name}</span>
          </div>
        `;
      }
      bodyHtml += `</div>`;

      // Coluna Central de Parâmetros
      bodyHtml += `<div class="node-controls-col">`;
      bodyHtml += this._generateNodeControlsHTML(node);
      bodyHtml += `</div>`;

      // Coluna de Saídas (Outlets)
      bodyHtml += `<div class="node-outlets-col">`;
      for (const outlet of def.outlets) {
        bodyHtml += `
          <div class="socket-wrapper socket-outlet" title="Saída: ${outlet.name}">
            <span class="socket-label">${outlet.name}</span>
            <div class="socket-pin pin-${outlet.type}" data-node-id="${node.id}" data-port-id="${outlet.id}" data-direction="out"></div>
          </div>
        `;
      }
      bodyHtml += `</div>`;

      bodyHtml += `</div>`; // .node-body
      card.innerHTML = headerHtml + bodyHtml;

      this._bindNodeCardEvents(card, node);
      this.nodesLayer.appendChild(card);
    }

    // Mede e memoriza os pontos de socket relativos a cada nó (evita reflow no loop de desenho)
    this._cacheSocketOffsets();
  }

  _cacheSocketOffsets() {
    this.socketElements.clear();
    this.socketOffsets.clear();

    const cards = this.nodesLayer.querySelectorAll('.synth-node-card');
    cards.forEach(card => {
      const cardRect = card.getBoundingClientRect();
      const pins = card.querySelectorAll('.socket-pin');
      pins.forEach(pin => {
        const portKey = `${pin.dataset.nodeId}:${pin.dataset.portId}`;
        this.socketElements.set(portKey, pin);

        const pinRect = pin.getBoundingClientRect();
        if (pinRect.width > 0 && cardRect.width > 0) {
          const relX = (pinRect.left + pinRect.width / 2 - cardRect.left) / this.zoom;
          const relY = (pinRect.top + pinRect.height / 2 - cardRect.top) / this.zoom;
          this.socketOffsets.set(portKey, { relX, relY });
        }
      });
    });
  }

  _generateNodeControlsHTML(node) {
    const p = node.params;
    let html = '';

    if (node.type === 'oscillator') {
      html += `
        <div class="control-row">
          <label>Onda:</label>
          <select data-param="waveform" class="ctrl-select">
            <option value="sawtooth" ${p.waveform === 'sawtooth' ? 'selected' : ''}>Dente de Serra (Saw)</option>
            <option value="square" ${p.waveform === 'square' ? 'selected' : ''}>Quadrada (Square)</option>
            <option value="triangle" ${p.waveform === 'triangle' ? 'selected' : ''}>Triangular (Tri)</option>
            <option value="sine" ${p.waveform === 'sine' ? 'selected' : ''}>Senoidal (Sine)</option>
          </select>
        </div>
        <div class="control-row-duo">
          <div class="control-item">
            <label>Oitava:</label>
            <input type="number" min="-3" max="3" value="${p.octave || 0}" data-param="octave" class="ctrl-num">
          </div>
          <div class="control-item">
            <label>Detune (c):</label>
            <input type="number" min="-50" max="50" value="${p.detune || 0}" data-param="detune" class="ctrl-num">
          </div>
        </div>
        ${p.ratio !== undefined ? `
          <div class="control-row">
            <label>Razão Harmônica (Ratio):</label>
            <input type="number" step="0.5" min="0.5" max="16" value="${p.ratio}" data-param="ratio" class="ctrl-num">
          </div>
        ` : ''}
      `;

    } else if (node.type === 'noise') {
      html += `
        <div class="control-row">
          <label>Tipo:</label>
          <select data-param="noiseType" class="ctrl-select">
            <option value="white" ${p.noiseType === 'white' ? 'selected' : ''}>Branco (White)</option>
            <option value="pink" ${p.noiseType === 'pink' ? 'selected' : ''}>Rosa (Pink)</option>
          </select>
        </div>
      `;

    } else if (node.type === 'filter') {
      html += `
        <div class="control-row">
          <label>Tipo:</label>
          <select data-param="filterType" class="ctrl-select">
            <option value="lowpass" ${p.filterType === 'lowpass' ? 'selected' : ''}>Lowpass (Passa-Baixa)</option>
            <option value="highpass" ${p.filterType === 'highpass' ? 'selected' : ''}>Highpass (Passa-Alta)</option>
            <option value="bandpass" ${p.filterType === 'bandpass' ? 'selected' : ''}>Bandpass (Faixa)</option>
            <option value="notch" ${p.filterType === 'notch' ? 'selected' : ''}>Notch (Rejeita-Faixa)</option>
          </select>
        </div>
        <div class="control-row">
          <div class="label-with-val"><span>Corte (Cutoff):</span><span class="val-text">${p.cutoff} Hz</span></div>
          <input type="range" min="40" max="12000" step="20" value="${p.cutoff}" data-param="cutoff" class="ctrl-slider">
        </div>
        <div class="control-row">
          <div class="label-with-val"><span>Ressonância (Q):</span><span class="val-text">${p.resonance}</span></div>
          <input type="range" min="0.5" max="15" step="0.2" value="${p.resonance}" data-param="resonance" class="ctrl-slider">
        </div>
      `;

    } else if (node.type === 'envelope') {
      html += `
        <div class="adsr-grid">
          <div class="adsr-col"><label>A</label><input type="range" min="0.001" max="1.5" step="0.005" value="${p.attack}" data-param="attack" class="ctrl-slider-v"><span class="adsr-val">${Math.round(p.attack * 1000)}ms</span></div>
          <div class="adsr-col"><label>D</label><input type="range" min="0.01" max="2.0" step="0.01" value="${p.decay}" data-param="decay" class="ctrl-slider-v"><span class="adsr-val">${Math.round(p.decay * 1000)}ms</span></div>
          <div class="adsr-col"><label>S</label><input type="range" min="0.0" max="1.0" step="0.05" value="${p.sustain}" data-param="sustain" class="ctrl-slider-v"><span class="adsr-val">${Math.round(p.sustain * 100)}%</span></div>
          <div class="adsr-col"><label>R</label><input type="range" min="0.01" max="2.5" step="0.01" value="${p.release}" data-param="release" class="ctrl-slider-v"><span class="adsr-val">${Math.round(p.release * 1000)}ms</span></div>
        </div>
      `;

    } else if (node.type === 'lfo') {
      html += `
        <div class="control-row">
          <label>Onda:</label>
          <select data-param="waveform" class="ctrl-select">
            <option value="sine" ${p.waveform === 'sine' ? 'selected' : ''}>Senoidal</option>
            <option value="triangle" ${p.waveform === 'triangle' ? 'selected' : ''}>Triangular</option>
            <option value="square" ${p.waveform === 'square' ? 'selected' : ''}>Quadrada</option>
          </select>
        </div>
        <div class="control-row">
          <div class="label-with-val"><span>Velocidade:</span><span class="val-text">${p.frequency} Hz</span></div>
          <input type="range" min="0.1" max="25" step="0.1" value="${p.frequency}" data-param="frequency" class="ctrl-slider">
        </div>
      `;

    } else if (node.type === 'vca') {
      html += `
        <div class="control-row">
          <div class="label-with-val"><span>Ganho VCA:</span><span class="val-text">${Math.round(p.gain * 100)}%</span></div>
          <input type="range" min="0" max="1" step="0.05" value="${p.gain}" data-param="gain" class="ctrl-slider">
        </div>
      `;

    } else if (node.type === 'mixer') {
      html += `
        <div class="mixer-sliders-row">
          <div class="mix-ch"><label>1</label><input type="range" min="0" max="1" step="0.05" value="${p.ch1}" data-param="ch1" class="ctrl-slider-v"></div>
          <div class="mix-ch"><label>2</label><input type="range" min="0" max="1" step="0.05" value="${p.ch2}" data-param="ch2" class="ctrl-slider-v"></div>
          <div class="mix-ch"><label>3</label><input type="range" min="0" max="1" step="0.05" value="${p.ch3}" data-param="ch3" class="ctrl-slider-v"></div>
          <div class="mix-ch"><label>4</label><input type="range" min="0" max="1" step="0.05" value="${p.ch4}" data-param="ch4" class="ctrl-slider-v"></div>
        </div>
      `;

    } else if (node.type === 'master') {
      html += `
        <div class="control-row">
          <div class="label-with-val"><span>Master Vol:</span><span class="val-text">${Math.round(p.volume * 100)}%</span></div>
          <input type="range" min="0" max="1.2" step="0.05" value="${p.volume}" data-param="volume" class="ctrl-slider">
        </div>
      `;
    }

    return html;
  }

  _bindNodeCardEvents(card, node) {
    // 1. Arrasto do Nó
    const handle = card.querySelector('[data-drag-handle]');
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.draggedNode = node;
      this.dragOffset = {
        x: (e.clientX - this.panX) / this.zoom - node.x,
        y: (e.clientY - this.panY) / this.zoom - node.y
      };
      card.setPointerCapture(e.pointerId);
    });

    // 2. Botão Fechar Nó
    const btnClose = card.querySelector('.btn-node-close');
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.model.removeNode(node.id);
      });
    }

    // 3. Inputs de Parâmetros
    card.querySelectorAll('[data-param]').forEach(input => {
      // Impede que o clique no controle inicie pan ou arrasto acidental
      input.addEventListener('pointerdown', (e) => e.stopPropagation());
      input.addEventListener('mousedown', (e) => e.stopPropagation());
      input.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

      // Remove o foco APENAS para sliders de range ao soltar o mouse (devolve teclas do teclado)
      // NUNCA chamar blur em pointerup/mouseup para <select>, pois fecharia o menu dropdown imediatamente!
      if (input.type === 'range') {
        input.addEventListener('pointerup', () => input.blur());
        input.addEventListener('mouseup', () => input.blur());
      }

      const updateParamValue = (e) => {
        e.stopPropagation();
        const param = e.target.dataset.param;
        let val = e.target.value;
        if (e.target.type === 'range' || e.target.type === 'number') {
          val = parseFloat(val);
        }
        this.model.setNodeParam(node.id, param, val);

        const valText = e.target.closest('.control-row')?.querySelector('.val-text') ||
                        e.target.closest('.adsr-col')?.querySelector('.adsr-val');
        if (valText) {
          if (param === 'cutoff') valText.textContent = `${val} Hz`;
          else if (param === 'resonance') valText.textContent = `${val}`;
          else if (param === 'gain' || param === 'volume') valText.textContent = `${Math.round(val * 100)}%`;
          else if (['attack', 'decay', 'release'].includes(param)) valText.textContent = `${Math.round(val * 1000)}ms`;
          else if (param === 'sustain') valText.textContent = `${Math.round(val * 100)}%`;
        }

        if (input.tagName === 'SELECT') {
          // Desfoca apenas após o usuário confirmar a escolha de uma opção
          input.blur();
        }
      };

      input.addEventListener('input', updateParamValue);
      input.addEventListener('change', updateParamValue);
    });

    // 4. Iniciar Puxada de Cabo a partir de um Pino Outlet
    card.querySelectorAll('.socket-pin[data-direction="out"]').forEach(pin => {
      pin.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const rect = this.container.getBoundingClientRect();
        this.pendingCable = {
          fromNode: pin.dataset.nodeId,
          fromPort: pin.dataset.portId,
          currentX: (e.clientX - rect.left - this.panX) / this.zoom,
          currentY: (e.clientY - rect.top - this.panY) / this.zoom
        };
        pin.setPointerCapture(e.pointerId);
      });
    });
  }

  _handleDropCable(e) {
    // Detecta se soltou o ponteiro em cima de uma entrada (inlet)
    const targetEl = document.elementFromPoint(e.clientX, e.clientY);
    const pin = targetEl?.closest('.socket-pin[data-direction="in"]');
    if (pin && this.pendingCable) {
      const toNode = pin.dataset.nodeId;
      const toPort = pin.dataset.portId;
      this.model.connect(this.pendingCable.fromNode, this.pendingCable.fromPort, toNode, toPort);
    }
  }

  _startLoop() {
    const draw = () => {
      this.particleOffset = (this.particleOffset + 0.015) % 1.0;
      this._drawCables();
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  _getSocketCoordinates(nodeId, portId) {
    const key = `${nodeId}:${portId}`;
    let offset = this.socketOffsets.get(key);
    const node = this.model.nodes.get(nodeId);

    // Se ainda não tem offset memorizado (ou no primeiro frame antes do layout final), mede sob demanda
    if (!offset && node) {
      const pin = this.socketElements.get(key);
      if (pin) {
        const card = pin.closest('.synth-node-card');
        if (card) {
          const cardRect = card.getBoundingClientRect();
          const pinRect = pin.getBoundingClientRect();
          if (pinRect.width > 0 && cardRect.width > 0) {
            const relX = (pinRect.left + pinRect.width / 2 - cardRect.left) / this.zoom;
            const relY = (pinRect.top + pinRect.height / 2 - cardRect.top) / this.zoom;
            offset = { relX, relY };
            this.socketOffsets.set(key, offset);
          }
        }
      }
    }

    if (offset && node) {
      return {
        x: node.x + offset.relX,
        y: node.y + offset.relY
      };
    }

    return node ? { x: node.x + 100, y: node.y + 50 } : { x: 0, y: 0 };
  }

  _drawCables() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Desenha cabos conectados
    for (const cable of this.model.cables) {
      const p1 = this._getSocketCoordinates(cable.fromNode, cable.fromPort);
      const p2 = this._getSocketCoordinates(cable.toNode, cable.toPort);

      this._drawBezierCable(ctx, p1.x, p1.y, p2.x, p2.y, cable.fromPort.includes('cv') ? '#ffb703' : '#00e5ff');
    }

    // 2. Desenha cabo pendente durante o arrasto
    if (this.pendingCable) {
      const p1 = this._getSocketCoordinates(this.pendingCable.fromNode, this.pendingCable.fromPort);
      this._drawBezierCable(ctx, p1.x, p1.y, this.pendingCable.currentX, this.pendingCable.currentY, '#00ff88', true);
    }

    ctx.restore();
  }

  _drawBezierCable(ctx, x1, y1, x2, y2, color = '#00e5ff', isPending = false) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Gravidade física nos cabos: curvatura dependente da distância
    const curvature = Math.max(40, Math.min(220, dx * 0.5 + dist * 0.15));
    const cp1x = x1 + curvature;
    const cp1y = y1;
    const cp2x = x2 - curvature;
    const cp2y = y2;

    // Sombra do cabo
    ctx.beginPath();
    ctx.moveTo(x1, y1 + 5);
    ctx.bezierCurveTo(cp1x, cp1y + 15, cp2x, cp2y + 15, x2, y2 + 5);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Cabo principal
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = isPending ? 14 : 7;
    ctx.lineWidth = isPending ? 3.5 : 2.8;
    ctx.stroke();

    // Partículas animadas de fluxo de sinal (quando conectado e com animações ativas)
    if (!isPending && this.enableAnimations) {
      const t = this.particleOffset;
      // Equação cúbica de Bézier para a posição da partícula
      const px = Math.pow(1 - t, 3) * x1 + 3 * Math.pow(1 - t, 2) * t * cp1x + 3 * (1 - t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * x2;
      const py = Math.pow(1 - t, 3) * y1 + 3 * Math.pow(1 - t, 2) * t * cp1y + 3 * (1 - t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * y2;

      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }
}
