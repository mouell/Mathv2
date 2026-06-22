import { logger } from '../lib/logger';
import type { AgentScore } from '../types';

export class SentimentAgent {
  async analyze(symbol: string): Promise<AgentScore | null> {
    try {
      // In production: connect to Twitter API, Reddit API
      // Here we simulate sentiment based on fear/greed-like scoring
      const fearGreed = await this.getFearGreedIndex();
      const redditSentiment = await this.getRedditSentiment(symbol);

      let score = 0;
      const reasons: string[] = [];

      // Fear & Greed
      if (fearGreed > 75) { score -= 20; reasons.push(`Fear&Greed extrême (${fearGreed})`); }
      else if (fearGreed > 55) { score += 20; reasons.push(`Sentiment positif (${fearGreed})`); }
      else if (fearGreed < 25) { score += 30; reasons.push(`Peur extrême = opportunité`); }
      else { reasons.push(`Sentiment neutre (${fearGreed})`); }

      // Reddit
      score += redditSentiment.score;
      if (redditSentiment.score !== 0) reasons.push(redditSentiment.reason);

      return {
        agentId: 'agent-sentiment',
        agentName: 'SENTIMENT',
        score: Math.max(-100, Math.min(100, score)),
        confidence: 70,
        reasoning: reasons.join(', '),
        weight: 0.20,
      };
    } catch (err) {
      logger.error(`SentimentAgent error: ${err}`);
      return null;
    }
  }

  private async getFearGreedIndex(): Promise<number> {
    try {
      const { default: axios } = await import('axios');
      const res = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 5000 });
      return parseInt(res.data.data[0].value);
    } catch {
      return 55 + Math.random() * 20;
    }
  }

  private async getRedditSentiment(symbol: string): Promise<{ score: number; reason: string }> {
    // Simulate Reddit sentiment (would use Reddit API in production)
    const mockScore = (Math.random() - 0.45) * 40;
    return {
      score: mockScore,
      reason: mockScore > 10 ? 'Reddit haussier' : mockScore < -10 ? 'Reddit baissier' : 'Reddit neutre',
    };
  }
}
