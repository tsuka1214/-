import React from 'react';
import { useApp } from '../context/AppContext';
import { Bell, CheckCheck, Trash2, Calendar, Key, AlertTriangle } from 'lucide-react';
import { formatTimestamp } from '../utils/date';

export const NotificationScreen: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead, clearAllNotifications, dismissNotification, myMemberName } = useApp();

  const effectiveUserName = (
    myMemberName &&
    myMemberName.trim() !== '' &&
    myMemberName.trim() !== '部員' &&
    myMemberName.trim() !== '名前未登録' &&
    myMemberName.trim() !== '齋藤凌吾'
  )
    ? myMemberName.trim()
    : '今江司';

  const formatNotificationText = (text: string): string => {
    if (!text) return text;
    return text
      .replace(/齋藤凌吾 さん/g, `あなた（${effectiveUserName} さん）`)
      .replace(/齋藤凌吾/g, effectiveUserName)
      .replace(/部員 さん/g, `あなた（${effectiveUserName} さん）`);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            通知一覧
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            鍵の催促や連絡の速報履歴
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={markAllAsRead}
              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3 h-3" />
              すべて既読
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('すべての通知を削除しますか？')) {
                  clearAllNotifications();
                }
              }}
              className="p-1 rounded-xl text-slate-400 hover:text-red-500 cursor-pointer"
              title="全削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
          通知はありません
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markAsRead(n.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                n.isRead
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-75'
                  : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {n.title.includes('鍵') ? (
                    <Key className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : n.title.includes('緊急') ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  ) : (
                    <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {formatNotificationText(n.title)}
                  </h3>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  )}
                </div>

                <span className="text-[10px] text-slate-400 shrink-0">
                  {formatTimestamp(n.createdAt)}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                {formatNotificationText(n.message)}
              </p>

              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(n.id);
                  }}
                  className="text-[10px] text-slate-400 hover:text-red-500"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
