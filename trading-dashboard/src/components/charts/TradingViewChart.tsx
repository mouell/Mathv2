'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Settings2, RefreshCw } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

export function TradingViewChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const { selectedSymbol, setSelectedSymbol, watchlist } = useStore();
  const [timeframe, setTimeframe] = useState('1h');
  const [loaded, setLoaded] = useState(false);

  const tvSymbol = selectedSymbol.includes('USDT')
    ? `BINANCE:${selectedSymbol}`
    : selectedSymbol.includes('USD') && selectedSymbol.length === 6
    ? `FX:${selectedSymbol}`
    : `NASDAQ:${selectedSymbol}`;

  useEffect(() => {
    if (!containerRef.current) return;

    // Remove old widget
    containerRef.current.innerHTML = '';
    setLoaded(false);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: timeframe.replace('m', '').replace('h', '60').replace('D', 'D').replace('W', 'W'),
      timezone: 'Europe/Paris',
      theme: 'dark',
      style: '1',
      locale: 'fr',
      backgroundColor: 'rgba(6,6,15,0)',
      gridColor: 'rgba(255,255,255,0.03)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies', 'Volume@tv-basicstudies'],
    });

    script.onload = () => setLoaded(true);

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.cssText = 'height:calc(100% - 32px);width:100%;';

    containerRef.current.appendChild(widgetDiv);
    containerRef.current.appendChild(script);

    return () => { if (containerRef.current) containerRef.current.innerHTML = ''; };
  }, [tvSymbol, timeframe]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-t-1">{selectedSymbol}</span>
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium transition-all duration-150',
                  timeframe === tf
                    ? 'bg-accent-violet text-white'
                    : 'text-t-3 hover:text-t-2 hover:bg-bg-3'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Symbol switcher */}
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="text-xs bg-bg-3 border border-border rounded-lg px-2 py-1 text-t-2 outline-none cursor-pointer"
          >
            {watchlist.map((sym) => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
          </select>
          <button className="btn-icon">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-1">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-accent-violet border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-xs text-t-3">Chargement du graphique...</div>
            </div>
          </div>
        )}
        <div
          ref={containerRef}
          className="tradingview-widget-container h-full w-full"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
