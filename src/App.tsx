import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { StatusScreen } from './components/StatusScreen';
import { FormScreen } from './components/FormScreen';
import { EventsView } from './components/EventsView';
import { NotificationScreen } from './components/NotificationScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { UpdateToast } from './components/UpdateToast';

const MainContent: React.FC = () => {
  const { currentTab, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-bold mt-3">データを読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] flex justify-center text-slate-100 transition-colors">
      <div className="w-full max-w-[480px] min-h-screen bg-[#0b1120] flex flex-col shadow-2xl relative border-x border-slate-800 mx-auto">
        <Header />
        <UpdateToast />
        <main className="flex-1 w-full p-4 pb-28">
          {currentTab === 'home' && <HomeScreen />}
          {currentTab === 'status' && <StatusScreen />}
          {currentTab === 'form' && <FormScreen />}
          {currentTab === 'calendar' && <EventsView />}
          {currentTab === 'notifications' && <NotificationScreen />}
          {currentTab === 'settings' && <SettingsScreen />}
        </main>
        <Navigation />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
};

export default App;
