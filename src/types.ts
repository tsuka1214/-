export type TabType = 'home' | 'status' | 'form' | 'calendar' | 'notifications' | 'settings';

export type ActiveAttendanceType = '欠席' | '遅刻' | '早退' | '緊急遽刻';
export type AttendanceType = ActiveAttendanceType | '出席';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  memberName: string;
  type: AttendanceType;
  reason?: string;
  time?: string;
  section?: string;
  part?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ClubMember {
  id: string;
  name: string;
  grade?: string;
  role?: string;
  section?: string;
  part?: string;
  createdAt?: number;
}

export interface PenaltyStage {
  threshold: number;
  title: string;
  penaltyText: string;
}

export interface JustReachedPenaltyStage {
  stage: PenaltyStage;
  count: number;
}

export type PackingListCategory = '合宿' | 'コンクール' | '演奏会' | '通常練習' | 'その他';
export type EventClothing = '制服' | '部Tシャツ' | '私服' | 'ステージ衣装' | 'その他';

export interface ClubEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  location?: string;
  category?: PackingListCategory;
  clothing?: EventClothing;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type KeyId = 'key1' | 'key2';
export type KeyStatusType = 'open' | 'closed';

export interface ClubKeyStatus {
  id: KeyId;
  status: KeyStatusType;
  reportedBy?: string;
  reporterName?: string;
  operatorName?: string;
  section?: string;
  operatorSection?: string;
  part?: string;
  operatorPart?: string;
  updatedAt: number;
  timestamp?: number;
  createdAt?: number;
  resetBy?: string;
  resetAt?: number;
  lastClosedReporter?: string;
  lastClosedAt?: number;
}

export interface ClubKeyLog {
  id: string;
  keyId: KeyId;
  keyName?: string;
  status: KeyStatusType;
  reportedBy: string;
  reporterName?: string;
  operatorName?: string;
  section?: string;
  operatorSection?: string;
  part?: string;
  operatorPart?: string;
  timestamp: number;
  updatedAt?: number;
  createdAt?: number;
}

export interface EmergencyStampCard {
  id: string;
  memberName: string;
  totalCount: number;
  monthlyCounts: Record<string, number>; // 'YYYY-MM' -> count
  lastStampedAt: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  reminderCount?: number;
  relatedDate?: string;
  createdAt: number;
  isRead?: boolean;
}

export interface KeyRemindersConfig {
  enabled: boolean;
  startTime?: string;
  intervalMinutes?: number;
  maxCount?: number;
  onlyOnActiveDays?: boolean;
  useSummaryTime?: boolean;
  appNotificationEnabled?: boolean;
  lineWorksNotificationEnabled?: boolean;
  midnightSuppressionEnabled?: boolean;
}

export interface KeyReminderDebugInfo {
  currentJstTime: string;
  configStartTime: string;
  isMidnight: boolean;
  midnightSuppressionEnabled: boolean;
  isConditionMet: boolean;
  step: string;
  key1Status: string;
  key2Status: string;
  lastCheckTime?: string;
  lastSentTime?: string;
  skipReason?: string;
  offReasonDetail?: string;
  internalEnabledFlag?: boolean;
  uiSwitchState?: boolean;
  todaySendCount?: number;
  maxCount?: number;
  nextScheduledTime?: string;
  isBeforeStartTime?: boolean;
  timeComparisonDetail?: string;
  remainingMinutesUntilStart?: number;
  isReminderLocked?: boolean;
  isCooldownActive?: boolean;
  lockDetail?: string;
  reasonType?: 'normal_standby' | 'normal_completed' | 'disabled' | 'in_progress';
  reasonCategory?: string;
}

export interface LineWorksConfig {
  enabled: boolean;
  mode: 'webhook' | 'api2';
  webhookUrl?: string;
  botName?: string;
  clientId?: string;
  clientSecret?: string;
  serviceAccount?: string;
  privateKey?: string;
  botId?: string;
  channelId?: string;
  serverId?: string;
  sendDailySummary?: boolean;
  sendTardyAlert?: boolean;
  sendEventReminder?: boolean;
}

export interface LastTransmissionStatus {
  success: boolean;
  error?: string;
  statusCode?: number | null;
  timestamp: number;
}

export interface WeeklyScheduleDay {
  enabled: boolean;
  time: string;
  label?: string;
}

export interface AppSettings {
  summaryNotificationTime: string;
  weeklyNotificationSchedule: Record<number, WeeklyScheduleDay>;
  dateSpecificOverrides: Record<string, { enabled: boolean; time?: string }>;
  notificationsEnabled: boolean;
  adminPasscode: string;
  clubName: string;
  penaltyStages?: PenaltyStage[];
  emergencyKeywords?: string[];
  autoAttendance?: {
    enabled: boolean;
    mode: 'on_app_open' | 'at_specific_time';
    time?: string;
  };
  autoResetKeysAtMidnight?: boolean;
  eventNotificationTimings?: number[];
  keyNames?: {
    key1: string;
    key2: string;
  };
  keyReminders?: KeyRemindersConfig;
  lineWorks?: LineWorksConfig;
  lineWorksKeyReminder?: LineWorksConfig;
  lineWorksEvents?: LineWorksConfig;
  lastLwStatus?: LastTransmissionStatus;
  lastLwKRStatus?: LastTransmissionStatus;
  lastLwEvStatus?: LastTransmissionStatus;
  lastLwKeyReportStatus?: LastTransmissionStatus;
  attendancePatterns?: AttendancePattern[];
  updatedAt?: number;
}

export interface AttendancePattern {
  id: string;
  name: string;
  type: ActiveAttendanceType;
  reason: string;
  time?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
