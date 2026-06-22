import { Router } from 'express';
import axios from 'axios';
import { logger } from '../lib/logger';

export const marketRouter = Router();

marketRouter.get('/prices', async (req, res) => {
  try {
    const symbols = (req.query.symbols as string || 'BTCUSDT,ETHUSDT,SOLUSDT').split(',');
    const results = await Promise.allSettled(
      symbols.map((sym) =>
        axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`, { timeout: 5000 })
      )
    );

    const prices = results
      .filter((r) => r.status === 'fulfilled')
      .map((r: any) => ({
        symbol: r.value.data.symbol,
        price: parseFloat(r.value.data.lastPrice),
        changePercent24h: parseFloat(r.value.data.priceChangePercent),
        volume24h: parseFloat(r.value.data.volume),
        high24h: parseFloat(r.value.data.highPrice),
        low24h: parseFloat(r.value.data.lowPrice),
      }));

    res.json({ success: true, data: prices });
  } catch (err) {
    logger.error(`Market prices error: ${err}`);
    res.status(500).json({ error: 'Erreur récupération des prix' });
  }
});

marketRouter.get('/klines/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 100 } = req.query;

    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol, interval, limit },
      timeout: 8000,
    });

    const klines = response.data.map((k: number[]) => ({
      time: k[0] / 1000,
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
    }));

    res.json({ success: true, data: klines });
  } catch (err) {
    res.status(500).json({ error: 'Erreur récupération klines' });
  }
});

marketRouter.get('/fear-greed', async (req, res) => {
  try {
    const response = await axios.get('https://api.alternative.me/fng/?limit=30', { timeout: 5000 });
    res.json({ success: true, data: response.data.data });
  } catch {
    res.json({ success: true, data: [{ value: 65, value_classification: 'Greed' }] });
  }
});
