"""Cited distance-based transport estimates from the committed DESNZ subset."""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).with_name("Transport_Emission_Factors_DESNZ_2026.csv")


@lru_cache(maxsize=1)
def load_transport_factors() -> dict[str, dict]:
    with DATA_FILE.open(newline="", encoding="utf-8") as handle:
        return {
            row["factor_id"]: {**row, "kg_co2e_per_km": float(row["kg_co2e_per_km"])}
            for row in csv.DictReader(handle)
        }


def transport_catalog() -> list[dict]:
    return list(load_transport_factors().values())


def estimate_transport_emissions(factor_id: str, distance_km: float, passengers: int = 1) -> dict:
    factor = load_transport_factors().get(factor_id)
    if factor is None:
        raise ValueError("Unknown transport factor")
    if distance_km <= 0 or passengers < 1:
        raise ValueError("Distance must be positive and passengers must be at least one")
    divisor = passengers if factor["basis"] == "vehicle_km" else 1
    co2_kg = round(distance_km * factor["kg_co2e_per_km"] / divisor, 4)
    return {
        "factor": factor,
        "distance_km": distance_km,
        "passengers": passengers,
        "co2_kg": co2_kg,
        "formula": f"{distance_km:g} km x {factor['kg_co2e_per_km']:.5f} kg CO2e/km" + (f" / {passengers} occupants" if divisor > 1 else ""),
    }
