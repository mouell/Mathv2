"""
Pydantic schemas for MathV2 AI Engine API requests and responses.
All dimensions are in millimeters unless otherwise noted.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class FileType(str, Enum):
    PDF = "pdf"
    IMAGE = "image"
    DXF = "dxf"
    DWG = "dwg"
    UNKNOWN = "unknown"


class ProjectionType(str, Enum):
    ISO = "ISO"          # First-angle (European)
    ANSI = "ANSI"        # Third-angle (American)
    UNKNOWN = "unknown"


class FeatureType(str, Enum):
    DIMENSION = "dimension"
    DIAMETER = "diameter"
    RADIUS = "radius"
    CHAMFER = "chamfer"
    THREAD = "thread"
    TOLERANCE = "tolerance"
    SURFACE_FINISH = "surface_finish"
    GEOMETRIC_TOLERANCE = "geometric_tolerance"
    DEPTH = "depth"
    ANGLE = "angle"


class GeometricFeatureType(str, Enum):
    HOLE = "hole"
    POCKET = "pocket"
    CHAMFER = "chamfer"
    FILLET = "fillet"
    BOSS = "boss"
    SLOT = "slot"
    THREAD = "thread"
    CONTOUR = "contour"
    FACE = "face"


class MaterialType(str, Enum):
    ALUMINUM = "aluminum"
    STEEL = "steel"
    STAINLESS = "stainless"
    TITANIUM = "titanium"
    BRASS = "brass"
    PLASTIC = "plastic"
    CAST_IRON = "cast_iron"
    COPPER = "copper"


class ControllerType(str, Enum):
    FANUC = "fanuc"
    SIEMENS = "siemens"
    HEIDENHAIN = "heidenhain"
    ISO = "iso"
    MAZAK = "mazak"
    OKUMA = "okuma"


class OperationType(str, Enum):
    FACE_MILLING = "face_milling"
    CONTOUR_MILLING = "contour_milling"
    POCKETING = "pocketing"
    DRILLING = "drilling"
    CENTER_DRILLING = "center_drilling"
    TAPPING = "tapping"
    CHAMFERING = "chamfering"
    BORING = "boring"
    REAMING = "reaming"
    THREAD_MILLING = "thread_milling"


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    OCR = "ocr"
    FEATURE_EXTRACTION = "feature_extraction"
    GEOMETRY_BUILDING = "geometry_building"
    OPERATION_PLANNING = "operation_planning"
    TOOLPATH_GENERATION = "toolpath_generation"
    GCODE_GENERATION = "gcode_generation"
    COMPLETED = "completed"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Detected Feature (OCR output)
# ---------------------------------------------------------------------------


class DetectedFeature(BaseModel):
    """A feature detected from OCR / document analysis."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    feature_type: FeatureType
    raw_text: str = Field(..., description="Original text as found in the document")
    value: Optional[float] = Field(None, description="Primary numeric value (mm or degrees)")
    secondary_value: Optional[float] = Field(None, description="Secondary value (e.g., thread pitch)")
    tolerance_upper: Optional[float] = Field(None, description="Upper tolerance (positive number)")
    tolerance_lower: Optional[float] = Field(None, description="Lower tolerance (negative number)")
    unit: str = Field("mm", description="Unit of measurement")
    qualifier: Optional[str] = Field(None, description="H7, h6, M12, Ra0.8, etc.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence 0-1")
    source_region: Optional[str] = Field(None, description="Region of document where found")

    class Config:
        use_enum_values = True


class OCRResult(BaseModel):
    """Full OCR analysis result from DocumentAnalyzer."""

    raw_text: str
    language_detected: str = "fr+en"
    projection_type: ProjectionType = ProjectionType.UNKNOWN
    scale: Optional[str] = None  # e.g., "1:1", "1:2", "2:1"
    title_block: Dict[str, str] = Field(default_factory=dict)
    # {part_number, title, material, drawn_by, date, revision}
    regions: List[Dict[str, Any]] = Field(default_factory=list)
    detected_features: List[DetectedFeature] = Field(default_factory=list)
    processing_time_ms: float = 0.0


# ---------------------------------------------------------------------------
# Geometry Model
# ---------------------------------------------------------------------------


class Point3D(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    def to_list(self) -> List[float]:
        return [self.x, self.y, self.z]


class BoundingBox(BaseModel):
    x: float = Field(..., description="Length in X (mm)")
    y: float = Field(..., description="Width in Y (mm)")
    z: float = Field(..., description="Height in Z (mm)")


class GeometryFeature(BaseModel):
    """A 3D geometric feature in the part model."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    type: GeometricFeatureType
    position: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    # Hole-specific
    diameter: Optional[float] = None
    depth: Optional[float] = None
    thread: Optional[str] = None        # "M12x1.5", "M10", None
    thread_depth: Optional[float] = None
    tolerance: Optional[str] = None     # "H7", "H8", etc.
    # Pocket-specific
    width: Optional[float] = None
    length: Optional[float] = None
    corner_radius: Optional[float] = None
    # Chamfer/fillet
    edge: Optional[str] = None          # "top", "bottom", "side"
    size: Optional[float] = None
    angle: Optional[float] = None
    radius: Optional[float] = None
    # Slot
    slot_width: Optional[float] = None
    slot_length: Optional[float] = None
    # Surface finish
    surface_finish: Optional[float] = None   # Ra value in µm

    class Config:
        use_enum_values = True


class GeometryModel(BaseModel):
    """Full parametric 3D model description of the part."""

    part_id: str = Field(default_factory=lambda: f"PART_{str(uuid.uuid4())[:6].upper()}")
    part_name: Optional[str] = None
    material: MaterialType = MaterialType.ALUMINUM
    bounding_box: BoundingBox
    features: List[GeometryFeature] = Field(default_factory=list)
    volume: float = Field(0.0, description="Stock volume in mm³")
    surface_area: float = Field(0.0, description="Total surface area in mm²")
    stock_volume: float = Field(0.0, description="Bounding box volume in mm³")
    removal_volume: float = Field(0.0, description="Volume to be removed in mm³")
    estimated_weight_kg: float = Field(0.0)
    notes: List[str] = Field(default_factory=list)

    class Config:
        use_enum_values = True


# ---------------------------------------------------------------------------
# Tooling
# ---------------------------------------------------------------------------


class CuttingTool(BaseModel):
    """A cutting tool with all relevant parameters."""

    tool_number: int
    name: str
    tool_type: str   # "end_mill", "face_mill", "drill", "tap", "chamfer_mill", "reamer"
    diameter: float  # mm
    length: Optional[float] = None        # mm total length
    flute_length: Optional[float] = None  # cutting length in mm
    num_flutes: int = 4
    material: str = "carbide"             # "hss", "carbide", "cobalt"
    coating: Optional[str] = "TiAlN"     # "TiN", "TiAlN", "DLC", None
    radius: float = 0.0                   # corner radius for end mills
    thread_pitch: Optional[float] = None  # for taps
    taper_angle: Optional[float] = None   # for chamfer/spot drills


class CuttingParameters(BaseModel):
    """Cutting parameters for a machining operation."""

    spindle_rpm: int
    feed_rate_mmpm: float    # mm/min
    depth_of_cut_mm: float   # axial depth per pass
    stepover_mm: float        # radial stepover (for milling)
    plunge_rate_mmpm: float   # mm/min plunge feed
    retract_height_mm: float = 5.0
    coolant: bool = True
    climb_milling: bool = True  # True = climb, False = conventional


# ---------------------------------------------------------------------------
# Machining Operations
# ---------------------------------------------------------------------------


class MachiningOperation(BaseModel):
    """A single CNC machining operation."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    sequence: int
    operation_type: OperationType
    description: str
    tool: CuttingTool
    parameters: CuttingParameters
    target_features: List[str] = Field(default_factory=list)  # feature IDs
    estimated_time_min: float = 0.0
    notes: List[str] = Field(default_factory=list)

    class Config:
        use_enum_values = True


# ---------------------------------------------------------------------------
# Toolpath
# ---------------------------------------------------------------------------


class PathSegment(BaseModel):
    """A single move in a toolpath."""

    move_type: str   # "rapid", "cut", "plunge", "retract", "arc_cw", "arc_ccw"
    from_pos: List[float]   # [x, y, z]
    to_pos: List[float]     # [x, y, z]
    feed_rate: Optional[float] = None  # mm/min, None = use operation default
    arc_center: Optional[List[float]] = None  # [i, j, k] for arc moves
    arc_radius: Optional[float] = None


class OperationToolpath(BaseModel):
    """Toolpath for a single operation."""

    operation_id: str
    operation_type: str
    segments: List[PathSegment] = Field(default_factory=list)
    total_distance_mm: float = 0.0
    estimated_time_min: float = 0.0


# ---------------------------------------------------------------------------
# G-Code
# ---------------------------------------------------------------------------


class GCodeProgram(BaseModel):
    """A complete G-Code program for a specific controller."""

    controller: ControllerType
    program_name: str
    program_number: Optional[str] = None
    content: str   # full G-Code text
    line_count: int = 0
    estimated_cycle_time_min: float = 0.0
    tools_used: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

    class Config:
        use_enum_values = True


class ValidationIssue(BaseModel):
    """A validation warning or error in G-Code."""

    severity: str   # "error", "warning", "info"
    line_number: Optional[int] = None
    line_content: Optional[str] = None
    message: str
    code: str       # e.g., "RAPID_IN_CUT", "MISSING_TOOL_COMP"


class GCodeValidationResult(BaseModel):
    is_valid: bool
    error_count: int = 0
    warning_count: int = 0
    issues: List[ValidationIssue] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# API Request / Response models
# ---------------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    """Parameters for the /analyze endpoint (sent as form fields alongside file)."""

    material: MaterialType = MaterialType.ALUMINUM
    controller: ControllerType = ControllerType.FANUC
    part_name: Optional[str] = None
    use_ai_assist: bool = False  # Use Anthropic API for enhanced analysis
    language: str = "fr"         # "fr" | "en"


class GCodeRequest(BaseModel):
    """Request to regenerate G-Code from existing geometry."""

    geometry: GeometryModel
    operations: List[MachiningOperation]
    controller: ControllerType = ControllerType.FANUC
    work_offset: str = "G54"
    program_number: str = "0001"
    part_name: Optional[str] = None


class AnalysisResult(BaseModel):
    """Complete analysis result returned to the client."""

    job_id: str
    status: JobStatus
    file_name: str
    file_type: FileType
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    # Intermediate results
    ocr_result: Optional[OCRResult] = None
    detected_features: List[DetectedFeature] = Field(default_factory=list)
    geometry: Optional[GeometryModel] = None
    operations: List[MachiningOperation] = Field(default_factory=list)
    toolpaths: List[OperationToolpath] = Field(default_factory=list)

    # G-Code programs for each supported controller
    gcode_programs: Dict[str, GCodeProgram] = Field(default_factory=dict)

    # Summary stats
    total_operations: int = 0
    total_tools: int = 0
    estimated_cycle_time_min: float = 0.0
    error: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    processing_time_ms: float = 0.0

    class Config:
        use_enum_values = True


class JobStatusResponse(BaseModel):
    """Response for GET /status/{job_id}."""

    job_id: str
    status: JobStatus
    progress_percent: float = 0.0
    current_step: str = ""
    created_at: datetime
    updated_at: datetime
    result: Optional[AnalysisResult] = None
    error: Optional[str] = None

    class Config:
        use_enum_values = True


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    services: Dict[str, str] = Field(default_factory=dict)
