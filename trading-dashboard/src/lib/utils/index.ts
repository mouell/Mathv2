import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function generateId() { return Math.random().toString(36).slice(2, 11); }

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    return { ...acc, [k]: [...(acc[k] || []), item] };
  }, {} as Record<string, T[]>);
}
