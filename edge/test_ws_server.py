"""Fake WebSocket backend for testing the edge streamer.

Run this in one terminal:  python test_ws_server.py
Then run test_stream.py in another terminal.
"""

import asyncio
import json

import websockets


async def handle_edge(ws):
    print("Edge connected")
    frame_count = 0

    async def send_fake_feedback():
        while True:
            await asyncio.sleep(10)
            msg = {"type": "feedback", "label": 0}
            await ws.send(json.dumps(msg))
            print(f"  Sent fake feedback: {msg}")

    feedback_task = asyncio.ensure_future(send_fake_feedback())

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                print(f"  Bad JSON: {raw[:100]}")
                continue

            msg_type = msg.get("type", "?")
            frame_count += 1

            if msg_type == "detection":
                level = msg.get("threat_level", "?")
                score = msg.get("threat_score", 0)
                n_people = len(msg.get("people", []))
                b64_len = len(msg.get("frame_b64", ""))
                print(f"  [{frame_count}] detection  threat={level} ({score:.2f})  "
                      f"people={n_people}  frame_b64={b64_len} chars")
            elif msg_type == "clip":
                fname = msg.get("filename", "?")
                b64_len = len(msg.get("clip_b64", ""))
                print(f"  [{frame_count}] clip  file={fname}  clip_b64={b64_len} chars")
            elif msg_type == "heartbeat":
                print(f"  [{frame_count}] heartbeat")
            else:
                print(f"  [{frame_count}] unknown type: {msg_type}")
    except websockets.exceptions.ConnectionClosed:
        print("Edge disconnected")
    finally:
        feedback_task.cancel()


async def main():
    print("Fake backend listening on ws://localhost:8000/ws/edge")
    async with websockets.serve(handle_edge, "localhost", 8000, subprotocols=None):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
