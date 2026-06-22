import { Router } from 'express';
export const agentsRouter = Router();

const AGENTS = [
  { id: 'agent-news', type: 'NEWS', name: 'Agent News', status: 'ACTIVE', accuracy: 78, totalSignals: 234, correctSignals: 182, description: 'Analyse les actualités et détecte les catalyseurs', icon: '📰', color: '#7c5cfc' },
  { id: 'agent-crypto', type: 'CRYPTO', name: 'Agent Crypto', status: 'ACTIVE', accuracy: 81, totalSignals: 412, correctSignals: 334, description: 'Surveille les marchés crypto 24/7', icon: '₿', color: '#f5a623' },
  { id: 'agent-macro', type: 'MACRO', name: 'Agent Macro', status: 'ACTIVE', accuracy: 74, totalSignals: 89, correctSignals: 66, description: 'Analyse macro-économique globale', icon: '🌍', color: '#00d4b1' },
  { id: 'agent-sentiment', type: 'SENTIMENT', name: 'Agent Sentiment', status: 'ACTIVE', accuracy: 69, totalSignals: 567, correctSignals: 391, description: 'Analyse X/Twitter et Reddit', icon: '💬', color: '#38bdf8' },
  { id: 'agent-technical', type: 'TECHNICAL', name: 'Agent Technical', status: 'ACTIVE', accuracy: 83, totalSignals: 891, correctSignals: 740, description: 'Patterns et indicateurs techniques', icon: '📈', color: '#84cc16' },
  { id: 'agent-risk', type: 'RISK', name: 'Agent Risk', status: 'ACTIVE', accuracy: 88, totalSignals: 456, correctSignals: 401, description: 'Gestion du risque et position sizing', icon: '🛡️', color: '#ff4d6d' },
  { id: 'agent-learning', type: 'LEARNING', name: 'Agent Learning', status: 'LEARNING', accuracy: 76, totalSignals: 1203, correctSignals: 914, description: 'Amélioration continue des modèles', icon: '🧠', color: '#a78bfa' },
];

agentsRouter.get('/', (req, res) => {
  res.json({ success: true, data: AGENTS.map((a) => ({ ...a, lastRun: new Date() })) });
});

agentsRouter.get('/:id/performance', (req, res) => {
  const agent = AGENTS.find((a) => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });
  res.json({
    success: true,
    data: {
      ...agent,
      history: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
        accuracy: agent.accuracy + (Math.random() - 0.5) * 10,
      })),
    },
  });
});
