import json
from cv.aruco import detect_aruco_scale

result = detect_aruco_scale(
    "aruco_test.jpg",
    marker_size_mm=50.0
)

print(json.dumps(result, indent=2))