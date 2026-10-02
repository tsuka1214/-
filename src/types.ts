export type AttendanceType = '出席' | '欠席' | '遅刻' | '早退' | '緊急遽刻';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  memberName: string;
  section?: string; // 区分: '木管' | '金管' | '打楽器'
  part?: string; // 詳細パート: 'クラリネット', 'トランペット', etc.
  type: AttendanceType;
  reason?: string;
  time?: string; // e.g. "16:30ごろ" for 遅刻 / 早退
  authorDeviceToken?: string; // identifier stored in localStorage to recognize "your" post
  createdAt: number; // timestamp
  updatedAt?: number;
}

export interface ClubMember {
  id: string;
  name: string;
  grade?: string; // e.g. "1年", "2年", "3年"
  role?: string; // e.g. "部長", "副部長", "部員"
  section?: string; // 区分: '木管' | '金管' | '打楽器'
  part?: string; // 詳細パート
  order?: number;
}

export interface AttendancePattern {
  id: string;
  name: string;
  type: AttendanceType;
  time?: string;
  reason?: string;
  isCustom?: boolean;
}

export interface LineWorksConfig {
  enabled: boolean;
  mode?: 'api2' | 'webhook'; // default to api2 if configured
  webhookUrl?: string;
  botName?: string;
  sendDailySummary: boolean;
  sendTardyAlert: boolean;
  sendEventReminder?: boolean; // 【新規】イベントリマインダー通知
  // LINE WORKS API 2.0 parameters
  clientId?: string;
  clientSecret?: string;
  serviceAccount?: string;
  privateKey?: string; // RSA Private Key in PEM format
  botId?: string;
  channelId?: string; // target group chat / channel id
}

export interface DaySchedule {
  enabled: boolean; // この曜日にまとめ通知を配信するかどうか
  time: string; // 例: "08:30" や "16:00"
  label?: string; // 例: "朝練", "午後練習", "休日練習", "OFF/部活なし"
}

export interface SchedulePreset {
  id: string;
  name: string;
  schedule: Record<string, DaySchedule>;
}

export interface DateOverrideSchedule {
  enabled: boolean;
  time: string;
  label?: string;
}

export type WeeklySchedule = Record<number, DaySchedule>;

export interface AppSettings {
  summaryNotificationTime: string; // e.g. "08:30" (デフォルト・フォールバック)
  weeklyNotificationSchedule?: Record<string, DaySchedule>; // 曜日別設定 ("0" = 日, "1" = 月, ..., "6" = 土)
  dateSpecificOverrides?: Record<string, DateOverrideSchedule>; // カレンダー特定日の例外設定 ("YYYY-MM-DD")
  notificationsEnabled: boolean;
  adminPasscode: string; // default "admin1234"
  clubName: string; // default "部活動"
  lastSummaryDate?: string; // last date the daily summary notification was fired
  customPatterns?: AttendancePattern[];
  updatedAt?: number;
  lineWorks?: LineWorksConfig;
  lineWorksKeyReminder?: LineWorksConfig; // 【新規】鍵催促用LINE WORKS連携
  lineWorksEvents?: LineWorksConfig; // 【新規】イベントリマインダー用LINE WORKS連携
  keyNames?: {
    key1: string;
    key2: string;
  };
  keyReminders?: KeyRemindersSettings;
  keyResetAdminOnly?: boolean;
  autoResetKeysAtMidnight?: boolean;
  autoAttendance?: {
    enabled: boolean;
    mode: 'on_app_open' | 'at_specific_time';
    time?: string; // "HH:mm"
  };
  penaltyThreshold?: number; // 【旧】罰ゲーム執行に必要なスタンプ数 (デフォルト 3)
  penaltyStages?: PenaltyStage[]; // 【新】多段階罰ゲーム設定
  schedulePresets?: SchedulePreset[]; // 通知スケジュールのカスタムプリセット
  lastLwKRStatus?: {
    success: boolean;
    error?: string;
    timestamp: number;
  };
}

export interface KeyRemindersSettings {
  enabled: boolean;
  appNotificationEnabled?: boolean; // 【新規】アプリ内通知のオンオフ
  lineWorksNotificationEnabled?: boolean; // 【新規】LINE WORKS通知のオンオフ
  startTime: string; // 例: "18:00"
  intervalMinutes: number; // 例: 15, 30
  maxCount: number; // 例: 3, 5
  onlyOnActiveDays?: boolean; // 【新規】出欠確認がオンの日のみ催促する
  useSummaryTime?: boolean; // 【新規】まとめ通知と同じ時刻に催促を開始する
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  body?: string;
  type: 'urgent' | 'summary' | 'info' | 'reminder';
  relatedDate?: string; // YYYY-MM-DD
  attendanceId?: string;
  isRead?: boolean;
  createdAt: number;
  keyId?: KeyId;
  reminderCount?: number;
}

export type TabType = 'home' | 'form' | 'status' | 'notifications' | 'settings' | 'events';

export type KeyId = 'key1' | 'key2';
export type KeyStatusType = 'open' | 'closed';

export interface ClubKeyStatus {
  keyId?: KeyId;
  status: KeyStatusType;
  updatedAt: number;
  operatorName: string;
  operatorSection?: string;
  operatorPart?: string;
  keyName?: string;
}

export interface ClubKeyLog {
  id: string;
  keyId?: KeyId;
  status: KeyStatusType;
  updatedAt: number;
  operatorName: string;
  operatorSection?: string;
  operatorPart?: string;
  keyName?: string;
}

export type StampStage = 'normal' | 'slight_danger' | 'heavy_danger' | 'legendary';

export interface PenaltyStage {
  threshold: number;
  label?: string; // 自由な名前 (例: 「小罰」「大罰」「伝説の罰」)
  description?: string; // 罰ゲームの具体的な内容 (例: 「楽器庫の掃除」)
}

export interface EmergencyStampCard {
  id: string;
  memberName: string;
  section?: string;
  part?: string;
  totalCount: number;
  monthlyCounts: Record<string, number>; // "YYYY-MM" -> number
  penaltyGame?: string;
  milestonesNotified?: number[];
  updatedAt: number;
}

export interface PackingListCategory {
  category: string;
  items: string[];
}

export interface EventClothing {
  top: string;
  bottom: string;
  shoes?: string;
  other?: string;
}

export interface ClubEvent {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  location?: string;
  gatheringTime?: string;
  memo?: string;
  clothing?: EventClothing;
  packingList?: PackingListCategory[];
  reminderEnabled?: boolean;
  reminderDays?: number[]; // 【新規】通知する日数 (例: [7, 3, 1, 0])
  createdAt: number;
  updatedAt: number;
}

