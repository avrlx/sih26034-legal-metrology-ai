# Project Setup Guide

This guide describes how to set up and run the SIH26034 Legal Metrology AI service on macOS or Windows. Run all project commands from the repository root unless a section says otherwise.

## Requirements

- Python 3.12
- Git
- `pip` (included with standard Python installations)
- A project-local Python virtual environment
- The checked-in `requirements.txt`

Python 3.12 is the recommended version for this repository. PaddlePaddle wheel availability and compatibility can be unreliable on newer, unsupported Python versions, so do not substitute a newer interpreter unless PaddlePaddle explicitly supports it.

## Clone Repository

The configured Git remote is `https://github.com/avrlx/sih26034-legal-metrology-ai.git`.

```bash
git clone https://github.com/avrlx/sih26034-legal-metrology-ai.git
cd sih26034-legal-metrology-ai
```

## macOS Setup

### 1. Check or install Python 3.12

```bash
python3.12 --version
```

If Python 3.12 is unavailable and Homebrew is installed:

```bash
brew install python@3.12
```

Verify the installed interpreter:

```bash
python3.12 --version
```

### 2. Create and activate the virtual environment

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

After activation, `python --version` should report Python 3.12.

### 3. Install dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Verify the main computer-vision dependencies

Verify PaddlePaddle:

```bash
python -c "import paddle; paddle.utils.run_check()"
```

Verify PaddleOCR:

```bash
python -c "from paddleocr import PaddleOCR; print('PaddleOCR OK')"
```

Verify OpenCV and its ArUco module:

```bash
python -c "import cv2; print(cv2.__version__); print('ArUco:', hasattr(cv2, 'aruco'))"
```

The final line should be `ArUco: True`. This repository pins `opencv-contrib-python`, which supplies ArUco. If ArUco is unavailable, activate the virtual environment and reinstall the pinned contrib build:

```bash
python -m pip install --upgrade --force-reinstall opencv-contrib-python==4.10.0.84
```

## Windows Setup

### 1. Check or install Python 3.12

Install Python 3.12 from the official Python installer if it is not already available. Enable the Python launcher during installation, then verify it in PowerShell or Command Prompt:

```powershell
py -3.12 --version
```

### 2. Create the virtual environment

```powershell
py -3.12 -m venv .venv
```

Activate it in PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks the activation script, run the following once for the current Windows user and then retry activation:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

This policy change is only needed when PowerShell reports that script execution is disabled.

Alternatively, activate the environment in Command Prompt:

```bat
.venv\Scripts\activate.bat
```

### 3. Install dependencies

With the virtual environment active:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Verify the main computer-vision dependencies

The following commands work in both PowerShell and Command Prompt:

```powershell
python -c "import paddle; paddle.utils.run_check()"
python -c "from paddleocr import PaddleOCR; print('PaddleOCR OK')"
python -c "import cv2; print(cv2.__version__); print('ArUco:', hasattr(cv2, 'aruco'))"
```

If the last command reports `ArUco: False`, reinstall the contrib build from the active environment:

```powershell
python -m pip install --upgrade --force-reinstall opencv-contrib-python==4.10.0.84
```

## Running the Project

The current end-to-end development runner is `test_ocr.py`:

```bash
python test_ocr.py
```

It uses the image configured in the script and runs this pipeline:

```text
Image
→ image-quality analysis
→ ArUco calibration
→ PaddleOCR
→ ArUco-overlap OCR filtering
→ structured field extraction
→ physical text measurement
→ Legal Metrology compliance rule evaluation
```

The program currently prints these output sections:

- `IMAGE QUALITY`
- `ARUCO CALIBRATION`
- `RAW OCR TEXT`
- `OCR MARKER FILTER`
- `NET QUANTITY MEASUREMENT`
- `EXTRACTED FIELDS`
- `COMPLIANCE RESULT`

The first PaddleOCR run may require internet access to download model files and can take longer than later runs.

## Running Tests

The automated tests use Python's built-in `unittest` framework. Run the complete suite with verbose output:

```bash
python -m unittest discover -s tests -v
```

Run it without verbose test names by omitting `-v`:

```bash
python -m unittest discover -s tests
```

Pytest is not used by the current test suite and is not listed in `requirements.txt`, so it is not required for this repository.

## Sample Image

`test_ocr.py` currently expects:

```text
samples/BestToTest.jpg
```

The command must be run from the repository root so this relative path resolves correctly.

- OCR-only experiments can use a normal, clear package image.
- Physical-size measurements require the real package and a physical ArUco marker in the same photograph.
- Do not digitally paste a marker onto a package image for physical measurement. A pasted marker does not provide a valid real-world scale.

## ArUco Setup

The current implementation in `cv/aruco.py` uses:

- Dictionary: `cv2.aruco.DICT_4X4_50`
- Expected generated marker ID: `0`
- Configured physical marker size: `50.0 mm`
- Calibration method: average of the detected marker's four side lengths

The repository includes a marker generator. From the repository root, run:

```bash
cd testbyme/aruco_maker
python generate_marker.py
cd ../..
```

This generates `aruco_marker_0.png` using marker ID 0 and a 1000-by-1000-pixel raster. Pixel dimensions do not establish physical scale. When printed, the marker's black square must measure exactly 50 mm on each side to match `MARKER_SIZE_MM = 50.0` in `test_ocr.py`.

Keep a clear white margin around the printed marker. For meaningful physical measurement, place the marker and package text approximately on the same physical plane.

## Recommended Image Capture

- Use the original phone-camera resolution.
- Ensure good focus and avoid motion blur.
- Avoid glare across the declaration text or marker.
- Avoid digital zoom.
- Keep the package text readable.
- Keep the entire marker and its outer border visible.
- Keep the camera roughly perpendicular to the package and marker plane.
- Prefer weight or volume packages such as 100 g, 500 g, 1 kg, 500 ml, or 1 L when testing physical numeral-height logic.

## Virtual Environment Rules

Do not commit `.venv` to Git. Every developer should recreate it locally:

macOS:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Windows:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Git stores the project code and dependency definitions, not the platform-specific virtual environment itself.

## `requirements.txt`

`requirements.txt` contains the pinned packages used to recreate the environment, including PaddlePaddle, PaddleOCR, NumPy, and `opencv-contrib-python`.

If project dependencies intentionally change, an activated development environment can be captured with:

```bash
pip freeze > requirements.txt
```

Review the resulting file before committing it. `pip freeze` includes transitive packages and may capture packages unrelated to the intended change.

## `.gitignore`

The existing `.gitignore` already excludes the main local and generated artifacts:

```text
.venv/
__pycache__/
*.pyc
.env
.env.*
.DS_Store
.paddlex/
.paddleocr/
output/
outputs/
```

These files and directories should generally not be committed. Paddle model caches are recreated locally; no separate repository-local OpenCV cache is currently configured.

## Common Problems

### `ModuleNotFoundError`

Confirm that `.venv` is activated, verify `python --version`, and reinstall the dependencies:

```bash
pip install -r requirements.txt
```

### PaddlePaddle import failure

Confirm that the active interpreter is Python 3.12, then reinstall from the pinned dependency file:

```bash
python --version
pip install --force-reinstall -r requirements.txt
```

### `ArUco: False`

Check the module directly:

```bash
python -c "import cv2; print(hasattr(cv2, 'aruco'))"
```

ArUco is part of `opencv-contrib-python`, not every OpenCV distribution. Reinstall the pinned contrib package if necessary.

### First PaddleOCR run is slow

PaddleOCR may download and cache recognition models during its first run. Later runs normally reuse the local cache and start faster.

### `ccache` warning

PaddlePaddle may warn that `ccache` is unavailable. This is generally harmless for this project unless you are compiling custom native extensions; OCR inference can continue without it.

### Image rejected as blurry

The image-quality stage may mark a sample as unusable when focus or motion blur is too poor for reliable OCR. Retake a sharper, better-lit photograph rather than lowering the quality thresholds.

### ArUco detection returns `detected: false`

- Use a real OpenCV ArUco marker from `DICT_4X4_50`.
- Use marker ID 0 for the included generator and test setup.
- Keep the entire marker visible, including its outer border.
- Leave sufficient white margin around the marker.
- Ensure good focus and contrast.
- Do not make the marker too small in the image.

## Development Workflow

Use `main` for stable working code and `feature/*` branches for experimental or new development:

```text
main
→ stable working code

feature/*
→ experimental or new development
```

Before pushing important changes, activate the environment and run:

```bash
python -m unittest discover -s tests -v
python test_ocr.py
```

The automated suite verifies extraction and rule-engine regressions. The end-to-end command additionally exercises the configured sample image, image quality, ArUco, PaddleOCR, physical measurement, and compliance output.

## Deactivate Environment

On both macOS and Windows, leave the active virtual environment with:

```bash
deactivate
```
