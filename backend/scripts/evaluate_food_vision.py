"""Run a small, reproducible food-vision evaluation against a CSV manifest.

The manifest must contain ``path`` and ``label`` columns. Results include
provider availability so unavailable calls are never scored as wrong labels.
This is a pilot evaluator, not a Food-101 benchmark runner.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / "backend" / ".env")

from backend import ml_service  # noqa: E402


def normalise(value: str | None) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", (value or "").lower()))


def is_correct(expected: str, observed: str | None) -> bool:
    expected_value = normalise(expected)
    observed_value = normalise(observed)
    if expected_value == "non food":
        return observed_value in {"", "none", "non food"}
    return bool(observed_value and (expected_value in observed_value or observed_value in expected_value))


def metric(rows: list[dict], key: str) -> dict:
    scored = [row for row in rows if row[key] is not None]
    correct = sum(is_correct(row["label"], row[key]) for row in scored)
    # With one example per class, micro-F1 equals exact-match accuracy. Report
    # it explicitly instead of calling a sparse one-sample-per-class score a
    # macro-F1 benchmark.
    return {
        "evaluated_images": len(scored),
        "correct_images": correct,
        "top1_accuracy": round(correct / len(scored), 4) if scored else None,
        "micro_f1": round(correct / len(scored), 4) if scored else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--delay-seconds", type=float, default=20.0)
    parser.add_argument("--provider-retry-seconds", type=float, default=65.0)
    parser.add_argument("--max-provider-retries", type=int, default=2)
    args = parser.parse_args()

    ml_service.load_models(str(PROJECT_ROOT / "backend" / "ml" / "models"))
    rows: list[dict] = []
    with args.manifest.open(newline="", encoding="utf-8") as handle:
        manifest = list(csv.DictReader(handle))

    for index, item in enumerate(manifest, start=1):
        image_path = Path(item["path"])
        expected = item["label"]
        try:
            image_bytes = image_path.read_bytes()
            primary = ml_service._predict_primary_food(image_bytes)
            retries = 0
            while (
                retries < args.max_provider_retries
                and primary.get("provider_unavailable")
                and any(error in {"gemini_rate_limited", "gemini_http_503"} for error in primary.get("provider_errors", []))
            ):
                retries += 1
                print(
                    f"{index}/{len(manifest)} provider retry {retries}/{args.max_provider_retries}; "
                    f"waiting {args.provider_retry_seconds}s",
                    flush=True,
                )
                time.sleep(args.provider_retry_seconds)
                primary = ml_service._predict_primary_food(image_bytes)
            cnn = ml_service._predict_food_cnn(image_bytes)
        except Exception as exc:  # preserve the failure; do not fabricate a row
            primary = {"provider_unavailable": True, "provider_errors": [type(exc).__name__]}
            cnn = None

        primary_food = primary.get("food") if primary else None
        cnn_food = cnn.get("food") if cnn else None
        ensemble_food = primary_food
        if primary and primary.get("provider_unavailable"):
            ensemble_food = None
        rows.append({
            "path": str(image_path),
            "label": expected,
            "primary_result": primary_food,
            "primary_confidence": primary.get("confidence") if primary else None,
            "cnn_result": cnn_food,
            "cnn_confidence": cnn.get("confidence") if cnn else None,
            "ensemble_result": ensemble_food,
            "provider_errors": primary.get("provider_errors", []) if primary else [],
        })
        print(f"{index}/{len(manifest)} label={expected} primary={primary_food} errors={rows[-1]['provider_errors']}", flush=True)
        if index < len(manifest):
            time.sleep(args.delay_seconds)

    report = {
        "status": "pilot_evaluation_not_product_validation",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "manifest": str(args.manifest),
        "image_count": len(rows),
        "provider_unavailable_images": sum(row["ensemble_result"] is None for row in rows),
        "metrics": {
            "primary_alone": metric(rows, "primary_result"),
            "cnn_alone": metric(rows, "cnn_result"),
            "ensemble": metric(rows, "ensemble_result"),
        },
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["metrics"], indent=2))


if __name__ == "__main__":
    main()
