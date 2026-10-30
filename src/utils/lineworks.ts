import { AttendanceRecord, ClubEvent, LineWorksConfig } from '../types';
import { formatJapaneseDate } from './date';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const DEFAULT_SERVER_ID = '40170745';

/**
 * 環境変数からのLINE WORKS設定値（フォールバック用）
 */
export function getEnvLineWorksConfig(): Partial<LineWorksConfig> {
  const env = (import.meta as any).env || {};
  return {
    clientId: env.VITE_LINEWORKS_CLIENT_ID || '',
    clientSecret: env.VITE_LINEWORKS_CLIENT_SECRET || '',
    serviceAccount: env.VITE_LINEWORKS_SERVICE_ACCOUNT || '',
    privateKey: env.VITE_LINEWORKS_PRIVATE_KEY || '',
    botId: env.VITE_LINEWORKS_BOT_ID || '',
    channelId: env.VITE_LINEWORKS_CHANNEL_ID || '',
    serverId: env.VITE_LINEWORKS_SERVER_ID || DEFAULT_SERVER_ID,
  };
}

/**
 * Firestoreの専用ドキュメント settings/lineworks から設定を取得
 */
export async function fetchLineWorksConfigFromFirestore(): Promise<LineWorksConfig | null> {
  try {
    const docRef = doc(db, 'settings', 'lineworks');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as LineWorksConfig;
      console.log('[LINE WORKS] Firestore settings/lineworks より設定を読み込みました');
      return data;
    }
  } catch (err) {
    console.warn('[LINE WORKS] Firestore settings/lineworks 読み込み失敗:', err);
  }
  return null;
}

/**
 * Firestoreの専用ドキュメント settings/lineworks に設定を保存
 */
export async function saveLineWorksConfigToFirestore(config: Partial<LineWorksConfig>): Promise<void> {
  const docRef = doc(db, 'settings', 'lineworks');
  const payload = {
    ...config,
    serverId: config.serverId?.trim() || DEFAULT_SERVER_ID,
    updatedAt: Date.now(),
  };
  await setDoc(docRef, payload, { merge: true });
  console.log('[LINE WORKS] Firestore settings/lineworks に設定を保存しました:', {
    clientId: payload.clientId,
    serviceAccount: payload.serviceAccount,
    serverId: payload.serverId,
    enabled: payload.enabled,
  });
}

/**
 * 優先順位に従ってLINE WORKS設定を解決:
 * 1. Firestore専用ドキュメント settings/lineworks
 * 2. 既存のアプリ設定 (config/app_settings.lineWorks) ※既存情報保護
 * 3. 環境変数 (VITE_LINEWORKS_...)
 */
export function resolveEffectiveLineWorksConfig(
  firestoreConfig?: Partial<LineWorksConfig> | null,
  fallbackConfig?: Partial<LineWorksConfig> | null
): LineWorksConfig {
  const env = getEnvLineWorksConfig();

  const clientId = firestoreConfig?.clientId?.trim() || fallbackConfig?.clientId?.trim() || env.clientId || '';
  const clientSecret = firestoreConfig?.clientSecret?.trim() || fallbackConfig?.clientSecret?.trim() || env.clientSecret || '';
  const serviceAccount = firestoreConfig?.serviceAccount?.trim() || fallbackConfig?.serviceAccount?.trim() || env.serviceAccount || '';
  const privateKey = firestoreConfig?.privateKey?.trim() || fallbackConfig?.privateKey?.trim() || env.privateKey || '';
  const botId = firestoreConfig?.botId?.trim() || fallbackConfig?.botId?.trim() || env.botId || '';
  const channelId = firestoreConfig?.channelId?.trim() || fallbackConfig?.channelId?.trim() || env.channelId || '';
  const serverId = firestoreConfig?.serverId?.trim() || fallbackConfig?.serverId?.trim() || env.serverId || DEFAULT_SERVER_ID;

  return {
    enabled: firestoreConfig?.enabled ?? fallbackConfig?.enabled ?? false,
    mode: firestoreConfig?.mode || fallbackConfig?.mode || 'api2',
    webhookUrl: firestoreConfig?.webhookUrl?.trim() || fallbackConfig?.webhookUrl?.trim() || '',
    botName: firestoreConfig?.botName || fallbackConfig?.botName || '部活出欠bot',
    clientId,
    clientSecret,
    serviceAccount,
    privateKey,
    botId,
    channelId,
    serverId: serverId || DEFAULT_SERVER_ID,
    sendDailySummary: firestoreConfig?.sendDailySummary ?? fallbackConfig?.sendDailySummary ?? true,
    sendTardyAlert: firestoreConfig?.sendTardyAlert ?? fallbackConfig?.sendTardyAlert ?? true,
    sendEventReminder: firestoreConfig?.sendEventReminder ?? fallbackConfig?.sendEventReminder ?? true,
  };
}

export function formatDailySummaryMessage(summaryText: string, botName = '部活出欠bot'): string {
  return summaryText;
}

export function formatEmergencyTardyAlertMessage(record: AttendanceRecord, botName = '部活出欠bot'): string {
  const timeInfo = record.time ? `（${record.time} 頃）` : '';
  const reasonInfo = record.reason ? `\n理由: ${record.reason}` : '';
  return `🚨【緊急遽刻連絡】\n${record.memberName} さんが本日${timeInfo}緊急遽刻します。${reasonInfo}`;
}

export function formatEventReminderMessage(event: ClubEvent, daysUntil: number, botName = '部活出欠bot'): string {
  const label = daysUntil === 0 ? '本日開催' : daysUntil === 1 ? '明日開催' : `${daysUntil}日後`;
  let msg = `📅【イベントリマインド: ${label}】\n「${event.title}」\n日程: ${formatJapaneseDate(event.date)}`;
  if (event.startTime) msg += `\n時間: ${event.startTime}${event.endTime ? `〜${event.endTime}` : ''}`;
  if (event.location) msg += `\n場所: ${event.location}`;
  if (event.clothing) msg += `\n服装: ${event.clothing}`;
  if (event.category) msg += `\n区分: ${event.category}`;
  if (event.notes) msg += `\n備考: ${event.notes}`;
  return msg;
}

export interface LineWorksVerifyResult {
  success: boolean;
  httpStatus?: number;
  responseBody?: string;
  errorCode?: string;
  error?: string;
  origin: 'frontend' | 'server';
  location: string;
  route: string;
  step?: string;
  corsError?: boolean;
}

export async function sendLineWorksNotification(
  config: LineWorksConfig,
  text: string
): Promise<{ success: boolean; error?: string; status?: number; responseBody?: string }> {
  try {
    if (!config.enabled) {
      return { success: false, error: 'LINE WORKS連携が無効です' };
    }

    if (config.mode === 'webhook') {
      if (!config.webhookUrl) {
        return { success: false, error: 'Webhook URLが設定されていません' };
      }
      console.log('----------------------------------------------------');
      console.log('【LINE WORKS 通信経路ログ】Webhookモード');
      console.log('・通信経路: ブラウザ（フロントエンド）から直接Webhook URLへ送信中');
      console.log('・送信先URL:', config.webhookUrl);
      console.log('----------------------------------------------------');

      try {
        const res = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: {
              type: 'text',
              text: text,
            },
          }),
        });
        if (res.ok) {
          console.log(`[LINE WORKS Webhook] 送信成功 (HTTP ${res.status})`);
          return { success: true, status: res.status };
        }
        const errText = await res.text().catch(() => '');
        console.error(`[LINE WORKS Webhook] 送信失敗 (HTTP ${res.status}):`, errText);
        return { success: false, error: errText || `HTTP ${res.status}`, status: res.status, responseBody: errText };
      } catch (webhookErr: any) {
        console.error('【LINE WORKS Webhook】フロントエンド直接送信で例外発生:', webhookErr);
        if (webhookErr.name === 'TypeError' || webhookErr.message?.includes('Failed to fetch')) {
          console.warn('【LINE WORKS CORS確認】ブラウザからWebhook URLへの直接送信でTypeError(Failed to fetch)が発生しました。LINE WORKSサーバーがブラウザ間CORSを許可していない可能性があります。');
        }
        return {
          success: false,
          error: `ブラウザ直接送信エラー (CORSまたはネットワーク制約の可能性): ${webhookErr.message}`,
          responseBody: webhookErr.message,
        };
      }
    }

    // mode: api2 (サーバー経由)
    console.log('----------------------------------------------------');
    console.log('【LINE WORKS 通信経路ログ】API 2.0モード');
    console.log('・通信経路: サーバー（バックエンド: /api/lineworks/send）経由で送信中');
    console.log('・理由: 秘密鍵のRSA署名およびLINE WORKS Bot APIの呼び出しをサーバー側で安全に中継（CORS回避）');
    console.log('----------------------------------------------------');

    const res = await fetch('/api/lineworks/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        serviceAccount: config.serviceAccount,
        privateKey: config.privateKey,
        botId: config.botId,
        channelId: config.channelId,
        serverId: config.serverId,
        text,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      console.log(`[LINE WORKS API 2.0] メッセージ送信成功 (HTTP ${res.status})`);
      return { success: true, status: res.status };
    }
    console.error(`[LINE WORKS API 2.0] メッセージ送信失敗:`, data);
    return {
      success: false,
      error: data.error || `HTTP ${res.status}`,
      status: res.status || data.status,
      responseBody: data.responseBody || data.error,
    };
  } catch (err: any) {
    console.error('[LINE WORKS] 送信処理例外:', err);
    return { success: false, error: err.message || '送信中にエラーが発生しました' };
  }
}

export async function verifyLineWorksApi2Auth(params?: {
  clientId?: string;
  clientSecret?: string;
  serviceAccount?: string;
  privateKey?: string;
  serverId?: string;
}): Promise<LineWorksVerifyResult> {
  const env = getEnvLineWorksConfig();
  const effectiveParams = {
    clientId: (params?.clientId || env.clientId || '').trim(),
    clientSecret: (params?.clientSecret || env.clientSecret || '').trim(),
    serviceAccount: (params?.serviceAccount || env.serviceAccount || '').trim(),
    privateKey: (params?.privateKey || env.privateKey || '').trim(),
    serverId: (params?.serverId || env.serverId || DEFAULT_SERVER_ID).trim(),
  };

  // 通信経路の確認ログ出力 (要件2)
  console.log('========================================================');
  console.log('【LINE WORKS 通信経路の確認ログ】');
  console.log('・現在の処理経路: 「サーバー（バックエンド）経由」でLINE WORKSを叩いています。');
  console.log('・通信フロー: [ブラウザ/フロントエンド] ──> [サーバー (/api/lineworks/verify)] ──> [LINE WORKS 認可サーバー (https://auth.worksmobile.com)]');
  console.log('・理由: LINE WORKSのトークン発行エンドポイントはブラウザ直接アクセス(CORS)を許可しておらず、また秘密鍵(RSA-SHA256)の安全な署名処理を行うため、バックエンドプロキシ経由で中継しています。');
  console.log('・CORS状態: サーバー経由で通信しているため、ブラウザ-LINE WORKS間の直接CORSエラーは発生しません。');
  console.log('・認証パラメータ (iss/sub/serverId):', {
    clientId: effectiveParams.clientId ? `${effectiveParams.clientId.slice(0, 4)}...` : '(未設定)',
    serviceAccount: effectiveParams.serviceAccount,
    serverId: effectiveParams.serverId,
  });
  console.log('========================================================');

  try {
    console.log('[verifyLineWorksApi2Auth] /api/lineworks/verify へリクエスト送信中 (サーバー経由)...');
    const res = await fetch('/api/lineworks/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(effectiveParams),
    });

    const rawText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { error: rawText };
    }

    if (res.ok && data.success) {
      console.log(`[verifyLineWorksApi2Auth] 認証確認成功！ (HTTP ${res.status})`, data);
      return {
        success: true,
        httpStatus: res.status,
        responseBody: rawText,
        origin: 'server',
        location: 'サーバー経由（バックエンド -> LINE WORKS認可サーバー）',
        route: 'サーバー（バックエンド）経由',
        step: 'アクセストークン発行成功',
      };
    }

    // サーバーまたはLINE WORKSからエラー応答が返却された場合
    const statusCode = data.httpStatus || res.status;
    const responseBody = data.responseBody || (typeof data.error === 'string' ? data.error : rawText) || 'レスポンスなし';
    const errorCode = data.errorCode || '';
    const errorMessage = data.error || `HTTP ${statusCode}: 認証確認に失敗しました`;
    const origin = data.origin || 'server';
    const location = data.location || 'サーバー経由（バックエンド: /api/lineworks/verify -> LINE WORKS認可サーバー）';

    console.error(`[verifyLineWorksApi2Auth] サーバー経由でエラーを検出 (HTTP ${statusCode}):`, {
      errorCode,
      errorMessage,
      responseBody,
      origin,
      location,
    });

    return {
      success: false,
      httpStatus: statusCode,
      responseBody,
      errorCode,
      error: errorMessage,
      origin,
      location,
      route: 'サーバー（バックエンド）経由',
      step: data.step || 'アクセストークン発行処理',
    };
  } catch (err: any) {
    // ブラウザからサーバーへの通信自体が失敗した場合（ネットワーク切断、サーバー停止、CORSなど）
    const isCorsOrNetwork = err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
    console.error('【LINE WORKS 通信エラー】フロントエンド（ブラウザ）側でfetch実行例外が発生しました:', err);
    if (isCorsOrNetwork) {
      console.warn('【CORS/ネットワーク確認】ブラウザからサーバーへの通信に失敗しました。サーバーが停止しているか、同一オリジン/CORS制限に抵触している可能性があります。');
    }

    return {
      success: false,
      httpStatus: 0,
      responseBody: err.message || 'ブラウザからサーバーへの通信に失敗しました (Failed to fetch)',
      errorCode: isCorsOrNetwork ? 'FETCH_FAILED' : 'CLIENT_EXCEPTION',
      error: err.message || 'ブラウザからサーバーへの通信エラー',
      origin: 'frontend',
      location: 'フロントエンド（ブラウザ: fetch("/api/lineworks/verify") 失敗）',
      route: 'フロントエンド（ブラウザ）側でエラー発生',
      step: 'ブラウザからサーバーへのリクエスト送信フェーズ',
      corsError: isCorsOrNetwork,
    };
  }
}

/**
 * 施錠報告LINE WORKS送信用の設定を解決:
 * 1. 鍵催促用設定 (settings.lineWorksKeyReminder) を最優先
 * 2. 未設定の場合は出欠連絡用設定 (settings.lineWorks) をフォールバックとして使用
 */
export function resolveKeyReportLineWorksConfig(
  keyReminderConfig?: Partial<LineWorksConfig> | null,
  attendanceConfig?: Partial<LineWorksConfig> | null
): LineWorksConfig | null {
  // 1. 鍵催促用設定が有効な場合
  if (keyReminderConfig?.enabled) {
    const merged: LineWorksConfig = {
      enabled: true,
      mode: keyReminderConfig.mode || attendanceConfig?.mode || 'api2',
      webhookUrl: keyReminderConfig.webhookUrl?.trim() || attendanceConfig?.webhookUrl?.trim() || '',
      botName: keyReminderConfig.botName || attendanceConfig?.botName || '鍵催促Bot',
      clientId: keyReminderConfig.clientId?.trim() || attendanceConfig?.clientId?.trim() || '',
      clientSecret: keyReminderConfig.clientSecret?.trim() || attendanceConfig?.clientSecret?.trim() || '',
      serviceAccount: keyReminderConfig.serviceAccount?.trim() || attendanceConfig?.serviceAccount?.trim() || '',
      privateKey: keyReminderConfig.privateKey?.trim() || attendanceConfig?.privateKey?.trim() || '',
      botId: keyReminderConfig.botId?.trim() || attendanceConfig?.botId?.trim() || '',
      channelId: keyReminderConfig.channelId?.trim() || attendanceConfig?.channelId?.trim() || '',
      serverId: keyReminderConfig.serverId?.trim() || attendanceConfig?.serverId?.trim() || DEFAULT_SERVER_ID,
    };
    if (merged.mode === 'webhook' ? Boolean(merged.webhookUrl) : Boolean(merged.clientId && merged.botId && merged.channelId)) {
      return merged;
    }
  }

  // 2. 出欠連絡用設定をフォールバックとして使用
  if (attendanceConfig?.enabled) {
    const effective = resolveEffectiveLineWorksConfig(attendanceConfig, null);
    if (effective.enabled && (effective.mode === 'webhook' ? Boolean(effective.webhookUrl) : Boolean(effective.clientId && effective.botId && effective.channelId))) {
      return effective;
    }
  }

  return null;
}

/**
 * 施錠報告メッセージをフォーマット
 * 例：「🔒 【施錠報告】鍵①（正面玄関）を 今江司 さん（木管・サックス）が閉めました。（10/26 13:45）」
 */
export function formatKeyClosedMessage(params: {
  keyName: string;
  reporterName: string;
  section?: string;
  part?: string;
  timestamp?: number;
}): string {
  const { keyName, reporterName, section, part, timestamp } = params;
  const affiliationParts = [section, part].filter((v) => Boolean(v && v !== '未設定' && v !== 'その他'));
  const affiliation = affiliationParts.join('・');
  const affiliationText = affiliation ? `（${affiliation}）` : '';

  const dateObj = timestamp ? new Date(timestamp) : new Date();
  const month = dateObj.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric' });
  const day = dateObj.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', day: 'numeric' });
  const time = dateObj.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });
  const dateFormatted = `${month}/${day} ${time}`;

  return `🔒 【施錠報告】${keyName} を ${reporterName} さん${affiliationText}が閉めました。（${dateFormatted}）`;
}
