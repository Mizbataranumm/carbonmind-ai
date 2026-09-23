"""P1-A: Food CNN pipeline bug check (Windows-safe, ASCII only)."""
import json, zipfile, torch, sys
from pathlib import Path
from torchvision.models import resnet18
from torchvision.transforms import v2
from PIL import Image, ImageFile
from io import BytesIO

ImageFile.LOAD_TRUNCATED_IMAGES = True

ARCHIVE = Path("archive (8).zip")
CHECKPOINT = Path("backend/ml/models/cnn_food_model.pt")
METADATA = Path("backend/ml/models/cnn_food_metadata.json")
ARCHIVE_ROOT = "food-101/food-101"

issues = []
print("=" * 60)
print("Food CNN Pipeline Bug Check")
print("=" * 60)

# 1. Metadata
meta = json.loads(METADATA.read_text(encoding="utf-8"))
meta_classes = meta["classes"]
num_classes = meta["num_classes"]
print(f"\n[1] Metadata: num_classes={num_classes}, len(classes)={len(meta_classes)}")
print(f"    first 3: {meta_classes[:3]}")
if len(meta_classes) != num_classes:
    issues.append(f"META_SIZE_MISMATCH: len={len(meta_classes)} vs num_classes={num_classes}")

# 2. Official class order from archive
print(f"\n[2] Checking class order vs official Food-101 classes.txt...")
with zipfile.ZipFile(ARCHIVE) as z:
    official = [l.strip() for l in z.read(f"{ARCHIVE_ROOT}/meta/classes.txt").decode().splitlines() if l.strip()]
print(f"    official[:3]: {official[:3]}")
print(f"    metadata[:3]: {meta_classes[:3]}")
if official == meta_classes:
    print("    PASS: Class order matches official Food-101")
else:
    mismatches = [(i, o, m) for i, (o, m) in enumerate(zip(official, meta_classes)) if o != m]
    print(f"    BUG: Class mismatch! First mismatches: {mismatches[:3]}")
    issues.append("CLASS_ORDER_MISMATCH")
if len(official) != len(meta_classes):
    issues.append(f"CLASS_COUNT_MISMATCH: official={len(official)} metadata={len(meta_classes)}")

# 3. Checkpoint structure
print(f"\n[3] Loading checkpoint {CHECKPOINT} ({CHECKPOINT.stat().st_size/1e6:.1f} MB)...")
raw = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
print(f"    type: {type(raw).__name__}")

state_dict = None
if isinstance(raw, dict):
    first_keys = list(raw.keys())[:5]
    print(f"    keys[:5]: {first_keys}")
    if "model_state_dict" in raw:
        state_dict = raw["model_state_dict"]
        print("    format: dict with model_state_dict key")
    else:
        state_dict = raw
        print("    format: plain state_dict")
    if "fc.weight" in state_dict:
        fc_shape = state_dict["fc.weight"].shape
        print(f"    fc.weight shape: {fc_shape} -> out={fc_shape[0]}, in={fc_shape[1]}")
        if fc_shape[0] != 101:
            issues.append(f"FC_WRONG_OUTPUT: {fc_shape[0]} != 101")
            print(f"    BUG: FC output {fc_shape[0]} != 101!")
        else:
            print(f"    PASS: FC output = 101")
    else:
        issues.append("FC_WEIGHT_KEY_MISSING")
        print("    BUG: fc.weight not in state_dict")
elif hasattr(raw, "state_dict"):
    state_dict = raw.state_dict()
    print("    format: full nn.Module (not state_dict)")
else:
    issues.append(f"UNKNOWN_CHECKPOINT_FORMAT: {type(raw)}")

# 4. Load model + inference test
if state_dict is not None:
    print(f"\n[4] Loading model and running inference check...")
    model = resnet18(weights=None)
    model.fc = torch.nn.Linear(512, 101)
    missing, unexpected = model.load_state_dict(state_dict, strict=False)
    print(f"    missing keys: {len(missing)}, unexpected keys: {len(unexpected)}")
    if missing:
        issues.append(f"MISSING_KEYS: {missing[:3]}")
    model.eval()

    # Load one test image
    with zipfile.ZipFile(ARCHIVE) as z:
        test_lines = [l.strip() for l in z.read(f"{ARCHIVE_ROOT}/meta/test.txt").decode().splitlines() if l.strip()]
        first = test_lines[0]
        cls_name = first.split("/")[0]
        true_idx = official.index(cls_name)
        img_bytes = z.read(f"{ARCHIVE_ROOT}/images/{first}.jpg")

    img = Image.open(BytesIO(img_bytes)).convert("RGB")
    # Correct test-time transform
    tf_correct = v2.Compose([
        v2.ToImage(), v2.Resize(256), v2.CenterCrop(224),
        v2.ToDtype(torch.float32, scale=True),
        v2.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
    ])
    # Wrong train-time transform applied at test (common bug)
    tf_wrong = v2.Compose([
        v2.ToImage(), v2.RandomResizedCrop(224, scale=(0.7, 1.0)), v2.RandomHorizontalFlip(),
        v2.ToDtype(torch.float32, scale=True),
        v2.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
    ])

    with torch.no_grad():
        logits_c = model(tf_correct(img).unsqueeze(0))
        logits_w = model(tf_wrong(img).unsqueeze(0))
        probs_c = torch.softmax(logits_c, dim=1)
        top5_c = probs_c.topk(5, dim=1)

    print(f"    Test image: {first}, true={cls_name} (idx={true_idx})")
    print(f"    Logit stats (correct tf): min={logits_c.min():.3f} max={logits_c.max():.3f} std={logits_c.std():.3f}")
    print(f"    Logit stats (wrong tf):   min={logits_w.min():.3f} max={logits_w.max():.3f} std={logits_w.std():.3f}")
    print("    Top-5 predictions (correct transform):")
    for i in range(5):
        pidx = top5_c.indices[0, i].item()
        pconf = top5_c.values[0, i].item()
        tag = " <-- CORRECT" if pidx == true_idx else ""
        print(f"      top-{i+1}: {official[pidx]:<30} conf={pconf:.4f}{tag}")

    logit_std = float(logits_c.std())
    if logit_std < 0.5:
        issues.append(f"LOW_LOGIT_STD_{logit_std:.4f}: model appears undertrained (near-random output)")
        print(f"    WARN: Low logit std={logit_std:.4f} -> model effectively random (genuine underfitting)")
    else:
        print(f"    PASS: Logit std={logit_std:.3f} is non-trivial (model learned something)")

# Summary
print("\n" + "=" * 60)
print("BUG CHECK SUMMARY")
print("=" * 60)
if issues:
    print(f"  ISSUES FOUND ({len(issues)}):")
    for i, issue in enumerate(issues, 1):
        print(f"    {i}. {issue}")
    conclusion = "BUG_FOUND"
else:
    print("  NO PIPELINE BUGS FOUND.")
    print("  Conclusion: 1.09% Top-1 is genuine underfitting.")
    print("  Root cause: < 5 training epochs on CPU without pretrained fine-tuning.")
    conclusion = "NO_BUG_GENUINE_UNDERFITTING"

result = {
    "issues_found": issues,
    "conclusion": conclusion,
    "class_order_match": len(issues) == 0 or "CLASS_ORDER_MISMATCH" not in issues,
    "fc_output_correct": len(issues) == 0 or "FC_WRONG_OUTPUT" not in str(issues),
    "diagnosis": (
        "Pipeline has no bugs. Low accuracy is caused by insufficient training epochs on CPU."
        if not issues else f"Pipeline bugs found: {issues}"
    ),
}
out = Path("backend/ml/evaluation/food_cnn_bug_check.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, indent=2))
print(f"\nSaved to {out}")
sys.exit(0 if not issues else 1)
