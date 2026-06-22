'use client';
import { useEffect, useRef } from 'react';
import { useStore } from './index';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMockData } from '@/hooks/useMockData';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  useWebSocket();
  useMockData();
  return <>{children}</>;
}
