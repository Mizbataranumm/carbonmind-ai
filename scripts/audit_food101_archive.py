"""Audit a Food-101 archive without extracting its image payload.

The official Food-101 split is held in meta/train.txt and meta/test.txt. This
script verifies that those labels resolve to image records in the archive and
writes a compact, reproducible dataset report for model-release evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True, help="Path to food-101.zip")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("backend/ml/evaluation/food101_dataset_audit.json"),
        help="Path for the JSON audit report",
    )
    return parser.parse_args()


def _read_lines(archive: zipfile.ZipFile, member: str) -> list[str]:
    return [line.strip() for line in archive.read(member).decode("utf-8").splitlines() if line.strip()]


def main() -> None:
    args = parse_args()
    if not args.archive.is_file():
        raise SystemExit(f"Archive not found: {args.archive}")

    with zipfile.ZipFile(args.archive) as archive:
        names = {info.filename for info in archive.infolist()}
        image_members = [
            name
            for name in names
            if name.startswith("food-101/food-101/images/") and name.lower().endswith((".jpg", ".jpeg", ".png"))
        ]
        class_counts = Counter(PurePosixPath(member).parts[-2] for member in image_members)
        train_labels = _read_lines(archive, "food-101/food-101/meta/train.txt")
        test_labels = _read_lines(archive, "food-101/food-101/meta/test.txt")
        train_members = {f"food-101/food-101/images/{label}.jpg" for label in train_labels}
        test_members = {f"food-101/food-101/images/{label}.jpg" for label in test_labels}

    name_digest = hashlib.sha256("\n".join(sorted(image_members)).encode("utf-8")).hexdigest()
    report = {
        "dataset": "Food-101 official archive",
        "archive": str(args.archive),
        "archive_bytes": args.archive.stat().st_size,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "image_member_list_sha256": name_digest,
        "image_count": len(image_members),
        "class_count": len(class_counts),
        "images_per_class": {"min": min(class_counts.values()), "max": max(class_counts.values())},
        "official_split": {
            "train_count": len(train_labels),
            "test_count": len(test_labels),
            "overlap_count": len(train_members & test_members),
            "missing_train_images": len(train_members - set(image_members)),
            "missing_test_images": len(test_members - set(image_members)),
        },
        "release_note": (
            "Dataset integrity only. This report does not measure a classifier. "
            "Use train_food101_transfer.py to generate held-out model metrics."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
