import React from 'react';
import { useApp } from '../context/AppContext';
import { TabType } from '../types';
import { Home, Send, Users, Bell, Settings, Calendar } from 'lucide-react';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const Navigation: React.FC = () => {
  const { currentTab, setCurrentTab, notifications } = useApp();

  const navItems: NavItem[] = [
    { id: 'home', label: 'ホーム', icon: Home },
    { id: 'status', label: 'みんなの状況', icon: Users },
    { id: 'form', label: '連絡する', icon: Send },
    {
      id: 'notifications',
      label: '通知',
      icon: Bell,
      badge: notifications.filter((n) => !n.isRead).length || undefined,
    },
    { id: 'events', label: 'イベント', icon: Calendar },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] shadow-lg transition-colors duration-200">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-1 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isSend = item.id === 'form';

          if (isSend) {
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setCurrentTab(item.id)}
                className="flex flex-col items-center justify-center -mt-4 group relative"
                aria-label={item.label}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-transform group-active:scale-95 ${
                    isActive
                      ? 'bg-blue-700 text-white ring-4 ring-blue-100 dark:ring-blue-900/60'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Icon className="w-5 h-5 ml-0.5" />
                </div>
                <span
                  className={`text-[11px] font-bold mt-1 tracking-tight ${
                    isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => setCurrentTab(item.id)}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center relative transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-normal'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge && item.badge > 0 ? (
                  <span
                    id={`nav-badge-${item.id}`}
                    className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-3.5 text-center leading-none py-0.5"
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] mt-1 tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
