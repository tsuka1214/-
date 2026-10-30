export interface RequestPermissionResult {
  success: boolean;
  permission?: NotificationPermission;
  error?: string;
}

export function getNotificationStatusInfo(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<RequestPermissionResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, error: 'このブラウザは通知に対応していません' };
  }

  try {
    const permission = await Notification.requestPermission();
    return {
      success: permission === 'granted',
      permission,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || '通知権限の要求に失敗しました',
    };
  }
}

export async function sendLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, error: '通知非対応' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, error: '通知が許可されていません' };
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          ...options,
        });
        return { success: true };
      }
    }

    new Notification(title, {
      icon: '/icon-192.png',
      ...options,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || '通知表示エラー' };
  }
}
