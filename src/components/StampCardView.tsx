import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { EmergencyStampCard, ClubMember } from '../types';
import { getTodayString } from '../utils/date';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Search,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Check,
  X,
  Shield,
  Smile,
  User,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { PenaltyOverlay } from './PenaltyOverlay';

interface StampCardViewProps {
  onBackToStatus?: () => void;
}

type FilterOption = 'all' | 'has_stamps' | 'penalty_ready' | 'me';
type SortOption = 'total_desc' | 'month_desc' | 'name_asc';

export const StampCardView: React.FC<StampCardViewProps> = () => {
  const {
    members,
    stampCards,
    myMemberName,
    setMyMemberName,
    isAdmin,
    resetMemberStamps,
    resetAllMonthlyStamps,
    syncStampsFromAttendances,
    triggerStampEffect,
    setTriggerStampEffect,
    justReachedPenaltyStage,
    setJustReachedPenaltyStage,
    settings,
  } = useApp();

  const [showPlusOne, setShowPlusOne] = useState(false);
  const [isHighlighting, setIsHighlighting] = useState(false);

  const today = getTodayString();
  const currentMonthKey = today.slice(0, 7); // "YYYY-MM"
  const currentYear = today.split('-')[0];
  const currentMonth = today.split('-')[1];

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [sortOption, setSortOption] = useState<SortOption>('total_desc');
  const [showExplanation, setShowExplanation] = useState(false);

  // Admin reset dialog state
  const [resetTarget, setResetTarget] = useState<{
    card: EmergencyStampCard;
    type: 'total' | 'month';
  } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Admin monthly reset all dialog state
  const [showResetAllMonthDialog, setShowResetAllMonthDialog] = useState(false);
  const [isResettingAllMonth, setIsResettingAllMonth] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Build merged member cards list
  const mergedCards: EmergencyStampCard[] = useMemo(() => {
    const cardMap = new Map<string, EmergencyStampCard>();

    // 1. Map existing Firestore stamp cards
    stampCards.forEach((c) => {
      cardMap.set(c.memberName, c);
    });

    // 2. Ensure all registered club members exist in the list
    members.forEach((m) => {
      if (!cardMap.has(m.name)) {
        cardMap.set(m.name, {
          id: encodeURIComponent(m.name).replace(/\./g, '%2E'),
          memberName: m.name,
          section: m.section,
          part: m.part,
          totalCount: 0,
          monthlyCounts: {},
          penaltyGame: '',
          milestonesNotified: [],
          updatedAt: 0,
        });
      } else {
        // Update section and part if missing in card
        const card = cardMap.get(m.name)!;
        if (!card.section && m.section) card.section = m.section;
        if (!card.part && m.part) card.part = m.part;
      }
    });

    return Array.from(cardMap.values());
  }, [members, stampCards]);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let list = [...mergedCards];

    // Filter by search query (name or part or section)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.memberName.toLowerCase().includes(q) ||
          (c.part && c.part.toLowerCase().includes(q)) ||
          (c.section && c.section.toLowerCase().includes(q)) ||
          (c.penaltyGame && c.penaltyGame.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (filterOption === 'has_stamps') {
      list = list.filter((c) => c.totalCount > 0);
    } else if (filterOption === 'penalty_ready') {
      list = list.filter((c) => c.totalCount >= 3);
    } else if (filterOption === 'me') {
      list = list.filter((c) => c.memberName === myMemberName);
    }

    // Sort (自分のスタンプカードを常に最優先で先頭に配置)
    list.sort((a, b) => {
      if (myMemberName) {
        const aIsMe = a.memberName === myMemberName;
        const bIsMe = b.memberName === myMemberName;
        if (aIsMe && !bIsMe) return -1;
        if (!aIsMe && bIsMe) return 1;
      }

      if (sortOption === 'total_desc') {
        return b.totalCount - a.totalCount || a.memberName.localeCompare(b.memberName, 'ja');
      } else if (sortOption === 'month_desc') {
        const countA = a.monthlyCounts?.[currentMonthKey] || 0;
        const countB = b.monthlyCounts?.[currentMonthKey] || 0;
        return countB - countA || b.totalCount - a.totalCount || a.memberName.localeCompare(b.memberName, 'ja');
      } else if (sortOption === 'name_asc') {
        return a.memberName.localeCompare(b.memberName, 'ja');
      }
      return 0;
    });

    return list;
  }, [mergedCards, searchQuery, filterOption, sortOption, myMemberName, currentMonthKey]);

  // Overall statistics
  const stats = useMemo(() => {
    const minThreshold = settings.penaltyStages?.length 
      ? Math.min(...settings.penaltyStages.map(s => s.threshold))
      : (settings.penaltyThreshold || 3);
    const totalMembers = mergedCards.length;
    const membersWithStamps = mergedCards.filter((c) => c.totalCount > 0).length;
    const membersWithPenaltyReady = mergedCards.filter((c) => c.totalCount >= minThreshold).length;
    const totalMonthlyStamps = mergedCards.reduce(
      (sum, c) => sum + (c.monthlyCounts?.[currentMonthKey] || 0),
      0
    );
    const totalAllTimeStamps = mergedCards.reduce((sum, c) => sum + (c.totalCount || 0), 0);

    return {
      totalMembers,
      membersWithStamps,
      membersWithPenaltyReady,
      totalMonthlyStamps,
      totalAllTimeStamps,
    };
  }, [mergedCards, currentMonthKey]);

  // Helper for visual stage styling
  const getStageInfo = (count: number) => {
    const sortedStages = [...(settings.penaltyStages || [])]
      .sort((a, b) => b.threshold - a.threshold);
    
    const activeStage = sortedStages.find(s => count >= s.threshold);

    if (count >= 10 || (activeStage && activeStage.threshold >= 10)) {
      return {
        stage: 'legendary' as const,
        emoji: '🔥',
        label: activeStage ? `${activeStage.label || '罰ゲーム'} (${count}回)` : `要注意 (${count}回以上)`,
        cardBg: 'bg-red-50/90 dark:bg-red-950/40 border-red-300 dark:border-red-800/80 shadow-md ring-1 ring-red-400/40',
        badgeClass: 'bg-red-600 text-white font-black shadow-xs',
        stampClass: 'bg-red-600 text-white shadow-xs border-red-700',
        accentColor: 'text-red-700 dark:text-red-400',
        bubbleBg: 'bg-white/95 dark:bg-slate-900 border-red-200 dark:border-red-900/60',
        description: activeStage?.description || 'まだ罰ゲームはありません',
      };
    }
    if (count >= 6 || (activeStage && activeStage.threshold >= 6)) {
      return {
        stage: 'heavy_danger' as const,
        emoji: '😰',
        label: activeStage ? `${activeStage.label || '罰ゲーム'} (${count}回)` : `警告 (${count}回以上)`,
        cardBg: 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800/70 shadow-xs',
        badgeClass: 'bg-orange-500 text-white font-bold',
        stampClass: 'bg-orange-500 text-white shadow-xs border-orange-600',
        accentColor: 'text-orange-700 dark:text-orange-400',
        bubbleBg: 'bg-white/95 dark:bg-slate-900 border-orange-200 dark:border-orange-900/60',
        description: activeStage?.description || 'まだ罰ゲームはありません',
      };
    }
    if (activeStage) {
      return {
        stage: 'slight_danger' as const,
        emoji: '😅',
        label: `${activeStage.label || '罰ゲーム'} (${count}回)`,
        cardBg: 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/70 shadow-xs',
        badgeClass: 'bg-amber-500 text-white font-bold',
        stampClass: 'bg-amber-500 text-white shadow-xs border-amber-600',
        accentColor: 'text-amber-700 dark:text-amber-400',
        bubbleBg: 'bg-white/95 dark:bg-slate-900 border-amber-200 dark:border-amber-900/60',
        description: activeStage.description || 'まだ罰ゲームはありません',
      };
    }
    return {
      stage: 'normal' as const,
      emoji: '😐',
      label: '通常',
      cardBg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold',
      stampClass: 'bg-blue-600 text-white shadow-xs border-blue-700',
      accentColor: 'text-blue-700 dark:text-blue-400',
      bubbleBg: 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800',
      description: 'まだ罰ゲームはありません',
    };
  };

  // Confirm and execute reset for specific user
  const handleConfirmReset = async () => {
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      await resetMemberStamps(resetTarget.card.memberName, resetTarget.type, currentMonthKey);
      setResetTarget(null);
    } catch (err) {
      console.error('Failed to reset member stamps:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Confirm and execute reset for all users this month
  const handleConfirmResetAllMonth = async () => {
    setIsResettingAllMonth(true);
    try {
      await resetAllMonthlyStamps(currentMonthKey);
      setShowResetAllMonthDialog(false);
    } catch (err) {
      console.error('Failed to reset monthly stamps for all:', err);
    } finally {
      setIsResettingAllMonth(false);
    }
  };

  // Sync stamps from existing attendance history
  const handleSyncFromAttendances = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncStampsFromAttendances();
      setSyncFeedback(`過去の履歴から ${res.updatedCount} 名分のスタンプを同期・更新しました。`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to sync stamps:', err);
      setSyncFeedback('同期中にエラーが発生しました。');
    } finally {
      setIsSyncing(false);
    }
  };

  // 【追加要件】緊急遽刻後の自動演出
  useEffect(() => {
    if (triggerStampEffect && myMemberName) {
      const runEffect = async () => {
        // 1. 自分のカードまでスクロール
        const myCardId = `stamp-card-${encodeURIComponent(myMemberName).replace(/\./g, '%2E')}`;
        const element = document.getElementById(myCardId);
        
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // 2. 「+1」アニメーションとハイライト開始
        setTimeout(() => {
          setShowPlusOne(true);
          setIsHighlighting(true);
          
          // 3. マイルストーンチェック（3, 5, 10）
          const myCard = mergedCards.find(c => c.memberName === myMemberName);
          if (myCard) {
            const currentCount = myCard.totalCount;
            if (currentCount === 3 || currentCount === 5 || currentCount === 10) {
              // 紙吹雪
              confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#2563eb', '#f59e0b', '#e11d48', '#10b981']
              });
            }
          }
        }, 600);

        // 4. エフェクト終了とリセット
        setTimeout(() => {
          setShowPlusOne(false);
          setIsHighlighting(false);
          setTriggerStampEffect(false);
        }, 3500);
      };

      runEffect();
    }
  }, [triggerStampEffect, myMemberName, mergedCards, setTriggerStampEffect]);

  return (
    <div className="space-y-4">
      {/* 1. Header Banner & Rule Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎫</span>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                負のスタンプカード（緊急遽刻）
              </h2>
            </div>
            <p className="text-xs text-blue-100 font-medium leading-relaxed">
              緊急遽刻の回数に応じて溜まるスタンプカードです。3個溜まったら本人が自分で軽い罰ゲームを設定できます！
            </p>
          </div>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors text-xs flex items-center gap-1 font-semibold shrink-0"
            title="ルール説明"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">ルール</span>
            {showExplanation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible rule explanation */}
        {showExplanation && (
          <div className="mt-3 pt-3 border-t border-white/20 text-xs text-blue-50 space-y-2 leading-relaxed">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>📌</span> スタンプカードのルール
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-blue-100">
              <li>
                <strong>スタンプの蓄積:</strong> 「緊急遽刻」の連絡を送信するたびにスタンプが1つ増えます。
              </li>
              <li>
                <strong>スタンプ段階:</strong> 0〜2個 (😐通常) → 3〜5個 (😅注意) → 6〜9個 (😰警告) → 10個以上 (🔥要注意)
              </li>
              <li>
                <strong>罰ゲームの自動適用:</strong> スタンプが貯まると、管理者が設定した罰ゲーム内容が自動的に表示されます。
              </li>
              <li>
                <strong>マイルストーン通知:</strong> 特定の個数に初めて達した時、部員全員にお知らせが届きます。
              </li>
              <li>
                <strong>管理機能:</strong> 部員の累計リセットや、月ごとのリセットは管理者のみ実行できます。
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>📅</span> 今月 ({currentYear}年{Number(currentMonth)}月)
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalMonthlyStamps}
            <span className="text-xs font-semibold text-slate-500 ml-1">回</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>🚨</span> 累計スタンプ総数
          </div>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {stats.totalAllTimeStamps}
            <span className="text-xs font-semibold text-slate-500 ml-1">個</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>🎯</span> 罰ゲーム対象者
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats.membersWithPenaltyReady}
            <span className="text-xs font-semibold text-slate-500 ml-1">名 (3個〜)</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>👥</span> スタンプ保持部員
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {stats.membersWithStamps}
            <span className="text-xs font-semibold text-slate-500 ml-1">/ {stats.totalMembers}名</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter & Admin Action Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-stamp-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="部員名・パート・罰ゲームで検索..."
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
            <button
              id="filter-stamp-all"
              onClick={() => setFilterOption('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                filterOption === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              全員 ({mergedCards.length})
            </button>
            <button
              id="filter-stamp-has"
              onClick={() => setFilterOption('has_stamps')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                filterOption === 'has_stamps'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              スタンプあり ({stats.membersWithStamps})
            </button>
            <button
              id="filter-stamp-penalty"
              onClick={() => setFilterOption('penalty_ready')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                filterOption === 'penalty_ready'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              🎯 罰ゲーム対象 ({stats.membersWithPenaltyReady})
            </button>
            {myMemberName && (
              <button
                id="filter-stamp-me"
                onClick={() => setFilterOption('me')}
                className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                  filterOption === 'me'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                自分のカード
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">並び替え:</span>
            <select
              id="select-stamp-sort"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-hidden"
            >
              <option value="total_desc">累計スタンプが多い順</option>
              <option value="month_desc">今月のスタンプが多い順</option>
              <option value="name_asc">名前順（五十音）</option>
            </select>
          </div>
        </div>

        {/* Admin Tools Banner (Visible only for Admin) */}
        {isAdmin && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-bold">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>管理者用メニュー:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-admin-sync-stamps"
                onClick={handleSyncFromAttendances}
                disabled={isSyncing}
                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 font-medium disabled:opacity-50"
                title="過去の出欠履歴の緊急遽刻からスタンプ数を再集計します"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
                <span>履歴から集計・同期</span>
              </button>
              <button
                id="btn-admin-reset-all-month"
                onClick={() => setShowResetAllMonthDialog(true)}
                className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-100 transition-colors flex items-center gap-1 font-semibold"
                title="全部員の今月のスタンプカウントを0にリセットします"
              >
                <RotateCcw className="w-3 h-3" />
                <span>今月のスタンプ一括リセット</span>
              </button>
            </div>
          </div>
        )}

        {/* Feedback message */}
        {syncFeedback && (
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
            <Check className="w-3.5 h-3.5" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Priority User Banner */}
        {myMemberName ? (
          <div
            id="stamp-priority-user-bar"
            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 text-xs"
          >
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-semibold">
              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                <strong>{myMemberName}</strong> さんのスタンプカードを一番上に優先表示中
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-filter-stamp-me-toggle"
                onClick={() => setFilterOption(filterOption === 'me' ? 'all' : 'me')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterOption === 'me'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                }`}
              >
                {filterOption === 'me' ? '全員表示に戻す' : '自分のみに絞り込む'}
              </button>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">切り替え:</span>
                <select
                  id="select-stamp-switch-user"
                  value={myMemberName}
                  onChange={(e) => {
                    if (e.target.value) setMyMemberName(e.target.value);
                  }}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div
            id="stamp-priority-user-prompt"
            className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs"
          >
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>部員名を選択すると、あなたのスタンプカードが常に一番上に最優先表示されます：</span>
            </div>
            <select
              id="select-stamp-my-name-quick"
              value=""
              onChange={(e) => {
                if (e.target.value) setMyMemberName(e.target.value);
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden"
            >
              <option value="">部員名を選択...</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({m.part || m.section || '部員'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4. Stamp Cards Grid */}
      {filteredCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <Smile className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            該当する部員のスタンプカードがありません
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            検索キーワードまたはフィルターを変更してみてください。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCards.map((card) => {
            const isMe = Boolean(myMemberName && card.memberName === myMemberName);
            const stageInfo = getStageInfo(card.totalCount);
            const thisMonthCount = card.monthlyCounts?.[currentMonthKey] || 0;
            const minThreshold = settings.penaltyStages?.length 
              ? Math.min(...settings.penaltyStages.map(s => s.threshold))
              : (settings.penaltyThreshold || 3);
            const isPenaltyEligible = card.totalCount >= minThreshold;

            return (
              <div
                key={card.memberName}
                id={`stamp-card-${encodeURIComponent(card.memberName).replace(/\./g, '%2E')}`}
                className={`rounded-2xl p-4 border transition-all relative ${
                  isMe
                    ? `ring-2 ring-indigo-500/90 dark:ring-indigo-400/90 shadow-md border-indigo-400 dark:border-indigo-600 ${stageInfo.cardBg}`
                    : stageInfo.cardBg
                } ${isMe && isHighlighting ? 'scale-[1.03] shadow-xl z-10 brightness-110' : ''}`}
              >
                {/* +1 Floating Text */}
                <AnimatePresence>
                  {isMe && showPlusOne && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.5 }}
                      animate={{ opacity: 1, y: -40, scale: 1.5 }}
                      exit={{ opacity: 0, y: -60 }}
                      className="absolute top-0 right-4 font-black text-rose-600 dark:text-rose-400 text-2xl z-50 pointer-events-none drop-shadow-sm"
                    >
                      +1
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Priority Banner if isMe */}
                {isMe && (
                  <div
                    id={`stamp-card-my-priority-${encodeURIComponent(card.memberName)}`}
                    className="mb-3 -mt-1 -mx-1 py-1.5 px-3 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-between shadow-xs ring-1 ring-white/20"
                  >
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-white" />
                      <span>あなたのスタンプカード（最優先表示中）</span>
                    </span>
                    <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-bold">
                      先頭固定
                    </span>
                  </div>
                )}
                {/* Header: Member info & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        {card.memberName}
                      </h3>
                      {isMe && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white shadow-2xs">
                          あなた
                        </span>
                      )}
                      {card.part && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {card.section ? `${card.section}・` : ''}
                          {card.part}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stage Badge */}
                  <div className="shrink-0 flex items-center gap-1">
                    <span className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 ${stageInfo.badgeClass}`}>
                      <span>{stageInfo.emoji}</span>
                      <span>{stageInfo.label}</span>
                    </span>
                  </div>
                </div>

                {/* Counts Line */}
                <div className="mt-3 flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                    <span>累計緊急遽刻:</span>
                    <strong className={`text-base font-black ${stageInfo.accentColor}`}>
                      {card.totalCount}
                    </strong>
                    <span className="text-[11px] text-slate-500">個</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                    <span>今月:</span>
                    <strong className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {thisMonthCount}
                    </strong>
                    <span>回</span>
                  </div>
                </div>

                {/* Visual Stamp Card Sheet (10 slots) */}
                <div className="mt-3 bg-white/90 dark:bg-slate-900/90 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span>🎟️</span> スタンプシート (10回満願)
                    </span>
                    {card.totalCount > 10 && (
                      <span className="text-[10px] font-black text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/60 animate-pulse">
                        +{card.totalCount - 10}個 突破中!
                      </span>
                    )}
                  </div>

                  {/* 10 circular slots grid */}
                  <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const slotNumber = idx + 1;
                      const isStamped = slotNumber <= card.totalCount;

                      return (
                        <div
                          key={slotNumber}
                          className={`aspect-square rounded-full flex flex-col items-center justify-center relative transition-transform ${
                            isStamped
                              ? `${stageInfo.stampClass} scale-95 hover:scale-105 transform`
                              : 'border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-800/30'
                          }`}
                        >
                          {isStamped ? (
                            <>
                              <span className="text-sm sm:text-base leading-none select-none">
                                {stageInfo.emoji}
                              </span>
                              <span className="text-[9px] font-black tracking-tighter scale-90 opacity-90">
                                {slotNumber}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold select-none">
                              {slotNumber}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Speech Bubble: Penalty Game Content */}
                <div className="mt-3">
                  <div
                    className={`rounded-xl p-3 border relative ${stageInfo.bubbleBg} transition-colors`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <span className="text-xs">🎯</span>
                        <span>罰ゲームの内容</span>
                      </div>
                    </div>

                    {stageInfo.description && stageInfo.description !== 'まだ罰ゲームはありません' ? (
                      <div className="mt-1">
                        <p className="text-xs font-black text-slate-900 dark:text-white leading-relaxed tracking-wide bg-amber-500/10 dark:bg-amber-400/10 p-2 rounded-lg border border-amber-300/40 dark:border-amber-800/40">
                          {stageInfo.description}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-1 py-3 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-850/30">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          {stageInfo.description}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Specific Action Controls */}
                {isAdmin && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-end gap-2 text-xs">
                    <button
                      id={`btn-reset-month-${encodeURIComponent(card.memberName)}`}
                      onClick={() => setResetTarget({ card, type: 'month' })}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                      title="今月のスタンプを0にリセットします"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                      <span>今月分リセット</span>
                    </button>
                    <button
                      id={`btn-reset-total-${encodeURIComponent(card.memberName)}`}
                      onClick={() => setResetTarget({ card, type: 'total' })}
                      className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 text-[11px] font-bold flex items-center gap-1 transition-colors"
                      title="累計スタンプを0にリセットします"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>累計リセット</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 罰ゲーム発動演出オーバーレイ */}
      {justReachedPenaltyStage && (
        <PenaltyOverlay
          stage={justReachedPenaltyStage}
          onConfirm={() => setJustReachedPenaltyStage(null)}
        />
      )}

      {/* ===================== MODAL 2: 個人スタンプリセット確認ダイアログ ===================== */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-black">
                {resetTarget.type === 'total' ? '累計スタンプのリセット' : '今月スタンプのリセット'}
              </h3>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>{resetTarget.card.memberName}</strong> さんの
              {resetTarget.type === 'total'
                ? `累計スタンプ（現在 ${resetTarget.card.totalCount} 個）を 0 にリセットしますか？`
                : `今月（${currentYear}年${Number(currentMonth)}月）のスタンプ（現在 ${
                    resetTarget.card.monthlyCounts?.[currentMonthKey] || 0
                  } 個）を 0 にリセットしますか？`}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
              ※この操作は取り消せません。設定された罰ゲーム文は保持されます。
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                キャンセル
              </button>
              <button
                type="button"
                id="btn-confirm-reset"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isResetting ? 'リセット中...' : 'リセットを実行'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: 全員今月スタンプ一括リセット確認ダイアログ ===================== */}
      {showResetAllMonthDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-black">今月分の一括リセット</h3>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>部員全員</strong>の今月（{currentYear}年{Number(currentMonth)}月）の緊急遽刻カウントを一括で 0 にリセットしますか？
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
              ※部員の累計カウントや設定済みの罰ゲームはそのまま残ります。月末や月初めの締め作業時にご利用ください。
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetAllMonthDialog(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                キャンセル
              </button>
              <button
                type="button"
                id="btn-confirm-reset-all-month"
                onClick={handleConfirmResetAllMonth}
                disabled={isResettingAllMonth}
                className="px-4 py-2 rounded-xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isResettingAllMonth ? 'リセット中...' : '一括リセットを実行'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
