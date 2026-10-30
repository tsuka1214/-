import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Users, Send, Bell, Calendar } from 'lucide-react';

export const Navigation: React.FC = () => {
  const { currentTab, setCurrentTab, notifications } = useApp();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-30 bg-[#0b1120]/95 backdrop-blur-md border-t border-slate-800 pb-safe transition-colors shadow-2xl">
      <div className="grid grid-cols-5 items-center px-1 h-16 relative">
        {/* 1. ホーム */}
        <button
          type="button"
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            currentTab === 'home'
              ? 'text-blue-500 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 ${currentTab === 'home' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1">ホーム</span>
        </button>

        {/* 2. みんなの状況 */}
        <button
          type="button"
          onClick={() => setCurrentTab('status')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            currentTab === 'status'
              ? 'text-blue-500 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <Users className={`w-5 h-5 ${currentTab === 'status' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1">みんなの状況</span>
        </button>

        {/* 3. 中央の青い浮き出た円形「連絡する」ボタン */}
        <button
          type="button"
          onClick={() => setCurrentTab('form')}
          className="relative -top-3.5 flex flex-col items-center justify-center cursor-pointer group focus:outline-hidden"
          title="出欠連絡を入力"
        >
          <div
            className={`w-13 h-13 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 ${
              currentTab === 'form'
                ? 'bg-blue-600 text-white ring-4 ring-blue-500/30 scale-105 shadow-blue-500/50'
                : 'bg-blue-600 text-white shadow-blue-600/40 hover:bg-blue-500'
            }`}
          >
            <Send className="w-6 h-6 stroke-[2.3] -rotate-12 -translate-x-0.5 -translate-y-0.5" />
          </div>
          <span
            className={`text-[10px] mt-0.5 font-bold ${
              currentTab === 'form' ? 'text-blue-400' : 'text-slate-400'
            }`}
          >
            連絡する
          </span>
        </button>

        {/* 4. 通知 */}
        <button
          type="button"
          onClick={() => setCurrentTab('notifications')}
          className={`relative flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            currentTab === 'notifications'
              ? 'text-blue-500 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <Bell className={`w-5 h-5 ${currentTab === 'notifications' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">通知</span>
        </button>

        {/* 5. イベント */}
        <button
          type="button"
          onClick={() => setCurrentTab('calendar')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            currentTab === 'calendar'
              ? 'text-blue-500 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <Calendar className={`w-5 h-5 ${currentTab === 'calendar' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1">イベント</span>
        </button>
      </div>
    </nav>
  );
};
