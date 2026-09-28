from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from app.models import AmbulanceState, DispatchRequest, DispatchResponse, IncidentSummary, Metrics, RoutePoint
from app.services.eta import EtaPredictionService
from app.services.geo import point_at_distance
from app.services.priority import corridor_params, resolve_priority
from app.services.routing import RoutingService
from app.services.signals import SignalOptimizationService
from app.services.traffic import TrafficAnalysisService
from app.services.vehicles import VehicleReroutingService
from app.websocket.manager import ConnectionManager


class SimulationEngine:
    def __init__(self, manager: ConnectionManager) -> None:
        self.manager = manager
        self.routing = RoutingService()
        self.signals = SignalOptimizationService()
        self.traffic = TrafficAnalysisService()
        self.vehicles = VehicleReroutingService()
        self.eta = EtaPredictionService()
        self.tick_seconds = float(os.getenv("SIMULATION_TICK_SECONDS", "0.85"))
        self.base_speed_kmph = float(os.getenv("AMBULANCE_SPEED_KMPH", "58"))
        self.dispatch_id: str | None = None
        self.route: list[RoutePoint] = []
        self.distance_m = 0.0
        self._travelled_m = 0.0
        self.destination: RoutePoint | None = None
        self.road_closure: RoutePoint | None = None
        self.intersections = []
        self.vehicle_agents = []
        self.ambulances: list[AmbulanceState] = []
        self.metrics = Metrics()
        self.events: list[str] = []
        self.incident_summary: IncidentSummary | None = None
        self.active_ambulance_id: str | None = None
        self.priority = 50
        self.disease = "Cardiac Arrest"
        self.green_radius_m = 200
        self.predict_radius_m = 650
        self.prediction_lead = 0.18
        self.corridor_speed_kmph = self.base_speed_kmph
        self.playback_speed = 1.0
        self.sim_status = "idle"
        self._task: asyncio.Task[None] | None = None
        self._running = False
        self._paused = False
        self._abort = False
        self._peak_signals = 0
        self.road_closure = None

    def _active(self) -> AmbulanceState | None:
        if not self.ambulances:
            return None
        if self.active_ambulance_id:
            for ambulance in self.ambulances:
                if ambulance.id == self.active_ambulance_id:
                    return ambulance
        return next((unit for unit in self.ambulances if unit.status == "En Route"), self.ambulances[0])

    async def dispatch(self, request: DispatchRequest) -> DispatchResponse:
        self._abort = False
        self._paused = False
        self.playback_speed = 1.0
        self.incident_summary = None
        self._peak_signals = 0
        self.road_closure = None
        self.priority = resolve_priority(request.disease, request.priority)
        self.disease = request.disease
        params = corridor_params(self.priority, self.base_speed_kmph)
        self.green_radius_m = int(params["green_radius_m"])
        self.predict_radius_m = int(params["predict_radius_m"])
        self.prediction_lead = float(params["prediction_lead"])
        self.corridor_speed_kmph = float(params["speed_kmph"])

        route_data = await self.routing.get_route(request.start, request.destination)
        self.route = route_data["points"]
        self.distance_m = route_data["distance_m"]
        self._travelled_m = 0.0
        self.destination = request.destination or self.route[-1]
        self.dispatch_id = f"IW-{uuid.uuid4().hex[:8].upper()}"
        self.intersections = self.signals.generate_intersections(self.route, self.green_radius_m)
        self.vehicle_agents = self.vehicles.seed_vehicles(self.route)
        first = self.route[0]
        normal, optimized = self.eta.estimate(self.distance_m, self.corridor_speed_kmph, 58, 0, self.priority)

        active_id = request.ambulance_id or "AMB-001"
        self.active_ambulance_id = active_id
        parked = {
            unit.id: unit
            for unit in request.fleet
            if unit.id != active_id
        }
        self.ambulances = [
            AmbulanceState(
                id=active_id,
                lat=first.lat,
                lng=first.lng,
                speed_kmph=self.corridor_speed_kmph,
                eta_seconds=optimized,
                optimized_eta_seconds=optimized,
                normal_eta_seconds=normal,
                name=request.name,
                disease=request.disease,
                priority=self.priority,
                status="En Route",
            )
        ]
        for unit in parked.values():
            self.ambulances.append(
                AmbulanceState(
                    id=unit.id,
                    lat=unit.lat,
                    lng=unit.lng,
                    name=unit.name,
                    disease=unit.disease,
                    status="Standby",
                    priority=resolve_priority(unit.disease, None),
                )
            )

        self.events = [
            f"Emergency dispatch authorized for {active_id}",
            f"{request.disease} · priority {self.priority} · green radius {self.green_radius_m}m",
            f"Route source locked: {route_data['source'].upper()}",
            "AI priority engine calculating green wave",
        ]
        traffic_snapshot = self.traffic.score(self.route, self.vehicle_agents, 0)
        self.metrics = self.traffic.metrics(normal, optimized, self.route, 0, 0, traffic_snapshot.congestion_score)
        self.sim_status = "running"
        self._start_loop()
        payload = self.snapshot("dispatch", heat_points=traffic_snapshot.heat_points)
        await self.manager.broadcast(payload)
        return DispatchResponse(
            dispatch_id=self.dispatch_id,
            route=self.route,
            intersections=self.intersections,
            vehicles=self.vehicle_agents,
            ambulances=self.ambulances,
            metrics=self.metrics,
            events=self.events[-8:],
            sim_status=self.sim_status,
            playback_speed=self.playback_speed,
        )

    def _start_loop(self) -> None:
        self._running = True
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = asyncio.create_task(self._run())

    async def _run(self) -> None:
        tick = 0
        try:
            while self._running and self.route and self._travelled_m < self.distance_m:
                while self._paused and not self._abort:
                    await asyncio.sleep(0.12)
                if self._abort:
                    break
                tick += 1
                meters_per_tick = (self.corridor_speed_kmph / 3.6) * self.tick_seconds
                travelled = min(self.distance_m, self._travelled_m + meters_per_tick * (1.25 if tick > 5 else 0.72))
                self._travelled_m = travelled
                point, route_index = point_at_distance(self.route, travelled)
                progress = travelled / max(self.distance_m, 1)
                self.intersections, signal_events = self.signals.update(
                    self.intersections,
                    point,
                    progress,
                    self.green_radius_m,
                    self.predict_radius_m,
                    self.prediction_lead,
                )
                self.vehicle_agents, _rerouted_now, vehicle_events = self.vehicles.update(
                    self.vehicle_agents, point, self.route, tick
                )
                active_signals = sum(1 for signal in self.intersections if signal.state.value == "GREEN")
                self._peak_signals = max(self._peak_signals, active_signals)
                traffic_snapshot = self.traffic.score(self.route, self.vehicle_agents, progress)
                remaining = max(0, self.distance_m - travelled)
                normal_eta, optimized_eta = self.eta.estimate(
                    remaining,
                    self.corridor_speed_kmph,
                    traffic_snapshot.congestion_score,
                    active_signals,
                    self.priority,
                )
                active = self._active()
                if active:
                    active.lat = point.lat
                    active.lng = point.lng
                    active.progress = round(progress, 4)
                    active.route_index = route_index
                    active.speed_kmph = self.corridor_speed_kmph
                    active.eta_seconds = optimized_eta
                    active.optimized_eta_seconds = optimized_eta
                    active.normal_eta_seconds = normal_eta
                    active.status = "En Route"
                total_rerouted = sum(1 for vehicle in self.vehicle_agents if vehicle.status in {"REROUTING", "CLEARED"})
                self.metrics = self.traffic.metrics(
                    normal_eta,
                    optimized_eta,
                    self.route,
                    active_signals,
                    total_rerouted,
                    traffic_snapshot.congestion_score,
                )
                if tick % 3 == 0:
                    self.events.append("Predictive signal timing recalibrated")
                self.events.extend(signal_events + vehicle_events)
                await self.manager.broadcast(self.snapshot("tick", heat_points=traffic_snapshot.heat_points))
                await asyncio.sleep(max(0.08, self.tick_seconds / max(self.playback_speed, 0.25)))

            if self._abort:
                active = self._active()
                if active:
                    active.status = "Aborted"
                self.sim_status = "aborted"
                self.events.append("Dispatch aborted. Corridor released to normal traffic.")
                await self.manager.broadcast(self.snapshot("aborted"))
            else:
                active = self._active()
                if active:
                    active.progress = 1
                    active.status = "Arrived"
                    if self.route:
                        last = self.route[-1]
                        active.lat = last.lat
                        active.lng = last.lng
                self.sim_status = "complete"
                self.incident_summary = self._build_summary()
                self.events.append("Ambulance reached destination. Corridor returning to normal control.")
                await self.manager.broadcast(self.snapshot("complete"))
        except asyncio.CancelledError:
            return
        finally:
            self._running = False
            self._paused = False

    def _build_summary(self) -> IncidentSummary:
        active = self._active()
        saved = round(self.metrics.normal_eta_min - self.metrics.optimized_eta_min, 1)
        narrative = (
            f"{active.id if active else 'Ambulance'} cleared a {self.metrics.corridor_length_km} km corridor "
            f"for {self.disease} (P{self.priority}), saving {saved} min versus uncoordinated traffic "
            f"with {self._peak_signals} green-wave signals and {self.metrics.vehicles_rerouted} civilian reroutes."
        )
        return IncidentSummary(
            dispatch_id=self.dispatch_id or "",
            ambulance_id=active.id if active else "",
            name=active.name if active else None,
            disease=self.disease,
            priority=self.priority,
            corridor_length_km=self.metrics.corridor_length_km,
            normal_eta_min=self.metrics.normal_eta_min,
            optimized_eta_min=self.metrics.optimized_eta_min,
            eta_saved_min=saved,
            eta_reduction_pct=self.metrics.eta_reduction_pct,
            signals_used=self._peak_signals,
            vehicles_cleared=self.metrics.vehicles_rerouted,
            narrative=narrative,
        )

    async def pause(self) -> dict[str, Any]:
        if not self._running:
            return self.snapshot("idle")
        self._paused = True
        self.sim_status = "paused"
        self.events.append("Simulation paused")
        snapshot = self.snapshot("paused")
        await self.manager.broadcast(snapshot)
        return snapshot

    async def resume(self) -> dict[str, Any]:
        if not self._running:
            return self.snapshot("idle")
        self._paused = False
        self.sim_status = "running"
        self.events.append("Simulation resumed")
        snapshot = self.snapshot("resumed")
        await self.manager.broadcast(snapshot)
        return snapshot

    async def abort(self) -> dict[str, Any]:
        if not self._running:
            return self.snapshot(self.sim_status)
        self._abort = True
        self._paused = False
        self.sim_status = "aborted"
        snapshot = self.snapshot("aborted")
        await self.manager.broadcast(snapshot)
        return snapshot

    async def set_speed(self, multiplier: float) -> dict[str, Any]:
        self.playback_speed = max(0.25, min(4.0, float(multiplier)))
        self.events.append(f"Playback set to {self.playback_speed:g}x")
        snapshot = self.snapshot("speed")
        await self.manager.broadcast(snapshot)
        return snapshot

    async def manual_reroute(self) -> dict[str, Any]:
        ambulance = None
        active = self._active()
        if active:
            ambulance = RoutePoint(lat=active.lat, lng=active.lng)
        self.vehicle_agents, rerouted, events = self.vehicles.force_reroute(self.vehicle_agents, ambulance)
        self.events.extend(events)
        self.metrics.vehicles_rerouted = max(self.metrics.vehicles_rerouted, rerouted)
        snapshot = self.snapshot("manual_reroute")
        await self.manager.broadcast(snapshot)
        return snapshot

    async def simulate_road_closure(self) -> dict[str, Any]:
        active = self._active()
        if not self._running or not active or not self.destination or len(self.route) < 2:
            return self.snapshot("road_closure_unavailable", notice="Start a dispatch before simulating a road closure.")

        remaining = max(0, self.distance_m - self._travelled_m)
        if remaining < 120:
            return self.snapshot("road_closure_unavailable", notice="The ambulance is too close to arrival to reroute.")

        closure_distance = self._travelled_m + remaining * 0.55
        blocked, _ = point_at_distance(self.route, closure_distance)
        origin = RoutePoint(lat=active.lat, lng=active.lng)
        route_data = await self.routing.get_detour_route(origin, self.destination, blocked)
        self.route = route_data["points"]
        self.distance_m = route_data["distance_m"]
        self._travelled_m = 0.0
        self.road_closure = blocked
        self.intersections = self.signals.generate_intersections(self.route, self.green_radius_m)
        self.vehicle_agents = self.vehicles.seed_vehicles(self.route)
        active.lat = self.route[0].lat
        active.lng = self.route[0].lng
        active.progress = 0.0
        active.route_index = 0
        active.status = "En Route"
        normal, optimized = self.eta.estimate(
            self.distance_m, self.corridor_speed_kmph, 58, 0, self.priority
        )
        traffic_snapshot = self.traffic.score(self.route, self.vehicle_agents, 0)
        self.metrics = self.traffic.metrics(
            normal, optimized, self.route, 0, 0, traffic_snapshot.congestion_score
        )
        self.events.extend([
            "SIMULATION: road closure reported ahead on the active corridor",
            "Ambulance route recalculated from its current position via a detour waypoint",
        ])
        snapshot = self.snapshot("road_closure", heat_points=traffic_snapshot.heat_points)
        await self.manager.broadcast(snapshot)
        return snapshot

    def snapshot(self, event_type: str = "snapshot", **extra: Any) -> dict[str, Any]:
        return {
            "type": event_type,
            "dispatch_id": self.dispatch_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "route": [point.model_dump(mode="json") for point in self.route],
            "intersections": [signal.model_dump(mode="json") for signal in self.intersections],
            "vehicles": [vehicle.model_dump(mode="json") for vehicle in self.vehicle_agents],
            "ambulances": [ambulance.model_dump(mode="json") for ambulance in self.ambulances],
            "metrics": self.metrics.model_dump(mode="json"),
            "events": self.events[-18:],
            "sim_status": self.sim_status,
            "playback_speed": self.playback_speed,
            "incident_summary": self.incident_summary.model_dump(mode="json") if self.incident_summary else None,
            "active_ambulance_id": self.active_ambulance_id,
            "priority": self.priority,
            "green_radius_m": self.green_radius_m,
            "road_closure": self.road_closure.model_dump(mode="json") if self.road_closure else None,
            **extra,
        }

    def traffic_payload(self) -> dict[str, Any]:
        active = self._active()
        progress = active.progress if active else 0
        snapshot = self.traffic.score(self.route, self.vehicle_agents, progress) if self.route else None
        return {
            "congestion_score": snapshot.congestion_score if snapshot else 0,
            "density": snapshot.density if snapshot else 0,
            "heat_points": snapshot.heat_points if snapshot else [],
        }

    def optimize_payload(self) -> dict[str, Any]:
        return {
            "strategy": "proximity_green_wave",
            "priority_radius_m": self.green_radius_m,
            "prediction_window_m": self.predict_radius_m,
            "priority": self.priority,
            "disease": self.disease,
            "route_confidence": self.metrics.route_confidence,
            "ai_efficiency": self.metrics.ai_efficiency,
            "recommendations": [
                "Hold cross traffic for ambulance-bearing approaches",
                "Propagate green state two intersections ahead",
                "Divert civilian vehicles away from active corridor",
            ],
        }
