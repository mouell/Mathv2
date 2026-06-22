import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { logger } from '../lib/logger';
import type { AgentScore } from '../types';

export class NewsAgent {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  async analyze(symbol: string): Promise<AgentScore | null> {
    try {
      const news = await this.fetchNews(symbol);
      if (!news.length) return null;

      let score = 0;
      let reasoning = '';
      let confidence = 70;

      if (this.client) {
        const result = await this.analyzeWithClaude(symbol, news);
        score = result.score;
        reasoning = result.reasoning;
        confidence = result.confidence;
      } else {
        // Fallback: simple keyword scoring
        const bullishWords = ['surge', 'rally', 'breakout', 'bullish', 'gains', 'record', 'positive'];
        const bearishWords = ['crash', 'drop', 'bearish', 'decline', 'loss', 'negative', 'warning'];
        const text = news.join(' ').toLowerCase();
        const bullCount = bullishWords.filter((w) => text.includes(w)).length;
        const bearCount = bearishWords.filter((w) => text.includes(w)).length;
        score = ((bullCount - bearCount) / Math.max(1, bullCount + bearCount)) * 60;
        reasoning = `${bullCount} signaux haussiers, ${bearCount} signaux baissiers détectés`;
      }

      return {
        agentId: 'agent-news',
        agentName: 'NEWS',
        score: Math.max(-100, Math.min(100, score)),
        confidence,
        reasoning,
        weight: 0.25,
      };
    } catch (err) {
      logger.error(`NewsAgent error for ${symbol}: ${err}`);
      return null;
    }
  }

  private async fetchNews(symbol: string): Promise<string[]> {
    const base = symbol.replace('USDT', '').replace('USD', '');
    const headlines: string[] = [];

    if (process.env.NEWSAPI_KEY) {
      try {
        const res = await axios.get('https://newsapi.org/v2/everything', {
          params: { q: base, language: 'en', sortBy: 'publishedAt', pageSize: 5, apiKey: process.env.NEWSAPI_KEY },
          timeout: 5000,
        });
        res.data.articles?.forEach((a: any) => headlines.push(a.title));
      } catch {}
    }

    return headlines;
  }

  private async analyzeWithClaude(symbol: string, headlines: string[]): Promise<{ score: number; reasoning: string; confidence: number }> {
    const message = await this.client!.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Analyse ces titres d'actualité pour ${symbol} et donne:
1. Un score de -100 (très baissier) à +100 (très haussier)
2. Un niveau de confiance 0-100
3. Une explication courte

Titres: ${headlines.slice(0, 5).join('\n')}

Réponds en JSON: {"score": number, "confidence": number, "reasoning": "string"}`,
      }],
    });

    const text = (message.content[0] as any).text;
    const json = JSON.parse(text.match(/\{.*\}/s)?.[0] || '{}');
    return { score: json.score || 0, confidence: json.confidence || 70, reasoning: json.reasoning || '' };
  }
}
