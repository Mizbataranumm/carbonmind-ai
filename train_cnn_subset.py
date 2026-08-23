import torch
import torch.nn as nn
import torchvision.transforms as transforms
from torchvision.datasets import ImageFolder
from torchvision.models import resnet18
from torch.utils.data import DataLoader, Subset
import json
import os
import random

FOOD101_PATH = "D:/carbonmind-ai/food-101/images"
BATCH_SIZE = 16
EPOCHS = 1
LEARNING_RATE = 0.001
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"Using device: {DEVICE}")

food_carbon_data = {
    'apple': 0.19, 'banana': 0.21, 'beef_burger': 9.3, 'chicken_curry': 2.1,
    'pizza': 3.6, 'salad': 0.3, 'sushi': 1.5, 'steak': 12.4
}

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

try:
    full_dataset = ImageFolder(FOOD101_PATH, transform=transform)
    print(f"Loaded {len(full_dataset)} images from Food-101.")
    
    indices = random.sample(range(len(full_dataset)), min(500, len(full_dataset)))
    dataset = Subset(full_dataset, indices)
    
    train_size = int(0.8 * len(dataset))
    test_size = len(dataset) - train_size
    train_dataset, test_dataset = torch.utils.data.random_split(dataset, [train_size, test_size])
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)
except Exception as e:
    print(f"Error loading dataset: {e}")
    exit(1)

num_classes = len(full_dataset.classes)
model = resnet18(pretrained=True)
model.fc = nn.Linear(model.fc.in_features, num_classes)
model = model.to(DEVICE)

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

print("Starting CNN training (Fast Subset Mode)...")
model.train()
for epoch in range(EPOCHS):
    for i, (images, labels) in enumerate(train_loader):
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        if i % 5 == 0:
            print(f"Batch {i}/{len(train_loader)} - Loss: {loss.item():.4f}")
            
print("Evaluating CNN...")
model.eval()
correct = 0
total = 0
with torch.no_grad():
    for images, labels in test_loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        outputs = model(images)
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()

accuracy = 100. * correct / total
print(f"Validation Accuracy on subset: {accuracy:.2f}%")

os.makedirs('D:/carbonmind-ai/backend/ml/models', exist_ok=True)
torch.save(model.state_dict(), 'D:/carbonmind-ai/backend/ml/models/cnn_food_model.pt')

metadata = {
    'classes': full_dataset.classes,
    'category_to_co2': food_carbon_data,
    'num_classes': num_classes,
    'best_accuracy': accuracy,
    'model_type': 'ResNet18'
}
with open('D:/carbonmind-ai/backend/ml/models/cnn_food_metadata.json', 'w') as f:
    json.dump(metadata, f)

print("\nCNN Model saved successfully!")
