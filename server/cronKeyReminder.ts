import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
import { sendLineWorksBotMessage } from './lineworksApi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firestoreInstance: any = null;

export function getServerFirestore() {
  if (firestoreInstance) return firestoreInstance;

  const possiblePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, '..', 'firebase-applet-config.json'),
  ];

  let configJson: any = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        configJson = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      } catch (err) {
        console.warn(`[CronKeyReminder] 設定ファイル読み込み警告 (${p}):`, err);
      }
    }
  }

  if (!configJson) {
    throw new Error('firebase-applet-config.json が見つかりません');
  }

  const existingApps = getApps();
  const app = existingApps.length > 0 ? existingApps[0] : initializeApp(configJson);
  firestoreInstance = getFirestore(app, configJson.firestoreDatabaseId);
  return firestoreInstance;
}

export function getCurrentJstTime(date = new Date()): {
  today: string;
  hours: number;
  minutes: number;
  timeStr: string;
  totalMinutes: number;
} {
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
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const today = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const hours = parseInt(getPart('hour'), 10) || 0;
  const minutes = parseInt(getPart('minute'), 10) || 0;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const totalMinutes = hours * 60 + minutes;

  return { today, hours, minutes, timeStr, totalMinutes };
}

export function normalizeCronTimeStr(val: any, defaultVal = '18:00'): string {
  if (!val) return defaultVal;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{1,2}:\d{1,2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(':').map(Number);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return defaultVal;
}

export function verifyCronSecret(requestHeaderSecret?: string | string[]): boolean {
  const expectedSecret = (process.env.CRON_SECRET || 'club-key-reminder-cron-secret').trim();
  const provided = (
    Array.isArray(requestHeaderSecret) ? requestHeaderSecret[0] : requestHeaderSecret || ''
  ).trim();

  return Boolean(provided && provided === expectedSecret);
}

export interface KeyReminderCronResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  count?: number;
  message?: string;
  time?: string;
  error?: string;
}

export async function executeKeyReminderCron(options?: {
  isForce?: boolean;
}): Promise<KeyReminderCronResult> {
  const isForce = options?.isForce === true;
  const db = getServerFirestore();
  const now = new Date();
  const { today, hours, minutes, timeStr, totalMinutes } = getCurrentJstTime(now);

  console.log(`[CronKeyReminder] ⏱️ 定時催促実行チェック開始 (現在JST: ${timeStr}, 日付: ${today}${isForce ? ' [FORCE]' : ''})`);

  // 1. 深夜・早朝制限（0:00〜6:00 JST）
  if (hours >= 0 && hours < 6 && !isForce) {
    const msg = `深夜・早朝（0:00〜6:00 JST）のため自動制限中 (現在: ${timeStr})`;
    console.log(`[CronKeyReminder] 🌙 スキップ: ${msg}`);
    return { success: true, skipped: true, reason: msg, time: timeStr };
  }

  // 2. 設定読み込み (config/app_settings & settings/lineworks)
  let appSettings: any = {};
  let lwSettingsDoc: any = {};
  try {
    const [appSnap, lwSnap] = await Promise.all([
      getDoc(doc(db, 'config', 'app_settings')),
      getDoc(doc(db, 'settings', 'lineworks')),
    ]);
    if (appSnap.exists()) appSettings = appSnap.data() || {};
    if (lwSnap.exists()) lwSettingsDoc = lwSnap.data() || {};
  } catch (err: any) {
    console.error('[CronKeyReminder] 設定読み込みエラー:', err);
    return { success: false, error: `設定取得失敗: ${err.message}` };
  }

  const krConfig = appSettings.keyReminders || {};
  const isEnabled = krConfig.enabled === true;

  if (!isEnabled && !isForce) {
    const msg = '鍵催促機能が無効（OFF）です';
    console.log(`[CronKeyReminder] ⏹️ スキップ: ${msg}`);
    return { success: true, skipped: true, reason: msg, time: timeStr };
  }

  // 3. 催促開始時刻の判定
  let startTime = normalizeCronTimeStr(krConfig.startTime, '18:00');
  if (krConfig.useSummaryTime === true) {
    const override = appSettings.dateSpecificOverrides?.[today];
    if (override && override.enabled && override.time) {
      startTime = normalizeCronTimeStr(override.time, startTime);
    } else {
      const dayOfWeek = now.getDay();
      const sched = appSettings.weeklyNotificationSchedule?.[dayOfWeek];
      if (sched && sched.enabled && sched.time) {
        startTime = normalizeCronTimeStr(sched.time, startTime);
      }
    }
  }

  const [startH, startM] = startTime.split(':').map(Number);
  const startTotalMinutes = startH * 60 + startM;
  const elapsedMinutesSinceStart = totalMinutes - startTotalMinutes;

  // 開始時刻前かチェック
  if (totalMinutes < startTotalMinutes && !isForce) {
    const remain = startTotalMinutes - totalMinutes;
    const msg = `催促開始時刻(${startTime})に達していません（現在: ${timeStr}、あと${remain}分で開始予定）`;
    console.log(`[CronKeyReminder] ⏳ スキップ: ${msg}`);
    return { success: true, skipped: true, reason: msg, time: timeStr };
  }

  // 4. 設定時刻から2時間以上経過している場合のスキップ判定
  if (elapsedMinutesSinceStart > 120 && !isForce) {
    const msg = `催促開始時刻(${startTime})から2時間以上(${elapsedMinutesSinceStart}分)経過したため送信をスキップしました`;
    console.log(`[CronKeyReminder] ⏩ スキップ: ${msg}`);
    return { success: true, skipped: true, reason: msg, time: timeStr };
  }

  // 5. 施錠報告ロックの確認 (レースコンディション防止)
  try {
    const lockSnap = await getDoc(doc(db, 'system_locks', 'reminder_lock'));
    if (lockSnap.exists()) {
      const lData = lockSnap.data();
      const isLocked = lData.isLocked === true;
      const lockedAt = Number(lData.lockedAt) || 0;
      if (isLocked && Date.now() - lockedAt < 30000 && !isForce) {
        const msg = `部員が施錠報告を実行中のためスキップしました（ロック中: ${lData.reporter || '部員'}）`;
        console.log(`[CronKeyReminder] 🔒 スキップ: ${msg}`);
        return { success: true, skipped: true, reason: msg, time: timeStr };
      }
    }
  } catch (lockErr) {
    console.warn('[CronKeyReminder] ロック確認警告 (続行):', lockErr);
  }

  // 6. 本日の送信履歴確認 (上限回数・インターバル)
  let currentCount = 0;
  let lastSentAt = 0;
  const reminderDocRef = doc(db, 'key_reminders', `${today}_unified`);
  try {
    const reminderSnap = await getDoc(reminderDocRef);
    if (reminderSnap.exists()) {
      const rData = reminderSnap.data();
      currentCount = Number(rData.count) || 0;
      lastSentAt = Number(rData.lastSentAt) || 0;
    }
  } catch (err) {
    console.warn('[CronKeyReminder] 履歴読み込み警告:', err);
  }

  const maxCount = typeof krConfig.maxCount === 'number' ? krConfig.maxCount : 10;
  const intervalMinutes = typeof krConfig.intervalMinutes === 'number' ? krConfig.intervalMinutes : 15;
  const intervalMs = intervalMinutes * 60 * 1000;

  if (currentCount >= maxCount && !isForce) {
    const msg = `本日の最大催促回数(${maxCount}回)に達しました（本日: ${currentCount}回送信完了）`;
    console.log(`[CronKeyReminder] 🏁 スキップ: ${msg}`);
    return { success: true, skipped: true, reason: msg, count: currentCount, time: timeStr };
  }

  // 直近1分以内の連打防止クールダウン
  const elapsedSinceLastSent = Date.now() - lastSentAt;
  if (currentCount > 0 && lastSentAt > 0 && elapsedSinceLastSent < 60000 && !isForce) {
    const msg = `直近1分以内に送信されたばかりのためクールダウン待機中（あと${Math.ceil((60000 - elapsedSinceLastSent) / 1000)}秒）`;
    console.log(`[CronKeyReminder] ⏳ スキップ: ${msg}`);
    return { success: true, skipped: true, reason: msg, count: currentCount, time: timeStr };
  }

  // インターバル待機判定（30秒のジッター許容）
  if (currentCount > 0 && lastSentAt > 0 && elapsedSinceLastSent < intervalMs - 30000 && !isForce) {
    const remainMin = Math.max(1, Math.ceil((intervalMs - elapsedSinceLastSent) / 60000));
    const msg = `インターバル待機中（間隔: ${intervalMinutes}分、次回送信まで約${remainMin}分）`;
    console.log(`[CronKeyReminder] ⏳ スキップ: ${msg}`);
    return { success: true, skipped: true, reason: msg, count: currentCount, time: timeStr };
  }

  // 7. 最新の鍵状態を取得 (key_status および key_logs)
  let key1Closed = false;
  let key2Closed = false;

  try {
    const [s1Snap, s2Snap] = await Promise.all([
      getDoc(doc(db, 'key_status', 'key1')),
      getDoc(doc(db, 'key_status', 'key2')),
    ]);

    const checkDoc = (snap: any) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.status === 'closed' && d.updatedAt) {
          const logDateStr = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
            .format(new Date(d.updatedAt))
            .replace(/\//g, '-');
          if (logDateStr === today) return true;
        }
      }
      return false;
    };

    if (checkDoc(s1Snap)) key1Closed = true;
    if (checkDoc(s2Snap)) key2Closed = true;
  } catch (err) {
    console.warn('[CronKeyReminder] key_status確認エラー:', err);
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
          if (data.keyId === 'key1') key1Closed = true;
          if (data.keyId === 'key2') key2Closed = true;
        }
      }
    });
  } catch (err) {
    console.warn('[CronKeyReminder] key_logs確認エラー:', err);
  }

  // 両方の鍵が施錠済みであれば催促不要
  if (key1Closed && key2Closed && !isForce) {
    const msg = '全ての鍵が本日施錠報告済みです（催促不要）';
    console.log(`[CronKeyReminder] 🔑 スキップ: ${msg}`);
    return { success: true, skipped: true, reason: msg, time: timeStr };
  }

  // 8. 催促メッセージ作成
  const key1Name = appSettings.keyNames?.key1 || '鍵①';
  const key2Name = appSettings.keyNames?.key2 || '鍵②';
  const nextCount = currentCount + 1;

  let notifMessage = '';
  if (!key1Closed && !key2Closed) {
    notifMessage = `【鍵の催促】${key1Name}と${key2Name}の両方がまだ閉められていません。報告してください。（${nextCount}回目）`;
  } else if (!key1Closed) {
    notifMessage = `【鍵の催促】${key1Name}がまだ閉められていません。報告してください。（${nextCount}回目）`;
  } else {
    notifMessage = `【鍵の催促】${key2Name}がまだ閉められていません。報告してください。（${nextCount}回目）`;
  }

  console.log(`[CronKeyReminder] 📢 催促メッセージを配信します: "${notifMessage}" (送信回数: ${nextCount}回目)`);

  // 9. LINE WORKS 送信設定解決
  const env = process.env;
  const krLwConfig = appSettings.lineWorksKeyReminder || {};
  const rootLwConfig = appSettings.lineWorks || {};

  const effectiveClientId = (
    krLwConfig.clientId ||
    lwSettingsDoc.clientId ||
    rootLwConfig.clientId ||
    env.LINEWORKS_CLIENT_ID ||
    env.VITE_LINEWORKS_CLIENT_ID ||
    ''
  ).trim();

  const effectiveClientSecret = (
    krLwConfig.clientSecret ||
    lwSettingsDoc.clientSecret ||
    rootLwConfig.clientSecret ||
    env.LINEWORKS_CLIENT_SECRET ||
    env.VITE_LINEWORKS_CLIENT_SECRET ||
    ''
  ).trim();

  const effectiveServiceAccount = (
    krLwConfig.serviceAccount ||
    lwSettingsDoc.serviceAccount ||
    rootLwConfig.serviceAccount ||
    env.LINEWORKS_SERVICE_ACCOUNT ||
    env.VITE_LINEWORKS_SERVICE_ACCOUNT ||
    ''
  ).trim();

  const effectivePrivateKey = (
    krLwConfig.privateKey ||
    lwSettingsDoc.privateKey ||
    rootLwConfig.privateKey ||
    env.LINEWORKS_PRIVATE_KEY ||
    env.VITE_LINEWORKS_PRIVATE_KEY ||
    ''
  ).trim();

  const effectiveBotId = (
    krLwConfig.botId ||
    lwSettingsDoc.botId ||
    rootLwConfig.botId ||
    env.LINEWORKS_BOT_ID ||
    env.VITE_LINEWORKS_BOT_ID ||
    ''
  ).trim();

  const effectiveChannelId = (
    krLwConfig.channelId ||
    lwSettingsDoc.channelId ||
    rootLwConfig.channelId ||
    env.LINEWORKS_CHANNEL_ID ||
    env.VITE_LINEWORKS_CHANNEL_ID ||
    ''
  ).trim();

  const effectiveServerId = (
    krLwConfig.serverId ||
    lwSettingsDoc.serverId ||
    rootLwConfig.serverId ||
    env.LINEWORKS_SERVER_ID ||
    env.VITE_LINEWORKS_SERVER_ID ||
    '40170745'
  ).trim();

  const webhookUrl = (
    krLwConfig.webhookUrl ||
    lwSettingsDoc.webhookUrl ||
    rootLwConfig.webhookUrl ||
    ''
  ).trim();

  const isWebhookMode = krLwConfig.mode === 'webhook' || rootLwConfig.mode === 'webhook';

  let lineWorksSuccess = false;
  let lineWorksError: string | undefined;

  if (isWebhookMode && webhookUrl) {
    try {
      console.log(`[CronKeyReminder] LINE WORKS Webhook送信実行: ${webhookUrl}`);
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { type: 'text', text: notifMessage },
        }),
      });
      lineWorksSuccess = res.ok;
      if (!res.ok) {
        lineWorksError = `HTTP ${res.status}: ${await res.text().catch(() => '')}`;
      }
    } catch (err: any) {
      lineWorksError = err.message;
    }
  } else if (effectiveBotId && effectiveChannelId && effectiveClientId) {
    try {
      console.log(`[CronKeyReminder] LINE WORKS API 2.0送信実行: Bot=${effectiveBotId}, Channel=${effectiveChannelId}`);
      const res = await sendLineWorksBotMessage({
        clientId: effectiveClientId,
        clientSecret: effectiveClientSecret,
        serviceAccount: effectiveServiceAccount,
        privateKey: effectivePrivateKey,
        botId: effectiveBotId,
        channelId: effectiveChannelId,
        serverId: effectiveServerId,
        text: notifMessage,
      });
      lineWorksSuccess = res.success;
      if (!res.success) {
        lineWorksError = res.error || `HTTP ${res.status}`;
      }
    } catch (err: any) {
      lineWorksError = err.message;
    }
  } else {
    console.warn('[CronKeyReminder] ⚠️ LINE WORKSの送信先が未設定（Bot ID/Channel ID不足）のためLINE送信はスキップ');
    lineWorksError = 'LINE WORKSの送信先（Bot ID / Channel ID）が未設定です';
  }

  // 10. Firestoreの履歴・ステータス更新
  const sentNow = Date.now();
  try {
    await setDoc(
      reminderDocRef,
      {
        date: today,
        count: nextCount,
        lastSentAt: sentNow,
        updatedAt: sentNow,
        lastSentSource: 'cloud_scheduler_cron',
        lastMessage: notifMessage,
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
      source: 'cloud_scheduler_cron',
    });

    // config/app_settings のステータス記録
    await updateDoc(doc(db, 'config', 'app_settings'), {
      lastLwKRStatus: {
        success: lineWorksSuccess,
        error: lineWorksSuccess ? undefined : lineWorksError,
        statusCode: lineWorksSuccess ? 200 : 500,
        timestamp: sentNow,
      },
      updatedAt: sentNow,
    }).catch(() => {});
  } catch (err) {
    console.error('[CronKeyReminder] Firestore履歴更新エラー:', err);
  }

  console.log(`[CronKeyReminder] ✅ 催促処理完了: 送信回数=${nextCount}, LINE結果=${lineWorksSuccess ? '成功' : '失敗: ' + lineWorksError}`);

  return {
    success: true,
    count: nextCount,
    time: timeStr,
    message: notifMessage,
  };
}

export async function handleKeyReminderCronHttp(req: any, res: any): Promise<void> {
  const secretHeader = req.headers['x-cron-secret'] || req.headers['x_cron_secret'];

  if (!verifyCronSecret(secretHeader)) {
    console.warn('[CronKeyReminder] ❌ 401 Unauthorized: x-cron-secret ヘッダーが不正または未指定です');
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: 'Unauthorized: invalid or missing x-cron-secret header',
      })
    );
    return;
  }

  try {
    const isForce = req.query?.force === 'true' || req.body?.force === true;
    const result = await executeKeyReminderCron({ isForce });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (err: any) {
    console.error('[CronKeyReminder] 500 Internal Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: err.message || '内部エラーが発生しました',
      })
    );
  }
}
