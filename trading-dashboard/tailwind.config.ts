import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#06060f',
          1: '#09091a',
          2: '#0d0d1f',
          3: '#111128',
          4: '#161630',
          card: 'rgba(13,13,31,0.85)',
          glass: 'rgba(13,13,31,0.6)',
        },
        accent: {
          violet: '#7c5cfc',
          'violet-dim': 'rgba(124,92,252,0.15)',
          'violet-glow': 'rgba(124,92,252,0.35)',
          amber: '#f5a623',
          'amber-dim': 'rgba(245,166,35,0.12)',
          teal: '#00d4b1',
          'teal-dim': 'rgba(0,212,177,0.12)',
          rose: '#ff4d6d',
          'rose-dim': 'rgba(255,77,109,0.12)',
          sky: '#38bdf8',
          lime: '#84cc16',
          gold: '#fbbf24',
        },
        t: {
          1: '#f0f0ff',
          2: '#8888b0',
          3: '#44445a',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          accent: 'rgba(124,92,252,0.3)',
          strong: 'rgba(255,255,255,0.1)',
        },
        bull: '#00d4b1',
        bear: '#ff4d6d',
        neutral: '#f5a623',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        glow: 'glow 2s ease-in-out infinite alternate',
        ticker: 'ticker 30s linear infinite',
        'spin-slow': 'spin 4s linear infinite',
        shimmer: 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideRight: { from: { transform: 'translateX(-16px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        glow: { from: { boxShadow: '0 0 8px rgba(124,92,252,0.3)' }, to: { boxShadow: '0 0 24px rgba(124,92,252,0.6)' } },
        ticker: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(-100%)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        glow: '0 0 24px rgba(124,92,252,0.3)',
        'glow-teal': '0 0 24px rgba(0,212,177,0.3)',
        'glow-amber': '0 0 24px rgba(245,166,35,0.3)',
        'glow-rose': '0 0 24px rgba(255,77,109,0.3)',
        float: '0 8px 40px rgba(0,0,0,0.5)',
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem', '4xl': '2rem' },
      spacing: { '18': '4.5rem', '88': '22rem', '120': '30rem' },
      screens: { tablet: '768px', ipad: '1024px', 'ipad-pro': '1366px' },
    },
  },
  plugins: [],
};

export default config;
