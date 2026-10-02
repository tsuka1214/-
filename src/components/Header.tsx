import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Bell, User, CalendarDays, Settings } from 'lucide-react';
import { getTodayString, formatJapaneseDate } from '../utils/date';

export const Header: React.FC = () => {
  const {
    settings,
    isAdmin,
    myMemberName,
    notifications,
    setCurrentTab,
    currentTab,
  } = useApp();

  const todayStr = getTodayString();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs transition-colors duration-200">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* App Title & Today Info */}
        <div
          className="flex items-center space-x-2.5 cursor-pointer"
          onClick={() => setCurrentTab('home')}
          id="header-brand-link"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {settings?.clubName || '部活動'} 出欠連絡
              </h1>
              {isAdmin && (
                <span
                  id="header-admin-badge"
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  <Shield className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
                  管理者
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {formatJapaneseDate(todayStr, false)}
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-2">
          {/* User Name Pill */}
          <button
            id="header-user-button"
            onClick={() => setCurrentTab('settings')}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[130px] truncate"
            title="名前・設定を変更"
          >
            <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="truncate">{myMemberName || '未設定'}</span>
          </button>

          {/* Notifications Bell */}
          <button
            id="header-notification-button"
            onClick={() => setCurrentTab('notifications')}
            className={`relative p-2 rounded-lg transition-colors ${
              currentTab === 'notifications'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="通知"
            aria-label="通知一覧"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                id="header-notification-count"
                className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {/* Settings gear shortcut */}
          <button
            id="header-settings-button"
            onClick={() => setCurrentTab('settings')}
            className={`p-2 rounded-lg transition-colors ${
              currentTab === 'settings'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="設定・アプリ化 (PWA)"
            aria-label="設定画面を開く"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
