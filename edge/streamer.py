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

    def __init__(self, server_url="ws://localhost:8000/ws/edge",
                 device_id=None, latitude=None, longitude=None):
        # Append device query params to the WebSocket URL
        params = {}
        if device_id:
            params["device_id"] = device_id
        if latitude is not None:
            params["latitude"] = str(latitude)
        if longitude is not None:
            params["longitude"] = str(longitude)
        if params:
            sep = "&" if "?" in server_url else "?"
            server_url += sep + "&".join(f"{k}={v}" for k, v in params.items())
        self.server_url = server_url
        self.ws = None
        self.inbox = asyncio.Queue()
        self._listener_task = None
        self._send_lock = asyncio.Lock()

    async def connect(self):
        # Cancel old listener before reconnecting
        if self._listener_task is not None:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except (asyncio.CancelledError, Exception):
                pass
            self._listener_task = None

        # Close old socket if still open
        if self.ws is not None:
            try:
                await self.ws.close()
            except Exception:
                pass
            self.ws = None

        try:
            self.ws = await websockets.connect(self.server_url)
            print(f"WebSocket connected to {self.server_url}")
            self._listener_task = asyncio.ensure_future(self._listener())
        except Exception as e:
            print(f"WebSocket connection failed: {e}")
            self.ws = None

    async def send(self, message_dict):
        async with self._send_lock:
            if self.ws is None:
                print("WebSocket not connected, attempting reconnect...")
                await self.connect()
            if self.ws is None:
                return
            try:
                await self.ws.send(json.dumps(message_dict))
            except (websockets.exceptions.ConnectionClosed, Exception) as e:
                print(f"WebSocket send failed ({e}), reconnecting...")
                await self.connect()
                # Retry once after reconnect
                if self.ws is not None:
                    try:
                        await self.ws.send(json.dumps(message_dict))
                    except Exception:
                        pass

    async def send_clip(self, clip_path):
        try:
            with open(clip_path, "rb") as f:
                clip_bytes = f.read()
        except OSError as e:
            print(f"Failed to read clip {clip_path}: {e}")
            return
        message = {
            "type": "clip",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "clip_b64": base64.b64encode(clip_bytes).decode("ascii"),
            "filename": os.path.basename(clip_path),
        }
        print(f"Sending clip {os.path.basename(clip_path)} ({len(clip_bytes)} bytes)...")
        await self.send(message)
        print(f"Clip sent successfully")

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
        except asyncio.CancelledError:
            pass
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket listener: connection closed")
        except Exception as e:
            print(f"WebSocket listener error: {e}")

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
            try:
                await self._listener_task
            except (asyncio.CancelledError, Exception):
                pass
        if self.ws is not None:
            await self.ws.close()
            print("WebSocket closed")


class StreamerBridge:
    """Synchronous wrapper — runs EdgeStreamer in a background thread."""

    def __init__(self, server_url="ws://localhost:8000/ws/edge",
                 device_id=None, latitude=None, longitude=None):
        self._streamer = EdgeStreamer(server_url, device_id=device_id,
                                     latitude=latitude, longitude=longitude)
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def _run(self, coro, timeout=10):
        return asyncio.run_coroutine_threadsafe(coro, self._loop).result(timeout=timeout)

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
            # Clips can be large — allow more time for base64 encode + send
            self._run(self._streamer.send_clip(clip_path), timeout=60)
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
