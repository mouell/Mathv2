'use client';

import React, { useRef, useState, useEffect, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  PerspectiveCamera,
  Trail,
  Line,
} from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  Gauge,
  Clock,
  Wrench,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

// ─── Tool Model ───────────────────────────────────────────────────────────────

interface ToolModelProps {
  position: [number, number, number];
  isActive: boolean;
}

const EndMill: React.FC<ToolModelProps> = ({ position, isActive }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current && isActive) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 20;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Tool shank */}
      <mesh position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.05, 16]} />
        <meshStandardMaterial
          color="#606870"
          metalness={0.95}
          roughness={0.1}
        />
      </mesh>

      {/* Tool cutting end */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.0035, 0.02, 16]} />
        <meshStandardMaterial
          color="#a0a8b0"
          metalness={0.98}
          roughness={0.05}
          emissive={isActive ? '#002255' : '#000000'}
          emissiveIntensity={isActive ? 0.3 : 0}
        />
      </mesh>

      {/* Tool tip */}
      <mesh position={[0, -0.012, 0]}>
        <coneGeometry args={[0.0035, 0.004, 16]} />
        <meshStandardMaterial
          color="#c0c8d0"
          metalness={0.99}
          roughness={0.02}
        />
      </mesh>

      {/* Active glow */}
      {isActive && (
        <pointLight
          position={[0, -0.01, 0]}
          intensity={0.3}
          color="#0066ff"
          distance={0.05}
        />
      )}
    </group>
  );
};

// ─── Stock Material ───────────────────────────────────────────────────────────

interface StockProps {
  removalProgress: number;
}

const Stock: React.FC<StockProps> = ({ removalProgress }) => {
  // Stock dimensions: 125×85×45mm (slightly oversized)
  const W = 0.125;
  const H = 0.045;
  const D = 0.085;

  const opacity = Math.max(0.15, 0.4 - removalProgress * 0.25);

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[W, H, D]} />
      <meshStandardMaterial
        color="#506070"
        metalness={0.3}
        roughness={0.7}
        transparent
        opacity={opacity}
        wireframe={false}
      />
    </mesh>
  );
};

// ─── Finished Part (Revealed) ─────────────────────────────────────────────────

const FinishedPart: React.FC<{ progress: number }> = ({ progress }) => {
  const opacity = Math.min(1, progress * 2);

  if (progress < 0.3) return null;

  return (
    <mesh>
      <boxGeometry args={[0.12, 0.04, 0.08]} />
      <meshStandardMaterial
        color="#8090a0"
        metalness={0.75}
        roughness={0.2}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
};

// ─── Toolpath Visualization ───────────────────────────────────────────────────

interface ToolpathProps {
  points: [number, number, number][];
  progress: number;
  color?: string;
}

const ToolpathLine: React.FC<ToolpathProps> = ({ points, progress, color = '#0066ff' }) => {
  const visibleCount = Math.floor(points.length * progress);
  const visiblePoints = points.slice(0, Math.max(2, visibleCount));

  if (visiblePoints.length < 2) return null;

  return (
    <Line
      points={visiblePoints}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.6}
    />
  );
};

// ─── Animated Tool in Scene ───────────────────────────────────────────────────

interface AnimatedToolProps {
  toolpathPoints: [number, number, number][];
  progress: number;
  isPlaying: boolean;
}

const AnimatedTool: React.FC<AnimatedToolProps> = ({
  toolpathPoints,
  progress,
  isPlaying,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current || toolpathPoints.length < 2) return;

    const idx = Math.floor(progress * (toolpathPoints.length - 1));
    const safeIdx = Math.min(idx, toolpathPoints.length - 1);
    const pt = toolpathPoints[safeIdx];

    if (pt) {
      groupRef.current.position.set(pt[0], pt[1] + 0.012, pt[2]);
    }
  });

  const startPt = toolpathPoints[0] || [0, 0.05, 0];

  return (
    <group
      ref={groupRef}
      position={[startPt[0], (startPt[1] || 0) + 0.012, startPt[2] || 0]}
    >
      <EndMill position={[0, 0, 0]} isActive={isPlaying} />
    </group>
  );
};

// ─── Scene ────────────────────────────────────────────────────────────────────

interface SimSceneProps {
  progress: number;
  isPlaying: boolean;
}

// Generate a representative toolpath for display
const generateToolpath = (): [number, number, number][] => {
  const points: [number, number, number][] = [];
  const H = 0.04;

  // Approach
  points.push([0, 0.1, -0.04]);
  points.push([0, H + 0.005, -0.04]);

  // Facing pass
  for (let x = -0.065; x <= 0.065; x += 0.01) {
    points.push([x, H - 0.0015, -0.04]);
    points.push([x, H - 0.0015, 0.04]);
    x += 0.01;
    if (x <= 0.065) {
      points.push([x, H - 0.0015, 0.04]);
      points.push([x, H - 0.0015, -0.04]);
    }
  }

  // Pocket
  points.push([0, H + 0.005, 0]);
  for (let r = 0.005; r <= 0.022; r += 0.004) {
    const steps = Math.max(8, Math.floor(r * 200));
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      points.push([
        Math.cos(angle) * r,
        H - 0.015,
        Math.sin(angle) * r * (0.035 / 0.025),
      ]);
    }
  }

  // Holes
  const holePos: [number, number][] = [
    [-0.045, -0.03],
    [0.045, -0.03],
    [-0.045, 0.03],
    [0.045, 0.03],
  ];
  holePos.forEach(([hx, hz]) => {
    points.push([hx, 0.05, hz]);
    points.push([hx, H + 0.002, hz]);
    for (let d = 0; d <= H; d += 0.002) {
      points.push([hx, H - d, hz]);
    }
    points.push([hx, 0.05, hz]);
  });

  // Contour
  points.push([-0.062, H - 0.005, -0.042]);
  const corners: [number, number][] = [
    [0.062, -0.042],
    [0.062, 0.042],
    [-0.062, 0.042],
    [-0.062, -0.042],
  ];
  corners.forEach(([cx, cz]) => {
    points.push([cx, H - 0.005, cz]);
  });
  points.push([-0.062, H - 0.005, -0.042]);

  // Retract
  points.push([0, 0.1, 0]);

  return points;
};

const TOOLPATH = generateToolpath();

const SimulationScene: React.FC<SimSceneProps> = ({ progress, isPlaying }) => {
  const splitPoint = 0.7; // After 70% show finished part

  return (
    <>
      <PerspectiveCamera makeDefault position={[0.2, 0.18, 0.25]} fov={45} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[1, 2, 1]} intensity={1.5} castShadow />
      <directionalLight position={[-1, 0.5, -1]} intensity={0.4} color="#6080ff" />

      <OrbitControls enableDamping dampingFactor={0.05} />

      <Grid
        position={[0, -0.023, 0]}
        args={[0.6, 0.6]}
        cellSize={0.01}
        cellColor="#1e2030"
        sectionSize={0.05}
        sectionColor="#2a2a4a"
        fadeDistance={0.6}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Worktable */}
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <boxGeometry args={[0.3, 0.01, 0.2]} />
        <meshStandardMaterial color="#1a1a2a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Stock */}
      <group position={[0, -0.0225 + 0.045 / 2, 0]}>
        <Stock removalProgress={progress} />
        {progress > 0.3 && <FinishedPart progress={(progress - 0.3) / 0.7} />}
      </group>

      {/* Toolpath line */}
      <ToolpathLine
        points={TOOLPATH}
        progress={progress}
        color="#0066ff"
      />

      {/* Animated tool */}
      <AnimatedTool
        toolpathPoints={TOOLPATH}
        progress={progress}
        isPlaying={isPlaying}
      />
    </>
  );
};

// ─── Controls UI ──────────────────────────────────────────────────────────────

const OPERATION_LABELS: Record<number, string> = {
  0: 'Approche initiale',
  10: 'Surfaçage face supérieure',
  35: 'Fraisage poche centrale',
  55: 'Perçage Ø12 H7 — Coin 1',
  60: 'Perçage Ø12 H7 — Coin 2',
  65: 'Perçage Ø12 H7 — Coin 3',
  70: 'Perçage Ø12 H7 — Coin 4',
  75: 'Alésage Ø12 H7 (×4)',
  85: 'Chanfreinage arêtes',
  92: 'Contournage extérieur',
  98: 'Retrait outil',
};

function getCurrentOperation(progress: number): string {
  const pct = Math.floor(progress * 100);
  let lastKey = 0;
  for (const key of Object.keys(OPERATION_LABELS).map(Number).sort((a, b) => a - b)) {
    if (pct >= key) lastKey = key;
  }
  return OPERATION_LABELS[lastKey] || 'Initialisation';
}

function formatSimTime(progress: number, totalSeconds: number = 675): string {
  const elapsed = Math.floor(progress * totalSeconds);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ─── Simulation Viewer ────────────────────────────────────────────────────────

const SimulationViewer: React.FC = () => {
  const {
    simulationState,
    simulationProgress,
    simulationSpeed,
    setSimulationState,
    setSimulationProgress,
    setSimulationSpeed,
  } = useAppStore();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef(simulationProgress);
  const isPlaying = simulationState === 'playing';

  // Keep ref in sync with state
  progressRef.current = simulationProgress;

  const TOTAL_SECONDS = 675;
  const speedMultipliers = [1, 2, 5, 10];

  const startSim = useCallback(() => {
    if (simulationProgress >= 1) {
      setSimulationProgress(0);
    }
    setSimulationState('playing');
  }, [simulationProgress, setSimulationProgress, setSimulationState]);

  const pauseSim = useCallback(() => {
    setSimulationState('paused');
  }, [setSimulationState]);

  const stopSim = useCallback(() => {
    setSimulationState('idle');
    setSimulationProgress(0);
  }, [setSimulationState, setSimulationProgress]);

  useEffect(() => {
    if (isPlaying) {
      const increment = (1 / TOTAL_SECONDS) * (simulationSpeed / 10);
      intervalRef.current = setInterval(() => {
        const next = progressRef.current + increment;
        if (next >= 1) {
          setSimulationState('complete');
          setSimulationProgress(1);
        } else {
          setSimulationProgress(next);
        }
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, simulationSpeed, setSimulationProgress, setSimulationState]);

  const currentOp = getCurrentOperation(simulationProgress);

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0a0f' }}>
      {/* Canvas */}
      <div className="flex-1 relative">
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
          }}
        >
          <color attach="background" args={['#0a0a0f']} />
          <Suspense fallback={null}>
            <SimulationScene progress={simulationProgress} isPlaying={isPlaying} />
          </Suspense>
        </Canvas>

        {/* Current operation overlay */}
        <div
          className="absolute top-3 left-3 px-3 py-2 rounded"
          style={{
            backgroundColor: 'rgba(18, 18, 26, 0.85)',
            border: '1px solid #1e1e2e',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isPlaying ? '#00ff88' : '#5a5a78',
                boxShadow: isPlaying ? '0 0 6px #00ff88' : 'none',
                animation: isPlaying ? 'pulse 1s infinite' : 'none',
              }}
            />
            <span className="text-xs font-medium" style={{ color: '#e8e8f0' }}>
              {currentOp}
            </span>
          </div>
        </div>

        {/* Time display */}
        <div
          className="absolute top-3 right-3 px-3 py-2 rounded"
          style={{
            backgroundColor: 'rgba(18, 18, 26, 0.85)',
            border: '1px solid #1e1e2e',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-2">
            <Clock size={12} style={{ color: '#9898b0' }} />
            <span className="text-xs font-mono" style={{ color: '#00d4ff' }}>
              {formatSimTime(simulationProgress)} / {formatSimTime(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div
        className="flex-shrink-0 px-4 py-3 space-y-3"
        style={{
          background: '#12121a',
          borderTop: '1px solid #1e1e2e',
        }}
      >
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-2xs text-text-muted">Progression usinage</span>
            <span className="text-2xs font-mono" style={{ color: '#0066ff' }}>
              {Math.round(simulationProgress * 100)}%
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden cursor-pointer relative"
            style={{ backgroundColor: 'rgba(0, 102, 255, 0.1)' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const pct = Math.max(0, Math.min(1, x / rect.width));
              setSimulationProgress(pct);
            }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #0066ff, #00d4ff)',
                width: `${simulationProgress * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Buttons + speed */}
        <div className="flex items-center justify-between">
          {/* Transport controls */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopSim}
              className="p-2 rounded transition-colors"
              style={{
                backgroundColor: 'rgba(255, 51, 102, 0.1)',
                border: '1px solid rgba(255, 51, 102, 0.3)',
                color: '#ff3366',
              }}
              title="Stop"
            >
              <Square size={14} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isPlaying ? pauseSim : startSim}
              className="px-4 py-2 rounded flex items-center gap-2 font-medium text-sm transition-colors"
              style={{
                background: isPlaying
                  ? 'rgba(255, 107, 0, 0.15)'
                  : 'linear-gradient(135deg, #0052cc, #0066ff)',
                border: `1px solid ${isPlaying ? 'rgba(255, 107, 0, 0.4)' : 'rgba(0, 102, 255, 0.5)'}`,
                color: isPlaying ? '#ff6b00' : '#ffffff',
                boxShadow: isPlaying
                  ? 'none'
                  : '0 0 12px rgba(0, 102, 255, 0.3)',
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <>
                  <Pause size={14} /> Pause
                </>
              ) : (
                <>
                  <Play size={14} /> {simulationProgress > 0 ? 'Reprendre' : 'Lancer'}
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSimulationProgress(Math.min(1, simulationProgress + 0.1))}
              className="p-2 rounded transition-colors"
              style={{
                backgroundColor: 'rgba(0, 102, 255, 0.08)',
                border: '1px solid #1e1e2e',
                color: '#5a5a78',
              }}
              title="Avancer"
            >
              <SkipForward size={14} />
            </motion.button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-2">
            <Gauge size={12} style={{ color: '#5a5a78' }} />
            <span className="text-2xs text-text-muted">Vitesse:</span>
            <div className="flex gap-1">
              {speedMultipliers.map((speed) => (
                <motion.button
                  key={speed}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSimulationSpeed(speed)}
                  className="px-2 py-1 rounded text-2xs font-mono transition-all"
                  style={{
                    backgroundColor:
                      simulationSpeed === speed
                        ? 'rgba(0, 102, 255, 0.2)'
                        : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${simulationSpeed === speed ? 'rgba(0, 102, 255, 0.5)' : '#1e1e2e'}`,
                    color: simulationSpeed === speed ? '#3385ff' : '#5a5a78',
                  }}
                >
                  x{speed}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationViewer;
