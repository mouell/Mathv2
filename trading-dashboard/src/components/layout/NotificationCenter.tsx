'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, TrendingUp, Newspaper, AlertTriangle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/utils/format';

export function NotificationCenter() {
  const { notifications, markAllRead, unreadCount } = useStore();
  const recent = notifications.slice(0, 8);

  if (unreadCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, x: 10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0 }}
      className="fixed top-16 right-4 w-80 z-50"
    >
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-accent-violet" />
            <span className="text-sm font-semibold text-t-1">Notifications</span>
            <span className="badge badge-violet">{unreadCount}</span>
          </div>
          <button onClick={markAllRead} className="text-xs text-t-3 hover:text-t-2 transition-colors">
            Tout lire
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {recent.map((n) => (
            <div key={n.id} className={cn(
              'px-4 py-3 border-b border-border last:border-0 flex gap-3',
              !n.read && 'bg-bg-3/30'
            )}>
              <div className={cn('mt-0.5 shrink-0', n.type === 'SIGNAL' ? 'text-accent-amber' : n.type === 'NEWS' ? 'text-accent-sky' : 'text-accent-rose')}>
                {n.type === 'SIGNAL' ? <TrendingUp size={14} /> : n.type === 'NEWS' ? <Newspaper size={14} /> : <AlertTriangle size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-t-1 truncate">{n.title}</div>
                <div className="text-xs text-t-3 mt-0.5 line-clamp-2">{n.message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
