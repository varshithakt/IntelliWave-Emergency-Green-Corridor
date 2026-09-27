from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.models import DispatchRequest
from app.services.simulation import SimulationEngine
from app.websocket.manager import ConnectionManager

app = FastAPI(title="IntelliWave AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
engine = SimulationEngine(manager)


class SpeedRequest(BaseModel):
    multiplier: float = Field(default=1.0, ge=0.25, le=4.0)


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "IntelliWave AI", "status": "online", "mode": "emergency-green-corridor"}


@app.post("/dispatch")
async def dispatch(request: DispatchRequest) -> dict:
    response = await engine.dispatch(request)
    return response.model_dump(mode="json")


@app.get("/traffic")
async def traffic() -> dict:
    return engine.traffic_payload()


@app.get("/signals")
async def signals() -> dict:
    return {"signals": [signal.model_dump(mode="json") for signal in engine.intersections]}


@app.get("/optimize")
async def optimize() -> dict:
    return engine.optimize_payload()


@app.post("/reroute")
async def reroute() -> dict:
    snapshot = await engine.manual_reroute()
    return {"status": "accepted", "message": "Vehicle rerouting directive broadcast", "snapshot": snapshot}


@app.post("/sim/pause")
async def sim_pause() -> dict:
    snapshot = await engine.pause()
    return {"status": "paused", "snapshot": snapshot}


@app.post("/sim/resume")
async def sim_resume() -> dict:
    snapshot = await engine.resume()
    return {"status": "running", "snapshot": snapshot}


@app.post("/sim/abort")
async def sim_abort() -> dict:
    snapshot = await engine.abort()
    return {"status": "aborted", "snapshot": snapshot}


@app.post("/sim/speed")
async def sim_speed(request: SpeedRequest) -> dict:
    snapshot = await engine.set_speed(request.multiplier)
    return {"status": "accepted", "playback_speed": request.multiplier, "snapshot": snapshot}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    await websocket.send_json(engine.snapshot("snapshot"))
    try:
        while True:
            message = await websocket.receive_text()
            lowered = message.lower().strip()
            if lowered in {"dispatch", "start"}:
                await engine.dispatch(DispatchRequest())
            elif lowered == "pause":
                await engine.pause()
            elif lowered == "resume":
                await engine.resume()
            elif lowered == "abort":
                await engine.abort()
            elif lowered.startswith("speed"):
                parts = lowered.split()
                multiplier = float(parts[1]) if len(parts) > 1 else 1.0
                await engine.set_speed(multiplier)
            elif lowered == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
