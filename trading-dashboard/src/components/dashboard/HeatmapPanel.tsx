'use client';
import { motion } from 'framer-motion';
import { Grid3X3 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const HEATMAP_SYMBOLS = [
  { symbol: 'BTCUSDT', display: 'BTC', size: 'large' },
  { symbol: 'ETHUSDT', display: 'ETH', size: 'large' },
  { symbol: 'SOLUSDT', display: 'SOL', size: 'medium' },
  { symbol: 'BNBUSDT', display: 'BNB', size: 'medium' },
  { symbol: 'XRPUSDT', display: 'XRP', size: 'small' },
  { symbol: 'ADAUSDT', display: 'ADA', size: 'small' },
  { symbol: 'AAPL', display: 'AAPL', size: 'medium' },
  { symbol: 'NVDA', display: 'NVDA', size: 'medium' },
  { symbol: 'SPY', display: 'SPY', size: 'small' },
  { symbol: 'EURUSD', display: 'EUR', size: 'small' },
];

function getHeatColor(change: number): string {
  const abs = Math.abs(change);
  if (change > 0) {
    if (abs > 5) return 'rgba(0,212,177,0.55)';
    if (abs > 3) return 'rgba(0,212,177,0.40)';
    if (abs > 1) return 'rgba(0,212,177,0.25)';
    return 'rgba(0,212,177,0.12)';
  } else {
    if (abs > 5) return 'rgba(255,77,109,0.55)';
    if (abs > 3) return 'rgba(255,77,109,0.40)';
    if (abs > 1) return 'rgba(255,77,109,0.25)';
    return 'rgba(255,77,109,0.12)';
  }
}

export function HeatmapPanel() {
  const { assets } = useStore();

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Grid3X3 size={14} className="text-accent-teal" />
          <span className="text-sm font-semibold text-t-1">Heatmap Marchés</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-t-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-bull/40" />
            <span>Hausse</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-bear/40" />
            <span>Baisse</span>
          </div>
        </div>
      </div>

      <div className="panel-body">
        <div className="grid grid-cols-5 ipad:grid-cols-10 gap-2 h-full">
          {HEATMAP_SYMBOLS.map((item, i) => {
            const asset = assets[item.symbol];
            const change = asset?.changePercent24h ?? 0;
            const bg = getHeatColor(change);
            const isPositive = change >= 0;

            return (
              <motion.div
                key={item.symbol}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  'heatmap-cell border border-border/50',
                  item.size === 'large' ? 'col-span-2 row-span-2' : item.size === 'medium' ? '' : ''
                )}
                style={{ background: bg, minHeight: item.size === 'large' ? 80 : 60 }}
              >
                <span className="text-xs font-bold text-t-1">{item.display}</span>
                <span className={cn('text-xs font-bold', isPositive ? 'text-bull' : 'text-bear')}>
                  {isPositive ? '+' : ''}{change.toFixed(2)}%
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
