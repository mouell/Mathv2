'use client';
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { setWsConnected, setAsset, addSignal, addNews, addNotification } = useStore();

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) return;

    function connect() {
      try {
        const ws = new WebSocket(wsUrl!);
        wsRef.current = ws;

        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            switch (msg.type) {
              case 'PRICE_UPDATE': setAsset(msg.data.symbol, msg.data); break;
              case 'NEW_SIGNAL': addSignal(msg.data); break;
              case 'NEWS_UPDATE': addNews(msg.data); break;
              case 'ALERT': addNotification(msg.data); break;
            }
          } catch {}
        };
      } catch {}
    }

    connect();
    return () => { wsRef.current?.close(); };
  }, []);
}
