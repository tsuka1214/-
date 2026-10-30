import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X, CheckCircle2 } from 'lucide-react';

export const UpdateToast: React.FC = () => {
  const [show, setShow] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('最新版に更新しました');
  const [submessage, setSubmessage] = useState<string>('画面の表示や設定が最新の状態になりました');
  const [isJustReloaded, setIsJustReloaded] = useState<boolean>(false);

  useEffect(() => {
    // 0. 直前の再読込直後、または v99 初回適用時のフィードバック表示
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const justReloaded = sessionStorage.getItem('sw_just_reloaded');
        if (justReloaded) {
          sessionStorage.removeItem('sw_just_reloaded');
          setMessage('最新版に更新完了しました');
          setSubmessage('最新の画面と設定が正常に反映されました');
          setIsJustReloaded(true);
          setShow(true);
        }
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        const notifiedV99 = localStorage.getItem('pwa_v99_update_notified');
        if (!notifiedV99) {
          localStorage.setItem('pwa_v99_update_notified', 'true');
          setMessage('最新版に更新しました');
          setSubmessage('古いキャッシュを破棄し、最新のシステムが適用されました');
          setIsJustReloaded(true);
          setShow(true);
        }
      }
    } catch {
      // ignore storage errors
    }

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // 1. Service Worker からの更新完了メッセージ受信
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        console.log('[UpdateToast] Received SW_UPDATED message:', event.data.version);
        setMessage('最新版に更新しました');
        setSubmessage('新しいバージョンが適用されました。「再読込」で反映されます');
        setIsJustReloaded(false);
        setShow(true);
      }
    };

    // 2. 新しいService Workerがページを制御開始した時（即時有効化）
    const handleControllerChange = () => {
      console.log('[UpdateToast] Controller changed, new SW is controlling this page');
      setMessage('最新版に更新しました');
      setSubmessage('最新のコードが有効になりました。「再読込」で画面を更新してください');
      setIsJustReloaded(false);
      setShow(true);
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // 3. 起動時にアクティブなSWの更新状況をチェック
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      // すでに待機中の新しいWorkerがある場合は即時適用を促す
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setMessage('最新版に更新しました');
              setSubmessage('最新バージョンが適用されました。「再読込」をタップしてください');
              setIsJustReloaded(false);
              setShow(true);
            }
          });
        }
      });
    }).catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  // 自動非表示タイマー（7秒）
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        setShow(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const handleReload = () => {
    try {
      sessionStorage.setItem('sw_just_reloaded', '1');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  if (!show) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 w-full max-w-[460px] px-3 z-50 animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="bg-emerald-600 text-white rounded-2xl p-3 shadow-xl flex items-center justify-between gap-2 border border-emerald-500/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            {isJustReloaded ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-100" />
            ) : (
              <Sparkles className="w-4 h-4 text-emerald-100 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight">{message}</p>
            <p className="text-[10px] text-emerald-100 truncate mt-0.5">
              {submessage}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isJustReloaded && (
            <button
              type="button"
              onClick={handleReload}
              className="text-[10px] font-bold bg-white text-emerald-800 hover:bg-emerald-50 px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              title="最新版を再読込"
            >
              <RefreshCw className="w-3 h-3" />
              再読込
            </button>
          )}
          <button
            type="button"
            onClick={() => setShow(false)}
            className="p-1 text-emerald-200 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
