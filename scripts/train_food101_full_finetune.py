"""P1-Full: ResNet-18 Full Fine-Tuning experiment on the complete Food-101 dataset.

Protocol:
  - ResNet-18 ImageNet pretrained backbone (weights=ResNet18_Weights.DEFAULT)
  - Full model unfrozen (all 11.2M parameters trained)
  - Differential learning rates:
      backbone lr: 1e-4
      head (fc) lr: 1e-3
  - Optimizer: AdamW(weight_decay=1e-2)
  - Scheduler: CosineAnnealingLR
  - Loss: CrossEntropyLoss(label_smoothing=0.1)
  - Training set: complete official meta/train.txt (750 images/class, 75,750 total)
  - Validation: 10% stratified holdout from training set (7,575 images)
  - Test set: official meta/test.txt (25,250 images) - untouched until final evaluation
  - Model selection: strictly based on best validation Top-1 accuracy (NOT test set)
  - Final evaluation: evaluated ONCE on the official 25,250 test set using best checkpoint
"""

from __future__ import annotations

import argparse
import json
import random
import time
import zipfile
from collections import defaultdict
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
    p.add_argument("--archive", type=Path, default=Path("archive (8).zip"),
                   help="Path to Food-101 zip archive")
    p.add_argument("--models-dir", type=Path, default=Path("backend/ml/models"))
    p.add_argument("--metrics-dir", type=Path, default=Path("backend/ml/evaluation"))
    p.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    p.add_argument("--batch-size", type=int, default=64, help="Batch size (default 64)")
    p.add_argument("--lr-backbone", type=float, default=1e-4, help="Learning rate for backbone")
    p.add_argument("--lr-head", type=float, default=1e-3, help="Learning rate for classification head")
    p.add_argument("--weight-decay", type=float, default=1e-2, help="AdamW weight decay")
    p.add_argument("--val-fraction", type=float, default=0.10,
                   help="Stratified validation fraction derived from training set (default 0.10 = 7,575 images)")
    p.add_argument("--max-train-per-class", type=int, default=0,
                   help="Cap training images per class (0=all 750). Default=0 for full dataset.")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--num-workers", type=int, default=0, help="DataLoader num_workers (0 for Windows compatibility)")
    p.add_argument("--device", type=str, default="", help="cuda or cpu (auto-detected if empty)")
    p.add_argument("--dry-run", action="store_true", help="Run 1-batch dry-run verification and exit")
    return p.parse_args()


def _read_lines(archive: zipfile.ZipFile, member: str) -> list[str]:
    return [line.strip() for line in archive.read(member).decode("utf-8").splitlines() if line.strip()]


class Food101ArchiveDataset(Dataset):
    """Read Food-101 images directly from zip archive."""

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
        v2.RandomResizedCrop((224, 224), scale=(0.6, 1.0)),
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
    for cls in classes:
        paths = per_class.get(cls, [])
        rng.shuffle(paths)
        selected = paths[:max_per_class] if max_per_class > 0 else paths
        for member in selected:
            samples.append((member, class_to_idx[cls]))
    return samples


def evaluate_split(model: nn.Module, loader: DataLoader, criterion: nn.Module,
                   device: torch.device, use_amp: bool) -> tuple[float, float, float]:
    model.eval()
    total_loss = 0.0
    correct_top1 = 0
    correct_top5 = 0
    total_samples = 0

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)
            with torch.amp.autocast("cuda", enabled=use_amp):
                logits = model(images)
                loss = criterion(logits, labels)
            total_loss += float(loss) * len(labels)
            top5 = logits.topk(5, dim=1).indices
            correct_top1 += int(top5[:, 0].eq(labels).sum())
            correct_top5 += int((top5 == labels.unsqueeze(1)).any(dim=1).sum())
            total_samples += len(labels)

    avg_loss = total_loss / max(total_samples, 1)
    top1_acc = correct_top1 / max(total_samples, 1)
    top5_acc = correct_top5 / max(total_samples, 1)
    return avg_loss, top1_acc, top5_acc


def evaluate_full_metrics(model: nn.Module, loader: DataLoader, device: torch.device,
                          num_classes: int, use_amp: bool) -> dict:
    model.eval()
    all_targets: list[int] = []
    all_preds: list[int] = []
    correct_top1 = 0
    correct_top5 = 0
    total = 0

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device, non_blocking=True)
            with torch.amp.autocast("cuda", enabled=use_amp):
                logits = model(images)
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

    # Determine device
    if args.device:
        device = torch.device(args.device)
    else:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_amp = (device.type == "cuda")
    print(f"Device: {device} (Name: {torch.cuda.get_device_name(0) if device.type == 'cuda' else 'CPU'})")
    print(f"Automatic Mixed Precision (AMP): {use_amp}")

    # Load official classes
    with zipfile.ZipFile(args.archive) as z:
        classes = _read_lines(z, f"{ARCHIVE_ROOT}/meta/classes.txt")
    num_classes = len(classes)
    print(f"Classes: {num_classes}")

    train_tf, eval_tf = build_transforms()

    # Load complete training split
    print(f"Loading training split (max {args.max_train_per_class}/class, 0=all 750)...")
    all_train_samples = load_split(args.archive, "train", classes, args.max_train_per_class, args.seed)
    print(f"  Total raw training samples: {len(all_train_samples)}")

    # Stratified validation split derived strictly from training data
    per_class_samples: dict[int, list] = defaultdict(list)
    for sample in all_train_samples:
        per_class_samples[sample[1]].append(sample)
    rng = random.Random(args.seed + 1)
    train_samples, val_samples = [], []
    for cls_idx in range(num_classes):
        samps = list(per_class_samples.get(cls_idx, []))
        rng.shuffle(samps)
        n_val = max(1, int(len(samps) * args.val_fraction))
        val_samples.extend(samps[:n_val])
        train_samples.extend(samps[n_val:])
    print(f"  Train split: {len(train_samples)}, Val split: {len(val_samples)}")

    # Untouched test split (only loaded, never touched during training)
    print("Loading official test split (25,250 samples)...")
    test_samples = load_split(args.archive, "test", classes, 0, args.seed)
    print(f"  Test split: {len(test_samples)}")

    train_ds = Food101ArchiveDataset(args.archive, train_samples, train_tf)
    val_ds = Food101ArchiveDataset(args.archive, val_samples, eval_tf)
    test_ds = Food101ArchiveDataset(args.archive, test_samples, eval_tf)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.num_workers, pin_memory=(device.type == "cuda"))
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                            num_workers=args.num_workers, pin_memory=(device.type == "cuda"))
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False,
                             num_workers=args.num_workers, pin_memory=(device.type == "cuda"))

    # Build model: Pretrained ResNet-18 with fully unfrozen backbone
    model = resnet18(weights=ResNet18_Weights.DEFAULT)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    for p in model.parameters():
        p.requires_grad = True  # fully unfrozen
    model.to(device)

    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Trainable params: {trainable_params:,} / {total_params:,} (100.0% of model unfrozen)")

    # Differential learning rates: backbone lr=1e-4, head lr=1e-3
    backbone_params = [p for n, p in model.named_parameters() if not n.startswith("fc.")]
    head_params = [p for n, p in model.named_parameters() if n.startswith("fc.")]
    optimizer = torch.optim.AdamW([
        {"params": backbone_params, "lr": args.lr_backbone, "weight_decay": args.weight_decay},
        {"params": head_params, "lr": args.lr_head, "weight_decay": args.weight_decay},
    ])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    if args.dry_run:
        print("\n=== DRY RUN VERIFICATION ===")
        sample_img, sample_lbl = next(iter(train_loader))
        print(f"Batch shape: {sample_img.shape}, Labels shape: {sample_lbl.shape}")
        with torch.amp.autocast("cuda", enabled=use_amp):
            out = model(sample_img.to(device))
            loss = criterion(out, sample_lbl.to(device))
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        print(f"Forward + backward pass verified. Loss: {loss.item():.4f}")
        print("Dry run passed successfully.")
        return

    best_val_top1 = 0.0
    best_epoch = 0
    epoch_logs = []

    args.models_dir.mkdir(parents=True, exist_ok=True)
    args.metrics_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = args.models_dir / "food101_full_finetune_best.pt"

    start_training_time = time.time()
    print(f"\nStarting Full Fine-Tuning for {args.epochs} epochs...")
    print(f"Backbone LR: {args.lr_backbone}, Head LR: {args.lr_head}, Batch Size: {args.batch_size}")

    for epoch in range(1, args.epochs + 1):
        epoch_start = time.time()
        model.train()
        running_loss = 0.0
        n_examples = 0
        n_correct = 0

        for batch_idx, (images, labels) in enumerate(train_loader, 1):
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast("cuda", enabled=use_amp):
                logits = model(images)
                loss = criterion(logits, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            batch_size_cur = len(labels)
            running_loss += float(loss) * batch_size_cur
            n_examples += batch_size_cur
            n_correct += int(logits.argmax(1).eq(labels).sum())

            if batch_idx % 250 == 0 or batch_idx == len(train_loader):
                print(f"  [Epoch {epoch}/{args.epochs}] Batch {batch_idx}/{len(train_loader)} "
                      f"Train Loss: {running_loss/n_examples:.4f} "
                      f"Train Acc: {n_correct/n_examples:.4f}")

        scheduler.step()

        # Validation step
        val_loss, val_top1, val_top5 = evaluate_split(model, val_loader, criterion, device, use_amp)
        train_loss = running_loss / max(n_examples, 1)
        train_acc = n_correct / max(n_examples, 1)
        epoch_duration = time.time() - epoch_start
        lr_bb = optimizer.param_groups[0]["lr"]
        lr_hd = optimizer.param_groups[1]["lr"]

        log_entry = {
            "epoch": epoch,
            "train_loss": round(train_loss, 5),
            "train_acc": round(train_acc, 5),
            "val_loss": round(val_loss, 5),
            "val_top1": round(val_top1, 5),
            "val_top5": round(val_top5, 5),
            "lr_backbone": round(lr_bb, 7),
            "lr_head": round(lr_hd, 6),
            "epoch_duration_sec": round(epoch_duration, 1),
        }
        epoch_logs.append(log_entry)

        print(f"\n--- Epoch {epoch}/{args.epochs} ({epoch_duration:.1f}s) ---")
        print(f"  Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f}")
        print(f"  Val Loss:   {val_loss:.4f} | Val Top-1:   {val_top1:.4f} | Val Top-5: {val_top5:.4f}")
        print(f"  LR (Backbone): {lr_bb:.6f} | LR (Head): {lr_hd:.6f}")

        # Model selection: strictly by validation Top-1 accuracy
        if val_top1 > best_val_top1:
            best_val_top1 = val_top1
            best_epoch = epoch
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.cpu().state_dict(),
                "val_acc": val_top1,
                "val_top5": val_top5,
                "val_loss": val_loss,
                "classes": classes,
                "num_classes": num_classes,
                "training_mode": "full_fine_tuning_unfrozen",
                "backbone": "resnet18",
                "optimizer": "adamw",
                "lr_backbone": args.lr_backbone,
                "lr_head": args.lr_head,
                "batch_size": args.batch_size,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }, checkpoint_path)
            model.to(device)
            print(f"  [OK] Saved new best checkpoint -> {checkpoint_path} (Val Top-1: {val_top1:.4f})\n")
        else:
            print(f"  (Best Val Top-1 remains {best_val_top1:.4f} at epoch {best_epoch})\n")

    total_training_sec = time.time() - start_training_time
    print(f"\nTraining complete in {total_training_sec/60:.1f} minutes.")
    print(f"Best validation epoch: {best_epoch} (Val Top-1: {best_val_top1:.4f})")

    # Load best checkpoint for ONE-TIME final evaluation on official test split
    print(f"\nLoading best checkpoint from epoch {best_epoch} for official test evaluation...")
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(device)

    print("Evaluating ONCE on official Food-101 test set (25,250 samples)...")
    test_metrics = evaluate_full_metrics(model, test_loader, device, num_classes, use_amp)

    print("\n" + "=" * 60)
    print("FINAL OFFICIAL TEST RESULTS (Food-101 Full Fine-Tuning ResNet-18)")
    print("=" * 60)
    print(f"  Top-1 Accuracy:  {test_metrics['top1_accuracy']:.4f} (Baseline was 0.5255)")
    print(f"  Top-5 Accuracy:  {test_metrics['top5_accuracy']:.4f} (Baseline was 0.7828)")
    print(f"  Macro F1:        {test_metrics['macro_f1']:.4f} (Baseline was 0.5215)")
    print(f"  Macro Precision: {test_metrics['macro_precision']:.4f}")
    print(f"  Macro Recall:    {test_metrics['macro_recall']:.4f}")
    delta_top1 = test_metrics["top1_accuracy"] - 0.5255
    print(f"  Absolute Delta vs Baseline: {delta_top1:+.4f} ({delta_top1*100:+.2f} percentage points)")
    print("=" * 60)

    # Save comprehensive evaluation metrics JSON
    metrics_path = args.metrics_dir / "food101_full_finetune_metrics.json"
    full_report = {
        "model": "resnet18_full_finetune",
        "training_mode": "full_fine_tuning_unfrozen",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "device": str(device),
        "device_name": torch.cuda.get_device_name(0) if device.type == "cuda" else "CPU",
        "epochs_trained": args.epochs,
        "best_epoch": best_epoch,
        "best_val_top1": round(best_val_top1, 5),
        "total_training_minutes": round(total_training_sec / 60, 2),
        "baseline_metrics": {
            "top1_accuracy": 0.5255,
            "top5_accuracy": 0.7828,
            "macro_f1": 0.5215,
        },
        "official_test_metrics": test_metrics,
        "delta_vs_baseline": {
            "top1_accuracy": round(delta_top1, 5),
            "top5_accuracy": round(test_metrics["top5_accuracy"] - 0.7828, 5),
            "macro_f1": round(test_metrics["macro_f1"] - 0.5215, 5),
        },
        "training_progression": epoch_logs,
    }
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(full_report, f, indent=2)
    print(f"\nFull metrics report saved to: {metrics_path}")


if __name__ == "__main__":
    main()
