from __future__ import annotations


DISEASE_PRIORITY = {
    "Cardiac Arrest": 100,
    "Severe Breathing Difficulty": 94,
    "Stroke Symptoms": 90,
    "Road Accident Trauma": 86,
    "Pregnancy Emergency": 78,
    "High Fever / Infection": 58,
    "Fracture / Injury": 44,
    "Routine Transfer": 20,
}


def resolve_priority(disease: str | None, priority: int | None) -> int:
    if priority is not None:
        return max(0, min(100, int(priority)))
    if disease and disease in DISEASE_PRIORITY:
        return DISEASE_PRIORITY[disease]
    return 50


def corridor_params(priority: int, base_speed_kmph: float) -> dict[str, float | int]:
    p = max(0, min(100, priority))
    return {
        "green_radius_m": int(140 + p * 1.4),
        "predict_radius_m": int(380 + p * 4.7),
        "speed_kmph": round(base_speed_kmph * (0.88 + p / 100 * 0.32), 1),
        "prediction_lead": round(0.10 + p / 100 * 0.12, 3),
    }
