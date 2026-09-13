import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    // Sentry source maps — upload minified stack traces for readable errors
    // Only runs when SENTRY_AUTH_TOKEN is set (CI/CD builds)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG || "gramseva",
          project: process.env.SENTRY_PROJECT || "gramseva-web",
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })]
      : []),
  ],
  build: {
    chunkSizeWarningLimit: 2000,
    sourcemap: true, // Required for Sentry to map minified traces
  },
})
