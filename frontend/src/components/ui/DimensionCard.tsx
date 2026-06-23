'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ruler,
  Circle,
  ArrowUpDown,
  Triangle,
  Minus,
  Hash,
  ChevronDown,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { Dimension, DimensionType } from '@/types';
import { useAppStore } from '@/store/useAppStore';

// ─── Type Icon ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<DimensionType, { icon: React.ReactNode; color: string; label: string }> = {
  length: { icon: <Ruler size={12} />, color: '#0066ff', label: 'L' },
  width: { icon: <Ruler size={12} />, color: '#0066ff', label: 'W' },
  height: { icon: <ArrowUpDown size={12} />, color: '#00d4ff', label: 'H' },
  diameter: { icon: <Circle size={12} />, color: '#00ff88', label: 'Ø' },
  radius: { icon: <Circle size={12} />, color: '#00cc66', label: 'R' },
  chamfer: { icon: <Triangle size={12} />, color: '#ffd700', label: 'C' },
  angle: { icon: <Triangle size={12} />, color: '#ff6b00', label: '°' },
  thread: { icon: <Hash size={12} />, color: '#9933ff', label: 'M' },
  depth: { icon: <Minus size={12} />, color: '#ff3366', label: 'D' },
  thickness: { icon: <Minus size={12} />, color: '#0099ff', label: 'T' },
};

// ─── Confidence Bar ───────────────────────────────────────────────────────────

const ConfidenceBar: React.FC<{ value: number; width?: number }> = ({ value, width = 80 }) => {
  const color =
    value >= 90 ? '#00ff88' : value >= 75 ? '#ffd700' : '#ff3366';

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ width, backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <span
        className="text-2xs font-mono"
        style={{ color, minWidth: '28px' }}
      >
        {value}%
      </span>
    </div>
  );
};

// ─── Tolerance Display ────────────────────────────────────────────────────────

const ToleranceDisplay: React.FC<{ dim: Dimension }> = ({ dim }) => {
  if (!dim.tolerance) return <span className="text-text-muted text-xs">—</span>;

  const { upper, lower, isoCode } = dim.tolerance;
  const upperStr = upper >= 0 ? `+${upper.toFixed(3)}` : upper.toFixed(3);
  const lowerStr = lower <= 0 ? lower.toFixed(3) : `+${lower.toFixed(3)}`;

  return (
    <div className="flex items-center gap-1.5">
      {isoCode && (
        <span
          className="px-1.5 py-0.5 rounded text-2xs font-mono font-semibold"
          style={{
            backgroundColor: 'rgba(0, 102, 255, 0.15)',
            color: '#3385ff',
            border: '1px solid rgba(0, 102, 255, 0.3)',
          }}
        >
          {isoCode}
        </span>
      )}
      <div className="flex flex-col leading-none">
        <span className="text-2xs font-mono" style={{ color: '#00ff88' }}>
          {upperStr}
        </span>
        <span className="text-2xs font-mono" style={{ color: '#ff3366' }}>
          {lowerStr}
        </span>
      </div>
    </div>
  );
};

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  dimension: Dimension;
  onSave: (value: number) => void;
  onCancel: () => void;
}

const EditForm: React.FC<EditFormProps> = ({ dimension, onSave, onCancel }) => {
  const [value, setValue] = useState(dimension.value.toString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      onSave(numValue);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onSubmit={handleSubmit}
      className="flex items-center gap-1.5 mt-1"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        type="number"
        step="0.001"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 px-2 py-1 rounded text-xs font-mono"
        style={{
          backgroundColor: 'rgba(0, 102, 255, 0.1)',
          border: '1px solid rgba(0, 102, 255, 0.5)',
          color: '#e8e8f0',
          outline: 'none',
        }}
      />
      <span className="text-xs text-text-muted">mm</span>
      <button
        type="submit"
        className="p-1 rounded hover:bg-green-500/20 transition-colors"
        style={{ color: '#00ff88' }}
      >
        <Check size={12} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded hover:bg-red-500/20 transition-colors"
        style={{ color: '#ff3366' }}
      >
        <X size={12} />
      </button>
    </motion.form>
  );
};

// ─── Dimension Card ───────────────────────────────────────────────────────────

interface DimensionCardProps {
  dimension: Dimension;
  isSelected?: boolean;
  index?: number;
}

const DimensionCard: React.FC<DimensionCardProps> = ({
  dimension,
  isSelected = false,
  index = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { setSelectedDimension, updateDimension } = useAppStore();
  const typeConfig = TYPE_CONFIG[dimension.type];

  const handleClick = () => {
    setSelectedDimension(isSelected ? null : dimension.id);
  };

  const handleSave = (newValue: number) => {
    updateDimension(dimension.id, { value: newValue });
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={handleClick}
      className="rounded cursor-pointer transition-all duration-150 overflow-hidden"
      style={{
        backgroundColor: isSelected
          ? 'rgba(0, 102, 255, 0.1)'
          : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${isSelected ? 'rgba(0, 102, 255, 0.4)' : 'rgba(30, 30, 46, 0.8)'}`,
        borderLeft: `2px solid ${isSelected ? '#0066ff' : typeConfig.color}`,
      }}
    >
      {/* Main row */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          {/* Left: type badge + label */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0 font-mono font-bold text-2xs"
              style={{
                backgroundColor: `${typeConfig.color}20`,
                color: typeConfig.color,
                border: `1px solid ${typeConfig.color}40`,
              }}
            >
              {typeConfig.label}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: '#e8e8f0' }}
                  title={dimension.label}
                >
                  {dimension.label}
                </span>
                {dimension.isEdited && (
                  <span
                    className="text-2xs px-1 rounded"
                    style={{
                      backgroundColor: 'rgba(255, 107, 0, 0.15)',
                      color: '#ff6b00',
                      border: '1px solid rgba(255, 107, 0, 0.3)',
                    }}
                  >
                    modifié
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: value + actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <div className="text-right">
              <span
                className="text-sm font-mono font-semibold"
                style={{ color: typeConfig.color }}
              >
                {dimension.value.toFixed(1)}
              </span>
              <span className="text-2xs text-text-muted ml-0.5">mm</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(!isEditing);
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
              style={{ color: '#5a5a78' }}
              title="Modifier"
            >
              <Edit3 size={11} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 rounded transition-colors hover:text-text-primary"
              style={{ color: '#5a5a78' }}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={11} />
              </motion.div>
            </button>
          </div>
        </div>

        {/* Edit form */}
        <AnimatePresence>
          {isEditing && (
            <EditForm
              dimension={dimension}
              onSave={handleSave}
              onCancel={() => setIsEditing(false)}
            />
          )}
        </AnimatePresence>

        {/* Confidence bar (always visible) */}
        <div className="mt-2">
          <ConfidenceBar value={dimension.confidence} />
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
            style={{ borderTop: '1px solid rgba(30, 30, 46, 0.8)' }}
            className="px-3 py-2 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xs text-text-muted uppercase tracking-wider">Tolérance</span>
              <ToleranceDisplay dim={dimension} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xs text-text-muted uppercase tracking-wider">Type</span>
              <span className="text-xs" style={{ color: typeConfig.color }}>
                {dimension.type}
              </span>
            </div>
            {dimension.notes && (
              <div className="flex items-start gap-2">
                <span className="text-2xs text-text-muted uppercase tracking-wider">Notes</span>
                <span className="text-2xs text-text-secondary">{dimension.notes}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DimensionCard;
