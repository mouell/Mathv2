'use client';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, TrendingDown, Activity, DollarSign } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

const RISK_METRICS = [
  { label: 'Risque Total', value: 12.4, max: 100, color: '#f5a623', status: 'Modéré' },
  { label: 'Exposition BTC', value: 38, max: 100, color: '#f5a623', status: '38% du portefeuille' },
  { label: 'Corrélation', value: 0.67, max: 1, color: '#ff4d6d', status: 'Élevée', raw: true },
  { label: 'VaR 95%', value: 2.1, max: 10, color: '#7c5cfc', status: '$2,100 / jour', raw: true },
  { label: 'Positions ouvertes', value: 2, max: 10, color: '#00d4b1', status: '2/10 max', raw: true },
  { label: 'Levier moyen', value: 1.0, max: 5, color: '#00d4b1', status: 'Sans levier', raw: true },
];

const RADAR_DATA = [
  { metric: 'Market Risk', value: 65 },
  { metric: 'Concentration', value: 45 },
  { metric: 'Liquidity', value: 20 },
  { metric: 'Volatility', value: 72 },
  { metric: 'Correlation', value: 55 },
  { metric: 'Leverage', value: 10 },
];

const DRAWDOWN_DATA = Array.from({ length: 30 }, (_, i) => {
  const base = Math.random() * -8;
  return {
    date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    drawdown: base,
    maxDrawdown: Math.min(base * 1.4, -0.5),
  };
});

const RULES = [
  { rule: 'Risque max par trade', value: '2%', status: 'OK', ok: true },
  { rule: 'Risque journalier max', value: '5%', status: 'OK', ok: true },
  { rule: 'Max drawdown mensuel', value: '15%', status: '8.3% utilisé', ok: true },
  { rule: 'Corrélation max positions', value: '0.7', status: '0.67 — attention', ok: false },
  { rule: 'Positions simultanées max', value: '5', status: '2 actives', ok: true },
  { rule: 'Levier maximum', value: '3x', status: '1x — OK', ok: true },
];

export default function RiskPage() {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield size={20} className="text-accent-rose" />
        <h1 className="text-xl font-bold text-t-1">Risk Manager</h1>
        <div className="badge badge-amber ml-2">Risque Modéré</div>
      </div>

      {/* Risk cards */}
      <div className="grid grid-cols-2 ipad:grid-cols-3 gap-3">
        {RISK_METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass-card p-4"
          >
            <div className="text-xs text-t-3 mb-2">{m.label}</div>
            <div className="text-2xl font-bold font-mono mb-1" style={{ color: m.color }}>
              {m.raw ? m.value : `${m.value}%`}
            </div>
            <div className="text-xs text-t-3 mb-3">{m.status}</div>
            {!m.raw && (
              <div className="h-1.5 bg-bg-3 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(m.value / m.max) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.07 }}
                  style={{ background: m.color }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Risk radar */}
        <div className="col-span-12 ipad:col-span-5 glass-card p-4">
          <h3 className="text-sm font-semibold text-t-1 mb-4">Profil de Risque</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#44445a' }} />
              <Radar name="Risk" dataKey="value" stroke="#ff4d6d" fill="#ff4d6d" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Drawdown chart */}
        <div className="col-span-12 ipad:col-span-7 glass-card p-4">
          <h3 className="text-sm font-semibold text-t-1 mb-4">Drawdown — 30 jours</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={DRAWDOWN_DATA}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff4d6d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#44445a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#44445a' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: 'rgba(13,13,31,0.95)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontSize: '11px' }}
              />
              <Area type="monotone" dataKey="drawdown" stroke="#ff4d6d" fill="url(#ddGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk rules */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <AlertTriangle size={14} className="text-accent-amber" />
          <span className="text-sm font-semibold text-t-1">Règles de Risk Management</span>
        </div>
        <div className="divide-y divide-border">
          {RULES.map((r) => (
            <div key={r.rule} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-2 rounded-full', r.ok ? 'bg-bull' : 'bg-accent-amber')} />
                <span className="text-sm text-t-2">{r.rule}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-t-3 font-mono">{r.value}</span>
                <span className={cn('text-xs font-medium', r.ok ? 'text-bull' : 'text-accent-amber')}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
