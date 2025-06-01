/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7ff',
          100: '#bae7ff',
          200: '#91d5ff',
          300: '#69c0ff',
          400: '#40a9ff',
          500: '#1890ff',
          600: '#096dd9',
          700: '#0050b3',
          800: '#003a8c',
          900: '#002766',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        accent: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        threat: {
          low: '#4ade80',
          medium: '#facc15',
          high: '#ef4444',
        },
        cyber: {
          purple: '#6C63FF',
          blue: '#40A9FF',
          cyan: '#36CFC9',
          teal: '#10B981',
          green: '#52C41A',
          yellow: '#FAAD14',
          orange: '#FA541C',
          red: '#F5222D',
          dark: '#121526',
          darker: '#0A0C1B',
        }
      },
      boxShadow: {
        'cyber': '0 0 15px rgba(24, 144, 255, 0.35)',
        'cyber-lg': '0 0 30px rgba(24, 144, 255, 0.45)',
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(45deg, #002766 0%, #003a8c 100%)',
        'cyber-radial': 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
