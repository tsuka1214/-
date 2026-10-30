import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { getLineWorksApi2Token, sendLineWorksBotMessage } from './server/lineworksApi';
import keyReminderHandler from './api/cron/key-reminder';

function lineworksApiPlugin(): Plugin {
  return {
    name: 'lineworks-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlPath = req.url?.split('?')[0];
        if (urlPath === '/sw.js') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          return next();
        }

        if (req.url === '/health') {
          res.statusCode = 200;
          res.end('OK');
          return;
        }

        if (req.url === '/api/health') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
          return;
        }

        if (urlPath === '/api/cron/key-reminder') {
          console.log(`[Vite Dev Server] ${req.method} /api/cron/key-reminder リクエスト受信`);
          if (req.method === 'GET' || req.method === 'HEAD') {
            (req as any).body = {};
            await keyReminderHandler(req, res);
            return;
          }

          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              (req as any).body = bodyStr ? JSON.parse(bodyStr) : {};
            } catch {
              (req as any).body = {};
            }
            await keyReminderHandler(req, res);
          });
          return;
        }

        if (!req.url?.startsWith('/api/lineworks')) {
          return next();
        }

        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const body = bodyStr ? JSON.parse(bodyStr) : {};

            if (req.url === '/api/lineworks/verify') {
              console.log('[Vite Dev Server] /api/lineworks/verify リクエスト受信 (通信経路: サーバー経由)');
              try {
                await getLineWorksApi2Token(body);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: true,
                  httpStatus: 200,
                  origin: 'server',
                  location: 'サーバー経由（バックエンド -> LINE WORKS認可サーバー）',
                  route: 'サーバー（バックエンド）経由',
                  message: 'アクセストークン発行に成功しました',
                }));
              } catch (err: any) {
                const httpStatus = err.httpStatus || 400;
                const responseBody = err.responseBody || err.message || '';
                const errorCode = err.errorCode || '';
                const errorMessage = err.errorMessage || err.message || '認証エラーが発生しました';
                const origin = err.origin || 'server';
                const location = err.location || 'サーバー経由（バックエンド: /api/lineworks/verify）';
                const step = err.step || 'アクセストークン発行処理';

                res.statusCode = httpStatus;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  httpStatus,
                  responseBody,
                  errorCode,
                  error: errorMessage,
                  origin,
                  location,
                  route: 'サーバー（バックエンド）経由でLINE WORKS APIを実行',
                  step,
                }));
              }
              return;
            }

            if (req.url === '/api/lineworks/send') {
              console.log('[Vite Dev Server] /api/lineworks/send リクエスト受信 (通信経路: サーバー経由)');
              const result = await sendLineWorksBotMessage(body);
              res.statusCode = result.success ? 200 : result.status || 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
              return;
            }

            next();
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    lineworksApiPlugin(),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: false,
  },
});
