'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, TrendingUp, TrendingDown, Minus, Filter, Search, RefreshCw, ExternalLink, Brain } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/utils/format';
import type { Sentiment } from '@/types';

const FILTERS: { label: string; value: Sentiment | 'ALL' }[] = [
  { label: 'Tout', value: 'ALL' },
  { label: 'Haussier', value: 'BULLISH' },
  { label: 'Baissier', value: 'BEARISH' },
  { label: 'Neutre', value: 'NEUTRAL' },
];

export default function NewsPage() {
  const { news } = useStore();
  const [filter, setFilter] = useState<Sentiment | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = news.filter((n) => {
    if (filter !== 'ALL' && n.sentiment !== filter) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedItem = selected ? news.find((n) => n.id === selected) : null;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: news list */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-border">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-1/50">
          <Newspaper size={16} className="text-accent-sky" />
          <span className="font-semibold text-t-1">Actualités IA</span>
          <span className="badge badge-violet">{news.length}</span>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-7 pr-3 py-1.5 text-xs bg-bg-3 border border-border rounded-lg text-t-1 placeholder-t-3 outline-none focus:border-accent-violet w-44"
            />
          </div>

          {/* Sentiment filters */}
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                  filter === f.value
                    ? f.value === 'BULLISH' ? 'bg-bull/20 text-bull' : f.value === 'BEARISH' ? 'bg-bear/20 text-bear' : 'bg-accent-violet-dim text-accent-violet'
                    : 'text-t-3 hover:text-t-2'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.map((item, i) => {
            const isBull = item.sentiment === 'BULLISH';
            const isBear = item.sentiment === 'BEARISH';

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => setSelected(selected === item.id ? null : item.id)}
                className={cn(
                  'px-4 py-3 cursor-pointer transition-colors hover:bg-bg-3',
                  selected === item.id && 'bg-accent-violet-dim'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'mt-0.5 shrink-0 w-6 h-6 rounded-md flex items-center justify-center',
                    isBull ? 'bg-bull/10 text-bull' : isBear ? 'bg-bear/10 text-bear' : 'bg-accent-amber-dim text-accent-amber'
                  )}>
                    {isBull ? <TrendingUp size={12} /> : isBear ? <TrendingDown size={12} /> : <Minus size={12} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-medium text-t-1 line-clamp-2 leading-relaxed flex-1">
                        {item.isBreaking && <span className="badge badge-rose text-[10px] mr-1 align-middle">BREAKING</span>}
                        {item.title}
                      </p>
                      {item.aiAnalysis && (
                        <Brain size={12} className="text-accent-violet shrink-0 mt-1" title="Analysé par IA" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs font-medium text-accent-sky">{item.source}</span>
                      <span className="text-xs text-t-3">{formatTimeAgo(item.publishedAt)}</span>

                      {item.relatedAssets.map((sym) => (
                        <span key={sym} className="badge badge-violet text-[10px] px-1.5">
                          {sym.replace('USDT', '')}
                        </span>
                      ))}

                      <span className={cn(
                        'text-xs font-medium ml-auto',
                        item.impactScore >= 75 ? 'text-bear' : item.impactScore >= 50 ? 'text-accent-amber' : 'text-t-3'
                      )}>
                        Impact {item.impactScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Right: AI analysis panel */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 360 }}
            exit={{ opacity: 0, width: 0 }}
            className="shrink-0 overflow-hidden flex flex-col"
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-accent-violet" />
                <span className="font-semibold text-t-1">Analyse IA</span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-t-1 leading-relaxed mb-2">{selectedItem.title}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-accent-sky font-medium">{selectedItem.source}</span>
                  <span className="text-xs text-t-3">{formatTimeAgo(selectedItem.publishedAt)}</span>
                  <a href={selectedItem.url} target="_blank" className="ml-auto text-t-3 hover:text-t-1">
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {selectedItem.aiAnalysis && (
                <>
                  {/* Sentiment + confidence */}
                  <div className="glass-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-t-3">Sentiment IA</span>
                      <span className={cn(
                        'badge font-semibold',
                        selectedItem.sentiment === 'BULLISH' ? 'badge-bull'
                        : selectedItem.sentiment === 'BEARISH' ? 'badge-bear'
                        : 'badge-neutral'
                      )}>
                        {selectedItem.sentiment}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-t-3 w-20">Confiance</span>
                      <div className="flex-1 h-2 bg-bg-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-violet"
                          style={{ width: `${selectedItem.aiAnalysis.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-t-1">{selectedItem.aiAnalysis.confidence}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-t-3">Horizon</span>
                      <span className="text-xs text-t-1">{selectedItem.aiAnalysis.timeHorizon}</span>
                    </div>
                  </div>

                  {/* Key points */}
                  <div>
                    <div className="text-xs font-semibold text-t-2 mb-2">Points clés</div>
                    <ul className="space-y-1.5">
                      {selectedItem.aiAnalysis.keyPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-t-2">
                          <span className="text-accent-violet mt-0.5">•</span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Affected assets */}
                  {selectedItem.aiAnalysis.affectedAssets.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-t-2 mb-2">Actifs concernés</div>
                      <div className="space-y-1.5">
                        {selectedItem.aiAnalysis.affectedAssets.map((a) => (
                          <div key={a.symbol} className="flex items-center justify-between glass-card px-3 py-2">
                            <span className="text-xs font-bold text-t-1">{a.symbol.replace('USDT', '')}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${a.magnitude}%`,
                                    background: a.impact === 'POSITIVE' ? '#00d4b1' : a.impact === 'NEGATIVE' ? '#ff4d6d' : '#f5a623',
                                  }}
                                />
                              </div>
                              <span className={cn(
                                'text-xs font-medium',
                                a.impact === 'POSITIVE' ? 'text-bull' : a.impact === 'NEGATIVE' ? 'text-bear' : 'text-accent-amber'
                              )}>
                                {a.impact}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trading implication */}
                  <div className="glass-card p-3 border-l-2 border-accent-violet">
                    <div className="text-xs font-semibold text-accent-violet mb-1">Implication trading</div>
                    <div className="text-xs text-t-2 leading-relaxed">{selectedItem.aiAnalysis.tradingImplication}</div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
