export type AgentType = 'NEWS' | 'CRYPTO' | 'MACRO' | 'SENTIMENT' | 'TECHNICAL' | 'RISK' | 'LEARNING';

export interface AgentScore {
  agentId: string;
  agentName: AgentType;
  score: number;
  confidence: number;
  reasoning: string;
  weight: number;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  timeframe: string;
  reason: string;
  agentScores: AgentScore[];
  newsRefs: string[];
  technicalIndicators: Record<string, any>;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}
