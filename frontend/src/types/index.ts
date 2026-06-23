// ─── Project & File Types ────────────────────────────────────────────────────

export type ProjectStatus = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

export type FileFormat = 'PDF' | 'DXF' | 'DWG' | 'JPG' | 'PNG' | 'TIFF' | 'STEP' | 'IGES';

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  fileFormat: FileFormat;
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string;
  material: string;
  cncController: CNCController;
  dimensionCount: number;
  operationCount: number;
}

// ─── Dimension Types ────────────────────────────────────────────────────────

export type DimensionType =
  | 'length'
  | 'diameter'
  | 'radius'
  | 'chamfer'
  | 'angle'
  | 'thread'
  | 'depth'
  | 'width'
  | 'height'
  | 'thickness';

export interface Tolerance {
  upper: number;  // in mm, e.g. +0.02
  lower: number;  // in mm, e.g. -0.02
  type: 'bilateral' | 'unilateral-upper' | 'unilateral-lower' | 'general';
  isoCode?: string; // e.g. "H7", "f6", "k5"
  surfaceRoughness?: number; // Ra value in µm
}

export interface Dimension {
  id: string;
  type: DimensionType;
  label: string;
  value: number;    // in mm
  unit: 'mm' | 'in';
  tolerance?: Tolerance;
  confidence: number;  // 0-100
  position?: [number, number, number];  // 3D position for annotation
  direction?: [number, number, number]; // axis direction
  isEdited?: boolean;
  notes?: string;
}

// ─── Machining Operations ───────────────────────────────────────────────────

export type OperationType =
  | 'facing'
  | 'contouring'
  | 'drilling'
  | 'tapping'
  | 'grooving'
  | 'pocketing'
  | 'chamfering'
  | 'turning'
  | 'boring'
  | 'reaming'
  | 'threading';

export interface CuttingTool {
  type: 'end-mill' | 'drill' | 'tap' | 'face-mill' | 'boring-bar' | 'reamer' | 'thread-mill';
  diameter: number;   // mm
  flutes?: number;
  material: 'HSS' | 'Carbide' | 'Cermet' | 'CBN' | 'Diamond';
  coating?: 'TiN' | 'TiAlN' | 'TiCN' | 'AlTiN' | 'DLC' | 'none';
  cornerRadius?: number;
}

export interface MachiningOperation {
  id: string;
  type: OperationType;
  label: string;
  tool: CuttingTool;
  depth?: number;       // mm
  width?: number;       // mm
  stepdown?: number;    // mm (axial depth per pass)
  stepover?: number;    // mm (radial engagement)
  spindleSpeed: number; // RPM
  feedRate: number;     // mm/min
  cuttingSpeed: number; // m/min
  estimatedTime: number; // seconds
  confidence: number;   // 0-100
  order: number;
  isActive?: boolean;
  toolpath?: [number, number, number][];  // 3D points for visualization
}

// ─── Material ───────────────────────────────────────────────────────────────

export interface MaterialProperties {
  density: number;          // g/cm³
  hardness: number;         // HB (Brinell)
  tensileStrength: number;  // MPa
  yieldStrength: number;    // MPa
  elongation: number;       // %
  thermalConductivity: number; // W/m·K
  machinability: number;    // % relative to free-machining steel
}

export interface Material {
  id: string;
  name: string;
  code: string;        // e.g. "6061-T6", "1018", "304"
  category: 'aluminum' | 'steel' | 'stainless' | 'titanium' | 'brass' | 'copper' | 'plastic' | 'composite';
  color: string;       // hex for 3D visualization
  properties: MaterialProperties;
}

// ─── G-Code ─────────────────────────────────────────────────────────────────

export type CNCController = 'fanuc' | 'siemens' | 'heidenhain' | 'iso';

export interface GCodeLine {
  lineNumber: number;
  raw: string;
  type: 'move' | 'command' | 'comment' | 'tool-change' | 'spindle' | 'coolant' | 'coordinate';
  gCodes?: string[];
  mCodes?: string[];
  x?: number;
  y?: number;
  z?: number;
  f?: number;
  s?: number;
  t?: number;
  comment?: string;
}

export interface GCodeProgram {
  id: string;
  controller: CNCController;
  lines: GCodeLine[];
  raw: string;
  estimatedTime: number;  // seconds
  toolChanges: number;
  lineCount: number;
  createdAt: Date;
}

export interface GCodeValidationMessage {
  lineNumber: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code: string;
}

// ─── Simulation ─────────────────────────────────────────────────────────────

export type SimulationState = 'idle' | 'playing' | 'paused' | 'complete';

export interface SimulationFrame {
  frameIndex: number;
  toolPosition: [number, number, number];
  toolOrientation: [number, number, number];
  currentOperation: string;
  progress: number;
  removedMaterial?: [number, number, number][];
}

// ─── Analysis Pipeline ───────────────────────────────────────────────────────

export type PipelineStepStatus = 'pending' | 'running' | 'complete' | 'error';

export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  status: PipelineStepStatus;
  progress: number;
  duration?: number;  // ms
  icon: string;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface AnalysisResult {
  projectId: string;
  dimensions: Dimension[];
  operations: MachiningOperation[];
  material: Material;
  gcode: GCodeProgram;
  confidence: number;
  warnings: string[];
  processingTime: number;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─── App State ───────────────────────────────────────────────────────────────

export type ActiveTab = 'viewer' | 'gcode' | 'simulation';
export type RightPanelTab = 'analyse' | 'operations' | 'material';
export type AnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';
