'use client';
import { motion } from 'framer-motion';
import { Target, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/utils/format';

const TYPE_LABELS: Record<string, string> = {
  BREAKOUT: '🚀 Breakout',
  MOMENTUM: '⚡ Momentum',
  VOLUME_SPIKE: '📊 Volume',
  REVERSAL: '🔄 Reversal',
  TREND: '📈 Trend',
  NEWS_CATALYST: '📰 News',
  PATTERN: '🎯 Pattern',
};

export function OpportunitiesPanel() {
  const { opportunities } = useStore();
  const active = opportunities.filter((o) => o.status === 'ACTIVE').slice(0, 5);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-accent-amber" />
          <span className="text-sm font-semibold text-t-1">Opportunités</span>
          <span className="badge badge-amber">{active.length}</span>
        </div>
        <button className="btn-ghost text-xs py-1 px-2">Tout voir →</button>
      </div>

      <div className="panel-body space-y-2">
        {active.map((opp, i) => (
          <motion.div
            key={opp.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass-card-hover p-3 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-t-1">{opp.symbol.replace('USDT', '')}</span>
                <span className="text-xs text-t-3">{TYPE_LABELS[opp.type] || opp.type}</span>
              </div>
              <div className={cn(
                'badge',
                opp.direction === 'BUY' ? 'badge-bull' : opp.direction === 'SELL' ? 'badge-bear' : 'badge-neutral'
              )}>
                {opp.direction === 'BUY' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {opp.direction}
              </div>
            </div>

            <div className="text-xs text-t-3 line-clamp-1 mb-2">{opp.description}</div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-bull font-medium">+{opp.potentialGain.toFixed(1)}%</span>
                <span className="text-bear">Risk {opp.risk.toFixed(1)}%</span>
                <span className="text-t-3">R/R {(opp.potentialGain / opp.risk).toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-12 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${opp.confidence}%`,
                      background: opp.confidence >= 75 ? '#00d4b1' : opp.confidence >= 55 ? '#f5a623' : '#ff4d6d',
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-t-2">{opp.confidence}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
