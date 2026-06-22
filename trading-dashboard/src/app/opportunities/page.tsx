'use client';
import { motion } from 'framer-motion';
import { Target, TrendingUp, TrendingDown, Clock, Zap, Brain } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/utils/format';
import type { Opportunity } from '@/types';

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  BREAKOUT:     { label: 'Breakout',     icon: '🚀', color: '#7c5cfc' },
  MOMENTUM:     { label: 'Momentum',     icon: '⚡', color: '#f5a623' },
  VOLUME_SPIKE: { label: 'Volume Spike', icon: '📊', color: '#38bdf8' },
  REVERSAL:     { label: 'Reversal',     icon: '🔄', color: '#ff4d6d' },
  TREND:        { label: 'Trend',        icon: '📈', color: '#00d4b1' },
  NEWS_CATALYST:{ label: 'News Catalyst',icon: '📰', color: '#84cc16' },
  PATTERN:      { label: 'Pattern',      icon: '🎯', color: '#a78bfa' },
};

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const cfg = TYPE_CONFIG[opp.type] || { label: opp.type, icon: '●', color: '#7c5cfc' };
  const isBuy = opp.direction === 'BUY';
  const rr = (opp.potentialGain / opp.risk).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="glass-card p-4 cursor-pointer transition-all duration-200"
      style={{ borderColor: `${cfg.color}30` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: `${cfg.color}15` }}
          >
            {cfg.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-t-1">{opp.symbol.replace('USDT', '')}</span>
              <span className={cn('badge', isBuy ? 'badge-bull' : 'badge-bear')}>
                {isBuy ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {opp.direction}
              </span>
            </div>
            <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
        </div>

        {/* Confidence */}
        <div className="text-right">
          <div className="text-xl font-bold font-mono text-t-1">{opp.confidence}%</div>
          <div className="text-xs text-t-3">confiance IA</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-t-2 mb-3 leading-relaxed">{opp.description}</p>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="glass-card px-3 py-2 text-center">
          <div className="text-xs text-t-3 mb-1">Potentiel</div>
          <div className="text-sm font-bold text-bull">+{opp.potentialGain.toFixed(1)}%</div>
        </div>
        <div className="glass-card px-3 py-2 text-center">
          <div className="text-xs text-t-3 mb-1">Risque</div>
          <div className="text-sm font-bold text-bear">-{opp.risk.toFixed(1)}%</div>
        </div>
        <div className="glass-card px-3 py-2 text-center">
          <div className="text-xs text-t-3 mb-1">R/R</div>
          <div className="text-sm font-bold text-accent-violet">1:{rr}</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-t-3">
          <span>Score IA</span>
          <span className="font-medium text-t-2">{opp.confidence}%</span>
        </div>
        <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${opp.confidence}%` }}
            transition={{ duration: 0.8 }}
            style={{
              background: opp.confidence >= 75 ? '#00d4b1' : opp.confidence >= 55 ? '#f5a623' : '#ff4d6d',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-t-3">
        <div className="flex items-center gap-1">
          <Clock size={11} />
          {formatTimeAgo(opp.detectedAt)}
        </div>
        <div className="flex items-center gap-1">
          <Zap size={11} className="text-accent-amber" />
          Expire {formatTimeAgo(opp.expiresAt)}
        </div>
      </div>
    </motion.div>
  );
}

export default function OpportunitiesPage() {
  const { opportunities } = useStore();
  const active = opportunities.filter((o) => o.status === 'ACTIVE');

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Target size={20} className="text-accent-amber" />
        <h1 className="text-xl font-bold text-t-1">Scanner d&apos;Opportunités</h1>
        <span className="badge badge-amber">{active.length} actives</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-bull animate-pulse" />
          <span className="text-xs text-bull">Scan en temps réel</span>
        </div>
      </div>

      {/* Type filter badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <button key={key} className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
            <span>{cfg.icon}</span>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Opportunity cards grid */}
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Brain size={48} className="text-t-3 mb-4" />
          <div className="text-t-2 font-medium">Scan des marchés en cours...</div>
          <div className="text-t-3 text-sm mt-2">Les agents IA analysent les données en temps réel</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 tablet:grid-cols-2 ipad:grid-cols-3 gap-4">
          {active.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
