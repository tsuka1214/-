// Push Notification Utilities & Diagnostic Helpers

export interface NotificationStatusInfo {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isInIframe: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}

export function getNotificationStatusInfo(): NotificationStatusInfo {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;
  const permission: NotificationPermission | 'unsupported' = isSupported
    ? Notification.permission
    : 'unsupported';

  let isInIframe = false;
  if (typeof window !== 'undefined') {
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = true;
    }
  }

  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true);

  return {
    isSupported,
    permission,
    isInIframe,
    isIOS,
    isStandalone,
  };
}

export interface RequestPermissionResult {
  success: boolean;
  status: NotificationPermission | 'unsupported';
  reason?: 'iframe' | 'denied' | 'unsupported' | 'dismissed' | 'error';
  errorMessage?: string;
  isInIframe?: boolean;
}

export async function requestPushPermission(): Promise<RequestPermissionResult> {
  const info = getNotificationStatusInfo();

  if (!info.isSupported) {
    return {
      success: false,
      status: 'unsupported',
      reason: 'unsupported',
      errorMessage: 'お使いのブラウザまたは端末はWeb通知機能に対応していません。',
      isInIframe: info.isInIframe,
    };
  }

  // If running inside an iframe, browsers block Notification.requestPermission()
  if (info.isInIframe) {
    return {
      success: false,
      status: info.permission,
      reason: 'iframe',
      errorMessage:
        'プレビュー画面（iframe）内ではブラウザのセキュリティ制限により通知ダイアログを表示できません。アプリを別タブで開いてから許可してください。',
      isInIframe: true,
    };
  }

  // If already denied
  if (info.permission === 'denied') {
    return {
      success: false,
      status: 'denied',
      reason: 'denied',
      errorMessage:
        'ブラウザ側で通知が「ブロック（拒否）」されています。アドレスバーの鍵アイコンから通知を「許可」に変更してください。',
    };
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      return { success: true, status: 'granted' };
    }
    if (result === 'denied') {
      return {
        success: false,
        status: 'denied',
        reason: 'denied',
        errorMessage: '通知の許可が拒否（ブロック）されました。',
      };
    }
    return {
      success: false,
      status: result,
      reason: 'dismissed',
      errorMessage: '通知の許可ダイアログが閉じられました。',
    };
  } catch (err: any) {
    console.warn('requestPermission error:', err);
    return {
      success: false,
      status: info.permission,
      reason: 'error',
      errorMessage: err?.message || '通知の許可リクエスト中にエラーが発生しました。',
    };
  }
}

export async function sendLocalNotification(
  title: string,
  options: {
    body?: string;
    icon?: string;
    tag?: string;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, error: '通知に対応していません' };
  }

  if (Notification.permission !== 'granted') {
    return {
      success: false,
      error: `通知が許可されていません（現在の状態: ${Notification.permission}）`,
    };
  }

  const icon = options.icon || '/icon-192.png';
  const body = options.body || '';
  const tag = options.tag || 'club-attendance-notify';

  try {
    // 1. Try Service Worker first (required on mobile Chrome / Android)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            icon,
            badge: '/favicon.png',
            tag,
            renotify: true,
          } as NotificationOptions);
          return { success: true };
        }
      } catch (swErr) {
        console.warn('Service worker showNotification fallback:', swErr);
      }
    }

    // 2. Fallback to desktop new Notification
    new Notification(title, {
      body,
      icon,
    });
    return { success: true };
  } catch (err: any) {
    console.error('Failed to send notification:', err);
    return {
      success: false,
      error: err?.message || '通知の表示に失敗しました',
    };
  }
}
