#!/usr/bin/env python3
"""
server.py
Servidor integrado do Sound of Life (SOL):
- Servidor HTTP estático na porta 8080 (para abrir a aplicação Web)
- Servidor WebSocket na porta 8765 (para receber dados do SOL)
- Roteador OSC UDP na porta 5500 (para DAWs / sintetizadores externos)

Execução:
  python bridge/server.py
"""

import asyncio
import http.server
import json
import logging
import os
import socketserver
import sys
import threading
from pythonosc import udp_client
import websockets

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("SOL_Server")

HTTP_PORT = 8080
WS_PORT = 8765
OSC_IP = "127.0.0.1"
OSC_PORT = 5500

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def run_http_server(web_dir, port=HTTP_PORT):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=web_dir, **kwargs)

        def log_message(self, format, *args):
            # Reduz verbosidade do log HTTP
            pass

    with ThreadingHTTPServer(("", port), Handler) as httpd:
        logger.info(f"Servidor Web HTTP ativo em: http://localhost:{port}")
        httpd.serve_forever()

class SolFullServer:
    def __init__(self):
        self.osc_client = udp_client.SimpleUDPClient(OSC_IP, OSC_PORT)
        self.clients = set()

    def send_osc(self, angle, track_states):
        try:
            int_states = [1 if st else 0 for st in track_states]
            payload = [int(angle)] + int_states
            self.osc_client.send_message("/sol", payload)
        except Exception as e:
            logger.error(f"Erro OSC: {e}")

    async def ws_handler(self, websocket):
        self.clients.add(websocket)
        addr = websocket.remote_address
        logger.info(f"[WS] Navegador conectado: {addr}")
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    mtype = data.get("type")
                    if mtype == "radar_step":
                        self.send_osc(data.get("angle", 0), data.get("trackStates", []))
                    elif mtype == "cell_toggle":
                        self.osc_client.send_message("/sol/cell", [
                            int(data.get("col", 0)),
                            int(data.get("row", 0)),
                            int(data.get("state", 0))
                        ])
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            logger.debug(f"[WS] Desconexão: {e}")
        finally:
            self.clients.remove(websocket)
            logger.info(f"[WS] Navegador desconectado: {addr}")

    async def start(self):
        logger.info(f"[WS] WebSocket Server ouvindo em ws://127.0.0.1:{WS_PORT}")
        logger.info(f"[OSC] Roteador OSC pronto enviando para UDP {OSC_IP}:{OSC_PORT} (/sol)")
        async with websockets.serve(self.ws_handler, "127.0.0.1", WS_PORT):
            await asyncio.Future()

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Inicia o servidor HTTP em background thread
    http_thread = threading.Thread(target=run_http_server, args=(base_dir, HTTP_PORT), daemon=True)
    http_thread.start()

    # Inicia o loop assíncrono do WebSocket e OSC
    server = SolFullServer()
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        logger.info("Encerrando servidor...")

if __name__ == "__main__":
    main()
