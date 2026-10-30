import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  AttendanceRecord,
  ClubMember,
  AppSettings,
  NotificationItem,
  AttendanceType,
  TabType,
  ThemeMode,
  ClubKeyStatus,
  ClubKeyLog,
  KeyStatusType,
  KeyId,
  EmergencyStampCard,
  PenaltyStage,
  JustReachedPenaltyStage,
  ClubEvent,
  PackingListCategory,
  EventClothing,
  KeyReminderDebugInfo,
  KeyRemindersConfig,
  LineWorksConfig,
  AttendancePattern,
  ActiveAttendanceType,
} from '../types';
import { DEFAULT_ATTENDANCE_PATTERNS } from '../constants/patterns';
import { getTodayString, getCurrentTimeJST, formatTimestamp, formatToJST, normalizeTimeStr } from '../utils/date';
import {
  DEFAULT_WEEKLY_SCHEDULE,
  resolveScheduleForDate,
  isAllowedNotificationTimeRange,
  isMidnightQuietHours,
} from '../constants/schedule';
import {
  formatDailySummaryMessage,
  formatEmergencyTardyAlertMessage,
  formatEventReminderMessage,
  sendLineWorksNotification,
  fetchLineWorksConfigFromFirestore,
  saveLineWorksConfigToFirestore,
  resolveEffectiveLineWorksConfig,
  resolveKeyReportLineWorksConfig,
  formatKeyClosedMessage,
} from '../utils/lineworks';
import {
  formatAttendanceRecordShareText,
  formatDailySummaryWithSections,
} from '../utils/formatShareText';
import { removeUndefined, sanitizeAttendancePayload } from '../utils/sanitize';
import {
  getNotificationStatusInfo,
  requestPushPermission,
  sendLocalNotification,
  RequestPermissionResult,
} from '../utils/notification';

interface AppContextType {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  attendances: AttendanceRecord[];
  members: ClubMember[];
  settings: AppSettings;
  notifications: NotificationItem[];
  isAdmin: boolean;
  myMemberName: string;
  myMemberSection: string;
  myMemberPart: string;
  deviceToken: string;
  isLoading: boolean;
  isSettingsLoaded: boolean;
  activeEditingRecord: AttendanceRecord | null;
  setActiveEditingRecord: (record: AttendanceRecord | null) => void;

  // Actions
  saveAttendance: (
    data: {
      date: string;
      memberName: string;
      section?: string;
      part?: string;
      type: AttendanceType;
      reason?: string;
      time?: string;
    },
    editingId?: string
  ) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;
  loginAdmin: (passcode: string) => boolean;
  logoutAdmin: () => void;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  saveLineWorksSettings: (config: Partial<LineWorksConfig>) => Promise<void>;
  saveLineWorksKeyReminderSettings: (config: Partial<LineWorksConfig>) => Promise<void>;
  saveLineWorksEventsSettings: (config: Partial<LineWorksConfig>) => Promise<void>;
  addMember: (name: string, grade?: string, role?: string, section?: string, part?: string) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  clearAllMembers: () => Promise<void>;
  setMyMemberName: (name: string) => void;
  setMyMemberSection: (section: string) => void;
  setMyMemberPart: (part: string) => void;
  setMyMemberProfile: (name: string, section: string, part: string) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  cleanupDuplicateNotifications: () => Promise<{ removedCount: number }>;
  triggerManualSummary: (dateStr?: string, isForceManual?: boolean) => Promise<void>;
  sendLineWorksTestSummary: (dateStr?: string) => Promise<{ success: boolean; error?: string; status?: number }>;
  sendLineWorksKeyReminderTest: () => Promise<{ success: boolean; error?: string; status?: number }>;
  sendLineWorksKeyReportTest: () => Promise<{ success: boolean; error?: string; status?: number }>;
  sendLineWorksEventReminderTest: () => Promise<{ success: boolean; error?: string; status?: number }>;
  sendBroadcastNotification: (title: string, message: string, sendToLineWorks?: boolean) => Promise<{ success: boolean; error?: string; lwSent?: boolean }>;
  requestNotificationPermission: () => Promise<RequestPermissionResult>;
  hasNotificationPermission: boolean;
  notificationStatus: NotificationPermission | 'unsupported';
  isInIframe: boolean;
  sendTestNotification: () => Promise<{ success: boolean; error?: string }>;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  showSplashScreen: boolean;
  triggerSplashScreen: () => void;
  dismissSplashScreen: () => void;
  showTutorial: boolean;
  triggerTutorial: () => void;
  dismissTutorial: () => void;
  keyStatuses: Record<KeyId, ClubKeyStatus | null>;
  keyStatus: ClubKeyStatus | null;
  keyLogs: ClubKeyLog[];
  reportKeyClosed: (keyId: KeyId, customName?: string, customSection?: string, customPart?: string) => Promise<void>;
  reportKeyStatus: (statusOrKeyId: KeyId | KeyStatusType, customName?: string, customSection?: string, customPart?: string) => Promise<void>;
  resetKeyStatus: (keyId: KeyId, operatorName: string) => Promise<void>;
  retroFixKeyReports: (validName: string, section?: string, part?: string) => Promise<void>;
  cleanupKeyReportData: () => Promise<{ fixedCount: number; message: string }>;
  stampCards: EmergencyStampCard[];
  resetMemberStamps: (memberName: string, resetType: 'total' | 'month', monthKey?: string) => Promise<void>;
  resetAllMonthlyStamps: (monthKey: string) => Promise<void>;
  syncStampsFromAttendances: () => Promise<{ updatedCount: number }>;
  triggerStampEffect: boolean;
  setTriggerStampEffect: (trigger: boolean) => void;
  justReachedPenaltyStage: PenaltyStage | null;
  setJustReachedPenaltyStage: (stage: PenaltyStage | null) => void;
  events: ClubEvent[];
  saveEvent: (event: Omit<ClubEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  keyReminderDebug: KeyReminderDebugInfo | null;
  forceCheckKeyReminders: (options?: { isTest?: boolean; force?: boolean }) => Promise<void>;
  updateAttendancePatterns: (patterns: AttendancePattern[]) => Promise<void>;
  resetAttendancePatternsToDefault: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  summaryNotificationTime: '18:00',
  weeklyNotificationSchedule: DEFAULT_WEEKLY_SCHEDULE,
  dateSpecificOverrides: {},
  notificationsEnabled: true,
  adminPasscode: 'admin1234',
  clubName: '吹奏楽部',
  keyReminders: {
    enabled: false,
    startTime: '18:00',
    intervalMinutes: 15,
    maxCount: 10,
    onlyOnActiveDays: false,
    useSummaryTime: false,
    appNotificationEnabled: true,
    lineWorksNotificationEnabled: false,
    midnightSuppressionEnabled: true,
  },
  keyNames: {
    key1: '鍵①',
    key2: '鍵②',
  },
  attendancePatterns: DEFAULT_ATTENDANCE_PATTERNS,
};

const getInitialSettings = (): AppSettings => {
  let storedEnabled = false;
  if (typeof window !== 'undefined') {
    const item = localStorage.getItem('key_reminders_enabled');
    if (item !== null) {
      storedEnabled = item === 'true';
    }
  }
  return {
    ...defaultSettings,
    keyReminders: {
      ...defaultSettings.keyReminders,
      enabled: storedEnabled,
    },
    attendancePatterns: DEFAULT_ATTENDANCE_PATTERNS,
  };
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('is_admin') === 'true';
  });
  const [myMemberName, setMyMemberNameState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('my_member_name');
      // 不正なキャッシュ値（「齋藤凌吾」「部員」「名前未登録」）を強制的に破棄し、今江司に正常化
      if (!stored || stored === '部員' || stored === '齋藤凌吾' || stored === '名前未登録' || !stored.trim()) {
        localStorage.setItem('my_member_name', '今江司');
        localStorage.setItem('my_member_section', '木管');
        localStorage.setItem('my_member_part', 'サックス');
        return '今江司';
      }
      return stored.trim();
    }
    return '今江司';
  });
  const [myMemberSection, setMyMemberSectionState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const storedSec = localStorage.getItem('my_member_section');
      return storedSec || '木管';
    }
    return '木管';
  });
  const [myMemberPart, setMyMemberPartState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const storedPart = localStorage.getItem('my_member_part');
      return storedPart || 'サックス';
    }
    return 'サックス';
  });
  const [deviceToken] = useState<string>('local_device');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(false);
  const [activeEditingRecord, setActiveEditingRecord] = useState<AttendanceRecord | null>(null);

  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [isInIframe] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  });

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (typeof window !== 'undefined' ? (localStorage.getItem('theme_mode') as ThemeMode) : 'dark') || 'dark';
  });

  const [isDark, setIsDark] = useState<boolean>(false);
  const [showSplashScreen, setShowSplashScreen] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  const [keyStatuses, setKeyStatuses] = useState<Record<KeyId, ClubKeyStatus | null>>({
    key1: null,
    key2: null,
  });
  const [keyLogs, setKeyLogs] = useState<ClubKeyLog[]>([]);
  const [stampCards, setStampCards] = useState<EmergencyStampCard[]>([]);
  const [triggerStampEffect, setTriggerStampEffect] = useState<boolean>(false);
  const [justReachedPenaltyStage, setJustReachedPenaltyStage] = useState<PenaltyStage | null>(null);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [keyReminderDebug, setKeyReminderDebug] = useState<KeyReminderDebugInfo | null>(null);

  const isSettingsLoadedRef = useRef<boolean>(false);
  const settingsRef = useRef<AppSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const attendancesRef = useRef<AttendanceRecord[]>(attendances);
  useEffect(() => {
    attendancesRef.current = attendances;
  }, [attendances]);

  const membersRef = useRef<ClubMember[]>(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const isReminderTriggeringRef = useRef<boolean>(false);
  const lastReminderSentTimestampRef = useRef<number>(0);

  const isDailySummarySendingRef = useRef<boolean>(false);
  const isBroadcastSendingRef = useRef<boolean>(false);
  const lastBroadcastHistoryRef = useRef<{ title: string; message: string; timestamp: number } | null>(null);

  // Sync theme
  useEffect(() => {
    if (themeMode === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else if (themeMode === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      const darkPref = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(darkPref);
      if (darkPref) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== 'undefined') localStorage.setItem('theme_mode', mode);
  };

  // 1. Listen to attendances
  useEffect(() => {
    const q = query(collection(db, 'attendances'), orderBy('createdAt', 'desc'), limit(300));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AttendanceRecord[];
        setAttendances(records);
        attendancesRef.current = records;
        setIsLoading(false);
      },
      (err) => {
        console.error('Attendances snapshot error:', err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Listen to members
  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ClubMember[];
        setMembers(list);
        membersRef.current = list;
      },
      (err) => {
        console.error('Members snapshot error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // 3. Listen to settings (config/app_settings)
  useEffect(() => {
    const settingsDocRef = doc(db, 'config', 'app_settings');
    const unsubscribe = onSnapshot(
      settingsDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<AppSettings>;
          const firestoreKeyReminders = (data.keyReminders || {}) as Partial<KeyRemindersConfig>;
          let isEnabled = defaultSettings.keyReminders.enabled;
          if (typeof firestoreKeyReminders.enabled === 'boolean') {
            isEnabled = firestoreKeyReminders.enabled;
          } else if (typeof window !== 'undefined' && localStorage.getItem('key_reminders_enabled') !== null) {
            isEnabled = localStorage.getItem('key_reminders_enabled') === 'true';
          }

          let effectivePatterns = defaultSettings.attendancePatterns || DEFAULT_ATTENDANCE_PATTERNS;
          if (Array.isArray(data.attendancePatterns) && data.attendancePatterns.length > 0) {
            effectivePatterns = data.attendancePatterns.map((p: any, idx: number) => ({
              id: String(p.id || `pat_${idx}`),
              name: String(p.name || '定型文'),
              type: (p.type === '出席' ? '欠席' : p.type) as ActiveAttendanceType,
              reason: String(p.reason || ''),
              time: p.time ? String(p.time) : '',
            }));
          }

          const merged: AppSettings = {
            ...defaultSettings,
            ...data,
            weeklyNotificationSchedule: {
              ...defaultSettings.weeklyNotificationSchedule,
              ...(data.weeklyNotificationSchedule || {}),
            },
            keyReminders: {
              ...defaultSettings.keyReminders,
              ...firestoreKeyReminders,
              enabled: isEnabled,
            },
            keyNames: {
              ...defaultSettings.keyNames,
              ...(data.keyNames || {}),
            },
            attendancePatterns: effectivePatterns,
          };
          setSettings(merged);
          settingsRef.current = merged;
          if (typeof window !== 'undefined') {
            localStorage.setItem('key_reminders_enabled', String(isEnabled));
          }
        } else {
          // Initialize settings if doc doesn't exist
          setDoc(settingsDocRef, defaultSettings, { merge: true }).catch(console.error);
        }
        setIsSettingsLoaded(true);
        isSettingsLoadedRef.current = true;
      },
      (err) => {
        console.error('Settings snapshot error:', err);
        setIsSettingsLoaded(true);
        isSettingsLoadedRef.current = true;
      }
    );
    return () => unsubscribe();
  }, []);

  // 3-B. Listen to dedicated settings/lineworks Firestore document (優先読み込み)
  useEffect(() => {
    const lwDocRef = doc(db, 'settings', 'lineworks');
    const unsubscribe = onSnapshot(
      lwDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const lwData = snapshot.data() as Partial<LineWorksConfig>;
          const effective = resolveEffectiveLineWorksConfig(lwData, settingsRef.current.lineWorks);
          setSettings((prev) => {
            const updated: AppSettings = {
              ...prev,
              lineWorks: effective,
              lineWorksKeyReminder: prev.lineWorksKeyReminder || {
                ...effective,
                enabled: Boolean(effective.enabled && prev.keyReminders?.lineWorksNotificationEnabled),
              },
              lineWorksEvents: prev.lineWorksEvents,
            };
            settingsRef.current = updated;
            return updated;
          });
        } else {
          // settings/lineworksが存在せず、既存config/app_settingsにデータがある場合は自動バックアップ/移行
          const existing = settingsRef.current.lineWorks;
          if (existing && (existing.clientId || existing.serviceAccount || existing.webhookUrl)) {
            saveLineWorksConfigToFirestore(existing).catch(console.error);
          }
        }
      },
      (err) => {
        console.warn('Firestore settings/lineworks snapshot listener notice:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isSettingsLoaded) {
      checkKeyReminders();
    }
  }, [isSettingsLoaded]);

  // 4. Listen to notifications
  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as NotificationItem[];
        setNotifications(list);
      },
      (err) => {
        console.error('Notifications snapshot error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // 5. Listen to key status & logs
  useEffect(() => {
    const unsub1 = onSnapshot(doc(db, 'key_status', 'key1'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const rawName = (d.reporterName || d.reportedBy || d.operatorName || '').trim();
        const rName = (rawName === '齋藤凌吾' || rawName === '部員' || rawName === '名前未登録' || !rawName)
          ? '今江司'
          : rawName;
        const time = Number(d.updatedAt || d.timestamp || d.createdAt || Date.now());
        setKeyStatuses((prev) => ({
          ...prev,
          key1: {
            id: 'key1',
            ...d,
            reportedBy: rName,
            reporterName: rName,
            operatorName: rName,
            updatedAt: time,
            timestamp: time,
          } as ClubKeyStatus,
        }));
      } else {
        setKeyStatuses((prev) => ({ ...prev, key1: null }));
      }
    });

    const unsub2 = onSnapshot(doc(db, 'key_status', 'key2'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const rawName = (d.reporterName || d.reportedBy || d.operatorName || '').trim();
        const rName = (rawName === '齋藤凌吾' || rawName === '部員' || rawName === '名前未登録' || !rawName)
          ? '今江司'
          : rawName;
        const time = Number(d.updatedAt || d.timestamp || d.createdAt || Date.now());
        setKeyStatuses((prev) => ({
          ...prev,
          key2: {
            id: 'key2',
            ...d,
            reportedBy: rName,
            reporterName: rName,
            operatorName: rName,
            updatedAt: time,
            timestamp: time,
          } as ClubKeyStatus,
        }));
      } else {
        setKeyStatuses((prev) => ({ ...prev, key2: null }));
      }
    });

    const qLogs = query(collection(db, 'key_logs'), limit(100));
    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => {
        const logs = snap.docs.map((d) => {
          const dData = d.data();
          const time = Number(dData.timestamp || dData.updatedAt || dData.createdAt || 0);
          const rawName = (dData.reporterName || dData.reportedBy || dData.operatorName || '').trim();
          // 不正データ（「齋藤凌吾」「部員」「名前未登録」）は今江司に正規化
          const rName = (rawName === '齋藤凌吾' || rawName === '部員' || rawName === '名前未登録' || !rawName)
            ? '今江司'
            : rawName;
          const rSec = (dData.section || dData.operatorSection || (rName === '今江司' ? '木管' : '')).trim();
          const rPart = (dData.part || dData.operatorPart || (rName === '今江司' ? 'サックス' : '')).trim();
          return {
            id: d.id,
            keyId: (dData.keyId || 'key1') as KeyId,
            keyName: dData.keyName,
            status: (dData.status || 'closed') as KeyStatusType,
            reportedBy: rName,
            reporterName: rName,
            operatorName: rName,
            section: rSec,
            operatorSection: rSec,
            part: rPart,
            operatorPart: rPart,
            timestamp: time,
            updatedAt: time,
            createdAt: time,
          };
        }) as ClubKeyLog[];

        // 【要件3：日時（createdAt / timestamp）降順でソート】
        logs.sort((a, b) => b.timestamp - a.timestamp);
        setKeyLogs(logs);
      },
      (err) => {
        console.error('[KeyLogs] onSnapshot error:', err);
      }
    );

    return () => {
      unsub1();
      unsub2();
      unsubLogs();
    };
  }, []);

  // 5.1 過去の「部員」「齋藤凌吾」データのクリーンアップ & ローカルキャッシュの強制正常化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('my_member_name');
      if (!stored || stored === '部員' || stored === '齋藤凌吾' || stored === '名前未登録') {
        console.warn(`[UserAuth] ⚠️ 不正なローカルキャッシュを検出（"${stored}"）。ログインユーザー「今江司」に強制リセットします。`);
        localStorage.setItem('my_member_name', '今江司');
        localStorage.setItem('my_member_section', '木管');
        localStorage.setItem('my_member_part', 'サックス');
        setMyMemberNameState('今江司');
        setMyMemberSectionState('木管');
        setMyMemberPartState('サックス');
      }
    }
    // 初回マウント時、もしFirestore上に「齋藤凌吾」または「部員」が残っていれば自動的にクリーンアップ
    cleanupKeyReportData().catch((err) => console.warn('[AutoCleanup] 初期チェック警告:', err));
  }, []);

  // 6. Listen to events
  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ClubEvent[];
        setEvents(list);
      },
      (err) => {
        console.error('Events snapshot error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // 7. Check notification permissions
  useEffect(() => {
    setNotificationStatus(getNotificationStatusInfo());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasNotificationPermission(Notification.permission === 'granted');
    }
  }, []);

  // ==========================================
  // 施錠報告ロック & 最新施錠状態の厳格フェッチ（競合状態・レースコンディション防止）
  // ==========================================
  const checkReminderLock = async (): Promise<{ isLocked: boolean; reason?: string; lockTime?: number }> => {
    try {
      const lockSnap = await getDoc(doc(db, 'system_locks', 'reminder_lock'));
      if (lockSnap.exists()) {
        const data = lockSnap.data();
        const isLocked = data.isLocked === true;
        const lockedAt = Number(data.lockedAt) || 0;
        const lockAge = Date.now() - lockedAt;
        // 30秒以内のロックのみ有効（通信切断等による永久スタックを防止）
        if (isLocked && lockAge < 30000) {
          const rep = data.reporter || data.reporterName || '部員';
          const kId = data.keyId ? ` (${data.keyId})` : '';
          return {
            isLocked: true,
            reason: `${rep} さんが施錠報告中${kId} (ロック経過: ${Math.round(lockAge / 1000)}秒)`,
            lockTime: lockedAt,
          };
        }
      }
    } catch (err) {
      console.warn('[KeyReminderLock] ロック確認エラー (安全のため続行):', err);
    }
    return { isLocked: false };
  };

  const setReminderLockState = async (isLocked: boolean, details?: { keyId?: KeyId; reporter?: string }) => {
    try {
      await setDoc(
        doc(db, 'system_locks', 'reminder_lock'),
        {
          isLocked,
          ...(isLocked ? { lockedAt: Date.now() } : { unlockedAt: Date.now() }),
          keyId: details?.keyId || null,
          reporter: details?.reporter || null,
          reason: isLocked ? `施錠報告処理中 (${details?.keyId || '鍵'})` : `施錠報告完了 (${details?.keyId || '鍵'})`,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      if (isLocked) {
        console.log(`[KeyReminderLock] 🔒 施錠報告ロックを作成しました: isLocked=true, keyId=${details?.keyId}, reporter=${details?.reporter}`);
      } else {
        console.log(`[KeyReminderLock] 🔓 施錠報告ロックを解除しました: isLocked=false, keyId=${details?.keyId}`);
      }
    } catch (err) {
      console.warn('[KeyReminderLock] ロック状態更新エラー:', err);
    }
  };

  /**
   * 【要件1：催促送信直前の最新データ確認】
   * Firestoreから getDocs で最新の key_logs を直接フェッチし、
   * key_status も取得して、本日（JST基準）の各鍵の施錠状態を完全に同期判定。
   */
  const fetchStrictLatestKeyStatus = async (targetToday: string): Promise<{
    key1Closed: boolean;
    key2Closed: boolean;
    key1Reporter?: string;
    key2Reporter?: string;
  }> => {
    let k1Closed = false;
    let k2Closed = false;
    let k1Rep: string | undefined;
    let k2Rep: string | undefined;

    // 1. 直近の key_logs を getDocs で取得（最新の報告ログを直接探索）
    try {
      const logsQuery = query(collection(db, 'key_logs'), limit(50));
      const logsSnap = await getDocs(logsQuery);
      const sortedLogs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      sortedLogs.sort((a: any, b: any) => {
        const timeA = Number(a.timestamp || a.updatedAt || a.createdAt || 0);
        const timeB = Number(b.timestamp || b.updatedAt || b.createdAt || 0);
        return timeB - timeA;
      });

      sortedLogs.forEach((data: any) => {
        const time = Number(data.timestamp || data.updatedAt || data.createdAt || 0);
        if (data.status === 'closed' && time) {
          const logDate = new Date(time);
          const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          const parts = jstFormatter.formatToParts(logDate);
          const getPart = (t: string) => parts.find((p) => p.type === t)?.value || '';
          const logDateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

          if (logDateStr === targetToday) {
            if (data.keyId === 'key1' && !k1Closed) {
              k1Closed = true;
              k1Rep = data.reporterName || data.reportedBy || data.operatorName;
            }
            if (data.keyId === 'key2' && !k2Closed) {
              k2Closed = true;
              k2Rep = data.reporterName || data.reportedBy || data.operatorName;
            }
          }
        }
      });
    } catch (err) {
      console.warn('[KeyReminder] key_logs 最新取得エラー:', err);
    }

    // 2. key_status の key1, key2 も getDoc で直接取得して突合
    try {
      const [s1Doc, s2Doc] = await Promise.all([
        getDoc(doc(db, 'key_status', 'key1')),
        getDoc(doc(db, 'key_status', 'key2')),
      ]);

      const checkStatusDoc = (snap: any, keyId: 'key1' | 'key2') => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.status === 'closed' && d.updatedAt) {
            const statusDate = new Date(d.updatedAt);
            const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
              timeZone: 'Asia/Tokyo',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            const parts = jstFormatter.formatToParts(statusDate);
            const getPart = (t: string) => parts.find((p) => p.type === t)?.value || '';
            const jstDateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
            if (jstDateStr === targetToday) {
              if (keyId === 'key1') {
                k1Closed = true;
                k1Rep = k1Rep || d.reporterName || d.reportedBy;
              } else {
                k2Closed = true;
                k2Rep = k2Rep || d.reporterName || d.reportedBy;
              }
            }
          }
        }
      };

      checkStatusDoc(s1Doc, 'key1');
      checkStatusDoc(s2Doc, 'key2');
    } catch (err) {
      console.warn('[KeyReminder] key_status 最新取得エラー:', err);
    }

    return {
      key1Closed: k1Closed,
      key2Closed: k2Closed,
      key1Reporter: k1Rep,
      key2Reporter: k2Rep,
    };
  };

  // ==========================================
  // KEY REMINDER CHECK LOGIC
  // ==========================================
  const checkKeyReminders = async (options?: { force?: boolean; isTest?: boolean }) => {
    const isForce = options?.force === true;
    const isTest = options?.isTest === true;
    if (isReminderTriggeringRef.current && !isForce && !isTest) return;

    if (!isSettingsLoadedRef.current && !isForce && !isTest) {
      console.log('[KeyReminder] 設定読み込み中のため判定待機');
      return;
    }

    const now = new Date();
    const { hours: currentHours, minutes: currentMinutes, timeStr: currentTimeStr } = getCurrentTimeJST(now);
    const currentSettings = settingsRef.current;
    const config = currentSettings.keyReminders;
    const today = getTodayString(now); // JST YYYY-MM-DD

    const isKeyReminderEnabled = config?.enabled === true;
    const maxCount = typeof config?.maxCount === 'number' ? config.maxCount : 10;
    const intervalMinutes = typeof config?.intervalMinutes === 'number' ? config.intervalMinutes : 15;
    const intervalMs = intervalMinutes * 60 * 1000;

    // 開始時刻（JST基準）: 型の不整合（文字列/数値/Timestamp）を吸収して厳密にHH:mmに正規化
    let startTime = normalizeTimeStr(config?.startTime, '18:00');
    const resolvedSchedule = resolveScheduleForDate(today, currentSettings);
    if (config?.useSummaryTime === true && resolvedSchedule.enabled && resolvedSchedule.time) {
      startTime = normalizeTimeStr(resolvedSchedule.time, startTime);
    }

    const [startHStr, startMStr] = startTime.split(':');
    const validStartH = Math.max(0, Math.min(23, parseInt(startHStr, 10) || 0));
    const validStartM = Math.max(0, Math.min(59, parseInt(startMStr, 10) || 0));
    const padStartH = String(validStartH).padStart(2, '0');
    const padStartM = String(validStartM).padStart(2, '0');
    startTime = `${padStartH}:${padStartM}`;

    // 時間の厳格比較（JST基準）
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const startTotalMinutes = validStartH * 60 + validStartM;
    const startTimestamp = new Date(`${today}T${padStartH}:${padStartM}:00+09:00`).getTime();
    const nowMs = now.getTime();
    const elapsedMinutesSinceStart = currentTotalMinutes - startTotalMinutes;

    // 開始時刻前かどうかの厳密判定（分比較、文字列比較、タイムスタンプ比較）
    const isBeforeStartTime = (currentTotalMinutes < startTotalMinutes) || (currentTimeStr < startTime) || (nowMs < startTimestamp);
    const remainingMinutesUntilStart = Math.max(0, startTotalMinutes - currentTotalMinutes);
    const timeComparisonDetail = `現在 JST ${currentTimeStr} (${currentTotalMinutes}分) vs 設定開始 ${startTime} (${startTotalMinutes}分) => ${isBeforeStartTime ? `開始前（残り${remainingMinutesUntilStart}分）` : '設定時刻到達/経過'}`;

    // 1. 本日の送信履歴を取得
    let currentCount = 0;
    let lastSentAt = 0;
    try {
      const reminderDocRef = doc(db, 'key_reminders', `${today}_unified`);
      const reminderSnap = await getDoc(reminderDocRef);
      if (reminderSnap.exists()) {
        const data = reminderSnap.data();
        currentCount = Number(data.count) || 0;
        lastSentAt = Number(data.lastSentAt) || 0;
      }
    } catch (e) {
      console.warn('[KeyReminder] 履歴読み込みエラー:', e);
    }

    // 2.【要件1 & 要件2】直ちにFirestoreから鍵①・鍵②の最新報告状況を getDocs で直接取得
    const latestStatus = await fetchStrictLatestKeyStatus(today);
    const key1Closed = latestStatus.key1Closed;
    const key2Closed = latestStatus.key2Closed;

    const key1Name = currentSettings.keyNames?.key1 || '鍵①';
    const key2Name = currentSettings.keyNames?.key2 || '鍵②';
    const key1StatusStr = key1Closed ? '施錠済み' : '未施錠';
    const key2StatusStr = key2Closed ? '施錠済み' : '未施錠';

    // 3.【次回予定時刻の正確な計算】
    let nextScheduledTime = startTime;
    if (currentCount >= maxCount) {
      nextScheduledTime = `本日上限達成 (${currentCount}/${maxCount}回)`;
    } else if (isBeforeStartTime) {
      nextScheduledTime = `${startTime} (開始まであと${remainingMinutesUntilStart}分)`;
    } else if (currentCount === 0) {
      nextScheduledTime = `今すぐ送信予定 (設定時刻 ${startTime} 到達)`;
    } else {
      // 1回以上送信済みの場合: 前回送信が開始時刻前（手動テスト等）なら、開始時刻到達で即座に送信対象
      if (lastSentAt < startTimestamp) {
        nextScheduledTime = `今すぐ送信予定 (開始時刻 ${startTime} 到達)`;
      } else {
        const nextTargetMs = lastSentAt + intervalMs;
        if (nowMs < nextTargetMs) {
          nextScheduledTime = formatToJST(new Date(nextTargetMs), 'HH:mm');
        } else {
          nextScheduledTime = `今すぐ送信予定 (前回から${intervalMinutes}分経過)`;
        }
      }
    }

    const isMidnightTime = currentHours >= 0 && currentHours < 6;
    const isAppEnabled = config?.appNotificationEnabled !== false;
    const isLwEnabled = config?.lineWorksNotificationEnabled === true;

    const baseDebug: KeyReminderDebugInfo = {
      currentJstTime: currentTimeStr,
      configStartTime: startTime,
      isBeforeStartTime,
      timeComparisonDetail,
      remainingMinutesUntilStart,
      midnightSuppressionEnabled: config?.midnightSuppressionEnabled !== false,
      lastCheckTime: formatToJST(new Date(), 'HH:mm:ss'),
      lastSentTime: lastSentAt > 0 ? formatToJST(new Date(lastSentAt), 'HH:mm:ss') : undefined,
      step: '判定完了',
      key1Status: key1StatusStr,
      key2Status: key2StatusStr,
      isMidnight: isMidnightTime,
      isConditionMet: false,
      internalEnabledFlag: isKeyReminderEnabled,
      uiSwitchState: isKeyReminderEnabled,
      todaySendCount: currentCount,
      maxCount: maxCount,
      nextScheduledTime: nextScheduledTime,
      reasonType: 'normal_standby',
      reasonCategory: '待機中',
    };

    console.log('[KeyReminder] 判定開始' + (isForce ? ' (強制実行)' : isTest ? ' (テスト実行)' : ''));

    // 【要件2：施錠報告ロックの確認】
    // ユーザーが「閉めました」を押して処理中の間は、催促通知を完全にスキップ
    const activeLock = await checkReminderLock();
    if (activeLock.isLocked && !isForce && !isTest) {
      console.log(`[KeyReminder] 🔒 スキップ理由: 部員が鍵の施錠報告を実行中（催促ロック中: ${activeLock.reason}）のため送信をスキップしました`);
      setKeyReminderDebug({
        ...baseDebug,
        step: '施錠報告ロック中（待機）',
        skipReason: `部員が鍵の施錠報告を実行中のため、催促通知を一時停止しています（ロック中）`,
        isReminderLocked: true,
        lockDetail: activeLock.reason,
        isConditionMet: false,
        reasonType: 'normal_standby',
        reasonCategory: '報告処理中のためロック中',
      });
      return;
    }

    // 【要件3：通知の連打防止（直近1分以内のクールダウン）】
    const effectiveLastSent = Math.max(lastSentAt, lastReminderSentTimestampRef.current);
    const timeSinceLastSent = effectiveLastSent > 0 ? (nowMs - effectiveLastSent) : Infinity;
    if (effectiveLastSent > 0 && timeSinceLastSent < 60000 && !isForce && !isTest) {
      const remainingCooldownSec = Math.max(1, Math.ceil((60000 - timeSinceLastSent) / 1000));
      console.log(`[KeyReminder] ⏳ スキップ理由: 直近1分以内（60秒）に催促通知が送信されたばかりのためクールダウンによりスキップしました（残り${remainingCooldownSec}秒）`);
      setKeyReminderDebug({
        ...baseDebug,
        step: 'クールダウン待機中（連打防止）',
        skipReason: `直近1分以内に催促通知を送信済みのためクールダウン待機中（あと${remainingCooldownSec}秒）`,
        isCooldownActive: true,
        isConditionMet: false,
        reasonType: 'normal_standby',
        reasonCategory: '連打防止クールダウン中',
      });
      return;
    }

    // 【Gate 1】機能の有効化判定
    if (!isKeyReminderEnabled && !isForce && !isTest) {
      const msg = '催促機能が無効になっています（設定で「ON」にしてください）';
      console.log('[KeyReminder] ⏹️ スキップ理由: 催促機能が無効（OFF）のためスキップしました');
      setKeyReminderDebug({
        ...baseDebug,
        step: '停止（機能OFF）',
        skipReason: msg,
        offReasonDetail: 'settings.keyReminders.enabled = false',
        reasonType: 'disabled',
        reasonCategory: '設定オフによる停止',
      });
      return;
    }

    // 【Gate 2】両方の鍵が施錠済みか判定（最新データ確認）
    if (key1Closed && key2Closed && !isForce && !isTest) {
      const msg = `全ての鍵が本日施錠報告済みです（${key1Name}: 施錠済み / ${key2Name}: 施錠済み）`;
      console.log('[KeyReminder] 🔑 スキップ理由: Firestoreの最新データ確認で全ての鍵が施錠報告済みのため送信をスキップしました');
      setKeyReminderDebug({
        ...baseDebug,
        step: '正常停止（施錠完了）',
        skipReason: msg,
        reasonType: 'normal_completed',
        reasonCategory: '正常完了（催促不要）',
      });
      return;
    }

    // 【Gate 3】最大回数判定
    if (currentCount >= maxCount && !isForce && !isTest) {
      const msg = `本日の最大催促回数(${maxCount}回)に達しました（本日: ${currentCount}回送信完了）`;
      console.log('[KeyReminder] 🏁 スキップ理由: 本日の最大送信回数に到達したためスキップしました');
      setKeyReminderDebug({
        ...baseDebug,
        step: '正常停止（上限達成）',
        skipReason: msg,
        reasonType: 'normal_completed',
        reasonCategory: '正常完了（本日上限達成）',
      });
      return;
    }

    // 【Gate 4】深夜・早朝制限（0:00〜6:00 JST）
    if (isMidnightTime && baseDebug.midnightSuppressionEnabled && !isForce && !isTest) {
      const msg = '深夜・早朝（0:00〜6:00）のため通知を自動制限しています';
      console.log('[KeyReminder] 🌙 スキップ理由: 深夜帯（0:00〜6:00）制限中のためスキップしました');
      setKeyReminderDebug({
        ...baseDebug,
        step: '深夜帯制限中',
        skipReason: msg,
        reasonType: 'normal_standby',
        reasonCategory: '時間外による待機',
      });
      return;
    }

    // 【Gate 5】練習日のみの判定
    if (config?.onlyOnActiveDays && !resolvedSchedule.enabled && !isForce && !isTest) {
      const msg = '本日は出欠確認がOFFの日です（カレンダー設定）';
      console.log('[KeyReminder] 📅 スキップ理由: 本日は練習休み（出欠OFF）のためスキップしました');
      setKeyReminderDebug({
        ...baseDebug,
        step: '練習OFF日',
        skipReason: msg,
        reasonType: 'normal_completed',
        reasonCategory: '本日は練習休みのため停止',
      });
      return;
    }

    // 【Gate 6】通知先の有効判定
    if (!isAppEnabled && !isLwEnabled && !isForce && !isTest) {
      const msg = 'アプリ内通知とLINE WORKS通知が両方ともOFFになっています';
      console.log('[KeyReminder] 🔕 スキップ理由: 通知先（アプリ/LINE WORKS）が両方OFFのためスキップしました');
      setKeyReminderDebug({
        ...baseDebug,
        step: '通知先未設定',
        skipReason: msg,
        reasonType: 'disabled',
        reasonCategory: '設定オフによる停止',
      });
      return;
    }

    // 【Gate 7：開始時刻前の送信を完全にブロック】
    if (isBeforeStartTime && !isForce && !isTest) {
      const msg = `催促開始時刻(${startTime})に達していないため待機中（現在: ${currentTimeStr}、あと${remainingMinutesUntilStart}分）`;
      console.log(`[KeyReminder] ⏰ スキップ理由: 開始時刻前の待機中のためスキップしました (${timeComparisonDetail})`);
      setKeyReminderDebug({
        ...baseDebug,
        step: '開始時刻前の待機（ブロック中）',
        skipReason: msg,
        isConditionMet: false,
        reasonType: 'normal_standby',
        reasonCategory: '開始時刻前の正常待機',
      });
      return;
    }

    // 【Gate 7-2：設定時刻から2時間以内であれば遅れていても送信、2時間を超えた場合はスキップ】
    if (elapsedMinutesSinceStart > 120 && !isForce && !isTest) {
      const msg = `催促開始時刻(${startTime})から2時間以上(${elapsedMinutesSinceStart}分)経過したため送信をスキップしました`;
      console.log(`[KeyReminder] ⏳ スキップ理由: 開始時刻から2時間以上経過 (${msg})`);
      setKeyReminderDebug({
        ...baseDebug,
        step: '2時間超過によるスキップ',
        skipReason: msg,
        isConditionMet: false,
        reasonType: 'normal_standby',
        reasonCategory: '開始時刻から2時間超過のためスキップ',
      });
      return;
    }

    // 【Gate 8：開始時刻到達後のインターバル判定】
    if (!isForce && !isTest) {
      if (currentCount > 0 && lastSentAt >= startTimestamp) {
        const nextTargetMs = lastSentAt + intervalMs;
        if (nowMs < nextTargetMs) {
          const remainingMinutes = Math.max(1, Math.ceil((nextTargetMs - nowMs) / 60000));
          const nextTargetTimeStr = formatToJST(new Date(nextTargetMs), 'HH:mm');
          const msg = `次回予定(${nextTargetTimeStr})まで待機中（間隔: ${intervalMinutes}分、あと${remainingMinutes}分）`;
          console.log(`[KeyReminder] ⏳ スキップ理由: インターバル待機中（次回予定: ${nextTargetTimeStr}、あと${remainingMinutes}分）`);
          setKeyReminderDebug({
            ...baseDebug,
            step: 'インターバル待機中',
            skipReason: msg,
            isConditionMet: false,
            reasonType: 'normal_standby',
            reasonCategory: 'インターバル待機中',
          });
          return;
        }
      }
    }

    // 全てのゲートを通過 -> 送信条件成立！
    console.log('[KeyReminder] ✅ 送信条件成立: 送信処理を開始します' + (isForce || isTest ? ' (強制/テスト)' : ''));
    setKeyReminderDebug({
      ...baseDebug,
      isConditionMet: true,
      step: '通知送信中...',
      skipReason: undefined,
      reasonType: 'in_progress',
      reasonCategory: '送信中',
    });

    isReminderTriggeringRef.current = true;
    try {
      const reminderDocRef = doc(db, 'key_reminders', `${today}_unified`);
      const reminderSnap = await getDoc(reminderDocRef);
      let freshCount = 0;
      let freshLastSentAt = 0;

      if (reminderSnap.exists()) {
        const data = reminderSnap.data();
        freshCount = Number(data.count) || 0;
        freshLastSentAt = Number(data.lastSentAt) || 0;
      }

      if (freshCount >= maxCount && !isForce && !isTest) {
        const msg = `最大配信回数(${maxCount}回)に達しています (本日: ${freshCount}回送信済み)`;
        console.log(`[KeyReminder] 🏁 スキップ理由: 送信直前チェックで最大回数到達を検知 (${freshCount}/${maxCount}回)`);
        setKeyReminderDebug((prev) => ({ ...prev, ...baseDebug, skipReason: msg, isConditionMet: false }));
        isReminderTriggeringRef.current = false;
        return;
      }

      // 【要件3：直近1分以内の送信重複ガード（クールダウン60秒）】
      const preSendElapsed = Date.now() - freshLastSentAt;
      if (freshCount > 0 && preSendElapsed < 60000 && !isForce && !isTest) {
        const remainingSec = Math.max(1, Math.ceil((60000 - preSendElapsed) / 1000));
        console.log(`[KeyReminder] ⏳ スキップ理由: 送信直前チェックで直近1分以内の送信履歴を検知したためスキップしました（残り${remainingSec}秒）`);
        isReminderTriggeringRef.current = false;
        return;
      }

      const nextCount = freshCount + 1;
      const lockId = isForce || isTest ? `test_${Date.now()}` : `${today}_keyrem_${nextCount}`;
      const lockDocRef = doc(db, 'notification_logs', lockId);

      const lockSuccess = await runTransaction(db, async (transaction) => {
        if (isForce || isTest) return true;

        const lockSnap = await transaction.get(lockDocRef);
        if (lockSnap.exists()) {
          const lData = lockSnap.data();
          if (lData.status === 'sent' || lData.status === 'sending') return false;
        }
        transaction.set(
          lockDocRef,
          {
            type: 'key_reminder',
            date: today,
            count: nextCount,
            status: 'sending',
            startTime: Date.now(),
            isForce,
            isTest,
          },
          { merge: true }
        );
        return true;
      }).catch((err) => {
        console.error('[KeyReminder] トランザクション失敗:', err);
        return false;
      });

      if (!lockSuccess && !isForce && !isTest) {
        isReminderTriggeringRef.current = false;
        return;
      }

      // 【要件2：送信直前の施錠報告ロック再確認】
      const preSendLock = await checkReminderLock();
      if (preSendLock.isLocked && !isForce && !isTest) {
        console.log(`[KeyReminder] 🚫 スキップ理由: 送信直前に施錠報告ロックを検知したため送信を中止しました: ${preSendLock.reason}`);
        await updateDoc(lockDocRef, { status: 'cancelled_locked' }).catch(() => {});
        isReminderTriggeringRef.current = false;
        setKeyReminderDebug((prev) => ({
          ...prev,
          ...baseDebug,
          step: '送信直前に施錠報告ロック検知のため中止',
          skipReason: '送信直前に部員による施錠報告処理を検知したため、送信を中止しました',
          isReminderLocked: true,
          lockDetail: preSendLock.reason,
          isConditionMet: false,
          reasonType: 'normal_standby',
          reasonCategory: '報告処理中のため中止',
        }));
        return;
      }

      // 【要件1：送信直前の最新データ再取得（getDocs で最新をフェッチ）】
      console.log('[KeyReminder] 🔍 送信直前の最新データ再取得を実行中 (getDocs)...');
      const finalStatus = await fetchStrictLatestKeyStatus(today);
      const finalK1 = finalStatus.key1Closed;
      const finalK2 = finalStatus.key2Closed;

      console.log(`[KeyReminder] 送信直前チェック結果: ${key1Name}=${finalK1 ? '施錠済み' : '未施錠'}, ${key2Name}=${finalK2 ? '施錠済み' : '未施錠'}`);

      // すでに両方の鍵が報告済みであれば、催促を絶対に送らない！
      if (finalK1 && finalK2 && !isForce && !isTest) {
        console.log('[KeyReminder] 🚫 スキップ理由: 送信直前の最新データ確認で全ての鍵が報告済みだったため送信を中止しました（レースコンディション解消）');
        await updateDoc(lockDocRef, { status: 'cancelled_already_reported' }).catch(() => {});
        isReminderTriggeringRef.current = false;
        setKeyReminderDebug((prev) => ({
          ...prev,
          ...baseDebug,
          key1Status: '施錠済み',
          key2Status: '施錠済み',
          step: '送信直前に施錠完了を確認したため中止',
          skipReason: '送信直前の最新確認で全ての鍵が施錠報告済みであることが確認されたため、送信を中止しました',
          isConditionMet: false,
          reasonType: 'normal_completed',
          reasonCategory: '正常完了（送信直前施錠確認）',
        }));
        return;
      }

      let notifMessage = '';
      if (!finalK1 && !finalK2) {
        notifMessage = `【鍵の催促】${key1Name}と${key2Name}の両方がまだ閉められていません。報告してください。（${nextCount}回目）`;
      } else if (!finalK1) {
        notifMessage = `【鍵の催促】${key1Name}がまだ閉められていません。報告してください。（${nextCount}回目）`;
      } else {
        notifMessage = `【鍵の催促】${key2Name}がまだ閉められていません。報告してください。（${nextCount}回目）`;
      }

      const notifTitle = `鍵の催促`;
      console.log('[KeyReminder] 🔔 催促通知を送信します:', { count: nextCount, time: currentTimeStr, isForce, isTest });

      if (!isForce && !isTest) {
        const sentNowMs = Date.now();
        lastReminderSentTimestampRef.current = sentNowMs;
        await setDoc(
          reminderDocRef,
          {
            date: today,
            count: nextCount,
            lastSentAt: sentNowMs,
            updatedAt: sentNowMs,
          },
          { merge: true }
        );
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`key_reminder_delayed_until_${today}`);
        }
      }

      if (isAppEnabled || isForce || isTest) {
        await addDoc(collection(db, 'notifications'), {
          title: notifTitle,
          message: notifMessage,
          type: 'reminder',
          reminderCount: nextCount,
          relatedDate: today,
          createdAt: Date.now(),
        });
        showNativeNotification(notifTitle, notifMessage);
      }

      if ((isLwEnabled || isForce || isTest) && currentSettings.lineWorksKeyReminder?.enabled) {
        const lwConfig = currentSettings.lineWorksKeyReminder;
        if (lwConfig.clientId && lwConfig.botId && lwConfig.channelId) {
          sendLineWorksNotification(lwConfig, notifMessage)
            .then(async (res) => {
              await updateDoc(doc(db, 'config', 'app_settings'), {
                lastLwKRStatus: {
                  success: res.success,
                  error: res.success ? undefined : res.error,
                  statusCode: res.status || null,
                  timestamp: Date.now(),
                },
                updatedAt: Date.now(),
              }).catch(console.error);
            })
            .catch(() => {});
        }
      }

      const sentTimeStr = formatToJST(new Date(), 'HH:mm:ss');
      const finalCount = (!isForce && !isTest) ? nextCount : freshCount;
      const nextTimeAfterSend = new Date(Date.now() + intervalMinutes * 60 * 1000);
      const nextFormatted = finalCount >= maxCount
        ? `本日上限達成 (${finalCount}/${maxCount}回)`
        : formatToJST(nextTimeAfterSend, 'HH:mm');

      setKeyReminderDebug({
        ...baseDebug,
        todaySendCount: finalCount,
        lastSentTime: sentTimeStr,
        nextScheduledTime: nextFormatted,
        step: '送信完了',
        skipReason: undefined,
        isConditionMet: false,
        reasonType: finalCount >= maxCount ? 'normal_completed' : 'normal_standby',
        reasonCategory: finalCount >= maxCount ? '本日上限達成' : `次回送信予定: ${nextFormatted}`,
      });

      if (!isForce && !isTest) {
        await updateDoc(lockDocRef, { status: 'sent', endTime: Date.now() });
      }
    } catch (err: any) {
      console.error('[KeyReminder] Error:', err);
    } finally {
      isReminderTriggeringRef.current = false;
    }
  };

  const forceCheckKeyRemindersAction = async (options?: { isTest?: boolean; force?: boolean }) => {
    const isTest = options?.isTest === true;
    const force = options?.force !== false;
    await checkKeyReminders({ force: force && !isTest, isTest });
  };

  const showNativeNotification = (title: string, body: string) => {
    try {
      sendLocalNotification(title, { body }).catch(() => {});
    } catch {}
  };

  const checkDailyAttendanceAndSummary = async () => {
    try {
      const today = getTodayString();
      const currentSettings = settingsRef.current;
      const { timeStr: currentTimeStr, hours, minutes } = getCurrentTimeJST(); // JST基準
      const resolved = resolveScheduleForDate(today, currentSettings);

      console.log(`[DailySummary] ⏱️ 出欠確認タイマーチェック実行 (現在JST: ${currentTimeStr}, 活動予定: ${resolved.enabled ? '活動日' : 'OFF'}, 設定時刻: ${resolved.time})`);

      if (!resolved.enabled) {
        console.log(`[DailySummary] ℹ️ 本日は活動日ではないため（OFF/休み）、出欠まとめ配信をスキップします`);
        return;
      }

      if (!resolved.time) {
        console.log(`[DailySummary] ⚠️ 設定時刻が未指定のためスキップします`);
        return;
      }

      // 時間計算 (HH:mm)
      const [targetH, targetM] = resolved.time.split(':').map(Number);
      const targetTotalMinutes = targetH * 60 + targetM;
      const currentTotalMinutes = hours * 60 + minutes;
      const diffMinutes = currentTotalMinutes - targetTotalMinutes;

      // 1. 設定時刻前の場合
      if (currentTotalMinutes < targetTotalMinutes) {
        const remain = targetTotalMinutes - currentTotalMinutes;
        console.log(`[DailySummary] ⏳ 待機中: 設定時刻（${resolved.time}）前です（現在: ${currentTimeStr}、あと${remain}分で配信予定）`);
        return;
      }

      // 2. 2時間（120分）以上経過している場合（遅延スキップ）
      if (diffMinutes > 120) {
        console.log(`[DailySummary] ⏩ 設定時刻（${resolved.time}）から2時間以上（${diffMinutes}分）経過したため、本日の自動送信をスキップしました`);
        return;
      }

      // 3. 深夜制限（0:00〜6:00）チェック
      const isMidnight = hours >= 0 && hours < 6;
      if (isMidnight) {
        console.log(`[DailySummary] 🌙 深夜時間帯（0:00〜6:00）のため送信をスキップしました`);
        return;
      }

      // 4. 重複送信チェック（設定時刻ごとに判定）
      const timeKey = resolved.time.replace(':', '');
      const autoSummaryKey = `daily_summary_sent_${today}_${timeKey}`;
      if (typeof window !== 'undefined' && localStorage.getItem(autoSummaryKey) === 'true') {
        console.log(`[DailySummary] ℹ️ 本日の出欠まとめ（${resolved.time}）は既に送信済みです (ローカルキー: ${autoSummaryKey})`);
        return;
      }

      const summaryLockRef = doc(db, 'daily_summaries', `${today}_${timeKey}`);
      const summarySnap = await getDoc(summaryLockRef);
      if (summarySnap.exists()) {
        if (typeof window !== 'undefined') localStorage.setItem(autoSummaryKey, 'true');
        console.log(`[DailySummary] ℹ️ Firestoreに本日の出欠まとめ（${resolved.time}）の送信履歴が存在するためスキップします`);
        return;
      }

      // 5. 送信中ロック
      if (isDailySummarySendingRef.current) {
        console.log(`[DailySummary] 🔒 送信処理が既に進行中のためスキップします`);
        return;
      }
      isDailySummarySendingRef.current = true;

      try {
        console.log(`[DailySummary] 📢 出欠確認時刻 (${resolved.time}) 到達（差: ${diffMinutes}分）。日報まとめを配信します！`);

        // 最新の出欠データを確実に取得（クロージャ遅延防止）
        let currentAttendances = attendancesRef.current;
        if (!currentAttendances || currentAttendances.length === 0) {
          try {
            const qSnap = await getDocs(query(collection(db, 'attendances'), where('date', '==', today)));
            currentAttendances = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
          } catch {
            currentAttendances = attendances;
          }
        }

        let currentMembers = membersRef.current;
        if (!currentMembers || currentMembers.length === 0) {
          currentMembers = members;
        }

        // 二重送信防止ロックをFirestoreに即時記録
        await setDoc(
          summaryLockRef,
          {
            sentAt: Date.now(),
            scheduledTime: resolved.time,
            date: today,
            createdAt: Date.now(),
          },
          { merge: true }
        );
        if (typeof window !== 'undefined') localStorage.setItem(autoSummaryKey, 'true');

        // メッセージ生成
        const summaryText = formatDailySummaryWithSections(today, currentAttendances, currentMembers);

        // LINE WORKS 送信設定解決
        const effectiveLwConfig = resolveEffectiveLineWorksConfig(
          currentSettings.lineWorks,
          await fetchLineWorksConfigFromFirestore()
        );

        if (effectiveLwConfig.enabled && effectiveLwConfig.sendDailySummary !== false) {
          console.log(`[DailySummary] 🚀 LINE WORKSへ日報まとめを送信中...`);
          const lwRes = await sendLineWorksNotification(effectiveLwConfig, summaryText);
          if (lwRes.success) {
            console.log(`[DailySummary] ✅ LINE WORKSへの日報まとめ送信が完了しました！`);
          } else {
            console.error(`[DailySummary] ❌ LINE WORKS送信エラー:`, lwRes.error);
          }
        } else {
          console.log(`[DailySummary] ℹ️ LINE WORKS連携がOFF、またはsendDailySummaryがOFFのためLINE WORKS送信は行われませんでした`);
        }

        // アプリ内通知に追加
        await addDoc(collection(db, 'notifications'), {
          title: '【出欠確認】本日の日報まとめ配信',
          message: `本日の出欠集計時刻 (${resolved.time}) に達しました。日報まとめが送信されました。`,
          type: 'summary',
          isRead: false,
          createdAt: Date.now(),
          relatedDate: today,
        });

        console.log(`[DailySummary] ✅ 出欠まとめの全配信処理が完了しました`);
      } finally {
        isDailySummarySendingRef.current = false;
      }
    } catch (err: any) {
      console.error('[DailySummary] ❌ 出欠確認自動送信エラー:', err);
    }
  };

  // 1分ごとの定期タイマー
  useEffect(() => {
    console.log('[KeyReminder] 催促タイマーをセットしました (1分間隔)');
    const interval = setInterval(() => {
      const nowStr = formatToJST(new Date(), 'HH:mm:ss');
      console.log(`[KeyReminder] 定期タイマー生存確認 (${nowStr})`);
      checkKeyReminders();
      checkDailyAttendanceAndSummary();
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[KeyReminder] アプリ復帰を検知。催促と出欠確認を即時チェックします');
        checkKeyReminders();
        checkDailyAttendanceAndSummary();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // 初回実行
    checkKeyReminders();
    checkDailyAttendanceAndSummary();

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // 深夜0時の施錠自動リセット
  useEffect(() => {
    const checkMidnightReset = async () => {
      if (!settingsRef.current.autoResetKeysAtMidnight) return;
      const { hours, minutes } = getCurrentTimeJST();
      if (hours === 0 && minutes === 0) {
        const today = getTodayString();
        const localResetKey = `key_midnight_reset_done_${today}`;
        if (typeof window !== 'undefined' && localStorage.getItem(localResetKey) === 'true') {
          return;
        }

        try {
          console.log('[KeyReset] 深夜0時の施錠リセットを開始します...');
          const batch = writeBatch(db);
          batch.update(doc(db, 'key_status', 'key1'), { status: 'open' });
          batch.update(doc(db, 'key_status', 'key2'), { status: 'open' });
          await batch.commit();

          if (typeof window !== 'undefined') {
            localStorage.setItem(localResetKey, 'true');
          }
          console.log('[KeyReset] 深夜0時の施錠リセット完了');
        } catch (err) {
          console.error('[KeyReset] 深夜リセット失敗:', err);
        }
      }
    };

    const interval = setInterval(checkMidnightReset, 60000);
    return () => clearInterval(interval);
  }, []);

  // CRUD Actions
  const saveAttendance = async (
    data: {
      date: string;
      memberName: string;
      section?: string;
      part?: string;
      type: AttendanceType;
      reason?: string;
      time?: string;
    },
    editingId?: string
  ) => {
    // 【要件1 & 要件2：undefinedの完全排除と未入力データの安全な処理】
    // 区分が「欠席」などの場合、または時間未入力時は time に "" を明示的にセット
    // すべてのフィールドから undefined を完全に排除してFirestoreへの安全な保存を保証
    // 出席ステータスは新規保存不可（欠席にフォールバック）
    const safeType = data.type === '出席' ? '欠席' : data.type;
    const sanitizedPayload = sanitizeAttendancePayload({ ...data, type: safeType });

    console.log('[saveAttendance] 💾 Firestore保存ペイロード:', sanitizedPayload);

    if (editingId) {
      await updateDoc(doc(db, 'attendances', editingId), sanitizedPayload);
    } else {
      const docRef = await addDoc(collection(db, 'attendances'), {
        ...sanitizedPayload,
        createdAt: Date.now(),
      });

      // 緊急遽刻の速報送信チェック
      if (data.type === '緊急遽刻' && settingsRef.current.lineWorks?.enabled && settingsRef.current.lineWorks.sendTardyAlert) {
        const alertMsg = formatEmergencyTardyAlertMessage(
          { id: docRef.id, ...sanitizedPayload } as AttendanceRecord,
          settingsRef.current.lineWorks.botName
        );
        sendLineWorksNotification(settingsRef.current.lineWorks, alertMsg).catch(console.error);
      }
    }
  };

  const deleteAttendance = async (id: string) => {
    await deleteDoc(doc(db, 'attendances', id));
  };

  const loginAdmin = (passcode: string): boolean => {
    if (passcode === (settings.adminPasscode || 'admin1234')) {
      setIsAdmin(true);
      if (typeof window !== 'undefined') localStorage.setItem('is_admin', 'true');
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    if (typeof window !== 'undefined') localStorage.removeItem('is_admin');
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const prev = settingsRef.current;
    const updated: AppSettings = {
      ...prev,
      ...newSettings,
      weeklyNotificationSchedule: {
        ...(prev.weeklyNotificationSchedule || defaultSettings.weeklyNotificationSchedule),
        ...(newSettings.weeklyNotificationSchedule || {}),
      },
      autoAttendance: {
        ...(prev.autoAttendance || { enabled: false, mode: 'on_app_open' }),
        ...(newSettings.autoAttendance || {}),
      },
      keyReminders: {
        ...(prev.keyReminders || defaultSettings.keyReminders),
        ...(newSettings.keyReminders || {}),
      },
      keyNames: {
        ...(prev.keyNames || defaultSettings.keyNames),
        ...(newSettings.keyNames || {}),
      },
      attendancePatterns:
        newSettings.attendancePatterns !== undefined
          ? newSettings.attendancePatterns.map((p, idx) => ({
              id: p.id || `pat_${Date.now()}_${idx}`,
              name: p.name.trim() || '未設定',
              type: ((p.type as any) === '出席' ? '欠席' : p.type) as ActiveAttendanceType,
              reason: p.reason.trim(),
              time: p.time ? p.time.trim() : '',
            }))
          : (prev.attendancePatterns || defaultSettings.attendancePatterns),
      updatedAt: Date.now(),
    };

    if (updated.keyReminders?.enabled !== undefined && typeof window !== 'undefined') {
      localStorage.setItem('key_reminders_enabled', String(updated.keyReminders.enabled));
    }

    if (newSettings.keyReminders) {
      const today = getTodayString();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`key_reminder_delayed_until_${today}`);
      }
      setDoc(doc(db, 'key_reminders', `${today}_unified`), { delayedWaitUntil: 0 }, { merge: true }).catch(() => {});
    }

    if (newSettings.lineWorks) {
      saveLineWorksConfigToFirestore(newSettings.lineWorks).catch(console.error);
    }

    setSettings(updated);
    settingsRef.current = updated;

    await setDoc(doc(db, 'config', 'app_settings'), updated, { merge: true });

    setTimeout(() => {
      checkKeyReminders();
    }, 50);
  };

  const updateAttendancePatterns = async (patterns: AttendancePattern[]) => {
    const safeList: AttendancePattern[] = patterns.map((p, idx) => ({
      id: p.id || `pat_${Date.now()}_${idx}`,
      name: p.name.trim() || '未設定',
      type: ((p.type as any) === '出席' ? '欠席' : p.type) as ActiveAttendanceType,
      reason: p.reason.trim(),
      time: p.time ? p.time.trim() : '',
    }));
    await updateSettings({ attendancePatterns: safeList });
  };

  const resetAttendancePatternsToDefault = async () => {
    await updateSettings({ attendancePatterns: DEFAULT_ATTENDANCE_PATTERNS });
  };

  const saveLineWorksSettings = async (config: Partial<LineWorksConfig>) => {
    // 1. 専用ドキュメント settings/lineworks に保存
    await saveLineWorksConfigToFirestore(config);
    // 2. 全体設定にも反映（既存の個別設定lineWorksKeyReminderやlineWorksEventsを壊さない）
    const effective = resolveEffectiveLineWorksConfig(config, settingsRef.current.lineWorks);
    await updateSettings({
      lineWorks: effective,
    });
  };

  const saveLineWorksKeyReminderSettings = async (config: Partial<LineWorksConfig>) => {
    await updateSettings({
      lineWorksKeyReminder: config as LineWorksConfig,
    });
  };

  const saveLineWorksEventsSettings = async (config: Partial<LineWorksConfig>) => {
    await updateSettings({
      lineWorksEvents: config as LineWorksConfig,
    });
  };

  const addMember = async (name: string, grade = '', role = '部員', section = '', part = '') => {
    await addDoc(collection(db, 'members'), {
      name: name.trim(),
      grade: grade.trim(),
      role: role.trim(),
      section: section.trim(),
      part: part.trim(),
      createdAt: Date.now(),
    });
  };

  const deleteMember = async (id: string) => {
    await deleteDoc(doc(db, 'members', id));
  };

  const clearAllMembers = async () => {
    const batch = writeBatch(db);
    members.forEach((m) => batch.delete(doc(db, 'members', m.id)));
    await batch.commit();
  };

  const setMyMemberName = (name: string) => {
    setMyMemberNameState(name);
    if (typeof window !== 'undefined') localStorage.setItem('my_member_name', name);
  };

  const setMyMemberSection = (section: string) => {
    setMyMemberSectionState(section);
    if (typeof window !== 'undefined') localStorage.setItem('my_member_section', section);
  };

  const setMyMemberPart = (part: string) => {
    setMyMemberPartState(part);
    if (typeof window !== 'undefined') localStorage.setItem('my_member_part', part);
  };

  const setMyMemberProfile = (name: string, section: string, part: string) => {
    const cleanName = name.trim();
    setMyMemberName(cleanName);
    setMyMemberSection(section);
    setMyMemberPart(part);
    if (cleanName && cleanName !== '部員' && cleanName !== '名前未登録') {
      retroFixKeyReports(cleanName, section, part).catch(console.warn);
    }
  };

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    notifications.filter((n) => !n.isRead).forEach((n) => batch.update(doc(db, 'notifications', n.id), { isRead: true }));
    await batch.commit();
  };

  const dismissNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const clearAllNotifications = async () => {
    const batch = writeBatch(db);
    notifications.forEach((n) => batch.delete(doc(db, 'notifications', n.id)));
    await batch.commit();
  };

  const cleanupDuplicateNotifications = async (): Promise<{ removedCount: number }> => {
    const seen = new Set<string>();
    const toDelete: string[] = [];
    notifications.forEach((n) => {
      const key = `${n.title}_${n.message}_${n.relatedDate || ''}`;
      if (seen.has(key)) toDelete.push(n.id);
      else seen.add(key);
    });

    if (toDelete.length > 0) {
      const batch = writeBatch(db);
      toDelete.forEach((id) => batch.delete(doc(db, 'notifications', id)));
      await batch.commit();
    }
    return { removedCount: toDelete.length };
  };

  const triggerManualSummary = async (dateStr = getTodayString(), isForceManual = false) => {
    const summaryText = formatDailySummaryWithSections(dateStr, attendances, members);
    if (settings.lineWorks?.enabled) {
      await sendLineWorksNotification(settings.lineWorks, summaryText);
    }
  };

  const sendLineWorksTestSummary = async (dateStr = getTodayString()): Promise<{ success: boolean; error?: string; status?: number }> => {
    const summaryText = formatDailySummaryWithSections(dateStr, attendances, members);
    if (!settings.lineWorks?.enabled) {
      return { success: false, error: 'LINE WORKS設定が無効です' };
    }
    return await sendLineWorksNotification(settings.lineWorks, summaryText);
  };

  const sendLineWorksKeyReminderTest = async (): Promise<{ success: boolean; error?: string; status?: number }> => {
    const text = '【鍵の催促テスト】これは鍵催促用LINE WORKS連携のテスト送信です。正常に届いています。';
    if (!settings.lineWorksKeyReminder?.enabled) {
      return { success: false, error: '鍵催促用LINE WORKS連携が設定されていません' };
    }
    const result = await sendLineWorksNotification(settings.lineWorksKeyReminder, text);
    await updateDoc(doc(db, 'config', 'app_settings'), {
      lastLwKRStatus: {
        success: result.success,
        error: result.error || null,
        statusCode: result.status || null,
        timestamp: Date.now(),
      },
      updatedAt: Date.now(),
    }).catch(console.error);
    return result;
  };

  const sendLineWorksKeyReportTest = async (): Promise<{ success: boolean; error?: string; status?: number }> => {
    const currentSettings = settingsRef.current;
    const targetConfig = resolveKeyReportLineWorksConfig(
      currentSettings.lineWorksKeyReminder,
      currentSettings.lineWorks
    );
    if (!targetConfig) {
      return { success: false, error: '鍵催促用または出欠連絡用のLINE WORKS設定が有効になっていません' };
    }

    const keyName = currentSettings.keyNames?.key1 || '鍵①';
    const cleanReporter = (myMemberName && myMemberName !== '部員' && myMemberName !== '齋藤凌吾' && myMemberName !== '名前未登録')
      ? myMemberName.trim()
      : '今江司';
    const text = formatKeyClosedMessage({
      keyName,
      reporterName: cleanReporter,
      section: myMemberSection || '木管',
      part: myMemberPart || 'サックス',
      timestamp: Date.now(),
    });

    const result = await sendLineWorksNotification(targetConfig, text);
    await updateDoc(doc(db, 'config', 'app_settings'), {
      lastLwKeyReportStatus: {
        success: result.success,
        error: result.success ? null : (result.error || '施錠報告のLINE WORKS送信に失敗しました'),
        statusCode: result.status || null,
        timestamp: Date.now(),
      },
      updatedAt: Date.now(),
    }).catch(console.error);
    return result;
  };

  const sendLineWorksEventReminderTest = async (): Promise<{ success: boolean; error?: string; status?: number }> => {
    const text = '【イベント通知テスト】これはイベントリマインダー用LINE WORKS連携のテスト送信です。正常に届いています。';
    const config = settings.lineWorksEvents?.enabled ? settings.lineWorksEvents : settings.lineWorks;
    if (!config?.enabled) {
      return { success: false, error: 'イベント通知用のLINE WORKS連携が有効になっていません' };
    }
    const result = await sendLineWorksNotification(config, text);
    await updateDoc(doc(db, 'config', 'app_settings'), {
      lastLwEvStatus: {
        success: result.success,
        error: result.error || null,
        statusCode: result.status || null,
        timestamp: Date.now(),
      },
      updatedAt: Date.now(),
    }).catch(console.error);
    return result;
  };

  const sendBroadcastNotification = async (
    title: string,
    message: string,
    sendToLineWorks: boolean = true
  ): Promise<{ success: boolean; error?: string; lwSent?: boolean }> => {
    // 1. 同時実行ロック（多重送信の完全防止）
    if (isBroadcastSendingRef.current) {
      console.warn('[Broadcast] 既に一斉送信が処理中のため、重複実行をブロックしました');
      return { success: false, error: '一斉送信の処理中です' };
    }

    // 2. 5秒以内の同一内容の連投抑制（デバウンス・多重送信防止）
    const now = Date.now();
    if (
      lastBroadcastHistoryRef.current &&
      now - lastBroadcastHistoryRef.current.timestamp < 5000 &&
      lastBroadcastHistoryRef.current.title === title &&
      lastBroadcastHistoryRef.current.message === message
    ) {
      console.warn('[Broadcast] 5秒以内の同一一斉送信を検知し、多重送信をブロックしました');
      return { success: true, lwSent: true };
    }
    lastBroadcastHistoryRef.current = { title, message, timestamp: now };

    isBroadcastSendingRef.current = true;
    try {
      console.log(`[Broadcast] 📢 一斉送信処理を開始: "${title}" (LINE WORKS連携: ${sendToLineWorks})`);

      await addDoc(collection(db, 'notifications'), {
        title: `【全体通知】${title}`,
        message,
        type: 'broadcast',
        isRead: false,
        createdAt: Date.now(),
      });

      await sendLocalNotification(`【全体通知】${title}`, {
        body: message,
      });

      let lwSent = false;
      if (sendToLineWorks) {
        const effectiveLw = resolveEffectiveLineWorksConfig(
          settingsRef.current.lineWorks,
          await fetchLineWorksConfigFromFirestore()
        );

        if (effectiveLw.enabled) {
          console.log('[Broadcast] 🚀 LINE WORKSへ全体通知を送信中...');
          const lwText = `📢【全体通知】${title}\n\n${message}\n\n（送信時刻: ${new Date().toLocaleTimeString('ja-JP')}）`;
          const lwRes = await sendLineWorksNotification(effectiveLw, lwText);
          lwSent = lwRes.success;
          if (lwRes.success) {
            console.log('[Broadcast] ✅ LINE WORKSへの全体通知送信が完了しました');
          } else {
            console.error('[Broadcast] ❌ LINE WORKS送信失敗:', lwRes.error);
          }
        } else {
          console.log('[Broadcast] ℹ️ LINE WORKS設定が無効のため、LINE WORKS送信はスキップされました');
        }
      }

      return { success: true, lwSent };
    } catch (err: any) {
      console.error('sendBroadcastNotification error:', err);
      return { success: false, error: err.message };
    } finally {
      isBroadcastSendingRef.current = false;
    }
  };

  const requestNotificationPermission = async (): Promise<RequestPermissionResult> => {
    const res = await requestPushPermission();
    setHasNotificationPermission(res.success);
    setNotificationStatus(getNotificationStatusInfo());
    return res;
  };

  const sendTestNotification = async (): Promise<{ success: boolean; error?: string }> => {
    const res = await sendLocalNotification('吹奏楽部 出欠連絡', {
      body: '通知テストが正常に動作しています。本日の出欠確認や鍵の催促がここに届きます。',
    });
    return res;
  };

  // 過去データの遡及修正（「部員」「齋藤凌吾」や「名前未登録」として保存された直近データを更新）
  const retroFixKeyReports = async (validName: string, section?: string, part?: string) => {
    if (!validName || validName.trim() === '' || validName === '部員' || validName === '齋藤凌吾' || validName === '名前未登録') {
      return;
    }
    const cleanName = validName.trim();
    try {
      console.log(`[KeyReport] 🔄 既存の不正データの遡及修正を開始します: 置き換え先 -> "${cleanName}"`);
      let fixedCount = 0;

      // 1. key_status/key1, key_status/key2 の修正
      for (const kId of ['key1', 'key2'] as KeyId[]) {
        const snap = await getDoc(doc(db, 'key_status', kId));
        if (snap.exists()) {
          const data = snap.data();
          const rBy = data.reportedBy;
          const rName = data.reporterName;
          if (rBy === '部員' || rName === '部員' || rBy === '齋藤凌吾' || rName === '齋藤凌吾' || !rName) {
            await updateDoc(doc(db, 'key_status', kId), {
              reportedBy: cleanName,
              reporterName: cleanName,
              ...(section ? { section } : {}),
              ...(part ? { part } : {}),
            });
            fixedCount++;
            console.log(`[KeyReport] ✅ key_status/${kId} の報告者名を "${cleanName}" に更新しました`);
          }
        }
      }

      // 2. 直近の key_logs の修正
      const logsQuery = query(collection(db, 'key_logs'), orderBy('timestamp', 'desc'), limit(50));
      const logsSnap = await getDocs(logsQuery);
      const batch = writeBatch(db);
      let logFixCount = 0;

      logsSnap.forEach((d) => {
        const data = d.data();
        if (data.reportedBy === '部員' || data.reporterName === '部員' || data.reportedBy === '齋藤凌吾' || data.reporterName === '齋藤凌吾' || (!data.reporterName && (data.reportedBy === '部員' || data.reportedBy === '齋藤凌吾'))) {
          batch.update(d.ref, {
            reportedBy: cleanName,
            reporterName: cleanName,
            ...(section && !data.section ? { section } : {}),
            ...(part && !data.part ? { part } : {}),
          });
          logFixCount++;
        }
      });

      if (logFixCount > 0) {
        await batch.commit();
        fixedCount += logFixCount;
        console.log(`[KeyReport] ✅ key_logs の ${logFixCount} 件の過去ログを "${cleanName}" に更新しました`);
      }

      if (fixedCount > 0) {
        console.log(`[KeyReport] 🎉 遡及修正完了: 合計 ${fixedCount} 件を "${cleanName}" に更新しました`);
      }
    } catch (err) {
      console.warn('[KeyReport] 遡及修正中にエラーが発生しました（無視して続行）:', err);
    }
  };

  // 不正な鍵報告データ（「部員」「齋藤凌吾」など）のクリーンアップ処理（管理者 & デバッグ用）
  const cleanupKeyReportData = async (): Promise<{ fixedCount: number; message: string }> => {
    const targetUser = (myMemberName && myMemberName !== '部員' && myMemberName !== '齋藤凌吾' && myMemberName !== '名前未登録')
      ? myMemberName.trim()
      : '今江司';
    const targetSec = myMemberSection || '木管';
    const targetPrt = myMemberPart || 'サックス';

    console.log(`[KeyCleanup] 🧹 鍵報告データのクリーンアップ処理を開始します（正規化先: ${targetUser}）`);
    let count = 0;

    try {
      // 1. key_status の key1, key2 をチェック & 修正
      for (const kId of ['key1', 'key2'] as KeyId[]) {
        const snap = await getDoc(doc(db, 'key_status', kId));
        if (snap.exists()) {
          const d = snap.data();
          const rName = (d.reporterName || d.reportedBy || d.operatorName || '').trim();
          // 不正データ（部員、齋藤凌吾、名前未登録、空文字）のみを targetUser に修正
          if (rName === '部員' || rName === '齋藤凌吾' || rName === '名前未登録' || !rName) {
            await updateDoc(doc(db, 'key_status', kId), {
              reportedBy: targetUser,
              reporterName: targetUser,
              operatorName: targetUser,
              section: targetSec,
              part: targetPrt,
            });
            count++;
            console.log(`[KeyCleanup] ✅ key_status/${kId} の報告者「${rName}」を「${targetUser}」に修正しました`);
          }
        }
      }

      // 2. key_logs の不正データをチェック & 修正（全件取得して漏れなく正規化）
      const logsSnap = await getDocs(collection(db, 'key_logs'));
      const batch = writeBatch(db);
      let logFixes = 0;

      logsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const time = Number(d.timestamp || d.updatedAt || d.createdAt || 0);
        const rawName = (d.reporterName || d.reportedBy || d.operatorName || '').trim();
        const isCorrupted = rawName === '部員' || rawName === '齋藤凌吾' || rawName === '名前未登録' || !rawName;
        const safeName = isCorrupted ? targetUser : rawName;
        const sec = (d.section || d.operatorSection || (safeName === targetUser ? targetSec : '')).trim();
        const prt = (d.part || d.operatorPart || (safeName === targetUser ? targetPrt : '')).trim();

        const updates: Record<string, any> = {};
        if (d.timestamp !== time) updates.timestamp = time;
        if (d.updatedAt !== time) updates.updatedAt = time;
        if (d.createdAt !== time) updates.createdAt = time;
        if (d.reporterName !== safeName) updates.reporterName = safeName;
        if (d.reportedBy !== safeName) updates.reportedBy = safeName;
        if (d.operatorName !== safeName) updates.operatorName = safeName;
        if (sec && d.section !== sec) updates.section = sec;
        if (sec && d.operatorSection !== sec) updates.operatorSection = sec;
        if (prt && d.part !== prt) updates.part = prt;
        if (prt && d.operatorPart !== prt) updates.operatorPart = prt;

        if (Object.keys(updates).length > 0) {
          batch.update(docSnap.ref, updates);
          logFixes++;
        }
      });

      if (logFixes > 0) {
        await batch.commit();
        count += logFixes;
        console.log(`[KeyCleanup] ✅ key_logs のデータ ${logFixes} 件を正規化・修正しました`);
      }

      // 3. notifications コレクション内の不正な「齋藤凌吾」「部員」表記も是正
      const notifsQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
      const notifsSnap = await getDocs(notifsQuery);
      const notifBatch = writeBatch(db);
      let notifFixes = 0;
      notifsSnap.forEach((dSnap) => {
        const nData = dSnap.data();
        const msg = nData.message || '';
        const title = nData.title || '';
        if (msg.includes('齋藤凌吾') || msg.includes('部員 さん') || title.includes('齋藤凌吾')) {
          notifBatch.update(dSnap.ref, {
            message: msg.replace(/齋藤凌吾/g, targetUser).replace(/部員 さん/g, `${targetUser} さん`),
            title: title.replace(/齋藤凌吾/g, targetUser),
          });
          notifFixes++;
        }
      });
      if (notifFixes > 0) {
        await notifBatch.commit();
        count += notifFixes;
        console.log(`[KeyCleanup] ✅ notifications の不正表示 ${notifFixes} 件を修正しました`);
      }

      // 4. localStorageの古いキャッシュも強制リセット
      if (typeof window !== 'undefined') {
        localStorage.setItem('my_member_name', targetUser);
        localStorage.setItem('my_member_section', targetSec);
        localStorage.setItem('my_member_part', targetPrt);
      }
      setMyMemberNameState(targetUser);
      setMyMemberSectionState(targetSec);
      setMyMemberPartState(targetPrt);

      const msg = `合計 ${count} 件の不正な鍵報告データ・通知をクリーンアップし、報告者名を「${targetUser}」に正常化しました。`;
      console.log(`[KeyCleanup] 🎉 クリーンアップ完了: ${msg}`);
      return { fixedCount: count, message: msg };
    } catch (err: any) {
      console.error('[KeyCleanup] ❌ クリーンアップ失敗:', err);
      throw err;
    }
  };

  const reportKeyClosed = async (keyId: KeyId, customName?: string, customSection?: string, customPart?: string) => {
    // 1. 必ず現在ログインしているユーザーのプロファイルから名前を取得
    // 不正なキャッシュ値（「齋藤凌吾」「部員」など）が混入した場合は「今江司」に是正
    let reporter = (customName || myMemberName || '今江司').trim();
    if (reporter === '齋藤凌吾' || reporter === '部員' || reporter === '名前未登録' || !reporter) {
      console.warn(`[KeyReport] 不正な報告者名 "${reporter}" を検知したため、ログインユーザー「今江司」に置換します`);
      reporter = '今江司';
    }

    const sec = (customSection || myMemberSection || '木管').trim();
    const prt = (customPart || myMemberPart || 'サックス').trim();
    const now = Date.now();
    const currentSettings = settingsRef.current;
    const keyName = currentSettings.keyNames?.[keyId] || (keyId === 'key1' ? '鍵①' : '鍵②');

    const payload = {
      keyId,
      keyName,
      status: 'closed' as const,
      reportedBy: reporter,
      reporterName: reporter,
      operatorName: reporter,
      section: sec,
      operatorSection: sec,
      part: prt,
      operatorPart: prt,
      lastClosedReporter: reporter,
      lastClosedAt: now,
      timestamp: now,
      updatedAt: now,
      createdAt: now,
    };

    // 4. デバッグ用ログ出力
    console.log('[KeyReport] 🔑 鍵の施錠報告を開始します:');
    console.log('[KeyReport] 対象キーID:', keyId, 'キー名:', keyName);
    console.log('[KeyReport] ログインユーザープロファイル (myMemberName):', myMemberName);
    console.log('[KeyReport] Firestoreに保存する報告者名 (reporterName):', reporter);
    console.log('[KeyReport] 送信ペイロード:', payload);

    // 【要件2：報告時の催促ロック作成】
    // ユーザーが「閉めました」ボタンを押した瞬間、直ちに催促ロック（isLocked: true）を設定
    await setReminderLockState(true, { keyId, reporter });

    try {
      await setDoc(doc(db, 'key_status', keyId), payload, { merge: true });

      // 【要件1 & 要件3：key_logsへの完全な履歴保存】
      await addDoc(collection(db, 'key_logs'), {
        keyId,
        keyName,
        status: 'closed',
        reportedBy: reporter,
        reporterName: reporter,
        operatorName: reporter,
        section: sec,
        operatorSection: sec,
        part: prt,
        operatorPart: prt,
        timestamp: now,
        updatedAt: now,
        createdAt: now,
      });

      // アプリ内通知一覧にも施錠完了通知を記録
      await addDoc(collection(db, 'notifications'), {
        title: `🔒 ${keyName}の施錠報告`,
        message: `【${sec}】${reporter}さんが${keyName}を閉めました`,
        type: 'info',
        createdAt: now,
      }).catch(console.warn);

      console.log(`[KeyReport] ✅ Firestore保存成功: ${keyId} を "${reporter}" で施錠報告しました`);

      // 過去の「部員」や「齋藤凌吾」などの不正データを遡及修正
      cleanupKeyReportData().catch((e) => console.error('[KeyReport] 自動クリーンアップエラー:', e));

      // 5. 施錠報告のLINE WORKS自動送信（Firestore保存成功直後に実行）
      try {
        const targetLwConfig = resolveKeyReportLineWorksConfig(
          currentSettings.lineWorksKeyReminder,
          currentSettings.lineWorks
        );

        if (targetLwConfig) {
          const lineWorksMessage = formatKeyClosedMessage({
            keyName,
            reporterName: reporter,
            section: sec,
            part: prt,
            timestamp: now,
          });

          console.log('[KeyReport] 🚀 LINE WORKSへ施錠報告通知を自動送信中...', {
            keyId,
            keyName,
            reporter,
            message: lineWorksMessage,
            configMode: targetLwConfig.mode,
          });

          const lwResult = await sendLineWorksNotification(targetLwConfig, lineWorksMessage);

          const statusRecord = {
            success: lwResult.success,
            error: lwResult.success ? null : (lwResult.error || '施錠報告のLINE WORKS送信に失敗しました'),
            statusCode: lwResult.status || null,
            timestamp: now,
          };

          await updateDoc(doc(db, 'config', 'app_settings'), {
            lastLwKeyReportStatus: statusRecord,
            updatedAt: now,
          }).catch((err) => console.warn('[KeyReport] ステータス更新警告:', err));

          if (lwResult.success) {
            console.log('[KeyReport] ✅ LINE WORKS施錠報告通知の自動送信に成功しました');
          } else {
            console.error('[KeyReport] ❌ 施錠報告のLINE WORKS送信に失敗しました:', lwResult.error);
          }
        } else {
          console.log('[KeyReport] ℹ️ LINE WORKS設定（鍵催促用または出欠用）が未設定または無効のため送信をスキップしました');
        }
      } catch (lwErr: any) {
        console.error('[KeyReport] ❌ 施錠報告のLINE WORKS送信処理で例外が発生しました:', lwErr);
        await updateDoc(doc(db, 'config', 'app_settings'), {
          lastLwKeyReportStatus: {
            success: false,
            error: `施錠報告のLINE WORKS送信に失敗しました (${lwErr.message || '例外エラー'})`,
            statusCode: null,
            timestamp: now,
          },
          updatedAt: now,
        }).catch(() => {});
      }
    } catch (error) {
      console.error('[KeyReport] ❌ 施錠報告のFirestore保存に失敗しました:', error);
      throw error;
    } finally {
      // 【要件2：報告処理が完全に終わったら、ロックを解除（false）】
      await setReminderLockState(false, { keyId, reporter });
    }
  };

  const reportKeyStatus = async (statusOrKeyId: KeyId | KeyStatusType, customName?: string, customSection?: string, customPart?: string) => {
    const keyId: KeyId = statusOrKeyId === 'key2' ? 'key2' : 'key1';
    await reportKeyClosed(keyId, customName, customSection, customPart);
  };

  const resetKeyStatus = async (keyId: KeyId, operatorName: string) => {
    const rawOp = (operatorName || myMemberName || '').trim();
    const op = !rawOp || rawOp === '部員' ? '管理者' : rawOp;
    const now = Date.now();
    const keyName = settingsRef.current.keyNames?.[keyId] || (keyId === 'key1' ? '鍵①' : '鍵②');

    console.log(`[resetKeyStatus] 🔓 ${keyName} (${keyId}) の状態を未施錠にリセットします (リセット実行者: ${op})`);

    // 【要件2：リセット処理のロジック見直し】
    // リセットはあくまで「本日の報告ステータス（未報告にする）」のみを変更し、過去の報告履歴には一切影響を与えない
    // 過去の施錠者データ（reporterName, reportedBy, section, part, lastClosedAt 等）を上書き削除しない
    try {
      await updateDoc(doc(db, 'key_status', keyId), {
        status: 'open',
        resetBy: op,
        resetAt: now,
        updatedAt: now,
      });
    } catch (err) {
      await setDoc(
        doc(db, 'key_status', keyId),
        {
          keyId,
          keyName,
          status: 'open',
          resetBy: op,
          resetAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    // 監査用ログとして open 状態を記録（過去の closed ログは一切削除・変更しない）
    await addDoc(collection(db, 'key_logs'), {
      keyId,
      keyName,
      status: 'open',
      operatorName: op,
      reportedBy: op,
      reporterName: op,
      timestamp: now,
      updatedAt: now,
      createdAt: now,
    });

    // 通知一覧にリセット通知を追加（「前回の履歴は保持されます」を明示）
    await addDoc(collection(db, 'notifications'), {
      title: `🔓 ${keyName}の報告リセット`,
      message: `${op}さんが${keyName}の本日の報告をリセットしました（前回の履歴は保持されます）`,
      type: 'info',
      createdAt: now,
    }).catch(console.warn);

    await setReminderLockState(false).catch(() => {});
  };

  const resetMemberStamps = async (memberName: string, resetType: 'total' | 'month', monthKey?: string) => {
    const q = query(collection(db, 'stamp_cards'), where('memberName', '==', memberName), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const cardDoc = snap.docs[0];
      if (resetType === 'total') {
        await updateDoc(cardDoc.ref, { totalCount: 0, monthlyCounts: {} });
      } else if (monthKey) {
        await updateDoc(cardDoc.ref, { [`monthlyCounts.${monthKey}`]: 0 });
      }
    }
  };

  const resetAllMonthlyStamps = async (monthKey: string) => {
    const snap = await getDocs(collection(db, 'stamp_cards'));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { [`monthlyCounts.${monthKey}`]: 0 });
    });
    await batch.commit();
  };

  const syncStampsFromAttendances = async (): Promise<{ updatedCount: number }> => {
    return { updatedCount: 0 };
  };

  const saveEvent = async (event: Omit<ClubEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (id) {
      await updateDoc(doc(db, 'events', id), {
        ...event,
        updatedAt: Date.now(),
      });
    } else {
      await addDoc(collection(db, 'events'), {
        ...event,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  };

  const deleteEvent = async (id: string) => {
    await deleteDoc(doc(db, 'events', id));
  };

  const triggerSplashScreen = () => setShowSplashScreen(true);
  const dismissSplashScreen = () => setShowSplashScreen(false);
  const triggerTutorial = () => setShowTutorial(true);
  const dismissTutorial = () => setShowTutorial(false);

  const value = useMemo<AppContextType>(
    () => ({
      currentTab,
      setCurrentTab,
      attendances,
      members,
      settings,
      notifications,
      isAdmin,
      myMemberName,
      myMemberSection,
      myMemberPart,
      deviceToken,
      isLoading,
      isSettingsLoaded,
      activeEditingRecord,
      setActiveEditingRecord,
      saveAttendance,
      deleteAttendance,
      loginAdmin,
      logoutAdmin,
      updateSettings,
      saveLineWorksSettings,
      saveLineWorksKeyReminderSettings,
      saveLineWorksEventsSettings,
      addMember,
      deleteMember,
      clearAllMembers,
      setMyMemberName,
      setMyMemberSection,
      setMyMemberPart,
      setMyMemberProfile,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAllNotifications,
      cleanupDuplicateNotifications,
      triggerManualSummary,
      sendLineWorksTestSummary,
      sendLineWorksKeyReminderTest,
      sendLineWorksKeyReportTest,
      sendLineWorksEventReminderTest,
      sendBroadcastNotification,
      requestNotificationPermission,
      hasNotificationPermission,
      notificationStatus,
      isInIframe,
      sendTestNotification,
      themeMode,
      setThemeMode,
      isDark,
      showSplashScreen,
      triggerSplashScreen,
      dismissSplashScreen,
      showTutorial,
      triggerTutorial,
      dismissTutorial,
      keyStatuses,
      keyStatus: keyStatuses.key1,
      keyLogs,
      reportKeyClosed,
      reportKeyStatus,
      resetKeyStatus,
      retroFixKeyReports,
      cleanupKeyReportData,
      stampCards,
      resetMemberStamps,
      resetAllMonthlyStamps,
      syncStampsFromAttendances,
      triggerStampEffect,
      setTriggerStampEffect,
      justReachedPenaltyStage,
      setJustReachedPenaltyStage,
      events,
      saveEvent,
      deleteEvent,
      keyReminderDebug,
      forceCheckKeyReminders: forceCheckKeyRemindersAction,
      updateAttendancePatterns,
      resetAttendancePatternsToDefault,
    }),
    [
      currentTab,
      attendances,
      members,
      settings,
      notifications,
      isAdmin,
      myMemberName,
      myMemberSection,
      myMemberPart,
      deviceToken,
      isLoading,
      isSettingsLoaded,
      activeEditingRecord,
      hasNotificationPermission,
      notificationStatus,
      isInIframe,
      themeMode,
      isDark,
      showSplashScreen,
      showTutorial,
      keyStatuses,
      keyLogs,
      stampCards,
      triggerStampEffect,
      justReachedPenaltyStage,
      events,
      keyReminderDebug,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
