import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Server as SocketServer } from 'socket.io';
import { logger } from './lib/logger';
import { marketRouter } from './routes/market';
import { newsRouter } from './routes/news';
import { signalsRouter } from './routes/signals';
import { tradesRouter } from './routes/trades';
import { agentsRouter } from './routes/agents';
import { AgentOrchestrator } from './agents/orchestrator';
import { PriceStreamer } from './services/priceStreamer';

const app = express();
const httpServer = createServer(app);

// ── Socket.IO ─────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
});

// ── Middleware ────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: { error: 'Trop de requêtes. Réessayez plus tard.' },
});
app.use('/api', limiter);

// ── Routes ────────────────────────────────────────────────
app.use('/api/market', marketRouter);
app.use('/api/news', newsRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/agents', agentsRouter);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Error handler ─────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ── Socket.IO events ──────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`Client connecté: ${socket.id}`);

  socket.on('subscribe', (symbols: string[]) => {
    symbols.forEach((sym) => socket.join(`market:${sym}`));
    logger.info(`${socket.id} subscribe: ${symbols.join(', ')}`);
  });

  socket.on('unsubscribe', (symbols: string[]) => {
    symbols.forEach((sym) => socket.leave(`market:${sym}`));
  });

  socket.on('disconnect', () => {
    logger.info(`Client déconnecté: ${socket.id}`);
  });
});

// ── Start services ────────────────────────────────────────
const PORT = parseInt(process.env.BACKEND_PORT || '3001');

httpServer.listen(PORT, () => {
  logger.info(`🚀 Backend démarré sur le port ${PORT}`);

  // Start price streamer
  const priceStreamer = new PriceStreamer(io);
  priceStreamer.start();

  // Start AI agents orchestrator
  const orchestrator = new AgentOrchestrator(io);
  orchestrator.start();
});

export { io };
