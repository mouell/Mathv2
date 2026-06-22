'use client';
import { motion } from 'framer-motion';
import { WatchlistPanel } from '@/components/dashboard/WatchlistPanel';
import { SignalsPanel } from '@/components/dashboard/SignalsPanel';
import { NewsPanel } from '@/components/dashboard/NewsPanel';
import { AgentsPanel } from '@/components/dashboard/AgentsPanel';
import { HeatmapPanel } from '@/components/dashboard/HeatmapPanel';
import { OpportunitiesPanel } from '@/components/dashboard/OpportunitiesPanel';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { TradingViewChart } from '@/components/charts/TradingViewChart';

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function DashboardPage() {
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-3 space-y-3">
      {/* Top row: market overview stats */}
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <MarketOverview />
      </motion.div>

      {/* Main grid: chart + signals + news */}
      <div className="grid grid-cols-12 gap-3" style={{ minHeight: '420px' }}>
        {/* Chart - 7 cols */}
        <motion.div
          {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}
          className="col-span-12 ipad:col-span-7 h-[420px]"
        >
          <TradingViewChart />
        </motion.div>

        {/* Signals - 5 cols */}
        <motion.div
          {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}
          className="col-span-12 ipad:col-span-5 h-[420px]"
        >
          <SignalsPanel />
        </motion.div>
      </div>

      {/* Second row: watchlist + news + agents */}
      <div className="grid grid-cols-12 gap-3">
        {/* Watchlist */}
        <motion.div
          {...fadeUp} transition={{ duration: 0.3, delay: 0.15 }}
          className="col-span-12 tablet:col-span-6 ipad:col-span-4 h-80"
        >
          <WatchlistPanel />
        </motion.div>

        {/* News */}
        <motion.div
          {...fadeUp} transition={{ duration: 0.3, delay: 0.2 }}
          className="col-span-12 tablet:col-span-6 ipad:col-span-5 h-80"
        >
          <NewsPanel />
        </motion.div>

        {/* Agents */}
        <motion.div
          {...fadeUp} transition={{ duration: 0.3, delay: 0.25 }}
          className="col-span-12 ipad:col-span-3 h-80"
        >
          <AgentsPanel />
        </motion.div>
      </div>

      {/* Third row: heatmap + opportunities */}
      <div className="grid grid-cols-12 gap-3">
        <motion.div
          {...fadeUp} transition={{ duration: 0.3, delay: 0.3 }}
          className="col-span-12 ipad:col-span-7 h-64"
        >
          <HeatmapPanel />
        </motion.div>

        <motion.div
          {...fadeUp} transition={{ duration: 0.3, delay: 0.35 }}
          className="col-span-12 ipad:col-span-5 h-64"
        >
          <OpportunitiesPanel />
        </motion.div>
      </div>
    </div>
  );
}
