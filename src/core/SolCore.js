/**
 * SolCore.js
 * Orquestrador principal do Sound of Life (SOL).
 * Controla o clock, a rotação do radar, a evolução do Game of Life e o disparo de eventos.
 * É 100% agnóstico de instrumentos, escalas ou áudio.
 */

import { GameOfLife } from './GameOfLife.js';
import { PolarGeometry } from './PolarGeometry.js';
import { SolBroadcaster } from './SolBroadcaster.js';

export class SolCore {
  constructor(options = {}) {
    this.cols = options.cols || 72; // 72 fatias de 5 graus
    this.rows = options.rows || 24; // 24 pistas / anéis
    this.stepDegrees = options.stepDegrees || 5; // A cada 5 graus dispara uma fatia e evolui vida

    this.frame = 0; // Ângulo atual do feixe (0 a 359)
    this.onPause = false;
    this.isRunning = false;

    // Configuração de timing
    this.targetFps = options.fps || 30; // 30 FPS como no Processing original
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / this.targetFps;

    this.gol = new GameOfLife(this.cols, this.rows);
    this.geo = new PolarGeometry({ cols: this.cols, rows: this.rows, diam: options.diam || 750 });
    this.broadcaster = new SolBroadcaster({ wsUrl: options.wsUrl, autoConnect: options.autoConnect ?? true });

    this.currentTrackStates = new Array(this.rows).fill(false);

    // AutoRand por ângulo de scan (90 graus)
    this.autoRand = options.autoRand ?? true;
    this.autoRandAngle = options.autoRandAngle || 90;

    // Inicialização aleatória padrão
    this.init(true);
  }

  setAutoRand(enabled) {
    this.autoRand = !!enabled;
    this.broadcaster.emit('autorand_change', { enabled: this.autoRand });
  }

  init(randomize = true) {
    this.gol.init(randomize);
    this.updateTrackStatesAtAngle(this.frame);
    this.broadcaster.emit('state_reset', { randomize, frame: this.frame });
  }

  clear() {
    this.gol.clear();
    this.updateTrackStatesAtAngle(this.frame);
    this.broadcaster.emit('state_clear', { frame: this.frame });
  }

  randomize() {
    this.gol.randomize();
    this.updateTrackStatesAtAngle(this.frame);
    this.broadcaster.emit('state_randomize', { frame: this.frame });
  }

  restart() {
    this.frame = 0;
    this.init(true);
  }

  togglePause() {
    this.onPause = !this.onPause;
    this.broadcaster.emit('pause_toggle', { onPause: this.onPause });
    return this.onPause;
  }

  setFps(fps) {
    this.targetFps = Math.max(1, Math.min(120, fps));
    this.frameInterval = 1000 / this.targetFps;
  }

  setCell(col, row, state) {
    this.gol.setCell(col, row, state);
    this.updateTrackStatesAtAngle(this.frame);
    this.broadcaster.broadcastCellToggle(col, row, state);
  }

  toggleCell(col, row) {
    const newState = this.gol.toggleCell(col, row);
    this.updateTrackStatesAtAngle(this.frame);
    this.broadcaster.broadcastCellToggle(col, row, newState);
    return newState;
  }

  updateTrackStatesAtAngle(angle) {
    const sliceIndex = Math.floor(angle / this.stepDegrees) % this.cols;
    this.currentTrackStates = this.gol.getColumn(sliceIndex);
    return sliceIndex;
  }

  /**
   * Executa um passo do ciclo de varredura
   */
  tick() {
    // 1. AutoRand a cada incremento de 90 graus de scan (0°, 90°, 180°, 270°)
    if (this.autoRand && this.frame % this.autoRandAngle === 0) {
      this.gol.randomize();
      this.broadcaster.emit('autorand_trigger', { angle: this.frame });
    }

    const isStepTick = this.frame % this.stepDegrees === 0;

    if (isStepTick) {
      const sliceIndex = this.frame / this.stepDegrees;
      this.currentTrackStates = this.gol.getColumn(sliceIndex);

      // Gera lista de índices das trilhas ativas (ex: [0, 4, 12])
      const activeTracks = [];
      for (let i = 0; i < this.rows; i++) {
        if (this.currentTrackStates[i]) {
          activeTracks.push(i);
        }
      }

      // 2. Emite evento de passo de radar com o estado dos 24 canais
      this.broadcaster.broadcastRadarStep({
        angle: this.frame,
        sliceIndex: sliceIndex,
        totalSlices: this.cols,
        totalTracks: this.rows,
        trackStates: [...this.currentTrackStates],
        activeTracks: activeTracks,
        timestamp: Date.now()
      });

      // 3. Se não estiver pausado, calcula a próxima geração do Game of Life
      if (!this.onPause) {
        this.gol.step();
      }
    }

    // Avança o feixe do radar em 1 grau
    this.frame = (this.frame + 1) % 360;
  }

  /**
   * Loop de animação contínuo
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();

    const loop = (currentTime) => {
      if (!this.isRunning) return;

      const elapsed = currentTime - this.lastFrameTime;
      if (elapsed >= this.frameInterval) {
        this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
        this.tick();
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
  }
}
