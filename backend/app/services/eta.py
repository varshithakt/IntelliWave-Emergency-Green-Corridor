from __future__ import annotations


class EtaPredictionService:
    def estimate(
        self,
        distance_remaining_m: float,
        speed_kmph: float,
        congestion_score: float,
        active_signals: int,
        priority: int = 50,
    ) -> tuple[int, int]:
        base_speed_mps = max(5, speed_kmph / 3.6)
        congestion_factor = 1 + congestion_score / 145
        normal = int(distance_remaining_m / max(3.2, base_speed_mps * 0.62) * congestion_factor)
        priority_gain = min(
            0.48,
            0.10
            + active_signals * 0.035
            + max(0, 72 - congestion_score) * 0.002
            + max(0, min(100, priority)) / 100 * 0.14,
        )
        optimized = int(normal * (1 - priority_gain))
        return max(12, normal), max(8, optimized)
