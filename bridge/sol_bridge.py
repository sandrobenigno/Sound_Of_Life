#!/usr/bin/env python3
"""
sol_bridge.py
Ponte WebSocket -> OSC UDP para o Sound of Life (SOL).

Escuta eventos do SOL via WebSocket (ws://127.0.0.1:8765) e transmite
mensagens OSC via UDP para 127.0.0.1:5500 com rota /sol.

Uso:
  python sol_bridge.py [--ws-port 8765] [--osc-ip 127.0.0.1] [--osc-port 5500]
"""

import argparse
import asyncio
import json
import logging
import sys
from pythonosc import udp_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("SOL_Bridge")

class SolBridge:
    def __init__(self, ws_host="127.0.0.1", ws_port=8765, osc_ip="127.0.0.1", osc_port=5500):
        self.ws_host = ws_host
        self.ws_port = ws_port
        self.osc_ip = osc_ip
        self.osc_port = osc_port
        self.osc_client = udp_client.SimpleUDPClient(self.osc_ip, self.osc_port)
        self.connected_clients = set()

    def send_osc_step(self, angle, track_states):
        """
        Envia mensagem OSC idêntica ao Processing original:
        Rota: /sol
        Argumentos: [frame (int), ch1 (int), ch2 (int), ..., ch24 (int)]
        """
        try:
            int_states = [1 if st else 0 for st in track_states]
            # O Processing original enviava: frame, int(out_osc)
            payload = [int(angle)] + int_states
            self.osc_client.send_message("/sol", payload)
        except Exception as e:
            logger.error(f"Erro ao enviar OSC: {e}")

    async def handle_client(self, websocket):
        self.connected_clients.add(websocket)
        client_addr = websocket.remote_address
        logger.info(f"Cliente conectado: {client_addr}")

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get("type")

                    if msg_type == "radar_step":
                        angle = data.get("angle", 0)
                        track_states = data.get("trackStates", [])
                        self.send_osc_step(angle, track_states)

                    elif msg_type == "cell_toggle":
                        col = data.get("col", 0)
                        row = data.get("row", 0)
                        state = data.get("state", 0)
                        self.osc_client.send_message("/sol/cell", [int(col), int(row), int(state)])

                except json.JSONDecodeError:
                    pass
        except Exception as e:
            logger.debug(f"Conexão encerrada com {client_addr}: {e}")
        finally:
            self.connected_clients.remove(websocket)
            logger.info(f"Cliente desconectado: {client_addr}")

    async def start(self):
        import websockets
        logger.info(f"Iniciando WebSocket Server em ws://{self.ws_host}:{self.ws_port}")
        logger.info(f"Roteando OSC para UDP {self.osc_ip}:{self.osc_port} (/sol)")
        
        async with websockets.serve(self.handle_client, self.ws_host, self.ws_port):
            await asyncio.Future()  # Executa para sempre

def main():
    parser = argparse.ArgumentParser(description="Sound of Life (SOL) WebSocket to OSC Bridge")
    parser.add_argument("--ws-host", default="127.0.0.1", help="Host WebSocket (padrão: 127.0.0.1)")
    parser.add_argument("--ws-port", type=int, default=8765, help="Porta WebSocket (padrão: 8765)")
    parser.add_argument("--osc-ip", default="127.0.0.1", help="IP destino OSC (padrão: 127.0.0.1)")
    parser.add_argument("--osc-port", type=int, default=5500, help="Porta destino OSC (padrão: 5500)")
    args = parser.parse_args()

    bridge = SolBridge(args.ws_host, args.ws_port, args.osc_ip, args.osc_port)
    try:
        asyncio.run(bridge.start())
    except KeyboardInterrupt:
        logger.info("Bridge finalizado pelo usuário.")

if __name__ == "__main__":
    main()
