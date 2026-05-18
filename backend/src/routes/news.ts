import { Router } from 'express';
import axios from 'axios';
import Parser from 'rss-parser';
import { logger } from '../lib/logger';

export const newsRouter = Router();
const rssParser = new Parser({ timeout: 8000 });

const RSS_FEEDS = [
  { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph', category: 'crypto' },
  { url: 'https://coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', category: 'crypto' },
  { url: 'https://www.investing.com/rss/news.rss', source: 'Investing.com', category: 'finance' },
];

newsRouter.get('/', async (req, res) => {
  const allNews: any[] = [];

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const parsed = await rssParser.parseURL(feed.url);
      return parsed.items.slice(0, 5).map((item) => ({
        id: Math.random().toString(36).slice(2),
        title: item.title || '',
        summary: item.contentSnippet || item.content || '',
        source: feed.source,
        url: item.link || '',
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        sentiment: 'NEUTRAL',
        sentimentScore: 0,
        impactScore: Math.round(Math.random() * 60 + 20),
        relatedAssets: [],
        categories: [feed.category],
        isBreaking: false,
      }));
    })
  );

  results.forEach((r) => {
    if (r.status === 'fulfilled') allNews.push(...r.value);
  });

  allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  res.json({ success: true, data: allNews.slice(0, 50), total: allNews.length });
});

newsRouter.get('/analyze/:id', async (req, res) => {
  res.json({ success: true, data: { message: 'Analyse IA disponible avec clé API' } });
});
