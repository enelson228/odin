/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        'odin-bg-primary': '#0a0e14',
        'odin-bg-secondary': '#111822',
        'odin-bg-tertiary': '#1a2332',
        'odin-bg-hover': '#1f2b3d',
        'odin-border': '#1e2d3d',
        'odin-border-bright': '#2a3f55',
        'odin-cyan': '#00e5ff',
        'odin-cyan-dim': '#006680',
        'odin-green': '#00ff88',
        'odin-green-dim': '#00804a',
        'odin-amber': '#ffab00',
        'odin-amber-dim': '#805500',
        'odin-red': '#ff3d3d',
        'odin-red-dim': '#801e1e',
        'odin-purple': '#b388ff',
        'odin-text-primary': '#e0e6ed',
        'odin-text-secondary': '#8899aa',
        'odin-text-tertiary': '#7a8a9a',  // Improved from #556677 — passes WCAG AA at 4.6:1
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.7rem', { lineHeight: '1rem' }],
        sm: ['0.8rem', { lineHeight: '1.2rem' }],
        base: ['0.875rem', { lineHeight: '1.4rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      boxShadow: {
        'glow-cyan': '0 0 10px rgba(0, 229, 255, 0.15)',
        'glow-green': '0 0 10px rgba(0, 255, 136, 0.15)',
        'glow-amber': '0 0 10px rgba(255, 171, 0, 0.15)',
        'glow-red': '0 0 10px rgba(255, 61, 61, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
