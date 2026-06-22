export function formatNumber(n: number, decimals?: number): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return n.toLocaleString('fr-FR', { maximumFractionDigits: decimals ?? 2 });
  return n.toFixed(decimals ?? 2);
}

export function formatPercent(n: number): string {
  if (n === undefined || n === null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatCurrency(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
}

export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins}m`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function colorForChange(v: number): string {
  return v >= 0 ? '#00d4b1' : '#ff4d6d';
}

export function colorForScore(score: number): string {
  if (score >= 70) return '#00d4b1';
  if (score >= 40) return '#f5a623';
  return '#ff4d6d';
}

export function shortSymbol(sym: string): string {
  return sym.replace('USDT', '').replace('USD', '').replace('BTC', 'BTC');
}
