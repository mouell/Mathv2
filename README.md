# AI Trading Dashboard

Plateforme intelligente de day trading assistée par IA — optimisée iPad, PWA installable.

## Stack Technique

| Couche | Technologies |
|--------|-------------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS, Framer Motion |
| Charts | TradingView Widgets, Recharts, Lightweight Charts |
| State | Zustand, SWR |
| Backend | Node.js, Express, Socket.IO, WebSocket |
| Database | PostgreSQL 16, Prisma ORM |
| Cache | Redis 7 |
| IA | OpenAI API, Claude API (Anthropic) |
| Infra | Docker, Docker Compose |
| PWA | next-pwa, manifest.json, Service Worker |

## Architecture

```
Mathv2/
├── trading-dashboard/          # Next.js frontend (port 3000)
│   ├── src/
│   │   ├── app/                # Pages (App Router)
│   │   │   ├── page.tsx              # Dashboard principal
│   │   │   ├── news/page.tsx         # Actualités + analyse IA
│   │   │   ├── trades/page.tsx       # Journal des trades
│   │   │   ├── performance/page.tsx  # Métriques performance
│   │   │   ├── opportunities/page.tsx # Scanner d'opportunités
│   │   │   ├── risk/page.tsx         # Risk Manager
│   │   │   ├── learning/page.tsx     # Apprentissage IA
│   │   │   └── api/                  # API Routes Next.js
│   │   ├── components/
│   │   │   ├── layout/         # Sidebar, TopBar, TickerBar
│   │   │   ├── dashboard/      # Panels du dashboard
│   │   │   └── charts/         # TradingView, Recharts
│   │   ├── lib/
│   │   │   ├── store/          # Zustand store global
│   │   │   └── utils/          # Formatage, helpers
│   │   ├── hooks/              # useWebSocket, useMockData
│   │   └── types/              # TypeScript types complets
│   ├── prisma/schema.prisma    # Schéma base de données
│   └── public/manifest.json   # PWA manifest
│
├── backend/                    # Node.js backend (port 3001)
│   └── src/
│       ├── agents/             # Agents IA spécialisés
│       │   ├── orchestrator.ts # Coordinateur multi-agents
│       │   ├── newsAgent.ts    # Analyse actualités (Claude)
│       │   ├── technicalAgent.ts # Analyse technique (Binance)
│       │   ├── sentimentAgent.ts # Sentiment X/Reddit
│       │   ├── riskAgent.ts    # Calcul risque/position
│       │   └── learningAgent.ts # Apprentissage continu
│       ├── routes/             # API REST
│       ├── services/
│       │   └── priceStreamer.ts # WebSocket Binance live
│       └── lib/logger.ts
│
├── docker-compose.yml          # PostgreSQL + Redis + App
└── README.md
```

## Démarrage Rapide

### Prérequis
- Node.js 18+
- Docker & Docker Compose
- Clés API (optionnelles pour mode démo)

### 1. Installation complète avec Docker (recommandé)

```bash
# Cloner et configurer
git clone <repo>
cd Mathv2

# Copier les variables d'environnement
cp trading-dashboard/.env.example trading-dashboard/.env
cp trading-dashboard/.env.example backend/.env
# Éditer les fichiers .env avec vos clés API

# Démarrer tous les services
docker compose up -d

# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# DB:       localhost:5432
```

### 2. Développement local

```bash
# Terminal 1 — Base de données
docker compose up postgres redis -d

# Terminal 2 — Backend
cd backend
npm install
cp .env.example .env  # configurer DATABASE_URL et REDIS_URL
npm run dev           # http://localhost:3001

# Terminal 3 — Frontend
cd trading-dashboard
npm install
cp .env.example .env
npm run dev           # http://localhost:3000
```

### 3. Base de données

```bash
cd trading-dashboard
npx prisma migrate dev --name init
npx prisma generate
npx prisma studio    # Interface GUI sur localhost:5555
```

## Configuration API Keys

Éditer `trading-dashboard/.env` et `backend/.env` :

```env
# IA — Obligatoire pour analyse IA complète
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Données de marché — Gratuit avec limites
BINANCE_API_KEY=...          # https://binance.com/en/my/settings/api-management
ALPHAVANTAGE_API_KEY=...     # https://alphavantage.co (gratuit)
FINNHUB_API_KEY=...          # https://finnhub.io (gratuit)
COINMARKETCAP_API_KEY=...    # https://coinmarketcap.com/api

# News
NEWSAPI_KEY=...              # https://newsapi.org (gratuit jusqu'à 100req/j)

# Social
REDDIT_CLIENT_ID=...         # https://reddit.com/prefs/apps
REDDIT_CLIENT_SECRET=...
TWITTER_BEARER_TOKEN=...     # https://developer.twitter.com
```

> **Sans clés API** : le dashboard fonctionne en mode démo avec données simulées réalistes.

## Pages de l'Application

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/` | Vue principale multi-panneaux |
| Actualités | `/news` | Feed IA + analyse sentiment |
| Opportunités | `/opportunities` | Scanner breakouts/momentum |
| Trades | `/trades` | Journal paper trading |
| Performance | `/performance` | Métriques + courbes |
| Risk | `/risk` | Risk manager + drawdown |
| IA Learning | `/learning` | Courbe d'apprentissage |

## Agents IA

| Agent | Rôle | Source de données | Poids signal |
|-------|------|-------------------|--------------|
| News | Analyse actualités, détecte catalyseurs | RSS, NewsAPI, Claude | 25% |
| Crypto | Surveillance marchés crypto 24/7 | Binance, CoinGecko | 15% |
| Macro | Analyse macro-économique | Fed, BCE, indicateurs | 15% |
| Sentiment | X/Twitter, Reddit, Fear&Greed | APIs sociales | 20% |
| Technical | RSI, MACD, EMA, patterns | Binance klines | 30% |
| Risk | Position sizing, SL/TP calculés | Calcul ATR | Filtre |
| Learning | Apprentissage continu inter-agents | Historique trades | Meta |

## Installation PWA sur iPad

1. Ouvrir `http://[votre-ip]:3000` dans Safari
2. Appuyer sur **Partager** → **Sur l'écran d'accueil**
3. L'app s'installe en mode standalone paysage

## Déploiement Production

### Vercel (Frontend)
```bash
cd trading-dashboard
npm i -g vercel
vercel --prod
# Configurer les variables d'environnement dans le dashboard Vercel
```

### Railway (Backend + DB)
```bash
# Créer un projet Railway
railway init
railway add postgresql
railway add redis
cd backend && railway up
```

### Variables d'environnement Vercel
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
```

## Fonctionnalités

### ✅ Implémentées
- Dashboard multi-panneaux responsive iPad
- Ticker de prix temps réel (via WebSocket Binance)
- Graphiques TradingView intégrés
- Watchlist interactive avec prix live
- Système de signaux IA avec scores multi-agents
- Scanner d'opportunités (breakout, momentum, news catalyst, patterns)
- Journal des trades (paper trading)
- Page performance avec métriques complètes (win rate, sharpe, drawdown)
- Risk Manager avec radar de risque
- Page IA Learning avec courbe d'apprentissage
- Analyse des actualités avec sentiment IA
- Dark mode premium
- PWA installable iPad
- 7 agents IA spécialisés
- Backend WebSocket temps réel
- Docker Compose complet

### 🔧 Extensions V2 prévues
- Connexion TradingView Paper Trading account
- Backtesting engine sur données historiques
- Mode replay marché
- Authentification utilisateurs (NextAuth)
- Alertes push notifications natives iPad
- Intégration Reddit API live
- Intégration Twitter/X API live
- Analyse technique avancée (divergences, patterns complexes)
- Portefeuille multi-comptes

### 🚀 Extensions V3
- Live trading (connexion exchange réel)
- Stratégies automatisées
- Backtesting multi-stratégies
- Machine Learning custom (PyTorch)
- Analyse on-chain avancée
- Copy trading
- Alertes SMS/Email

## Structure Données

Le schéma Prisma couvre :
- `Asset` / `OHLCV` — Données de marché
- `NewsItem` — Actualités avec analyse IA
- `Signal` — Signaux de trading avec scores agents
- `Trade` — Journal des trades
- `AgentPerformance` / `AgentParameters` — Métriques et paramètres agents
- `Opportunity` — Opportunités détectées
- `Alert` — Système d'alertes
- `User` / `UserSettings` — Gestion utilisateurs

## Sécurité

- Variables sensibles dans `.env` (jamais committé)
- Rate limiting sur toutes les routes API
- Headers de sécurité via Helmet
- CORS configuré
- Validation des entrées avec Zod
- Logs d'erreurs via Winston

## Licence

MIT — Usage personnel et éducatif. Les décisions de trading restent sous votre responsabilité.
