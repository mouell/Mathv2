import WebSocket from 'ws';
import { Server as SocketServer } from 'socket.io';
import { logger } from '../lib/logger';

const SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt'];

export class PriceStreamer {
  private io: SocketServer;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(io: SocketServer) {
    this.io = io;
  }

  start() {
    this.connect();
  }

  private connect() {
    const streams = SYMBOLS.map((s) => `${s}@miniTicker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    logger.info(`📡 Connexion Binance WebSocket...`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => logger.info('✅ Binance WebSocket connecté'));

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (!msg.data) return;

        const { s: symbol, c: price, P: changePercent, v: volume, h: high, l: low } = msg.data;

        const update = {
          symbol,
          price: parseFloat(price),
          changePercent24h: parseFloat(changePercent),
          volume24h: parseFloat(volume),
          high24h: parseFloat(high),
          low24h: parseFloat(low),
          lastUpdated: new Date(),
        };

        this.io.to(`market:${symbol}`).emit('PRICE_UPDATE', { type: 'PRICE_UPDATE', data: update, timestamp: new Date() });
        this.io.emit('PRICE_UPDATE', { type: 'PRICE_UPDATE', data: update, timestamp: new Date() });
      } catch {}
    });

    this.ws.on('close', () => {
      logger.warn('Binance WebSocket déconnecté — reconnexion dans 5s');
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      logger.error(`Binance WS error: ${err.message}`);
      this.ws?.close();
    });
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
