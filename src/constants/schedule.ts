import { AppSettings, WeeklyScheduleDay } from '../types';

export const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;
export const DAY_FULL_NAMES = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'] as const;

export const DEFAULT_WEEKLY_SCHEDULE: Record<number, WeeklyScheduleDay> = {
  0: { enabled: false, time: '18:00', label: 'OFF / 休み' }, // 日
  1: { enabled: true, time: '18:00', label: '放課後練習' },  // 月
  2: { enabled: true, time: '18:00', label: '放課後練習' },  // 火
  3: { enabled: true, time: '18:00', label: '放課後練習' },  // 水
  4: { enabled: true, time: '18:00', label: '放課後練習' },  // 木
  5: { enabled: true, time: '18:00', label: '放課後練習' },  // 金
  6: { enabled: true, time: '18:00', label: '午前練習 / 遠征' },  // 土
};

export function resolveScheduleForDate(
  dateStr: string,
  settings?: AppSettings
): { enabled: boolean; time: string; label?: string } {
  if (!settings) {
    return { enabled: true, time: '18:00', label: '通常練習' };
  }

  const baseTime = settings.summaryNotificationTime || '18:00';

  // 1. 日付指定の個別オーバーライド
  if (settings.dateSpecificOverrides && settings.dateSpecificOverrides[dateStr]) {
    const override = settings.dateSpecificOverrides[dateStr];
    return {
      enabled: override.enabled,
      time: override.time || baseTime,
      label: override.enabled ? '特別予定' : 'OFF / 休み',
    };
  }

  // 2. 曜日別のスケジュール
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = dateObj.getDay();

  if (settings.weeklyNotificationSchedule && settings.weeklyNotificationSchedule[dayOfWeek]) {
    const sched = settings.weeklyNotificationSchedule[dayOfWeek];
    // 基本の出欠確認時刻（summaryNotificationTime）が設定されている場合は反映
    const effectiveTime = sched.time && sched.time !== '18:00' ? sched.time : (baseTime || sched.time || '18:00');
    return {
      enabled: sched.enabled,
      time: effectiveTime,
      label: sched.label || (sched.enabled ? '通常練習' : 'OFF / 休み'),
    };
  }

  return {
    enabled: settings.notificationsEnabled !== false,
    time: baseTime,
    label: settings.notificationsEnabled !== false ? '通常練習' : 'OFF / 休み',
  };
}

export function isAllowedNotificationTimeRange(hours: number, minutes: number): boolean {
  // 0:00〜6:00 は深夜静粛時間帯
  return hours >= 6 && hours < 24;
}

export function isMidnightQuietHours(hours: number): boolean {
  return hours >= 0 && hours < 6;
}
