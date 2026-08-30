import cv2

dictionary = cv2.aruco.getPredefinedDictionary(
    cv2.aruco.DICT_4X4_50
)

marker = cv2.aruco.generateImageMarker(
    dictionary,
    0,
    1000
)

cv2.imwrite("aruco_marker_0.png", marker)

print("aruco_marker_0.png created")