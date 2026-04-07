import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#1a1a1a',
          'bg-dark': '#111111',
          'bg-card': '#2a2a2a',
          border: '#333333',
          green: '#6a9955',
          'green-cursor': '#6a9955',
          text: '#d4d4d4',
          muted: '#858585',
          dim: '#555555',
        },
      },
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
