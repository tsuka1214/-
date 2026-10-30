import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, Shield, User, Bell, Settings } from 'lucide-react';
import { formatJapaneseDate, getTodayString } from '../utils/date';
import { MemberProfileModal } from './MemberProfileModal';

export const Header: React.FC = () => {
  const {
    isAdmin,
    loginAdmin,
    logoutAdmin,
    myMemberName,
    notifications,
    setCurrentTab,
  } = useApp();

  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const todayStr = getTodayString();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleAdminClick = () => {
    if (isAdmin) {
      if (window.confirm('管理者モードをログアウトしますか？')) {
        logoutAdmin();
      }
    } else {
      const code = window.prompt('管理者パスコードを入力してください:');
      if (code) {
        if (loginAdmin(code)) {
          alert('管理者としてログインしました');
        } else {
          alert('パスコードが一致しません');
        }
      }
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#0b1120]/95 backdrop-blur-md border-b border-slate-800 transition-colors">
        <div className="w-full px-4 py-3 flex items-center justify-between">
          {/* 左側: 青いカレンダーアイコン + 部活動 出欠連絡 + 日付 */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30 shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-white leading-tight">
                部活動 出欠<br />連絡
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                {formatJapaneseDate(todayStr, false)}
              </p>
            </div>
          </div>

          {/* 右側: 管理者バッジ + 報告者名バッジ + 通知ベル(赤バッジ) + 設定ギア */}
          <div className="flex items-center gap-2">
            {/* 管理者バッジ */}
            <button
              type="button"
              onClick={handleAdminClick}
              className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                isAdmin
                  ? 'bg-blue-950/80 border border-blue-500/60 text-blue-300 shadow-xs'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
              title={isAdmin ? '管理者モード中（タップでログアウト）' : '管理者ログイン'}
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>管理者</span>
            </button>

            {/* 報告者名バッジ */}
            <button
              type="button"
              onClick={() => setShowNameModal(true)}
              className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-700/80 transition-colors cursor-pointer max-w-[110px]"
              title="名前・パート設定"
            >
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{myMemberName || '今江司'}</span>
            </button>

            {/* 通知ベル (赤バッジ付き) */}
            <button
              type="button"
              onClick={() => setCurrentTab('notifications')}
              className="relative p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="通知"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* 設定アイコン */}
            <button
              type="button"
              onClick={() => setCurrentTab('settings')}
              className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="設定"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 名前変更モーダル */}
      <MemberProfileModal
        isOpen={showNameModal}
        onClose={() => setShowNameModal(false)}
      />
    </>
  );
};
