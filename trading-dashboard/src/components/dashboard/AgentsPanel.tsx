'use client';
import { motion } from 'framer-motion';
import { Bot, Activity } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function AgentsPanel() {
  const { agents } = useStore();

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-accent-violet" />
          <span className="text-sm font-semibold text-t-1">Agents IA</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
          <span className="text-xs text-bull">{agents.filter((a) => a.status === 'ACTIVE').length} actifs</span>
        </div>
      </div>

      <div className="panel-body p-2 space-y-1.5">
        {agents.map((agent, i) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-2 p-2 rounded-xl hover:bg-bg-3 transition-colors cursor-pointer"
          >
            {/* Icon */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm"
              style={{ background: `${agent.color}20` }}
            >
              {agent.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-t-1 truncate">{agent.name.replace('Agent ', '')}</span>
                <span className="text-xs font-bold font-mono" style={{ color: agent.color }}>
                  {agent.accuracy}%
                </span>
              </div>
              {/* Accuracy bar */}
              <div className="mt-1 h-1 bg-bg-3 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${agent.accuracy}%` }}
                  transition={{ duration: 0.8, delay: i * 0.06 + 0.2 }}
                  style={{ background: agent.color }}
                />
              </div>
            </div>

            {/* Status dot */}
            <div className={cn(
              'w-2 h-2 rounded-full shrink-0',
              agent.status === 'ACTIVE' ? 'bg-bull animate-pulse-slow'
              : agent.status === 'LEARNING' ? 'bg-accent-amber animate-pulse'
              : agent.status === 'ERROR' ? 'bg-bear'
              : 'bg-t-3'
            )} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
