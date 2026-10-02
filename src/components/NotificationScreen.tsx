import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatTimestamp, getTodayString } from '../utils/date';
import { NotificationGuideModal } from './NotificationGuideModal';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Sparkles,
  Info,
  Trash2,
  Send,
  Volume2,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
  HelpCircle,
  Check,
  Copy,
  Key,
  User,
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { formatDailySummaryWithSections } from '../utils/formatShareText';

export const NotificationScreen: React.FC = () => {
  const {
    notifications,
    attendances,
    members,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
    cleanupDuplicateNotifications,
    triggerManualSummary,
    hasNotificationPermission,
    notificationStatus,
    isInIframe,
    requestNotificationPermission,
    sendTestNotification,
    isAdmin,
    settings,
  } = useApp();

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSentSuccess, setTestSentSuccess] = useState(false);

  // Duplicate cleanup and Delete All states
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // Notification Permission states
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);
  const [isSendingLocalTest, setIsSendingLocalTest] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideModalReason, setGuideModalReason] = useState<
    'iframe' | 'denied' | 'unsupported' | 'dismissed' | 'error' | null
  >(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedNotifId, setCopiedNotifId] = useState<string | null>(null);
  const [copiedSummaryTop, setCopiedSummaryTop] = useState(false);

  // Requirement 1 & 4: Automatically mark all as read when opening this screen
  // or when new notifications arrive while open.
  React.useEffect(() => {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    if (unreadCount > 0) {
      markAllAsRead();
    }
  }, [notifications, markAllAsRead]);

  // Compute number of duplicate notifications in current list
  const duplicateCount = React.useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    notifications.forEach((item) => {
      const dateKey =
        item.relatedDate ||
        (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : '');
      let groupKey = '';
      if (item.type === 'summary') {
        groupKey = `summary_${dateKey}`;
      } else {
        groupKey = `${item.type}_${dateKey}_${item.title}_${(item.message || item.body || '').trim()}`;
      }
      if (seen.has(groupKey)) {
        count++;
      } else {
        seen.add(groupKey);
      }
    });
    return count;
  }, [notifications]);

  // Clean up duplicate notifications
  const handleCleanupDuplicates = async () => {
    setIsCleaningDuplicates(true);
    try {
      const res = await cleanupDuplicateNotifications();
      if (res.removedCount > 0) {
        setToastMsg({
          type: 'success',
          text: `${res.removedCount}件の重複通知を削除し、最新の1件にまとめました。`,
        });
      } else {
        setToastMsg({
          type: 'success',
          text: '重複している通知はありませんでした。',
        });
      }
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err) {
      console.error(err);
      setToastMsg({
        type: 'error',
        text: '重複通知の整理中にエラーが発生しました。',
      });
      setTimeout(() => setToastMsg(null), 3500);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  // Confirm delete all notifications
  const handleConfirmDeleteAll = async () => {
    setIsClearingAll(true);
    try {
      await clearAllNotifications();
      setShowDeleteAllConfirm(false);
      setToastMsg({
        type: 'success',
        text: 'すべての通知を削除しました。',
      });
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setToastMsg({
        type: 'error',
        text: '通知の全削除中にエラーが発生しました。',
      });
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);
    try {
      await markAllAsRead();
      setToastMsg({
        type: 'success',
        text: 'すべての通知を既読にしました。',
      });
      setTimeout(() => setToastMsg(null), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleCopyTodaySummary = async () => {
    const text = formatDailySummaryWithSections(
      settings?.clubName || '部活動',
      getTodayString(),
      attendances,
      members
    );
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedSummaryTop(true);
      setTimeout(() => setCopiedSummaryTop(false), 2500);
    }
  };

  const handleCopyNotificationText = async (text: string, id: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedNotifId(id);
      setTimeout(() => setCopiedNotifId(null), 2000);
    }
  };

  const isLwLinked = Boolean(settings.lineWorks?.enabled && settings.lineWorks?.webhookUrl);

  const handleTestSummary = async () => {
    setIsSendingTest(true);
    try {
      await triggerManualSummary();
      setTestSentSuccess(true);
      setTimeout(() => setTestSentSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRequestPermissionClick = async () => {
    setIsRequestingPerm(true);
    setToastMsg(null);
    try {
      const res = await requestNotificationPermission();
      if (res.success) {
        setToastMsg({
          type: 'success',
          text: 'プッシュ通知を許可しました！テスト通知を送信しました。',
        });
        setTimeout(() => setToastMsg(null), 4000);
      } else {
        // Did not succeed - open diagnostic modal with exact reason
        setGuideModalReason(res.reason || (res.isInIframe ? 'iframe' : 'error'));
        setGuideModalOpen(true);
      }
    } catch {
      setGuideModalReason('error');
      setGuideModalOpen(true);
    } finally {
      setIsRequestingPerm(false);
    }
  };

  const handleSendLocalTestClick = async () => {
    setIsSendingLocalTest(true);
    try {
      const res = await sendTestNotification();
      if (res.success) {
        setToastMsg({
          type: 'success',
          text: '端末にテスト通知を送信しました！画面上部または通知センターをご確認ください。',
        });
      } else {
        setToastMsg({
          type: 'error',
          text: res.error || 'テスト通知の送信に失敗しました',
        });
      }
      setTimeout(() => setToastMsg(null), 3500);
    } finally {
      setIsSendingLocalTest(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-4 pb-24 pt-2">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            届いた通知
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            遅刻の即時連絡や毎日のまとめ通知が届きます
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="btn-copy-today-summary-notif"
            onClick={handleCopyTodaySummary}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs ${
              copiedSummaryTop
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title="本日の出欠状況（区分別まとめ文章）をコピーしてLINEやチャットに共有"
          >
            {copiedSummaryTop ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>まとめ文章をコピーしました！</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>本日のまとめ文章をコピー</span>
              </>
            )}
          </button>
          {isAdmin && (
            <button
              type="button"
              id="btn-test-summary-notification"
              onClick={handleTestSummary}
              disabled={isSendingTest}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {isSendingTest ? '送信中...' : 'まとめ通知を今すぐテスト送信'}
            </button>
          )}
        </div>
      </div>

      {testSentSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>本日のまとめ通知を送信しました！{isLwLinked ? '（LINE WORKSトークルームにもBotから通知されました）' : ''}</span>
        </div>
      )}

      {toastMsg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* LINE WORKS Link Status Banner */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-slate-700 dark:text-slate-300 text-[11px] font-medium">
            {isLwLinked ? (
              <>
                <strong className="text-emerald-700 dark:text-emerald-400">LINE WORKS Bot連携中:</strong> 出欠サマリーや遅刻通知がLINE WORKSグループへも自動投稿されます
              </>
            ) : (
              <>
                <strong className="text-slate-600 dark:text-slate-400">LINE WORKS連携:</strong> 管理者設定からBotのWebhook URLを登録するとグループトークへ自動通知できます
              </>
            )}
          </span>
        </div>
        {isLwLinked && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            稼働中
          </span>
        )}
      </div>

      {/* Push Notification Status Banner */}
      {hasNotificationPermission ? (
        <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">端末のプッシュ通知: 有効</span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                遅刻連絡やまとめ通知がこの端末に即座に通知されます
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-test-local-notification"
              onClick={handleSendLocalTestClick}
              disabled={isSendingLocalTest}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Bell className="w-3 h-3" />
              {isSendingLocalTest ? '送信中...' : 'テスト通知'}
            </button>
            <button
              type="button"
              onClick={() => {
                setGuideModalReason(null);
                setGuideModalOpen(true);
              }}
              className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg text-xs cursor-pointer"
              title="通知設定ガイド"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : isInIframe ? (
        /* Inside iframe (AI Studio preview) notice with 1-click open in new tab */
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3.5 space-y-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">端末通知を有効にするには別タブで開いてください</span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  現在プレビュー画面（iframe）で表示されているため、ブラウザのセキュリティ制限により通知の許可ダイアログが開けません。別タブで開くと「許可」ボタンが正しく動作します。
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              id="btn-open-new-tab-for-notification"
              onClick={handleOpenInNewTab}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              別タブでアプリを開く
            </button>
            <button
              type="button"
              id="btn-open-guide-modal"
              onClick={() => {
                setGuideModalReason('iframe');
                setGuideModalOpen(true);
              }}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              設定ヘルプ・解説
            </button>
          </div>
        </div>
      ) : notificationStatus === 'denied' ? (
        /* Blocked / Denied in browser settings */
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold">ブラウザで通知がブロックされています</span>
              <p className="text-[11px] text-rose-800 dark:text-rose-300">
                アドレスバー左端の鍵マーク（🔒）から通知を「許可」に変更してください
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-show-denied-guide"
            onClick={() => {
              setGuideModalReason('denied');
              setGuideModalOpen(true);
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer"
          >
            解除手順
          </button>
        </div>
      ) : (
        /* Default: Request Permission banner */
        <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
            <Volume2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>端末のプッシュ通知を許可すると、遅刻連絡をすぐに受信できます</span>
          </div>
          <button
            type="button"
            id="btn-request-notification-perm"
            onClick={handleRequestPermissionClick}
            disabled={isRequestingPerm}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            {isRequestingPerm ? '確認中...' : '許可する'}
          </button>
        </div>
      )}

      {/* Duplicate warning banner if any duplicates exist */}
      {duplicateCount > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              重複している通知が <strong>{duplicateCount}件</strong> あります。最新の1件だけを残して整理できます。
            </span>
          </div>
          <button
            type="button"
            id="btn-auto-clean-duplicates"
            onClick={handleCleanupDuplicates}
            disabled={isCleaningDuplicates}
            className="self-end sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isCleaningDuplicates ? '整理中...' : '重複を削除'}</span>
          </button>
        </div>
      )}

      {/* Notifications List Section Header & Action Controls */}
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          通知一覧 ({notifications.length}件)
        </span>
        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-mark-all-read"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAllRead || notifications.every(n => n.isRead)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title="すべての通知を既読にします"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>既読にする</span>
            </button>
            <button
              type="button"
              id="btn-cleanup-duplicates"
              onClick={handleCleanupDuplicates}
              disabled={isCleaningDuplicates}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer border border-blue-200 dark:border-blue-900/60"
              title="同じ日付・内容の重複通知を削除し、最新1件を残します"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isCleaningDuplicates ? '整理中...' : '重複を整理'}</span>
            </button>
            <button
              type="button"
              id="btn-delete-all-notifications"
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={isClearingAll}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer border border-rose-200 dark:border-rose-900/60"
              title="すべての通知を一括削除します"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>すべて削除</span>
            </button>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2.5">
        {notifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-medium">現在、届いている通知はありません</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              当日に遅刻連絡が送信されたり、まとめ時刻になると通知が届きます。
            </p>
          </div>
        ) : (
          notifications.map((notif) => {
            const isReminder =
              notif.type === 'reminder' ||
              notif.title.includes('催促') ||
              (notif.message && notif.message.includes('【催促】'));
            const isUrgent = notif.type === 'urgent';
            const isSummary = notif.type === 'summary';
            const isKeyReport = !isReminder && notif.title.includes('鍵');

            const displayText = notif.message || notif.body || notif.title;

            // 報告者（施錠者・連絡送信者）の抽出
            let reporterName: string | null = (notif as any).operatorName || (notif as any).memberName || null;
            if (!reporterName) {
              const keyMatch = displayText.match(/報告者[:：]\s*([^\s(（]+?)(?:さん)?(?:\)|）|\s|$)/);
              if (keyMatch && keyMatch[1]) {
                reporterName = keyMatch[1];
              } else {
                const attMatch = displayText.match(/【[^】]+】\s*([^\s(（]+?)(?:さん)?\s*(?:[(（]|$|より)/);
                if (attMatch && attMatch[1] && !attMatch[1].includes('鍵') && !attMatch[1].includes('催促') && !attMatch[1].includes('連絡') && !attMatch[1].includes('部活動')) {
                  reporterName = attMatch[1];
                }
              }
            }

            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) markAsRead(notif.id);
                }}
                className={`rounded-2xl p-4 border transition-all flex items-start justify-between gap-3 relative cursor-pointer ${
                  !notif.isRead 
                    ? 'bg-white dark:bg-slate-900 ring-1 ring-blue-400/50 dark:ring-blue-600/50 shadow-sm' 
                    : 'bg-slate-50/50 dark:bg-slate-900/40 shadow-none border-slate-100 dark:border-slate-800'
                } ${
                  isReminder && !notif.isRead
                    ? 'border-amber-400 dark:border-amber-600/80 bg-gradient-to-r from-amber-50/80 via-amber-50/40 to-white dark:from-amber-950/40 dark:via-amber-950/20 dark:to-slate-900'
                    : isUrgent && !notif.isRead
                    ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20'
                    : isSummary && !notif.isRead
                    ? 'border-blue-200 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/20'
                    : isKeyReport && !notif.isRead
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : !notif.isRead
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-slate-200/60 dark:border-slate-800/60'
                }`}
              >
                {!notif.isRead && (
                  <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-blue-600 rounded-full shadow-sm animate-pulse" title="未読" />
                )}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      !notif.isRead ? (
                        isReminder
                          ? 'bg-amber-500 text-white shadow-xs'
                          : isUrgent
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                          : isSummary
                          ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                          : isKeyReport
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      ) : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 opacity-60'
                    }`}
                  >
                    {isReminder ? (
                      <BellRing className={`w-4 h-4 ${!notif.isRead ? 'animate-pulse' : ''}`} />
                    ) : isUrgent ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : isSummary ? (
                      <Sparkles className="w-4 h-4" />
                    ) : isKeyReport ? (
                      <Key className="w-4 h-4" />
                    ) : (
                      <Info className="w-4 h-4" />
                    )}
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${!notif.isRead ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500'}`}>
                        {notif.title}
                      </span>
                      {isReminder && !notif.isRead && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                          催促{notif.reminderCount ? ` (${notif.reminderCount}回目)` : ''}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    {/* 報告者名のハイライトバッジ */}
                    {reporterName && (
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold shadow-2xs ${
                        !notif.isRead 
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 opacity-70'
                      }`}>
                        <User className={`w-3.5 h-3.5 shrink-0 ${!notif.isRead ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`} />
                        <span className={`text-[10px] uppercase font-bold ${!notif.isRead ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                          {isKeyReport ? '施錠者' : '報告者'}:
                        </span>
                        <span className={`text-sm font-black ${!notif.isRead ? 'text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                          {reporterName}
                        </span>
                        <span className="text-[11px] font-bold">さん</span>
                      </div>
                    )}

                    <p className={`text-xs whitespace-pre-wrap leading-relaxed break-words ${
                      !notif.isRead ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-500 font-normal'
                    }`}>
                      {displayText}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    id={`btn-copy-notif-${notif.id}`}
                    onClick={() => handleCopyNotificationText(displayText, notif.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      copiedNotifId === notif.id
                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60'
                        : 'text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 bg-slate-100/80 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700'
                    }`}
                    title="文章をコピー（LINE WORKS・LINE共有用）"
                    aria-label="文章をコピー"
                  >
                    {copiedNotifId === notif.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>文章をコピー</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    id={`btn-dismiss-notification-${notif.id}`}
                    onClick={() => dismissNotification(notif.id)}
                    className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-1.5 shrink-0 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Notification Guide & Diagnostics Modal */}
      <NotificationGuideModal
        isOpen={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        reason={guideModalReason}
        onTestNotification={sendTestNotification}
      />

      {/* Delete All Notifications Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  すべての通知を削除しますか？
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  届いている通知（全 {notifications.length} 件）を完全に削除します。この操作は取り消せません。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                id="btn-cancel-delete-all"
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={isClearingAll}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                id="btn-confirm-delete-all"
                onClick={handleConfirmDeleteAll}
                disabled={isClearingAll}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingAll ? '削除中...' : 'すべて削除する'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
