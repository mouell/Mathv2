'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatTimeAgo, colorForScore } from '@/lib/utils/format';
import type { TradingSignal } from '@/types';

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? '#00d4b1' : value >= 55 ? '#f5a623' : '#ff4d6d';
  return (
    <div className="confidence-bar w-full">
      <motion.div
        className="confidence-fill"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ background: color }}
      />
    </div>
  );
}

function SignalCard({ signal }: { signal: TradingSignal }) {
  const isBuy = signal.direction === 'BUY';
  const isSell = signal.direction === 'SELL';
  const isWatch = signal.direction === 'WATCH';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card-hover p-3 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs',
            isBuy ? 'bg-bull/20 text-bull' : isSell ? 'bg-bear/20 text-bear' : 'bg-accent-amber-dim text-accent-amber'
          )}>
            {isBuy ? <TrendingUp size={14} /> : isSell ? <TrendingDown size={14} /> : <Minus size={14} />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-t-1">{signal.symbol.replace('USDT', '')}</span>
              <span className={cn(
                'badge text-xs',
                isBuy ? 'badge-bull' : isSell ? 'badge-bear' : 'badge-neutral'
              )}>
                {signal.direction}
              </span>
              <span className="text-xs text-t-3">{signal.timeframe}</span>
            </div>
            <div className="text-xs text-t-3 mt-0.5">{formatTimeAgo(signal.createdAt)}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-t-1 font-mono">{signal.confidence}%</div>
          <div className="text-xs text-t-3">confiance</div>
        </div>
      </div>

      <ConfidenceBar value={signal.confidence} />

      <div className="mt-2 text-xs text-t-3 line-clamp-2 leading-relaxed">
        {signal.reason}
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs font-mono">
        <span className="text-t-3">Entrée: <span className="text-t-2">{signal.entry.toLocaleString()}</span></span>
        <span className="text-bear">SL: {signal.stopLoss.toLocaleString()}</span>
        <span className="text-bull">TP: {signal.takeProfit[0].toLocaleString()}</span>
      </div>

      {/* Agent scores mini-bar */}
      <div className="mt-2 flex items-center gap-1">
        {signal.agentScores.map((a) => (
          <div key={a.agentId} className="h-1 flex-1 rounded-full" style={{ background: colorForScore(Math.abs(a.score)) }} title={`${a.agentName}: ${a.score}`} />
        ))}
      </div>
    </motion.div>
  );
}

export function SignalsPanel() {
  const { activeSignals } = useStore();

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-accent-amber" />
          <span className="text-sm font-semibold text-t-1">Signaux IA</span>
          {activeSignals.length > 0 && (
            <span className="badge badge-amber px-1.5">{activeSignals.length}</span>
          )}
        </div>
        <button className="btn-ghost text-xs py-1 px-2">Tout voir →</button>
      </div>

      <div className="panel-body space-y-2">
        <AnimatePresence>
          {activeSignals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Zap size={32} className="text-t-3 mb-2" />
              <div className="text-sm text-t-3">En attente de signaux...</div>
              <div className="text-xs text-t-3 mt-1">Les agents analysent les marchés</div>
            </div>
          ) : (
            activeSignals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
