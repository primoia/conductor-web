/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts,scss}",
    "./jarvis-ui/src/**/*.{html,ts,scss}",
  ],
  theme: {
    extend: {
      colors: {
        'jarvis-bg': '#020617',
        'jarvis-primary': '#22d3ee',
        'jarvis-accent': '#0ea5e9',
        'jarvis-dim': 'rgba(34, 211, 238, 0.2)',
        'stark-amber': '#ffaa00',
        'stark-cyan': '#00f2ff',
        'primary': '#00f2ff',
        'background-light': '#f8f6f6',
        'background-dark': '#020617',
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
        'spin-reverse': 'spin-reverse 8s linear infinite',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 3s linear infinite',
        'fade-in': 'fade-in 0.5s ease-out forwards',
      },
      keyframes: {
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        'scan': {
          '0%, 100%': { top: '0%' },
          '50%': { top: '100%' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
