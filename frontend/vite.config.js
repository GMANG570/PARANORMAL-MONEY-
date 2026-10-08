import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const previewMode = process.env.BASE44_PREVIEW_MODE === '1'

// Inside the sandbox the dev server is reached through the preview proxy's own
// hostname, which changes with the sandbox id, so allowlist it only in preview mode.
const allowedHosts = []
if (previewMode) {
  if (process.env.BASE44_SANDBOX_HOST_DOMAIN) {
    allowedHosts.push(`.${process.env.BASE44_SANDBOX_HOST_DOMAIN}`)
  }
  if (process.env.BASE44_PUBLIC_HOST_SUFFIX) {
    allowedHosts.push(`3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`)
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    ...(previewMode
      ? { allowedHosts, watch: { usePolling: true, interval: 300 } }
      : {}),
    // Single origin: the browser only ever talks to this dev server.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://api:8000',
        changeOrigin: true,
      },
    },
  },
})
