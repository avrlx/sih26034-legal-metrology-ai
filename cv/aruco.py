import cv2
import numpy as np


def detect_aruco_scale(image_path, marker_size_mm=50.0):
    image = cv2.imread(image_path)

    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    dictionary = cv2.aruco.getPredefinedDictionary(
        cv2.aruco.DICT_4X4_50
    )

    detector_parameters = cv2.aruco.DetectorParameters()

    detector = cv2.aruco.ArucoDetector(
        dictionary,
        detector_parameters
    )

    corners, ids, rejected = detector.detectMarkers(gray)

    if ids is None or len(corners) == 0:
        return {
            "detected": False,
            "pixels_per_mm": None,
            "marker_id": None
        }

    marker = corners[0][0]

    top_left = marker[0]
    top_right = marker[1]
    bottom_right = marker[2]
    bottom_left = marker[3]

    top_width = np.linalg.norm(
        top_right - top_left
    )

    bottom_width = np.linalg.norm(
        bottom_right - bottom_left
    )

    left_height = np.linalg.norm(
        bottom_left - top_left
    )

    right_height = np.linalg.norm(
        bottom_right - top_right
    )

    average_size_px = np.mean([
        top_width,
        bottom_width,
        left_height,
        right_height
    ])

    pixels_per_mm = (
        average_size_px / marker_size_mm
    )

    return {
        "detected": True,
        "marker_id": int(ids[0][0]),
        "marker_size_mm": marker_size_mm,
        "average_size_px": round(
            float(average_size_px),
            2
        ),
        "pixels_per_mm": round(
            float(pixels_per_mm),
            4
        ),
        "corners": marker.tolist()
    }