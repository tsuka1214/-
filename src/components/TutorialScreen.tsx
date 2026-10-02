import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  Music,
  Check,
  Calendar,
  Key as KeyIcon,
  Bell,
  Settings,
  Shield,
  User,
  List,
  Smartphone,
  CheckCircle,
  Download,
} from 'lucide-react';

interface TutorialPage {
  id: string;
  title: string;
  description: string;
  renderIllustration: () => React.ReactNode;
}

// 共通のスマホ枠コンポーネント
const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-48 h-80 sm:w-56 sm:h-96 rounded-[2.5rem] border-[6px] border-slate-800 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl relative overflow-hidden flex flex-col mx-auto transition-colors">
    {/* スピーカー/ノッチ */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-800 dark:bg-slate-700 rounded-b-xl z-10" />
    <div className="flex-1 flex flex-col p-3 pt-6">
      {children}
    </div>
    {/* ホームインジケーター */}
    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full" />
  </div>
);

// プレースホルダー用のグレーの線
const PlaceholderLine = ({ className = "w-full", height = "h-1.5" }) => (
  <div className={`${className} ${height} bg-slate-100 dark:bg-slate-800 rounded-full`} />
);

const PAGES: TutorialPage[] = [
  {
    id: 'welcome',
    title: '吹奏楽部 出欠連絡へようこそ',
    description: 'このアプリは、部活動の出欠連絡・鍵の報告・通知を、スマホから簡単に共有できるツールです。まずは使い方を見てみましょう。',
    renderIllustration: () => (
      <PhoneFrame>
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-[2rem] bg-blue-600 flex items-center justify-center shadow-2xl relative z-10">
              <Music className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 bg-blue-600/30 rounded-[2rem] blur-xl animate-pulse" />
          </div>
          <div className="space-y-3 w-full px-6">
            <div className="h-4 w-3/4 bg-blue-600/20 rounded-full mx-auto" />
            <div className="h-2 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto" />
          </div>
        </div>
      </PhoneFrame>
    ),
  },
  {
    id: 'profile',
    title: 'まずは自分の情報を登録',
    description: '設定画面で、自分の名前とパート（楽器）を登録します。一度登録すれば、次回から自動で入力されます。',
    renderIllustration: () => (
      <PhoneFrame>
        <div className="space-y-5 pt-3 px-1">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-500" />
            </div>
            <PlaceholderLine className="w-24" height="h-2" />
          </div>
          <div className="space-y-4">
            {[
              { label: 'お名前', width: 'w-16' },
              { label: '区分', width: 'w-12' },
              { label: 'パート', width: 'w-14' }
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <PlaceholderLine className={item.width} height="h-1" />
                <div className="h-9 w-full border border-slate-200 dark:border-slate-800 rounded-xl flex items-center px-3 justify-between">
                  <PlaceholderLine className="w-1/2" height="h-1.5" />
                  <ChevronDown className="w-3 h-3 text-slate-300" />
                </div>
              </div>
            ))}
            <div className="h-10 w-full bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center">
              <div className="w-20 h-2 bg-white/40 rounded-full" />
            </div>
          </div>
        </div>
      </PhoneFrame>
    ),
  },
  {
    id: 'form',
    title: '出欠連絡を送る',
    description: '画面下の「連絡する」ボタンから、日付と区分（欠席・遅刻・緊急遽刻・早退）を選んで送信します。理由も任意で入力できます。',
    renderIllustration: () => (
      <PhoneFrame>
        <div className="space-y-5 pt-2">
          <div className="h-10 w-full border border-slate-200 dark:border-slate-800 rounded-xl flex items-center px-3 bg-slate-50 dark:bg-slate-800/50">
            <Calendar className="w-4 h-4 text-blue-600 mr-3" />
            <PlaceholderLine className="w-24" height="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-10 rounded-xl border flex items-center justify-center ${
                i === 1 
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-600' 
                  : 'border-slate-200 dark:border-slate-800'
              }`}>
                <div className={`h-1.5 rounded-full ${i === 1 ? 'w-12 bg-blue-600' : 'w-10 bg-slate-200 dark:bg-slate-800'}`} />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <PlaceholderLine className="w-16" height="h-1" />
            <div className="h-20 w-full border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50">
              <div className="space-y-2">
                <PlaceholderLine className="w-3/4" />
                <PlaceholderLine className="w-1/2" />
              </div>
            </div>
          </div>
          <div className="h-11 w-full bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-center">
             <Check className="w-4 h-4 text-white/80 mr-2" />
             <div className="w-16 h-2 bg-white/40 rounded-full" />
          </div>
        </div>
      </PhoneFrame>
    ),
  },
  {
    id: 'status',
    title: 'みんなの状況を見る',
    description: '「みんなの状況」タブでは、誰が休みか・遅刻かを一覧で確認できます。カレンダー表示に切り替えれば、月ごとの予定も一目で分かります。',
    renderIllustration: () => (
      <PhoneFrame>
        <div className="space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <div className="flex-1 h-8 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center">
               <div className="w-10 h-1.5 bg-blue-600 rounded-full" />
            </div>
            <div className="flex-1 flex items-center justify-center">
               <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center gap-3 bg-white dark:bg-slate-900 shadow-sm">
                <div className={`w-10 h-10 rounded-[0.8rem] flex items-center justify-center ${
                  i === 1 ? 'bg-rose-100 text-rose-600' : 
                  i === 2 ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <User className="w-5 h-5 opacity-60" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <PlaceholderLine className="w-16" height="h-2" />
                    <PlaceholderLine className="w-8" height="h-1.5" />
                  </div>
                  <PlaceholderLine className="w-24" height="h-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PhoneFrame>
    ),
  },
  {
    id: 'key',
    title: '鍵の報告',
    description: 'ホーム画面の鍵の報告カードから、鍵①と鍵②の閉め報告ができます。設定時刻までに報告がないと、自動で催促通知が届きます。',
    renderIllustration: () => (
      <PhoneFrame>
        <div className="pt-4">
          <div className="p-4 border-2 border-blue-500/20 dark:border-blue-500/40 rounded-[2rem] space-y-5 bg-blue-50/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 rounded-lg text-white">
                  <KeyIcon className="w-3.5 h-3.5" />
                </div>
                <PlaceholderLine className="w-20" height="h-2" />
              </div>
              <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                 <div className="w-2 h-2 rounded-full bg-blue-600" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-11 w-full bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2">
                 <Check className="w-4 h-4 text-white" />
                 <div className="w-16 h-2 bg-white/40 rounded-full" />
              </div>
              <div className="h-11 w-full border-2 border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center group">
                 <div className="w-16 h-2 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>
            </div>
            <div className="flex justify-center gap-4">
               <div className="w-1/3 h-1 bg-slate-100 dark:bg-slate-800 rounded-full" />
               <div className="w-1/4 h-1 bg-slate-100 dark:bg-slate-800 rounded-full" />
            </div>
          </div>
        </div>
      </PhoneFrame>
    ),
  },
  {
    id: 'notification',
    title: '通知を確認する',
    description: '「通知」タブでは、本日の出欠まとめや鍵の催促通知を確認できます。重要な連絡を見逃さないようにしましょう。',
    renderIllustration: () => (
      <PhoneFrame>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <PlaceholderLine className="w-16" height="h-2" />
            </div>
            <div className="w-8 h-4 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
               <div className="w-4 h-1 bg-blue-600 rounded-full" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`p-3 rounded-2xl space-y-2 border ${
                i === 1 ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-blue-600 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    <PlaceholderLine className="w-24" height="h-1.5" />
                  </div>
                  <PlaceholderLine className="w-8" height="h-1" />
                </div>
                <div className="pl-3.5 space-y-1.5">
                  <PlaceholderLine className="w-full" height="h-1" />
                  <PlaceholderLine className="w-2/3" height="h-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PhoneFrame>
    ),
  },
  {
    id: 'admin',
    title: '管理者の方は',
    description: '部長や顧問の方は、設定画面から合言葉を入力すると管理者モードになります。通知時刻の設定や合言葉の変更ができます。',
    renderIllustration: () => (
      <PhoneFrame>
        <div className="space-y-5 pt-3">
          <div className="p-4 bg-blue-900 rounded-[1.5rem] flex items-center gap-4 shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center shadow-inner">
               <Shield className="w-6 h-6 text-blue-300" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="w-20 h-2 bg-white/30 rounded-full" />
              <div className="w-24 h-1.5 bg-white/10 rounded-full" />
            </div>
          </div>
          <div className="space-y-4 px-1">
            <div className="space-y-2">
              <PlaceholderLine className="w-16" height="h-1" />
              <div className="h-9 w-full border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center px-3">
                <PlaceholderLine className="w-3/4" height="h-1.5" />
              </div>
            </div>
            <div className="space-y-2">
              <PlaceholderLine className="w-20" height="h-1" />
              <div className="h-9 w-full border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center px-3">
                 <div className="flex gap-1">
                   {[1,2,3,4,5].map(j => <div key={j} className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />)}
                 </div>
              </div>
            </div>
            <div className="h-10 w-full bg-slate-800 dark:bg-slate-700 rounded-xl shadow-lg flex items-center justify-center">
              <div className="w-24 h-2 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </PhoneFrame>
    ),
  },
  {
    id: 'pwa',
    title: 'ホーム画面に追加',
    description: 'アプリとしてホーム画面に追加すると、全画面で使いやすく、通知も確実に届くようになります。ぜひ追加して使ってみてください！',
    renderIllustration: () => (
      <PhoneFrame>
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 pt-4">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center">
             <Smartphone className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-3 w-full px-4">
            <div className="h-10 w-full bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-white" />
              <div className="w-20 h-2 bg-white/40 rounded-full" />
            </div>
            <p className="text-[10px] text-slate-400 text-center font-bold">
              ワンタップでインストール完了
            </p>
          </div>
          <div className="w-full space-y-2 px-6 opacity-40">
            <PlaceholderLine className="w-full" />
            <PlaceholderLine className="w-3/4" />
          </div>
        </div>
      </PhoneFrame>
    ),
  },
];

interface TutorialScreenProps {
  onFinish: () => void;
}

export const TutorialScreen: React.FC<TutorialScreenProps> = ({ onFinish }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();

  const handleNext = async () => {
    if (currentPage < PAGES.length - 1) {
      setDirection(1);
      setCurrentPage((prev) => prev + 1);
    } else {
      onFinish();
    }
  };

  const handleInstallInTutorial = async () => {
    const success = await promptInstall();
    if (success) {
      // Small delay to show success state before finishing
      setTimeout(onFinish, 1000);
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  const page = PAGES[currentPage];

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col items-center justify-between p-6 sm:p-10 safe-top safe-bottom">
      {/* Header */}
      <div className="w-full flex justify-end z-20">
        <button
          type="button"
          onClick={handleSkip}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-sm font-bold p-2 cursor-pointer"
        >
          <span>スキップ</span>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center overflow-hidden relative z-10">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentPage}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-6 sm:space-y-10 px-4"
          >
            {/* Miniature Illustration */}
            <div className="w-full pointer-events-none">
              {page.renderIllustration()}
            </div>

            {/* Text Content */}
            <div className="space-y-4 max-w-sm">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 leading-tight">
                {page.title}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                {page.description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer / Controls */}
      <div className="w-full max-w-md space-y-6 pb-4 z-20">
        {/* Progress Dots */}
        <div className="flex justify-center gap-2">
          {PAGES.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentPage
                  ? 'w-6 bg-blue-600'
                  : 'w-1.5 bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-4">
          {currentPage > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-12" />
          )}

          <button
            type="button"
            onClick={
              currentPage === PAGES.length - 1 && isInstallable && !isInstalled
                ? handleInstallInTutorial
                : handleNext
            }
            className={`flex-1 h-14 rounded-2xl font-black text-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
              currentPage === PAGES.length - 1
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <span>
              {currentPage === PAGES.length - 1 
                ? (isInstalled ? 'はじめる' : isInstallable ? 'ホーム画面に追加して開始' : 'はじめる') 
                : '次へ'}
            </span>
            {currentPage < PAGES.length - 1 && <ChevronRight className="w-6 h-6" />}
            {currentPage === PAGES.length - 1 && !isInstalled && isInstallable && <Download className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
