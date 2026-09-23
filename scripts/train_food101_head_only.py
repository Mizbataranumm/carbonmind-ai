"""P1-B/C: Head-only ResNet-18 training — CPU-feasible Food-101 experiment.

Protocol:
  - Freeze ResNet-18 backbone (ImageNet pretrained weights)
  - Train only the 512->101 FC classification head
  - Training set: official meta/train.txt, max 200 images/class (20,200 total)
  - Validation: subset of training images (held out, never used for training)
  - Final evaluation: official meta/test.txt, all 250/class (25,250 total)

This is scientifically valid because:
  - Training and test sets come from the official split (never mixed)
  - Head-only training is a legitimate transfer learning approach
  - The 200/class ceiling is disclosed as a compute constraint
  - The full official test set is used for evaluation (not subsampled)

CPU estimated time: 30-90 minutes depending on hardware.
"""

from __future__ import annotations

import argparse
import json
import random
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFile
from sklearn.metrics import f1_score, precision_score, recall_score
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision.models import ResNet18_Weights, resnet18
from torchvision.transforms import v2

ImageFile.LOAD_TRUNCATED_IMAGES = True
ARCHIVE_ROOT = "food-101/food-101"
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--archive", type=Path, required=True, help="Path to archive (8).zip")
    p.add_argument("--models-dir", type=Path, default=Path("backend/ml/models"))
    p.add_argument("--metrics-dir", type=Path, default=Path("backend/ml/evaluation"))
    p.add_argument("--epochs", type=int, default=10)
    p.add_argument("--batch-size", type=int, default=64)
    p.add_argument("--lr-head", type=float, default=1e-2, help="LR for head training")
    p.add_argument("--max-train-per-class", type=int, default=200,
                   help="Cap training images per class (0=all 750). Default=200 for CPU feasibility.")
    p.add_argument("--val-fraction", type=float, default=0.15,
                   help="Fraction of training samples held out for validation (not for tuning).")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--num-workers", type=int, default=0)
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


def _read_lines(archive: zipfile.ZipFile, member: str) -> list[str]:
    return [line.strip() for line in archive.read(member).decode("utf-8").splitlines() if line.strip()]


class Food101ArchiveDataset(Dataset):
    """Read Food-101 images directly from the zip archive without extraction."""

    def __init__(self, archive_path: Path, samples: list[tuple[str, int]], transform):
        self.archive_path = archive_path
        self.samples = samples
        self.transform = transform
        self._archive: zipfile.ZipFile | None = None

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        if self._archive is None:
            self._archive = zipfile.ZipFile(self.archive_path)
        member, label = self.samples[index]
        with Image.open(BytesIO(self._archive.read(member))) as img:
            tensor = self.transform(img.convert("RGB"))
        return tensor, label


def build_transforms():
    normalize = v2.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    train_tf = v2.Compose([
        v2.ToImage(),
        v2.RandomResizedCrop((224, 224), scale=(0.75, 1.0)),
        v2.RandomHorizontalFlip(),
        v2.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
        v2.ToDtype(torch.float32, scale=True),
        normalize,
    ])
    eval_tf = v2.Compose([
        v2.ToImage(),
        v2.Resize(256),
        v2.CenterCrop((224, 224)),
        v2.ToDtype(torch.float32, scale=True),
        normalize,
    ])
    return train_tf, eval_tf


def load_split(archive_path: Path, split: str, classes: list[str], max_per_class: int = 0,
               seed: int = 42) -> list[tuple[str, int]]:
    class_to_idx = {c: i for i, c in enumerate(classes)}
    with zipfile.ZipFile(archive_path) as z:
        labels = _read_lines(z, f"{ARCHIVE_ROOT}/meta/{split}.txt")
        members = set(z.namelist())
    rng = random.Random(seed)
    per_class: dict[str, list[str]] = defaultdict(list)
    for label in labels:
        cls = label.split("/")[0]
        member = f"{ARCHIVE_ROOT}/images/{label}.jpg"
        if member in members:
            per_class[cls].append(member)
    samples = []
    for cls, paths in per_class.items():
        rng.shuffle(paths)
        selected = paths[:max_per_class] if max_per_class > 0 else paths
        for member in selected:
            samples.append((member, class_to_idx[cls]))
    return samples


def evaluate_full(model: nn.Module, loader: DataLoader, device: torch.device,
                  num_classes: int) -> dict:
    model.eval()
    all_targets: list[int] = []
    all_preds: list[int] = []
    correct_top1 = correct_top5 = total = 0

    with torch.no_grad():
        for images, labels in loader:
            logits = model(images.to(device))
            top5 = logits.topk(5, dim=1).indices.cpu()
            pred_top1 = top5[:, 0]
            labels_cpu = labels.cpu()
            correct_top1 += int(pred_top1.eq(labels_cpu).sum())
            correct_top5 += int((top5 == labels_cpu.unsqueeze(1)).any(dim=1).sum())
            total += len(labels)
            all_targets.extend(labels_cpu.tolist())
            all_preds.extend(pred_top1.tolist())

    per_class_correct = [0] * num_classes
    per_class_total = [0] * num_classes
    for t, p in zip(all_targets, all_preds):
        per_class_total[t] += 1
        if t == p:
            per_class_correct[t] += 1
    per_class_acc = [
        round(per_class_correct[i] / per_class_total[i], 5) if per_class_total[i] > 0 else 0.0
        for i in range(num_classes)
    ]

    macro_f1 = float(f1_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_prec = float(precision_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_rec = float(recall_score(all_targets, all_preds, average="macro", zero_division=0))

    return {
        "total_samples": total,
        "top1_accuracy": round(correct_top1 / total, 5),
        "top5_accuracy": round(correct_top5 / total, 5),
        "macro_f1": round(macro_f1, 5),
        "macro_precision": round(macro_prec, 5),
        "macro_recall": round(macro_rec, 5),
        "per_class_accuracy": per_class_acc,
        "random_chance_top1": round(1 / num_classes, 5),
        "random_chance_top5": round(5 / num_classes, 5),
    }


def main() -> None:
    args = parse_args()
    if not args.archive.is_file():
        raise SystemExit(f"Archive not found: {args.archive}")

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    # Load class list from archive
    with zipfile.ZipFile(args.archive) as z:
        classes = _read_lines(z, f"{ARCHIVE_ROOT}/meta/classes.txt")
    num_classes = len(classes)
    print(f"Classes: {num_classes}")

    train_tf, eval_tf = build_transforms()

    print(f"Loading training split (max {args.max_train_per_class}/class)...")
    all_train_samples = load_split(args.archive, "train", classes, args.max_train_per_class, args.seed)
    print(f"  Total training samples: {len(all_train_samples)}")

    # Split off validation (stratified)
    per_class_samples: dict[int, list] = defaultdict(list)
    for sample in all_train_samples:
        per_class_samples[sample[1]].append(sample)
    rng = random.Random(args.seed + 1)
    train_samples, val_samples = [], []
    for cls_idx, samps in per_class_samples.items():
        rng.shuffle(samps)
        n_val = max(1, int(len(samps) * args.val_fraction))
        val_samples.extend(samps[:n_val])
        train_samples.extend(samps[n_val:])
    print(f"  Train: {len(train_samples)}, Val: {len(val_samples)}")

    print("Loading test split (full official, all 250/class)...")
    test_samples = load_split(args.archive, "test", classes, 0, args.seed)
    print(f"  Test samples: {len(test_samples)}")

    if args.dry_run:
        print(json.dumps({
            "dry_run": True, "num_classes": num_classes,
            "train": len(train_samples), "val": len(val_samples),
            "test": len(test_samples),
        }, indent=2))
        return

    train_ds = Food101ArchiveDataset(args.archive, train_samples, train_tf)
    val_ds = Food101ArchiveDataset(args.archive, val_samples, eval_tf)
    test_ds = Food101ArchiveDataset(args.archive, test_samples, eval_tf)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.num_workers, pin_memory=False)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                            num_workers=args.num_workers)
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False,
                             num_workers=args.num_workers)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Build model: ImageNet pretrained, frozen backbone, trainable head only
    model = resnet18(weights=ResNet18_Weights.DEFAULT)
    for param in model.parameters():
        param.requires_grad = False  # freeze backbone
    model.fc = nn.Linear(model.fc.in_features, num_classes)  # new head is trainable by default
    model.to(device)

    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Trainable params: {trainable_params:,} / {total_params:,} "
          f"({100 * trainable_params / total_params:.1f}% of model)")

    optimizer = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=args.lr_head,
        weight_decay=1e-3,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    best_val_acc = 0.0
    best_epoch = 0
    epoch_log = []

    args.models_dir.mkdir(parents=True, exist_ok=True)
    args.metrics_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = args.models_dir / "food101_head_only_best.pt"

    print(f"\nTraining for {args.epochs} epochs...")
    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = n_examples = n_correct = 0
        for images, labels in train_loader:
            optimizer.zero_grad(set_to_none=True)
            logits = model(images.to(device))
            loss = criterion(logits, labels.to(device))
            loss.backward()
            optimizer.step()
            running_loss += float(loss) * len(labels)
            n_examples += len(labels)
            n_correct += int(logits.cpu().argmax(1).eq(labels).sum())
        scheduler.step()

        # Validation
        model.eval()
        val_correct = val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                logits = model(images.to(device))
                val_correct += int(logits.cpu().argmax(1).eq(labels).sum())
                val_total += len(labels)
        val_acc = val_correct / max(val_total, 1)
        train_acc = n_correct / max(n_examples, 1)
        train_loss = running_loss / max(n_examples, 1)

        epoch_log.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 5),
            "train_acc": round(train_acc, 5),
            "val_acc": round(val_acc, 5),
            "lr": round(scheduler.get_last_lr()[0], 6),
        })
        print(f"  epoch={epoch}/{args.epochs} "
              f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
              f"val_acc={val_acc:.4f} lr={scheduler.get_last_lr()[0]:.6f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.cpu().state_dict(),
                "val_acc": val_acc,
                "classes": classes,
                "num_classes": num_classes,
                "training_mode": "head_only_frozen_backbone",
                "max_train_per_class": args.max_train_per_class,
            }, checkpoint_path)
            model.to(device)
            print(f"  [OK] Saved best checkpoint (val_acc={val_acc:.4f})")  # ASCII-safe: avoids UnicodeEncodeError on Windows cp1252

    # Load best checkpoint for final evaluation
    print(f"\nLoading best checkpoint (epoch {best_epoch}, val_acc={best_val_acc:.4f})...")
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(device)

    print("Running final evaluation on full official test set...")
    test_metrics = evaluate_full(model, test_loader, device, num_classes)

    print("\n" + "=" * 50)
    print("FINAL TEST RESULTS (Official Food-101 test split)")
    print("=" * 50)
    print(f"  Top-1 Accuracy: {test_metrics['top1_accuracy']:.4f} "
          f"(random={test_metrics['random_chance_top1']:.4f})")
    print(f"  Top-5 Accuracy: {test_metrics['top5_accuracy']:.4f} "
          f"(random={test_metrics['random_chance_top5']:.4f})")
    print(f"  Macro F1:       {test_metrics['macro_f1']:.4f}")
    print(f"  Macro Precision:{test_metrics['macro_precision']:.4f}")
    print(f"  Macro Recall:   {test_metrics['macro_recall']:.4f}")

    # Per-class analysis
    per_class = test_metrics["per_class_accuracy"]
    sorted_classes = sorted(zip(classes, per_class), key=lambda x: x[1])
    worst_10 = [(c, round(a, 4)) for c, a in sorted_classes[:10]]
    best_10 = [(c, round(a, 4)) for c, a in sorted_classes[-10:]]

    report = {
        "model_name": "food101_resnet18_head_only",
        "status": "candidate_not_yet_product_approved",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "training_config": {
            "architecture": "resnet18",
            "backbone": "frozen_imagenet_pretrained",
            "head": "trained_fc_512_to_101",
            "max_train_per_class": args.max_train_per_class,
            "training_images_used": len(train_samples),
            "val_images": len(val_samples),
            "test_images_official": len(test_samples),
            "epochs": args.epochs,
            "best_epoch": best_epoch,
            "best_val_acc": round(best_val_acc, 5),
            "lr_head": args.lr_head,
            "device": str(device),
        },
        "dataset": {
            "source": "Food-101 official split (meta/train.txt + meta/test.txt)",
            "num_classes": num_classes,
            "training_constraint": f"CPU-only; max {args.max_train_per_class}/class from official 750",
        },
        "test_metrics": test_metrics,
        "error_analysis": {
            "worst_10_classes": worst_10,
            "best_10_classes": best_10,
        },
        "epoch_log": epoch_log,
        "previous_baseline": {
            "top1_accuracy": 0.01089,
            "top5_accuracy": 0.05941,
            "macro_f1": 0.00172,
            "checkpoint": "cnn_food_model.pt",
            "note": "< 5 epochs training, CPU only",
        },
        "limitations": [
            "CPU-only training; max 200 images/class used (official split has 750/class).",
            "Frozen backbone: backbone features are ImageNet pretrained but not fine-tuned to food.",
            "Food-101 benchmark does not represent real-world mobile-camera food photos.",
            "Per-class accuracy on official test split only; no real-world phone-camera evaluation.",
        ],
        "checkpoint": str(checkpoint_path),
    }

    metrics_path = args.metrics_dir / "food101_head_only_metrics.json"
    metrics_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"\nReport saved to {metrics_path}")
    print(f"Checkpoint saved to {checkpoint_path}")


if __name__ == "__main__":
    main()
