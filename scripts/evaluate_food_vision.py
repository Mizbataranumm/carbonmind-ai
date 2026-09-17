"""Evaluate the production food-primary, local-CNN, and decision-rule paths.

The manifest is a CSV with ``path,label`` columns. ``label`` must be the dish
shown in the file, not a filename guess. Use ``__non_food__`` for a non-food
image. Provider outages are recorded separately so they never become fake
accuracy. The report is evidence for the supplied convenience set only.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from sklearn.metrics import f1_score

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / "backend" / ".env")

from backend import ml_service


def key(value: str | None) -> str:
    return ml_service._normalise_food_key(value or "")


def agrees(left: str | None, right: str | None) -> bool:
    return bool(left and right and ml_service._dish_names_agree(left, right))


def decision(primary: dict | None, cnn: dict | None) -> tuple[str | None, str]:
    primary_score = float(primary.get("confidence", 0)) if primary else 0.0
    if primary and primary_score > 0.85:
        return primary.get("food"), "primary_high_confidence"
    if primary and cnn and agrees(primary.get("food"), cnn.get("food")):
        return primary.get("food"), "models_agree_boosted"
    return None, "low_confidence"


def is_non_food(label: str | None) -> bool:
    return key(label) in {"non food", "none"}


def canonical_prediction(value: str | None) -> str:
    return "__non_food__" if value is None else key(value)


def is_correct(row: dict, field: str) -> bool:
    predicted = row.get(field)
    if is_non_food(row["label"]):
        return predicted is None
    return agrees(predicted, row["label"])


def metrics(rows: list[dict], field: str, *, include_unavailable: bool = False) -> dict:
    eligible = [row for row in rows if include_unavailable or row[field] is not None or is_non_food(row["label"])]
    if not eligible:
        return {"evaluated_images": 0, "top1_accuracy": None, "macro_f1": None}
    expected = ["__non_food__" if is_non_food(row["label"]) else key(row["label"]) for row in eligible]
    predicted = [canonical_prediction(row.get(field)) for row in eligible]
    return {
        "evaluated_images": len(eligible),
        "correct_images": sum(is_correct(row, field) for row in eligible),
        "top1_accuracy": round(sum(is_correct(row, field) for row in eligible) / len(eligible), 5),
        "macro_f1": round(float(f1_score(expected, predicted, average="macro", zero_division=0)), 5),
    }


def evaluate(manifest: Path, models_dir: Path, request_interval_seconds: float = 15.0) -> dict:
    ml_service.load_models(str(models_dir))
    rows: list[dict] = []
    with manifest.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not {"path", "label"}.issubset(reader.fieldnames):
            raise ValueError("Manifest must contain path,label columns.")
        for index, source_row in enumerate(reader):
            if index and request_interval_seconds:
                # Gemini's free tier permits five generation requests per minute.
                # Pace this reproducible evaluation instead of silently turning a
                # quota response into a failed classification.
                time.sleep(request_interval_seconds)
            path = Path(source_row["path"])
            if not path.is_absolute():
                path = manifest.parent / path
            image = path.read_bytes()
            primary = ml_service._predict_primary_food(image)
            cnn = ml_service._predict_food_cnn(image)
            ensemble, decision_reason = decision(primary, cnn)
            rows.append({
                "path": str(path),
                "label": source_row["label"],
                "primary_result": primary.get("food") if primary else None,
                "primary_confidence": primary.get("confidence") if primary else None,
                "cnn_result": cnn.get("food") if cnn else None,
                "cnn_confidence": cnn.get("confidence") if cnn else None,
                "ensemble_result": ensemble,
                "decision_reason": decision_reason,
            })
    return {
        "model_name": "production_primary_local_resnet18_ensemble",
        "status": "candidate_not_product_validated",
        "manifest": str(manifest),
        "image_count": len(rows),
        "metrics": {
            "primary_alone": metrics(rows, "primary_result"),
            "cnn_alone": metrics(rows, "cnn_result"),
            "ensemble": metrics(rows, "ensemble_result"),
        },
        "provider_unavailable_images": sum(row["primary_result"] is None for row in rows),
        "rows": rows,
        "limitations": [
            "Only labels supplied by the manifest are evaluated; this is not a representative field study.",
            "Provider score and local-CNN score are not calibrated probabilities.",
            "Macro-F1 is label-level F1 on this small supplied set and is unstable when classes have one example.",
            "Do not make general accuracy claims until this is run on a representative, held-out phone-camera and non-food set.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--models-dir", type=Path, default=Path("backend/ml/models"))
    parser.add_argument("--output", type=Path, default=Path("backend/ml/evaluation/food_vision_ensemble_metrics.json"))
    parser.add_argument(
        "--request-interval-seconds",
        type=float,
        default=15.0,
        help="Delay between provider calls; 15 seconds respects Gemini's five-requests/minute free-tier limit.",
    )
    args = parser.parse_args()
    report = evaluate(args.manifest, args.models_dir, args.request_interval_seconds)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "rows"}, indent=2))


if __name__ == "__main__":
    main()
