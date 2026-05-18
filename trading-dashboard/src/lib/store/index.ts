import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  Asset, TradingSignal, NewsItem, Trade,
  AgentStatus, MarketStatus, Notification,
  Opportunity, PerformanceMetrics,
} from '@/types';

interface TradingStore {
  // ── Market data ─────────────────────────────────
  assets: Record<string, Asset>;
  marketStatus: MarketStatus | null;
  setAsset: (symbol: string, asset: Asset) => void;
  setMarketStatus: (status: MarketStatus) => void;

  // ── Signals ──────────────────────────────────────
  signals: TradingSignal[];
  activeSignals: TradingSignal[];
  addSignal: (signal: TradingSignal) => void;
  updateSignal: (id: string, update: Partial<TradingSignal>) => void;

  // ── News ─────────────────────────────────────────
  news: NewsItem[];
  addNews: (item: NewsItem) => void;
  setNews: (items: NewsItem[]) => void;

  // ── Trades ───────────────────────────────────────
  trades: Trade[];
  openTrades: Trade[];
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, update: Partial<Trade>) => void;

  // ── Agents ───────────────────────────────────────
  agents: AgentStatus[];
  setAgents: (agents: AgentStatus[]) => void;
  updateAgent: (id: string, update: Partial<AgentStatus>) => void;

  // ── Opportunities ────────────────────────────────
  opportunities: Opportunity[];
  setOpportunities: (ops: Opportunity[]) => void;

  // ── Performance ──────────────────────────────────
  performance: PerformanceMetrics | null;
  setPerformance: (p: PerformanceMetrics) => void;

  // ── Notifications ────────────────────────────────
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markAllRead: () => void;

  // ── UI state ─────────────────────────────────────
  sidebarCollapsed: boolean;
  selectedSymbol: string;
  watchlist: string[];
  toggleSidebar: () => void;
  setSelectedSymbol: (s: string) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;

  // ── WebSocket ────────────────────────────────────
  wsConnected: boolean;
  setWsConnected: (v: boolean) => void;
}

export const useStore = create<TradingStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // ── Market data ─────────────────────────────
        assets: {},
        marketStatus: null,
        setAsset: (symbol, asset) =>
          set((s) => ({ assets: { ...s.assets, [symbol]: asset } })),
        setMarketStatus: (status) => set({ marketStatus: status }),

        // ── Signals ─────────────────────────────────
        signals: [],
        activeSignals: [],
        addSignal: (signal) =>
          set((s) => {
            const signals = [signal, ...s.signals].slice(0, 100);
            const activeSignals = signals.filter((sig) => sig.status === 'ACTIVE');
            return { signals, activeSignals };
          }),
        updateSignal: (id, update) =>
          set((s) => ({
            signals: s.signals.map((sig) => (sig.id === id ? { ...sig, ...update } : sig)),
            activeSignals: s.activeSignals.map((sig) => (sig.id === id ? { ...sig, ...update } : sig)),
          })),

        // ── News ────────────────────────────────────
        news: [],
        addNews: (item) =>
          set((s) => ({ news: [item, ...s.news].slice(0, 200) })),
        setNews: (items) => set({ news: items }),

        // ── Trades ──────────────────────────────────
        trades: [],
        openTrades: [],
        addTrade: (trade) =>
          set((s) => {
            const trades = [trade, ...s.trades];
            const openTrades = trades.filter((t) => t.status === 'OPEN');
            return { trades, openTrades };
          }),
        updateTrade: (id, update) =>
          set((s) => {
            const trades = s.trades.map((t) => (t.id === id ? { ...t, ...update } : t));
            return { trades, openTrades: trades.filter((t) => t.status === 'OPEN') };
          }),

        // ── Agents ──────────────────────────────────
        agents: [],
        setAgents: (agents) => set({ agents }),
        updateAgent: (id, update) =>
          set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...update } : a)) })),

        // ── Opportunities ────────────────────────────
        opportunities: [],
        setOpportunities: (ops) => set({ opportunities: ops }),

        // ── Performance ─────────────────────────────
        performance: null,
        setPerformance: (p) => set({ performance: p }),

        // ── Notifications ────────────────────────────
        notifications: [],
        unreadCount: 0,
        addNotification: (n) =>
          set((s) => ({
            notifications: [n, ...s.notifications].slice(0, 50),
            unreadCount: s.unreadCount + 1,
          })),
        markAllRead: () => set({ unreadCount: 0, notifications: get().notifications.map((n) => ({ ...n, read: true })) }),

        // ── UI state ─────────────────────────────────
        sidebarCollapsed: false,
        selectedSymbol: 'BTCUSDT',
        watchlist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AAPL', 'NVDA', 'SPY', 'EURUSD'],
        toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
        setSelectedSymbol: (s) => set({ selectedSymbol: s }),
        addToWatchlist: (symbol) =>
          set((s) => ({ watchlist: s.watchlist.includes(symbol) ? s.watchlist : [...s.watchlist, symbol] })),
        removeFromWatchlist: (symbol) =>
          set((s) => ({ watchlist: s.watchlist.filter((w) => w !== symbol) })),

        // ── WebSocket ────────────────────────────────
        wsConnected: false,
        setWsConnected: (v) => set({ wsConnected: v }),
      }),
      {
        name: 'trading-store',
        partialize: (s) => ({
          watchlist: s.watchlist,
          selectedSymbol: s.selectedSymbol,
          sidebarCollapsed: s.sidebarCollapsed,
        }),
      }
    )
  )
);
