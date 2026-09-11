/**
 * TransportBar.js
 * Barra superior de transporte e controles globais (Play/Pause, Velocidade/FPS, Random, Clear, Volume Master, Status WebSocket).
 */

export class TransportBar {
  constructor(container, solCore, soundEngine, broadcaster) {
    this.container = container;
    this.solCore = solCore;
    this.soundEngine = soundEngine;
    this.broadcaster = broadcaster;

    this._init();
  }

  _init() {
    this.container.innerHTML = `
      <div class="transport-container">
        <!-- Controles Principais -->
        <div class="transport-group">
          <button id="btnPlayPause" class="btn btn-transport" title="Pausar/Retomar Regras (P / Espaço)">
            <span class="btn-icon">⏸</span> <span class="btn-text">Pausar</span>
          </button>
          <button id="btnRandomize" class="btn btn-transport" title="Randomizar Células (R)">
            <span class="btn-icon">🎲</span> <span class="btn-text">Random</span>
          </button>
          <button id="btnClear" class="btn btn-transport" title="Limpar Tabuleiro (C)">
            <span class="btn-icon">🧹</span> <span class="btn-text">Limpar</span>
          </button>
          <button id="btnRestart" class="btn btn-transport" title="Reiniciar do Início (I)">
            <span class="btn-icon">🔄</span> <span class="btn-text">Restart</span>
          </button>
        </div>

        <!-- Velocidade de Varredura / FPS -->
        <div class="transport-group speed-group">
          <label for="speedSlider">VELOCIDADE:</label>
          <input type="range" id="speedSlider" min="5" max="60" value="${this.solCore.targetFps}">
          <span id="speedDisplay">${this.solCore.targetFps} FPS</span>
        </div>

        <!-- Volume Master -->
        <div class="transport-group volume-group">
          <label for="volumeSlider">MASTER VOL:</label>
          <input type="range" id="volumeSlider" min="0" max="1.2" step="0.05" value="0.8">
          <span id="volumeDisplay">80%</span>
        </div>

        <!-- Status WebSocket & Áudio -->
        <div class="transport-group status-group">
          <div class="status-badge" id="wsStatusBadge" title="Status da Conexão WebSocket para Bridge OSC">
            <span class="status-dot disconnected"></span>
            <span class="status-text">WS Offline</span>
          </div>
          <button id="btnAudioUnlock" class="btn btn-sm btn-audio" title="Status do Áudio do Navegador">
            🔊 Áudio Ativo
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const btnPlayPause = this.container.querySelector('#btnPlayPause');
    const btnRandomize = this.container.querySelector('#btnRandomize');
    const btnClear = this.container.querySelector('#btnClear');
    const btnRestart = this.container.querySelector('#btnRestart');
    const speedSlider = this.container.querySelector('#speedSlider');
    const speedDisplay = this.container.querySelector('#speedDisplay');
    const volumeSlider = this.container.querySelector('#volumeSlider');
    const volumeDisplay = this.container.querySelector('#volumeDisplay');
    const wsStatusBadge = this.container.querySelector('#wsStatusBadge');
    const btnAudio = this.container.querySelector('#btnAudioUnlock');

    btnPlayPause.addEventListener('click', () => {
      this.soundEngine.unlock();
      const paused = this.solCore.togglePause();
      this.updatePlayPauseState(paused);
    });

    btnRandomize.addEventListener('click', () => {
      this.soundEngine.unlock();
      this.solCore.randomize();
    });

    btnClear.addEventListener('click', () => {
      this.solCore.clear();
    });

    btnRestart.addEventListener('click', () => {
      this.soundEngine.unlock();
      this.solCore.restart();
    });

    speedSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.solCore.setFps(val);
      speedDisplay.textContent = `${val} FPS`;
    });

    volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.soundEngine.setMasterVolume(val);
      volumeDisplay.textContent = `${Math.round(val * 100)}%`;
    });

    btnAudio.addEventListener('click', () => {
      this.soundEngine.unlock().then(() => {
        btnAudio.textContent = '🔊 Áudio Ativo';
        btnAudio.classList.add('active');
      });
    });

    // Escuta mudanças de pause disparadas pelo teclado
    this.broadcaster.on('pause_toggle', ({ onPause }) => {
      this.updatePlayPauseState(onPause);
    });

    // Escuta status da conexão WebSocket
    this.broadcaster.on('ws_status', ({ connected }) => {
      const dot = wsStatusBadge.querySelector('.status-dot');
      const text = wsStatusBadge.querySelector('.status-text');
      if (connected) {
        dot.className = 'status-dot connected';
        text.textContent = 'WS Online';
        wsStatusBadge.title = 'Conectado ao servidor WebSocket (Bridge OSC pronta)';
      } else {
        dot.className = 'status-dot disconnected';
        text.textContent = 'WS Offline';
        wsStatusBadge.title = 'Desconectado do WebSocket (execute: python bridge/server.py)';
      }
    });

    // Clique no badge tenta reconectar
    wsStatusBadge.addEventListener('click', () => {
      this.broadcaster.connect();
    });
  }

  updatePlayPauseState(isPaused) {
    const btnPlayPause = this.container.querySelector('#btnPlayPause');
    if (!btnPlayPause) return;
    if (isPaused) {
      btnPlayPause.querySelector('.btn-icon').textContent = '▶';
      btnPlayPause.querySelector('.btn-text').textContent = 'Retomar';
      btnPlayPause.classList.add('paused');
    } else {
      btnPlayPause.querySelector('.btn-icon').textContent = '⏸';
      btnPlayPause.querySelector('.btn-text').textContent = 'Pausar';
      btnPlayPause.classList.remove('paused');
    }
  }
}
