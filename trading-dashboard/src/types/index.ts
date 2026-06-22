// ─── Market Types ─────────────────────────────────────────────────────────────

export interface Asset {
  symbol: string;
  name: string;
  type: 'crypto' | 'stock' | 'forex' | 'commodity';
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap?: number;
  high24h: number;
  low24h: number;
  lastUpdated: Date;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBook {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: Date;
}

// ─── Signal Types ─────────────────────────────────────────────────────────────

export type SignalDirection = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface TradingSignal {
  id: string;
  symbol: string;
  direction: SignalDirection;
  strength: SignalStrength;
  confidence: number; // 0-100
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  timeframe: Timeframe;
  reason: string;
  agentScores: AgentScore[];
  newsRefs: string[];
  technicalIndicators: TechnicalIndicators;
  createdAt: Date;
  expiresAt: Date;
  status: 'ACTIVE' | 'TRIGGERED' | 'EXPIRED' | 'CANCELLED';
}

export interface AgentScore {
  agentId: string;
  agentName: AgentType;
  score: number; // -100 to 100 (negative = bearish, positive = bullish)
  confidence: number;
  reasoning: string;
  weight: number;
}

export type AgentType =
  | 'NEWS'
  | 'CRYPTO'
  | 'MACRO'
  | 'SENTIMENT'
  | 'TECHNICAL'
  | 'RISK'
  | 'LEARNING';

export interface TechnicalIndicators {
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  ema20?: number;
  ema50?: number;
  ema200?: number;
  bollinger?: { upper: number; middle: number; lower: number };
  volume?: number;
  atr?: number;
  stochastic?: { k: number; d: number };
}

// ─── News Types ───────────────────────────────────────────────────────────────

export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content?: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: Sentiment;
  sentimentScore: number; // -1 to 1
  impactScore: number; // 0-100
  relatedAssets: string[];
  categories: string[];
  aiAnalysis?: AIAnalysis;
  imageUrl?: string;
  isBreaking: boolean;
}

export interface AIAnalysis {
  summary: string;
  sentiment: Sentiment;
  confidence: number;
  keyPoints: string[];
  affectedAssets: { symbol: string; impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; magnitude: number }[];
  tradingImplication: string;
  timeHorizon: 'SHORT' | 'MEDIUM' | 'LONG';
}

// ─── Trade Types ──────────────────────────────────────────────────────────────

export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'PENDING';
export type TradeType = 'LONG' | 'SHORT';

export interface Trade {
  id: string;
  symbol: string;
  type: TradeType;
  status: TradeStatus;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  pnl?: number;
  pnlPercent?: number;
  openedAt: Date;
  closedAt?: Date;
  signalId?: string;
  notes?: string;
  tags: string[];
  agentRecommendation?: string;
  isPaper: boolean;
}

// ─── Performance Types ────────────────────────────────────────────────────────

export interface PerformanceMetrics {
  period: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  sharpeRatio: number;
  sortino?: number;
  averageWin: number;
  averageLoss: number;
  riskRewardRatio: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  dailyPnL: DailyPnL[];
}

export interface DailyPnL {
  date: string;
  pnl: number;
  trades: number;
  winRate: number;
  cumulativePnL: number;
}

// ─── Agent Types ──────────────────────────────────────────────────────────────

export interface AgentStatus {
  id: string;
  type: AgentType;
  name: string;
  status: 'ACTIVE' | 'IDLE' | 'ERROR' | 'LEARNING';
  lastRun: Date;
  accuracy: number;
  totalSignals: number;
  correctSignals: number;
  currentScore?: number;
  description: string;
  icon: string;
  color: string;
}

export interface AgentLearning {
  agentId: string;
  date: string;
  accuracy: number;
  signalsGenerated: number;
  correctPredictions: number;
  parameterAdjustments: ParameterAdjustment[];
  insights: string[];
}

export interface ParameterAdjustment {
  parameter: string;
  oldValue: number;
  newValue: number;
  reason: string;
}

// ─── WebSocket Types ──────────────────────────────────────────────────────────

export type WSEventType =
  | 'PRICE_UPDATE'
  | 'NEW_SIGNAL'
  | 'NEWS_UPDATE'
  | 'AGENT_UPDATE'
  | 'TRADE_UPDATE'
  | 'ALERT'
  | 'MARKET_STATUS';

export interface WSMessage<T = unknown> {
  type: WSEventType;
  data: T;
  timestamp: Date;
}

// ─── UI Types ─────────────────────────────────────────────────────────────────

export interface PanelConfig {
  id: string;
  type: PanelType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  visible: boolean;
}

export type PanelType =
  | 'PRICE_TICKER'
  | 'CHART'
  | 'NEWS_FEED'
  | 'SIGNALS'
  | 'AGENTS'
  | 'WATCHLIST'
  | 'HEATMAP'
  | 'ORDERBOOK'
  | 'TRADES'
  | 'PERFORMANCE'
  | 'SENTIMENT';

export interface Notification {
  id: string;
  type: 'SIGNAL' | 'NEWS' | 'ALERT' | 'SYSTEM';
  title: string;
  message: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

// ─── Market Status ────────────────────────────────────────────────────────────

export interface MarketStatus {
  crypto: 'OPEN' | 'CLOSED';
  nyse: 'OPEN' | 'CLOSED' | 'PRE' | 'AFTER';
  nasdaq: 'OPEN' | 'CLOSED' | 'PRE' | 'AFTER';
  forex: 'OPEN' | 'CLOSED';
  fearGreedIndex: number;
  marketSentiment: Sentiment;
  dominance: { btc: number; eth: number; others: number };
  totalMarketCap: number;
  volume24h: number;
}

// ─── Opportunity Types ────────────────────────────────────────────────────────

export interface Opportunity {
  id: string;
  symbol: string;
  type: 'BREAKOUT' | 'MOMENTUM' | 'VOLUME_SPIKE' | 'REVERSAL' | 'TREND' | 'NEWS_CATALYST' | 'PATTERN';
  direction: SignalDirection;
  confidence: number;
  potentialGain: number;
  risk: number;
  description: string;
  signals: TradingSignal[];
  detectedAt: Date;
  expiresAt: Date;
  status: 'ACTIVE' | 'TRIGGERED' | 'MISSED' | 'EXPIRED';
}
