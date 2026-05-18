'use client';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line,
} from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, Target, Zap, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/utils/format';

// ── Mock performance data ──────────────────────────
function generatePnLData() {
  let cum = 0;
  return Array.from({ length: 30 }, (_, i) => {
    const daily = (Math.random() - 0.42) * 400;
    cum += daily;
    const date = new Date(Date.now() - (29 - i) * 86400000);
    return {
      date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      pnl: Math.round(daily),
      cumulative: Math.round(cum),
      winRate: Math.round(45 + Math.random() * 30),
    };
  });
}

const PNL_DATA = generatePnLData();

const STATS = [
  { label: 'Win Rate', value: '67.8%', sub: '+2.3% vs mois dernier', icon: <Target size={16} />, color: 'text-bull' },
  { label: 'Profit Factor', value: '1.84', sub: 'Ratio gains/pertes', icon: <TrendingUp size={16} />, color: 'text-accent-violet' },
  { label: 'Sharpe Ratio', value: '1.42', sub: 'Rendement ajusté', icon: <Zap size={16} />, color: 'text-accent-amber' },
  { label: 'Max Drawdown', value: '-8.3%', sub: 'Perte maximale', icon: <TrendingDown size={16} />, color: 'text-bear' },
  { label: 'Total Trades', value: '134', sub: '89 gagnants / 45 perdants', icon: <BarChart3 size={16} />, color: 'text-accent-sky' },
  { label: 'Risk/Reward', value: '1:2.3', sub: 'Ratio moyen', icon: <ShieldCheck size={16} />, color: 'text-accent-teal' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <div className="text-t-3 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-t-2 capitalize">{p.dataKey}:</span>
          <span className="font-bold text-t-1">{typeof p.value === 'number' && p.value > 0 ? '+' : ''}{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PerformancePage() {
  const totalPnL = PNL_DATA[PNL_DATA.length - 1].cumulative;
  const isPositive = totalPnL >= 0;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 size={20} className="text-accent-violet" />
        <h1 className="text-xl font-bold text-t-1">Performance IA</h1>
        <div className={cn('badge ml-2', isPositive ? 'badge-bull' : 'badge-bear')}>
          {isPositive ? '+' : ''}{totalPnL.toLocaleString()}$
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 ipad:grid-cols-6 gap-3">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-t-3">{s.label}</span>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div className={cn('text-2xl font-bold font-mono', s.color)}>{s.value}</div>
            <div className="text-xs text-t-3 mt-1">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cumulative PnL */}
        <div className="col-span-12 ipad:col-span-8 glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-t-1">PnL Cumulatif — 30 jours</h3>
            <div className={cn('badge', isPositive ? 'badge-bull' : 'badge-bear')}>
              {isPositive ? '+' : ''}{totalPnL.toLocaleString()}$
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={PNL_DATA}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c5cfc" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c5cfc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#44445a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#44445a' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#7c5cfc"
                strokeWidth={2}
                fill="url(#pnlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily PnL bars */}
        <div className="col-span-12 ipad:col-span-4 glass-card p-4">
          <h3 className="text-sm font-semibold text-t-1 mb-4">PnL Journalier</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={PNL_DATA.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#44445a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#44445a' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="pnl"
                radius={[3, 3, 0, 0]}
                fill="#7c5cfc"
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Win rate evolution */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-t-1 mb-4">Évolution Win Rate — 30 jours</h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={PNL_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#44445a' }} axisLine={false} tickLine={false} />
            <YAxis domain={[30, 90]} tick={{ fontSize: 10, fill: '#44445a' }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="winRate" stroke="#00d4b1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
