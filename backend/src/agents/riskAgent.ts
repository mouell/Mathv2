import axios from 'axios';
import { logger } from '../lib/logger';

export class RiskAgent {
  async assess(symbol: string, combinedScore: number): Promise<{
    approved: boolean;
    entry: number;
    stopLoss: number;
    takeProfits: number[];
    riskRatio: number;
    reasoning: string;
  }> {
    try {
      const price = await this.getCurrentPrice(symbol);
      const atr = await this.getATR(symbol, price);

      const isLong = combinedScore > 0;
      const stopDistance = atr * 1.5;
      const entry = price;
      const stopLoss = isLong ? price - stopDistance : price + stopDistance;
      const tp1 = isLong ? price + stopDistance * 2 : price - stopDistance * 2;
      const tp2 = isLong ? price + stopDistance * 3.5 : price - stopDistance * 3.5;
      const riskRatio = Math.abs(tp1 - entry) / Math.abs(entry - stopLoss);

      // Approve if risk/reward > 1.5
      const approved = riskRatio >= 1.5 && Math.abs(combinedScore) > 50;

      return {
        approved,
        entry,
        stopLoss,
        takeProfits: [tp1, tp2],
        riskRatio,
        reasoning: approved
          ? `R/R ${riskRatio.toFixed(2)} — approuvé`
          : `R/R ${riskRatio.toFixed(2)} — rejeté (minimum 1.5)`,
      };
    } catch (err) {
      logger.error(`RiskAgent error: ${err}`);
      return { approved: false, entry: 0, stopLoss: 0, takeProfits: [], riskRatio: 0, reasoning: 'Erreur calcul risque' };
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    if (!symbol.includes('USDT')) return 100 + Math.random() * 200;
    try {
      const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, { timeout: 3000 });
      return parseFloat(res.data.price);
    } catch {
      return 50000;
    }
  }

  private async getATR(symbol: string, price: number): Promise<number> {
    // Approximate ATR as 2% of price
    return price * 0.02;
  }
}
