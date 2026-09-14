"""Train and evaluate a Food-101 ResNet-18 candidate from the official split.

The dataset may stay in its zip archive. This avoids a second 10 GB extraction,
but a full 101-class CPU run is intentionally slow. A small `--max-*-per-class`
run is useful only as a pipeline smoke test, never as a release-quality score.
"""

from __future__ import annotations

import argparse
import json
import random
import zipfile
from collections import Counter
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFile
from sklearn.metrics import f1_score
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision.models import ResNet18_Weights, resnet18
from torchvision.transforms import v2

ImageFile.LOAD_TRUNCATED_IMAGES = True
ARCHIVE_ROOT = "food-101/food-101"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--models-dir", type=Path, default=Path("backend/ml/models"))
    parser.add_argument("--metrics-dir", type=Path, default=Path("backend/ml/evaluation"))
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--num-workers", type=int, default=0, help="Keep zero when reading directly from a zip archive.")
    parser.add_argument("--max-train-per-class", type=int, default=0, help="0 means all 750 official training images per class.")
    parser.add_argument("--max-test-per-class", type=int, default=0, help="0 means all 250 official test images per class.")
    parser.add_argument("--finetune-backbone", action="store_true", help="Fine-tune all ResNet layers instead of only its classifier head.")
    parser.add_argument("--no-pretrained-weights", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def _read_lines(archive: zipfile.ZipFile, member: str) -> list[str]:
    return [line.strip() for line in archive.read(member).decode("utf-8").splitlines() if line.strip()]


class Food101ArchiveDataset(Dataset):
    def __init__(self, archive_path: Path, split: str, transform, max_per_class: int = 0):
        self.archive_path = archive_path
        self.transform = transform
        self._archive: zipfile.ZipFile | None = None
        with zipfile.ZipFile(archive_path) as archive:
            self.classes = _read_lines(archive, f"{ARCHIVE_ROOT}/meta/classes.txt")
            labels = _read_lines(archive, f"{ARCHIVE_ROOT}/meta/{split}.txt")
            members = set(archive.namelist())
        class_to_index = {name: index for index, name in enumerate(self.classes)}
        taken = Counter()
        self.samples: list[tuple[str, int]] = []
        for label in labels:
            class_name = label.split("/", 1)[0]
            if max_per_class and taken[class_name] >= max_per_class:
                continue
            member = f"{ARCHIVE_ROOT}/images/{label}.jpg"
            if member not in members:
                raise RuntimeError(f"Official split references a missing image: {member}")
            self.samples.append((member, class_to_index[class_name]))
            taken[class_name] += 1

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        if self._archive is None:
            self._archive = zipfile.ZipFile(self.archive_path)
        member, label = self.samples[index]
        with Image.open(BytesIO(self._archive.read(member))) as image:
            tensor = self.transform(image.convert("RGB"))
        return tensor, label


def _transforms():
    normalize = v2.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225))
    train = v2.Compose([
        v2.ToImage(),
        v2.RandomResizedCrop((224, 224), scale=(0.7, 1.0)),
        v2.RandomHorizontalFlip(),
        v2.ToDtype(torch.float32, scale=True),
        normalize,
    ])
    test = v2.Compose([
        v2.ToImage(),
        v2.Resize(256),
        v2.CenterCrop((224, 224)),
        v2.ToDtype(torch.float32, scale=True),
        normalize,
    ])
    return train, test


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> dict:
    model.eval()
    correct_top1 = correct_top3 = total = 0
    targets: list[int] = []
    predictions: list[int] = []
    confidences: list[float] = []
    correctness: list[bool] = []
    with torch.no_grad():
        for images, labels in loader:
            logits = model(images.to(device))
            probabilities = torch.softmax(logits, dim=1)
            top3 = probabilities.topk(k=3, dim=1).indices.cpu()
            predicted = top3[:, 0]
            labels_cpu = labels.cpu()
            correct = predicted.eq(labels_cpu)
            total += len(labels)
            correct_top1 += int(correct.sum())
            correct_top3 += int((top3 == labels_cpu.unsqueeze(1)).any(dim=1).sum())
            targets.extend(labels_cpu.tolist())
            predictions.extend(predicted.tolist())
            confidences.extend(probabilities.max(dim=1).values.cpu().tolist())
            correctness.extend(correct.tolist())

    bins = np.linspace(0.0, 1.0, 16)
    ece = 0.0
    confidence_array = np.asarray(confidences)
    correct_array = np.asarray(correctness, dtype=float)
    for lower, upper in zip(bins[:-1], bins[1:]):
        in_bin = (confidence_array >= lower) & (confidence_array < upper if upper < 1 else confidence_array <= upper)
        if in_bin.any():
            ece += abs(correct_array[in_bin].mean() - confidence_array[in_bin].mean()) * in_bin.mean()
    return {
        "test_examples": total,
        "top1_accuracy": round(correct_top1 / total, 5),
        "top3_accuracy": round(correct_top3 / total, 5),
        "macro_f1": round(float(f1_score(targets, predictions, average="macro", zero_division=0)), 5),
        "expected_calibration_error_15_bins": round(float(ece), 5),
    }


def main() -> None:
    args = parse_args()
    if not args.archive.is_file():
        raise SystemExit(f"Food-101 archive not found: {args.archive}")
    if args.max_train_per_class < 0 or args.max_test_per_class < 0:
        raise SystemExit("Per-class limits must be zero or positive.")

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    train_transform, test_transform = _transforms()
    train_data = Food101ArchiveDataset(args.archive, "train", train_transform, args.max_train_per_class)
    test_data = Food101ArchiveDataset(args.archive, "test", test_transform, args.max_test_per_class)
    if args.dry_run:
        print(json.dumps({
            "classes": len(train_data.classes),
            "train_examples": len(train_data),
            "test_examples": len(test_data),
            "archive": str(args.archive),
            "training_mode": "all_layers" if args.finetune_backbone else "classifier_head_only",
        }, indent=2))
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    weights = None if args.no_pretrained_weights else ResNet18_Weights.DEFAULT
    model = resnet18(weights=weights)
    if not args.finetune_backbone:
        for parameter in model.parameters():
            parameter.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, len(train_data.classes))
    model.to(device)
    train_loader = DataLoader(train_data, batch_size=args.batch_size, shuffle=True, num_workers=args.num_workers, pin_memory=device.type == "cuda")
    test_loader = DataLoader(test_data, batch_size=args.batch_size, shuffle=False, num_workers=args.num_workers, pin_memory=device.type == "cuda")
    optimizer = torch.optim.AdamW((parameter for parameter in model.parameters() if parameter.requires_grad), lr=args.learning_rate, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = examples = 0
        for images, labels in train_loader:
            optimizer.zero_grad(set_to_none=True)
            logits = model(images.to(device))
            loss = criterion(logits, labels.to(device))
            loss.backward()
            optimizer.step()
            running_loss += float(loss) * len(labels)
            examples += len(labels)
        print(f"epoch={epoch}/{args.epochs} train_loss={running_loss / max(examples, 1):.5f}")

    held_out_metrics = evaluate(model, test_loader, device)
    args.models_dir.mkdir(parents=True, exist_ok=True)
    args.metrics_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = args.models_dir / "food101_resnet18_candidate.pt"
    metadata_path = args.models_dir / "food101_resnet18_candidate_metadata.json"
    metrics_path = args.metrics_dir / "food101_resnet18_candidate_metrics.json"
    torch.save(model.cpu().state_dict(), artifact_path)
    metadata = {
        "architecture": "resnet18",
        "classes": train_data.classes,
        "num_classes": len(train_data.classes),
        "input_size": [224, 224],
        "normalization": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
        "artifact": str(artifact_path),
    }
    report = {
        "model_name": "food101_resnet18_transfer",
        "status": "candidate_not_yet_product_approved",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": str(args.archive),
        "split": "Food-101 official meta/train.txt and meta/test.txt",
        "training_examples": len(train_data),
        "test_examples": len(test_data),
        "epochs": args.epochs,
        "pretrained_imagenet_weights": not args.no_pretrained_weights,
        "finetuned_backbone": args.finetune_backbone,
        "device": str(device),
        "metrics": held_out_metrics,
        "artifact": str(artifact_path),
        "limitations": [
            "Food-101 does not measure real phone-camera performance, mixed plates, portions, or non-food rejection.",
            "A small per-class subset run is a smoke test and must not be published as a Food-101 score.",
            "Model confidence remains hidden until calibrated on a held-out real-world validation set.",
        ],
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    metrics_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
