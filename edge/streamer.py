"""WebSocket client for edge-to-backend communication."""

import asyncio
import base64
import json
import os
import threading
from datetime import datetime, timezone

import websockets


class EdgeStreamer:
    """Async WebSocket client that sends detections and receives commands."""

    def __init__(self, server_url="ws://localhost:8000/ws/edge"):
        self.server_url = server_url
        self.ws = None
        self.inbox = asyncio.Queue()
        self._listener_task = None

    async def connect(self):
        try:
            self.ws = await websockets.connect(self.server_url)
            print(f"WebSocket connected to {self.server_url}")
            self._listener_task = asyncio.ensure_future(self._listener())
        except Exception as e:
            print(f"WebSocket connection failed: {e}")

    async def send(self, message_dict):
        if self.ws is None:
            print("WebSocket not connected, attempting reconnect...")
            await self.connect()
        if self.ws is None:
            return
        try:
            await self.ws.send(json.dumps(message_dict))
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection lost, reconnecting...")
            self.ws = None
            await self.connect()

    async def send_clip(self, clip_path):
        with open(clip_path, "rb") as f:
            clip_bytes = f.read()
        message = {
            "type": "clip",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "clip_b64": base64.b64encode(clip_bytes).decode("ascii"),
            "filename": os.path.basename(clip_path),
        }
        await self.send(message)

    async def _listener(self):
        try:
            async for raw in self.ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                msg_type = msg.get("type")
                if msg_type in ("feedback", "retrain", "config"):
                    await self.inbox.put(msg)
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket listener: connection closed")

    def get_inbox(self):
        messages = []
        while not self.inbox.empty():
            try:
                messages.append(self.inbox.get_nowait())
            except asyncio.QueueEmpty:
                break
        return messages

    async def close(self):
        if self._listener_task is not None:
            self._listener_task.cancel()
        if self.ws is not None:
            await self.ws.close()
            print("WebSocket closed")


class StreamerBridge:
    """Synchronous wrapper — runs EdgeStreamer in a background thread."""

    def __init__(self, server_url="ws://localhost:8000/ws/edge"):
        self._streamer = EdgeStreamer(server_url)
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def _run(self, coro):
        return asyncio.run_coroutine_threadsafe(coro, self._loop).result(timeout=10)

    def connect(self):
        try:
            self._run(self._streamer.connect())
        except Exception as e:
            print(f"StreamerBridge connect error: {e}")

    def send(self, message_dict):
        try:
            self._run(self._streamer.send(message_dict))
        except Exception as e:
            print(f"StreamerBridge send error: {e}")

    def send_clip(self, clip_path):
        try:
            self._run(self._streamer.send_clip(clip_path))
        except Exception as e:
            print(f"StreamerBridge send_clip error: {e}")

    def get_inbox(self):
        return self._streamer.get_inbox()

    def close(self):
        try:
            self._run(self._streamer.close())
        except Exception:
            pass
        self._loop.call_soon_threadsafe(self._loop.stop)
