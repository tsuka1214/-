import jwt from 'jsonwebtoken';

interface LineWorksApi2Config {
  clientId: string;
  clientSecret: string;
  serviceAccount: string;
  privateKey: string;
  botId: string;
  channelId?: string;
  userId?: string;
}

// In-memory token cache to avoid re-generating JWT and re-authenticating every notification
let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

/**
 * Clean and normalize PEM private key format
 */
function normalizePrivateKey(key: string): string {
  if (!key) return '';
  let cleaned = key.trim();
  // If user pasted without headers or with escaped newlines
  cleaned = cleaned.replace(/\\n/g, '\n');
  if (!cleaned.includes('-----BEGIN PRIVATE KEY-----') && !cleaned.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    cleaned = `-----BEGIN PRIVATE KEY-----\n${cleaned}\n-----END PRIVATE KEY-----`;
  }
  return cleaned;
}

/**
 * Obtains an Access Token from LINE WORKS Auth API using Service Account + JWT
 * Spec: https://developers.worksmobile.com/jp/docs/auth-jwt
 */
export async function getLineWorksAccessToken(config: {
  clientId: string;
  clientSecret: string;
  serviceAccount: string;
  privateKey: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 2 min buffer)
  if (cachedToken && cachedToken.expiresAt > now + 120) {
    return cachedToken.accessToken;
  }

  // Check if any critical config is missing
  const missingFields = [];
  if (!config.clientId) missingFields.push('Client ID');
  if (!config.clientSecret) missingFields.push('Client Secret');
  if (!config.serviceAccount) missingFields.push('Service Account');
  if (!config.privateKey) missingFields.push('Private Key');

  if (missingFields.length > 0) {
    const msg = `アクセストークン取得に失敗：必須項目が不足しています (${missingFields.join(', ')})`;
    console.error(`[LINE WORKS Auth] ${msg}`);
    throw new Error(msg);
  }

  const pemKey = normalizePrivateKey(config.privateKey);

  // 1. Sign JWT with RS256
  const payload = {
    iss: config.clientId.trim(),
    sub: config.serviceAccount.trim(),
    iat: now,
    exp: now + 3600,
  };

  let clientAssertion: string;
  try {
    clientAssertion = jwt.sign(payload, pemKey, {
      algorithm: 'RS256',
    });
  } catch (err: any) {
    const msg = `秘密鍵(Private Key)の署名に失敗しました。正しいPEM形式のRSA秘密鍵か確認してください: ${err?.message}`;
    console.error('[LINE WORKS Auth] JWT signing failed:', err?.message);
    throw new Error(msg);
  }

  // 2. Request Access Token from LINE WORKS Token Endpoint (API 2.0)
  const tokenUrl = 'https://auth.worksmobile.com/oauth2/v2.0/token';

  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('assertion', clientAssertion);
  params.append('client_id', config.clientId.trim());
  params.append('client_secret', config.clientSecret.trim());
  params.append('scope', 'bot,bot.message');

  try {
    console.log('[LINE WORKS Auth] トークン取得リクエスト開始...');
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: params.toString(),
    });

    const bodyText = await res.text();
    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      const msg = `トークン取得レスポンスの解析に失敗しました: (HTTP ${res.status}) ${bodyText.slice(0, 200)}`;
      console.error(`[LINE WORKS Auth] Token response parse failed (HTTP ${res.status}):`, bodyText.slice(0, 200));
      throw new Error(msg);
    }

    if (!res.ok || !data.access_token) {
      let errDesc = data.error_description || data.error || bodyText;
      if (data.error === 'invalid_scope' || errDesc.includes('scope')) {
        errDesc = `[権限エラー] Request scope is not valid. LINE WORKS Developer Console の「Service Account」設定で、このアプリに「bot」および「bot.message」のスコープが許可されているか確認してください。`;
      }
      const msg = `アクセストークンの取得に失敗しました (HTTP ${res.status}): ${errDesc}`;
      console.error(`[LINE WORKS Auth] Token acquisition failed (HTTP ${res.status}):`, errDesc);
      throw new Error(msg);
    }

    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: now + expiresIn,
    };

    console.log('[LINE WORKS Auth] トークン取得成功');
    return data.access_token;
  } catch (err: any) {
    console.error('[LINE WORKS Auth] トークン取得失敗:', err.message);
    throw err;
  }
}

/**
 * Send message to a Channel (Group) or User using LINE WORKS Bot API 2.0
 * Endpoint: POST https://www.worksapis.com/v1.0/bots/{botId}/channels/{channelId}/messages
 */
export async function sendBotMessageApi2(
  config: LineWorksApi2Config,
  text: string
): Promise<{ success: boolean; data?: any }> {
  const accessToken = await getLineWorksAccessToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    serviceAccount: config.serviceAccount,
    privateKey: config.privateKey,
  });

  const botId = encodeURIComponent(config.botId.trim());
  let targetUrl: string;

  if (config.channelId && config.channelId.trim()) {
    const channelId = encodeURIComponent(config.channelId.trim());
    targetUrl = `https://www.worksapis.com/v1.0/bots/${botId}/channels/${channelId}/messages`;
  } else if (config.userId && config.userId.trim()) {
    const userId = encodeURIComponent(config.userId.trim());
    targetUrl = `https://www.worksapis.com/v1.0/bots/${botId}/users/${userId}/messages`;
  } else {
    throw new Error('メッセージ送信先の「チャンネルID (トークルームID)」が指定されていません');
  }

  const messagePayload = {
    content: {
      type: 'text',
      text,
    },
  };

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(messagePayload),
  });

  const resText = await res.text();
  let resJson: any = null;
  try {
    resJson = JSON.parse(resText);
  } catch {
    // some endpoints may return empty body on 201
  }

  if (!res.ok) {
    const detail = resJson?.message || resJson?.code || resJson?.description || resText.slice(0, 200);
    throw new Error(`Botメッセージ送信エラー (HTTP ${res.status}): ${detail}`);
  }

  return { success: true, data: resJson };
}
