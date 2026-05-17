from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import requests
import threading

app = Flask(__name__)
CORS(app)

model = joblib.load("../models/model.pkl")


# 🌦 WEATHER API (FIXED)
def get_weather(lat, lon):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=relativehumidity_2m,precipitation&current_weather=true"

    try:
        res = requests.get(url, timeout=5)
        data = res.json()

        current_time = data["current_weather"]["time"]

        if current_time in data["hourly"]["time"]:
            idx = data["hourly"]["time"].index(current_time)
        else:
            idx = 0

        rainfall = max(data["hourly"]["precipitation"][max(0, idx-2):idx+1])

        return {
            "temperature": data["current_weather"]["temperature"],
            "wind_speed": data["current_weather"]["windspeed"],
            "humidity": data["hourly"]["relativehumidity_2m"][idx],
            "rainfall": rainfall
        }

    except Exception as e:
        print("Weather API error:", e)
        return {
            "temperature": 30,
            "wind_speed": 5,
            "humidity": 50,
            "rainfall": 0
        }


# 🌍 EARTHQUAKE API
def get_seismic(lat, lon):
    url = f"https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude={lat}&longitude={lon}&maxradiuskm=100"

    try:
        res = requests.get(url, timeout=5)
        data = res.json()

        if len(data["features"]) > 0:
            return data["features"][0]["properties"]["mag"]

        return 0

    except:
        return 0


# 🌱 STABLE SOIL
def get_soil(lat, lon):
    return round((abs(lat * lon) % 1), 2)


@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    lat = data["lat"]
    lon = data["lon"]

    weather = {}
    seismic = 0

    def fetch_weather():
        nonlocal weather
        weather = get_weather(lat, lon)

    def fetch_seismic():
        nonlocal seismic
        seismic = get_seismic(lat, lon)

    t1 = threading.Thread(target=fetch_weather)
    t2 = threading.Thread(target=fetch_seismic)

    t1.start()
    t2.start()

    t1.join()
    t2.join()

    soil = get_soil(lat, lon)

    features = np.array([[
        weather["rainfall"],
        weather["temperature"],
        weather["humidity"],
        weather["wind_speed"],
        soil,
        seismic
    ]])

    pred = model.predict(features)[0]

    prediction = "High Risk" if pred == 1 else "Safe"

    # Confidence (realistic)
    score = round(
        (weather["humidity"] +
         weather["rainfall"] * 10 +
         abs(seismic) * 5 +
         soil * 20) / 3,
        2
    )

    return jsonify({
        "prediction": prediction,
        "temperature": weather["temperature"],
        "wind_speed": weather["wind_speed"],
        "humidity": weather["humidity"],
        "rainfall": weather["rainfall"],
        "soil": soil,
        "seismic": seismic,
        "score": score
    })


if __name__ == "__main__":
    app.run(debug=True)