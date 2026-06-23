'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Layers3,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Box,
  Code2,
  Play,
  Github,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightPanel from '@/components/layout/RightPanel';
import ThreeViewer from '@/components/viewer/ThreeViewer';
import GCodeEditor from '@/components/gcode/GCodeEditor';
import SimulationViewer from '@/components/simulation/SimulationViewer';
import AnalysisProgress from '@/components/ui/AnalysisProgress';
import type { ActiveTab } from '@/types';

// ─── Tab Definition ───────────────────────────────────────────────────────────

const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { id: 'viewer', label: 'Visionneuse 3D', icon: <Box size={14} /> },
  { id: 'gcode', label: 'G-Code', icon: <Code2 size={14} /> },
  { id: 'simulation', label: 'Simulation', icon: <Play size={14} /> },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC = () => {
  const { analysisStatus, overallConfidence, detectedDimensions, machiningOperations } =
    useAppStore();

  if (analysisStatus === 'idle')
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
        style={{
          backgroundColor: 'rgba(90,90,120,0.15)',
          border: '1px solid rgba(90,90,120,0.3)',
          color: '#5a5a78',
        }}
      >
        <span className="status-dot status-dot-pending" />
        En attente
      </div>
    );

  if (analysisStatus === 'uploading' || analysisStatus === 'analyzing')
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
        style={{
          backgroundColor: 'rgba(0,102,255,0.12)',
          border: '1px solid rgba(0,102,255,0.35)',
          color: '#3385ff',
        }}
      >
        <Loader2 size={11} className="animate-spin" />
        Analyse en cours...
      </div>
    );

  if (analysisStatus === 'complete')
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2"
      >
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
          style={{
            backgroundColor: 'rgba(0,255,136,0.1)',
            border: '1px solid rgba(0,255,136,0.35)',
            color: '#00ff88',
          }}
        >
          <CheckCircle2 size={11} />
          {detectedDimensions.length} cotes · {machiningOperations.length} ops
        </div>
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono"
          style={{
            backgroundColor: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.3)',
            color: '#00d4ff',
          }}
        >
          <Zap size={10} />
          {overallConfidence}% conf.
        </div>
      </motion.div>
    );

  if (analysisStatus === 'error')
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
        style={{
          backgroundColor: 'rgba(255,51,102,0.1)',
          border: '1px solid rgba(255,51,102,0.35)',
          color: '#ff3366',
        }}
      >
        <AlertCircle size={11} />
        Erreur d&apos;analyse
      </div>
    );

  return null;
};

// ─── Top Bar ──────────────────────────────────────────────────────────────────

const TopBar: React.FC = () => {
  const { activeTab, setActiveTab, currentProject } = useAppStore();

  return (
    <div
      className="flex items-center justify-between px-4 h-12 flex-shrink-0 z-20"
      style={{
        backgroundColor: '#0d0d14',
        borderBottom: '1px solid #1e1e2e',
        boxShadow: '0 1px 0 rgba(0,0,0,0.5)',
      }}
    >
      {/* Left: Logo + project name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #0066ff, #00d4ff)',
              boxShadow: '0 0 12px rgba(0,102,255,0.5)',
            }}
          >
            <Cpu size={14} color="white" />
          </div>
          <div>
            <span
              className="font-bold text-sm tracking-tight"
              style={{ color: '#e8e8f0' }}
            >
              Math
            </span>
            <span
              className="font-bold text-sm tracking-tight"
              style={{ color: '#0066ff' }}
            >
              V2
            </span>
          </div>
        </div>

        {currentProject && (
          <>
            <div style={{ width: 1, height: 20, backgroundColor: '#1e1e2e' }} />
            <div className="flex items-center gap-1.5">
              <Layers3 size={12} style={{ color: '#5a5a78' }} />
              <span className="text-xs font-medium truncate max-w-[200px]" style={{ color: '#9898b0' }}>
                {currentProject.name}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center: tabs */}
      <div className="flex items-center gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150"
            style={{
              color: activeTab === tab.id ? '#e8e8f0' : '#5a5a78',
              backgroundColor:
                activeTab === tab.id ? 'rgba(0,102,255,0.15)' : 'transparent',
              border:
                activeTab === tab.id
                  ? '1px solid rgba(0,102,255,0.4)'
                  : '1px solid transparent',
            }}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-px rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #0066ff, #00d4ff)',
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Right: status + settings */}
      <div className="flex items-center gap-3">
        <StatusBadge />
        <button
          className="p-1.5 rounded transition-colors hover:bg-surface-2"
          style={{ color: '#5a5a78' }}
          title="Paramètres"
        >
          <Settings size={15} />
        </button>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded transition-colors hover:bg-surface-2"
          style={{ color: '#5a5a78' }}
        >
          <Github size={15} />
        </a>
      </div>
    </div>
  );
};

// ─── Center Viewer ────────────────────────────────────────────────────────────

const CenterContent: React.FC = () => {
  const { activeTab, analysisStatus } = useAppStore();

  return (
    <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
      <AnimatePresence mode="wait">
        {activeTab === 'viewer' && (
          <motion.div
            key="viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 relative"
          >
            {analysisStatus === 'uploading' || analysisStatus === 'analyzing' ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(4px)' }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-md mx-4 rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: '#12121a',
                    border: '1px solid #1e1e2e',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                  }}
                >
                  <AnalysisProgress />
                </motion.div>
              </div>
            ) : null}
            <ThreeViewer />
          </motion.div>
        )}

        {activeTab === 'gcode' && (
          <motion.div
            key="gcode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <GCodeEditor />
          </motion.div>
        )}

        {activeTab === 'simulation' && (
          <motion.div
            key="simulation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <SimulationViewer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { loadMockData } = useAppStore();

  // Load mock data on mount for demo
  useEffect(() => {
    loadMockData();
  }, [loadMockData]);

  const { startAnalysis } = useAnalysis();

  return (
    <div className="app-layout flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: 280px */}
        <div
          className="flex-shrink-0 overflow-hidden flex flex-col"
          style={{ width: 280, borderRight: '1px solid #1e1e2e' }}
        >
          <LeftSidebar onFileUpload={startAnalysis} />
        </div>

        {/* Central viewer: flex-1 */}
        <CenterContent />

        {/* Right panel: 360px */}
        <div
          className="flex-shrink-0 overflow-hidden flex flex-col"
          style={{ width: 360, borderLeft: '1px solid #1e1e2e' }}
        >
          <RightPanel />
        </div>
      </div>
    </div>
  );
}
