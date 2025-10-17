/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0F0F13',
          alt: '#16161D'
        },
        surface: {
          DEFAULT: '#1E1E24',
          alt: '#27272F'
        },
        primary: {
          DEFAULT: '#3A86FF',
          hover: '#2B76EF',
          900: '#1A65DE',
          800: '#2B76EF',
          700: '#3A86FF',
          600: '#4E96FF',
          500: '#62A6FF',
          400: '#76B6FF',
          300: '#8AC6FF',
          200: '#9ED6FF',
          100: '#B2E6FF'
        },
        secondary: {
          DEFAULT: '#8F44FD',
          hover: '#7F34ED',
          900: '#6F24DD',
          800: '#7F34ED',
          700: '#8F44FD',
          600: '#9F54FD',
          500: '#AF64FD',
          400: '#BF74FD',
          300: '#CF84FD',
          200: '#DF94FD',
          100: '#EFA4FD'
        },
        accent: {
          DEFAULT: '#FF3864',
          hover: '#EF2854',
          900: '#DF1844',
          800: '#EF2854',
          700: '#FF3864',
          600: '#FF4874',
          500: '#FF5884',
          400: '#FF6894',
          300: '#FF78A4',
          200: '#FF88B4',
          100: '#FF98C4'
        },
        success: {
          DEFAULT: '#00F5A0',
          900: '#00C580',
          600: '#00D590',
          300: '#00E5A0',
          100: '#66FFB8'
        },
        warning: {
          DEFAULT: '#FFB800',
          900: '#D99B00',
          600: '#E9A800',
          300: '#FFB800',
          100: '#FFCF66'
        },
        error: {
          DEFAULT: '#FF3333',
          900: '#D92020',
          600: '#E92929',
          300: '#FF3333',
          100: '#FF6666'
        },
        neutral: {
          900: '#0F0F13',
          800: '#16161D',
          700: '#1E1E24',
          600: '#27272F',
          500: '#353541',
          400: '#4C4C5A',
          300: '#6B6B7B',
          200: '#AEAEC2',
          100: '#D5D5E1',
          50: '#F0F0F9',
        }
      },
      fontFamily: {
        'mono': ['Space Mono', 'Source Code Pro', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif']
      },
      keyframes: {
        glitch: {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' }
        },
        flicker: {
          '0%': { opacity: '0.8' },
          '20%': { opacity: '1' },
          '40%': { opacity: '0.6' },
          '60%': { opacity: '0.9' },
          '80%': { opacity: '0.7' },
          '100%': { opacity: '0.8' }
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        }
      },
      animation: {
        glitch: 'glitch 0.2s ease-in-out infinite',
        flicker: 'flicker 2s infinite',
        scanline: 'scanline 2s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      boxShadow: {
        'glow': '0 0 15px 2px rgba(58, 134, 255, 0.3)',
        'glow-accent': '0 0 15px 2px rgba(255, 56, 100, 0.3)',
        'glow-secondary': '0 0 15px 2px rgba(143, 68, 253, 0.3)'
      },
      backgroundImage: {
        'grid': 'linear-gradient(to right, #27272F 1px, transparent 1px), linear-gradient(to bottom, #27272F 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(circle, var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
};