import React from 'react';
import { useApp } from '../context/AppContext';
import { ClubKeyCard } from './ClubKeyCard';
import { Users, Send, ChevronRight, Clock } from 'lucide-react';
import { getTodayString } from '../utils/date';
import { resolveScheduleForDate } from '../constants/schedule';

export const HomeScreen: React.FC = () => {
  const { attendances, settings, setCurrentTab } = useApp();
  const todayStr = getTodayString();
  const todaySchedule = resolveScheduleForDate(todayStr, settings);

  const todayRecords = attendances.filter((a) => a.date === todayStr);
  const absentCount = todayRecords.filter((a) => a.type === '欠席').length;
  const tardyCount = todayRecords.filter((a) => a.type === '遅刻').length;
  const earlyCount = todayRecords.filter((a) => a.type === '早退').length;
  const emergencyCount = todayRecords.filter((a) => a.type === '緊急遽刻').length;

  return (
    <div className="space-y-4 pb-20">
      {/* 1. 部室の鍵・施錠報告カード (スクリーンショットデザイン) */}
      <ClubKeyCard />

      {/* 2. 本日の出欠概況クイックカード */}
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a]/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-200">本日の出欠概要</h3>
          </div>
          <button
            type="button"
            onClick={() => setCurrentTab('status')}
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
          >
            みんなの状況を見る
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 本日の出欠確認時刻バナー */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[11px] font-medium text-slate-400">出欠確認締切:</span>
            <span className="font-bold text-slate-100">
              {todaySchedule.enabled ? todaySchedule.time : '本日休み'}
            </span>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              todaySchedule.enabled
                ? 'bg-blue-950/60 text-blue-300 border-blue-800/80'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {todaySchedule.label || (todaySchedule.enabled ? '通常練習' : 'OFF')}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-900/50">
            <span className="text-[10px] font-bold text-rose-400 block">欠席</span>
            <span className="text-base font-black text-rose-300">{absentCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-900/50">
            <span className="text-[10px] font-bold text-amber-400 block">遅刻</span>
            <span className="text-base font-black text-amber-300">{tardyCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-900/50">
            <span className="text-[10px] font-bold text-indigo-400 block">早退</span>
            <span className="text-base font-black text-indigo-300">{earlyCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-red-950/40 border border-red-900/50">
            <span className="text-[10px] font-bold text-red-400 block">緊急遽刻</span>
            <span className="text-base font-black text-red-300">{emergencyCount}</span>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setCurrentTab('form')}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-blue-400" />
            出欠連絡を入力する
          </button>
        </div>
      </div>
    </div>
  );
};
