import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MathV2 — CAD/CAM Intelligence Platform',
  description:
    'AI-powered CAD drawing analysis and G-Code generation for professional CNC machining. Supports Fanuc, Siemens, Heidenhain controllers.',
  keywords: 'CAD, CAM, CNC, G-Code, machining, AI, automation',
  authors: [{ name: 'MathV2 Team' }],
  themeColor: '#0a0a0f',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'MathV2 — CAD/CAM Intelligence Platform',
    description: 'AI-powered technical drawing to G-Code in seconds',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-text-primary antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
