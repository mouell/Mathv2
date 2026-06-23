import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import {
  Project,
  Dimension,
  MachiningOperation,
  Material,
  GCodeProgram,
  CNCController,
  AnalysisStatus,
  ActiveTab,
  RightPanelTab,
  SimulationState,
  PipelineStep,
} from '@/types';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DIMENSIONS: Dimension[] = [
  {
    id: 'd1',
    type: 'length',
    label: 'Longueur totale',
    value: 120.0,
    unit: 'mm',
    tolerance: { upper: 0.1, lower: -0.1, type: 'bilateral', isoCode: 'js7' },
    confidence: 97,
    position: [0, 0, 0],
  },
  {
    id: 'd2',
    type: 'width',
    label: 'Largeur totale',
    value: 80.0,
    unit: 'mm',
    tolerance: { upper: 0.1, lower: -0.1, type: 'bilateral', isoCode: 'js7' },
    confidence: 96,
    position: [0, 0, 0],
  },
  {
    id: 'd3',
    type: 'height',
    label: 'Hauteur totale',
    value: 40.0,
    unit: 'mm',
    tolerance: { upper: 0.05, lower: -0.05, type: 'bilateral' },
    confidence: 98,
    position: [0, 0, 0],
  },
  {
    id: 'd4',
    type: 'diameter',
    label: 'Alésage Ø1 (TL)',
    value: 12.0,
    unit: 'mm',
    tolerance: { upper: 0.018, lower: 0, type: 'unilateral-upper', isoCode: 'H7' },
    confidence: 94,
    position: [-45, -30, 0],
  },
  {
    id: 'd5',
    type: 'diameter',
    label: 'Alésage Ø2 (TR)',
    value: 12.0,
    unit: 'mm',
    tolerance: { upper: 0.018, lower: 0, type: 'unilateral-upper', isoCode: 'H7' },
    confidence: 94,
    position: [45, -30, 0],
  },
  {
    id: 'd6',
    type: 'diameter',
    label: 'Alésage Ø3 (BL)',
    value: 12.0,
    unit: 'mm',
    tolerance: { upper: 0.018, lower: 0, type: 'unilateral-upper', isoCode: 'H7' },
    confidence: 95,
    position: [-45, 30, 0],
  },
  {
    id: 'd7',
    type: 'diameter',
    label: 'Alésage Ø4 (BR)',
    value: 12.0,
    unit: 'mm',
    tolerance: { upper: 0.018, lower: 0, type: 'unilateral-upper', isoCode: 'H7' },
    confidence: 95,
    position: [45, 30, 0],
  },
  {
    id: 'd8',
    type: 'depth',
    label: 'Profondeur poche centrale',
    value: 15.0,
    unit: 'mm',
    tolerance: { upper: 0.05, lower: -0.05, type: 'bilateral' },
    confidence: 91,
    position: [0, 0, 20],
  },
  {
    id: 'd9',
    type: 'chamfer',
    label: 'Chanfrein arête sup.',
    value: 2.0,
    unit: 'mm',
    tolerance: { upper: 0.2, lower: -0.2, type: 'bilateral' },
    confidence: 88,
    position: [60, 40, 40],
  },
  {
    id: 'd10',
    type: 'thread',
    label: 'Filetage M16x2',
    value: 16.0,
    unit: 'mm',
    tolerance: { upper: 0, lower: -0.1, type: 'unilateral-lower', isoCode: '6g' },
    confidence: 89,
    position: [0, 0, 0],
  },
];

const MOCK_OPERATIONS: MachiningOperation[] = [
  {
    id: 'op1',
    type: 'facing',
    label: 'Surfaçage face supérieure',
    tool: { type: 'face-mill', diameter: 63, flutes: 4, material: 'Carbide', coating: 'TiAlN' },
    depth: 1.5,
    width: 80,
    stepdown: 1.5,
    stepover: 50,
    spindleSpeed: 2500,
    feedRate: 800,
    cuttingSpeed: 495,
    estimatedTime: 45,
    confidence: 97,
    order: 1,
  },
  {
    id: 'op2',
    type: 'pocketing',
    label: 'Fraisage poche centrale',
    tool: { type: 'end-mill', diameter: 16, flutes: 4, material: 'Carbide', coating: 'AlTiN' },
    depth: 15,
    stepdown: 3,
    stepover: 8,
    spindleSpeed: 6000,
    feedRate: 1200,
    cuttingSpeed: 301,
    estimatedTime: 180,
    confidence: 93,
    order: 2,
  },
  {
    id: 'op3',
    type: 'drilling',
    label: 'Perçage Ø12 H7 (×4)',
    tool: { type: 'drill', diameter: 11.8, material: 'Carbide', coating: 'TiN' },
    depth: 40,
    spindleSpeed: 3200,
    feedRate: 320,
    cuttingSpeed: 118,
    estimatedTime: 60,
    confidence: 95,
    order: 3,
  },
  {
    id: 'op4',
    type: 'boring',
    label: 'Alésage Ø12 H7 (×4)',
    tool: { type: 'boring-bar', diameter: 12, material: 'Carbide', coating: 'TiAlN' },
    depth: 40,
    spindleSpeed: 4800,
    feedRate: 96,
    cuttingSpeed: 181,
    estimatedTime: 120,
    confidence: 94,
    order: 4,
  },
  {
    id: 'op5',
    type: 'chamfering',
    label: 'Chanfreinage arêtes',
    tool: { type: 'end-mill', diameter: 10, flutes: 2, material: 'Carbide', coating: 'TiN' },
    depth: 2,
    spindleSpeed: 5000,
    feedRate: 500,
    cuttingSpeed: 157,
    estimatedTime: 30,
    confidence: 88,
    order: 5,
  },
  {
    id: 'op6',
    type: 'contouring',
    label: 'Contournage extérieur',
    tool: { type: 'end-mill', diameter: 20, flutes: 4, material: 'Carbide', coating: 'AlTiN' },
    depth: 40,
    stepdown: 5,
    stepover: 1,
    spindleSpeed: 4000,
    feedRate: 1600,
    cuttingSpeed: 251,
    estimatedTime: 240,
    confidence: 96,
    order: 6,
  },
];

const MOCK_MATERIAL: Material = {
  id: 'mat1',
  name: 'Aluminium 6061-T6',
  code: '6061-T6',
  category: 'aluminum',
  color: '#c0c8d0',
  properties: {
    density: 2.70,
    hardness: 95,
    tensileStrength: 310,
    yieldStrength: 276,
    elongation: 12,
    thermalConductivity: 167,
    machinability: 90,
  },
};

const MOCK_GCODE = `%
O0001 (MATHV2 - PIECE_001)
(DATE: 2024-01-15  TIME: 14:32)
(MATERIAL: ALUMINIUM 6061-T6)
(CONTROLLER: FANUC 0i-MF)
(==================================)

N10 G21 G17 G90 G94
N20 G28 G91 Z0.
N30 G90

(--- OP 1: SURFACAGE ---)
N40 T01 M06 (FRAISE A PLAQUETTES D63)
N50 G43 H01 Z100. M08
N60 S2500 M03
N70 G00 X-50. Y-45.
N80 Z5.
N90 G01 Z-1.5 F200.
N100 G01 X170. F800.
N110 G01 Y-25.
N120 G01 X-50.
N130 G01 Y-5.
N140 G01 X170.
N150 G01 Y15.
N160 G01 X-50.
N170 G01 Y35.
N180 G01 X170.
N190 G01 Y55.
N200 G01 X-50.
N210 G00 Z100.

(--- OP 2: FRAISAGE POCHE CENTRALE ---)
N220 T02 M06 (FRAISE CARBURE D16 4T)
N230 G43 H02 Z100.
N240 S6000 M03
N250 G00 X0. Y0.
N260 Z5.
N270 G01 Z-3. F300.
N280 G01 X15. F1200.
N290 G02 X15. Y0. I-15. J0. (HELICAL ENTRY)
N300 G01 X20.
N310 G03 X-20. Y0. I-20. J0.
N320 G03 X20. Y0. I20. J0.
N330 G01 Z-6. F300.
N340 G03 X-20. Y0. I-20. J0.
N350 G03 X20. Y0. I20. J0.
N360 G01 Z-9. F300.
N370 G03 X-20. Y0. I-20. J0.
N380 G03 X20. Y0. I20. J0.
N390 G01 Z-12. F300.
N400 G03 X-20. Y0. I-20. J0.
N410 G03 X20. Y0. I20. J0.
N420 G01 Z-15. F300.
N430 G03 X-20. Y0. I-20. J0.
N440 G03 X20. Y0. I20. J0.
N450 G00 Z100.

(--- OP 3: PERCAGE D11.8 x4 ---)
N460 T03 M06 (FORET CARBURE D11.8)
N470 G43 H03 Z100.
N480 S3200 M03
N490 G99 G81 Z-45. R5. F320.
N500 X-45. Y-30. (COIN 1)
N510 X45. Y-30.  (COIN 2)
N520 X-45. Y30.  (COIN 3)
N530 X45. Y30.   (COIN 4)
N540 G80
N550 G00 Z100.

(--- OP 4: ALESAGE D12 H7 x4 ---)
N560 T04 M06 (ALESOIR D12 H7)
N570 G43 H04 Z100.
N580 S4800 M03
N590 G99 G85 Z-40. R5. F96.
N600 X-45. Y-30.
N610 X45. Y-30.
N620 X-45. Y30.
N630 X45. Y30.
N640 G80
N650 G00 Z100.

(--- OP 5: CHANFREINAGE ---)
N660 T05 M06 (FRAISE CHANFREIN D10)
N670 G43 H05 Z100.
N680 S5000 M03
N690 G00 X-62. Y-42.
N700 Z5.
N710 G01 Z-2. F200.
N720 G01 X62. F500.
N730 G01 Y42.
N740 G01 X-62.
N750 G01 Y-42.
N760 G00 Z100.

(--- OP 6: CONTOURNAGE ---)
N770 T06 M06 (FRAISE CARBURE D20 4T)
N780 G43 H06 Z100.
N790 S4000 M03
N800 G00 X-70. Y-50.
N810 Z5.
N820 G01 Z-5. F400.
N830 G01 X70. F1600.
N840 G01 Y50.
N850 G01 X-70.
N860 G01 Y-50.
N870 G01 Z-10. F400.
N880 G01 X70. F1600.
N890 G01 Y50.
N900 G01 X-70.
N910 G01 Y-50.
N920 G00 Z100.

(--- FIN PROGRAMME ---)
N930 M09
N940 M05
N950 G28 G91 Z0.
N960 G28 X0. Y0.
N970 M30
%`;

const MOCK_RECENT_PROJECTS: Project[] = [
  {
    id: 'proj1',
    name: 'Bride_Moteur_V3.pdf',
    status: 'complete',
    fileFormat: 'PDF',
    createdAt: new Date(Date.now() - 2 * 3600000),
    updatedAt: new Date(Date.now() - 2 * 3600000),
    material: 'Aluminium 6061-T6',
    cncController: 'fanuc',
    dimensionCount: 24,
    operationCount: 8,
  },
  {
    id: 'proj2',
    name: 'Arbre_Transmission.dxf',
    status: 'complete',
    fileFormat: 'DXF',
    createdAt: new Date(Date.now() - 24 * 3600000),
    updatedAt: new Date(Date.now() - 24 * 3600000),
    material: 'Acier 1018',
    cncController: 'siemens',
    dimensionCount: 18,
    operationCount: 6,
  },
  {
    id: 'proj3',
    name: 'Carter_Pompe.dwg',
    status: 'complete',
    fileFormat: 'DWG',
    createdAt: new Date(Date.now() - 3 * 24 * 3600000),
    updatedAt: new Date(Date.now() - 3 * 24 * 3600000),
    material: 'Inox 316L',
    cncController: 'heidenhain',
    dimensionCount: 31,
    operationCount: 12,
  },
  {
    id: 'proj4',
    name: 'Engrenage_Reducteur.pdf',
    status: 'error',
    fileFormat: 'PDF',
    createdAt: new Date(Date.now() - 5 * 24 * 3600000),
    updatedAt: new Date(Date.now() - 5 * 24 * 3600000),
    material: 'Acier 4140',
    cncController: 'fanuc',
    dimensionCount: 0,
    operationCount: 0,
  },
];

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 's1', name: 'Analyse Document', description: 'Lecture et vectorisation du fichier', status: 'pending', progress: 0, icon: 'FileText' },
  { id: 's2', name: 'OCR & Extraction', description: 'Reconnaissance des textes et cotes', status: 'pending', progress: 0, icon: 'Eye' },
  { id: 's3', name: 'Détection Features', description: 'Identification des entités géométriques', status: 'pending', progress: 0, icon: 'Scan' },
  { id: 's4', name: 'Reconstruction 3D', description: 'Modélisation volumique paramétrique', status: 'pending', progress: 0, icon: 'Box' },
  { id: 's5', name: 'Calcul Opérations', description: 'Séquençage des usinages CNC', status: 'pending', progress: 0, icon: 'Settings' },
  { id: 's6', name: 'Trajectoires Outils', description: 'Génération des parcours optimisés', status: 'pending', progress: 0, icon: 'Route' },
  { id: 's7', name: 'Génération G-Code', description: 'Post-processeur contrôleur cible', status: 'pending', progress: 0, icon: 'Code2' },
  { id: 's8', name: 'Simulation', description: 'Vérification collision et rendu', status: 'pending', progress: 0, icon: 'Play' },
];

// ─── Store Interface ──────────────────────────────────────────────────────────

interface AppState {
  // Project state
  currentProject: Project | null;
  uploadedFile: File | null;
  analysisStatus: AnalysisStatus;
  analysisProgress: number;
  recentProjects: Project[];

  // Analysis pipeline
  pipelineSteps: PipelineStep[];
  currentPipelineStep: number;

  // Detected data
  detectedDimensions: Dimension[];
  machiningOperations: MachiningOperation[];
  currentMaterial: Material | null;
  gcode: string;
  overallConfidence: number;

  // UI state
  activeTab: ActiveTab;
  rightPanelTab: RightPanelTab;
  selectedDimensionId: string | null;
  selectedOperationId: string | null;

  // Settings
  cncController: CNCController;
  material: string;
  simulationSpeed: number;
  simulationState: SimulationState;
  simulationProgress: number;
  isSimulating: boolean;

  // Actions
  setUploadedFile: (file: File | null) => void;
  setAnalysisStatus: (status: AnalysisStatus) => void;
  setAnalysisProgress: (progress: number) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setSelectedDimension: (id: string | null) => void;
  setSelectedOperation: (id: string | null) => void;
  setCncController: (controller: CNCController) => void;
  setMaterial: (material: string) => void;
  setSimulationSpeed: (speed: number) => void;
  setSimulationState: (state: SimulationState) => void;
  setSimulationProgress: (progress: number) => void;
  updateDimension: (id: string, updates: Partial<Dimension>) => void;
  updatePipelineStep: (id: string, updates: Partial<PipelineStep>) => void;
  startAnalysis: (file: File) => void;
  resetAnalysis: () => void;
  loadMockData: () => void;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      currentProject: null,
      uploadedFile: null,
      analysisStatus: 'idle',
      analysisProgress: 0,
      recentProjects: MOCK_RECENT_PROJECTS,
      pipelineSteps: PIPELINE_STEPS.map(s => ({ ...s })),
      currentPipelineStep: -1,
      detectedDimensions: MOCK_DIMENSIONS,
      machiningOperations: MOCK_OPERATIONS,
      currentMaterial: MOCK_MATERIAL,
      gcode: MOCK_GCODE,
      overallConfidence: 94,
      activeTab: 'viewer',
      rightPanelTab: 'analyse',
      selectedDimensionId: null,
      selectedOperationId: null,
      cncController: 'fanuc',
      material: 'Aluminium 6061-T6',
      simulationSpeed: 1,
      simulationState: 'idle',
      simulationProgress: 0,
      isSimulating: false,

      // Actions
      setUploadedFile: (file) => set({ uploadedFile: file }),

      setAnalysisStatus: (status) => set({ analysisStatus: status }),

      setAnalysisProgress: (progress) => set({ analysisProgress: progress }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

      setSelectedDimension: (id) => set({ selectedDimensionId: id }),

      setSelectedOperation: (id) => set({ selectedOperationId: id }),

      setCncController: (controller) => set({ cncController: controller }),

      setMaterial: (material) => set({ material }),

      setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),

      setSimulationState: (state) =>
        set({ simulationState: state, isSimulating: state === 'playing' }),

      setSimulationProgress: (progress) => set({ simulationProgress: progress }),

      updateDimension: (id, updates) =>
        set((state) => ({
          detectedDimensions: state.detectedDimensions.map((d) =>
            d.id === id ? { ...d, ...updates, isEdited: true } : d
          ),
        })),

      updatePipelineStep: (id, updates) =>
        set((state) => ({
          pipelineSteps: state.pipelineSteps.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      startAnalysis: (file: File) => {
        const { updatePipelineStep } = get();

        // Reset pipeline
        const freshSteps = PIPELINE_STEPS.map(s => ({ ...s, status: 'pending' as const, progress: 0 }));
        set({
          uploadedFile: file,
          analysisStatus: 'uploading',
          analysisProgress: 0,
          pipelineSteps: freshSteps,
          currentPipelineStep: 0,
          detectedDimensions: [],
          machiningOperations: [],
          gcode: '',
        });

        // Simulate pipeline progression
        const stepDurations = [800, 1200, 1500, 2000, 1000, 1200, 800, 600];

        let stepIndex = 0;
        const runStep = () => {
          if (stepIndex >= PIPELINE_STEPS.length) {
            set({
              analysisStatus: 'complete',
              analysisProgress: 100,
              detectedDimensions: MOCK_DIMENSIONS,
              machiningOperations: MOCK_OPERATIONS,
              currentMaterial: MOCK_MATERIAL,
              gcode: MOCK_GCODE,
              overallConfidence: 94,
              currentProject: {
                id: 'proj_new',
                name: file.name,
                status: 'complete',
                fileFormat: 'PDF',
                createdAt: new Date(),
                updatedAt: new Date(),
                material: 'Aluminium 6061-T6',
                cncController: get().cncController,
                dimensionCount: MOCK_DIMENSIONS.length,
                operationCount: MOCK_OPERATIONS.length,
              },
            });
            return;
          }

          const stepId = PIPELINE_STEPS[stepIndex].id;
          updatePipelineStep(stepId, { status: 'running', progress: 0 });
          set({ currentPipelineStep: stepIndex, analysisStatus: 'analyzing' });

          // Animate progress for this step
          let stepProgress = 0;
          const interval = setInterval(() => {
            stepProgress += Math.random() * 15 + 5;
            if (stepProgress >= 100) {
              stepProgress = 100;
              clearInterval(interval);
              updatePipelineStep(stepId, { status: 'complete', progress: 100 });
              const overallProgress = Math.round(((stepIndex + 1) / PIPELINE_STEPS.length) * 100);
              set({ analysisProgress: overallProgress });
              stepIndex++;
              setTimeout(runStep, 200);
            } else {
              updatePipelineStep(stepId, { progress: stepProgress });
              const overallProgress = Math.round(
                ((stepIndex + stepProgress / 100) / PIPELINE_STEPS.length) * 100
              );
              set({ analysisProgress: overallProgress });
            }
          }, stepDurations[stepIndex] / 10);
        };

        setTimeout(runStep, 500);
      },

      resetAnalysis: () => {
        set({
          currentProject: null,
          uploadedFile: null,
          analysisStatus: 'idle',
          analysisProgress: 0,
          pipelineSteps: PIPELINE_STEPS.map(s => ({ ...s })),
          currentPipelineStep: -1,
          detectedDimensions: MOCK_DIMENSIONS,
          machiningOperations: MOCK_OPERATIONS,
          currentMaterial: MOCK_MATERIAL,
          gcode: MOCK_GCODE,
          selectedDimensionId: null,
          selectedOperationId: null,
        });
      },

      loadMockData: () => {
        set({
          detectedDimensions: MOCK_DIMENSIONS,
          machiningOperations: MOCK_OPERATIONS,
          currentMaterial: MOCK_MATERIAL,
          gcode: MOCK_GCODE,
          overallConfidence: 94,
          analysisStatus: 'complete',
          analysisProgress: 100,
        });
      },
    })),
    { name: 'mathv2-store' }
  )
);
