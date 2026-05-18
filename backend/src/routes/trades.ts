import { Router } from 'express';
export const tradesRouter = Router();

const trades: any[] = [];

tradesRouter.get('/', (req, res) => {
  const { status, isPaper } = req.query;
  let filtered = [...trades];
  if (status) filtered = filtered.filter((t) => t.status === status);
  if (isPaper !== undefined) filtered = filtered.filter((t) => t.isPaper === (isPaper === 'true'));
  res.json({ success: true, data: filtered });
});

tradesRouter.post('/', (req, res) => {
  const trade = { ...req.body, id: Math.random().toString(36).slice(2), openedAt: new Date(), status: 'OPEN', isPaper: true };
  trades.unshift(trade);
  res.status(201).json({ success: true, data: trade });
});

tradesRouter.patch('/:id/close', (req, res) => {
  const idx = trades.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Trade non trouvé' });
  const { exitPrice } = req.body;
  const trade = trades[idx];
  const pnl = (exitPrice - trade.entryPrice) * trade.quantity * (trade.type === 'LONG' ? 1 : -1);
  trades[idx] = { ...trade, status: 'CLOSED', exitPrice, closedAt: new Date(), pnl, pnlPercent: (pnl / (trade.entryPrice * trade.quantity)) * 100 };
  res.json({ success: true, data: trades[idx] });
});

tradesRouter.get('/performance', (req, res) => {
  const closed = trades.filter((t) => t.status === 'CLOSED');
  const wins = closed.filter((t) => t.pnl > 0);
  const totalPnL = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
  res.json({
    success: true,
    data: {
      totalTrades: closed.length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      totalPnL,
      openTrades: trades.filter((t) => t.status === 'OPEN').length,
    },
  });
});
