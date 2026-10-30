import crypto from 'crypto';

export interface LineWorksApiErrorData {
  httpStatus: number;
  responseBody: string;
  errorCode?: string;
  errorMessage: string;
  origin: 'server' | 'frontend';
  step: string;
  location: string;
}

export class LineWorksApiError extends Error {
  httpStatus: number;
  responseBody: string;
  errorCode?: string;
  errorMessage: string;
  origin: 'server' | 'frontend';
  step: string;
  location: string;

  constructor(data: LineWorksApiErrorData) {
    super(data.errorMessage);
    this.name = 'LineWorksApiError';
    this.httpStatus = data.httpStatus;
    this.responseBody = data.responseBody;
    this.errorCode = data.errorCode || '';
    this.errorMessage = data.errorMessage;
    this.origin = data.origin;
    this.step = data.step;
    this.location = data.location;
  }
}

function base64UrlEncode(str: string | Buffer): string {
  const base64 = Buffer.isBuffer(str) ? str.toString('base64') : Buffer.from(str).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface LineWorksApi2TokenParams {
  clientId?: string;
  clientSecret?: string;
  serviceAccount?: string;
  privateKey?: string;
  serverId?: string;
}

export async function getLineWorksApi2Token(params: LineWorksApi2TokenParams): Promise<string> {
  const env = process.env;
  // Firestoreから送られた値があれば優先、ない場合のみ環境変数へフォールバック
  const clientId = (params?.clientId || env.LINEWORKS_CLIENT_ID || env.VITE_LINEWORKS_CLIENT_ID || '').trim();
  const clientSecret = (params?.clientSecret || env.LINEWORKS_CLIENT_SECRET || env.VITE_LINEWORKS_CLIENT_SECRET || '').trim();
  const serviceAccount = (params?.serviceAccount || env.LINEWORKS_SERVICE_ACCOUNT || env.VITE_LINEWORKS_SERVICE_ACCOUNT || '').trim();
  const privateKey = (params?.privateKey || env.LINEWORKS_PRIVATE_KEY || env.VITE_LINEWORKS_PRIVATE_KEY || '').trim();
  const serverId = (params?.serverId || env.LINEWORKS_SERVER_ID || env.VITE_LINEWORKS_SERVER_ID || '40170745').trim();

  // 1. パラメータ必須チェック
  if (!clientId) {
    throw new LineWorksApiError({
      httpStatus: 400,
      responseBody: JSON.stringify({ error: 'missing_client_id', message: 'Client IDが入力されていません' }),
      errorCode: 'missing_client_id',
      errorMessage: 'Client IDを入力してください（Firestoreのsettings/lineworks、または環境変数）',
      origin: 'server',
      step: '入力パラメータ検証',
      location: 'サーバー経由（バックエンド: 入力パラメータ検証）',
    });
  }
  if (!clientSecret) {
    throw new LineWorksApiError({
      httpStatus: 400,
      responseBody: JSON.stringify({ error: 'missing_client_secret', message: 'Client Secretが入力されていません' }),
      errorCode: 'missing_client_secret',
      errorMessage: 'Client Secretを入力してください（Firestoreのsettings/lineworks、または環境変数）',
      origin: 'server',
      step: '入力パラメータ検証',
      location: 'サーバー経由（バックエンド: 入力パラメータ検証）',
    });
  }
  if (!serviceAccount) {
    throw new LineWorksApiError({
      httpStatus: 400,
      responseBody: JSON.stringify({ error: 'missing_service_account', message: 'Service Accountが入力されていません' }),
      errorCode: 'missing_service_account',
      errorMessage: 'Service Accountを入力してください（Firestoreのsettings/lineworks、または環境変数）',
      origin: 'server',
      step: '入力パラメータ検証',
      location: 'サーバー経由（バックエンド: 入力パラメータ検証）',
    });
  }
  if (!privateKey) {
    throw new LineWorksApiError({
      httpStatus: 400,
      responseBody: JSON.stringify({ error: 'missing_private_key', message: 'Private Keyが入力されていません' }),
      errorCode: 'missing_private_key',
      errorMessage: 'Private Keyを入力してください（Firestoreのsettings/lineworks、または環境変数）',
      origin: 'server',
      step: '入力パラメータ検証',
      location: 'サーバー経由（バックエンド: 入力パラメータ検証）',
    });
  }

  // 【要件1】Server ID（Tenant ID）の追加と修正
  // 正しい値はLINE WORKS Developer Console左下の数字「40170745」
  // works-330883 などのドメイン名が送られていないか確認し、40170745 に補正
  let effectiveServerId = (serverId || '').trim();
  if (!effectiveServerId || effectiveServerId === 'works-330883' || !/^\d+$/.test(effectiveServerId)) {
    effectiveServerId = '40170745';
  }

  // 【要件3】認証処理の再確認:
  // Service Account（adgo5.serviceaccount@works-330883）と Client ID（1sWZpBkHjhwM1xnsKPoI）の紐付け確認
  // JWTの iss（発行者）がClient ID、sub（主体）がService Accountになっていることを厳格に設定
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, any> = {
    iss: clientId.trim(),
    sub: serviceAccount.trim(),
    iat: now,
    exp: now + 3600,
    // Server ID / Tenant ID
    serverId: effectiveServerId,
    domainId: effectiveServerId,
  };

  console.log(`[LINE WORKS Auth] JWT Claims作成: iss=${clientId.trim()}, sub=${serviceAccount.trim()}, serverId=${effectiveServerId}, iat=${now}, exp=${now + 3600}`);

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  // 秘密鍵の整形（改行エスケープ展開・PEMヘッダー補正）
  let formattedKey = privateKey.trim().replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  if (!formattedKey.includes('-----BEGIN')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }

  let jwt = '';
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    signer.end();
    const signature = signer.sign(formattedKey);
    jwt = `${signInput}.${base64UrlEncode(signature)}`;
  } catch (signErr: any) {
    console.error('[LINE WORKS Auth] JWT署名作成失敗:', signErr);
    throw new LineWorksApiError({
      httpStatus: 400,
      responseBody: JSON.stringify({
        error: 'invalid_private_key',
        message: `秘密鍵の形式が不正です: ${signErr.message}`,
        opensslError: signErr.message,
      }),
      errorCode: 'invalid_private_key',
      errorMessage: `秘密鍵（Private Key）の形式が不正です: ${signErr.message}。「-----BEGIN PRIVATE KEY-----」を含む正しいPEM形式であることを確認してください。`,
      origin: 'server',
      step: 'JWT秘密鍵署名生成 (RSA-SHA256)',
      location: 'サーバー経由（バックエンド署名処理）',
    });
  }

  // 3. LINE WORKS認可サーバーへのトークン要求
  // 【要件1】アクセストークン発行リクエストに正しい serverId (40170745) を含める
  // 試行1: API 2.0 標準エンドポイント (https://auth.worksmobile.com/oauth2/v2.0/token)
  // 試行2: サーバー登録型エンドポイント (https://auth.worksmobile.com/b/{serverId}/server/token)
  const tokenEndpoints = [
    {
      url: 'https://auth.worksmobile.com/oauth2/v2.0/token',
      name: 'LINE WORKS API 2.0 (oauth2/v2.0/token)',
      body: new URLSearchParams({
        assertion: jwt,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        scope: 'bot bot.message',
        serverId: effectiveServerId,
        domainId: effectiveServerId,
        tenantId: effectiveServerId,
      }),
    },
    {
      url: `https://auth.worksmobile.com/b/${encodeURIComponent(effectiveServerId)}/server/token`,
      name: `LINE WORKS サーバー別トークン (/b/${effectiveServerId}/server/token)`,
      body: new URLSearchParams({
        assertion: jwt,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        scope: 'bot bot.message',
        serverId: effectiveServerId,
        domainId: effectiveServerId,
        tenantId: effectiveServerId,
      }),
    },
  ];

  let lastErrorData: LineWorksApiErrorData | null = null;

  for (const endpoint of tokenEndpoints) {
    console.log(`[LINE WORKS Auth] サーバー経由でトークン要求を送信: URL=${endpoint.url} (Server ID=${effectiveServerId})`);

    let res: Response;
    try {
      res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: endpoint.body.toString(),
      });
    } catch (netErr: any) {
      console.error(`[LINE WORKS Auth] ${endpoint.name} への接続失敗 (Network Error):`, netErr);
      lastErrorData = {
        httpStatus: 502,
        responseBody: JSON.stringify({ error: 'network_error', message: netErr.message }),
        errorCode: 'network_error',
        errorMessage: `LINE WORKS認可サーバー (${endpoint.url}) への通信に失敗しました: ${netErr.message}`,
        origin: 'server',
        step: `LINE WORKS認可サーバー通信 (${endpoint.name})`,
        location: 'サーバー経由（バックエンド -> LINE WORKS認可サーバー）',
      };
      continue;
    }

    const rawText = await res.text().catch(() => '');
    console.log(`[LINE WORKS Auth] ${endpoint.name} レスポンス受信 (HTTP ${res.status}):`, rawText);

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // not json
    }

    // 【要件2】エラーレスポンスの正しい判定:
    // LINE WORKSからの応答が HTTP 200 OK であっても、レスポンスボディに
    // message: "invalid param" や error、または access_token が含まれていない場合は
    // 「認証失敗」として扱う（「HTTP 200だから成功」と決めつけない）
    const isError = (
      !res.ok ||
      !parsed ||
      Boolean(parsed.error) ||
      parsed.message === 'invalid param' ||
      parsed.code === '11' ||
      Boolean(parsed.detail) ||
      (parsed.code && String(parsed.code) !== '0' && String(parsed.code) !== '200') ||
      !parsed.access_token
    );

    if (!isError && parsed.access_token) {
      console.log(`[LINE WORKS Auth] サーバー経由でアクセストークンの取得に成功しました (${endpoint.name})`);
      return parsed.access_token;
    }

    // エラー詳細の抽出
    const errorCode = parsed?.error || parsed?.code || (parsed?.detail ? 'invalid_param' : `HTTP_${res.status}`);
    let errorDesc = parsed?.error_description || parsed?.message;
    if (parsed?.detail) {
      errorDesc = `${parsed.message || 'エラー'}: ${parsed.detail}`;
    }
    if (!errorDesc) {
      errorDesc = rawText || `HTTP ${res.status}: アクセストークンを取得できませんでした`;
    }

    // 特有のエラーに対する補足
    if (rawText.includes('invalid serverId')) {
      errorDesc = `invalid serverId: Server ID（Tenant ID）が正しくありません。現在の設定値 [${effectiveServerId}]。Developer Console左下に表示されている数字（40170745）であることを確認してください。`;
    } else if (rawText.includes('invalid_grant')) {
      errorDesc = `invalid_grant: JWT署名検証に失敗しました。Private Key（秘密鍵）がDeveloper Consoleで登録した公開鍵と合致しているか、およびService Account（${serviceAccount.trim()}）がClient ID（${clientId.trim()}）に正しく紐付いているか確認してください。`;
    } else if (rawText.includes('invalid_client')) {
      errorDesc = `invalid_client: Client ID（${clientId.trim()}）または Client Secret が正しくありません。`;
    }

    const currentErrorData: LineWorksApiErrorData = {
      httpStatus: res.status, // HTTP 200 であってもそのまま記録
      responseBody: rawText,
      errorCode: String(errorCode),
      errorMessage: String(errorDesc),
      origin: 'server',
      step: `アクセストークン発行API (${endpoint.name})`,
      location: 'サーバー経由（バックエンド -> LINE WORKS認可サーバー）',
    };

    // API 2.0 のエラーメッセージを最優先で記録（後続エンドポイントの invalid serverId で上書きしないようにする）
    if (!lastErrorData || (lastErrorData.httpStatus === 502 && res.status !== 502)) {
      lastErrorData = currentErrorData;
    }
  }

  // すべてのエンドポイントで失敗した場合、最初/最適なエラーを投げる
  if (lastErrorData) {
    throw new LineWorksApiError(lastErrorData);
  }

  throw new LineWorksApiError({
    httpStatus: 500,
    responseBody: JSON.stringify({ error: 'unknown_auth_error', message: 'アクセストークンを発行できませんでした' }),
    errorCode: 'unknown_auth_error',
    errorMessage: 'アクセストークンの発行に失敗しました。入力パラメータをご確認ください。',
    origin: 'server',
    step: 'アクセストークン発行処理',
    location: 'サーバー経由（バックエンド）',
  });
}

export async function sendLineWorksBotMessage(params: {
  clientId?: string;
  clientSecret?: string;
  serviceAccount?: string;
  privateKey?: string;
  botId?: string;
  channelId?: string;
  serverId?: string;
  text: string;
}): Promise<{
  success: boolean;
  status: number;
  data?: any;
  error?: string;
  errorCode?: string;
  responseBody?: string;
  origin?: 'server' | 'frontend';
  location?: string;
}> {
  try {
    const env = process.env;
    const botId = (params.botId || env.LINEWORKS_BOT_ID || env.VITE_LINEWORKS_BOT_ID || '').trim();
    const channelId = (params.channelId || env.LINEWORKS_CHANNEL_ID || env.VITE_LINEWORKS_CHANNEL_ID || '').trim();

    if (!botId) {
      return {
        success: false,
        status: 400,
        error: 'Bot IDが設定されていません（Firestoreまたは環境変数）',
        errorCode: 'missing_bot_id',
        origin: 'server',
        location: 'サーバー経由（バックエンド: sendLineWorksBotMessage）',
      };
    }
    if (!channelId) {
      return {
        success: false,
        status: 400,
        error: 'Channel ID（トークルームID）が設定されていません（Firestoreまたは環境変数）',
        errorCode: 'missing_channel_id',
        origin: 'server',
        location: 'サーバー経由（バックエンド: sendLineWorksBotMessage）',
      };
    }

    const token = await getLineWorksApi2Token(params);

    const messagePayload = {
      content: {
        type: 'text',
        text: params.text,
      },
    };

    const targetUrl = `https://www.worksapis.com/v1.0/bots/${encodeURIComponent(botId)}/channels/${encodeURIComponent(channelId)}/messages`;

    console.log(`[LINE WORKS Bot] サーバー経由でメッセージ送信リクエスト送信: URL=${targetUrl}`);

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    if (res.ok) {
      console.log(`[LINE WORKS Bot] メッセージ送信成功 (HTTP ${res.status})`);
      return { success: true, status: res.status, origin: 'server', location: 'サーバー経由（Works APIs）' };
    }

    const errText = await res.text().catch(() => '');
    console.error(`[LINE WORKS Bot] メッセージ送信失敗 (HTTP ${res.status}):`, errText);
    return {
      success: false,
      status: res.status,
      error: errText || `HTTP ${res.status}`,
      responseBody: errText,
      origin: 'server',
      location: 'サーバー経由（バックエンド -> LINE WORKS Bot API）',
    };
  } catch (err: any) {
    console.error('[LINE WORKS Bot] メッセージ送信例外:', err);
    return {
      success: false,
      status: err.httpStatus || 500,
      error: err.errorMessage || err.message || 'Send message error',
      errorCode: err.errorCode,
      responseBody: err.responseBody || err.message,
      origin: err.origin || 'server',
      location: err.location || 'サーバー経由（バックエンド）',
    };
  }
}

