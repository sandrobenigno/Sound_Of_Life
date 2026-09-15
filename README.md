# 🌐 SOUND OF LIFE (SOL)

![](img/interface.jpg)

> **Sequenciador e Controlador de Música Generativa baseado em Autômato Celular (Conway's Game of Life) e Radar Polar.**  
> *Original: Desenvolvido em Processing (Sandro Benigno, Fevereiro/2021)*  
> *Arquitetura Web Modular & Python Bridge (Sandro Benigno, Setembro/2026)*

Experimente a [Versão Online](https://sandrobenigno.github.io/Sound_Of_Life/)

---

## 📖 1. Visão Geral do Projeto

O **SOUND OF LIFE (SOL)** é um instrumento e controlador generativo visual que une matemática, dinâmica de sistemas complexos e música. Ele mapeia o autômato celular do **Jogo da Vida de Conway (Game of Life)** sobre uma grade geométrica de **coordenadas polares (estilo RADAR circular)**.

Nesta versão **Web Modular**, o sistema foi desenvolvido sob uma arquitetura desacoplada em 3 camadas independentes, garantindo que o núcleo visual/matemático seja 100% agnóstico à síntese sonora. O projeto conta com:
- **Interface Totalmente Responsiva**: Design cyberpunk modular com suporte completo a dispositivos móveis (smartphones/tablets), drawer menu retrátil e interação por toque (*Touch/Drag*).
- **Motor de Áudio Híbrido**: Síntese polifônica nativa via Web Audio API + Reprodutor SoundFont 2 (SF2) hierárquico com cache sob demanda (*lazy decoding*) compatível com soundfonts de grande porte (ex: *FluidR3 GM*).
- **Escalas Customizadas Flexíveis**: Crie sequências melódicas personalizadas digitando notas diretamente (`C3 F#3 Bb4...`).
- **Gerenciador de Esquemas Inteligente**: Exportação/importação `.sol.json` com identificadores semânticos de instrumentos e detecção/reconexão automática de SoundFonts.
- **Ponte de Comunicação Externa**: Suporte a WebSockets e transmissor OSC UDP em Python para controlar DAWs e sintetizadores externos (Ableton Live, Reaper, Max/MSP, PureData, VCV Rack).

---

## 🏛️ 2. Diagrama da Arquitetura

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               SOL CORE                                           │
│  • Autômato Celular Conway B3/S23 em topologia toroidal                          │
│  • Grade Polar: 72 fatias radiais (5°) x 24 trilhas concêntricas                 │
│  • Feixe de Varredura (Scanner) com rotação contínua e rastro fosforescente      │
│  • Interação direta: desenhar e apagar células com Mouse ou Touch                │
│  • 100% Agnóstico de áudio — Emissor puro de eventos de disparo                  │
└───────────────────────────────────┬──────────────────────────────────────────────┘
                                    │
                                    │  Eventos Abstratos (JSON / WebSockets)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        MUSICAL SURFACE                                           │
│  • Rack dinâmico de pistas (Classe Track — até 24 pistas em cards modulares)     │
│  • Duplicação de pistas adjacente (clonagem rápida logo abaixo da pista de origem)│
│  • Catálogo de Escalas (Pentatônicas, Modais, Blues, Orientais, Microtonais)     │
│  • Escalas Personalizadas: entrada direta de notas em texto (ex: C3 D#3 G3 Bb3)   │
│  • Modos de Avanço: Sequencial (➡️/⬅️), Random (🎲), Pêndulo (↔️), Fatia (🎯)  │
│  • Controles de Dinâmica: Velocity, Gate (ms), Probabilidade, Mute, Solo         │
│  • Schema Manager: Identificadores semânticos de SF2 e aviso de arquivos faltantes│
└───────────────────────────────────┬──────────────────────────────────────────────┘
                                    │
                                    │  Comandos de Disparo de Notas
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          SOUND ENGINE                                            │
│  • Sintetizador Polifônico Nativo Web Audio (Saw, Square, Sine, Pluck, FM Bell)  │
│  • SF2 Player Hierárquico (Preset -> Preset Zones -> Instrument -> Samples)      │
│  • Suporte General MIDI multi-preset com Lazy Decoding Cache de amostras         │
│  • Carregamento dinâmico e reconexão automática de soundfonts externos (.sf2)    │
│  • Mixer Master com Limitador Anti-Clipping e Efeito Delay/Reverb Estéreo        │
└──────────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │  Opcional (Ponte Externa)
┌───────────────────────────────────┴──────────────────────────────────────────────┐
│                        PYTHON OSC BRIDGE                                         │
│  • Escuta eventos de varredura via WebSocket (porta 8765)                        │
│  • Transmite pacotes OSC UDP para 127.0.0.1:5500 na rota /sol                    │
│  • Compatível com Ableton Live, Reaper, Max/MSP, PureData, SuperCollider         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 3. Estrutura de Pastas e Arquivos

```
SoundOfLife_WEB/
├── bridge/                          # Módulo de Ponte Externa & Servidor
│   ├── server.py                    # Servidor integrado (HTTP + WebSocket + OSC)
│   ├── sol_bridge.py                # Ponte independente WebSocket -> OSC UDP
│   └── requirements.txt             # Dependências Python (websockets, python-osc)
│
├── public/                          # Ativos Estáticos
│   ├── assets/
│   │   └── sol.png                  # Logotipo e arte central original do SOL
│   ├── soundfonts/                  # Diretório para SoundFonts SF2
│   └── presets/                     # Presets e esquemas padrão em JSON
│
├── src/                             # Código Fonte da Aplicação Web (ESM Nativo)
│   │
│   ├── core/                        # Módulo 1: SOL Core (100% Agnóstico a Som)
│   │   ├── GameOfLife.js            # Engine do autômato toroidal (72x24, regras B3/S23)
│   │   ├── PolarGeometry.js         # Trigonometria polar e conversão tela <-> radar
│   │   ├── RadarRenderer.js         # Renderizador Canvas 2D (estética radar fosforescente)
│   │   ├── SolBroadcaster.js        # Emissor de eventos internos e cliente WebSocket
│   │   └── SolCore.js               # Gerenciador de clock, scanner e ciclo de evolução
│   │
│   ├── surface/                     # Módulo 2: Musical Surface & Gerenciador de Pistas
│   │   ├── Track.js                 # Classe Track individual (regras, fonte, escala, modo)
│   │   ├── TrackManager.js          # Gerenciador do rack de até 24 pistas de áudio
│   │   ├── CircularList.js          # Estrutura de lista circular com modos de cursor
│   │   ├── ScaleCatalog.js          # Catálogo de escalas, parser customizado e conversor
│   │   └── SchemaManager.js         # Exportação/Importação JSON, metadados e fábrica
│   │
│   ├── audio/                       # Módulo 3: Sound Engine (Síntese & Amostras)
│   │   ├── WebAudioSynth.js         # Sintetizador polifônico com envelopes ADSR e filtros
│   │   ├── SF2Player.js             # Reprodutor hierárquico SoundFont 2 com Lazy Cache
│   │   └── SoundEngine.js           # Mixer master, limiter anti-clipping e reverb/delay
│   │
│   ├── ui/                          # Componentes de Interface do Usuário
│   │   ├── RadarCanvas.js           # Interação com o radar (mouse, touch, arrasto)
│   │   ├── TrackListView.js         # Rack vertical de pistas com cards e LEDs
│   │   ├── TransportBar.js          # Barra de transporte, FPS, Volume, OSC e Mobile Drawer
│   │   └── SchemaControls.js        # Painel de esquemas, banner de avisos e upload de .sf2
│   │
│   ├── main.js                      # Bootstrap: inicializa e orquestra todos os módulos
│   └── style.css                    # Estilo Cyberpunk responsivo (Desktop & Mobile)
│
├── index.html                       # Ponto de entrada HTML5 da aplicação
└── README.md                        # Documentação completa
```

---

## ⚙️ 4. Detalhamento dos Módulos

### 1. `SOL Core` (`src/core/`)
- **`GameOfLife.js`**: Matriz toroidal de $72 \text{ fatias} \times 24 \text{ trilhas}$. Aplica conexão contínua nas bordas radiais e angulares. Células vivas com 2 ou 3 vizinhos sobrevivem; células mortas com 3 vizinhos nascem; demais morrem.
- **`PolarGeometry.js`**: Converte coordenadas de tela $(X, Y)$ para a célula correspondente $(\text{coluna}, \text{linha})$ através de `Math.atan2` e distância euclidiana normalizada.
- **`RadarRenderer.js`**: Desenho no Canvas HTML5 com efeito de rastro fosforescente (*fading background*), núcleo central estilizado com `sol.png`, células ativas com pulso estocástico e monitor de LEDs dos 24 canais.
- **`SolBroadcaster.js`**: Emite eventos `radar_step` contendo o ângulo atual, índice da fatia e o estado booleano dos 24 canais para a camada JavaScript interna e para o WebSocket (`ws://127.0.0.1:8765`).
- **`SolCore.js`**: Controla o clock e a rotação do feixe (0° a 359°), acionando a leitura de fatias e nova geração da vida a cada 5° de giro.

### 2. `Musical Surface` (`src/surface/`)
- **Classe `Track`**: Modela uma pista individual com:
  - `inputChannel`: Ponto de entrada do SOL que dispara a pista (0 a 23).
  - `soundSource`: Timbre associado (Sintetizador nativo ou instrumento SF2 semântico).
  - `scaleName` & `customNotesStr`: Escala selecionada ou sequência de notas manuais (`custom`).
  - `advanceMode`: Modo como o cursor percorre as notas a cada disparo:
    - *Sequential Forward (`seq_fwd`)*: Avança 1 nota para frente.
    - *Sequential Backward (`seq_bwd`)*: Retrocede 1 nota.
    - *Random (`random`)*: Escolhe aleatoriamente uma nota da lista.
    - *Pendulum (`pendulum`)*: Avança até a última nota e retorna (efeito ping-pong).
    - *Direct Slice (`direct`)*: A nota é indexada pelo ângulo/fatia atual do radar.
  - `velocity`: Intensidade da nota (fixa, faixa aleatória ou proporcional ao raio).
  - `duration`: Duração do gate em milissegundos (50ms a 1000ms).
  - `probability`: Chance percentual de tocar a nota (0% a 100%).
  - `mute` / `solo`: Controles individuais de mixagem.
- **`TrackManager.js`**: Permite gerenciar até 24 pistas dinamicamente. Suporta duplicação de pista adjacente (inserindo o clone exatamente abaixo da pista original).
- **`ScaleCatalog.js`**:
  - Catálogo amplo de escalas: Pentatônica Menor/Maior, Eólio, Jônio, Dórico, Frígio, Lídio, Mixolídio, Menor Harmônica, Blues, Hirajoshi, Insen, Árabe, Tons Inteiros e Cromática.
  - **Escala Personalizada (`custom`)**: Permite que o usuário defina suas próprias notas em texto livre (ex: `C3 F#3 Bb4 G#5`). Faz o parsing tolerante a espaços, vírgulas e sustenidos/bemóis enharmônicos.
- **`SchemaManager.js`**:
  - Serializa e desserializa o estado completo em arquivos `.sol.json`.
  - Exporta metadados de dependência (`requiredSoundFonts`).
  - Detecta soundfonts não carregados ao importar um esquema e gera avisos contextuais na UI.
  - Reconecta pistas automaticamente quando o usuário carrega o `.sf2` faltante.

### 3. `Sound Engine` (`src/audio/`)
- **`WebAudioSynth.js`**: Sintetizador nativo com envelopes ADSR exponenciais limpos (sem estalos), osciladores *Sawtooth*, *Square*, *Triangle*, *Sine*, *Synth Pluck* (filtro rápido descendente) e *FM Bell* (modulação de frequência metálica).
- **`SF2Player.js`**:
  - **Parser Hierárquico Completo**: Mapeia corretamente a árvore SF2: $\text{Preset} \rightarrow \text{Preset Zones} \rightarrow \text{Instrument} \rightarrow \text{Instrument Zones} \rightarrow \text{Samples}$.
  - **General MIDI Multi-Preset**: Suporte a SoundFonts com múltiplos bancos e presets (ex: *FluidR3 GM*), isolando instrumentos individuais sem misturar timbres na mesma pista.
  - **Lazy Decoding Cache**: As amostras de áudio são convertidas sob demanda para `AudioBuffer`, economizando memória RAM e permitindo carregar SoundFonts de centenas de megabytes instantaneamente.
  - **Identificadores Semânticos**: Formato `sf2custom:<NomeArquivo>:<Bank>:<Preset>` garantindo compatibilidade duradoura em esquemas salvos.
- **`SoundEngine.js`**: Mixer central com limitador estéreo (`DynamicsCompressor`) que evita saturação/clipping mesmo quando 24 vozes soam juntas, além de linha de atraso/reverb estéreo.

### 4. `Python Bridge & Servidor Integrado` (`bridge/`)
- **`bridge/server.py`**: Servidor 3-em-1 em Python puro:
  - **Servidor Web HTTP**: Disponibiliza a interface em `http://localhost:8080`.
  - **Servidor WebSocket**: Escuta eventos do SOL na porta `8765`.
  - **Transmissor OSC UDP**: Envia mensagens `/sol` na porta `5500` (padrão do Processing original).
- **`bridge/sol_bridge.py`**: Ponte independente WebSocket -> OSC para quem deseja rodar o frontend em outro servidor estático.

---

## 🚀 5. Como Executar

### Pré-requisitos
- **Python 3.10+** instalado (com os pacotes `websockets` e `python-osc`).

### Instalação das dependências Python:
```bash
pip install -r bridge/requirements.txt
```

---

### Execução Recomendada (Servidor Completo Integrado):
```bash
python bridge/server.py
```

Isso inicializa simultaneamente:
1. **Aplicação Web**: Acesse pelo navegador em **[http://localhost:8080](http://localhost:8080)**.
2. **WebSocket Hub**: Ativo em `ws://127.0.0.1:8765`.
3. **Roteador OSC UDP**: Enviando para `127.0.0.1:5500` na rota `/sol`.

---

### Execução Apenas do Frontend Web:
Se preferir usar seu próprio servidor estático (como VS Code Live Server ou `python -m http.server 8080`):
- Abra o navegador em `http://localhost:8080`.
- Se desejar comunicação OSC externa, execute em outro terminal `python bridge/sol_bridge.py` e marque o checkbox **`📡 OSC UDP`** na barra superior de transporte. Por padrão, a conexão externa fica desligada para não solicitar permissões de rede local desnecessárias.

---

## 🎛️ 6. Guia de Operação, Atalhos & Mobile

### 📱 Suporte Mobile & Layout Responsivo
- **Drawer Menu (☰)**: Em telas menores ou orientação vertical, o painel de esquemas e controles de áudio fica acessível através do botão de menu no topo direito.
- **Rack Modular**: As pistas se organizam em cards responsivos com agrupamentos visuais de canal, fonte sonora, escala, dinâmica e mixagem.
- **Toque no Radar**: Suporte completo a gestos de toque no Canvas (desenhe e apague células deslizando o dedo).

### 🖱️ Interação com o Radar (Desktop)
- **Botão Esquerdo do Mouse (Clique e Arraste)**: Desenha ou apaga células vivas diretamente na grade circular do radar.
- **Detecção Inteligente**: O primeiro clique define se o arrasto irá pintar ou apagar células.

### ⌨️ Atalhos de Teclado
| Tecla | Ação |
|---|---|
| <kbd>P</kbd> ou <kbd>Espaço</kbd> | **Pausar / Retomar** a evolução das regras do Game of Life |
| <kbd>R</kbd> | **Randomizar** as células do radar mantendo a posição do feixe |
| <kbd>A</kbd> | **AutoRand**: Ativa / Desativa a randomização automática a cada 90° de varredura |
| <kbd>O</kbd> | **OSC UDP**: Ativa / Desativa a conexão com a ponte WebSocket / transmissor OSC |
| <kbd>C</kbd> | **Limpar** (*Clear*) todas as células do tabuleiro |
| <kbd>I</kbd> | **Reiniciar** (*Initialize*) o tabuleiro aleatoriamente e voltar o feixe ao grau 0 |

---

## 💾 7. Gerenciamento de Esquemas e SoundFonts (.SF2)

No painel superior **ESQUEMAS & PRESETS** (ou no Drawer no celular):
1. **`⬇️ Salvar Arquivo`**: Gera e baixa um arquivo `.sol.json` contendo a configuração completa de todas as pistas, escalas personalizadas e referências semânticas a instrumentos.
2. **`⬆️ Carregar Arquivo`**: Abre uma janela para selecionar e aplicar qualquer arquivo `.sol.json`. Caso o esquema utilize soundfonts externos ainda não carregados na sessão, um banner de aviso identificará os arquivos necessários (`⚠️ SoundFonts necessários`).
3. **`📂 Carregar .SF2`**: Permite carregar seus próprios arquivos SoundFont `.sf2` locais (ex: *FluidR3 GM*, *GeneralUser GS*, pianos ou sintetizadores SF2). Ao carregar o arquivo, o sistema reconecta automaticamente todas as pistas pendentes.
4. **`🔄 Restaurar Fábrica`**: Restaura o esquema padrão inicial de fábrica (5 pistas balanceadas entre Sub Bass, Bassline, Pluck, Arp e Chime).

---

## 📡 8. Protocolo de Comunicação OSC e WebSockets

### Pacote WebSocket (JSON)
Emitido a cada 5° de varredura do radar:
```json
{
  "type": "radar_step",
  "angle": 90,
  "sliceIndex": 18,
  "totalSlices": 72,
  "totalTracks": 24,
  "activeTracks": [0, 2, 8, 14],
  "trackStates": [true, false, true, false, false, false, false, false, true, ...]
}
```

### Pacote OSC UDP (Porta 5500, Rota `/sol`)
Idêntico à especificação original do Processing:
- **Rota**: `/sol`
- **Tipos**: `[int, int, int, ..., int]` (25 argumentos)
- **Valores**: `[frame, ch1, ch2, ch3, ..., ch24]` (onde `frame` é o ângulo de 0 a 359 e cada canal é `1` para ativo e `0` para inativo).

---

## 📄 Licença

Este projeto está licenciado sob os termos da **GNU General Public License v3.0 (GPL-3.0)**.  
Consulte o arquivo [`LICENSE`](LICENSE) para obter o texto completo da licença.

Desenvolvido por **Sandro Benigno** (2021, 2026).  
Código aberto para fins educacionais, experimentação artística e desenvolvimento musical generativo.

