'use client';
import { TrendingUp, TrendingDown, DollarSign, Activity, Zap, BarChart2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent } from '@/lib/utils/format';

export function MarketOverview() {
  const { assets, marketStatus, activeSignals, opportunities } = useStore();

  const btc = assets['BTCUSDT'];
  const eth = assets['ETHUSDT'];
  const nvda = assets['NVDA'];

  const stats = [
    {
      label: 'Bitcoin',
      value: btc ? `$${formatNumber(btc.price)}` : '—',
      change: btc?.changePercent24h,
      icon: <span className="text-accent-amber font-bold text-base">₿</span>,
      color: 'accent-amber',
    },
    {
      label: 'Ethereum',
      value: eth ? `$${formatNumber(eth.price)}` : '—',
      change: eth?.changePercent24h,
      icon: <span className="text-accent-violet font-bold text-base">Ξ</span>,
      color: 'accent-violet',
    },
    {
      label: 'Market Cap',
      value: marketStatus ? `$${(marketStatus.totalMarketCap / 1e12).toFixed(2)}T` : '—',
      sub: 'Crypto total',
      icon: <DollarSign size={16} className="text-accent-teal" />,
      color: 'accent-teal',
    },
    {
      label: 'Fear & Greed',
      value: marketStatus ? String(marketStatus.fearGreedIndex) : '68',
      sub: marketStatus?.fearGreedIndex && marketStatus.fearGreedIndex >= 55 ? 'Avidité' : 'Neutre',
      icon: <Activity size={16} className="text-accent-rose" />,
      color: 'accent-rose',
    },
    {
      label: 'Signaux actifs',
      value: String(activeSignals.length),
      sub: 'En cours',
      icon: <Zap size={16} className="text-accent-amber" />,
      color: 'accent-amber',
    },
    {
      label: 'Opportunités',
      value: String(opportunities.filter((o) => o.status === 'ACTIVE').length),
      sub: 'Détectées',
      icon: <BarChart2 size={16} className="text-bull" />,
      color: 'accent-teal',
    },
  ];

  return (
    <div className="grid grid-cols-3 ipad:grid-cols-6 gap-3">
      {stats.map((s, i) => (
        <div key={i} className="glass-card px-4 py-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-t-3">{s.label}</span>
            {s.icon}
          </div>
          <div className="text-lg font-bold text-t-1 font-mono tabular-nums leading-tight">
            {s.value}
          </div>
          {s.change !== undefined ? (
            <div className={cn(
              'text-xs font-medium flex items-center gap-0.5',
              s.change >= 0 ? 'text-bull' : 'text-bear'
            )}>
              {s.change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {formatPercent(s.change)}
            </div>
          ) : s.sub ? (
            <div className="text-xs text-t-3">{s.sub}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
