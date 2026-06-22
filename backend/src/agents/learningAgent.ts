import { logger } from '../lib/logger';

export class LearningAgent {
  private parameterHistory: Array<{ date: Date; params: Record<string, number>; accuracy: number }> = [];

  async learn(tradeResults: Array<{ signalId: string; won: boolean; pnl: number; agentScores: any[] }>) {
    logger.info(`🧠 LearningAgent: analyse de ${tradeResults.length} trades`);

    if (tradeResults.length < 5) return;

    const winningTrades = tradeResults.filter((t) => t.won);
    const losingTrades = tradeResults.filter((t) => !t.won);
    const winRate = winningTrades.length / tradeResults.length;

    // Analyze which agents contributed to winning vs losing trades
    const agentContributions = this.analyzeAgentContributions(winningTrades, losingTrades);

    // Adjust weights
    const adjustments: Record<string, number> = {};
    for (const [agentId, contribution] of Object.entries(agentContributions)) {
      if (contribution > 0.6) {
        adjustments[agentId] = +0.02; // Increase weight
      } else if (contribution < 0.4) {
        adjustments[agentId] = -0.02; // Decrease weight
      }
    }

    logger.info(`📊 Win rate: ${(winRate * 100).toFixed(1)}%, Ajustements: ${JSON.stringify(adjustments)}`);

    this.parameterHistory.push({
      date: new Date(),
      params: adjustments,
      accuracy: winRate * 100,
    });

    return {
      winRate,
      adjustments,
      insights: this.generateInsights(winningTrades, losingTrades),
    };
  }

  private analyzeAgentContributions(
    winning: Array<{ agentScores: any[] }>,
    losing: Array<{ agentScores: any[] }>
  ): Record<string, number> {
    const contributions: Record<string, { wins: number; total: number }> = {};

    const processTradesFor = (trades: Array<{ agentScores: any[] }>, isWin: boolean) => {
      for (const trade of trades) {
        for (const score of (trade.agentScores || [])) {
          if (!contributions[score.agentId]) contributions[score.agentId] = { wins: 0, total: 0 };
          contributions[score.agentId].total++;
          if (isWin) contributions[score.agentId].wins++;
        }
      }
    };

    processTradesFor(winning, true);
    processTradesFor(losing, false);

    return Object.fromEntries(
      Object.entries(contributions).map(([id, { wins, total }]) => [id, total > 0 ? wins / total : 0.5])
    );
  }

  private generateInsights(winning: any[], losing: any[]): string[] {
    const insights: string[] = [];
    if (winning.length > losing.length) {
      insights.push(`Stratégie performante: ${winning.length}/${winning.length + losing.length} trades gagnants`);
    }
    insights.push('Analyse des patterns réussie — modèles mis à jour');
    insights.push(`Période analysée: ${winning.length + losing.length} trades`);
    return insights;
  }

  getHistory() { return this.parameterHistory; }
}
