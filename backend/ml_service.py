import torch
import torch.nn as nn
import torchvision.transforms as transforms
import pandas as pd
import numpy as np
import pickle
import json
import base64
from io import BytesIO
from PIL import Image

class CarbonLSTM(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(input_size=1, hidden_size=64, num_layers=2,
                             batch_first=True, dropout=0.2)
        self.fc = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 7)
        )
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])

import torchvision.models as models
def get_resnet_model(num_classes):
    model = models.resnet18()
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model

cnn_model = None
cnn_meta = None
gbdt_data = None
lstm_model = None
lstm_val_min = 0.0
lstm_val_max = 20.0

def load_models(models_dir="ml/models"):
    global cnn_model, cnn_meta, gbdt_data, lstm_model, lstm_val_min, lstm_val_max
    try:
        with open(f"{models_dir}/cnn_food_metadata.json", 'r') as f:
            cnn_meta = json.load(f)
        cnn_model = get_resnet_model(cnn_meta['num_classes'])
        cnn_model.load_state_dict(torch.load(f"{models_dir}/cnn_food_model.pt", map_location='cpu'))
        cnn_model.eval()
        print("✅ CNN model loaded!")
    except Exception as e:
        print(f"⚠️ CNN load failed: {e}")

    try:
        with open(f"{models_dir}/gbdt_carbon_model.pkl", 'rb') as f:
            gbdt_data = pickle.load(f)
        print("✅ GBDT model loaded!")
    except Exception as e:
        print(f"⚠️ GBDT load failed: {e}")

    try:
        lstm_path = f"{models_dir}/lstm_carbon_model.pt"
        checkpoint = torch.load(lstm_path, map_location='cpu')
        lstm_model = CarbonLSTM()
        lstm_model.load_state_dict(checkpoint['model_state_dict'])
        lstm_model.eval()
        lstm_val_min = checkpoint.get('val_min', 0.0)
        lstm_val_max = checkpoint.get('val_max', 20.0)
        print(f"✅ LSTM model loaded! (norm range: {lstm_val_min:.2f}–{lstm_val_max:.2f} kg/day)")
    except Exception as e:
        print(f"⚠️ LSTM load failed: {e}")


def predict_food(base64_image_str):
    if not cnn_model or not base64_image_str:
        return {"status": "error", "message": "Model not loaded or empty image", "confidence": 0}
    try:
        if "," in base64_image_str:
            base64_image_str = base64_image_str.split(",")[1]
        img_data = base64.b64decode(base64_image_str)
        img = Image.open(BytesIO(img_data)).convert('RGB')
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        tensor = transform(img).unsqueeze(0)
        with torch.no_grad():
            outputs = cnn_model(tensor)
            probabilities = torch.softmax(outputs, dim=1)[0]
            confidence = probabilities.max().item() * 100
            top_idx = probabilities.argmax().item()
            
        if confidence < 70:  # Industry standard threshold
            return {
                'status': 'rejected',
                'message': f'❌ Not clearly a food image. Confidence: {confidence:.1f}%',
                'suggestion': 'Take a clear photo with good lighting',
                'confidence': float(confidence)
            }
            
        class_name = cnn_meta['classes'][top_idx]
        co2 = cnn_meta['category_to_co2'].get(class_name, 1.5)
        return {
            "status": "success",
            "food_category": class_name,
            "co2_kg": co2,
            "confidence": float(confidence),
            "serving_size_g": 200
        }
    except Exception as e:
        print(f"CNN Error: {e}")
        return {"status": "error", "message": str(e), "confidence": 0}

def predict_gbdt(user_data_dict):
    if not gbdt_data:
        return None
    model = gbdt_data['model']
    encoders = gbdt_data['encoders']
    features = gbdt_data['features']
    input_data = {}
    for f in features:
        val = user_data_dict.get(f, 'None')
        if f in encoders:
            if str(val) in encoders[f].classes_:
                input_data[f] = encoders[f].transform([str(val)])[0]
            else:
                input_data[f] = 0
        else:
            try:
                input_data[f] = float(val)
            except:
                input_data[f] = 0.0
    df_in = pd.DataFrame([input_data])
    pred = model.predict(df_in)[0]
    return float(pred)

def predict_lstm(historical_30_days):
    """Takes 30 days of kg/day values, returns predicted next 7 days in kg/day."""
    if not lstm_model:
        return None  # graceful fallback
    if not isinstance(historical_30_days, list) or len(historical_30_days) != 30:
        # Log but don't crash — server will use fallback
        print(f"LSTM validation: expected 30 days, got {len(historical_30_days) if isinstance(historical_30_days, list) else type(historical_30_days)}")
        return None
    try:
        # Normalize input using training range
        arr = np.array(historical_30_days, dtype=np.float32)
        arr_norm = (arr - lstm_val_min) / (lstm_val_max - lstm_val_min)
        arr_norm = np.clip(arr_norm, 0.0, 1.5)
        tensor_in = torch.tensor(arr_norm, dtype=torch.float32).view(1, 30, 1)
        with torch.no_grad():
            preds_norm = lstm_model(tensor_in).squeeze().tolist()
        # Denormalize back to kg/day
        if isinstance(preds_norm, float):
            preds_norm = [preds_norm]
        preds_kg = [max(0.0, p * (lstm_val_max - lstm_val_min) + lstm_val_min) for p in preds_norm]
        return preds_kg
    except Exception as e:
        print(f"LSTM Error: {e}")
        return None

