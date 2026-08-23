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
        self.lstm = nn.LSTM(1, 32, batch_first=True)
        self.fc = nn.Linear(32, 7)
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

def load_models(models_dir="ml/models"):
    global cnn_model, cnn_meta, gbdt_data, lstm_model
    try:
        with open(f"{models_dir}/cnn_food_metadata.json", 'r') as f:
            cnn_meta = json.load(f)
        cnn_model = get_resnet_model(cnn_meta['num_classes'])
        cnn_model.load_state_dict(torch.load(f"{models_dir}/cnn_food_model.pt", map_location='cpu'))
        cnn_model.eval()

        with open(f"{models_dir}/gbdt_carbon_model.pkl", 'rb') as f:
            gbdt_data = pickle.load(f)

        lstm_model = CarbonLSTM()
        lstm_model.load_state_dict(torch.load(f"{models_dir}/lstm_carbon_model.pt", map_location='cpu'))
        lstm_model.eval()
        print("✅ ML Models loaded successfully!")
    except Exception as e:
        print(f"⚠️ Warning: Could not load ML models: {e}")

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
            
        if confidence < 65:
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
    if not lstm_model or len(historical_30_days) != 30:
        return None
    try:
        tensor_in = torch.tensor(historical_30_days, dtype=torch.float32).view(1, 30, 1)
        with torch.no_grad():
            preds = lstm_model(tensor_in)
        return preds.squeeze().tolist()
    except Exception as e:
        print(f"LSTM Error: {e}")
        return None
