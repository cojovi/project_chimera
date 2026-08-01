/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#06070a',
        panel: '#0b0d12',
        edge: '#1a1e28',
        steel: {
          DEFAULT: '#8b93a7',
          dim: '#4c5261',
          faint: '#2a2e3a'
        },
        amber: {
          DEFAULT: '#ffb300',
          dim: '#8a6200',
          glow: '#ffd257'
        },
        alarm: {
          DEFAULT: '#ff2b2b',
          dim: '#7a1515'
        },
        armed: {
          DEFAULT: '#3dff88',
          dim: '#156038'
        }
      },
      fontFamily: {
        display: ['Michroma', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' }
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' }
        },
        alarmpulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(5px)' }
        },
        flicker: {
          '0%': { opacity: '0.97' },
          '5%': { opacity: '0.9' },
          '10%': { opacity: '0.98' },
          '15%': { opacity: '0.88' },
          '20%': { opacity: '1' },
          '100%': { opacity: '1' }
        }
      },
      animation: {
        scanline: 'scanline 7s linear infinite',
        blink: 'blink 1.1s step-end infinite',
        alarmpulse: 'alarmpulse 0.9s ease-in-out infinite',
        shake: 'shake 0.4s ease-in-out',
        flicker: 'flicker 4s linear infinite'
      }
    }
  },
  plugins: []
};
