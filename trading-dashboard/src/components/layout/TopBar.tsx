'use client';
import { motion } from 'framer-motion';
import { Bell, Settings, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent } from '@/lib/utils/format';

export function TopBar() {
  const { marketStatus, unreadCount, assets } = useStore();

  const btc = assets['BTCUSDT'];
  const fearGreed = marketStatus?.fearGreedIndex ?? 68;
  const fearLabel = fearGreed >= 75 ? 'Avidité extrême' : fearGreed >= 55 ? 'Avidité' : fearGreed >= 45 ? 'Neutre' : fearGreed >= 25 ? 'Peur' : 'Peur extrême';
  const fearColor = fearGreed >= 75 ? 'text-accent-rose' : fearGreed >= 55 ? 'text-accent-amber' : fearGreed >= 45 ? 'text-t-2' : 'text-bull';

  const marketOpen = marketStatus?.nyse === 'OPEN';

  return (
    <header className="h-14 flex items-center px-4 gap-4 border-b border-border bg-bg-1/80 backdrop-blur-md shrink-0 z-10">
      {/* Market status indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={cn('w-1.5 h-1.5 rounded-full animate-pulse', marketOpen ? 'bg-bull' : 'bg-bear')} />
          <span className="text-xs text-t-2 font-medium">
            {marketOpen ? 'Marchés ouverts' : 'Marchés fermés'}
          </span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Crypto is always open */}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
          <span className="text-xs text-t-2">Crypto 24/7</span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Fear & Greed */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-t-3">Fear & Greed</span>
          <span className={cn('text-xs font-bold', fearColor)}>{fearGreed}</span>
          <span className={cn('text-xs', fearColor)}>{fearLabel}</span>
        </div>
      </div>

      {/* BTC quick price */}
      {btc && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-t-3 font-mono">BTC</span>
            <span className="text-sm font-bold text-t-1 font-mono">${formatNumber(btc.price)}</span>
            <span className={cn('text-xs font-medium flex items-center gap-0.5',
              btc.changePercent24h >= 0 ? 'text-bull' : 'text-bear'
            )}>
              {btc.changePercent24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {formatPercent(btc.changePercent24h)}
            </span>
          </div>
        </>
      )}

      {/* Market cap */}
      {marketStatus && (
        <>
          <div className="w-px h-4 bg-border hidden ipad:block" />
          <div className="hidden ipad:flex items-center gap-1.5">
            <span className="text-xs text-t-3">Cap totale</span>
            <span className="text-xs font-medium text-t-1">${(marketStatus.totalMarketCap / 1e12).toFixed(2)}T</span>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* BTC dominance */}
      {marketStatus && (
        <div className="hidden ipad:flex items-center gap-1.5">
          <span className="text-xs text-t-3">BTC.D</span>
          <span className="text-xs font-bold text-accent-amber">{marketStatus.dominance.btc}%</span>
        </div>
      )}

      {/* Sentiment badge */}
      {marketStatus && (
        <div className={cn('badge hidden ipad:flex',
          marketStatus.marketSentiment === 'BULLISH' ? 'badge-bull'
          : marketStatus.marketSentiment === 'BEARISH' ? 'badge-bear'
          : 'badge-neutral'
        )}>
          {marketStatus.marketSentiment === 'BULLISH' ? '↑' : marketStatus.marketSentiment === 'BEARISH' ? '↓' : '—'}
          {' '}{marketStatus.marketSentiment}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="btn-icon relative">
          <Bell size={15} />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-rose text-white text-[10px] font-bold flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </button>
        <button className="btn-icon">
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
