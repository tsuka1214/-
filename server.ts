import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getLineWorksApi2Token, sendLineWorksBotMessage } from './server/lineworksApi.ts';
import keyReminderHandler from './api/cron/key-reminder.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json());

// Health check endpoints for Cloud Run / Vercel
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// Vercel Cron Jobs & Cloud Scheduler 定時実行用エンドポイント (GET / POST)
app.all('/api/cron/key-reminder', async (req, res) => {
  console.log(`[Express Server] ${req.method} /api/cron/key-reminder リクエスト受信`);
  await keyReminderHandler(req, res);
});

app.post('/api/lineworks/verify', async (req, res) => {
  console.log('[Express Server] POST /api/lineworks/verify リクエスト受信 (通信経路: サーバー経由)');
  try {
    await getLineWorksApi2Token(req.body);
    res.json({
      success: true,
      httpStatus: 200,
      origin: 'server',
      location: 'サーバー経由（バックエンド -> LINE WORKS認可サーバー）',
      route: 'サーバー（バックエンド）経由',
      message: 'アクセストークン発行に成功しました',
    });
  } catch (err: any) {
    const httpStatus = err.httpStatus || 400;
    const responseBody = err.responseBody || err.message || '';
    const errorCode = err.errorCode || '';
    const errorMessage = err.errorMessage || err.message || '認証エラーが発生しました';
    const origin = err.origin || 'server';
    const location = err.location || 'サーバー経由（バックエンド: /api/lineworks/verify）';
    const step = err.step || 'アクセストークン発行処理';

    console.error(`[Express Server] LINE WORKS認証エラー (HTTP ${httpStatus}):`, {
      errorCode,
      errorMessage,
      responseBody,
      location,
    });

    res.status(httpStatus).json({
      success: false,
      httpStatus,
      responseBody,
      errorCode,
      error: errorMessage,
      origin,
      location,
      route: 'サーバー（バックエンド）経由でLINE WORKS APIを実行',
      step,
    });
  }
});

app.post('/api/lineworks/send', async (req, res) => {
  console.log('[Express Server] POST /api/lineworks/send リクエスト受信 (通信経路: サーバー経由)');
  const result = await sendLineWorksBotMessage(req.body);
  res.status(result.success ? 200 : result.status || 500).json(result);
});

// Serve frontend dist
const distPath = path.join(__dirname, 'dist');

// Service Worker must never be cached by HTTP cache
app.get('/sw.js', (_req, res) => {
  const distSw = path.join(distPath, 'sw.js');
  const publicSw = path.join(__dirname, 'public', 'sw.js');
  const target = fs.existsSync(distSw) ? distSw : publicSw;
  if (fs.existsSync(target)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile(target);
  } else {
    res.status(404).send('Service worker not found');
  }
});

app.use(express.static(distPath));
app.get('*', (_req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Application is running. Build in progress or dist directory ready.');
  }
});

// Bind to 0.0.0.0 as required by Cloud Run
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});

