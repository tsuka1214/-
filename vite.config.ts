import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        devOptions: {
          enabled: true,
          type: 'module',
        },
        filename: 'sw.js',
        includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
        manifest: {
          name: '部活動出欠連絡',
          short_name: '部活出欠',
          description: '部活動の欠席・遅刻・早退・出席の連絡をリアルタイムに集約し、LINE WORKSのbot連携で当日の出席状況を自動通知するアプリ',
          theme_color: '#2563eb',
          background_color: '#0f172a',
          display: 'standalone',
          display_override: ['standalone', 'window-controls-overlay'],
          id: '/',
          start_url: '/',
          scope: '/',
          orientation: 'portrait',
          lang: 'ja',
          categories: ['education', 'utilities'],
          prefer_related_applications: false,
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: '出欠連絡をする',
              short_name: '連絡送信',
              description: '欠席・遅刻・早退を連絡',
              url: '/?tab=form',
              icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }]
            },
            {
              name: 'みんなの出欠状況',
              short_name: '状況確認',
              description: '本日の出席・欠席・遅刻状況を確認',
              url: '/?tab=status',
              icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }]
            }
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // Explicitly cache the manifest
              urlPattern: /manifest\.json$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'manifest-cache',
              },
            },
            {
              // Ensure root and common entry points are cached
              urlPattern: ({ url }) => url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'navigation-cache',
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 50,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['firebase/app', 'firebase/firestore', '@firebase/app', '@firebase/firestore'],
    },
    optimizeDeps: {
      include: ['firebase/app', 'firebase/firestore'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
