import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AttendanceType, AttendancePattern } from '../types';
import { getTodayString, addDays, formatJapaneseDate } from '../utils/date';
import { PatternManagerModal } from './PatternManagerModal';
import { useAttendancePatterns } from '../hooks/useAttendancePatterns';
import {
  Send,
  Calendar,
  User,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  RotateCcw,
  ChevronDown,
  Sparkles,
  Settings,
  Plus,
  BookmarkPlus,
  Check,
  Copy,
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { formatAttendanceRecordShareText } from '../utils/formatShareText';

const ATTENDANCE_TYPES: {
  type: AttendanceType;
  label: string;
  desc: string;
  badgeDesc?: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    type: '出席',
    label: '出席',
    desc: '部活に参加する',
    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold',
    inactiveClass: 'bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/30',
  },
  {
    type: '欠席',
    label: '欠席',
    desc: '部活に参加できない',
    activeClass: 'bg-red-600 text-white border-red-600 shadow-xs font-bold',
    inactiveClass: 'bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-400 hover:bg-red-50/40 dark:hover:bg-red-950/30',
  },
  {
    type: '遅刻',
    label: '遅刻',
    desc: '遅れて参加する',
    badgeDesc: 'まとめ通知で集約',
    activeClass: 'bg-amber-500 text-white border-amber-500 shadow-xs font-bold',
    inactiveClass: 'bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-950/30',
  },
  {
    type: '緊急遽刻',
    label: '🚨 緊急遽刻',
    desc: '直前の遅延・急用',
    badgeDesc: '即時通知されます',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold',
    inactiveClass: 'bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:bg-rose-50/40 dark:hover:bg-rose-950/30',
  },
  {
    type: '早退',
    label: '早退',
    desc: '途中で抜ける',
    activeClass: 'bg-yellow-500 text-slate-950 border-yellow-500 shadow-xs font-bold',
    inactiveClass: 'bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-yellow-400 hover:bg-yellow-50/40 dark:hover:bg-yellow-950/30',
  },
];

export const FormScreen: React.FC = () => {
  const {
    members,
    myMemberName,
    myMemberSection,
    myMemberPart,
    saveAttendance,
    setCurrentTab,
    triggerStampEffect,
    setTriggerStampEffect,
    activeEditingRecord,
    setActiveEditingRecord,
  } = useApp();

  const {
    patterns,
    savePatterns,
    reasons,
    addReason,
    removeReason,
    times,
    addTime,
    removeTime,
  } = useAttendancePatterns();

  const today = getTodayString();
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);

  const getShortDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const dateObj = new Date(parseInt(parts[0], 10), month - 1, day);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()] || '';
    return `${month}/${day}(${dayOfWeek})`;
  };

  // Form states
  const [date, setDate] = useState<string>(activeEditingRecord?.date || today);
  const [memberName, setMemberName] = useState<string>(
    activeEditingRecord?.memberName || myMemberName || ''
  );
  const [isCustomName, setIsCustomName] = useState<boolean>(false);
  const [type, setType] = useState<AttendanceType>(
    activeEditingRecord?.type || '出席'
  );
  const [time, setTime] = useState<string>(activeEditingRecord?.time || '');
  const [reason, setReason] = useState<string>(activeEditingRecord?.reason || '');

  // Patterns & customization states
  const [isPatternModalOpen, setIsPatternModalOpen] = useState<boolean>(false);
  const [patternInitialData, setPatternInitialData] = useState<{
    type: AttendanceType;
    time?: string;
    reason?: string;
  } | null>(null);

  const [showAddReasonInput, setShowAddReasonInput] = useState<boolean>(false);
  const [newReasonText, setNewReasonText] = useState<string>('');

  const [showAddTimeInput, setShowAddTimeInput] = useState<boolean>(false);
  const [newTimeText, setNewTimeText] = useState<string>('');
  const [patternAppliedToast, setPatternAppliedToast] = useState<string>('');

  // UI status
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (activeEditingRecord) {
      setDate(activeEditingRecord.date);
      setMemberName(activeEditingRecord.memberName);
      setType(activeEditingRecord.type);
      setTime(activeEditingRecord.time || '');
      setReason(activeEditingRecord.reason || '');
      // Check if custom name
      const found = members.some((m) => m.name === activeEditingRecord.memberName);
      setIsCustomName(!found);
    } else if (myMemberName) {
      setMemberName(myMemberName);
    }
  }, [activeEditingRecord, myMemberName, members]);

  const applyPattern = (p: AttendancePattern) => {
    setType(p.type);
    setTime(p.time || '');
    setReason(p.reason || '');
    setErrorMsg('');
    setPatternAppliedToast(`「${p.name}」を入力欄に反映しました`);
    setTimeout(() => setPatternAppliedToast(''), 2500);
  };

  const handleSaveCurrentAsPattern = () => {
    setPatternInitialData({
      type,
      time: (type === '遅刻' || type === '緊急遽刻' || type === '早退') ? time : '',
      reason,
    });
    setIsPatternModalOpen(true);
  };

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!date) {
      setErrorMsg('日付を選択してください');
      return;
    }
    if (!memberName.trim()) {
      setErrorMsg('名前を選択または入力してください');
      return;
    }
    if ((type === '遅刻' || type === '緊急遽刻' || type === '早退') && !time.trim()) {
      setErrorMsg(`${type}の場合は「何時ごろ」の目安を入力してください`);
      return;
    }

    // Passed validation -> open confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      await saveAttendance(
        {
          date,
          memberName: memberName.trim(),
          type,
          time: (type === '遅刻' || type === '緊急遽刻' || type === '早退') ? time.trim() : '',
          reason: reason.trim(),
        },
        activeEditingRecord?.id
      );

      setShowConfirmModal(false);
      setIsSuccess(true);
      setActiveEditingRecord(null);

      // 【追加要件】緊急遽刻の場合はスタンプカードへ自動遷移
      if (type === '緊急遽刻') {
        setTriggerStampEffect(true);
        setTimeout(() => {
          setCurrentTab('status');
        }, 1200); // 1.2秒後に遷移（成功メッセージを見せる時間）
      } else {
        // 通常の遷移
        setTimeout(() => {
          setCurrentTab('status');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('送信に失敗しました。もう一度お試しください。');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setActiveEditingRecord(null);
    setDate(today);
    setType('欠席');
    setTime('');
    setReason('');
  };

  if (isSuccess) {
    return (
      <div className="pt-10 pb-20 px-4 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
          {triggerStampEffect 
            ? '緊急遽刻を記録しました！' 
            : type === '出席'
              ? '出席を記録しました！'
              : activeEditingRecord 
                ? '連絡を更新しました！' 
                : '連絡を送信しました！'}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
          {triggerStampEffect 
            ? 'スタンプカード画面へ移動します...' 
            : '全員の連絡状況画面にリアルタイムで反映されました。'}
        </p>
        <div className="flex flex-col gap-2 max-w-xs mx-auto">
          <button
            id="btn-goto-status"
            onClick={() => setCurrentTab('status')}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs shadow-xs hover:bg-blue-700"
          >
            みんなの状況を確認する
          </button>
          <button
            id="btn-goto-home"
            onClick={() => setCurrentTab('home')}
            className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 pt-2">
      {/* Title & Edit Warning */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {activeEditingRecord ? '出欠連絡の修正' : '出欠連絡の送信'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeEditingRecord
              ? '既存の連絡内容を変更します'
              : '欠席・遅刻・緊急遽刻・早退の連絡を送信します'}
          </p>
        </div>
        {activeEditingRecord && (
          <button
            id="btn-cancel-edit"
            onClick={handleCancelEdit}
            className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            新規作成へ
          </button>
        )}
      </div>

      {errorMsg && (
        <div
          id="form-error-alert"
          className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleValidate} className="space-y-4" id="attendance-form">
        {/* 1. Date Selection */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
          <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            連絡する日付 <span className="text-red-500">*</span>
          </label>

          {/* Quick Date Pills */}
          <div className="grid grid-cols-3 gap-2.5 w-full">
            <button
              type="button"
              id="btn-date-today"
              onClick={() => setDate(today)}
              className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center text-center p-1.5 transition-all cursor-pointer ${
                date === today
                  ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 font-medium'
              }`}
            >
              <span className="text-xs font-bold leading-tight block">今日</span>
              <span className={`text-[11px] font-medium leading-tight block mt-0.5 ${date === today ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {getShortDateLabel(today)}
              </span>
            </button>
            <button
              type="button"
              id="btn-date-tomorrow"
              onClick={() => setDate(tomorrow)}
              className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center text-center p-1.5 transition-all cursor-pointer ${
                date === tomorrow
                  ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 font-medium'
              }`}
            >
              <span className="text-xs font-bold leading-tight block">明日</span>
              <span className={`text-[11px] font-medium leading-tight block mt-0.5 ${date === tomorrow ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {getShortDateLabel(tomorrow)}
              </span>
            </button>
            <button
              type="button"
              id="btn-date-dayafter"
              onClick={() => setDate(dayAfterTomorrow)}
              className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center text-center p-1.5 transition-all cursor-pointer ${
                date === dayAfterTomorrow
                  ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 font-medium'
              }`}
            >
              <span className="text-xs font-bold leading-tight block">明後日</span>
              <span className={`text-[11px] font-medium leading-tight block mt-0.5 ${date === dayAfterTomorrow ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {getShortDateLabel(dayAfterTomorrow)}
              </span>
            </button>
          </div>

          <div className="relative flex items-center">
            <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
            <input
              type="date"
              id="input-attendance-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none transition-colors"
              required
            />
          </div>
        </div>

        {/* 2. Member Name Selection */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              部員名（あなたのお名前） <span className="text-red-500">*</span>
            </label>
            {members.length > 0 && (
              <button
                type="button"
                id="toggle-custom-name"
                onClick={() => setIsCustomName(!isCustomName)}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {isCustomName ? '部員一覧から選択' : '直接入力に切り替え'}
              </button>
            )}
          </div>

          {!isCustomName && members.length > 0 ? (
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
              <select
                id="select-member-name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none transition-colors appearance-none cursor-pointer"
                required
              >
                <option value="">名前を選択してください</option>
                {members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} {m.part ? `(${m.part})` : m.section ? `(${m.section})` : m.grade ? `(${m.grade})` : ''} {m.role && m.role !== '部員' ? `[${m.role}]` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
            </div>
          ) : (
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                id="input-custom-member-name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="フルネーム（例: 山田 太郎）"
                className="w-full h-11 pl-10 pr-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none transition-colors"
                required
              />
            </div>
          )}
        </div>

        {/* 2.5 Quick Custom Attendance Patterns */}
        <div
          id="section-quick-patterns"
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              よく使うパターン（ワンタップ入力）
            </label>
            <button
              type="button"
              id="btn-open-pattern-manager"
              onClick={() => {
                setPatternInitialData(null);
                setIsPatternModalOpen(true);
              }}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              設定・管理
            </button>
          </div>

          {patternAppliedToast && (
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 rounded-xl text-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-blue-600" />
              <span>{patternAppliedToast}</span>
            </div>
          )}

          {patterns.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {patterns.map((p) => {
                const isSelected =
                  type === p.type &&
                  ((!p.time && !time) || p.time === time) &&
                  ((!p.reason && !reason) || p.reason === reason);

                const badgeColor =
                  p.type === '欠席'
                    ? 'bg-red-500'
                    : p.type === '遅刻'
                    ? 'bg-amber-500'
                    : p.type === '緊急遽刻'
                    ? 'bg-rose-600'
                    : 'bg-yellow-500';

                return (
                  <button
                    type="button"
                    key={p.id}
                    id={`btn-pattern-${p.id}`}
                    onClick={() => applyPattern(p)}
                    className={`h-9 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/80 border-blue-600 dark:border-blue-500 text-blue-800 dark:text-blue-200 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${badgeColor}`} />
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              登録されているパターンがありません。「設定・管理」から追加できます。
            </p>
          )}

          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">
              タップすると区分・時間・理由が一度に入力されます
            </span>
            <button
              type="button"
              id="btn-save-current-pattern"
              onClick={handleSaveCurrentAsPattern}
              className="font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-1 cursor-pointer bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900 transition-colors"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              現在の入力をマイパターンに保存
            </button>
          </div>
        </div>

        {/* 3. Type Selection (欠席 / 遅刻 / 緊急遽刻 / 早退) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
          <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            区分を選択 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {ATTENDANCE_TYPES.map((item) => {
              const isSelected = type === item.type;
              return (
                <button
                  type="button"
                  key={item.type}
                  id={`btn-type-${item.type}`}
                  onClick={() => setType(item.type)}
                  className={`h-20 w-full rounded-2xl border-2 flex flex-col items-center justify-center text-center p-2.5 transition-all cursor-pointer ${
                    isSelected ? item.activeClass : item.inactiveClass
                  }`}
                >
                  <span className="text-sm font-extrabold leading-tight block">{item.label}</span>
                  <span
                    className={`text-[11px] leading-tight block mt-1 ${
                      isSelected ? 'opacity-95' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Emergency Tardy Stamp Hint */}
          {type === '緊急遽刻' && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <span className="text-base shrink-0">🎫</span>
              <span className="leading-tight">
                <strong>負のスタンプカード:</strong> 緊急遽刻を送信するとスタンプが1つ増えます（3個以上で自分で軽い罰ゲームを設定できます！）。
              </span>
            </div>
          )}
        </div>

        {/* 4. Conditional Time input (Only for 遅刻 / 緊急遽刻 / 早退) */}
        {(type === '遅刻' || type === '緊急遽刻' || type === '早退') && (
          <div
            id="form-time-section"
            className="rounded-2xl p-4 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3 transition-colors"
          >
            <div className="flex items-center justify-between">
              <label
                className={`text-xs font-bold flex items-center gap-1.5 ${
                  type === '緊急遽刻'
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                <Clock
                  className={`w-4 h-4 ${
                    type === '緊急遽刻' ? 'text-rose-600' : 'text-amber-600'
                  }`}
                />
                {type === '緊急遽刻'
                  ? '何時ごろ到着予定（見込み）ですか？'
                  : type === '遅刻'
                  ? '何時ごろ到着予定ですか？'
                  : '何時ごろ早退予定ですか？'}{' '}
                <span className="text-red-500">*</span>
              </label>
            </div>

            {/* Quick Time presets with inline add */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {times.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setTime(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors cursor-pointer ${
                    time === preset
                      ? type === '緊急遽刻'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-amber-500 text-white border-amber-500'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}

              {showAddTimeInput ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="例: 15:45ごろ"
                    value={newTimeText}
                    onChange={(e) => setNewTimeText(e.target.value)}
                    className="h-8 px-2 rounded-lg border-2 border-amber-400 text-xs w-28 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newTimeText.trim()) {
                          addTime(newTimeText.trim());
                          setTime(newTimeText.trim());
                          setNewTimeText('');
                          setShowAddTimeInput(false);
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTimeText.trim()) {
                        addTime(newTimeText.trim());
                        setTime(newTimeText.trim());
                        setNewTimeText('');
                        setShowAddTimeInput(false);
                      }
                    }}
                    className="h-8 px-2 rounded-lg bg-amber-500 text-white text-xs font-bold"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTimeInput(false);
                      setNewTimeText('');
                    }}
                    className="h-8 px-2 text-slate-400 text-xs hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddTimeInput(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  時間追加
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                id="input-attendance-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="例: 16:30ごろ、または 1限終了後"
                className="w-full h-11 pl-10 pr-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>
        )}

        {/* 5. Reason Input */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
          <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            理由（任意）
          </label>

          {/* Quick Reasons with inline add */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {reasons.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setReason(reason === r ? '' : r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors cursor-pointer ${
                  reason === r
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {r}
              </button>
            ))}

            {showAddReasonInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="例: 生徒会、再テスト"
                  value={newReasonText}
                  onChange={(e) => setNewReasonText(e.target.value)}
                  className="h-8 px-2 rounded-lg border-2 border-blue-400 text-xs w-32 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newReasonText.trim()) {
                        addReason(newReasonText.trim());
                        setReason(newReasonText.trim());
                        setNewReasonText('');
                        setShowAddReasonInput(false);
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newReasonText.trim()) {
                      addReason(newReasonText.trim());
                      setReason(newReasonText.trim());
                      setNewReasonText('');
                      setShowAddReasonInput(false);
                    }
                  }}
                  className="h-8 px-2 rounded-lg bg-blue-600 text-white text-xs font-bold"
                >
                  追加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddReasonInput(false);
                    setNewReasonText('');
                  }}
                  className="h-8 px-2 text-slate-400 text-xs hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddReasonInput(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                理由追加
              </button>
            )}
          </div>

          <textarea
            id="input-attendance-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="詳細な理由や伝達事項があれば入力してください"
            className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          id="btn-submit-attendance-form"
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          送信確認画面へ
        </button>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          id="confirm-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            id="confirm-modal-content"
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                送信内容の確認
              </h3>
              <button
                id="btn-modal-close"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              以下の内容で部活メンバーに連絡を共有します。よろしいですか？
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3.5 space-y-2 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">日付:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatJapaneseDate(date, true)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">名前:</span>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">{memberName}</span>
                  {(() => {
                    const m = members.find((mem) => mem.name === memberName);
                    const sec = m?.section || (memberName === myMemberName ? myMemberSection : '');
                    const prt = m?.part || (memberName === myMemberName ? myMemberPart : '');
                    if (!sec && !prt) return null;
                    return (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block">
                        {sec}{prt ? ` / ${prt}` : ''}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">出欠区分:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    type === '欠席'
                      ? 'bg-red-600 text-white'
                      : type === '遅刻'
                      ? 'bg-amber-500 text-white'
                      : type === '緊急遽刻'
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-yellow-500 text-slate-900'
                  }`}
                >
                  {type}
                </span>
              </div>
              {(type === '遅刻' || type === '緊急遽刻' || type === '早退') && time && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">時間目安:</span>
                  <span
                    className={`font-bold ${
                      type === '緊急遽刻' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {time}
                  </span>
                </div>
              )}
              {reason && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">理由:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 text-right max-w-[180px]">
                    {reason}
                  </span>
                </div>
              )}
            </div>

            {type === '緊急遽刻' && date === today && (
              <p className="text-[11px] text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-medium">
                🚨【即時通知】当日の緊急遽刻のため、LINE WORKSグループおよびメンバー全員へ直ちに速報通知が送信されます。
              </p>
            )}
            {type === '遅刻' && (
              <p className="text-[11px] text-slate-600 bg-slate-100 p-2 rounded-lg border border-slate-200">
                ※ 通常の遅刻連絡は日々のまとめ通知（朝の配信など）に集約されます。
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                id="btn-modal-cancel"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                disabled={isSubmitting}
              >
                戻って修正
              </button>
              <button
                type="button"
                id="btn-modal-confirm"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? '送信中...' : '送信する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pattern Manager Modal */}
      <PatternManagerModal
        isOpen={isPatternModalOpen}
        onClose={() => {
          setIsPatternModalOpen(false);
          setPatternInitialData(null);
        }}
        patterns={patterns}
        onSavePatterns={savePatterns}
        initialNewPattern={patternInitialData}
      />
    </div>
  );
};
