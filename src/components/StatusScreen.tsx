import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AttendanceType, AttendanceRecord } from '../types';
import {
  getTodayString,
  formatJapaneseDate,
  addDays,
  formatTimestamp,
  getDaysInMonth,
  getFirstDayOfWeek,
  toDateString,
} from '../utils/date';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Edit2,
  Trash2,
  HelpCircle,
  Plus,
  ListFilter,
  Users,
  Music,
  Copy,
  Check,
  Share2,
  User,
} from 'lucide-react';
import { SECTION_CATEGORIES, SECTION_PARTS_MAP, SectionCategory } from '../constants/parts';
import { copyToClipboard } from '../utils/clipboard';
import {
  formatAttendanceRecordShareText,
  formatDailySummaryWithSections,
} from '../utils/formatShareText';
import { StampCardView } from './StampCardView';

const typeColorStyles: Record<
  AttendanceType,
  {
    bg: string;
    text: string;
    badge: string;
    border: string;
  }
> = {
  出席: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-600 text-white',
    border: 'border-blue-200 dark:border-blue-900/60',
  },
  欠席: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-600 text-white',
    border: 'border-red-200 dark:border-red-900/60',
  },
  遅刻: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-400',
    badge: 'bg-amber-500 text-white',
    border: 'border-amber-200 dark:border-amber-900/60',
  },
  緊急遽刻: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-800 dark:text-rose-400',
    badge: 'bg-rose-600 text-white',
    border: 'border-rose-200 dark:border-rose-900/60',
  },
  早退: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    text: 'text-yellow-800 dark:text-yellow-400',
    badge: 'bg-yellow-500 text-slate-900 font-bold',
    border: 'border-yellow-200 dark:border-yellow-900/60',
  },
};

type FilterCategory = 'all' | AttendanceType | 'unreported';
type ViewTabMode = 'list' | 'calendar' | 'stamps';

export const StatusScreen: React.FC = () => {
  const {
    attendances,
    members,
    myMemberName,
    isAdmin,
    settings,
    deleteAttendance,
    setActiveEditingRecord,
    setCurrentTab,
    triggerStampEffect,
  } = useApp();

  const today = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [partFilter, setPartFilter] = useState<string>('all');
  const [viewTab, setViewTab] = useState<ViewTabMode>(triggerStampEffect ? 'stamps' : 'list');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  const handleCopyRecord = async (record: AttendanceRecord) => {
    const text = formatAttendanceRecordShareText(record, members);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopySummary = async () => {
    const text = formatDailySummaryWithSections(
      settings?.clubName || '部活動',
      selectedDate,
      attendances,
      members
    );
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  // Calendar month state
  const initialYear = parseInt(today.split('-')[0], 10) || new Date().getFullYear();
  const initialMonth = parseInt(today.split('-')[1], 10) || new Date().getMonth() + 1;
  const [calYear, setCalYear] = useState<number>(initialYear);
  const [calMonth, setCalMonth] = useState<number>(initialMonth);

  const handlePrevMonth = () => {
    if (calMonth === 1) {
      setCalYear(calYear - 1);
      setCalMonth(12);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 12) {
      setCalYear(calYear + 1);
      setCalMonth(1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  const handleGoCurrentMonth = () => {
    setCalYear(initialYear);
    setCalMonth(initialMonth);
    setSelectedDate(today);
  };

  // Helper to get section and part for any member or record
  const getRecordSection = (record: AttendanceRecord): string => {
    if (record.section) return record.section;
    const m = members.find((mem) => mem.name === record.memberName);
    return m?.section || '';
  };

  const getRecordPart = (record: AttendanceRecord): string => {
    if (record.part) return record.part;
    const m = members.find((mem) => mem.name === record.memberName);
    return m?.part || '';
  };

  // Attendances for selected date
  const rawDateRecords = attendances.filter((a) => a.date === selectedDate);

  // Filter raw date records by section and part
  const dateRecords = rawDateRecords.filter((rec) => {
    const sec = getRecordSection(rec);
    const prt = getRecordPart(rec);
    if (sectionFilter !== 'all' && sec !== sectionFilter) return false;
    if (partFilter !== 'all' && prt !== partFilter) return false;
    return true;
  });

  // Unreported members calculation (also respects section and part filter)
  const reportedMemberNames = new Set(rawDateRecords.map((a) => a.memberName));
  const unreportedMembers = members
    .filter((m) => !reportedMemberNames.has(m.name))
    .filter((m) => {
      if (sectionFilter !== 'all' && m.section !== sectionFilter) return false;
      if (partFilter !== 'all' && m.part !== partFilter) return false;
      return true;
    });

  // Counts (based on filtered date records)
  const absentCount = dateRecords.filter((a) => a.type === '欠席').length;
  const tardyCount = dateRecords.filter((a) => a.type === '遅刻').length;
  const emergencyTardyCount = dateRecords.filter((a) => a.type === '緊急遽刻').length;
  const earlyCount = dateRecords.filter((a) => a.type === '早退').length;

  // Filtered attendance records (by status filter)
  const filteredRecords = dateRecords.filter((record) => {
    if (filter === 'all') return true;
    return record.type === filter;
  });

  const handlePrevDay = () => {
    setSelectedDate((prev) => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => addDays(prev, 1));
  };

  const handleGoToday = () => {
    setSelectedDate(today);
  };

  const handleDeleteRecord = async (record: AttendanceRecord) => {
    const isOwner = myMemberName && record.memberName === myMemberName;
    const promptText = isOwner
      ? 'あなたのこの連絡を削除しますか？'
      : `${record.memberName}さんの連絡を管理者権限で削除しますか？`;

    if (window.confirm(promptText)) {
      await deleteAttendance(record.id);
    }
  };

  const handleEditRecord = (record: AttendanceRecord) => {
    setActiveEditingRecord(record);
    setCurrentTab('form');
  };

  // Calendar calculations
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOfWeek = getFirstDayOfWeek(calYear, calMonth);
  const weekDayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="space-y-4 pb-24 pt-2">
      {/* 日別リスト / カレンダー / スタンプカード 切り替えタブ */}
      <div className="bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl flex items-center shadow-2xs">
        <button
          id="btn-tab-mode-list"
          onClick={() => setViewTab('list')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            viewTab === 'list'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          日別リスト
        </button>
        <button
          id="btn-tab-mode-calendar"
          onClick={() => setViewTab('calendar')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            viewTab === 'calendar'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          カレンダー
        </button>
        <button
          id="btn-tab-mode-stamps"
          onClick={() => setViewTab('stamps')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            viewTab === 'stamps'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <span className="text-sm leading-none">🎫</span>
          スタンプカード
        </button>
      </div>

      {/* ===================== VIEW 1: カレンダー表示 ===================== */}
      {viewTab === 'calendar' && (
        <div className="space-y-4">
          {/* 月移動ヘッダーカード */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <button
                id="btn-cal-prev-month"
                onClick={handlePrevMonth}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium"
                title="前月へ"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">前月</span>
              </button>

              <div className="text-center">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {calYear}年 {calMonth}月
                </h2>
                <div className="flex items-center justify-center gap-2 mt-0.5">
                  <button
                    onClick={handleGoCurrentMonth}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    今月に移動
                  </button>
                </div>
              </div>

              <button
                id="btn-cal-next-month"
                onClick={handleNextMonth}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium"
                title="翌月へ"
              >
                <span className="hidden sm:inline">翌月</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* カレンダー凡例 */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                欠: 欠席
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                遅: 遅刻
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                早: 早退
              </span>
            </div>
          </div>

          {/* 月間カレンダーグリッド */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            {/* 曜日行 */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {weekDayLabels.map((dayLabel, index) => {
                const isSunday = index === 0;
                const isSaturday = index === 6;
                return (
                  <div
                    key={dayLabel}
                    className={`py-1.5 text-xs font-bold ${
                      isSunday
                        ? 'text-red-500 dark:text-red-400'
                        : isSaturday
                        ? 'text-blue-500 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {dayLabel}
                  </div>
                );
              })}
            </div>

            {/* 日付セル */}
            <div className="grid grid-cols-7 gap-1">
              {/* 空白スロット（月の開始曜日まで） */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[64px] sm:min-h-[74px] p-1 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl" />
              ))}

              {/* 日付一覧 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = toDateString(calYear, calMonth, day);
                const isTodayDate = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const dayRecords = attendances.filter((a) => a.date === dateStr);
                const absents = dayRecords.filter((a) => a.type === '欠席').length;
                const tardies = dayRecords.filter(
                  (a) => a.type === '遅刻' || a.type === '緊急遽刻'
                ).length;
                const earlies = dayRecords.filter((a) => a.type === '早退').length;
                const hasAny = absents > 0 || tardies > 0 || earlies > 0;

                const dayOfWeek = (firstDayOfWeek + i) % 7;
                const isSun = dayOfWeek === 0;
                const isSat = dayOfWeek === 6;

                return (
                  <button
                    key={dateStr}
                    id={`cal-day-${dateStr}`}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[64px] sm:min-h-[74px] p-1 sm:p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                      isSelected
                        ? 'border-blue-600 dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/40'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {/* 日付番号 */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-extrabold ${
                          isTodayDate
                            ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]'
                            : isSun
                            ? 'text-red-500 dark:text-red-400'
                            : isSat
                            ? 'text-blue-500 dark:text-blue-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {day}
                      </span>
                      {isTodayDate && (
                        <span className="hidden sm:inline text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          今日
                        </span>
                      )}
                    </div>

                    {/* バッジ表示（欠席者数など） */}
                    <div className="flex flex-col gap-0.5 mt-1">
                      {absents > 0 && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 leading-none truncate">
                          欠{absents}
                        </span>
                      )}
                      {tardies > 0 && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 leading-none truncate">
                          遅{tardies}
                        </span>
                      )}
                      {earlies > 0 && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-yellow-100 dark:bg-yellow-950/80 text-yellow-800 dark:text-yellow-300 leading-none truncate">
                          早{earlies}
                        </span>
                      )}
                      {!hasAny && (
                        <span className="text-[9px] text-slate-300 dark:text-slate-600 leading-none block h-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 選択された日付の詳細な連絡一覧カード */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  {formatJapaneseDate(selectedDate, true)} の連絡詳細
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  タップした日付の連絡一覧
                </p>
              </div>
              <button
                onClick={() => setViewTab('list')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                日別リストで見る →
              </button>
            </div>

            {dateRecords.length === 0 ? (
              <div className="text-center py-6 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-xs">この日の欠席・遅刻・早退の連絡はありません</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  全員出席予定です
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {dateRecords.map((record) => {
                  const isOwner = myMemberName && record.memberName === myMemberName;
                  const canDelete = isOwner || isAdmin;
                  const style = typeColorStyles[record.type];

                  return (
                    <div
                      key={record.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold shadow-2xs ${style.badge}`}
                          >
                            {record.type}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {record.memberName}
                          </span>
                          {isOwner && (
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded-full">
                              あなた
                            </span>
                          )}
                          {(getRecordPart(record) || getRecordSection(record)) && (
                            <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {getRecordSection(record)}
                              {getRecordPart(record) && ` / ${getRecordPart(record)}`}
                            </span>
                          )}
                          {record.time && (
                            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                              {record.time}
                            </span>
                          )}
                        </div>
                        {record.reason && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            理由: {record.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyRecord(record)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            copiedId === record.id
                              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                              : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800'
                          }`}
                          title="文章をコピー（LINE WORKS・LINE共有用）"
                          aria-label="文章をコピー"
                        >
                          {copiedId === record.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleEditRecord(record)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="修正する"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteRecord(record)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="削除する"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: 日別リスト表示 ===================== */}
      {viewTab === 'list' && (
        <div className="space-y-4">
          {/* Date Navigation Header */}
          <div
            id="status-date-nav"
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
          >
            <div className="flex items-center justify-between">
              <button
                id="btn-status-prev-day"
                onClick={handlePrevDay}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="前日へ"
                aria-label="前日"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {formatJapaneseDate(selectedDate, true)}
                </h2>
                {selectedDate === today ? (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mt-0.5">
                    本日
                  </span>
                ) : (
                  <button
                    id="btn-return-today"
                    onClick={handleGoToday}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold mt-0.5"
                  >
                    今日に戻る
                  </button>
                )}
              </div>

              <button
                id="btn-status-next-day"
                onClick={handleNextDay}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="翌日へ"
                aria-label="翌日"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Calendar Picker input & Copy Daily Summary Button */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>カレンダーで日付を選ぶ</span>
                <input
                  type="date"
                  id="input-status-date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="sr-only"
                />
              </label>

              <button
                type="button"
                id="btn-copy-daily-summary"
                onClick={handleCopySummary}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  copiedSummary
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                }`}
                title="LINE WORKSやLINEに共有できる区分別まとめ文章をコピー"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>まとめ文章をコピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>文章をコピー（まとめ）</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary Counts Bar */}
          <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
            <button
              onClick={() => setFilter('欠席')}
              className={`p-2 rounded-xl border transition-all ${
                filter === '欠席'
                  ? 'ring-2 ring-red-500 bg-red-100 dark:bg-red-950/80 border-red-300 dark:border-red-800'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400'
              }`}
            >
              <div className="text-[10px] font-bold text-red-700 dark:text-red-400">欠席</div>
              <div className="text-base font-extrabold text-red-700 dark:text-red-400">{absentCount}</div>
            </button>

            <button
              onClick={() => setFilter('遅刻')}
              className={`p-2 rounded-xl border transition-all ${
                filter === '遅刻'
                  ? 'ring-2 ring-amber-500 bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-400'
              }`}
            >
              <div className="text-[10px] font-bold text-amber-800 dark:text-amber-400">遅刻</div>
              <div className="text-base font-extrabold text-amber-800 dark:text-amber-400">{tardyCount}</div>
            </button>

            <button
              onClick={() => setFilter('緊急遽刻')}
              className={`p-2 rounded-xl border transition-all ${
                filter === '緊急遽刻'
                  ? 'ring-2 ring-rose-500 bg-rose-100 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-400'
              }`}
            >
              <div className="text-[10px] font-bold text-rose-800 dark:text-rose-400">🚨緊急</div>
              <div className="text-base font-extrabold text-rose-800 dark:text-rose-400">{emergencyTardyCount}</div>
            </button>

            <button
              onClick={() => setFilter('早退')}
              className={`p-2 rounded-xl border transition-all ${
                filter === '早退'
                  ? 'ring-2 ring-yellow-500 bg-yellow-100 dark:bg-yellow-950/80 border-yellow-300 dark:border-yellow-800'
                  : 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-900/60 text-yellow-800 dark:text-yellow-400'
              }`}
            >
              <div className="text-[10px] font-bold text-yellow-800 dark:text-yellow-400">早退</div>
              <div className="text-base font-extrabold text-yellow-800 dark:text-yellow-400">{earlyCount}</div>
            </button>

            <button
              onClick={() => setFilter('unreported')}
              className={`p-2 rounded-xl border transition-all ${
                filter === 'unreported'
                  ? 'ring-2 ring-slate-500 bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">未連絡</div>
              <div className="text-base font-extrabold text-slate-700 dark:text-slate-300">
                {unreportedMembers.length}
              </div>
            </button>
          </div>

          {/* Section & Part Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                パート絞り込み
              </span>
              {(sectionFilter !== 'all' || partFilter !== 'all') && (
                <button
                  id="btn-reset-part-filter"
                  onClick={() => {
                    setSectionFilter('all');
                    setPartFilter('all');
                  }}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  絞り込み解除
                </button>
              )}
            </div>

            {/* Section pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                id="filter-sec-all"
                onClick={() => {
                  setSectionFilter('all');
                  setPartFilter('all');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                  sectionFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                全区分
              </button>
              {SECTION_CATEGORIES.map((sec) => (
                <button
                  key={sec}
                  id={`filter-sec-${sec}`}
                  onClick={() => {
                    setSectionFilter(sec);
                    setPartFilter('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                    sectionFilter === sec
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>

            {/* Detailed Part pills (when a specific section is chosen) */}
            {sectionFilter !== 'all' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium shrink-0">詳細:</span>
                <button
                  id="filter-part-all"
                  onClick={() => setPartFilter('all')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 transition-colors ${
                    partFilter === 'all'
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  すべて
                </button>
                {SECTION_PARTS_MAP[sectionFilter as SectionCategory]?.map((p) => (
                  <button
                    key={p}
                    id={`filter-part-${p}`}
                    onClick={() => setPartFilter(p)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 transition-colors ${
                      partFilter === p
                        ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 pl-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
            </span>
            <button
              id="filter-all"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              すべて ({dateRecords.length + unreportedMembers.length})
            </button>
            <button
              id="filter-absent"
              onClick={() => setFilter('欠席')}
              className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-colors ${
                filter === '欠席'
                  ? 'bg-red-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              欠席 ({absentCount})
            </button>
            <button
              id="filter-tardy"
              onClick={() => setFilter('遅刻')}
              className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-colors ${
                filter === '遅刻'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              遅刻 ({tardyCount})
            </button>
            <button
              id="filter-emergency-tardy"
              onClick={() => setFilter('緊急遽刻')}
              className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-colors ${
                filter === '緊急遽刻'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              緊急遽刻 ({emergencyTardyCount})
            </button>
            <button
              id="filter-early"
              onClick={() => setFilter('早退')}
              className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-colors ${
                filter === '早退'
                  ? 'bg-yellow-500 text-slate-900'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              早退 ({earlyCount})
            </button>
            <button
              id="filter-unreported"
              onClick={() => setFilter('unreported')}
              className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-colors ${
                filter === 'unreported'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              未連絡 ({unreportedMembers.length})
            </button>
          </div>

          {/* Attendance Records List */}
          {filter !== 'unreported' && (
            <div className="space-y-2.5">
              {filteredRecords.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-center text-slate-400 dark:text-slate-500">
                  <p className="text-xs">この条件に一致する連絡はありません</p>
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const isOwner = myMemberName && record.memberName === myMemberName;
                  const canDelete = isOwner || isAdmin;
                  const style = typeColorStyles[record.type];

                  return (
                    <div
                      key={record.id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-shadow shadow-xs hover:shadow-sm ${
                        isOwner
                          ? 'ring-2 ring-blue-400/50 dark:ring-blue-500/50 border-blue-300 dark:border-blue-700'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-750 text-slate-800 dark:text-slate-100 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                              {record.memberName ? record.memberName.trim().charAt(0) : <User className="w-3.5 h-3.5" />}
                            </div>
                            <h3 className="text-base font-black text-slate-900 dark:text-slate-50 tracking-tight">
                              {record.memberName}
                            </h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs ${style.badge}`}
                            >
                              {record.type}
                            </span>
                            {isOwner && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
                                あなた
                              </span>
                            )}
                            {(getRecordPart(record) || getRecordSection(record)) && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                <Music className="w-3 h-3 text-slate-400" />
                                {getRecordSection(record)}
                                {getRecordPart(record) && ` / ${getRecordPart(record)}`}
                              </span>
                            )}
                          </div>

                          {/* Time for 遅刻 / 早退 */}
                          {record.time && (
                            <div className="flex items-center gap-1 text-xs font-semibold text-amber-900 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/60 px-2 py-0.5 rounded-md inline-flex border border-amber-200 dark:border-amber-900/50">
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>{record.time}</span>
                            </div>
                          )}

                          {/* Reason */}
                          {record.reason && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                              理由: {record.reason}
                            </p>
                          )}

                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            連絡時刻: {formatTimestamp(record.createdAt)}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyRecord(record)}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              copiedId === record.id
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                                : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800'
                            }`}
                            title="文章をコピー（LINE WORKS・LINE共有用）"
                            aria-label="文章をコピー"
                          >
                            {copiedId === record.id ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => handleEditRecord(record)}
                              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                              title="修正する"
                              aria-label="修正"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteRecord(record)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors"
                              title={isAdmin && !isOwner ? '管理者権限で削除' : '削除する'}
                              aria-label="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Unreported Members Section */}
          {(filter === 'all' || filter === 'unreported') && (
            <div
              id="status-unreported-section"
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  未連絡の部員 ({unreportedMembers.length}名)
                </h3>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  まだ連絡が届いていません
                </span>
              </div>

              {unreportedMembers.length === 0 ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs text-center font-bold border border-emerald-200 dark:border-emerald-900/60">
                  🎉 全員の出欠連絡が確認できています！
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {unreportedMembers.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{m.name}</span>
                        {(m.part || m.section) && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {m.section}{m.part ? `・${m.part}` : ''}
                          </span>
                        )}
                      </div>
                      {m.grade && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {m.grade}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== VIEW 3: スタンプカード表示 ===================== */}
      {viewTab === 'stamps' && <StampCardView />}

      {/* Floating Add Attendance shortcut */}
      {viewTab !== 'stamps' && (
        <div className="pt-2 text-center">
          <button
            id="btn-status-add-attendance"
            onClick={() => {
              setActiveEditingRecord(null);
              setCurrentTab('form');
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            この日付の出欠を連絡する
          </button>
        </div>
      )}
    </div>
  );
};
