import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { sendBotMessageApi2, getLineWorksAccessToken } from './server/lineworksApi';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Callback endpoint for LINE WORKS Bot (accepts verification and events gracefully)
  app.all('/api/lineworks/callback', (req, res) => {
    // Return 200 OK to satisfy verification checks
    res.status(200).send('OK');
  });

  // Test credentials for LINE WORKS API 2.0 (Service Account + JWT)
  app.post('/api/lineworks/verify-auth', async (req, res) => {
    try {
      const { clientId, clientSecret, serviceAccount, privateKey } = req.body;
      if (!clientId || !clientSecret || !serviceAccount || !privateKey) {
        return res.status(400).json({ error: 'Client ID, Client Secret, Service Account, Private Keyのすべてを入力してください' });
      }

      const token = await getLineWorksAccessToken({
        clientId,
        clientSecret,
        serviceAccount,
        privateKey,
      });

      return res.json({
        success: true,
        message: '認証に成功しました！アクセストークンを正常に取得できました。',
        tokenPreview: `${token.substring(0, 10)}...`,
      });
    } catch (err: any) {
      console.error('API 2.0 auth verification error:', err);
      return res.status(400).json({
        error: err?.message || '認証検証に失敗しました',
      });
    }
  });

  // Unified LINE WORKS dispatch endpoint (supports API 2.0 and Webhook)
  app.post('/api/lineworks/dispatch', async (req, res) => {
    try {
      const { mode, text, api2, webhookUrl } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: '送信テキストが空です' });
      }

      // Mode: API 2.0 (Free plan compatible official Bot API)
      if (mode === 'api2' || (!mode && api2?.clientId && api2?.privateKey)) {
        if (!api2?.clientId || !api2?.clientSecret || !api2?.serviceAccount || !api2?.privateKey || !api2?.botId) {
          return res.status(400).json({
            error: 'API 2.0 の必須情報（Client ID, Client Secret, Service Account, Private Key, Bot ID）が不足しています',
          });
        }

        if (!api2.channelId && !api2.userId) {
          return res.status(400).json({
            error: '送信先となる「チャンネルID（トークルームID）」を指定してください',
          });
        }

        await sendBotMessageApi2(api2, text);

        return res.json({
          success: true,
          message: 'LINE WORKS Bot (API 2.0) 経由でメッセージを送信しました',
        });
      }

      // Mode: Incoming Webhook (Paid plan only)
      if (webhookUrl && typeof webhookUrl === 'string') {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(webhookUrl);
          if (parsedUrl.protocol !== 'https:') {
            return res.status(400).json({ error: 'Webhook URLは https:// で始まる必要があります' });
          }
        } catch {
          return res.status(400).json({ error: '有効なURLではありません' });
        }

        const payload = {
          content: {
            type: 'text',
            text,
          },
          text,
        };

        const response = await fetch(parsedUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();

        if (!response.ok) {
          console.error('LINE WORKS webhook returned error:', response.status, responseText);
          return res.status(response.status).json({
            error: `LINE WORKSサーバーからエラーが返されました (HTTP ${response.status})`,
            details: responseText.slice(0, 200),
          });
        }

        return res.json({
          success: true,
          message: 'LINE WORKSへWebhookでメッセージを送信しました',
        });
      }

      return res.status(400).json({
        error: 'API 2.0の接続情報またはWebhook URLのいずれかを設定してください',
      });
    } catch (err: any) {
      console.error('Error in /api/lineworks/dispatch:', err);
      return res.status(500).json({
        error: err?.message || 'LINE WORKSへの送信処理中にエラーが発生しました',
      });
    }
  });

  // Legacy fallback proxy endpoint for backward compatibility
  app.post('/api/lineworks/send', async (req, res) => {
    try {
      const { webhookUrl, text } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Webhook URLが指定されていません' });
      }
      const fetchRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ content: { type: 'text', text }, text }),
      });
      const txt = await fetchRes.text();
      if (!fetchRes.ok) {
        return res.status(fetchRes.status).json({ error: txt });
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message });
    }
  });

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
