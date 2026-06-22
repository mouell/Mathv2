import axios from 'axios';
import { logger } from '../lib/logger';
import type { AgentScore } from '../types';

export class TechnicalAgent {
  async analyze(symbol: string): Promise<AgentScore | null> {
    try {
      const klines = await this.fetchKlines(symbol);
      if (!klines.length) return this.mockScore(symbol);

      const closes = klines.map((k: number[]) => k[4]);
      const volumes = klines.map((k: number[]) => k[5]);

      const rsi = this.calculateRSI(closes);
      const macd = this.calculateMACD(closes);
      const ema20 = this.calculateEMA(closes, 20);
      const ema50 = this.calculateEMA(closes, 50);
      const currentPrice = closes[closes.length - 1];
      const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      const currentVolume = volumes[volumes.length - 1];

      let score = 0;
      const reasons: string[] = [];

      // RSI analysis
      if (rsi < 30) { score += 35; reasons.push(`RSI survendu (${rsi.toFixed(0)})`); }
      else if (rsi > 70) { score -= 35; reasons.push(`RSI suracheté (${rsi.toFixed(0)})`); }
      else if (rsi > 50) { score += 15; reasons.push(`RSI positif (${rsi.toFixed(0)})`); }
      else { score -= 15; reasons.push(`RSI négatif (${rsi.toFixed(0)})`); }

      // MACD
      if (macd.histogram > 0 && macd.histogram > macd.prevHistogram) { score += 25; reasons.push('MACD croisement haussier'); }
      else if (macd.histogram < 0 && macd.histogram < macd.prevHistogram) { score -= 25; reasons.push('MACD croisement baissier'); }

      // EMA trend
      if (currentPrice > ema20 && ema20 > ema50) { score += 20; reasons.push('Tendance haussière EMA'); }
      else if (currentPrice < ema20 && ema20 < ema50) { score -= 20; reasons.push('Tendance baissière EMA'); }

      // Volume
      if (currentVolume > avgVolume * 1.5) { score = score * 1.2; reasons.push('Volume élevé confirme le signal'); }

      return {
        agentId: 'agent-technical',
        agentName: 'TECHNICAL',
        score: Math.max(-100, Math.min(100, score)),
        confidence: 80,
        reasoning: reasons.join(', '),
        weight: 0.30,
      };
    } catch (err) {
      logger.error(`TechnicalAgent error for ${symbol}: ${err}`);
      return this.mockScore(symbol);
    }
  }

  private async fetchKlines(symbol: string): Promise<number[][]> {
    if (!symbol.includes('USDT')) return [];
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol, interval: '1h', limit: 100 },
      timeout: 5000,
    });
    return res.data;
  }

  private calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = gains / Math.max(losses, 0.001);
    return 100 - (100 / (1 + rs));
  }

  private calculateEMA(closes: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
    return ema;
  }

  private calculateMACD(closes: number[]): { value: number; signal: number; histogram: number; prevHistogram: number } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;
    const ema12prev = this.calculateEMA(closes.slice(0, -1), 12);
    const ema26prev = this.calculateEMA(closes.slice(0, -1), 26);
    const prevMacdLine = ema12prev - ema26prev;
    const histogram = macdLine - prevMacdLine;
    return { value: macdLine, signal: prevMacdLine, histogram, prevHistogram: 0 };
  }

  private mockScore(symbol: string): AgentScore {
    const score = (Math.random() - 0.4) * 80;
    return {
      agentId: 'agent-technical',
      agentName: 'TECHNICAL',
      score,
      confidence: 65,
      reasoning: 'Analyse technique simulée (données indisponibles)',
      weight: 0.30,
    };
  }
}
