import { Router } from 'express';
export const signalsRouter = Router();

// In-memory store for demo (use DB in production)
const signals: any[] = [];

signalsRouter.get('/', (req, res) => {
  const { status, symbol, limit = '20' } = req.query;
  let filtered = [...signals];
  if (status) filtered = filtered.filter((s) => s.status === status);
  if (symbol) filtered = filtered.filter((s) => s.symbol === symbol);
  res.json({ success: true, data: filtered.slice(0, parseInt(limit as string)) });
});

signalsRouter.post('/', (req, res) => {
  const signal = { ...req.body, id: Math.random().toString(36).slice(2), createdAt: new Date() };
  signals.unshift(signal);
  res.status(201).json({ success: true, data: signal });
});

signalsRouter.patch('/:id', (req, res) => {
  const idx = signals.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Signal non trouvé' });
  signals[idx] = { ...signals[idx], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: signals[idx] });
});
