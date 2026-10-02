import React, { useState } from 'react';
import {
  Bell,
  ExternalLink,
  Copy,
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  Smartphone,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  getNotificationStatusInfo,
  sendLocalNotification,
} from '../utils/notification';

interface NotificationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'iframe' | 'denied' | 'unsupported' | 'dismissed' | 'error' | null;
  onTestNotification?: () => Promise<{ success: boolean; error?: string }>;
}

export const NotificationGuideModal: React.FC<NotificationGuideModalProps> = ({
  isOpen,
  onClose,
  reason,
  onTestNotification,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const info = getNotificationStatusInfo();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setTestResultMsg(null);
    try {
      let res;
      if (onTestNotification) {
        res = await onTestNotification();
      } else {
        res = await sendLocalNotification('🔔 通知テスト: 部活動出欠アプリ', {
          body: '通知テストが正常に届きました！遅刻連絡やまとめ通知がこの端末に届きます。',
        });
      }

      if (res.success) {
        setTestResultMsg({
          type: 'success',
          text: 'テスト通知を送信しました！端末の通知センターまたは画面上部をご確認ください。',
        });
      } else {
        setTestResultMsg({
          type: 'error',
          text: res.error || 'テスト通知の送信に失敗しました。',
        });
      }
    } catch (err: any) {
      setTestResultMsg({
        type: 'error',
        text: err?.message || 'エラーが発生しました。',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div
      id="modal-notification-guide"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                プッシュ通知の設定・診断ガイド
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                端末の通知権限と受信設定の確認
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status chip */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium">現在の通知ステータス:</span>
          <span
            className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
              info.permission === 'granted'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : info.permission === 'denied'
                ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            {info.permission === 'granted'
              ? '✅ 許可済み（有効）'
              : info.permission === 'denied'
              ? '🚫 ブロック（拒否中）'
              : '⏳ 未設定（未許可）'}
          </span>
        </div>

        {/* Cause 1: Running in iframe (e.g. preview) */}
        {(info.isInIframe || reason === 'iframe') && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  プレビュー画面（iframe）内では通知許可ダイアログが開けません
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  Google ChromeやSafari等のブラウザでは、セキュリティ保護のため**埋め込み画面（iframe）内からの通知許可リクエストが完全に遮断**されています。
                </p>
                <p className="text-xs text-amber-900 dark:text-amber-200 font-bold">
                  解決策: アプリを『新しいタブで開く』と、通常のWeb画面として通知の許可ダイアログが表示されます！
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                id="btn-guide-open-new-tab"
                onClick={handleOpenInNewTab}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                別タブでアプリを開く（推奨）
              </button>
              <button
                type="button"
                id="btn-guide-copy-url"
                onClick={handleCopyUrl}
                className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-600 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    URLをコピーしました！
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    URLをコピー
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Cause 2: Blocked / Denied in browser settings */}
        {(info.permission === 'denied' || reason === 'denied') && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  ブラウザ設定で通知が「ブロック（拒否）」されています
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-300/90 leading-relaxed">
                  一度「ブロック」を選択した場合、ブラウザの仕様により許可ボタンを押してもダイアログは再表示されません。ブラウザの設定から解除する必要があります。
                </p>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 space-y-2 border border-rose-200/60 dark:border-rose-900/40">
              <p className="font-bold text-slate-800 dark:text-slate-200">解除手順（Google Chrome / Edge）:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                <li>ブラウザのアドレスバー左端にある【鍵マーク 🔒】または【サイト情報アイコン】をクリック</li>
                <li>「通知」の項目を「許可」に変更</li>
                <li>ページを再読み込み（リロード）</li>
              </ol>
            </div>
          </div>
        )}

        {/* Cause 3: iOS Safari (iPhone / iPad) tips */}
        {info.isIOS && !info.isStandalone && (
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  iPhone / iPadをご利用の場合（iOS Web Push）
                </h4>
                <p className="text-xs text-indigo-800 dark:text-indigo-300/90 leading-relaxed">
                  iOS Safariの仕様上、通常のSafariブラウザ内ではWebプッシュ通知が動作しません。
                  **Safariの共有ボタンから「ホーム画面に追加」**して、ホーム画面のアプリアイコンから起動することでプッシュ通知が利用可能になります。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Test Notification Section */}
        <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              端末通知のテスト送信
            </span>
            <button
              type="button"
              id="btn-guide-send-test"
              onClick={handleSendTest}
              disabled={isSendingTest}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              <Send className="w-3 h-3" />
              {isSendingTest ? '送信中...' : 'テスト通知を送信'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            通知が許可されている場合、即座に画面上部または通知センターにテスト通知が表示されます。
          </p>

          {testResultMsg && (
            <div
              className={`p-2.5 rounded-xl text-xs ${
                testResultMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
              }`}
            >
              {testResultMsg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
