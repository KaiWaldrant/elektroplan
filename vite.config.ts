/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Plugin } from 'vite'

/**
 * Production builds get a strict Content-Security-Policy: the app may load only its own files
 * and may not open any network connection (connect-src 'none'). Plans and projects stay local.
 * Dev mode skips it because Vite's hot reload needs a websocket.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const csp = (): Plugin => ({
  name: 'elektroplan-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

export default defineConfig({
  plugins: [svelte(), csp()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
