'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drill,
  Settings2,
  ChevronDown,
  Clock,
  Zap,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { MachiningOperation, OperationType } from '@/types';
import { useAppStore } from '@/store/useAppStore';

// ─── Operation Type Config ────────────────────────────────────────────────────

const OP_CONFIG: Record<
  OperationType,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  facing: {
    label: 'Surfaçage',
    color: '#0066ff',
    bgColor: 'rgba(0, 102, 255, 0.15)',
    icon: <Layers size={11} />,
  },
  contouring: {
    label: 'Contournage',
    color: '#00d4ff',
    bgColor: 'rgba(0, 212, 255, 0.15)',
    icon: <ArrowRight size={11} />,
  },
  drilling: {
    label: 'Perçage',
    color: '#ffd700',
    bgColor: 'rgba(255, 215, 0, 0.15)',
    icon: <Drill size={11} />,
  },
  tapping: {
    label: 'Taraudage',
    color: '#ff6b00',
    bgColor: 'rgba(255, 107, 0, 0.15)',
    icon: <Settings2 size={11} />,
  },
  grooving: {
    label: 'Gorge',
    color: '#9933ff',
    bgColor: 'rgba(153, 51, 255, 0.15)',
    icon: <Layers size={11} />,
  },
  pocketing: {
    label: 'Fraisage poche',
    color: '#00ff88',
    bgColor: 'rgba(0, 255, 136, 0.15)',
    icon: <Layers size={11} />,
  },
  chamfering: {
    label: 'Chanfreinage',
    color: '#ff3366',
    bgColor: 'rgba(255, 51, 102, 0.15)',
    icon: <ArrowRight size={11} />,
  },
  turning: {
    label: 'Tournage',
    color: '#0099ff',
    bgColor: 'rgba(0, 153, 255, 0.15)',
    icon: <Settings2 size={11} />,
  },
  boring: {
    label: 'Alésage',
    color: '#33ddff',
    bgColor: 'rgba(51, 221, 255, 0.15)',
    icon: <Circle size={11} />,
  },
  reaming: {
    label: 'Alésage fin',
    color: '#66ff99',
    bgColor: 'rgba(102, 255, 153, 0.15)',
    icon: <Circle size={11} />,
  },
  threading: {
    label: 'Filetage',
    color: '#cc66ff',
    bgColor: 'rgba(204, 102, 255, 0.15)',
    icon: <Settings2 size={11} />,
  },
};

// Simple circle SVG for boring/reaming
const Circle: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

// ─── Tool Info ────────────────────────────────────────────────────────────────

const ToolBadge: React.FC<{ operation: MachiningOperation }> = ({ operation }) => {
  const { tool } = operation;
  const toolType = tool.type
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded"
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Drill size={10} style={{ color: '#9898b0' }} />
      <span className="text-2xs font-mono" style={{ color: '#9898b0' }}>
        {toolType} Ø{tool.diameter}
      </span>
      {tool.coating && tool.coating !== 'none' && (
        <span
          className="text-2xs px-1 rounded"
          style={{
            backgroundColor: 'rgba(0, 102, 255, 0.15)',
            color: '#3385ff',
          }}
        >
          {tool.coating}
        </span>
      )}
    </div>
  );
};

// ─── Param Row ────────────────────────────────────────────────────────────────

const ParamRow: React.FC<{
  label: string;
  value: string;
  unit?: string;
  color?: string;
  icon?: React.ReactNode;
}> = ({ label, value, unit, color = '#9898b0', icon }) => (
  <div className="flex items-center justify-between py-0.5">
    <div className="flex items-center gap-1.5">
      {icon && <span style={{ color: '#5a5a78' }}>{icon}</span>}
      <span className="text-2xs text-text-muted uppercase tracking-wider">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-xs font-mono font-semibold" style={{ color }}>
        {value}
      </span>
      {unit && (
        <span className="text-2xs text-text-muted">{unit}</span>
      )}
    </div>
  </div>
);

// ─── Operation Card ───────────────────────────────────────────────────────────

interface OperationCardProps {
  operation: MachiningOperation;
  isSelected?: boolean;
  index?: number;
}

const OperationCard: React.FC<OperationCardProps> = ({
  operation,
  isSelected = false,
  index = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { setSelectedOperation } = useAppStore();
  const config = OP_CONFIG[operation.type];

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m${secs}s` : `${mins}min`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className="rounded overflow-hidden cursor-pointer transition-all duration-150"
      style={{
        backgroundColor: isSelected
          ? `${config.color}12`
          : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${isSelected ? `${config.color}50` : 'rgba(30, 30, 46, 0.8)'}`,
        borderLeft: `2px solid ${config.color}`,
      }}
      onClick={() => setSelectedOperation(isSelected ? null : operation.id)}
    >
      {/* Header */}
      <div className="px-3 py-2">
        <div className="flex items-start justify-between">
          {/* Left */}
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {/* Order badge */}
            <div
              className="flex items-center justify-center w-5 h-5 rounded text-2xs font-bold flex-shrink-0 mt-0.5"
              style={{
                backgroundColor: config.bgColor,
                color: config.color,
                border: `1px solid ${config.color}40`,
              }}
            >
              {operation.order}
            </div>

            {/* Labels */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="px-1.5 py-0.5 rounded text-2xs font-semibold flex items-center gap-1"
                  style={{
                    backgroundColor: config.bgColor,
                    color: config.color,
                    border: `1px solid ${config.color}30`,
                  }}
                >
                  {config.icon}
                  {config.label}
                </span>
              </div>
              <p className="text-xs font-medium mt-0.5 truncate" style={{ color: '#e8e8f0' }}>
                {operation.label}
              </p>
            </div>
          </div>

          {/* Right: time + expand */}
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-2xs" style={{ color: '#9898b0' }}>
              <Clock size={10} />
              <span className="font-mono">{formatTime(operation.estimatedTime)}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-0.5 rounded transition-colors"
              style={{ color: '#5a5a78' }}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={12} />
              </motion.div>
            </button>
          </div>
        </div>

        {/* Tool badge + quick params */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <ToolBadge operation={operation} />
          <div className="flex items-center gap-1 text-2xs" style={{ color: '#9898b0' }}>
            <Zap size={10} style={{ color: '#ffd700' }} />
            <span className="font-mono">{operation.spindleSpeed.toLocaleString()} tr/min</span>
          </div>
          <div className="flex items-center gap-1 text-2xs" style={{ color: '#9898b0' }}>
            <ArrowRight size={10} style={{ color: '#00d4ff' }} />
            <span className="font-mono">{operation.feedRate} mm/min</span>
          </div>
        </div>

        {/* Confidence */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs text-text-muted">Confiance IA</span>
            <span
              className="text-2xs font-mono"
              style={{
                color:
                  operation.confidence >= 90
                    ? '#00ff88'
                    : operation.confidence >= 75
                    ? '#ffd700'
                    : '#ff3366',
              }}
            >
              {operation.confidence}%
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  operation.confidence >= 90
                    ? '#00ff88'
                    : operation.confidence >= 75
                    ? '#ffd700'
                    : '#ff3366',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${operation.confidence}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.05 }}
            />
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ borderTop: '1px solid rgba(30, 30, 46, 0.8)' }}
          >
            <div className="px-3 py-2 space-y-0.5">
              <ParamRow
                label="Vitesse coupe"
                value={operation.cuttingSpeed.toString()}
                unit="m/min"
                color="#00d4ff"
                icon={<Zap size={10} />}
              />
              {operation.depth !== undefined && (
                <ParamRow
                  label="Profondeur"
                  value={operation.depth.toString()}
                  unit="mm"
                  color="#ff6b00"
                />
              )}
              {operation.stepdown !== undefined && (
                <ParamRow
                  label="Pas axial"
                  value={operation.stepdown.toString()}
                  unit="mm"
                  color="#9898b0"
                />
              )}
              {operation.stepover !== undefined && (
                <ParamRow
                  label="Pas radial"
                  value={operation.stepover.toString()}
                  unit="mm"
                  color="#9898b0"
                />
              )}
              <ParamRow
                label="Outil matière"
                value={operation.tool.material}
                color="#9898b0"
              />
              {operation.tool.flutes && (
                <ParamRow
                  label="Nb dents"
                  value={operation.tool.flutes.toString()}
                  color="#9898b0"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default OperationCard;
