import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ClubKeyCard } from './ClubKeyCard';
import { formatJapaneseDate, getTodayString, addDays } from '../utils/date';
import { SECTIONS_AND_PARTS } from '../constants/parts';
import { formatDailySummaryWithSections } from '../utils/formatShareText';
import { copyToClipboard } from '../utils/clipboard';
import { ChevronLeft, ChevronRight, Copy, Check, Send, AlertTriangle, Clock, LogOut, CheckCircle2 } from 'lucide-react';
import { AttendanceRecord } from '../types';
import { resolveScheduleForDate } from '../constants/schedule';

export const StatusScreen: React.FC = () => {
  const { attendances, members, settings, isAdmin, triggerManualSummary, deleteAttendance, setActiveEditingRecord, setCurrentTab } = useApp();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [copied, setCopied] = useState<boolean>(false);
  const [sendingLw, setSendingLw] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const todayStr = getTodayString();
  const isToday = selectedDate === todayStr;
  const selectedSchedule = resolveScheduleForDate(selectedDate, settings);

  const dayRecords = attendances.filter((a) => a.date === selectedDate);
  const absentRecords = dayRecords.filter((a) => a.type === '欠席');
  const tardyRecords = dayRecords.filter((a) => a.type === '遅刻');
  const earlyRecords = dayRecords.filter((a) => a.type === '早退');
  const emergencyRecords = dayRecords.filter((a) => a.type === '緊急遽刻');

  const handlePrevDay = () => setSelectedDate((prev) => addDays(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => addDays(prev, 1));
  const handleToday = () => setSelectedDate(todayStr);

  const handleCopySummary = async () => {
    const text = formatDailySummaryWithSections(selectedDate, attendances, members);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSendLineWorks = async () => {
    if (!settings.lineWorks?.enabled) {
      alert('LINE WORKS連携が無効です。設定タブから有効にしてください。');
      return;
    }
    setSendingLw(true);
    setSendSuccess(null);
    try {
      await triggerManualSummary(selectedDate, true);
      setSendSuccess('LINE WORKSに当日の集計を送信しました！');
      setTimeout(() => setSendSuccess(null), 4000);
    } catch (err: any) {
      alert(`送信エラー: ${err.message}`);
    } finally {
      setSendingLw(false);
    }
  };

  const getMemberSection = (rec: AttendanceRecord) => {
    if (rec.section) return rec.section;
    const mem = members.find((m) => m.name === rec.memberName);
    return mem?.section || 'その他';
  };

  const getTypeBadge = (type: AttendanceRecord['type']) => {
    switch (type) {
      case '欠席':
        return <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold">欠席</span>;
      case '遅刻':
        return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">遅刻</span>;
      case '早退':
        return <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-bold">早退</span>;
      case '緊急遽刻':
        return <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse">緊急遽刻</span>;
      case '出席':
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold">過去記録</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Date selector banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
        <button
          type="button"
          onClick={handlePrevDay}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          title="前日"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {formatJapaneseDate(selectedDate, true)}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-blue-500" />
              確認時刻: {selectedSchedule.enabled ? selectedSchedule.time : 'OFF'}（{selectedSchedule.label || (selectedSchedule.enabled ? '通常練習' : '休み')}）
            </span>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={handleToday}
              className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline block mx-auto mt-0.5"
            >
              今日へ戻る
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleNextDay}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          title="翌日"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Club Key Card (only on today) */}
      {isToday && <ClubKeyCard />}

      {/* Summary Stats Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            当日の集計状況
          </h2>
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
            総報告数: {dayRecords.length}件
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">欠席</span>
            <span className="text-lg font-black text-rose-700 dark:text-rose-300 leading-tight">
              {absentRecords.length}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">遅刻</span>
            <span className="text-lg font-black text-amber-700 dark:text-amber-300 leading-tight">
              {tardyRecords.length}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">早退</span>
            <span className="text-lg font-black text-indigo-700 dark:text-indigo-300 leading-tight">
              {earlyRecords.length}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 block">緊急遽刻</span>
            <span className="text-lg font-black text-red-700 dark:text-red-300 leading-tight">
              {emergencyRecords.length}
            </span>
          </div>
        </div>

        {/* Copy & LINE WORKS buttons */}
        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'コピーしました！' : 'LINE WORKS用文章をコピー'}
          </button>

          {settings.lineWorks?.enabled && (
            <button
              type="button"
              onClick={handleSendLineWorks}
              disabled={sendingLw}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingLw ? '送信中...' : 'LINE WORKSへ送信'}
            </button>
          )}
        </div>

        {sendSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{sendSuccess}</span>
          </div>
        )}
      </div>

      {/* Section-grouped Breakdown */}
      <div className="space-y-3">
        {SECTIONS_AND_PARTS.map(({ section }) => {
          const secRecords = dayRecords.filter((r) => getMemberSection(r) === section);
          const hasAnyone = secRecords.length > 0;

          return (
            <div
              key={section}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  【{section}】
                </h3>
                <span className="text-[11px] text-slate-400">
                  {secRecords.length}名
                </span>
              </div>

              {!hasAnyone ? (
                <p className="text-xs text-slate-400 py-1 italic">連絡なし</p>
              ) : (
                <div className="space-y-2">
                  {secRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {record.memberName}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {record.part || 'パート未定'}
                          </span>
                          {getTypeBadge(record.type)}
                        </div>

                        {record.time && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                            時間: {record.time}
                          </p>
                        )}

                        {record.reason && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            理由: {record.reason}
                          </p>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveEditingRecord(record);
                              setCurrentTab('form');
                            }}
                            className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline px-1.5 py-0.5"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`「${record.memberName}」さんの連絡を削除しますか？`)) {
                                deleteAttendance(record.id);
                              }
                            }}
                            className="text-[10px] text-red-500 hover:underline px-1.5 py-0.5"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
