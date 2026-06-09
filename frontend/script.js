// 🌍 Initialize map
let map = L.map('map').setView([20.5937, 78.9629], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let marker;
let heatLayer = null;


// 🔥 Core prediction call
async function fetchPrediction(lat, lon) {
  const res = await fetch("https://disaster-project-6wtu.onrender.com/predict", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ lat, lon })
  });

  return res.json();
}


// 📍 Button → current location
function predictLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    map.setView([lat, lon], 10);

    const data = await fetchPrediction(lat, lon);

    document.getElementById("result").innerText = data.prediction;
    document.getElementById("confidence").innerText =
      "Confidence: " + Math.round(data.score) + "%";

    if (marker) map.removeLayer(marker);

    marker = L.marker([lat, lon]).addTo(map);

    marker.bindPopup(`
      <b>${data.prediction}</b><br>
      Temp: ${data.temperature}°C<br>
      Humidity: ${data.humidity}%<br>
      Rainfall: ${data.rainfall}<br>
      Soil: ${data.soil}
    `).openPopup();

  }, () => {
    alert("Location access denied");
  });
}


// 🖱️ Click → detailed prediction
map.on("click", async function (e) {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;

  const data = await fetchPrediction(lat, lon);

  document.getElementById("result").innerText = data.prediction;
  document.getElementById("confidence").innerText =
    "Confidence: " + Math.round(data.score) + "%";

  if (marker) map.removeLayer(marker);

  marker = L.marker([lat, lon]).addTo(map);

  marker.bindPopup(`
    <b>${data.prediction}</b><br>
    Temp: ${data.temperature}°C<br>
    Humidity: ${data.humidity}%<br>
    Rainfall: ${data.rainfall}<br>
    Soil: ${data.soil}
  `).openPopup();
});


// 🔥 HEATMAP GENERATION (MAIN FEATURE)
async function generateHeatmap() {

  if (heatLayer) {
    map.removeLayer(heatLayer);
  }

  let bounds = map.getBounds();

  let points = [];

  let latStep = 2;   // adjust density
  let lonStep = 2;

  let tasks = [];

  for (let lat = bounds.getSouth(); lat <= bounds.getNorth(); lat += latStep) {
    for (let lon = bounds.getWest(); lon <= bounds.getEast(); lon += lonStep) {

      tasks.push(
        fetchPrediction(lat, lon).then(data => {
          let intensity = data.score / 100; // normalize 0–1
          points.push([lat, lon, intensity]);
        }).catch(() => {})
      );

    }
  }

  // wait all API calls
  await Promise.all(tasks);

  heatLayer = L.heatLayer(points, {
    radius: 25,
    blur: 20,
    maxZoom: 10,
    gradient: {
      0.2: "green",
      0.5: "yellow",
      0.8: "orange",
      1.0: "red"
    }
  }).addTo(map);
}


// ❌ Clear heatmap
function clearHeatmap() {
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }
}