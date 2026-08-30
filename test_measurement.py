from cv.measurement import estimate_text_height_mm


pixels_per_mm = 18.3235

box = [
    100,
    200,
    400,
    255
]

result = estimate_text_height_mm(
    box,
    pixels_per_mm
)

print(result)