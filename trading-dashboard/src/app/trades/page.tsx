'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Plus, Filter, Clock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatTimeAgo } from '@/lib/utils/format';
import type { Trade } from '@/types';

// Mock trade history
const MOCK_TRADES: Trade[] = [
  { id: '1', symbol: 'BTCUSDT', type: 'LONG', status: 'OPEN', entryPrice: 66800, quantity: 0.15, stopLoss: 65200, takeProfit: 70000, openedAt: new Date(Date.now() - 2 * 3600000), isPaper: true, tags: ['breakout', 'momentum'] },
  { id: '2', symbol: 'NVDA', type: 'LONG', status: 'OPEN', entryPrice: 123.5, quantity: 20, stopLoss: 118, takeProfit: 135, openedAt: new Date(Date.now() - 5 * 3600000), isPaper: true, tags: ['news', 'earnings'] },
  { id: '3', symbol: 'ETHUSDT', type: 'LONG', status: 'CLOSED', entryPrice: 3320, exitPrice: 3510, quantity: 2, stopLoss: 3200, takeProfit: 3600, pnl: 380, pnlPercent: 5.72, openedAt: new Date(Date.now() - 24 * 3600000), closedAt: new Date(Date.now() - 12 * 3600000), isPaper: true, tags: ['technical'] },
  { id: '4', symbol: 'SOLUSDT', type: 'LONG', status: 'CLOSED', entryPrice: 178.5, exitPrice: 186.2, quantity: 10, stopLoss: 172, takeProfit: 195, pnl: 77, pnlPercent: 4.31, openedAt: new Date(Date.now() - 30 * 3600000), closedAt: new Date(Date.now() - 18 * 3600000), isPaper: true, tags: ['momentum'] },
  { id: '5', symbol: 'XRPUSDT', type: 'SHORT', status: 'CLOSED', entryPrice: 0.598, exitPrice: 0.621, quantity: 5000, stopLoss: 0.615, takeProfit: 0.55, pnl: -115, pnlPercent: -3.85, openedAt: new Date(Date.now() - 48 * 3600000), closedAt: new Date(Date.now() - 36 * 3600000), isPaper: true, tags: ['reversal'] },
  { id: '6', symbol: 'AAPL', type: 'LONG', status: 'CLOSED', entryPrice: 210.2, exitPrice: 215.8, quantity: 15, stopLoss: 206, takeProfit: 220, pnl: 84, pnlPercent: 2.66, openedAt: new Date(Date.now() - 72 * 3600000), closedAt: new Date(Date.now() - 48 * 3600000), isPaper: true, tags: ['macro'] },
];

export default function TradesPage() {
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [showNew, setShowNew] = useState(false);

  const filtered = MOCK_TRADES.filter((t) => filter === 'ALL' || t.status === filter);

  const openCount = MOCK_TRADES.filter((t) => t.status === 'OPEN').length;
  const totalPnL = MOCK_TRADES.filter((t) => t.pnl !== undefined).reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winTrades = MOCK_TRADES.filter((t) => t.status === 'CLOSED' && (t.pnl || 0) > 0).length;
  const closedCount = MOCK_TRADES.filter((t) => t.status === 'CLOSED').length;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-accent-teal" />
          <h1 className="text-xl font-bold text-t-1">Journal des Trades</h1>
          <span className="badge badge-violet">Paper Trading</span>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          Nouveau Trade
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 ipad:grid-cols-4 gap-3">
        {[
          { label: 'Trades ouverts', value: openCount, color: 'text-accent-amber' },
          { label: 'PnL total', value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(0)}`, color: totalPnL >= 0 ? 'text-bull' : 'text-bear' },
          { label: 'Win Rate', value: `${closedCount > 0 ? ((winTrades / closedCount) * 100).toFixed(0) : 0}%`, color: 'text-accent-violet' },
          { label: 'Total trades', value: MOCK_TRADES.length, color: 'text-t-1' },
        ].map((s) => (
          <div key={s.label} className="glass-card px-4 py-3">
            <div className="text-xs text-t-3 mb-1">{s.label}</div>
            <div className={cn('text-2xl font-bold font-mono', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['ALL', 'OPEN', 'CLOSED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              filter === f ? 'bg-accent-violet text-white' : 'btn-ghost'
            )}
          >
            {f === 'ALL' ? 'Tous' : f === 'OPEN' ? 'Ouverts' : 'Fermés'}
          </button>
        ))}
      </div>

      {/* Trades table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Statut', 'Symbole', 'Direction', 'Entrée', 'Actuel/Sortie', 'Qté', 'Stop Loss', 'Take Profit', 'PnL', 'Tags', 'Ouvert'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-t-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((trade, i) => {
                const pnlPositive = (trade.pnl || 0) >= 0;
                return (
                  <motion.tr
                    key={trade.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border last:border-0 hover:bg-bg-3 transition-colors"
                  >
                    <td className="px-4 py-3">
                      {trade.status === 'OPEN'
                        ? <span className="flex items-center gap-1 text-accent-amber text-xs"><Clock size={11} /> Ouvert</span>
                        : trade.status === 'CLOSED'
                        ? <span className="flex items-center gap-1 text-t-3 text-xs"><CheckCircle size={11} /> Fermé</span>
                        : <span className="flex items-center gap-1 text-bear text-xs"><XCircle size={11} /> Annulé</span>
                      }
                    </td>
                    <td className="px-4 py-3 font-bold text-t-1">{trade.symbol.replace('USDT', '')}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', trade.type === 'LONG' ? 'badge-bull' : 'badge-bear')}>
                        {trade.type === 'LONG' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-t-2">{formatNumber(trade.entryPrice)}</td>
                    <td className="px-4 py-3 font-mono text-t-2">
                      {trade.exitPrice ? formatNumber(trade.exitPrice) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-t-2">{trade.quantity}</td>
                    <td className="px-4 py-3 font-mono text-bear">{formatNumber(trade.stopLoss)}</td>
                    <td className="px-4 py-3 font-mono text-bull">{formatNumber(trade.takeProfit)}</td>
                    <td className="px-4 py-3">
                      {trade.pnl !== undefined ? (
                        <span className={cn('font-bold font-mono', pnlPositive ? 'text-bull' : 'text-bear')}>
                          {pnlPositive ? '+' : ''}${trade.pnl.toFixed(0)}
                          {trade.pnlPercent !== undefined && (
                            <span className="text-xs ml-1">({formatPercent(trade.pnlPercent)})</span>
                          )}
                        </span>
                      ) : <span className="text-t-3">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {trade.tags.map((tag) => (
                          <span key={tag} className="badge badge-violet text-[10px] px-1">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-t-3 whitespace-nowrap">{formatTimeAgo(trade.openedAt)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
