'use client';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent } from '@/lib/utils/format';

const TICKER_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AAPL', 'NVDA', 'SPY', 'EURUSD'];

export function TickerBar() {
  const { assets } = useStore();

  const items = TICKER_SYMBOLS.map((sym) => assets[sym]).filter(Boolean);

  return (
    <div className="h-8 border-b border-border bg-bg-0/60 backdrop-blur-sm shrink-0 overflow-hidden relative">
      <div className="flex items-center h-full animate-ticker gap-8 pl-4 whitespace-nowrap">
        {/* Duplicate for seamless loop */}
        {[...items, ...items].map((asset, i) => (
          <div key={`${asset.symbol}-${i}`} className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-t-3 font-mono font-medium">
              {asset.symbol.replace('USDT', '')}
            </span>
            <span className="text-xs font-mono font-bold text-t-1">
              {asset.type === 'forex'
                ? asset.price.toFixed(4)
                : asset.price < 1
                ? asset.price.toFixed(4)
                : formatNumber(asset.price)
              }
            </span>
            <span className={cn(
              'text-xs font-medium',
              asset.changePercent24h >= 0 ? 'text-bull' : 'text-bear'
            )}>
              {asset.changePercent24h >= 0 ? '+' : ''}{formatPercent(asset.changePercent24h)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
