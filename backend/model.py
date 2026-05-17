import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib

data = pd.read_csv("../data/data.csv")

X = data.drop("label", axis=1)
y = data["label"]

model = RandomForestClassifier(n_estimators=100)
model.fit(X, y)

joblib.dump(model, "../models/model.pkl")

print("Model trained!")
