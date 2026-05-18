'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import type { Asset, TradingSignal, NewsItem, AgentStatus, Opportunity, MarketStatus } from '@/types';

// Generates realistic mock data so the dashboard works without real API keys

const SYMBOLS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', type: 'crypto' as const, price: 67420, change: 2.34 },
  { symbol: 'ETHUSDT', name: 'Ethereum', type: 'crypto' as const, price: 3512, change: 1.87 },
  { symbol: 'SOLUSDT', name: 'Solana', type: 'crypto' as const, price: 185.4, change: 4.21 },
  { symbol: 'BNBUSDT', name: 'BNB', type: 'crypto' as const, price: 612.3, change: -0.8 },
  { symbol: 'XRPUSDT', name: 'XRP', type: 'crypto' as const, price: 0.5823, change: 3.15 },
  { symbol: 'ADAUSDT', name: 'Cardano', type: 'crypto' as const, price: 0.4521, change: -1.2 },
  { symbol: 'AAPL', name: 'Apple', type: 'stock' as const, price: 213.5, change: 0.87 },
  { symbol: 'NVDA', name: 'NVIDIA', type: 'stock' as const, price: 125.8, change: 3.42 },
  { symbol: 'SPY', name: 'S&P 500 ETF', type: 'stock' as const, price: 551.2, change: 0.54 },
  { symbol: 'EURUSD', name: 'EUR/USD', type: 'forex' as const, price: 1.0821, change: 0.12 },
];

const NEWS_ITEMS = [
  { title: 'Bitcoin dépasse les 67 000$ après des données d\'inflation positives', sentiment: 'BULLISH' as const, impact: 85, assets: ['BTCUSDT', 'ETHUSDT'], source: 'CoinDesk' },
  { title: 'La Fed maintient ses taux, signal positif pour les actifs risqués', sentiment: 'BULLISH' as const, impact: 78, assets: ['SPY', 'AAPL', 'NVDA'], source: 'Bloomberg' },
  { title: 'NVIDIA dépasse les attentes de bénéfices — IA en plein essor', sentiment: 'BULLISH' as const, impact: 92, assets: ['NVDA', 'SPY'], source: 'MarketWatch' },
  { title: 'Solana enregistre un volume record sur les DEX', sentiment: 'BULLISH' as const, impact: 71, assets: ['SOLUSDT'], source: 'CoinGecko' },
  { title: 'Les régulateurs crypto renforcent la surveillance des échanges', sentiment: 'BEARISH' as const, impact: 55, assets: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'], source: 'Reuters' },
  { title: 'Le marché immobilier US montre des signes de faiblesse', sentiment: 'BEARISH' as const, impact: 48, assets: ['SPY'], source: 'WSJ' },
  { title: 'Ethereum prépare sa prochaine mise à jour majeure du protocole', sentiment: 'BULLISH' as const, impact: 67, assets: ['ETHUSDT'], source: 'Decrypt' },
  { title: 'Apple lance une nouvelle génération de puces pour les données IA', sentiment: 'BULLISH' as const, impact: 74, assets: ['AAPL', 'NVDA'], source: 'TechCrunch' },
];

function randomFloat(min: number, max: number) { return Math.random() * (max - min) + min; }
function randomInt(min: number, max: number) { return Math.floor(randomFloat(min, max)); }
function randomId() { return Math.random().toString(36).slice(2, 11); }

export function useMockData() {
  const { setAsset, addSignal, setNews, setAgents, setOpportunities, setMarketStatus } = useStore();

  useEffect(() => {
    // ── Initialize assets ────────────────────────
    SYMBOLS.forEach((s) => {
      setAsset(s.symbol, {
        symbol: s.symbol,
        name: s.name,
        type: s.type,
        price: s.price,
        change24h: s.price * s.change / 100,
        changePercent24h: s.change,
        volume24h: randomFloat(1e8, 1e10),
        marketCap: s.type === 'crypto' ? randomFloat(1e10, 1e12) : undefined,
        high24h: s.price * 1.03,
        low24h: s.price * 0.97,
        lastUpdated: new Date(),
      });
    });

    // ── Market status ────────────────────────────
    setMarketStatus({
      crypto: 'OPEN',
      nyse: 'OPEN',
      nasdaq: 'OPEN',
      forex: 'OPEN',
      fearGreedIndex: 68,
      marketSentiment: 'BULLISH',
      dominance: { btc: 54.2, eth: 18.1, others: 27.7 },
      totalMarketCap: 2.45e12,
      volume24h: 1.2e11,
    });

    // ── Initial news ─────────────────────────────
    const news: NewsItem[] = NEWS_ITEMS.map((n, i) => ({
      id: randomId(),
      title: n.title,
      summary: `Analyse IA: ${n.title}. Impact estimé ${n.impact}% sur les actifs concernés.`,
      source: n.source,
      url: '#',
      publishedAt: new Date(Date.now() - i * 18 * 60 * 1000),
      sentiment: n.sentiment,
      sentimentScore: n.sentiment === 'BULLISH' ? randomFloat(0.4, 0.9) : randomFloat(-0.8, -0.3),
      impactScore: n.impact,
      relatedAssets: n.assets,
      categories: ['macro', 'crypto'],
      isBreaking: i === 0,
      aiAnalysis: {
        summary: n.title,
        sentiment: n.sentiment,
        confidence: randomInt(65, 95),
        keyPoints: ['Signal technique confirmé', 'Volume en hausse', 'Sentiment positif'],
        affectedAssets: n.assets.map((sym) => ({ symbol: sym, impact: n.sentiment === 'BULLISH' ? 'POSITIVE' : 'NEGATIVE', magnitude: n.impact })),
        tradingImplication: n.sentiment === 'BULLISH' ? 'Opportunité d\'achat potentielle' : 'Prudence recommandée',
        timeHorizon: 'SHORT',
      },
    }));
    setNews(news);

    // ── Agents ────────────────────────────────────
    const agents: AgentStatus[] = [
      { id: 'agent-news', type: 'NEWS', name: 'Agent News', status: 'ACTIVE', lastRun: new Date(), accuracy: 78, totalSignals: 234, correctSignals: 182, currentScore: 72, description: 'Analyse les actualités et détecte les catalyseurs', icon: '📰', color: '#7c5cfc' },
      { id: 'agent-crypto', type: 'CRYPTO', name: 'Agent Crypto', status: 'ACTIVE', lastRun: new Date(), accuracy: 81, totalSignals: 412, correctSignals: 334, currentScore: 85, description: 'Surveille les marchés crypto 24/7', icon: '₿', color: '#f5a623' },
      { id: 'agent-macro', type: 'MACRO', name: 'Agent Macro', status: 'ACTIVE', lastRun: new Date(), accuracy: 74, totalSignals: 89, correctSignals: 66, currentScore: 61, description: 'Analyse macro-économique globale', icon: '🌍', color: '#00d4b1' },
      { id: 'agent-sentiment', type: 'SENTIMENT', name: 'Agent Sentiment', status: 'ACTIVE', lastRun: new Date(), accuracy: 69, totalSignals: 567, correctSignals: 391, currentScore: 78, description: 'Analyse X/Twitter et Reddit', icon: '💬', color: '#38bdf8' },
      { id: 'agent-technical', type: 'TECHNICAL', name: 'Agent Technical', status: 'ACTIVE', lastRun: new Date(), accuracy: 83, totalSignals: 891, correctSignals: 740, currentScore: 91, description: 'Patterns et indicateurs techniques', icon: '📈', color: '#84cc16' },
      { id: 'agent-risk', type: 'RISK', name: 'Agent Risk', status: 'ACTIVE', lastRun: new Date(), accuracy: 88, totalSignals: 456, correctSignals: 401, currentScore: 94, description: 'Gestion du risque et position sizing', icon: '🛡️', color: '#ff4d6d' },
      { id: 'agent-learning', type: 'LEARNING', name: 'Agent Learning', status: 'LEARNING', lastRun: new Date(), accuracy: 76, totalSignals: 1203, correctSignals: 914, currentScore: 82, description: 'Amélioration continue des modèles', icon: '🧠', color: '#a78bfa' },
    ];
    setAgents(agents);

    // ── Signals ──────────────────────────────────
    const signals: TradingSignal[] = [
      {
        id: randomId(), symbol: 'BTCUSDT', direction: 'BUY', strength: 'STRONG', confidence: 87,
        entry: 67420, stopLoss: 65800, takeProfit: [69000, 71000, 74000],
        timeframe: '4h', reason: 'Breakout confirmé au-dessus de la résistance clé, volume en hausse de 34%, sentiment FOMO détecté sur X/Twitter',
        agentScores: [
          { agentId: 'agent-technical', agentName: 'TECHNICAL', score: 82, confidence: 90, reasoning: 'RSI 58, MACD croisement haussier', weight: 0.3 },
          { agentId: 'agent-news', agentName: 'NEWS', score: 78, confidence: 85, reasoning: 'News Fed positives', weight: 0.25 },
          { agentId: 'agent-sentiment', agentName: 'SENTIMENT', score: 91, confidence: 88, reasoning: 'Sentiment X très haussier', weight: 0.2 },
          { agentId: 'agent-crypto', agentName: 'CRYPTO', score: 85, confidence: 87, reasoning: 'Volume on-chain élevé', weight: 0.15 },
          { agentId: 'agent-risk', agentName: 'RISK', score: 72, confidence: 93, reasoning: 'R/R 1:2.8 — acceptable', weight: 0.1 },
        ],
        newsRefs: [], technicalIndicators: { rsi: 58, ema20: 66800, ema50: 63200, volume: 4.2e9 },
        createdAt: new Date(Date.now() - 25 * 60 * 1000), expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
      {
        id: randomId(), symbol: 'NVDA', direction: 'BUY', strength: 'STRONG', confidence: 92,
        entry: 125.8, stopLoss: 121.5, takeProfit: [131, 138, 145],
        timeframe: '1d', reason: 'Résultats Q2 au-dessus des attentes, momentum IA très fort, accumulation institutionnelle détectée',
        agentScores: [
          { agentId: 'agent-news', agentName: 'NEWS', score: 95, confidence: 96, reasoning: 'Résultats exceptionnels', weight: 0.35 },
          { agentId: 'agent-technical', agentName: 'TECHNICAL', score: 88, confidence: 91, reasoning: 'Gap up avec fort volume', weight: 0.3 },
          { agentId: 'agent-macro', agentName: 'MACRO', score: 81, confidence: 84, reasoning: 'Secteur IA en forte croissance', weight: 0.2 },
          { agentId: 'agent-risk', agentName: 'RISK', score: 78, confidence: 92, reasoning: 'R/R 1:3.2 — excellent', weight: 0.15 },
        ],
        newsRefs: [], technicalIndicators: { rsi: 71, ema20: 123.4, ema50: 118.9 },
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
      {
        id: randomId(), symbol: 'ETHUSDT', direction: 'WATCH', strength: 'MODERATE', confidence: 64,
        entry: 3512, stopLoss: 3380, takeProfit: [3700, 3900],
        timeframe: '1h', reason: 'Consolidation au support, attendre confirmation du breakout',
        agentScores: [
          { agentId: 'agent-technical', agentName: 'TECHNICAL', score: 45, confidence: 70, reasoning: 'Range compression', weight: 0.4 },
          { agentId: 'agent-crypto', agentName: 'CRYPTO', score: 62, confidence: 67, reasoning: 'Défis on-chain modérés', weight: 0.35 },
          { agentId: 'agent-risk', agentName: 'RISK', score: 55, confidence: 80, reasoning: 'Attendre confirmation', weight: 0.25 },
        ],
        newsRefs: [], technicalIndicators: { rsi: 48, ema20: 3498, ema50: 3445 },
        createdAt: new Date(Date.now() - 45 * 60 * 1000), expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    ];
    signals.forEach(addSignal);

    // ── Opportunities ────────────────────────────
    const opportunities: Opportunity[] = [
      { id: randomId(), symbol: 'BTCUSDT', type: 'BREAKOUT', direction: 'BUY', confidence: 87, potentialGain: 5.4, risk: 2.1, description: 'Breakout résistance 67k avec volume élevé', signals: [], detectedAt: new Date(), expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), status: 'ACTIVE' },
      { id: randomId(), symbol: 'NVDA', type: 'NEWS_CATALYST', direction: 'BUY', confidence: 92, potentialGain: 8.1, risk: 2.8, description: 'Résultats Q2 record + guidance relevée', signals: [], detectedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), status: 'ACTIVE' },
      { id: randomId(), symbol: 'SOLUSDT', type: 'MOMENTUM', direction: 'BUY', confidence: 71, potentialGain: 6.3, risk: 3.2, description: 'Momentum DEX + volume NFT en hausse', signals: [], detectedAt: new Date(), expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), status: 'ACTIVE' },
      { id: randomId(), symbol: 'XRPUSDT', type: 'PATTERN', direction: 'BUY', confidence: 68, potentialGain: 4.8, risk: 2.4, description: 'Flag haussier sur graphique journalier', signals: [], detectedAt: new Date(), expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), status: 'ACTIVE' },
    ];
    setOpportunities(opportunities);

    // ── Live price updates ───────────────────────
    const interval = setInterval(() => {
      SYMBOLS.forEach((s) => {
        const drift = (Math.random() - 0.48) * 0.002;
        const currentAsset = useStore.getState().assets[s.symbol];
        if (!currentAsset) return;
        const newPrice = currentAsset.price * (1 + drift);
        const change = ((newPrice - s.price) / s.price) * 100;
        setAsset(s.symbol, {
          ...currentAsset,
          price: newPrice,
          change24h: newPrice - s.price,
          changePercent24h: change,
          lastUpdated: new Date(),
        });
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);
}
