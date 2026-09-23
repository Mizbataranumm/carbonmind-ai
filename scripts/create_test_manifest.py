import zipfile
import csv
import random
from pathlib import Path

ARCHIVE_PATH = Path("archive (8).zip")
ARCHIVE_ROOT = "food-101/food-101"
OUTPUT_DIR = Path("backend/ml/evaluation/test_images")
MANIFEST_PATH = Path("backend/ml/evaluation/test_manifest.csv")
NUM_SAMPLES = 20

def create_test_set():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    with zipfile.ZipFile(ARCHIVE_PATH) as z:
        # Load official test list
        test_lines = [l.strip() for l in z.read(f"{ARCHIVE_ROOT}/meta/test.txt").decode().splitlines() if l.strip()]
        
        # Sample randomly
        random.seed(42)
        sampled = random.sample(test_lines, NUM_SAMPLES)
        
        manifest_data = []
        for label_path in sampled:
            cls = label_path.split("/")[0]
            member = f"{ARCHIVE_ROOT}/images/{label_path}.jpg"
            out_name = f"{label_path.replace('/', '_')}.jpg"
            out_file = OUTPUT_DIR / out_name
            
            # Extract
            with z.open(member) as source, open(out_file, "wb") as target:
                target.write(source.read())
                
            manifest_data.append({"path": str(out_file.absolute()), "label": cls})
            
    with open(MANIFEST_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["path", "label"])
        writer.writeheader()
        writer.writerows(manifest_data)
        
    print(f"Created {MANIFEST_PATH} with {len(manifest_data)} images.")

if __name__ == "__main__":
    create_test_set()
