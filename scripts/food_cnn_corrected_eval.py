"""Re-evaluate existing cnn_food_model.pt using the CORRECTED class order.

Bug found: metadata had cheesecake/cheese_plate swapped (indices 16/17).
This script uses the official Food-101 classes.txt order for evaluation,
so the results are now meaningful for all 101 classes.

Evaluates on 10 images/class from official test split = 1010 images.
(Same protocol as the previous evaluation for fair before/after comparison.)
"""
import json, zipfile, sys
from io import BytesIO
from pathlib import Path
from collections import defaultdict

import torch
from PIL import Image, ImageFile
from torchvision.models import resnet18
from torchvision.transforms import v2
from sklearn.metrics import f1_score, precision_score, recall_score

ImageFile.LOAD_TRUNCATED_IMAGES = True
ARCHIVE = Path("archive (8).zip")
CHECKPOINT = Path("backend/ml/models/cnn_food_model.pt")
ARCHIVE_ROOT = "food-101/food-101"
N_PER_CLASS = 10  # Same as original evaluation for fair comparison

# Load official class order
with zipfile.ZipFile(ARCHIVE) as z:
    official_classes = [
        l.strip() for l in z.read(f"{ARCHIVE_ROOT}/meta/classes.txt").decode().splitlines() if l.strip()
    ]
num_classes = len(official_classes)
class_to_idx = {c: i for i, c in enumerate(official_classes)}
print(f"Official classes: {num_classes}")

# Load model with official class order
raw = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
model = resnet18(weights=None)
model.fc = torch.nn.Linear(512, num_classes)
model.load_state_dict(raw, strict=False)
model.eval()

# Test-time transform (identical to previous evaluation)
tf = v2.Compose([
    v2.ToImage(), v2.Resize(256), v2.CenterCrop(224),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
])

# Sample N_PER_CLASS images per class from official test split
import random
random.seed(42)

with zipfile.ZipFile(ARCHIVE) as z:
    test_lines = [l.strip() for l in z.read(f"{ARCHIVE_ROOT}/meta/test.txt").decode().splitlines() if l.strip()]
    members = set(z.namelist())

per_class = defaultdict(list)
for label in test_lines:
    cls = label.split("/")[0]
    member = f"{ARCHIVE_ROOT}/images/{label}.jpg"
    if member in members:
        per_class[cls].append((member, label))

selected = []
for cls in official_classes:
    pool = per_class.get(cls, [])
    random.shuffle(pool)
    selected.extend(pool[:N_PER_CLASS])

print(f"Selected {len(selected)} test images ({N_PER_CLASS}/class)")

# Run evaluation
all_targets, all_preds = [], []
correct_top1 = correct_top5 = 0
per_class_correct = defaultdict(int)
per_class_total = defaultdict(int)

with zipfile.ZipFile(ARCHIVE) as z:
    for i, (member, label) in enumerate(selected):
        cls = label.split("/")[0]
        true_idx = class_to_idx[cls]
        img_bytes = z.read(member)
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        x = tf(img).unsqueeze(0)
        with torch.no_grad():
            logits = model(x)
            top5 = logits.topk(5, dim=1).indices[0].tolist()
        pred_top1 = top5[0]
        all_targets.append(true_idx)
        all_preds.append(pred_top1)
        per_class_total[cls] += 1
        if pred_top1 == true_idx:
            correct_top1 += 1
            per_class_correct[cls] += 1
        if true_idx in top5:
            correct_top5 += 1
        if (i + 1) % 200 == 0:
            print(f"  {i+1}/{len(selected)} evaluated...")

total = len(selected)
top1 = correct_top1 / total
top5 = correct_top5 / total
macro_f1 = float(f1_score(all_targets, all_preds, average="macro", zero_division=0))
macro_prec = float(precision_score(all_targets, all_preds, average="macro", zero_division=0))
macro_rec = float(recall_score(all_targets, all_preds, average="macro", zero_division=0))

print("\n" + "=" * 55)
print("RESULTS: Existing checkpoint + CORRECTED class order")
print("=" * 55)
print(f"  Top-1 Accuracy: {top1:.5f}  (random=0.00990)")
print(f"  Top-5 Accuracy: {top5:.5f}  (random=0.04950)")
print(f"  Macro F1:       {macro_f1:.5f}")
print(f"  Macro Precision:{macro_prec:.5f}")
print(f"  Macro Recall:   {macro_rec:.5f}")

# Per-class breakdown
per_class_acc = {c: round(per_class_correct[c]/per_class_total[c], 4)
                 for c in official_classes if per_class_total[c] > 0}
sorted_acc = sorted(per_class_acc.items(), key=lambda x: x[1])
print(f"\n  Worst 5 classes: {sorted_acc[:5]}")
print(f"  Best 5 classes:  {sorted_acc[-5:]}")

result = {
    "evaluation": "existing_checkpoint_corrected_class_order",
    "checkpoint": str(CHECKPOINT),
    "class_order": "official_food101_classes_txt",
    "bug_fixed": "cheesecake/cheese_plate swap at indices 16/17",
    "n_per_class": N_PER_CLASS,
    "total_samples": total,
    "metrics": {
        "top1_accuracy": round(top1, 5),
        "top5_accuracy": round(top5, 5),
        "macro_f1": round(macro_f1, 5),
        "macro_precision": round(macro_prec, 5),
        "macro_recall": round(macro_rec, 5),
        "random_chance_top1": 0.0099,
        "random_chance_top5": 0.0495,
    },
    "previous_evaluation": {
        "top1_accuracy": 0.01089,
        "top5_accuracy": 0.05941,
        "macro_f1": 0.00172,
        "note": "Used wrong class order (cheesecake/cheese_plate swapped)"
    },
    "worst_10_classes": sorted_acc[:10],
    "best_10_classes": sorted_acc[-10:],
    "per_class_accuracy": per_class_acc,
}
out = Path("backend/ml/evaluation/food_cnn_corrected_class_eval.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, indent=2))
print(f"\nSaved to {out}")
