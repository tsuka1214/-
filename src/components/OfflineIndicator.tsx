import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-white shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <WifiOff className="w-4 h-4" />
      <span>オフラインモード - キャッシュされたデータを使用中</span>
    </div>
  );
};
