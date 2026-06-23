"""
MathV2 AI Engine — FastAPI entry point.

Exposes:
  POST /analyze          Upload a CAD/drawing file and trigger the full analysis pipeline
  GET  /status/{job_id}  Poll analysis progress
  POST /gcode            Generate G-Code from existing geometry+operations
  GET  /health           Liveness probe

The analysis pipeline runs as a background task so the HTTP response returns
immediately.  The caller polls /status/{job_id} until status == "completed".
"""

from __future__ import annotations

import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models.schemas import GCodeRequest, JobStatus
from ocr.document_analyzer import DocumentAnalyzer
from ocr.feature_extractor import FeatureExtractor
from geometry_engine.geometry_builder import GeometryBuilder
from toolpath_engine.operation_planner import OperationPlanner
from toolpath_engine.toolpath_generator import ToolpathGenerator
from gcode_engine.gcode_generator import GCodeGenerator
from gcode_engine.gcode_validator import GCodeValidator

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger("mathv2.main")

# ---------------------------------------------------------------------------
# App bootstrap
# ---------------------------------------------------------------------------

app = FastAPI(
    title="MathV2 AI Engine",
    description=(
        "AI-powered CAD/CAM analysis engine. "
        "Accepts engineering drawings (PDF, DXF, DWG, PNG, JPG) and returns "
        "detected features, reconstructed 3D geometry, machining operations, "
        "toolpaths, and ready-to-run CNC G-Code."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory job store
# (Replace with Redis / DB in production for multi-process deployments)
# ---------------------------------------------------------------------------

_JOBS: dict[str, dict] = {}

_UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/mathv2_uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Helper: update job
# ---------------------------------------------------------------------------

def _set_job(job_id: str, **kwargs):
    _JOBS[job_id].update(kwargs)
    _JOBS[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Background analysis pipeline
# ---------------------------------------------------------------------------

async def run_analysis_pipeline(
    job_id: str,
    file_path: str,
    file_name: str,
    material: str,
    controller: str,
):
    """
    Full 7-step pipeline executed in a background task.
    Any exception marks the job as failed.
    """
    try:
        # ── Step 1: Document analysis / OCR (10 → 25 %) ──────────────────────
        _set_job(job_id, status="ocr", progress=10, current_step="OCR and document analysis")
        logger.info("[%s] Step 1/7 — Document analysis", job_id)

        analyzer = DocumentAnalyzer()
        file_bytes = open(file_path, "rb").read()
        ocr_result = analyzer.analyze(file_bytes, file_name)

        _set_job(job_id, progress=25)

        # ── Step 2: Feature extraction (25 → 45 %) ────────────────────────────
        _set_job(job_id, status="feature_extraction", current_step="Extracting engineering features")
        logger.info("[%s] Step 2/7 — Feature extraction", job_id)

        extractor = FeatureExtractor()
        detected_features = extractor.extract(ocr_result.raw_text)

        _set_job(job_id, progress=45)

        # ── Step 3: Geometry reconstruction (45 → 60 %) ───────────────────────
        _set_job(job_id, status="geometry_building", current_step="Reconstructing 3D geometry")
        logger.info("[%s] Step 3/7 — Geometry building (%d features)", job_id, len(detected_features))

        builder = GeometryBuilder()
        geometry = builder.build(
            detected_features,
            part_name=ocr_result.title_block.get("title") or ocr_result.title_block.get("part_number"),
        )
        # Override material from request
        geometry.material = material

        _set_job(job_id, progress=60)

        # ── Step 4: Operation planning (60 → 72 %) ────────────────────────────
        _set_job(job_id, status="operation_planning", current_step="Planning machining operations")
        logger.info("[%s] Step 4/7 — Operation planning", job_id)

        # Resolve material enum value for the planner
        from models.schemas import MaterialType
        mat_enum = MaterialType.ALUMINUM
        for m in MaterialType:
            if m.value in material.lower() or material.lower() in m.value:
                mat_enum = m
                break

        planner = OperationPlanner(material=mat_enum)
        operations = planner.plan(geometry)

        _set_job(job_id, progress=72)

        # ── Step 5: Toolpath generation (72 → 85 %) ───────────────────────────
        _set_job(job_id, status="toolpath_generation", current_step="Generating toolpaths")
        logger.info("[%s] Step 5/7 — Toolpath generation (%d ops)", job_id, len(operations))

        tp_gen = ToolpathGenerator(geometry=geometry)
        toolpaths_list = tp_gen.generate_all(operations)
        toolpaths = {
            "segments_by_operation": [tp.dict() for tp in toolpaths_list],
            "total_operations": len(toolpaths_list),
            "total_segments": sum(len(tp.segments) for tp in toolpaths_list),
        }

        _set_job(job_id, progress=85)

        # ── Step 6: G-Code generation (85 → 94 %) ────────────────────────────
        _set_job(job_id, status="gcode_generation", current_step="Generating CNC G-Code")
        logger.info("[%s] Step 6/7 — G-Code generation (controller: %s)", job_id, controller)

        gcode_gen = GCodeGenerator()
        gcode = gcode_gen.generate(operations, geometry, controller, str(mat_enum))

        _set_job(job_id, progress=94)

        # ── Step 7: Validation (94 → 100 %) ──────────────────────────────────
        _set_job(job_id, current_step="Validating G-Code")
        logger.info("[%s] Step 7/7 — G-Code validation", job_id)

        validator = GCodeValidator()
        validation = validator.validate(gcode)

        # ── Done ──────────────────────────────────────────────────────────────
        total_time_min = sum(op.estimated_time_min for op in operations)

        _set_job(
            job_id,
            status="completed",
            progress=100,
            current_step="Done",
            completed_at=datetime.now(timezone.utc).isoformat(),
            result={
                "file_name": file_name,
                "ocr_summary": {
                    "raw_text_length": len(ocr_result.raw_text),
                    "language": ocr_result.language_detected,
                    "projection": ocr_result.projection_type,
                    "scale": ocr_result.scale,
                    "title_block": ocr_result.title_block,
                },
                "detected_features": [f.dict() for f in detected_features],
                "feature_count": len(detected_features),
                "geometry": geometry.dict(),
                "operations": [op.dict() for op in operations],
                "operation_count": len(operations),
                "toolpaths": toolpaths,
                "gcode": gcode,
                "validation": validation,
                "estimated_cycle_time_min": round(total_time_min, 2),
                "tools_used": list({op.tool.name for op in operations}),
            },
            error=None,
        )
        logger.info("[%s] Pipeline completed. %d features, %d operations, %.1f min cycle time",
                    job_id, len(detected_features), len(operations), total_time_min)

    except Exception as exc:
        logger.exception("[%s] Pipeline failed: %s", job_id, exc)
        _set_job(
            job_id,
            status="failed",
            progress=0,
            current_step="Failed",
            result=None,
            error=str(exc),
        )
    finally:
        # Clean up temporary file
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", tags=["system"])
async def health():
    """Liveness probe."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "active_jobs": len([j for j in _JOBS.values() if j["status"] not in ("completed", "failed")]),
    }


@app.post("/analyze", tags=["analysis"])
async def analyze_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="CAD drawing file (PDF, DXF, DWG, PNG, JPG, TIFF)"),
    material: str = Form("aluminum_6061", description="Material identifier"),
    controller: str = Form("fanuc", description="CNC controller dialect"),
    project_id: str = Form(..., description="Backend project ID (for tracking)"),
    part_name: Optional[str] = Form(None, description="Optional part name override"),
):
    """
    Upload a CAD/drawing file and start the full analysis pipeline.

    Returns a `job_id` immediately.  Poll `GET /status/{job_id}` until
    `status == "completed"`.
    """
    # Validate file presence
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    job_id = str(uuid.uuid4())

    # Persist upload to disk
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._-")
    file_path = os.path.join(_UPLOAD_DIR, f"{job_id}_{safe_name}")
    content = await file.read()
    with open(file_path, "wb") as fh:
        fh.write(content)

    logger.info(
        "Job %s created — project=%s  file=%s  size=%d  material=%s  controller=%s",
        job_id, project_id, file.filename, len(content), material, controller,
    )

    # Initialise job record
    _JOBS[job_id] = {
        "job_id": job_id,
        "project_id": project_id,
        "file_name": file.filename,
        "material": material,
        "controller": controller,
        "status": "processing",
        "progress": 0,
        "current_step": "Queued",
        "result": None,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    }

    # Schedule pipeline
    background_tasks.add_task(
        run_analysis_pipeline,
        job_id, file_path, file.filename, material, controller,
    )

    return {
        "job_id": job_id,
        "status": "processing",
        "message": "Analysis pipeline started. Poll /status/{job_id} for progress.",
    }


@app.get("/status/{job_id}", tags=["analysis"])
async def get_status(job_id: str):
    """Poll the status of an analysis job."""
    if job_id not in _JOBS:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")
    return _JOBS[job_id]


@app.get("/jobs", tags=["system"])
async def list_jobs(limit: int = 20):
    """List recent jobs (without result payload to save bandwidth)."""
    jobs = sorted(_JOBS.values(), key=lambda j: j["created_at"], reverse=True)[:limit]
    return [
        {k: v for k, v in j.items() if k != "result"}
        for j in jobs
    ]


@app.post("/gcode", tags=["gcode"])
async def generate_gcode(request: GCodeRequest):
    """
    Generate G-Code from an existing geometry + operations payload.
    Useful for re-generating with different controller settings without
    re-running the full OCR pipeline.
    """
    try:
        generator = GCodeGenerator()
        gcode = generator.generate(
            request.operations,
            request.geometry,
            request.controller,
            request.geometry.material,
        )
        validator = GCodeValidator()
        validation = validator.validate(gcode)

        return {
            "gcode": gcode,
            "validation": validation,
            "controller": request.controller,
            "line_count": gcode.count("\n") + 1,
        }
    except Exception as exc:
        logger.exception("G-Code generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
