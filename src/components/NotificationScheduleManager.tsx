import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Send,
  Trash2,
  Plus,
  Copy,
  Info,
  Check,
  X,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  DAYS_OF_WEEK_META,
  DEFAULT_WEEKLY_SCHEDULE,
  COMMON_TIME_PRESETS,
  COMMON_LABEL_PRESETS,
  resolveScheduleForDate,
} from '../constants/schedule';
import { DaySchedule, DateOverrideSchedule, SchedulePreset } from '../types';
import { getTodayString, formatJapaneseDate } from '../utils/date';

const TimePulldown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [hour, minute] = (value || '08:00').split(':');

  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minute}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hour}:${newMinute}`);
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={hour}
        onChange={(e) => handleHourChange(e.target.value)}
        disabled={disabled}
        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none disabled:opacity-40"
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <option key={i} value={String(i).padStart(2, '0')}>
            {String(i).padStart(2, '0')}時
          </option>
        ))}
      </select>
      <span className="font-bold text-slate-400">:</span>
      <select
        value={minute}
        onChange={(e) => handleMinuteChange(e.target.value)}
        disabled={disabled}
        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none disabled:opacity-40"
      >
        {Array.from({ length: 60 }).map((_, i) => (
          <option key={i} value={String(i).padStart(2, '0')}>
            {String(i).padStart(2, '0')}分
          </option>
        ))}
      </select>
    </div>
  );
};

export const NotificationScheduleManager: React.FC = () => {
  const { settings, updateSettings, triggerManualSummary, attendances } = useAppContext();

  const [activeTab, setActiveTab] = useState<'weekly' | 'calendar'>('weekly');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [testSummaryStatus, setTestSummaryStatus] = useState<string | null>(null);
  const [isSavingPreset, setIsSavingPreset] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Local state for weekly schedule
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, DaySchedule>>(
    settings?.weeklyNotificationSchedule || DEFAULT_WEEKLY_SCHEDULE
  );

  // Local state for date overrides
  const [dateOverrides, setDateOverrides] = useState<Record<string, DateOverrideSchedule>>(
    settings?.dateSpecificOverrides || {}
  );

  // Sync with Firestore settings when they change, but only if not currently editing (to avoid jumping)
  // Actually, for simplicity and reliability, we'll sync whenever settings change.
  React.useEffect(() => {
    if (settings?.weeklyNotificationSchedule) {
      setWeeklySchedule(settings.weeklyNotificationSchedule);
    }
    if (settings?.dateSpecificOverrides) {
      setDateOverrides(settings.dateSpecificOverrides);
    }
  }, [settings?.weeklyNotificationSchedule, settings?.dateSpecificOverrides]);

  // Calendar navigation state
  const todayStr = getTodayString();
  const todayParts = todayStr.split('-').map(Number);
  const [calendarYear, setCalendarYear] = useState<number>(todayParts[0] || new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(todayParts[1] || new Date().getMonth() + 1); // 1-12
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr);

  // Selected date editing state in calendar view
  const [overrideEnabled, setOverrideEnabled] = useState<boolean>(true);
  const [overrideTime, setOverrideTime] = useState<string>('08:30');
  const [overrideLabel, setOverrideLabel] = useState<string>('');
  const [isEditingOverride, setIsEditingOverride] = useState<boolean>(false);

  // Handle day of week change
  const handleDayChange = async (
    dayStrKey: string,
    updates: Partial<DaySchedule>
  ) => {
    const nextWeekly = {
      ...weeklySchedule,
      [dayStrKey]: {
        ...(weeklySchedule[dayStrKey] || DEFAULT_WEEKLY_SCHEDULE[dayStrKey] || {
          enabled: true,
          time: '16:00',
          label: '',
        }),
        ...updates,
      },
    };
    
    setWeeklySchedule(nextWeekly);
    
    // 要件：時刻を変更したら即座に保存する
    try {
      await updateSettings({
        weeklyNotificationSchedule: nextWeekly,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to auto-save weekly schedule:', err);
    }
  };

  // Quick preset actions for weekly schedule
  const applyPreset = async (type: 'standard' | 'all16' | 'all0830' | 'weekendOff') => {
    let next: Record<string, DaySchedule> = { ...weeklySchedule };
    
    if (type === 'standard') {
      next = {
        '0': { enabled: false, time: '08:30', label: 'OFF / 休み' },
        '1': { enabled: true, time: '16:00', label: '放課後練習' },
        '2': { enabled: true, time: '16:00', label: '放課後練習' },
        '3': { enabled: true, time: '16:00', label: '放課後練習' },
        '4': { enabled: true, time: '16:00', label: '放課後練習' },
        '5': { enabled: true, time: '16:00', label: '放課後練習' },
        '6': { enabled: true, time: '08:30', label: '午前練習 / 遠征' },
      };
    } else if (type === 'all16') {
      for (let i = 0; i <= 6; i++) {
        const key = String(i);
        next[key] = { enabled: true, time: '16:00', label: i === 0 || i === 6 ? '休日練習' : '放課後練習' };
      }
    } else if (type === 'all0830') {
      for (let i = 0; i <= 6; i++) {
        const key = String(i);
        next[key] = { enabled: true, time: '08:30', label: '朝練習 / 午前' };
      }
    } else if (type === 'weekendOff') {
      next['0'] = { ...(next['0'] || { time: '08:30' }), enabled: false, label: 'OFF / 休み' };
      next['6'] = { ...(next['6'] || { time: '08:30' }), enabled: false, label: 'OFF / 休み' };
    }

    setWeeklySchedule(next);
    try {
      await updateSettings({ weeklyNotificationSchedule: next });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Custom presets management
  const saveCurrentAsPreset = async () => {
    if (!newPresetName.trim()) return;
    const newPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      schedule: { ...weeklySchedule },
    };
    const updatedPresets = [...(settings?.schedulePresets || []), newPreset];
    try {
      await updateSettings({ schedulePresets: updatedPresets });
      setNewPresetName('');
      setIsSavingPreset(false);
    } catch (err) {
      console.error('Failed to save preset:', err);
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!confirm('このパターンを削除してもよろしいですか？')) return;
    const updatedPresets = (settings?.schedulePresets || []).filter(p => p.id !== presetId);
    try {
      await updateSettings({ schedulePresets: updatedPresets });
    } catch (err) {
      console.error('Failed to delete preset:', err);
    }
  };

  const applyCustomPreset = async (preset: SchedulePreset) => {
    const next = { ...preset.schedule };
    setWeeklySchedule(next);
    try {
      await updateSettings({ weeklyNotificationSchedule: next });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Copy one day's setting to weekdays (Mon-Fri)
  const copyToWeekdays = async (sourceDayKey: string) => {
    const source = weeklySchedule[sourceDayKey] || DEFAULT_WEEKLY_SCHEDULE[sourceDayKey];
    if (!source) return;
    const next = {
      ...weeklySchedule,
      '1': { ...source },
      '2': { ...source },
      '3': { ...source },
      '4': { ...source },
      '5': { ...source },
    };
    setWeeklySchedule(next);
    try {
      await updateSettings({ weeklyNotificationSchedule: next });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Save changes to Firestore
  const handleSaveAll = async () => {
    try {
      await updateSettings({
        weeklyNotificationSchedule: weeklySchedule,
        dateSpecificOverrides: dateOverrides,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save schedule:', err);
      alert('設定の保存に失敗しました。ネットワーク状態を確認してください。');
    }
  };

  // Trigger manual summary test
  const handleRunManualSummary = async () => {
    setTestSummaryStatus('配信中...');
    try {
      await triggerManualSummary(todayStr);
      setTestSummaryStatus('本日のまとめ通知を送信しました！');
      setTimeout(() => setTestSummaryStatus(null), 3500);
    } catch (err) {
      console.error(err);
      setTestSummaryStatus('送信中にエラーが発生しました');
      setTimeout(() => setTestSummaryStatus(null), 3500);
    }
  };

  // Calendar calculation
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    // 0 = Sunday, 1 = Monday, etc.
    return new Date(year, month - 1, 1).getDay();
  };

  const daysInCurrentMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDayOffset = getFirstDayOffset(calendarYear, calendarMonth);

  const prevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarYear(calendarYear - 1);
      setCalendarMonth(12);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarYear(calendarYear + 1);
      setCalendarMonth(1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const goToToday = () => {
    setCalendarYear(todayParts[0]);
    setCalendarMonth(todayParts[1]);
    setSelectedCalendarDate(todayStr);
  };

  // When a calendar date is selected
  const handleSelectDate = (dateStr: string) => {
    setSelectedCalendarDate(dateStr);
    const existingOverride = dateOverrides[dateStr];
    if (existingOverride) {
      setIsEditingOverride(true);
      setOverrideEnabled(existingOverride.enabled);
      setOverrideTime(existingOverride.time);
      setOverrideLabel(existingOverride.label || '');
    } else {
      setIsEditingOverride(false);
      // Pre-fill with day of week's setting
      const resolved = resolveScheduleForDate(dateStr, settings);
      setOverrideEnabled(resolved.enabled);
      setOverrideTime(resolved.time);
      setOverrideLabel(resolved.label || '');
    }
  };

  // Save single date override
  const handleSaveDateOverride = async () => {
    if (!selectedCalendarDate) return;
    const nextOverrides = {
      ...dateOverrides,
      [selectedCalendarDate]: {
        enabled: overrideEnabled,
        time: overrideTime,
        label: overrideLabel.trim() || undefined,
      },
    };
    setDateOverrides(nextOverrides);
    setIsEditingOverride(true);
    
    // Auto-save override
    try {
      await updateSettings({
        dateSpecificOverrides: nextOverrides,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Remove single date override
  const handleRemoveDateOverride = async (dateKey: string) => {
    const nextOverrides = { ...dateOverrides };
    delete nextOverrides[dateKey];
    setDateOverrides(nextOverrides);
    
    if (selectedCalendarDate === dateKey) {
      setIsEditingOverride(false);
      const resolved = resolveScheduleForDate(dateKey, {
        ...settings,
        weeklyNotificationSchedule: weeklySchedule,
        dateSpecificOverrides: {},
      });
      setOverrideEnabled(resolved.enabled);
      setOverrideTime(resolved.time);
      setOverrideLabel(resolved.label || '');
    }

    // Auto-save removal
    try {
      await updateSettings({
        dateSpecificOverrides: nextOverrides,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Today's resolved schedule (using local state for immediate feedback)
  const todayResolved = resolveScheduleForDate(todayStr, {
    ...settings,
    weeklyNotificationSchedule: weeklySchedule,
    dateSpecificOverrides: dateOverrides,
  });

  const isSentToday = settings?.lastSummaryDate === todayStr;

  return (
    <div
      id="notification-schedule-manager"
      className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>通知時刻設定（曜日別・カレンダー連携）</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            部活動の練習予定に合わせて、曜日ごとおよび祝日・合宿などの特定日ごとに通知時刻を設定できます
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            id="tab-weekly-schedule"
            onClick={() => setActiveTab('weekly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'weekly'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>曜日別設定</span>
          </button>
          <button
            type="button"
            id="tab-calendar-schedule"
            onClick={() => {
              setActiveTab('calendar');
              if (!selectedCalendarDate) handleSelectDate(todayStr);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>カレンダー（例外設定）</span>
            {Object.keys(dateOverrides).length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                {Object.keys(dateOverrides).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Today's Schedule Live Status Banner */}
      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 rounded-xl border border-blue-200/80 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
              本日の配信予定 ({formatJapaneseDate(todayStr, false)})
            </span>
            {todayResolved.isOverride ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                カレンダー個別設定適用中
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                {todayResolved.dayMeta.name}の基本設定
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {todayResolved.enabled ? (
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  本日は{todayResolved.time}に通知予定
                </span>
                {todayResolved.label && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    ({todayResolved.label})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                本日は通知OFF
              </span>
            )}

            {isSentToday && (
              <span className="ml-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                本日配信完了済
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunManualSummary}
          id="btn-run-manual-summary"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all self-start sm:self-auto shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>今すぐテスト配信</span>
        </button>
      </div>

      {testSummaryStatus && (
        <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 text-xs rounded-xl flex items-center gap-2 font-medium">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{testSummaryStatus}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>通知時刻スケジュール（曜日・カレンダー設定）を保存しました！</span>
        </div>
      )}

      {/* TAB 1: 曜日別設定 */}
      {activeTab === 'weekly' && (
        <div className="space-y-3.5">
          {/* Preset buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>よく使うパターンのワンタップ反映</span>
              </div>
              {!isSavingPreset ? (
                <button
                  type="button"
                  onClick={() => setIsSavingPreset(true)}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  現在の設定をパターン保存
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="パターン名を入力..."
                    className="px-2 py-1 text-[10px] border border-blue-200 dark:border-blue-800 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={saveCurrentAsPreset}
                    className="px-2 py-1 text-[10px] font-bold bg-blue-600 text-white rounded-md"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSavingPreset(false);
                      setNewPresetName('');
                    }}
                    className="px-2 py-1 text-[10px] font-bold text-slate-500"
                  >
                    キャンセル
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {/* Default Presets */}
              <button
                type="button"
                onClick={() => applyPreset('standard')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                平日16:00 / 土曜08:30 / 日曜OFF（標準）
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all16')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                全日 16:00
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all0830')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                全日 08:30
              </button>
              <button
                type="button"
                onClick={() => applyPreset('weekendOff')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                土日をOFFにする
              </button>

              {/* Custom Presets */}
              {(settings?.schedulePresets || []).map((preset) => (
                <div key={preset.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => applyCustomPreset(preset)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1"
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePreset(preset.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 7 Days List */}
          <div className="space-y-2">
            {DAYS_OF_WEEK_META.map((meta) => {
              const current = weeklySchedule[meta.strKey] || DEFAULT_WEEKLY_SCHEDULE[meta.strKey] || {
                enabled: true,
                time: '16:00',
                label: '',
              };

              return (
                <div
                  key={meta.strKey}
                  id={`schedule-day-${meta.strKey}`}
                  className={`p-3 rounded-xl border transition-all ${
                    current.enabled
                      ? 'bg-slate-50/80 dark:bg-slate-850 border-slate-200 dark:border-slate-700'
                      : 'bg-slate-100/40 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Day badge & toggle */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center border shadow-2xs ${meta.bgLightClass}`}
                        >
                          {meta.short}
                        </span>
                        <span className={`text-xs font-bold ${meta.colorClass}`}>
                          {meta.name}
                        </span>
                      </div>

                      {/* Enable toggle */}
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={current.enabled}
                          onChange={(e) => handleDayChange(meta.strKey, { enabled: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          {current.enabled ? '通知する' : 'OFF (通知なし)'}
                        </span>
                      </label>
                    </div>

                    {/* Time picker & Label */}
                    {current.enabled ? (
                      <div className="flex items-center gap-2 flex-wrap">
                      {/* Time Input */}
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <TimePulldown
                            value={current.time}
                            onChange={(val) => handleDayChange(meta.strKey, { time: val })}
                          />
                        </div>

                        {/* Quick Time Presets */}
                        <div className="hidden sm:flex items-center gap-1">
                          {['16:00', '08:30'].map((pTime) => (
                            <button
                              key={pTime}
                              type="button"
                              onClick={() => handleDayChange(meta.strKey, { time: pTime })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                current.time === pTime
                                  ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {pTime}
                            </button>
                          ))}
                        </div>

                        {/* Label Input */}
                        <input
                          type="text"
                          value={current.label || ''}
                          onChange={(e) => handleDayChange(meta.strKey, { label: e.target.value })}
                          placeholder="練習名 (例: 放課後練習)"
                          className="w-28 sm:w-36 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />

                        {/* Copy to weekdays button for Monday */}
                        {meta.key === 1 && (
                          <button
                            type="button"
                            onClick={() => copyToWeekdays('1')}
                            title="月曜日の設定（時刻・ラベル）を火〜金曜日に一括コピー"
                            className="px-2 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>平日にコピー</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        この曜日は出欠まとめ通知を配信しません
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: カレンダー（特定日例外設定） */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            日付をタップして、祝日・大会・合宿・テスト期間などの特別スケジュール（例外設定）を登録できます。
          </p>

          {/* Month Navigation */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="前月"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                {calendarYear}年 {calendarMonth}月
              </h4>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="翌月"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
            >
              今月へ
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900">
            {/* Weekday column headers */}
            <div className="grid grid-cols-7 text-center bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 py-1.5 text-xs font-bold">
              <span className="text-rose-600 dark:text-rose-400">日</span>
              <span className="text-slate-700 dark:text-slate-300">月</span>
              <span className="text-slate-700 dark:text-slate-300">火</span>
              <span className="text-slate-700 dark:text-slate-300">水</span>
              <span className="text-slate-700 dark:text-slate-300">木</span>
              <span className="text-slate-700 dark:text-slate-300">金</span>
              <span className="text-blue-600 dark:text-blue-400">土</span>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800">
              {/* Empty placeholder cells before 1st day */}
              {Array.from({ length: firstDayOffset }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="bg-slate-50/30 dark:bg-slate-900/30 min-h-[56px] p-1 opacity-20"
                />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInCurrentMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const monthPad = String(calendarMonth).padStart(2, '0');
                const dayPad = String(dayNum).padStart(2, '0');
                const dateStr = `${calendarYear}-${monthPad}-${dayPad}`;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedCalendarDate;
                const dateObj = new Date(calendarYear, calendarMonth - 1, dayNum);
                const dayOfWeek = dateObj.getDay();

                const resolved = resolveScheduleForDate(dateStr, {
                  ...settings,
                  weeklyNotificationSchedule: weeklySchedule,
                  dateSpecificOverrides: dateOverrides,
                });

                const hasOverride = Boolean(dateOverrides[dateStr]);

                return (
                  <button
                    type="button"
                    key={dateStr}
                    onClick={() => handleSelectDate(dateStr)}
                    className={`min-h-[58px] p-1 text-left flex flex-col justify-between transition-all focus:outline-none ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/80 ring-2 ring-blue-600 dark:ring-blue-400 z-10'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-blue-600 text-white font-extrabold'
                            : dayOfWeek === 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : dayOfWeek === 6
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {hasOverride && (
                        <span
                          title="個別設定あり"
                          className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                        >
                          ★特
                        </span>
                      )}
                    </div>

                    {/* Schedule Time Pill */}
                    <div className="mt-1">
                      {resolved.enabled ? (
                        <div
                          className={`text-[10px] font-bold px-1 py-0.5 rounded truncate text-center ${
                            hasOverride
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {resolved.time}
                        </div>
                      ) : (
                        <div
                          className={`text-[9px] font-semibold px-1 py-0.5 rounded text-center truncate ${
                            hasOverride
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          OFF
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Detail / Override Editor */}
          {selectedCalendarDate && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>選択日: {formatJapaneseDate(selectedCalendarDate, true)}</span>
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {dateOverrides[selectedCalendarDate]
                      ? 'この日は「個別スケジュール（例外）」が設定されています'
                      : '現在は「曜日の通常スケジュール」が適用されています'}
                  </p>
                </div>

                {dateOverrides[selectedCalendarDate] && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDateOverride(selectedCalendarDate)}
                    className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg flex items-center gap-1 border border-rose-200 dark:border-rose-900 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>個別設定を解除</span>
                  </button>
                )}
              </div>

              {/* Form to set/override */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    この日の通知配信
                  </label>
                  <select
                    value={overrideEnabled ? 'yes' : 'no'}
                    onChange={(e) => setOverrideEnabled(e.target.value === 'yes')}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="yes">通知する</option>
                    <option value="no">通知しない (部活休み / OFF)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    通知時刻
                  </label>
                  <TimePulldown
                    value={overrideTime}
                    onChange={setOverrideTime}
                    disabled={!overrideEnabled}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    練習内容・メモ (任意)
                  </label>
                  <input
                    type="text"
                    value={overrideLabel}
                    onChange={(e) => setOverrideLabel(e.target.value)}
                    placeholder="例: 祝日午前練習、合宿"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick Presets for this date */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-semibold text-slate-400">クイック設定:</span>
                {['08:30 午前練習', '16:00 午後練習', '07:30 朝練', 'OFF 休み'].map((preset) => {
                  const [t, l] = preset.split(' ');
                  const isOff = t === 'OFF';
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (isOff) {
                          setOverrideEnabled(false);
                          setOverrideLabel(l || 'OFF');
                        } else {
                          setOverrideEnabled(true);
                          setOverrideTime(t);
                          setOverrideLabel(l || '');
                        }
                      }}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700"
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDateOverride}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>この日の特別設定をカレンダーに適用</span>
                </button>
              </div>
            </div>
          )}

          {/* List of registered overrides */}
          {Object.keys(dateOverrides).length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                登録済みのカレンダー個別設定一覧 ({Object.keys(dateOverrides).length}件)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.entries(dateOverrides) as [string, DateOverrideSchedule][])
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dStr, override]) => (
                    <div
                      key={dStr}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>{formatJapaneseDate(dStr, true)}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              override.enabled
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {override.enabled ? `${override.time} 送信` : 'OFF (休み)'}
                          </span>
                        </div>
                        {override.label && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {override.label}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDateOverride(dStr)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="解除する"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          id="btn-save-notification-schedule"
          onClick={handleSaveAll}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>通知スケジュール設定（曜日・カレンダー）を保存する</span>
        </button>
      </div>
    </div>
  );
};
