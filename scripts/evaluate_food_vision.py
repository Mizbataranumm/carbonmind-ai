"""Evaluate food image recognition on a labeled image folder.

Expected dataset layout:

    dataset_root/
      food/
        biryani/*.jpg
        pizza/*.jpg
      non_food/
        people/*.jpg
        documents/*.jpg
        objects/*.jpg

The script writes metrics JSON for product review. It does not train a model.
Use it to measure a candidate food scanner before claiming accuracy.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Callable

from PIL import Image

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def iter_images(root: Path):
    for path in root.rglob("*"):
        if path.suffix.lower() in IMAGE_EXTENSIONS:
            label = path.parent.name
            group = path.parent.parent.name
            yield path, group, label


def placeholder_predictor(image_path: Path) -> dict:
    """Replace this with the exact production prediction call being evaluated."""
    with Image.open(image_path) as img:
        img.verify()
    return {
        "is_food": None,
        "top1": None,
        "top3": [],
        "confidence": None,
        "method": "placeholder_no_model_called",
    }


def evaluate(dataset_root: Path, predictor: Callable[[Path], dict]) -> dict:
    rows = []
    for path, group, label in iter_images(dataset_root):
        pred = predictor(path)
        expected_food = group == "food"
        predicted_food = pred.get("is_food")
        top1 = pred.get("top1")
        top3 = pred.get("top3") or []
        rows.append(
            {
                "path": str(path),
                "group": group,
                "label": label,
                "expected_food": expected_food,
                "predicted_food": predicted_food,
                "top1": top1,
                "top3": top3,
                "confidence": pred.get("confidence"),
                "method": pred.get("method"),
                "top1_correct": expected_food and top1 == label,
                "top3_correct": expected_food and label in top3,
                "false_accept_non_food": (not expected_food) and predicted_food is True,
                "false_reject_food": expected_food and predicted_food is False,
            }
        )

    food_rows = [row for row in rows if row["expected_food"]]
    non_food_rows = [row for row in rows if not row["expected_food"]]

    metrics = {
        "model_name": "food_vision_candidate",
        "status": "measurement_harness_ready_model_not_connected",
        "dataset_root": str(dataset_root),
        "image_count": len(rows),
        "food_image_count": len(food_rows),
        "non_food_image_count": len(non_food_rows),
        "metrics": {
            "top1_accuracy": None,
            "top3_accuracy": None,
            "non_food_false_accept_rate": None,
            "food_false_reject_rate": None,
        },
        "warnings": [
            "Connect placeholder_predictor to the exact production model before using these metrics.",
            "Confidence values must be calibrated on a held-out real-world set before being shown to users.",
        ],
        "rows": rows,
    }

    if food_rows:
        metrics["metrics"]["top1_accuracy"] = sum(row["top1_correct"] for row in food_rows) / len(food_rows)
        metrics["metrics"]["top3_accuracy"] = sum(row["top3_correct"] for row in food_rows) / len(food_rows)
        metrics["metrics"]["food_false_reject_rate"] = sum(row["false_reject_food"] for row in food_rows) / len(food_rows)
    if non_food_rows:
        metrics["metrics"]["non_food_false_accept_rate"] = sum(row["false_accept_non_food"] for row in non_food_rows) / len(non_food_rows)

    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", required=True)
    parser.add_argument("--output", default="backend/ml/evaluation/food_vision_baseline_metrics.json")
    args = parser.parse_args()

    metrics = evaluate(Path(args.dataset_root), placeholder_predictor)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in metrics.items() if k != "rows"}, indent=2))


if __name__ == "__main__":
    main()
