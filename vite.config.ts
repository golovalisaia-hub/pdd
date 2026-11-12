import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { basePath } from './config/basePath'

const bankPath = (basePath + 'bank/').replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')

export default defineConfig({
  base: basePath,
  build: { license: { fileName: 'licenses/bundled-dependencies.md' } },
  plugins: [react(), tailwindcss(), VitePWA({
    injectRegister: 'script',
    manifest: {
      id: basePath, name: 'PDD — теория вождения', short_name: 'PDD', lang: 'ru',
      description: 'Личная подготовка к экзамену и тренажёр перекрёстков',
      display: 'standalone',
      theme_color: '#030303', background_color: '#030303',
      icons: [
        { src: 'pdd-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'pdd-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'pdd-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      clientsClaim: true,
      skipWaiting: true,
      globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,webp,avif,gif,svg,woff2,json}'],
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [new RegExp('^' + bankPath)],
      cleanupOutdatedCaches: true,
    },
  })],
})
