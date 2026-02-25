import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    test: {
      environment: 'jsdom',
      setupFiles: './tests/setupTests.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'html', 'lcov'],
      },
    },
  }
})
