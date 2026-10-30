import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ActiveAttendanceType, AttendancePattern, AttendanceType, ClubMember } from '../types';
import { getTodayString, formatJapaneseDate } from '../utils/date';
import { SECTIONS_AND_PARTS, getPartsForSection, getSectionForPart } from '../constants/parts';
import { DEFAULT_ATTENDANCE_PATTERNS } from '../constants/patterns';
import { AttendancePatternsEditor } from './AttendancePatternsEditor';
import { Send, CheckCircle2, Clock, AlertTriangle, User, Calendar, Sparkles, Edit3 } from 'lucide-react';

export const FormScreen: React.FC = () => {
  const { settings, members, saveAttendance, myMemberName, myMemberSection, myMemberPart, activeEditingRecord, setActiveEditingRecord, setCurrentTab } = useApp();

  const [isEditPatternsOpen, setIsEditPatternsOpen] = useState<boolean>(false);

  const [date, setDate] = useState<string>(activeEditingRecord?.date || getTodayString());
  const [memberName, setMemberName] = useState<string>(activeEditingRecord?.memberName || myMemberName || '');
  const [section, setSection] = useState<string>(activeEditingRecord?.section || myMemberSection || '木管');
  const [part, setPart] = useState<string>(activeEditingRecord?.part || myMemberPart || '');
  const [type, setType] = useState<ActiveAttendanceType>(
    activeEditingRecord && activeEditingRecord.type !== '出席' ? (activeEditingRecord.type as ActiveAttendanceType) : '欠席'
  );
  const [reason, setReason] = useState<string>(activeEditingRecord?.reason || '');
  const [time, setTime] = useState<string>(activeEditingRecord?.time || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (activeEditingRecord) {
      setDate(activeEditingRecord.date);
      setMemberName(activeEditingRecord.memberName);
      setSection(activeEditingRecord.section || '木管');
      setPart(activeEditingRecord.part || '');
      if (activeEditingRecord.type !== '出席') {
        setType(activeEditingRecord.type as ActiveAttendanceType);
      } else {
        setType('欠席');
      }
      setReason(activeEditingRecord.reason || '');
      setTime(activeEditingRecord.time || '');
    }
  }, [activeEditingRecord]);

  const handleMemberSelect = (name: string) => {
    setMemberName(name);
    const found = members.find((m) => m.name === name);
    if (found) {
      if (found.section) setSection(found.section);
      if (found.part) setPart(found.part);
    }
  };

  const patterns: AttendancePattern[] =
    settings.attendancePatterns && settings.attendancePatterns.length > 0
      ? settings.attendancePatterns
      : DEFAULT_ATTENDANCE_PATTERNS;

  const handleApplyPattern = (pat: AttendancePattern) => {
    setType(pat.type);
    setReason(pat.reason);
    if (pat.time) {
      setTime(pat.time);
    } else {
      setTime('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) {
      alert('部員名を入力または選択してください');
      return;
    }

    // 【修正内容3：フォームのバリデーション（入力チェック）】
    // 「遅刻」「早退」を選んだ場合のみ時間の入力を必須とし、「欠席」の場合は時間が空でもエラーにならないようにする
    const isTimeRequired = type === '遅刻' || type === '早退';
    if (isTimeRequired && !time.trim()) {
      alert(`${type === '遅刻' ? '到着予定時刻' : '早退予定時刻'}を入力してください（例: 17:00 頃、5限後）`);
      return;
    }

    // 【修正内容1 & 2：undefinedの排除と欠席時の時間未入力処理】
    // 「欠席」などの場合は time に空文字 "" を明示的にセットし、絶対に undefined にしない
    const safeTime = (isTimeRequired || type === '緊急遽刻') ? time.trim() : '';

    setIsSubmitting(true);
    try {
      await saveAttendance(
        {
          date,
          memberName: memberName.trim(),
          section: section || '',
          part: part || '',
          type,
          reason: reason.trim(),
          time: safeTime, // 安全な文字列（"" または入力された時間）
        },
        activeEditingRecord?.id
      );

      setSubmittedSuccess(true);
      setActiveEditingRecord(null);
      setTimeout(() => {
        setSubmittedSuccess(false);
        setCurrentTab('status');
      }, 1500);
    } catch (err: any) {
      alert(`保存に失敗しました: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const partsList = getPartsForSection(section);

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {activeEditingRecord ? '出欠連絡の編集' : '出欠連絡の送信'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              欠席・遅刻・早退・緊急遽刻の連絡を入力してください
            </p>
          </div>
          {activeEditingRecord && (
            <button
              type="button"
              onClick={() => {
                setActiveEditingRecord(null);
                setCurrentTab('status');
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              キャンセル
            </button>
          )}
        </div>

        {submittedSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>連絡を送信しました！出欠一覧へ移動します...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Date */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              対象日
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Member Name */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              部員名
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="例: 山田 太郎"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />

              {members.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleMemberSelect(m.name)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                        memberName === m.name
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section & Part */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                セクション
              </label>
              <select
                value={section}
                onChange={(e) => {
                  setSection(e.target.value);
                  const pList = getPartsForSection(e.target.value);
                  setPart(pList[0] || '');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SECTIONS_AND_PARTS.map((s) => (
                  <option key={s.section} value={s.section}>
                    {s.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                パート
              </label>
              <select
                value={part}
                onChange={(e) => setPart(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {partsList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Attendance Type Buttons */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              区分
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['欠席', '遅刻', '早退', '緊急遽刻'] as ActiveAttendanceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    // 欠席の場合は時間入力をリセット
                    if (t === '欠席') {
                      setTime('');
                    }
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    type === t
                      ? t === '欠席'
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/30'
                        : t === '遅刻'
                        ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
                        : t === '早退'
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                        : 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Time (for tardy, early, emergency) */}
          {(type === '遅刻' || type === '早退' || type === '緊急遽刻') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {type === '遅刻' || type === '緊急遽刻' ? '到着予定時刻' : '早退予定時刻'}
                </label>
                {(type === '遅刻' || type === '早退') ? (
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                    必須
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    任意
                  </span>
                )}
              </div>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder={
                  type === '早退'
                    ? '例: 17:00 頃、バイトのため'
                    : '例: 17:00 頃、5限終了後'
                }
                required={type === '遅刻' || type === '早退'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Quick reason patterns */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                理由
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  定型文から選択
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditPatternsOpen(true)}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                  title="定型文の内容を編集"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>定型文を編集</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {patterns.map((pat) => (
                <button
                  key={pat.id}
                  type="button"
                  onClick={() => handleApplyPattern(pat)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium transition-colors cursor-pointer"
                >
                  {pat.name}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="理由を入力してください（例: 発熱のため、通院のため）"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? '送信中...' : activeEditingRecord ? '連絡内容を更新する' : '出欠連絡を送信する'}
          </button>
        </form>
      </div>

      {/* 定型文（連絡パターン）編集モーダル */}
      {isEditPatternsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            <AttendancePatternsEditor
              isModal={true}
              onClose={() => setIsEditPatternsOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
