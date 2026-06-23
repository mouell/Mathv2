'use client';

import React, { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  Stats,
  PerspectiveCamera,
  Environment,
  GizmoHelper,
  GizmoViewport,
} from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import {
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Eye,
  EyeOff,
  Grid3X3,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import AnnotationOverlay from './AnnotationOverlay';

// ─── Part Geometry ────────────────────────────────────────────────────────────

interface HoleProps {
  position: [number, number, number];
  radius?: number;
  depth?: number;
  isSelected?: boolean;
}

const Hole: React.FC<HoleProps> = ({
  position,
  radius = 0.006,
  depth = 0.04,
  isSelected = false,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={meshRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius, depth, 32]} />
      <meshStandardMaterial
        color={isSelected ? '#00d4ff' : '#0a0a12'}
        metalness={0.9}
        roughness={0.3}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

interface PocketProps {
  position: [number, number, number];
  width?: number;
  height?: number;
  depth?: number;
}

const Pocket: React.FC<PocketProps> = ({
  position,
  width = 0.04,
  height = 0.03,
  depth = 0.015,
}) => (
  <mesh position={position}>
    <boxGeometry args={[width, depth, height]} />
    <meshStandardMaterial
      color="#0a0a12"
      metalness={0.95}
      roughness={0.2}
      side={THREE.BackSide}
    />
  </mesh>
);

// ─── Main Part ────────────────────────────────────────────────────────────────

interface MainPartProps {
  hoveredFace: number | null;
  setHoveredFace: (face: number | null) => void;
}

const MainPart: React.FC<MainPartProps> = ({ hoveredFace, setHoveredFace }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Slow auto-rotation when idle
  useFrame((state) => {
    if (!meshRef.current) return;
  });

  // 120mm x 40mm x 80mm block (scaled to units)
  const W = 0.12; // x
  const H = 0.04; // y (height)
  const D = 0.08; // z

  // Hole positions (corner holes at ±45mm, ±30mm)
  const holePositions: [number, number, number][] = [
    [-0.045, 0, -0.03],
    [0.045, 0, -0.03],
    [-0.045, 0, 0.03],
    [0.045, 0, 0.03],
  ];

  return (
    <group>
      {/* Main block */}
      <mesh
        ref={meshRef}
        receiveShadow
        castShadow
        onPointerMove={(e) => {
          e.stopPropagation();
          setHoveredFace(e.faceIndex ?? null);
        }}
        onPointerLeave={() => setHoveredFace(null)}
      >
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial
          color="#8090a0"
          metalness={0.75}
          roughness={0.2}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Chamfered top edges (visual approximation using thin boxes) */}
      <mesh position={[0, H / 2 + 0.001, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[W - 0.004, 0.002, D - 0.004]} />
        <meshStandardMaterial color="#a0b0c0" metalness={0.8} roughness={0.15} />
      </mesh>

      {/* Holes */}
      {holePositions.map((pos, i) => (
        <Hole key={i} position={pos} radius={0.006} depth={H + 0.001} />
      ))}

      {/* Center pocket */}
      <Pocket
        position={[0, H / 2 - 0.0075, 0]}
        width={0.05}
        height={0.035}
        depth={0.015}
      />

      {/* Hole cylinders (visible geometry for holes) */}
      {holePositions.map((pos, i) => (
        <mesh key={`hole-vis-${i}`} position={pos} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, H, 32]} />
          <meshStandardMaterial
            color="#050508"
            metalness={0.9}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* Pocket top face */}
      <mesh position={[0, H / 2 - 0.007, 0]}>
        <boxGeometry args={[0.05, 0.001, 0.035]} />
        <meshStandardMaterial
          color="#606878"
          metalness={0.85}
          roughness={0.18}
        />
      </mesh>

      {/* Edge highlights on top surface */}
      {[
        { pos: [0, H / 2 + 0.0001, -D / 2 + 0.001] as [number, number, number], rot: [0, 0, 0] as [number, number, number], size: [W, 0.0003, 0.001] as [number, number, number] },
        { pos: [0, H / 2 + 0.0001, D / 2 - 0.001] as [number, number, number], rot: [0, 0, 0] as [number, number, number], size: [W, 0.0003, 0.001] as [number, number, number] },
        { pos: [-W / 2 + 0.001, H / 2 + 0.0001, 0] as [number, number, number], rot: [0, 0, 0] as [number, number, number], size: [0.001, 0.0003, D] as [number, number, number] },
        { pos: [W / 2 - 0.001, H / 2 + 0.0001, 0] as [number, number, number], rot: [0, 0, 0] as [number, number, number], size: [0.001, 0.0003, D] as [number, number, number] },
      ].map((edge, i) => (
        <mesh key={`edge-${i}`} position={edge.pos} rotation={edge.rot}>
          <boxGeometry args={edge.size} />
          <meshStandardMaterial
            color="#c0d0e0"
            metalness={0.95}
            roughness={0.05}
            emissive="#2040a0"
            emissiveIntensity={0.1}
          />
        </mesh>
      ))}
    </group>
  );
};

// ─── Axis Helper ──────────────────────────────────────────────────────────────

const AxisLabels: React.FC = () => {
  return (
    <group>
      <arrowHelper
        args={[
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          0.08,
          0xff2020,
          0.01,
          0.006,
        ]}
      />
      <arrowHelper
        args={[
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          0.08,
          0x20ff20,
          0.01,
          0.006,
        ]}
      />
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          0.08,
          0x2080ff,
          0.01,
          0.006,
        ]}
      />
    </group>
  );
};

// ─── Scene ────────────────────────────────────────────────────────────────────

interface SceneProps {
  showGrid: boolean;
  showAnnotations: boolean;
  showStats: boolean;
}

const Scene: React.FC<SceneProps> = ({ showGrid, showAnnotations, showStats }) => {
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);
  const { detectedDimensions } = useAppStore();

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0.18, 0.14, 0.2]} fov={45} />

      {/* Lighting */}
      <ambientLight intensity={0.4} color="#8090ff" />
      <directionalLight
        position={[1, 2, 1]}
        intensity={1.8}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-1, 1, -1]} intensity={0.6} color="#6080ff" />
      <pointLight position={[0, 0.3, 0]} intensity={0.5} color="#00d4ff" distance={0.5} />

      {/* Environment */}
      <Environment preset="studio" />

      {/* Controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={0.05}
        maxDistance={1}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        panSpeed={0.8}
      />

      {/* Grid */}
      {showGrid && (
        <Grid
          position={[0, -0.021, 0]}
          args={[0.5, 0.5]}
          cellSize={0.01}
          cellThickness={0.5}
          cellColor="#1e2030"
          sectionSize={0.05}
          sectionThickness={1}
          sectionColor="#2a2a4a"
          fadeDistance={0.5}
          fadeStrength={1}
          infiniteGrid
        />
      )}

      {/* Main part */}
      <Suspense fallback={null}>
        <MainPart hoveredFace={hoveredFace} setHoveredFace={setHoveredFace} />
      </Suspense>

      {/* Annotations */}
      {showAnnotations && (
        <AnnotationOverlay dimensions={detectedDimensions} scale={0.001} />
      )}

      {/* Axis */}
      <group position={[-0.18, -0.018, -0.08]}>
        <AxisLabels />
      </group>

      {/* Gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport
          axisColors={['#ff3366', '#00ff88', '#0066ff']}
          labelColor="white"
        />
      </GizmoHelper>

      {/* Stats */}
      {showStats && <Stats className="!absolute !left-auto !right-2 !top-auto !bottom-8" />}
    </>
  );
};

// ─── Toolbar ──────────────────────────────────────────────────────────────────

interface ToolbarProps {
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  showAnnotations: boolean;
  setShowAnnotations: (v: boolean) => void;
  showStats: boolean;
  setShowStats: (v: boolean) => void;
  onResetCamera: () => void;
}

const ViewerToolbar: React.FC<ToolbarProps> = ({
  showGrid,
  setShowGrid,
  showAnnotations,
  setShowAnnotations,
  showStats,
  setShowStats,
  onResetCamera,
}) => {
  const btnClass = (active: boolean) => `
    p-1.5 rounded transition-all duration-150 flex items-center justify-center
    ${active
      ? 'bg-primary/20 border-primary/50 text-primary'
      : 'bg-surface-2/50 border-border text-text-muted hover:text-text-primary hover:bg-surface-3/50'
    }
  `;

  return (
    <div
      className="absolute top-3 right-3 flex flex-col gap-1 z-10"
      style={{ pointerEvents: 'auto' }}
    >
      {[
        { icon: <Grid3X3 size={14} />, active: showGrid, onClick: () => setShowGrid(!showGrid), title: 'Grille' },
        { icon: showAnnotations ? <Eye size={14} /> : <EyeOff size={14} />, active: showAnnotations, onClick: () => setShowAnnotations(!showAnnotations), title: 'Annotations' },
        { icon: <RotateCcw size={14} />, active: false, onClick: onResetCamera, title: 'Réinitialiser caméra' },
        { icon: <Layers size={14} />, active: showStats, onClick: () => setShowStats(!showStats), title: 'Statistiques' },
      ].map((btn, i) => (
        <motion.button
          key={i}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={btn.onClick}
          title={btn.title}
          className={btnClass(btn.active)}
          style={{
            border: '1px solid',
            width: 30,
            height: 30,
            borderColor: btn.active ? 'rgba(0, 102, 255, 0.5)' : '#1e1e2e',
          }}
        >
          {btn.icon}
        </motion.button>
      ))}
    </div>
  );
};

// ─── View Mode Tabs ───────────────────────────────────────────────────────────

const VIEW_PRESETS = ['Perspective', 'Dessus', 'Face', 'Droit'];

// ─── Three Viewer Main ────────────────────────────────────────────────────────

const ThreeViewer: React.FC = () => {
  const [showGrid, setShowGrid] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [activePreset, setActivePreset] = useState(0);
  const controlsRef = useRef<any>(null);

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* View preset tabs */}
      <div
        className="absolute top-3 left-3 flex gap-1 z-10"
        style={{ pointerEvents: 'auto' }}
      >
        {VIEW_PRESETS.map((preset, i) => (
          <motion.button
            key={preset}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActivePreset(i)}
            className="px-2.5 py-1 rounded text-2xs font-medium transition-all duration-150"
            style={{
              backgroundColor: activePreset === i
                ? 'rgba(0, 102, 255, 0.2)'
                : 'rgba(18, 18, 26, 0.7)',
              border: `1px solid ${activePreset === i ? 'rgba(0, 102, 255, 0.5)' : '#1e1e2e'}`,
              color: activePreset === i ? '#3385ff' : '#5a5a78',
              backdropFilter: 'blur(8px)',
            }}
          >
            {preset}
          </motion.button>
        ))}
      </div>

      {/* Toolbar */}
      <ViewerToolbar
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showAnnotations={showAnnotations}
        setShowAnnotations={setShowAnnotations}
        showStats={showStats}
        setShowStats={setShowStats}
        onResetCamera={handleResetCamera}
      />

      {/* Scale indicator */}
      <div
        className="absolute bottom-4 left-4 flex items-center gap-2 z-10"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="h-px"
          style={{ width: 60, backgroundColor: '#3385ff' }}
        />
        <span className="text-2xs font-mono" style={{ color: '#3385ff' }}>
          30 mm
        </span>
      </div>

      {/* Part info */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute bottom-4 right-3 z-10 px-2.5 py-1.5 rounded"
        style={{
          backgroundColor: 'rgba(18, 18, 26, 0.8)',
          border: '1px solid #1e1e2e',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      >
        <div className="text-2xs space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Pièce:</span>
            <span className="text-text-primary font-mono">120×80×40 mm</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Matériau:</span>
            <span style={{ color: '#00d4ff' }} className="font-mono">Al 6061-T6</span>
          </div>
        </div>
      </motion.div>

      {/* Three.js Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['#0a0a0f']} />
        <fog attach="fog" args={['#0a0a0f', 0.8, 2]} />
        <Scene
          showGrid={showGrid}
          showAnnotations={showAnnotations}
          showStats={showStats}
        />
      </Canvas>
    </div>
  );
};

export default ThreeViewer;
