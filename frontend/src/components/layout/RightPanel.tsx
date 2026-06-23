'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2,
  Wrench,
  Layers,
  RefreshCw,
  Clock,
  Shield,
  Thermometer,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import DimensionCard from '@/components/ui/DimensionCard';
import OperationCard from '@/components/ui/OperationCard';
import type { RightPanelTab } from '@/types';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: RightPanelTab; label: string; icon: React.ReactNode }[] = [
  { id: 'analyse', label: 'Analyse', icon: <BarChart2 size={13} /> },
  { id: 'operations', label: 'Opérations', icon: <Wrench size={13} /> },
  { id: 'material', label: 'Matériau', icon: <Layers size={13} /> },
];

// ─── Analyse Tab ──────────────────────────────────────────────────────────────

const AnalyseTab: React.FC = () => {
  const { detectedDimensions, selectedDimensionId, overallConfidence } = useAppStore();

  const summary = useMemo(() => {
    const byType = detectedDimensions.reduce<Record<string, number>>((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {});
    return byType;
  }, [detectedDimensions]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary card */}
      <div className="flex-shrink-0 px-3 py-2">
        <div
          className="rounded-lg p-3"
          style={{
            background: 'linear-gradient(135deg, rgba(0,102,255,0.08) 0%, rgba(0,212,255,0.05) 100%)',
            border: '1px solid rgba(0,102,255,0.2)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: '#e8e8f0' }}>
              Résumé détection
            </span>
            <div
              className="px-2 py-0.5 rounded text-xs font-mono font-bold"
              style={{
                background: 'linear-gradient(90deg, #0066ff, #00d4ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {overallConfidence}% conf.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              className="rounded p-2 text-center"
              style={{ backgroundColor: 'rgba(0,102,255,0.1)', border: '1px solid rgba(0,102,255,0.2)' }}
            >
              <div
                className="text-xl font-bold font-mono"
                style={{ color: '#3385ff' }}
              >
                {detectedDimensions.length}
              </div>
              <div className="text-2xs" style={{ color: '#5a5a78' }}>
                cotes détectées
              </div>
            </div>
            <div
              className="rounded p-2 text-center"
              style={{ backgroundColor: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}
            >
              <div
                className="text-xl font-bold font-mono"
                style={{ color: '#00ff88' }}
              >
                {detectedDimensions.filter((d) => d.confidence >= 90).length}
              </div>
              <div className="text-2xs" style={{ color: '#5a5a78' }}>
                haute confiance
              </div>
            </div>
          </div>

          {/* Type breakdown */}
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(summary).map(([type, count]) => (
              <span
                key={type}
                className="text-2xs px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#9898b0',
                  border: '1px solid #2a2a3e',
                }}
              >
                {type}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Dimension list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        <AnimatePresence>
          {detectedDimensions.map((dim, i) => (
            <DimensionCard
              key={dim.id}
              dimension={dim}
              isSelected={selectedDimensionId === dim.id}
              index={i}
            />
          ))}
        </AnimatePresence>

        {detectedDimensions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart2 size={32} style={{ color: '#2a2a3e' }} />
            <p className="text-xs mt-3" style={{ color: '#5a5a78' }}>
              Aucune cote détectée
            </p>
            <p className="text-2xs mt-1" style={{ color: '#3a3a55' }}>
              Importez un fichier pour démarrer l&apos;analyse
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Operations Tab ───────────────────────────────────────────────────────────

const OperationsTab: React.FC = () => {
  const { machiningOperations, selectedOperationId } = useAppStore();

  const totalTime = useMemo(
    () => machiningOperations.reduce((sum, op) => sum + op.estimatedTime, 0),
    [machiningOperations]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Total time banner */}
      <div className="flex-shrink-0 px-3 py-2">
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2"
          style={{
            background: 'rgba(255,215,0,0.05)',
            border: '1px solid rgba(255,215,0,0.2)',
          }}
        >
          <div className="flex items-center gap-2">
            <Clock size={13} style={{ color: '#ffd700' }} />
            <span className="text-xs" style={{ color: '#9898b0' }}>
              Temps total estimé
            </span>
          </div>
          <span className="text-sm font-mono font-bold" style={{ color: '#ffd700' }}>
            {formatTime(totalTime)}
          </span>
        </div>
      </div>

      {/* Operations list */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5">
        <AnimatePresence>
          {machiningOperations
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((op, i) => (
              <OperationCard
                key={op.id}
                operation={op}
                isSelected={selectedOperationId === op.id}
                index={i}
              />
            ))}
        </AnimatePresence>

        {machiningOperations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wrench size={32} style={{ color: '#2a2a3e' }} />
            <p className="text-xs mt-3" style={{ color: '#5a5a78' }}>
              Aucune opération planifiée
            </p>
          </div>
        )}
      </div>

      {/* Re-generate button */}
      <div className="flex-shrink-0 px-3 py-2" style={{ borderTop: '1px solid #1e1e2e' }}>
        <button
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
          style={{
            backgroundColor: 'rgba(0,102,255,0.1)',
            border: '1px solid rgba(0,102,255,0.3)',
            color: '#3385ff',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,102,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,102,255,0.1)';
          }}
        >
          <RefreshCw size={12} />
          Recalculer les opérations
        </button>
      </div>
    </div>
  );
};

// ─── Material Tab ─────────────────────────────────────────────────────────────

const PropRow: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  icon?: React.ReactNode;
}> = ({ label, value, unit, color = '#9898b0', icon }) => (
  <div
    className="flex items-center justify-between py-2 px-3"
    style={{ borderBottom: '1px solid rgba(30,30,46,0.6)' }}
  >
    <div className="flex items-center gap-2">
      {icon && <span style={{ color: '#5a5a78' }}>{icon}</span>}
      <span className="text-xs" style={{ color: '#9898b0' }}>
        {label}
      </span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-xs font-mono font-semibold" style={{ color }}>
        {value}
      </span>
      {unit && (
        <span className="text-2xs" style={{ color: '#5a5a78' }}>
          {unit}
        </span>
      )}
    </div>
  </div>
);

const MaterialTab: React.FC = () => {
  const { currentMaterial, material } = useAppStore();

  if (!currentMaterial) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <Layers size={32} style={{ color: '#2a2a3e' }} />
        <p className="text-xs mt-3" style={{ color: '#5a5a78' }}>
          Matériau non sélectionné
        </p>
      </div>
    );
  }

  const { properties } = currentMaterial;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Material header */}
      <div className="px-3 py-3">
        <div
          className="rounded-lg p-3"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid #2a2a3e',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0"
              style={{
                backgroundColor: currentMaterial.color,
                boxShadow: `0 0 16px ${currentMaterial.color}60`,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
            <div>
              <h3 className="text-sm font-semibold" style={{ color: '#e8e8f0' }}>
                {currentMaterial.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-2xs px-1.5 py-0.5 rounded font-mono"
                  style={{
                    backgroundColor: 'rgba(0,212,255,0.1)',
                    color: '#00d4ff',
                    border: '1px solid rgba(0,212,255,0.3)',
                  }}
                >
                  {currentMaterial.code}
                </span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#5a5a78',
                  }}
                >
                  {currentMaterial.category}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Properties */}
      <div className="px-3">
        <p className="text-2xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#5a5a78' }}>
          Propriétés mécaniques
        </p>
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid #1e1e2e' }}
        >
          <PropRow
            label="Densité"
            value={properties.density}
            unit="g/cm³"
            color="#00d4ff"
            icon={<Layers size={11} />}
          />
          <PropRow
            label="Dureté Brinell"
            value={properties.hardness}
            unit="HB"
            color="#ffd700"
            icon={<Shield size={11} />}
          />
          <PropRow
            label="Résistance traction"
            value={properties.tensileStrength}
            unit="MPa"
            color="#00ff88"
            icon={<Zap size={11} />}
          />
          <PropRow
            label="Limite élastique"
            value={properties.yieldStrength}
            unit="MPa"
            color="#3385ff"
          />
          <PropRow
            label="Allongement"
            value={properties.elongation}
            unit="%"
            color="#9898b0"
          />
          <PropRow
            label="Cond. thermique"
            value={properties.thermalConductivity}
            unit="W/m·K"
            color="#ff6b00"
            icon={<Thermometer size={11} />}
          />
        </div>
      </div>

      {/* Machinability */}
      <div className="px-3 py-3">
        <p className="text-2xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a5a78' }}>
          Usinabilité relative
        </p>
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: '#9898b0' }}>
              Indice d&apos;usinabilité
            </span>
            <span
              className="text-sm font-mono font-bold"
              style={{
                color:
                  properties.machinability >= 80
                    ? '#00ff88'
                    : properties.machinability >= 50
                    ? '#ffd700'
                    : '#ff3366',
              }}
            >
              {properties.machinability}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  properties.machinability >= 80
                    ? 'linear-gradient(90deg, #00cc66, #00ff88)'
                    : properties.machinability >= 50
                    ? 'linear-gradient(90deg, #cc9900, #ffd700)'
                    : 'linear-gradient(90deg, #cc1133, #ff3366)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${properties.machinability}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-2xs" style={{ color: '#3a3a55' }}>
              Difficile
            </span>
            <span className="text-2xs" style={{ color: '#3a3a55' }}>
              Excellent
            </span>
          </div>
        </div>
      </div>

      {/* Cutting recommendations */}
      <div className="px-3 pb-4">
        <p className="text-2xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a5a78' }}>
          Paramètres recommandés
        </p>
        <div className="space-y-1.5">
          {[
            { label: 'Vitesse coupe Al', value: '300-500', unit: 'm/min' },
            { label: 'Lubrification', value: 'Huile émulsion', unit: '' },
            { label: 'Fraise revêtement', value: 'AlTiN / TiCN', unit: '' },
          ].map((rec) => (
            <div
              key={rec.label}
              className="flex items-center justify-between px-3 py-2 rounded"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e' }}
            >
              <span className="text-xs" style={{ color: '#9898b0' }}>
                {rec.label}
              </span>
              <span className="text-xs font-mono" style={{ color: '#00d4ff' }}>
                {rec.value} {rec.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Right Panel ──────────────────────────────────────────────────────────────

const RightPanel: React.FC = () => {
  const { rightPanelTab, setRightPanelTab } = useAppStore();

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#0d0d14' }}
    >
      {/* Tab bar */}
      <div
        className="flex-shrink-0 flex items-center px-2 h-12"
        style={{ borderBottom: '1px solid #1e1e2e' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRightPanelTab(tab.id)}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-150 flex-1 justify-center"
            style={{
              color: rightPanelTab === tab.id ? '#e8e8f0' : '#5a5a78',
              backgroundColor:
                rightPanelTab === tab.id
                  ? 'rgba(0,102,255,0.12)'
                  : 'transparent',
            }}
          >
            <span
              style={{
                color: rightPanelTab === tab.id ? '#0066ff' : '#5a5a78',
              }}
            >
              {tab.icon}
            </span>
            {tab.label}
            {rightPanelTab === tab.id && (
              <motion.div
                layoutId="right-tab-indicator"
                className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #0066ff, #00d4ff)',
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {rightPanelTab === 'analyse' && (
            <motion.div
              key="analyse"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <AnalyseTab />
            </motion.div>
          )}
          {rightPanelTab === 'operations' && (
            <motion.div
              key="operations"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <OperationsTab />
            </motion.div>
          )}
          {rightPanelTab === 'material' && (
            <motion.div
              key="material"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <MaterialTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RightPanel;
