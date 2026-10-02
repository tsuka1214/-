import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { FormScreen } from './components/FormScreen';
import { StatusScreen } from './components/StatusScreen';
import { NotificationScreen } from './components/NotificationScreen';
import { SettingsScreen } from './components/SettingsScreen';
import EventsView from './components/EventsView';
import { SplashScreen } from './components/SplashScreen';
import { TutorialScreen } from './components/TutorialScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Loader2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const { 
    currentTab, 
    isLoading, 
    settings, 
    showSplashScreen, 
    dismissSplashScreen, 
    myMemberPart,
    showTutorial,
    dismissTutorial
  } = useApp();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-950 flex flex-col items-center justify-center z-50 transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <div className="absolute inset-0 bg-blue-600/10 rounded-full animate-ping opacity-20"></div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">
              データを同期中...
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              Firestoreから最新の設定を読み込んでいます
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-200 dark:selection:bg-blue-900 transition-colors duration-200">
      {showSplashScreen && (
        <SplashScreen
          onFinish={dismissSplashScreen}
          clubName={settings?.clubName || '吹奏楽部'}
          memberPart={myMemberPart}
          duration={1800}
        />
      )}

      {showTutorial && !showSplashScreen && (
        <TutorialScreen onFinish={dismissTutorial} />
      )}

      <Header />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-3 pb-24">
        {currentTab === 'home' && <HomeScreen />}
        {currentTab === 'form' && <FormScreen />}
        {currentTab === 'status' && <StatusScreen />}
        {currentTab === 'notifications' && <NotificationScreen />}
        {currentTab === 'events' && <EventsView />}
        {currentTab === 'settings' && <SettingsScreen />}
      </main>

      <Navigation />
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

