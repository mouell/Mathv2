'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, TrendingUp, Newspaper, Zap,
  Shield, Brain, BarChart3, ChevronLeft, ChevronRight,
  Bot, Settings, Bell, Wifi, WifiOff,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: '#7c5cfc' },
  { href: '/opportunities', label: 'Opportunités', icon: Zap, color: '#f5a623' },
  { href: '/news', label: 'Actualités', icon: Newspaper, color: '#38bdf8' },
  { href: '/trades', label: 'Trades', icon: TrendingUp, color: '#00d4b1' },
  { href: '/performance', label: 'Performance', icon: BarChart3, color: '#84cc16' },
  { href: '/risk', label: 'Risk Manager', icon: Shield, color: '#ff4d6d' },
  { href: '/learning', label: 'IA Learning', icon: Brain, color: '#a78bfa' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, wsConnected, unreadCount, agents } = useStore();

  const activeAgents = agents.filter((a) => a.status === 'ACTIVE').length;

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 220 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col h-full bg-bg-1 border-r border-border relative z-20 shrink-0"
    >
      {/* Logo */}
      <div className={cn('flex items-center h-14 px-4 border-b border-border', sidebarCollapsed && 'justify-center')}>
        <div className="w-8 h-8 rounded-xl bg-accent-violet flex items-center justify-center shrink-0 glow-violet">
          <Bot size={18} className="text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="ml-3 overflow-hidden whitespace-nowrap"
            >
              <div className="text-sm font-bold text-t-1 text-gradient-violet">TradingAI</div>
              <div className="text-xs text-t-3">Dashboard v1.0</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group',
                  active
                    ? 'bg-accent-violet-dim text-accent-violet'
                    : 'text-t-3 hover:text-t-2 hover:bg-bg-3',
                  sidebarCollapsed && 'justify-center'
                )}
              >
                <item.icon
                  size={18}
                  style={{ color: active ? item.color : undefined }}
                  className="shrink-0"
                />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute left-0 w-0.5 h-6 rounded-r-full"
                    style={{ background: item.color }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom status */}
      <div className="p-2 border-t border-border space-y-1">
        {/* WS status */}
        <div className={cn('flex items-center gap-2 px-2 py-2 rounded-xl', sidebarCollapsed && 'justify-center')}>
          {wsConnected
            ? <Wifi size={14} className="text-bull shrink-0" />
            : <WifiOff size={14} className="text-bear shrink-0" />
          }
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className={cn('text-xs whitespace-nowrap', wsConnected ? 'text-bull' : 'text-bear')}
              >
                {wsConnected ? 'Live connecté' : 'Mode démo'}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Agents status */}
        <div className={cn('flex items-center gap-2 px-2 py-2 rounded-xl', sidebarCollapsed && 'justify-center')}>
          <div className="w-2 h-2 rounded-full bg-bull shrink-0 animate-pulse-slow" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-t-2 whitespace-nowrap"
              >
                {activeAgents} agents actifs
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse button */}
        <button
          onClick={toggleSidebar}
          className={cn('btn-icon w-full justify-center mt-1', sidebarCollapsed ? 'w-8 mx-auto' : 'w-full')}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </motion.aside>
  );
}
