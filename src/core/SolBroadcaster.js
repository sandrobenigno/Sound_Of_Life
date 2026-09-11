/**
 * SolBroadcaster.js
 * Emissor de eventos abstratos e cliente WebSocket para o SOL Core.
 * Dispara eventos para a camada JS interna (Musical Surface) e transmite via WebSocket.
 */

export class SolBroadcaster {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'ws://127.0.0.1:8765';
    this.wsEnabled = options.autoConnect ?? false;
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map(); // eventName -> Set of callbacks

    if (this.wsEnabled) {
      this.connect();
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (err) {
          console.error(`Erro ao disparar callback para o evento ${event}:`, err);
        }
      }
    }
  }

  /**
   * Ativa ou desativa a conexão com a bridge WebSocket / OSC (Opt-in)
   */
  setBridgeEnabled(enabled, url = this.wsUrl) {
    this.wsEnabled = !!enabled;
    this.wsUrl = url;

    if (!this.wsEnabled) {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      this.isConnected = false;
      this.emit('ws_status', { status: 'disabled', connected: false, url: this.wsUrl });
      return;
    }

    this.connect();
  }

  connect(url = this.wsUrl) {
    this.wsUrl = url;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.emit('ws_status', { status: 'connecting', connected: false, url: this.wsUrl });

    try {
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        console.log(`[SOL WS] Conectado ao servidor WebSocket em ${this.wsUrl}`);
        this.emit('ws_status', { status: 'connected', connected: true, url: this.wsUrl });
      };

      this.socket.onclose = () => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        if (wasConnected) {
          console.log('[SOL WS] Desconectado do servidor WebSocket.');
        }
        if (this.wsEnabled) {
          this.emit('ws_status', { status: 'disconnected', connected: false, url: this.wsUrl });
          // Tentar reconectar periodicamente apenas enquanto a bridge estiver habilitada
          setTimeout(() => {
            if (!this.isConnected && this.wsEnabled) {
              this.connect();
            }
          }, 3000);
        } else {
          this.emit('ws_status', { status: 'disabled', connected: false, url: this.wsUrl });
        }
      };

      this.socket.onerror = (err) => {
        this.isConnected = false;
        if (this.wsEnabled) {
          this.emit('ws_status', { status: 'error', connected: false, error: err, url: this.wsUrl });
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.emit('remote_command', msg);
        } catch (e) {
          // Mensagem de texto simples
        }
      };
    } catch (err) {
      this.isConnected = false;
      if (this.wsEnabled) {
        this.emit('ws_status', { status: 'error', connected: false, error: err, url: this.wsUrl });
      }
    }
  }

  disconnect() {
    this.setBridgeEnabled(false);
  }

  /**
   * Envia evento de varredura do radar para o barramento interno e para o WebSocket
   */
  broadcastRadarStep(stepData) {
    // 1. Emite para a camada interna do navegador (Musical Surface)
    this.emit('radar_step', stepData);

    // 2. Se o WebSocket estiver ativo, envia para a bridge / ouvintes remotos
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const wsPayload = {
          type: 'radar_step',
          angle: stepData.angle,
          sliceIndex: stepData.sliceIndex,
          trackStates: stepData.trackStates,
          activeTracks: stepData.activeTracks,
          timestamp: stepData.timestamp
        };
        this.socket.send(JSON.stringify(wsPayload));
      } catch (err) {
        console.warn('[SOL WS] Falha ao enviar pacote via WebSocket:', err);
      }
    }
  }

  broadcastCellToggle(col, row, state) {
    const data = { type: 'cell_toggle', col, row, state, timestamp: Date.now() };
    this.emit('cell_toggle', data);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }
}
