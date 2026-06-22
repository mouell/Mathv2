import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { TickerBar } from '@/components/layout/TickerBar';
import { NotificationCenter } from '@/components/layout/NotificationCenter';
import { StoreProvider } from '@/lib/store/StoreProvider';

export const metadata: Metadata = {
  title: 'AI Trading Dashboard',
  description: 'Plateforme intelligente de day trading assistée par IA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TradingAI',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: '/icons/favicon-32x32.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#06060f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-0 min-h-screen overflow-hidden">
        <StoreProvider>
          {/* Grid background */}
          <div className="fixed inset-0 grid-bg opacity-50 pointer-events-none" />

          <div className="flex h-screen w-full overflow-hidden relative">
            {/* Left sidebar navigation */}
            <Sidebar />

            {/* Main content area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              {/* Top bar with market status */}
              <TopBar />

              {/* Scrolling ticker */}
              <TickerBar />

              {/* Page content */}
              <main className="flex-1 overflow-hidden relative">
                {children}
              </main>
            </div>
          </div>

          {/* Notification center overlay */}
          <NotificationCenter />
        </StoreProvider>
      </body>
    </html>
  );
}
