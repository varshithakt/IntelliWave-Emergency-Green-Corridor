from __future__ import annotations

import os
import math
from typing import Any

import httpx

from app.models import RoutePoint
from app.services.geo import path_length_m

BENGALURU_DEFAULT_START = RoutePoint(lat=12.97194, lng=77.59369)
BENGALURU_DEFAULT_DESTINATION = RoutePoint(lat=12.93524, lng=77.62452)


class RoutingService:
    def __init__(self) -> None:
        self.base_url = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")

    async def get_route(self, start: RoutePoint | None, destination: RoutePoint | None) -> dict[str, Any]:
        origin = start or BENGALURU_DEFAULT_START
        target = destination or BENGALURU_DEFAULT_DESTINATION
        url = (
            f"{self.base_url}/route/v1/driving/"
            f"{origin.lng},{origin.lat};{target.lng},{target.lat}"
        )
        params = {"overview": "full", "geometries": "geojson", "steps": "true", "alternatives": "false"}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                route = data["routes"][0]
                coords = route["geometry"]["coordinates"]
                points = [RoutePoint(lat=lat, lng=lng) for lng, lat in coords]
                return {
                    "points": points,
                    "distance_m": float(route.get("distance", path_length_m(points))),
                    "duration_s": int(route.get("duration", path_length_m(points) / 11)),
                    "source": "osrm",
                    "steps": route.get("legs", [{}])[0].get("steps", []),
                }
        except Exception:
            fallback = self._fallback_route(origin, target)
            return {
                "points": fallback,
                "distance_m": path_length_m(fallback),
                "duration_s": int(path_length_m(fallback) / 9.5),
                "source": "fallback",
                "steps": [],
            }

    async def get_detour_route(self, start: RoutePoint, destination: RoutePoint, blocked: RoutePoint) -> dict[str, Any]:
        """Build a road-snapped demo detour through a waypoint beside a simulated closure."""
        latitude_scale = max(0.2, abs(math.cos(math.radians(blocked.lat))))
        east_west = (destination.lng - start.lng) * latitude_scale
        north_south = destination.lat - start.lat
        length = max((east_west ** 2 + north_south ** 2) ** 0.5, 0.0001)
        offset_degrees = 0.0035
        waypoint = RoutePoint(
            lat=blocked.lat - (east_west / length) * offset_degrees,
            lng=blocked.lng + (north_south / length) * offset_degrees / latitude_scale,
        )
        first_leg = await self.get_route(start, waypoint)
        second_leg = await self.get_route(waypoint, destination)
        points = first_leg["points"] + second_leg["points"][1:]
        return {
            "points": points,
            "distance_m": first_leg["distance_m"] + second_leg["distance_m"],
            "duration_s": first_leg["duration_s"] + second_leg["duration_s"],
            "source": "simulated_detour",
            "steps": first_leg.get("steps", []) + second_leg.get("steps", []),
            "detour_waypoint": waypoint,
        }

    def _fallback_route(self, start: RoutePoint, destination: RoutePoint) -> list[RoutePoint]:
        return [
            start,
            RoutePoint(lat=12.96686, lng=77.59696),
            RoutePoint(lat=12.96132, lng=77.60144),
            RoutePoint(lat=12.95508, lng=77.60691),
            RoutePoint(lat=12.94856, lng=77.61339),
            RoutePoint(lat=12.94194, lng=77.61923),
            destination,
        ]
