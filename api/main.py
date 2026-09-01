"""Minimal FastAPI interface over the existing canonical analysis pipeline."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Annotated, Any

import cv2
from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.analyzer import PackageAnalysisError, PackageAnalyzer


LOGGER = logging.getLogger(__name__)
SERVICE_NAME = "SIH26034 Legal Metrology AI"
DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024
SUPPORTED_UPLOADS = {
    "image/jpeg": {"extensions": {".jpg", ".jpeg"}, "temporary_suffix": ".jpg"},
    "image/png": {"extensions": {".png"}, "temporary_suffix": ".png"},
}


class HealthResponse(BaseModel):
    status: str
    service: str


def _frontend_origins() -> list[str]:
    configured = os.getenv(
        "SIH_FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def _maximum_upload_bytes() -> int:
    raw = os.getenv("SIH_MAX_UPLOAD_BYTES")
    if raw is None:
        return DEFAULT_MAX_UPLOAD_BYTES
    try:
        value = int(raw)
    except ValueError:
        LOGGER.warning("Ignoring invalid SIH_MAX_UPLOAD_BYTES configuration")
        return DEFAULT_MAX_UPLOAD_BYTES
    return value if value > 0 else DEFAULT_MAX_UPLOAD_BYTES


def create_app(analyzer: PackageAnalyzer | None = None) -> FastAPI:
    app = FastAPI(
        title=SERVICE_NAME,
        version="1.0.0",
        description=(
            "Local prototype API for evidence-backed package analysis. "
            "Responses are not official compliance certificates."
        ),
    )
    app.state.analyzer = analyzer or PackageAnalyzer()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_frontend_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(status="ok", service=SERVICE_NAME)

    @app.post("/analyze", response_model=dict[str, Any])
    async def analyze(
        request: Request,
        file: Annotated[UploadFile, File(description="JPEG or PNG package image")],
    ) -> dict[str, Any]:
        if not file.filename:
            raise HTTPException(status_code=400, detail="An image file is required")
        media = SUPPORTED_UPLOADS.get((file.content_type or "").lower())
        extension = Path(file.filename).suffix.lower()
        if media is None or extension not in media["extensions"]:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Supported image formats are JPEG, JPG, and PNG",
            )
        maximum_bytes = _maximum_upload_bytes()
        try:
            with tempfile.TemporaryDirectory(prefix="sih26034_upload_") as directory:
                temporary_path = Path(directory) / f"upload{media['temporary_suffix']}"
                total_bytes = 0
                with temporary_path.open("wb") as output:
                    while chunk := await file.read(CHUNK_SIZE):
                        total_bytes += len(chunk)
                        if total_bytes > maximum_bytes:
                            raise HTTPException(
                                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                                detail=(
                                    "Image exceeds the configured prototype upload-size limit"
                                ),
                            )
                        output.write(chunk)
                if total_bytes == 0:
                    raise HTTPException(status_code=400, detail="Uploaded image is empty")
                if cv2.imread(str(temporary_path)) is None:
                    raise HTTPException(status_code=400, detail="Uploaded file is not a valid image")
                analyzer_service: PackageAnalyzer = request.app.state.analyzer
                return await run_in_threadpool(
                    analyzer_service.analyze_package,
                    temporary_path,
                    display_filename=f"uploaded_image{media['temporary_suffix']}",
                )
        except HTTPException:
            raise
        except PackageAnalysisError:
            LOGGER.exception("Package analysis failed")
            raise HTTPException(
                status_code=500, detail="Package analysis could not be completed"
            ) from None
        except Exception:
            LOGGER.exception("Unexpected package-analysis API failure")
            raise HTTPException(
                status_code=500, detail="Package analysis could not be completed"
            ) from None
        finally:
            await file.close()

    return app


app = create_app()
