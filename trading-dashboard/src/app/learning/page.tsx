'use client';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { Brain, TrendingUp, Zap, BookOpen, Target, ChevronRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

function generateLearningCurve() {
  let acc = 52;
  return Array.from({ length: 30 }, (_, i) => {
    const noise = (Math.random() - 0.45) * 4;
    acc = Math.min(95, Math.max(45, acc + noise + 0.3));
    return {
      day: `J${i + 1}`,
      accuracy: Math.round(acc * 10) / 10,
      signals: Math.round(15 + Math.random() * 20),
    };
  });
}

const LEARNING_DATA = generateLearningCurve();

const AGENT_EVOLUTION = [
  { agent: 'News', accuracy: 78, delta: +3.2, signals: 234, key_insight: 'Amélioration détection catalyseurs macro' },
  { agent: 'Crypto', accuracy: 81, delta: +5.1, signals: 412, key_insight: 'Meilleure corrélation on-chain/prix' },
  { agent: 'Macro', accuracy: 74, delta: +1.8, signals: 89, key_insight: 'Intégration nouvelles variables Fed' },
  { agent: 'Sentiment', accuracy: 69, delta: -1.2, signals: 567, key_insight: 'Réduction faux positifs X/Twitter' },
  { agent: 'Technical', accuracy: 83, delta: +2.7, signals: 891, key_insight: 'Nouveaux patterns candlestick appris' },
  { agent: 'Risk', accuracy: 88, delta: +0.9, signals: 456, key_insight: 'Optimisation position sizing' },
  { agent: 'Learning', accuracy: 76, delta: +4.3, signals: 1203, key_insight: 'Meta-apprentissage inter-agents amélioré' },
];

const TODAY_INSIGHTS = [
  { type: 'win', text: 'Signal BTC breakout : +5.4% en 4h. Facteurs corrects : volume, RSI, catalyseur news.' },
  { type: 'loss', text: 'Signal XRP short : -3.8% (stop hit). Erreur : correlation SOL non prise en compte.' },
  { type: 'learn', text: 'Ajustement : poids Agent Sentiment augmenté de 0.20 → 0.25 pour cryptos.' },
  { type: 'learn', text: 'Nouveau paramètre : volatilité implicite intégrée dans scoring des options.' },
  { type: 'win', text: 'NVDA earnings signal : +8.1%. Modèle news catalyst très performant ce mois.' },
];

const RADAR_DATA = [
  { skill: 'Précision', value: 78 },
  { skill: 'Rapidité', value: 85 },
  { skill: 'Diversité', value: 65 },
  { skill: 'Robustesse', value: 72 },
  { skill: 'Adaptation', value: 80 },
  { skill: 'Gestion risque', value: 88 },
];

export default function LearningPage() {
  const { agents } = useStore();
  const latestAccuracy = LEARNING_DATA[LEARNING_DATA.length - 1].accuracy;
  const firstAccuracy = LEARNING_DATA[0].accuracy;
  const improvement = (latestAccuracy - firstAccuracy).toFixed(1);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain size={20} className="text-accent-violet" />
        <h1 className="text-xl font-bold text-t-1">Apprentissage IA</h1>
        <div className="badge badge-violet ml-2">
          <span className="text-bull">+{improvement}%</span>
          <span className="ml-1">en 30j</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 ipad:grid-cols-4 gap-3">
        {[
          { label: 'Précision globale', value: `${latestAccuracy}%`, icon: <Target size={16} />, color: 'text-bull' },
          { label: 'Amélioration 30j', value: `+${improvement}%`, icon: <TrendingUp size={16} />, color: 'text-accent-violet' },
          { label: 'Signaux appris', value: '3 432', icon: <Zap size={16} />, color: 'text-accent-amber' },
          { label: 'Modèles actifs', value: '7', icon: <Brain size={16} />, color: 'text-accent-teal' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass-card px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-t-3">{s.label}</span>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div className={cn('text-2xl font-bold font-mono', s.color)}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Learning curve */}
        <div className="col-span-12 ipad:col-span-8 glass-card p-4">
          <h3 className="text-sm font-semibold text-t-1 mb-4">Courbe d&apos;apprentissage — 30 jours</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={LEARNING_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#44445a' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis domain={[45, 95]} tick={{ fontSize: 10, fill: '#44445a' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: 'rgba(13,13,31,0.95)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontSize: '11px' }}
              />
              <Line type="monotone" dataKey="accuracy" stroke="#7c5cfc" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Radar skills */}
        <div className="col-span-12 ipad:col-span-4 glass-card p-4">
          <h3 className="text-sm font-semibold text-t-1 mb-4">Compétences IA</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9, fill: '#44445a' }} />
              <Radar dataKey="value" stroke="#7c5cfc" fill="#7c5cfc" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent evolution table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <BookOpen size={14} className="text-accent-violet" />
          <span className="text-sm font-semibold text-t-1">Évolution des Agents — Ce mois</span>
        </div>
        <div className="divide-y divide-border">
          {AGENT_EVOLUTION.map((a, i) => (
            <motion.div
              key={a.agent}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 px-4 py-3 hover:bg-bg-3 transition-colors"
            >
              <span className="text-sm font-semibold text-t-1 w-20 shrink-0">Agent {a.agent}</span>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent-violet"
                      initial={{ width: 0 }}
                      animate={{ width: `${a.accuracy}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05 }}
                    />
                  </div>
                  <span className="text-xs font-bold font-mono text-t-1 w-10 text-right">{a.accuracy}%</span>
                </div>
                <div className="text-xs text-t-3 truncate">{a.key_insight}</div>
              </div>

              <div className="text-right shrink-0">
                <div className={cn('text-sm font-bold font-mono', a.delta >= 0 ? 'text-bull' : 'text-bear')}>
                  {a.delta >= 0 ? '+' : ''}{a.delta}%
                </div>
                <div className="text-xs text-t-3">{a.signals} signaux</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Today insights */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Brain size={14} className="text-accent-amber" />
          <span className="text-sm font-semibold text-t-1">Journal IA — Aujourd&apos;hui</span>
        </div>
        <div className="p-4 space-y-3">
          {TODAY_INSIGHTS.map((ins, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl',
                ins.type === 'win' ? 'bg-bull/10 border border-bull/20'
                : ins.type === 'loss' ? 'bg-bear/10 border border-bear/20'
                : 'bg-accent-violet-dim border border-accent-violet/20'
              )}
            >
              <span className="text-lg shrink-0">
                {ins.type === 'win' ? '✅' : ins.type === 'loss' ? '❌' : '🧠'}
              </span>
              <span className="text-sm text-t-2 leading-relaxed">{ins.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
