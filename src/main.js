/**
 * main.js
 * Ponto de entrada da aplicação Web Modular Sound of Life (SOL).
 * Inicializa e conecta as 3 camadas desacopladas:
 * 1. SOL Core (Autômato Polar & Varredura)
 * 2. Musical Surface (Roteador de Pistas & Escalas)
 * 3. Sound Engine (Síntese Web Audio & SF2)
 */

import { SolCore } from './core/SolCore.js';
import { SoundEngine } from './audio/SoundEngine.js';
import { TrackManager } from './surface/TrackManager.js';
import { SchemaManager } from './surface/SchemaManager.js';

import { RadarCanvas } from './ui/RadarCanvas.js';
import { TransportBar } from './ui/TransportBar.js';
import { SchemaControls } from './ui/SchemaControls.js';
import { TrackListView } from './ui/TrackListView.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando Sound of Life (SOL) Web Modular...');

  // 1. Instanciação do Sound Engine (Áudio Web)
  const soundEngine = new SoundEngine();

  // 2. Instanciação do SOL Core (Motor Agnóstico de Eventos)
  const solCore = new SolCore({
    cols: 72,
    rows: 24,
    stepDegrees: 5,
    fps: 30,
    wsUrl: 'ws://127.0.0.1:8765'
  });

  // 3. Instanciação do Musical Surface (Gerenciador de Pistas)
  const trackManager = new TrackManager(soundEngine);

  // 4. Carrega o esquema padrão salvo ou de fábrica (com 25% de FX padrão)
  SchemaManager.loadDefault(trackManager, solCore, soundEngine);

  // 5. Conexão do Barramento de Eventos:
  // Quando o feixe do radar atinge um passo de fatia, entrega os estados ao Musical Surface
  solCore.broadcaster.on('radar_step', (stepData) => {
    trackManager.onSolStep(stepData);
  });

  // 6. Montagem dos Componentes de Interface (UI)
  const radarContainer = document.getElementById('radarContainer');
  const transportContainer = document.getElementById('transportContainer');
  const schemaContainer = document.getElementById('schemaContainer');
  const tracksContainer = document.getElementById('tracksContainer');

  const radarCanvas = new RadarCanvas(radarContainer, solCore);
  new TransportBar(transportContainer, solCore, soundEngine, solCore.broadcaster);
  new SchemaControls(schemaContainer, trackManager, solCore, soundEngine);
  new TrackListView(tracksContainer, trackManager, soundEngine);

  // 7. Loop de Renderização do Canvas (60 FPS contínuo)
  const renderLoop = () => {
    radarCanvas.render();
    requestAnimationFrame(renderLoop);
  };
  requestAnimationFrame(renderLoop);

  // 8. Inicia o relógio do SOL Core
  solCore.start();

  console.log('✅ Sound of Life pronto!');
});
