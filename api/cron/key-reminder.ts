import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { sendLineWorksBotMessage } from '../../server/lineworksApi.ts';

// Default public Firebase Client configuration as fallback for serverless execution
const FALLBACK_FIREBASE_CONFIG = {
  projectId: 'smiling-element-95fd2',
  appId: '1:674441235410:web:97a506e5e6548e463c160b',
  apiKey: 'AIzaSyBrkSLp61SYkJgDbb1Anz_WKA-JogkGccQ',
  authDomain: 'smiling-element-95fd2.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-94bee342-56df-454a-943d-4c73128a9cfc',
  storageBucket: 'smiling-element-95fd2.firebasestorage.app',
  messagingSenderId: '674441235410',
  oAuthClientId: '674441235410-mctu30qdp5hcvac7ee14ncg8v9u6bfn7.apps.googleusercontent.com',
};

let cachedDb: any = null;

function getFirestoreDb() {
  if (cachedDb) return cachedDb;

  let cfg: any = null;

  // 1. Check environment variable FIREBASE_CONFIG
  if (process.env.FIREBASE_CONFIG) {
    try {
      cfg = JSON.parse(process.env.FIREBASE_CONFIG);
    } catch {}
  }

  // 2. Check local file firebase-applet-config.json
  if (!cfg) {
    const candidatePaths = [
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      path.resolve(process.cwd(), '..', 'firebase-applet-config.json'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        } catch {}
      }
    }
  }

  // 3. Fallback to constant config
  if (!cfg) {
    cfg = FALLBACK_FIREBASE_CONFIG;
  }

  const existingApps = getApps();
  const app = existingApps.length > 0 ? existingApps[0] : initializeApp(cfg);
  cachedDb = getFirestore(app, cfg.firestoreDatabaseId || '(default)');
  return cachedDb;
}

function getJstDateInfo(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (t: string) => parts.find((p) => p.type === t)?.value || '';

  const today = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const hours = parseInt(getPart('hour'), 10) || 0;
  const minutes = parseInt(getPart('minute'), 10) || 0;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return { today, hours, minutes, timeStr };
}

function sendApiResponse(res: any, statusCode: number, data: any) {
  if (typeof res.status === 'function') {
    if (typeof res.json === 'function') {
      return res.status(statusCode).json(data);
    }
    res.status(statusCode);
  } else {
    res.statusCode = statusCode;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function verifyCronAuth(headers: Record<string, any>): boolean {
  const expectedSecret = (process.env.CRON_SECRET || 'club-key-reminder-cron-secret').trim();

  // 1. Authorization: Bearer <token> (Vercel Cron standard)
  const authHeader = (headers['authorization'] || headers['Authorization'] || '') as string;
  let bearerToken = '';
  if (authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.slice(7).trim();
  }

  // 2. x-cron-secret header (custom / cloud scheduler)
  const customHeader = (
    headers['x-cron-secret'] ||
    headers['X-Cron-Secret'] ||
    headers['x_cron_secret'] ||
    ''
  ) as string;
  const customSecret = customHeader.trim();

  if (bearerToken && bearerToken === expectedSecret) return true;
  if (customSecret && customSecret === expectedSecret) return true;

  return false;
}

/**
 * Vercel Serverless Function & Express Route Handler
 * Endpoint: /api/cron/key-reminder
 */
export default async function handler(req: any, res: any) {
  // Accept both GET (Vercel Cron default) and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendApiResponse(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  // 1. Vercel Cron Security Authentication
  const isAuthorized = verifyCronAuth(req.headers || {});
  if (!isAuthorized) {
    console.warn('[Vercel Cron] ❌ 401 Unauthorized: CRON_SECRET authentication failed');
    return sendApiResponse(res, 401, {
      success: false,
      error: 'Unauthorized: invalid or missing CRON_SECRET authorization',
    });
  }

  const isForce = req.query?.force === 'true' || req.body?.force === true;

  try {
    const db = getFirestoreDb();
    const { today, hours, timeStr } = getJstDateInfo();

    console.log(`[Vercel Cron] ⏱️ 鍵催促Cron実行開始 (JST: ${timeStr}, 日付: ${today}${isForce ? ' [FORCE]' : ''})`);

    // 深夜帯制限（0:00〜6:00 JST）
    if (hours >= 0 && hours < 6 && !isForce) {
      const msg = `深夜・早朝（0:00〜6:00 JST）のため自動制限中 (現在: ${timeStr})`;
      console.log(`[Vercel Cron] 🌙 スキップ: ${msg}`);
      return sendApiResponse(res, 200, {
        success: true,
        skipped: true,
        reason: msg,
        time: timeStr,
        date: today,
      });
    }

    // 2. 本日の鍵の報告状況を取得 (key_status および key_logs)
    let key1Closed = false;
    let key2Closed = false;
    let key1Reporter = '';
    let key2Reporter = '';

    try {
      const [s1Snap, s2Snap] = await Promise.all([
        getDoc(doc(db, 'key_status', 'key1')),
        getDoc(doc(db, 'key_status', 'key2')),
      ]);

      const checkSnap = (snap: any, keyId: 'key1' | 'key2') => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.status === 'closed' && d.updatedAt) {
            const dateStr = new Intl.DateTimeFormat('ja-JP', {
              timeZone: 'Asia/Tokyo',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
              .format(new Date(d.updatedAt))
              .replace(/\//g, '-');
            if (dateStr === today) {
              if (keyId === 'key1') {
                key1Closed = true;
                key1Reporter = d.reporterName || d.reportedBy || '';
              } else {
                key2Closed = true;
                key2Reporter = d.reporterName || d.reportedBy || '';
              }
            }
          }
        }
      };

      checkSnap(s1Snap, 'key1');
      checkSnap(s2Snap, 'key2');
    } catch (err) {
      console.warn('[Vercel Cron] key_status 取得警告:', err);
    }

    // key_logs の本日分も確認
    try {
      const logsQuery = query(collection(db, 'key_logs'), orderBy('timestamp', 'desc'), limit(20));
      const logsSnap = await getDocs(logsQuery);
      logsSnap.forEach((d) => {
        const data = d.data();
        if (data.status === 'closed' && data.timestamp) {
          const dateStr = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
            .format(new Date(data.timestamp))
            .replace(/\//g, '-');
          if (dateStr === today) {
            if (data.keyId === 'key1') {
              key1Closed = true;
              key1Reporter = key1Reporter || data.reporterName || data.reportedBy || '';
            }
            if (data.keyId === 'key2') {
              key2Closed = true;
              key2Reporter = key2Reporter || data.reporterName || data.reportedBy || '';
            }
          }
        }
      });
    } catch (err) {
      console.warn('[Vercel Cron] key_logs 取得警告:', err);
    }

    // 3. 鍵①と鍵②の両方が報告済みなら、何もせず終了する（200 OKを返す）
    if (key1Closed && key2Closed && !isForce) {
      const msg = '鍵①と鍵②の両方が本日報告済みのため、催促通知を送信せず終了しました';
      console.log(`[Vercel Cron] 🔑 スキップ: ${msg}`);
      return sendApiResponse(res, 200, {
        success: true,
        skipped: true,
        reason: msg,
        time: timeStr,
        date: today,
        key1: 'closed',
        key2: 'closed',
        key1Reporter,
        key2Reporter,
      });
    }

    // 4. 設定と本日の送信回数を取得
    let appSettings: any = {};
    let lwSettings: any = {};
    try {
      const [appSnap, lwSnap] = await Promise.all([
        getDoc(doc(db, 'config', 'app_settings')),
        getDoc(doc(db, 'settings', 'lineworks')),
      ]);
      if (appSnap.exists()) appSettings = appSnap.data() || {};
      if (lwSnap.exists()) lwSettings = lwSnap.data() || {};
    } catch (err) {
      console.warn('[Vercel Cron] 設定読み込み警告:', err);
    }

    const key1Name = appSettings.keyNames?.key1 || '鍵①';
    const key2Name = appSettings.keyNames?.key2 || '鍵②';

    // 本日の送信カウント取得
    let currentCount = 0;
    const reminderDocRef = doc(db, 'key_reminders', `${today}_unified`);
    try {
      const rSnap = await getDoc(reminderDocRef);
      if (rSnap.exists()) {
        currentCount = Number(rSnap.data()?.count) || 0;
      }
    } catch {}

    const nextCount = currentCount + 1;

    // 催促メッセージ作成
    let notifMessage = '';
    if (!key1Closed && !key2Closed) {
      notifMessage = `【鍵の催促】${key1Name}と${key2Name}の両方がまだ閉められていません。報告してください。（${nextCount}回目）`;
    } else if (!key1Closed) {
      notifMessage = `【鍵の催促】${key1Name}がまだ閉められていません。報告してください。（${nextCount}回目）`;
    } else {
      notifMessage = `【鍵の催促】${key2Name}がまだ閉められていません。報告してください。（${nextCount}回目）`;
    }

    console.log(`[Vercel Cron] 📢 LINE WORKSへ催促送信準備: "${notifMessage}"`);

    // 4. LINE WORKSのAPI（serverId: 40170745）を使って催促メッセージを送信
    // 環境変数（process.env.LINEWORKS_*）から優先的に読み込み
    const env = process.env;
    const krLwConfig = appSettings.lineWorksKeyReminder || {};
    const rootLwConfig = appSettings.lineWorks || {};

    const clientId = (
      env.LINEWORKS_CLIENT_ID ||
      env.VITE_LINEWORKS_CLIENT_ID ||
      krLwConfig.clientId ||
      lwSettings.clientId ||
      rootLwConfig.clientId ||
      ''
    ).trim();

    const clientSecret = (
      env.LINEWORKS_CLIENT_SECRET ||
      env.VITE_LINEWORKS_CLIENT_SECRET ||
      krLwConfig.clientSecret ||
      lwSettings.clientSecret ||
      rootLwConfig.clientSecret ||
      ''
    ).trim();

    const serviceAccount = (
      env.LINEWORKS_SERVICE_ACCOUNT ||
      env.VITE_LINEWORKS_SERVICE_ACCOUNT ||
      krLwConfig.serviceAccount ||
      lwSettings.serviceAccount ||
      rootLwConfig.serviceAccount ||
      ''
    ).trim();

    const privateKey = (
      env.LINEWORKS_PRIVATE_KEY ||
      env.VITE_LINEWORKS_PRIVATE_KEY ||
      krLwConfig.privateKey ||
      lwSettings.privateKey ||
      rootLwConfig.privateKey ||
      ''
    ).trim();

    const botId = (
      env.LINEWORKS_BOT_ID ||
      env.VITE_LINEWORKS_BOT_ID ||
      krLwConfig.botId ||
      lwSettings.botId ||
      rootLwConfig.botId ||
      ''
    ).trim();

    const channelId = (
      env.LINEWORKS_CHANNEL_ID ||
      env.VITE_LINEWORKS_CHANNEL_ID ||
      krLwConfig.channelId ||
      lwSettings.channelId ||
      rootLwConfig.channelId ||
      ''
    ).trim();

    // 要件: invalid serverId にならないよう、正しい serverId: 40170745 を含める
    let serverId = (
      env.LINEWORKS_SERVER_ID ||
      env.VITE_LINEWORKS_SERVER_ID ||
      krLwConfig.serverId ||
      lwSettings.serverId ||
      '40170745'
    ).trim();

    if (!serverId || serverId === 'works-330883' || !/^\d+$/.test(serverId)) {
      serverId = '40170745';
    }

    const webhookUrl = (
      env.LINEWORKS_WEBHOOK_URL ||
      krLwConfig.webhookUrl ||
      lwSettings.webhookUrl ||
      rootLwConfig.webhookUrl ||
      ''
    ).trim();

    const isWebhook = krLwConfig.mode === 'webhook' || rootLwConfig.mode === 'webhook';

    let sendResult: any = { success: false };

    if (isWebhook && webhookUrl) {
      console.log(`[Vercel Cron] Webhook経由で送信中...`);
      try {
        const wbRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { type: 'text', text: notifMessage },
          }),
        });
        sendResult = {
          success: wbRes.ok,
          status: wbRes.status,
          error: wbRes.ok ? undefined : await wbRes.text().catch(() => ''),
        };
      } catch (err: any) {
        sendResult = { success: false, error: err.message };
      }
    } else {
      console.log(`[Vercel Cron] LINE WORKS API 2.0 (Bot: ${botId}, Channel: ${channelId}, ServerID: ${serverId}) で送信中...`);
      sendResult = await sendLineWorksBotMessage({
        clientId,
        clientSecret,
        serviceAccount,
        privateKey,
        botId,
        channelId,
        serverId,
        text: notifMessage,
      });
    }

    // 5. 送信後、Firestoreの「催促送信済みフラグ」を更新して二重送信を防ぐ
    const sentNow = Date.now();
    try {
      await setDoc(
        reminderDocRef,
        {
          date: today,
          count: nextCount,
          lastSentAt: sentNow,
          updatedAt: sentNow,
          lastSentSource: 'vercel_cron',
          lastStatus: {
            key1Closed,
            key2Closed,
            message: notifMessage,
            time: timeStr,
            lineWorksSuccess: sendResult.success,
          },
        },
        { merge: true }
      );

      // アプリ内通知ドキュメントも追加
      await addDoc(collection(db, 'notifications'), {
        title: '鍵の催促',
        message: notifMessage,
        type: 'reminder',
        reminderCount: nextCount,
        relatedDate: today,
        createdAt: sentNow,
        source: 'vercel_cron',
      });

      // config/app_settings の送信履歴を更新
      await updateDoc(doc(db, 'config', 'app_settings'), {
        lastLwKRStatus: {
          success: sendResult.success,
          error: sendResult.success ? undefined : sendResult.error,
          statusCode: sendResult.status || (sendResult.success ? 200 : 500),
          timestamp: sentNow,
        },
        updatedAt: sentNow,
      }).catch(() => {});
    } catch (saveErr) {
      console.error('[Vercel Cron] Firestore履歴保存エラー:', saveErr);
    }

    // 6. 処理結果をJSONで返す（成功/失敗）
    if (sendResult.success) {
      console.log(`[Vercel Cron] ✅ 催促通知の送信に成功しました (${timeStr})`);
      return sendApiResponse(res, 200, {
        success: true,
        message: 'LINE WORKSへ鍵催促通知を送信しました',
        count: nextCount,
        time: timeStr,
        date: today,
        notification: notifMessage,
        keyStatus: {
          key1: key1Closed ? 'closed' : 'open',
          key2: key2Closed ? 'closed' : 'open',
        },
        lineWorksResult: sendResult,
      });
    } else {
      console.error(`[Vercel Cron] ❌ LINE WORKS送信失敗:`, sendResult.error);
      return sendApiResponse(res, sendResult.status || 500, {
        success: false,
        error: sendResult.error || 'LINE WORKS送信に失敗しました',
        count: nextCount,
        time: timeStr,
        date: today,
        notification: notifMessage,
        keyStatus: {
          key1: key1Closed ? 'closed' : 'open',
          key2: key2Closed ? 'closed' : 'open',
        },
        lineWorksResult: sendResult,
      });
    }
  } catch (err: any) {
    console.error('[Vercel Cron] 500 サーバーエラー:', err);
    return sendApiResponse(res, 500, {
      success: false,
      error: err.message || '内部エラーが発生しました',
    });
  }
}
