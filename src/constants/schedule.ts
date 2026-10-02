import { AppSettings, DaySchedule } from '../types';

export interface DayOfWeekMeta {
  key: number; // 0 to 6
  strKey: string; // '0' to '6'
  name: string; // '日曜日'
  short: string; // '日'
  isWeekend: boolean;
  colorClass: string;
  bgLightClass: string;
}

export const DAYS_OF_WEEK_META: DayOfWeekMeta[] = [
  {
    key: 0,
    strKey: '0',
    name: '日曜日',
    short: '日',
    isWeekend: true,
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgLightClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900',
  },
  {
    key: 1,
    strKey: '1',
    name: '月曜日',
    short: '月',
    isWeekend: false,
    colorClass: 'text-slate-700 dark:text-slate-300',
    bgLightClass: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  {
    key: 2,
    strKey: '2',
    name: '火曜日',
    short: '火',
    isWeekend: false,
    colorClass: 'text-slate-700 dark:text-slate-300',
    bgLightClass: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  {
    key: 3,
    strKey: '3',
    name: '水曜日',
    short: '水',
    isWeekend: false,
    colorClass: 'text-slate-700 dark:text-slate-300',
    bgLightClass: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  {
    key: 4,
    strKey: '4',
    name: '木曜日',
    short: '木',
    isWeekend: false,
    colorClass: 'text-slate-700 dark:text-slate-300',
    bgLightClass: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  {
    key: 5,
    strKey: '5',
    name: '金曜日',
    short: '金',
    isWeekend: false,
    colorClass: 'text-slate-700 dark:text-slate-300',
    bgLightClass: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  {
    key: 6,
    strKey: '6',
    name: '土曜日',
    short: '土',
    isWeekend: true,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgLightClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  },
];

export const DEFAULT_WEEKLY_SCHEDULE: Record<string, DaySchedule> = {
  '0': { enabled: false, time: '08:30', label: 'OFF / 休み' },
  '1': { enabled: true, time: '16:00', label: '放課後練習' },
  '2': { enabled: true, time: '16:00', label: '放課後練習' },
  '3': { enabled: true, time: '16:00', label: '放課後練習' },
  '4': { enabled: true, time: '16:00', label: '放課後練習' },
  '5': { enabled: true, time: '16:00', label: '放課後練習' },
  '6': { enabled: true, time: '08:30', label: '午前練習 / 遠征' },
};

export const COMMON_TIME_PRESETS = [
  '07:30',
  '08:00',
  '08:30',
  '12:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '18:00',
];

export const COMMON_LABEL_PRESETS = [
  '放課後練習',
  '朝練習',
  '午前練習',
  '午後練習',
  '大会・遠征',
  '自主練習',
  'OFF / 休み',
];

export interface ResolvedScheduleResult {
  enabled: boolean;
  time: string;
  label?: string;
  isOverride: boolean;
  dayOfWeek: number;
  dayMeta: DayOfWeekMeta;
}

export function resolveScheduleForDate(
  dateStr: string,
  settings?: AppSettings
): ResolvedScheduleResult {
  const parts = (dateStr || '').split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = isNaN(dateObj.getTime()) ? new Date().getDay() : dateObj.getDay();
  const dayMeta = DAYS_OF_WEEK_META[dayOfWeek];

  const configuredTime = (settings?.summaryNotificationTime || '').trim();

  // 【要件5】デバッグ用のログ
  console.log(`[resolveScheduleForDate] Checking schedule for ${dateStr} (${dayMeta.name})`, {
    notificationsEnabled: settings?.notificationsEnabled,
    configuredTime
  });

  // 【要件3】全体通知機能がOFFの場合は通知を生成しない
  if (!settings || !settings.notificationsEnabled) {
    console.log(`[resolveScheduleForDate] Global notifications are OFF.`);
    return {
      enabled: false,
      time: configuredTime,
      label: '通知OFF (全体設定)',
      isOverride: false,
      dayOfWeek,
      dayMeta,
    };
  }

  // 1. カレンダー特定日の個別設定 (date-specific override)
  if (settings.dateSpecificOverrides && settings.dateSpecificOverrides[dateStr]) {
    const override = settings.dateSpecificOverrides[dateStr];
    const finalTime = override.time || configuredTime;
    return {
      enabled: override.enabled && Boolean(finalTime),
      time: finalTime,
      label: override.label,
      isOverride: true,
      dayOfWeek,
      dayMeta,
    };
  }

  // 2. 曜日別設定 (weekly schedule)
  const weekly = settings.weeklyNotificationSchedule;
  if (weekly) {
    const daySched = weekly[String(dayOfWeek)] || weekly[dayOfWeek as any];
    if (daySched) {
      const finalTime = (daySched.time || configuredTime).trim();
      
      console.log(`[resolveScheduleForDate] Weekly schedule found for ${dayMeta.name}:`, {
        enabled: daySched.enabled,
        time: daySched.time,
        finalTime
      });

      if (daySched.enabled === false) {
        return {
          enabled: false,
          time: finalTime,
          label: daySched.label || 'OFF',
          isOverride: false,
          dayOfWeek,
          dayMeta,
        };
      }
      
      // 時刻が設定されている場合のみ有効とする
      const isEnabled = Boolean(finalTime);
      return {
        enabled: isEnabled,
        time: finalTime,
        label: daySched.label,
        isOverride: false,
        dayOfWeek,
        dayMeta,
      };
    }
  }

  // 3. 管理者が設定画面で入力した「まとめ通知の時刻」 (フォールバック)
  return {
    enabled: Boolean(configuredTime),
    time: configuredTime,
    label: '',
    isOverride: false,
    dayOfWeek,
    dayMeta,
  };
}

/**
 * 6:00〜22:00 の有効通知時間帯かチェック
 * 深夜・早朝（0:00〜5:59、22:01以降）の自動通知を抑制
 */
export function isAllowedNotificationTimeRange(timeStr: string): boolean {
  if (!timeStr) return false;
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return false;
  const [h, m] = parts;
  if (h < 6) return false;
  if (h > 22) return false;
  if (h === 22 && m > 0) return false;
  return true;
}

/**
 * 深夜0時〜5時59分（JST）の間かどうかをチェック（通知完全抑制対象）
 */
export function isMidnightQuietHours(date: Date = new Date()): boolean {
  // Use Intl to get hour in JST
  const jstHourStr = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    hour12: false
  }).format(date);
  
  const h = parseInt(jstHourStr, 10);
  return h >= 0 && h < 6;
}
