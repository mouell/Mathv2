'use client';
import { motion } from 'framer-motion';
import { Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/utils/format';

export function NewsPanel() {
  const { news } = useStore();
  const recent = news.slice(0, 8);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-accent-sky" />
          <span className="text-sm font-semibold text-t-1">Actualités IA</span>
        </div>
        <button className="btn-ghost text-xs py-1 px-2">Tout voir →</button>
      </div>

      <div className="panel-body p-0">
        {recent.map((item, i) => {
          const isBull = item.sentiment === 'BULLISH';
          const isBear = item.sentiment === 'BEARISH';

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-bg-3 cursor-pointer transition-colors group"
            >
              {/* Sentiment indicator */}
              <div className={cn(
                'mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center',
                isBull ? 'bg-bull/10 text-bull' : isBear ? 'bg-bear/10 text-bear' : 'bg-accent-amber-dim text-accent-amber'
              )}>
                {isBull ? <TrendingUp size={11} /> : isBear ? <TrendingDown size={11} /> : <Minus size={11} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium text-t-1 line-clamp-2 leading-relaxed flex-1">
                    {item.isBreaking && (
                      <span className="badge badge-rose text-[10px] mr-1">BREAKING</span>
                    )}
                    {item.title}
                  </div>
                  <ExternalLink size={11} className="text-t-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-t-3">{item.source}</span>
                  <span className="text-[10px] text-t-3">•</span>
                  <span className="text-[10px] text-t-3">{formatTimeAgo(item.publishedAt)}</span>
                  {item.relatedAssets.length > 0 && (
                    <>
                      <span className="text-[10px] text-t-3">•</span>
                      <div className="flex gap-1">
                        {item.relatedAssets.slice(0, 3).map((sym) => (
                          <span key={sym} className="badge badge-violet text-[10px] px-1 py-0">
                            {sym.replace('USDT', '')}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Impact bar */}
                {item.impactScore > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-bg-3 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.impactScore}%` }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        style={{
                          background: isBull ? '#00d4b1' : isBear ? '#ff4d6d' : '#f5a623',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-t-3 shrink-0">Impact {item.impactScore}%</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
