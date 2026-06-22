import { Server as SocketServer } from 'socket.io';
import { logger } from '../lib/logger';
import { NewsAgent } from './newsAgent';
import { TechnicalAgent } from './technicalAgent';
import { SentimentAgent } from './sentimentAgent';
import { RiskAgent } from './riskAgent';
import { LearningAgent } from './learningAgent';
import type { AgentScore, TradingSignal } from '../types';

export class AgentOrchestrator {
  private io: SocketServer;
  private agents: Map<string, any> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  constructor(io: SocketServer) {
    this.io = io;
    this.agents.set('news', new NewsAgent());
    this.agents.set('technical', new TechnicalAgent());
    this.agents.set('sentiment', new SentimentAgent());
    this.agents.set('risk', new RiskAgent());
    this.agents.set('learning', new LearningAgent());
  }

  start() {
    logger.info('🤖 Orchestrateur IA démarré');

    // Run agents every 5 minutes
    this.intervalId = setInterval(() => this.runCycle(), 5 * 60 * 1000);

    // Run immediately
    setTimeout(() => this.runCycle(), 3000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async runCycle() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'NVDA', 'AAPL', 'SPY'];

    for (const symbol of symbols) {
      try {
        await this.analyzeSymbol(symbol);
      } catch (err) {
        logger.error(`Erreur analyse ${symbol}: ${err}`);
      }
    }
  }

  private async analyzeSymbol(symbol: string) {
    logger.info(`🔍 Analyse IA: ${symbol}`);

    const [newsScore, technicalScore, sentimentScore] = await Promise.allSettled([
      this.agents.get('news')?.analyze(symbol),
      this.agents.get('technical')?.analyze(symbol),
      this.agents.get('sentiment')?.analyze(symbol),
    ]);

    const scores: AgentScore[] = [];

    if (newsScore.status === 'fulfilled' && newsScore.value) scores.push(newsScore.value);
    if (technicalScore.status === 'fulfilled' && technicalScore.value) scores.push(technicalScore.value);
    if (sentimentScore.status === 'fulfilled' && sentimentScore.value) scores.push(sentimentScore.value);

    if (scores.length === 0) return;

    const combined = this.combineScores(scores);

    if (Math.abs(combined.score) > 50 && combined.confidence > 60) {
      const signal = await this.generateSignal(symbol, combined, scores);
      if (signal) {
        this.io.emit('NEW_SIGNAL', { type: 'NEW_SIGNAL', data: signal, timestamp: new Date() });
        logger.info(`📡 Signal émis: ${symbol} ${signal.direction} (${signal.confidence}%)`);
      }
    }
  }

  private combineScores(scores: AgentScore[]): { score: number; confidence: number } {
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const weightedScore = scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
    const avgConfidence = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;
    return { score: weightedScore, confidence: avgConfidence };
  }

  private async generateSignal(
    symbol: string,
    combined: { score: number; confidence: number },
    agentScores: AgentScore[]
  ): Promise<TradingSignal | null> {
    const riskAgent = this.agents.get('risk') as RiskAgent;
    const riskAssessment = await riskAgent.assess(symbol, combined.score);

    if (!riskAssessment.approved) return null;

    const direction = combined.score > 0 ? 'BUY' : 'SELL';
    const strength = Math.abs(combined.score) > 75 ? 'STRONG' : Math.abs(combined.score) > 50 ? 'MODERATE' : 'WEAK';

    return {
      id: Math.random().toString(36).slice(2),
      symbol,
      direction,
      strength,
      confidence: Math.round(combined.confidence),
      entry: riskAssessment.entry,
      stopLoss: riskAssessment.stopLoss,
      takeProfit: riskAssessment.takeProfits,
      timeframe: '1h',
      reason: agentScores.map((s) => s.reasoning).join('. '),
      agentScores,
      newsRefs: [],
      technicalIndicators: {},
      status: 'ACTIVE',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    };
  }
}
