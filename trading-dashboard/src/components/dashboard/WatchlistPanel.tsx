'use client';
import { motion } from 'framer-motion';
import { Star, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent } from '@/lib/utils/format';

export function WatchlistPanel() {
  const { watchlist, assets, setSelectedSymbol, selectedSymbol } = useStore();

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-accent-amber" />
          <span className="text-sm font-semibold text-t-1">Watchlist</span>
        </div>
        <button className="btn-icon">
          <Plus size={13} />
        </button>
      </div>

      <div className="panel-body p-0">
        {watchlist.map((symbol, i) => {
          const asset = assets[symbol];
          if (!asset) return null;
          const up = asset.changePercent24h >= 0;

          return (
            <motion.div
              key={symbol}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setSelectedSymbol(symbol)}
              className={cn(
                'flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors border-b border-border last:border-0',
                selectedSymbol === symbol ? 'bg-accent-violet-dim' : 'hover:bg-bg-3'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  up ? 'bg-bull' : 'bg-bear'
                )} />
                <div>
                  <div className="text-sm font-semibold text-t-1">{symbol.replace('USDT', '').replace('USD', '')}</div>
                  <div className="text-xs text-t-3 capitalize">{asset.type}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-mono font-bold text-t-1">
                  {asset.price < 1
                    ? asset.price.toFixed(4)
                    : asset.price < 10
                    ? asset.price.toFixed(3)
                    : formatNumber(asset.price)}
                </div>
                <div className={cn('text-xs font-medium flex items-center justify-end gap-0.5', up ? 'text-bull' : 'text-bear')}>
                  {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {formatPercent(asset.changePercent24h)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
