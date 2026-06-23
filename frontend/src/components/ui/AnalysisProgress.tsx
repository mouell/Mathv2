'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Eye,
  Scan,
  Box,
  Settings,
  Route,
  Code2,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { PipelineStep, PipelineStepStatus } from '@/types';

// ─── Step Icon Map ────────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, React.ReactNode> = {
  FileText: <FileText size={14} />,
  Eye: <Eye size={14} />,
  Scan: <Scan size={14} />,
  Box: <Box size={14} />,
  Settings: <Settings size={14} />,
  Route: <Route size={14} />,
  Code2: <Code2 size={14} />,
  Play: <Play size={14} />,
};

// ─── Status Styles ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PipelineStepStatus,
  { color: string; bgColor: string; borderColor: string; icon: React.ReactNode }
> = {
  pending: {
    color: '#5a5a78',
    bgColor: 'rgba(90, 90, 120, 0.1)',
    borderColor: 'rgba(90, 90, 120, 0.3)',
    icon: <Clock size={12} />,
  },
  running: {
    color: '#0066ff',
    bgColor: 'rgba(0, 102, 255, 0.15)',
    borderColor: 'rgba(0, 102, 255, 0.5)',
    icon: <Loader2 size={12} className="animate-spin" />,
  },
  complete: {
    color: '#00ff88',
    bgColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.4)',
    icon: <CheckCircle2 size={12} />,
  },
  error: {
    color: '#ff3366',
    bgColor: 'rgba(255, 51, 102, 0.1)',
    borderColor: 'rgba(255, 51, 102, 0.4)',
    icon: <AlertCircle size={12} />,
  },
};

// ─── Single Step ──────────────────────────────────────────────────────────────

interface StepItemProps {
  step: PipelineStep;
  index: number;
  isLast: boolean;
}

const StepItem: React.FC<StepItemProps> = ({ step, index, isLast }) => {
  const config = STATUS_CONFIG[step.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex gap-3"
    >
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        {/* Step circle */}
        <motion.div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
          style={{
            backgroundColor: config.bgColor,
            border: `1px solid ${config.borderColor}`,
            color: config.color,
          }}
          animate={
            step.status === 'running'
              ? { boxShadow: [`0 0 0 0 ${config.color}40`, `0 0 0 6px ${config.color}00`] }
              : {}
          }
          transition={
            step.status === 'running'
              ? { duration: 1.5, repeat: Infinity, ease: 'easeOut' }
              : {}
          }
        >
          {config.icon}
        </motion.div>

        {/* Connector line */}
        {!isLast && (
          <div
            className="w-px flex-1 mt-1"
            style={{
              minHeight: 20,
              backgroundColor:
                step.status === 'complete'
                  ? 'rgba(0, 255, 136, 0.3)'
                  : 'rgba(30, 30, 46, 0.8)',
            }}
          />
        )}
      </div>

      {/* Content column */}
      <div className={`flex-1 ${!isLast ? 'pb-3' : ''}`}>
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2">
            {/* Step icon */}
            <span style={{ color: config.color, opacity: step.status === 'pending' ? 0.4 : 1 }}>
              {STEP_ICONS[step.icon] || <Box size={14} />}
            </span>
            <span
              className="text-xs font-medium"
              style={{
                color: step.status === 'pending' ? '#5a5a78' : '#e8e8f0',
              }}
            >
              {step.name}
            </span>
          </div>

          {/* Status badge */}
          {step.status !== 'pending' && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xs px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: config.bgColor,
                color: config.color,
                border: `1px solid ${config.borderColor}`,
              }}
            >
              {step.status === 'running'
                ? `${Math.round(step.progress)}%`
                : step.status === 'complete'
                ? 'OK'
                : 'ERR'}
            </motion.span>
          )}
        </div>

        <p
          className="text-2xs mb-1.5"
          style={{ color: step.status === 'pending' ? '#3a3a55' : '#5a5a78' }}
        >
          {step.description}
        </p>

        {/* Progress bar for running step */}
        <AnimatePresence>
          {step.status === 'running' && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0 }}
              className="h-1 rounded-full overflow-hidden"
              style={{
                backgroundColor: 'rgba(0, 102, 255, 0.1)',
                originX: 0,
              }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #0066ff, #00d4ff)',
                }}
                animate={{ width: `${step.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Complete bar */}
        {step.status === 'complete' && (
          <div
            className="h-1 rounded-full"
            style={{ backgroundColor: 'rgba(0, 255, 136, 0.2)', width: '100%' }}
          />
        )}
      </div>
    </motion.div>
  );
};

// ─── Analysis Progress Component ──────────────────────────────────────────────

const AnalysisProgress: React.FC = () => {
  const { pipelineSteps, analysisProgress, analysisStatus, uploadedFile } = useAppStore();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: '#1e1e2e' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#e8e8f0' }}>
              Analyse en cours
            </h3>
            {uploadedFile && (
              <p className="text-2xs text-text-muted mt-0.5 truncate max-w-[200px]">
                {uploadedFile.name}
              </p>
            )}
          </div>
          <div className="text-right">
            <span
              className="text-2xl font-mono font-bold"
              style={{ color: '#0066ff' }}
            >
              {analysisProgress}
            </span>
            <span className="text-sm text-text-muted">%</span>
          </div>
        </div>

        {/* Overall progress bar */}
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(0, 102, 255, 0.1)' }}
        >
          <motion.div
            className="h-full rounded-full relative overflow-hidden"
            style={{ background: 'linear-gradient(90deg, #0066ff, #00d4ff)' }}
            animate={{ width: `${analysisProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Shimmer effect */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
        {pipelineSteps.map((step, i) => (
          <StepItem
            key={step.id}
            step={step}
            index={i}
            isLast={i === pipelineSteps.length - 1}
          />
        ))}
      </div>

      {/* Footer status */}
      {analysisStatus === 'complete' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 px-3 py-2 rounded"
          style={{
            backgroundColor: 'rgba(0, 255, 136, 0.08)',
            border: '1px solid rgba(0, 255, 136, 0.3)',
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} style={{ color: '#00ff88' }} />
            <span className="text-xs font-medium" style={{ color: '#00ff88' }}>
              Analyse terminée avec succès
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AnalysisProgress;
