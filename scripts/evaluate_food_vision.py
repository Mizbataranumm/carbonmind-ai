"""Evaluate the production food-primary, local-CNN, and decision-rule paths.

The manifest is a CSV with ``path,label`` columns. ``label`` must be the dish
shown in the file, not a filename guess. This script records unavailable remote
primary calls separately so an outage is never converted into fake accuracy.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

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


def accuracy(rows: list[dict], field: str, *, include_unavailable: bool = False) -> dict:
    eligible = [row for row in rows if include_unavailable or row[field] is not None]
    if not eligible:
        return {"evaluated_images": 0, "top1_accuracy": None}
    return {
        "evaluated_images": len(eligible),
        "top1_accuracy": round(sum(key(row[field]) == key(row["label"]) for row in eligible) / len(eligible), 5),
    }


def evaluate(manifest: Path, models_dir: Path) -> dict:
    ml_service.load_models(str(models_dir))
    rows: list[dict] = []
    with manifest.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not {"path", "label"}.issubset(reader.fieldnames):
            raise ValueError("Manifest must contain path,label columns.")
        for source_row in reader:
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
            "primary_alone": accuracy(rows, "primary_result"),
            "cnn_alone": accuracy(rows, "cnn_result"),
            "ensemble": accuracy(rows, "ensemble_result"),
        },
        "provider_unavailable_images": sum(row["primary_result"] is None for row in rows),
        "rows": rows,
        "limitations": [
            "Only labels supplied by the manifest are evaluated.",
            "Provider score and local-CNN score are not calibrated probabilities.",
            "Do not make accuracy claims until this is run on a representative, held-out phone-camera and non-food set.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--models-dir", type=Path, default=Path("backend/ml/models"))
    parser.add_argument("--output", type=Path, default=Path("backend/ml/evaluation/food_vision_ensemble_metrics.json"))
    args = parser.parse_args()
    report = evaluate(args.manifest, args.models_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "rows"}, indent=2))


if __name__ == "__main__":
    main()
