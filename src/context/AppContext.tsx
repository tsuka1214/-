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
  ClubEvent,
  PackingListCategory,
  EventClothing,
} from '../types';
import { getTodayString, getCurrentTimeJST, formatTimestamp, formatToJST } from '../utils/date';
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
} from '../utils/lineworks';
import {
  formatAttendanceRecordShareText,
  formatDailySummaryWithSections,
} from '../utils/formatShareText';
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
  addMember: (name: string, grade?: string, role?: string, section?: string, part?: string) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  clearAllMembers: () => Promise<void>;
  setMyMemberName: (name: string) => void;
  setMyMemberProfile: (name: string, section: string, part: string) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  cleanupDuplicateNotifications: () => Promise<{ removedCount: number }>;
  triggerManualSummary: (dateStr?: string, isForceManual?: boolean) => Promise<void>;
  sendLineWorksTestSummary: (dateStr?: string) => Promise<{ success: boolean; error?: string; status?: number }>;
  sendLineWorksKeyReminderTest: () => Promise<{ success: boolean; error?: string; status?: number }>;
  sendLineWorksEventReminderTest: () => Promise<{ success: boolean; error?: string; status?: number }>;
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
}

const defaultSettings: AppSettings = {
  summaryNotificationTime: '',
  weeklyNotificationSchedule: DEFAULT_WEEKLY_SCHEDULE,
  dateSpecificOverrides: {},
  notificationsEnabled: true,
  adminPasscode: 'admin1234',
  clubName: '部活動',
  keyNames: {
    key1: '鍵①',
    key2: '鍵②',
  },
  keyReminders: {
    enabled: false,
    appNotificationEnabled: true,
    lineWorksNotificationEnabled: false,
    startTime: '18:00',
    intervalMinutes: 15,
    maxCount: 3,
    onlyOnActiveDays: false,
    useSummaryTime: false,
  },
  keyResetAdminOnly: false,
  autoResetKeysAtMidnight: true,
  autoAttendance: {
    enabled: false,
    mode: 'on_app_open',
    time: '08:30',
  },
  penaltyStages: [],
  schedulePresets: [],
  lineWorks: {
    enabled: false,
    webhookUrl: '',
    botName: '部活出欠bot',
    sendDailySummary: true,
    sendTardyAlert: true,
  },
};

const initialSampleMembers: { name: string; grade: string; role: string }[] = [];

const AppContext = createContext<AppContextType | null>(null);

function getOrCreateDeviceToken(): string {
  const existing = localStorage.getItem('club_device_token');
  if (existing) return existing;
  const newToken = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  localStorage.setItem('club_device_token', newToken);
  return newToken;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userReadIds, setUserReadIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('club_is_admin') === 'true';
  });
  const [myMemberName, setMyMemberNameState] = useState<string>(() => {
    return localStorage.getItem('club_my_name') || '';
  });
  const [myMemberSection, setMyMemberSectionState] = useState<string>(() => {
    return localStorage.getItem('club_my_section') || '';
  });
  const [myMemberPart, setMyMemberPartState] = useState<string>(() => {
    return localStorage.getItem('club_my_part') || '';
  });
  const [deviceToken] = useState<string>(getOrCreateDeviceToken);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(false);
  const [isAttendancesLoaded, setIsAttendancesLoaded] = useState<boolean>(false);
  const [activeEditingRecord, setActiveEditingRecord] = useState<AttendanceRecord | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>(() => {
    return getNotificationStatusInfo().permission;
  });
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => {
    return getNotificationStatusInfo().permission === 'granted';
  });
  const [isInIframe] = useState<boolean>(() => getNotificationStatusInfo().isInIframe);

  // Club Key Status State (部室の鍵開閉報告・2鍵対応)
  const [keyStatuses, setKeyStatuses] = useState<Record<KeyId, ClubKeyStatus | null>>({
    key1: null,
    key2: null,
  });
  const [keyLogs, setKeyLogs] = useState<ClubKeyLog[]>([]);

  // Dark mode / Theme settings
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('club_attendance_theme_mode') : null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'system';
  });
  const [isDark, setIsDark] = useState<boolean>(false);

  // Splash Screen State: 起動時に1回だけ表示し、セッション内やホーム画面に戻った際には再表示しない
  const [showSplashScreen, setShowSplashScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return !sessionStorage.getItem('brass_splash_screen_shown');
      } catch {
        return true;
      }
    }
    return true;
  });

  const triggerSplashScreen = () => {
    setShowSplashScreen(true);
  };

  const dismissSplashScreen = () => {
    setShowSplashScreen(false);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('brass_splash_screen_shown', 'true');
      } catch {}
    }
  };

  // Tutorial Screen State: アプリを初めて使う時だけ表示する
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  const triggerTutorial = () => {
    setShowTutorial(true);
  };

  const dismissTutorial = () => {
    setShowTutorial(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('brass_tutorial_shown', 'true');
      } catch {}
    }
  };

  // Negative Stamp Cards State (緊急遽刻の負のスタンプカード)
  const [stampCards, setStampCards] = useState<EmergencyStampCard[]>([]);
  const [triggerStampEffect, setTriggerStampEffect] = useState<boolean>(false);
  const [justReachedPenaltyStage, setJustReachedPenaltyStage] = useState<PenaltyStage | null>(null);
  const [events, setEvents] = useState<ClubEvent[]>([]);

  // 初回起動時のチェック: スプラッシュ画面が消えた後に、チュートリアルを見たことがなければ表示する
  useEffect(() => {
    if (!showSplashScreen) {
      const hasSeen = localStorage.getItem('brass_tutorial_shown') === 'true';
      if (!hasSeen) {
        setShowTutorial(true);
      }
    }
  }, [showSplashScreen]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('club_attendance_theme_mode', mode);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => {
      const activeDark =
        themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      setIsDark(activeDark);
      if (activeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    handleThemeChange();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    } else {
      mediaQuery.addListener(handleThemeChange);
      return () => mediaQuery.removeListener(handleThemeChange);
    }
  }, [themeMode]);

  const setMyMemberName = (name: string) => {
    setMyMemberNameState(name);
    localStorage.setItem('club_my_name', name);
  };

  const setMyMemberSection = (section: string) => {
    setMyMemberSectionState(section);
    localStorage.setItem('club_my_section', section);
  };

  const setMyMemberPart = (part: string) => {
    setMyMemberPartState(part);
    localStorage.setItem('club_my_part', part);
  };

  const setMyMemberProfile = (name: string, section: string, part: string) => {
    setMyMemberNameState(name);
    setMyMemberSectionState(section);
    setMyMemberPartState(part);
    localStorage.setItem('club_my_name', name);
    localStorage.setItem('club_my_section', section);
    localStorage.setItem('club_my_part', part);
  };

  const requestNotificationPermission = async (): Promise<RequestPermissionResult> => {
    const res = await requestPushPermission();
    setNotificationStatus(res.status);
    setHasNotificationPermission(res.success);
    if (res.success) {
      // Send a confirmation test notification
      sendLocalNotification('🔔 通知が許可されました！', {
        body: '部活動出欠連絡のプッシュ通知が正常に有効化されました。',
      }).catch(console.warn);
    }
    return res;
  };

  const sendTestNotification = async (): Promise<{ success: boolean; error?: string }> => {
    return sendLocalNotification('🔔 通知テスト: 部活動出欠アプリ', {
      body: 'プッシュ通知は正常に機能しています！遅刻連絡や出欠まとめをこの端末で受信できます。',
    });
  };

  // Helper to show browser notification
  const showNativeNotification = (title: string, body: string) => {
    sendLocalNotification(title, { body }).catch(console.warn);
  };

  // Safety check to ensure isLoading eventually becomes false
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('Loading timeout reached, forcing app to display');
        setIsLoading(false);
      }
    }, 8000); // 8 seconds safety window
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Combined loading state monitor
  useEffect(() => {
    if (isSettingsLoaded && isAttendancesLoaded) {
      setIsLoading(false);
    }
  }, [isSettingsLoaded, isAttendancesLoaded]);

  // 1. Listen to Settings & Seed Defaults
  useEffect(() => {
    const settingsDocRef = doc(db, 'config', 'app_settings');
    const unsubscribe = onSnapshot(settingsDocRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data() as AppSettings;
          // Migration: If penaltyStages is missing, create it from penaltyThreshold
          const penaltyStages = data.penaltyStages || [
            { threshold: data.penaltyThreshold || 3, label: '罰ゲーム' },
          ];
          
          setSettings({
            ...defaultSettings,
            ...data,
            penaltyStages,
            keyNames: {
              ...defaultSettings.keyNames,
              ...(data.keyNames || {}),
            },
            keyReminders: {
              ...defaultSettings.keyReminders,
              ...(data.keyReminders || {}),
            },
            autoAttendance: {
              ...defaultSettings.autoAttendance!,
              ...(data.autoAttendance || {}),
            },
          });
        } else {
          // Seed default settings if completely missing
          setDoc(settingsDocRef, defaultSettings).catch(console.error);
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.error('Error processing settings data:', err);
        setSettings(defaultSettings);
      } finally {
        setIsSettingsLoaded(true);
      }
    }, (err) => {
      console.error('Settings snapshot error:', err);
      setIsSettingsLoaded(true); // Fail gracefully
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen to Members
  useEffect(() => {
    const membersCollRef = collection(db, 'members');
    const unsubscribe = onSnapshot(membersCollRef, (snapshot) => {
      const list: ClubMember[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || '',
          grade: d.grade || '',
          role: d.role || '',
          section: d.section || '',
          part: d.part || '',
          order: d.order ?? 0,
        };
      });
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'ja'));
      setMembers(list);
    }, (err) => {
      console.error('Members snapshot error:', err);
    });

    return () => unsubscribe();
  }, []);

  // 3. Listen to Attendances
  useEffect(() => {
    const attendancesCollRef = collection(db, 'attendances');
    const unsubscribe = onSnapshot(attendancesCollRef, (snapshot) => {
      const records: AttendanceRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          date: d.date || '',
          memberName: d.memberName || '',
          section: d.section || '',
          part: d.part || '',
          type: d.type || '欠席',
          reason: d.reason || '',
          time: d.time || '',
          authorDeviceToken: d.authorDeviceToken || '',
          createdAt: d.createdAt || Date.now(),
          updatedAt: d.updatedAt,
        };
      });
      // Sort by date desc, then by createdAt desc
      records.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.createdAt - a.createdAt;
      });
      setAttendances(records);
      setIsAttendancesLoaded(true);
    }, (err) => {
      console.error('Attendance snapshot error:', err);
      setIsAttendancesLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // 4. Listen to Notifications
  useEffect(() => {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const items: NotificationItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: d.title || '通知',
          message: d.message || '',
          type: (d.type === 'reminder' || d.type === 'urgent' || d.type === 'summary' ? d.type : 'info') as NotificationItem['type'],
          relatedDate: d.relatedDate || '',
          attendanceId: d.attendanceId,
          keyId: d.keyId,
          isRead: false, // Will be merged with userReadIds
          reminderCount: d.reminderCount,
          createdAt: d.createdAt || Date.now(),
        };
      });
      setNotifications(items);
    }, (err) => {
      console.error('Notifications snapshot error:', err);
    });

    return () => unsubscribe();
  }, []);

  // 4.5 Listen to User's Read Status
  useEffect(() => {
    const userId = myMemberName || deviceToken;
    if (!userId) return;

    // Use a subcollection or a filtered collection for user's read status
    // We'll use 'notification_reads' collection with documents named "{userId}_{notifId}"
    // But for listing, we need a query.
    // To keep it simple and efficient, we only fetch reads for the last 100 notifications.
    const readsQuery = query(
      collection(db, 'notification_reads'),
      where('userId', '==', userId),
      orderBy('readAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(readsQuery, (snapshot) => {
      const readIds = new Set<string>();
      snapshot.docs.forEach((docSnap) => {
        readIds.add(docSnap.data().notificationId);
      });
      setUserReadIds(readIds);
    }, (err) => {
      console.error('Read status snapshot error:', err);
    });

    return () => unsubscribe();
  }, [myMemberName, deviceToken]);

  // Compute merged notifications with read status
  const mergedNotifications = useMemo(() => {
    return notifications.map(n => ({
      ...n,
      isRead: userReadIds.has(n.id)
    }));
  }, [notifications, userReadIds]);

  // 5. Listen to Club Key Status (部室の鍵①・鍵②の最新状態)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'key_status'),
      (snapshot) => {
        const statuses: Record<KeyId, ClubKeyStatus | null> = {
          key1: null,
          key2: null,
        };
        snapshot.docs.forEach((docSnap) => {
          const id = docSnap.id;
          const d = docSnap.data();
          const item: ClubKeyStatus = {
            keyId: id === 'key2' ? 'key2' : 'key1',
            status: (d.status === 'open' ? 'open' : 'closed') as KeyStatusType,
            updatedAt: d.updatedAt || 0,
            operatorName: d.operatorName || '未記録',
            operatorSection: d.operatorSection || '',
            operatorPart: d.operatorPart || '',
            keyName: d.keyName || '',
          };
          if (id === 'key1') {
            statuses.key1 = item;
          } else if (id === 'key2') {
            statuses.key2 = item;
          } else if (id === 'current' && !statuses.key1) {
            statuses.key1 = { ...item, keyId: 'key1' };
          }
        });
        setKeyStatuses(statuses);
      },
      (err) => {
        console.error('Key status snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // 6. Listen to Club Key Logs (履歴ログ直近15件)
  useEffect(() => {
    const logsQuery = query(
      collection(db, 'key_logs'),
      orderBy('updatedAt', 'desc'),
      limit(15)
    );
    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const logs: ClubKeyLog[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            keyId: (d.keyId === 'key2' ? 'key2' : 'key1') as KeyId,
            status: 'closed',
            updatedAt: d.updatedAt || 0,
            operatorName: d.operatorName || '',
            operatorSection: d.operatorSection || '',
            operatorPart: d.operatorPart || '',
            keyName: d.keyName || '',
          };
        });
        setKeyLogs(logs);
      },
      (err) => {
        console.error('Key logs snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // 6.5 Listen to Emergency Stamp Cards (負のスタンプカード)
  useEffect(() => {
    const stampsCollRef = collection(db, 'emergency_stamps');
    const unsubscribe = onSnapshot(
      stampsCollRef,
      (snapshot) => {
        const cards: EmergencyStampCard[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            memberName: d.memberName || '',
            section: d.section || '',
            part: d.part || '',
            totalCount: Number(d.totalCount) || 0,
            monthlyCounts: d.monthlyCounts || {},
            penaltyGame: d.penaltyGame || '',
            milestonesNotified: Array.isArray(d.milestonesNotified) ? d.milestonesNotified : [],
            updatedAt: Number(d.updatedAt) || 0,
          };
        });
        cards.sort((a, b) => b.totalCount - a.totalCount || a.memberName.localeCompare(b.memberName, 'ja'));
        setStampCards(cards);
      },
      (err) => {
        console.error('Emergency stamps snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // 6.6 Listen to Events
  useEffect(() => {
    const eventsCollRef = collection(db, 'events');
    const unsubscribe = onSnapshot(
      eventsCollRef,
      (snapshot) => {
        const list: ClubEvent[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ...d,
            createdAt: d.createdAt || 0,
            updatedAt: d.updatedAt || 0,
          } as ClubEvent;
        });
        // Sort by start date (ascending)
        list.sort((a, b) => a.startDate.localeCompare(b.startDate));
        setEvents(list);
      },
      (err) => {
        console.error('Events snapshot error:', err);
        setEvents([]);
      }
    );

    return () => unsubscribe();
  }, []);

  // 7. Daily Summary Notification Check
  // 1日1回のみ・深夜抑制・アプリ起動時/データ再読込時には発火させない安全設計
  const isSummaryTriggeringRef = useRef<boolean>(false);
  const settingsRef = useRef(settings);
  const notificationsRef = useRef(notifications);
  const eventsRef = useRef(events);
  const attendancesRef = useRef(attendances);
  const membersRef = useRef(members);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    attendancesRef.current = attendances;
  }, [attendances]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    // 【要件1】「アプリを開いたとき」「データを更新したとき」には、絶対に通知を生成しない
    // 起動直後の安全待機タイマー（15秒間は通知生成を行わない）
    const appMountTimestamp = Date.now();

    const checkSummaryTime = async () => {
      // 起動直後（15秒以内）の実行を完全ガード
      if (Date.now() - appMountTimestamp < 15000) {
        return;
      }

      if (isSummaryTriggeringRef.current) {
        return;
      }

      const currentSettings = settingsRef.current;
      const today = getTodayString();
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      // --- Event Reminders (Check once per day per event) ---
      try {
        const eventsList = eventsRef.current || [];
        for (const event of eventsList) {
          if (event.reminderEnabled === false) continue;
          const daysToRemind = event.reminderDays || [3, 1, 0];

          for (const daysBefore of daysToRemind) {
            const reminderDate = new Date();
            reminderDate.setDate(reminderDate.getDate() + daysBefore);
            const reminderDateStr = reminderDate.toISOString().split('T')[0];

            if (event.startDate === reminderDateStr) {
              const lockId = `event_rem_${daysBefore}days_${event.id}`;
              const lockDocRef = doc(db, 'summary_logs', lockId);
              const lockSnap = await getDoc(lockDocRef);
              if (!lockSnap.exists()) {
                await setDoc(lockDocRef, { fired: true, at: Date.now() });

                const prefix = daysBefore === 0 ? '【本日】' : daysBefore === 1 ? '【明日】' : `【あと${daysBefore}日】`;
                const message = daysBefore === 0 
                  ? `本日は${event.name}です。忘れ物はありませんか？` 
                  : daysBefore === 1 
                  ? `明日は${event.name}です。持ち物リストを最終チェックしましょう！`
                  : `${daysBefore}日後は${event.name}です。準備は進んでいますか？`;

                const notifData = {
                  title: `${prefix}${event.name}`,
                  message,
                  body: daysBefore === 0 ? `集合: ${event.gatheringTime || '指定なし'}\n場所: ${event.location || '指定なし'}` : undefined,
                  type: 'reminder' as const,
                  createdAt: Date.now(),
                };

                // App Internal Notification
                await addDoc(collection(db, 'notifications'), notifData).catch(err => console.error('Failed to add event notification:', err));
                showNativeNotification(notifData.title, notifData.message);

                // LINE WORKS (Non-blocking)
                let lwConfig = currentSettings.lineWorksEvents?.enabled ? currentSettings.lineWorksEvents : null;
                if (!lwConfig && currentSettings.lineWorks?.enabled && currentSettings.lineWorks?.sendEventReminder !== false) {
                  lwConfig = currentSettings.lineWorks;
                }

                if (lwConfig) {
                  const lwText = formatEventReminderMessage(currentSettings.clubName, event, daysBefore);
                  sendLineWorksNotification(lwConfig, lwText).then(async (res) => {
                    // Update last transmission status
                    const settingsDocRef = doc(db, 'config', 'app_settings');
                    await updateDoc(settingsDocRef, {
                      lastLwEvStatus: {
                        success: res.success,
                        error: res.error || null,
                        statusCode: res.status || null,
                        timestamp: Date.now(),
                      },
                      updatedAt: Date.now(),
                    }).catch(console.error);

                    if (!res.success) {
                      console.warn('Event reminder LW error:', res.error);
                    }
                  }).catch(err => console.error('Event reminder LW error:', err));
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Event reminder logic error:', err);
      }

      // 【要件3】設定時刻の読み込みを確実にする
      // 曜日別設定やカレンダー個別設定を考慮して、今日の通知時刻を解決する
      const resolvedSchedule = resolveScheduleForDate(today, currentSettings);
      const configuredTime = (resolvedSchedule.time || '').trim();
      const isEnabledToday = resolvedSchedule.enabled;

      // 【要件5】デバッグ用のログ: 条件判定状況を出力
      const isMasterEnabled = Boolean(currentSettings.notificationsEnabled);

      // 判定に影響する基本条件をチェック
      if (!isMasterEnabled) {
        return; // 全体OFFなら何もしない
      }

      if (!isEnabledToday || !configuredTime) {
        // 今日が通知OFF設定、または時刻未設定の場合はスキップ
        return;
      }

      // 【要件4】深夜・早朝抑制（6:00〜22:00の範囲内のみ許可）
      const hourNum = now.getHours();
      if (hourNum < 6 || hourNum >= 22) {
        return;
      }

      // 【要件1】通知を送る条件を厳密にする
      // 解決された「本日の通知時刻」と現在時刻を比較し、一致した場合のみ送信する
      const isTimeMatch = (currentTimeStr === configuredTime);

      // 設定時刻と一致したとき、または毎時0分/30分などの節目にログを出力（デバッグ用）
      if (isTimeMatch || now.getMinutes() % 30 === 0) {
        console.log('[SummaryCheck] 時刻チェック判定', {
          currentTime: currentTimeStr,
          targetTime: configuredTime,
          isTimeMatch,
          isEnabledToday,
          isOverride: resolvedSchedule.isOverride,
          label: resolvedSchedule.label || '(なし)',
          today
        });
      }

      if (!isTimeMatch) {
        // 現在時刻が設定時刻と一致しない場合は何もしない
        return;
      }

      // 【要件2】1日1回だけ送る
      // 一度その日のまとめ通知を生成したら、その日は二度と生成しない
      // 日付ごとに「送信済みフラグ」をFirestoreに記録し、重複を防ぐ
      // アプリを再起動しても、送信済みフラグが維持されるようにする
      // ※ドメインを跨いでも重複しないよう localStorage ではなく Firestore を基準にする

      // ① settings.lastSummaryDateチェック
      if (currentSettings.lastSummaryDate === today) {
        console.log('[SummaryCheck] 本日は既に送信済みです（lastSummaryDate検出）', { today });
        return;
      }

      // ② notificationsコレクション内チェック (Refを使用して最新状態を確認)
      const hasTodaySummary = (notificationsRef.current || []).some(
        (n) => n.type === 'summary' && n.relatedDate === today
      );
      if (hasTodaySummary) {
        console.log('[SummaryCheck] 本日のまとめ通知は既に生成済みです（notificationsコレクション検出）', { today });
        return;
      }

      // ③ Firestore summary_logs/{today} チェック（アプリ再起動・複数ドメイン間での重複完全防止）
      isSummaryTriggeringRef.current = true;
      try {
        const summaryDocRef = doc(db, 'summary_logs', today);
        const lockSnap = await getDoc(summaryDocRef);
        if (lockSnap.exists() && lockSnap.data()?.sent === true) {
          console.log('[SummaryCheck] 本日は既に送信済みです（Firestore送信済みフラグ検出）', { today });
          return;
        }

        console.log('[SummaryCheck] 🔔 全条件一致！まとめ通知を生成・送信します', {
          today,
          configuredTime,
          currentTimeStr,
        });

        // 送信済みフラグをFirestoreに先行記録（アプリ再起動・別ドメインでも維持される）
        await setDoc(summaryDocRef, {
          targetDate: today,
          sent: true,
          firedAt: Date.now(),
          sentTime: currentTimeStr,
          configuredTime,
          isForceManual: false,
        }, { merge: true });

        // まとめ通知の生成・配信
        await triggerManualSummary(today, false);

        console.log('[SummaryCheck] ✅ 本日の出欠まとめ通知の配信が完了しました', {
          today,
          sentTime: currentTimeStr,
        });
      } catch (err) {
        console.error('[SummaryCheck] 自動まとめ通知の送信処理エラー:', err);
      } finally {
        isSummaryTriggeringRef.current = false;
      }
    };

    // 30秒間隔のインターバルタイマーで監視（1分間の設定時刻一致枠を確実に捕捉）
    const interval = setInterval(checkSummaryTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // 8. Key Closing Reminder Automated Check (鍵の催促通知の定期監視)
  // 設定時刻を過ぎても施錠報告がない場合に自動で催促通知を送信（間隔・最大回数・深夜早朝0-6時抑制・重複防止）
  const isReminderTriggeringRef = useRef<boolean>(false);
  const keyStatusesRef = useRef(keyStatuses);

  useEffect(() => {
    keyStatusesRef.current = keyStatuses;
  }, [keyStatuses]);

  useEffect(() => {
    const checkKeyReminders = async () => {
      if (isReminderTriggeringRef.current) return;

      const currentSettings = settingsRef.current;
      const config = currentSettings.keyReminders;
      if (!config || !config.enabled) return;

      const { hours: currentHours, minutes: currentMinutes, timeStr: currentTimeStr } = getCurrentTimeJST();
      const today = getTodayString(); // JST YYYY-MM-DD

      // 【要件2】深夜・早朝抑制（0:00〜06:00 JST）
      if (currentHours >= 0 && currentHours < 6) {
        if (currentMinutes % 60 === 0) {
          console.log('[KeyReminder] JST深夜・早朝(00-06時)のため催促をスキップしています');
        }
        return;
      }

      const nowTotalMinutes = currentHours * 60 + currentMinutes;

      // アプリ内通知・LINE WORKS通知の両方がオフなら何もしない
      const isAppEnabled = config.appNotificationEnabled !== false; // デフォルトtrue
      const isLwEnabled = config.lineWorksNotificationEnabled === true; // デフォルトfalse
      if (!isAppEnabled && !isLwEnabled) return;

      // 催促開始時刻の決定
      let startTime = config.startTime || '18:00';
      
      const resolvedSchedule = resolveScheduleForDate(today, currentSettings);
      if (config.onlyOnActiveDays && !resolvedSchedule.enabled) {
        if (currentMinutes % 60 === 0) {
          console.log('[KeyReminder] 本日は出欠確認OFFのため、催促をスキップします');
        }
        return;
      }
      
      if (config.useSummaryTime && resolvedSchedule.enabled && resolvedSchedule.time) {
        startTime = resolvedSchedule.time;
      }

      const [startH, startM] = startTime.split(':').map(Number);
      if (isNaN(startH) || isNaN(startM)) {
        return;
      }
      const startTotalMinutes = startH * 60 + startM;
      
      if (nowTotalMinutes < startTotalMinutes) {
        return;
      }

      // 【要件3】最新の施錠状況を直接Firestoreから取得して判定（キャッシュ遅延・誤判定防止）
      const fetchLatestKeyReported = async (keyId: KeyId): Promise<boolean> => {
        try {
          const sDoc = await getDoc(doc(db, 'key_status', keyId));
          if (sDoc.exists()) {
            const d = sDoc.data();
            if (d.status === 'closed' && d.updatedAt) {
              // Convert updatedAt (timestamp) to JST date string
              const statusDate = new Date(d.updatedAt);
              const jstDateStr = new Intl.DateTimeFormat('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }).format(statusDate).replace(/\//g, '-');
              
              return jstDateStr === today;
            }
          }
        } catch (err) {
          console.warn(`[KeyReminder] ${keyId} の状態取得に失敗:`, err);
        }
        return false;
      };

      const key1Reported = await fetchLatestKeyReported('key1');
      const key2Reported = await fetchLatestKeyReported('key2');

      if (key1Reported && key2Reported) {
        return;
      }

      isReminderTriggeringRef.current = true;
      try {
        const reminderDocRef = doc(db, 'key_reminders', `${today}_unified`);
        const reminderSnap = await getDoc(reminderDocRef);
        let currentCount = 0;
        let lastSentAt = 0;

        if (reminderSnap.exists()) {
          const data = reminderSnap.data();
          currentCount = Number(data.count) || 0;
          lastSentAt = Number(data.lastSentAt) || 0;
        }

        const maxCount = config.maxCount || 3;
        if (currentCount >= maxCount) {
          isReminderTriggeringRef.current = false;
          return;
        }

        const intervalMinutes = config.intervalMinutes || 15;
        const intervalMs = intervalMinutes * 60 * 1000;
        const timeSinceLastSent = Date.now() - lastSentAt;
        
        if (currentCount > 0 && timeSinceLastSent < intervalMs - 5000) {
          isReminderTriggeringRef.current = false;
          return;
        }

        const nextCount = currentCount + 1;

        // 【要件1】二重送信の防止（Firestoreでの原子的なロック）
        const lockId = `${today}_keyrem_${nextCount}`;
        const lockDocRef = doc(db, 'notification_logs', lockId);
        
        const lockSuccess = await runTransaction(db, async (transaction) => {
          const lockSnap = await transaction.get(lockDocRef);
          if (lockSnap.exists()) {
            return false;
          }
          transaction.set(lockDocRef, {
            type: 'key_reminder',
            date: today,
            count: nextCount,
            status: 'sending',
            startTime: Date.now(),
          });
          return true;
        }).catch(() => false);

        if (!lockSuccess) {
          isReminderTriggeringRef.current = false;
          return;
        }

        // 送信直前に再度報告状況をチェック（要件3）
        const k1 = await fetchLatestKeyReported('key1');
        const k2 = await fetchLatestKeyReported('key2');
        if (k1 && k2) {
          await updateDoc(lockDocRef, { status: 'cancelled_already_reported' });
          isReminderTriggeringRef.current = false;
          return;
        }

        const key1Name = currentSettings.keyNames?.key1 || '鍵①';
        const key2Name = currentSettings.keyNames?.key2 || '鍵②';
        
        let targets = '';
        if (!k1 && !k2) {
          targets = `${key1Name}と${key2Name}の両方`;
        } else if (!k1) {
          targets = `${key1Name}`;
        } else {
          targets = `${key2Name}`;
        }

        const notifTitle = `鍵の催促`;
        const notifMessage = `【鍵の催促】${targets}がまだ閉められていません。${!k1 && !k2 ? '' : '閉めたら'}報告してください。（${nextCount}回目）`;

        console.log('[KeyReminder] 🔔 送信開始:', { count: nextCount, time: currentTimeStr });

        await setDoc(reminderDocRef, {
          date: today,
          count: nextCount,
          lastSentAt: Date.now(),
          updatedAt: Date.now(),
        }, { merge: true });

        if (isAppEnabled) {
          // 【要件1】同じ内容の通知が既に存在するか二重チェック
          const existingNotifs = notificationsRef.current || [];
          const isDuplicate = existingNotifs.some(n => 
            n.type === 'reminder' && 
            n.relatedDate === today && 
            n.reminderCount === nextCount
          );

          if (!isDuplicate) {
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
        }

        if (isLwEnabled && currentSettings.lineWorksKeyReminder?.enabled) {
          const lwConfig = currentSettings.lineWorksKeyReminder;
          if (lwConfig.clientId && lwConfig.privateKey && lwConfig.botId && lwConfig.channelId) {
            sendLineWorksNotification(lwConfig, notifMessage).then(async (res) => {
              let errorMsg = res.error;
              if (res.status === 404) {
                errorMsg = 'Channel IDまたはBotの招待を確認してください (HTTP 404: NOT_FOUND)';
              }
              const settingsDocRef = doc(db, 'config', 'app_settings');
              await updateDoc(settingsDocRef, {
                lastLwKRStatus: {
                  success: res.success,
                  error: res.success ? undefined : errorMsg,
                  statusCode: res.status || null,
                  timestamp: Date.now(),
                },
                updatedAt: Date.now(),
              }).catch(console.error);
            }).catch(() => {});
          }
        }

        await updateDoc(lockDocRef, { status: 'sent', endTime: Date.now() });
      } catch (err: any) {
        console.error('[KeyReminder] Error:', err);
      } finally {
        isReminderTriggeringRef.current = false;
      }
    };

    // 1分間隔でチェック（設定時刻 22:10 などを確実に拾うため）
    const interval = setInterval(checkKeyReminders, 60000);
    
    // アプリが前面に来たとき、またはフォーカスされたときに即時チェック
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[KeyReminder] アプリ復帰を検知。催促を即時チェックします');
        checkKeyReminders();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    // 初回実行
    checkKeyReminders();

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // 9. Midnight Key Reset check (深夜0時の施錠状態自動リセット)
  useEffect(() => {
    const checkMidnightReset = async () => {
      if (!settingsRef.current.autoResetKeysAtMidnight) return;

      const now = new Date();
      // 00:00〜00:01の間のみ実行
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        const today = getTodayString();
        const localResetKey = `key_midnight_reset_done_${today}`;
        
        // すでに実行済みならスキップ
        if (typeof window !== 'undefined' && localStorage.getItem(localResetKey) === 'true') {
          return;
        }

        try {
          console.log('Starting midnight key status auto-reset...');
          const batch = writeBatch(db);
          
          // 鍵①と鍵②の状態を'open'に更新（履歴は保持するため、updatedAt等はあえて触らない）
          batch.update(doc(db, 'key_status', 'key1'), { status: 'open' });
          batch.update(doc(db, 'key_status', 'key2'), { status: 'open' });
          
          await batch.commit();
          
          if (typeof window !== 'undefined') {
            localStorage.setItem(localResetKey, 'true');
          }
          console.log('Midnight key status auto-reset completed');
        } catch (err) {
          console.error('Midnight reset error:', err);
        }
      }
    };

    const interval = setInterval(checkMidnightReset, 60000); // 1分ごとにチェック
    return () => clearInterval(interval);
  }, []);

  // 10. Auto Attendance Check (出席の自動送信)
  useEffect(() => {
    const checkAutoAttendance = async () => {
      const currentSettings = settingsRef.current;
      const config = currentSettings.autoAttendance;
      
      // 設定が無効、または未読込の場合は何もしない
      if (!config || !config.enabled || !isSettingsLoaded) return;

      const today = getTodayString();
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      // --- Mode: on_app_open (アプリを開いたときに自分の出席を記録) ---
      if (config.mode === 'on_app_open' && myMemberName) {
        // すでに今日の連絡（欠席・遅刻・早退・緊急遽刻・既に出席）がある場合はスキップ
        const hasReported = (attendances || []).some(a => a.date === today && a.memberName === myMemberName);
        if (!hasReported) {
          try {
            // Firestoreによる多重実行防止（ロック）
            const lockDocRef = doc(db, 'summary_logs', `auto_att_open_${myMemberName}_${today}`);
            const lockSnap = await getDoc(lockDocRef);
            if (lockSnap.exists()) return;

            console.log(`[AutoAttendance] アプリ起動を検知。${myMemberName}さんの出席を自動記録します。`);
            
            // 先にFirestoreにロックをかける
            await setDoc(lockDocRef, { fired: true, at: Date.now(), memberName: myMemberName });

            await saveAttendance({
              date: today,
              memberName: myMemberName,
              type: '出席',
              reason: '自動出席記録（起動時）',
            });
          } catch (err) {
            console.error('[AutoAttendance] 自動出席の記録に失敗しました:', err);
          }
        }
      }

      // --- Mode: at_specific_time (設定時刻に未連絡者全員を「出席」にする) ---
      if (config.mode === 'at_specific_time' && config.time) {
        if (currentTimeStr === config.time) {
          try {
            // Firestoreによる多重実行防止（ロック）
            const lockDocRef = doc(db, 'summary_logs', `auto_att_${today}`);
            const lockSnap = await getDoc(lockDocRef);
            if (lockSnap.exists()) return;

            console.log(`[AutoAttendance] 設定時刻(${config.time})に達しました。未連絡者の出席を一括記録します。`);
            
            // 先にロックをかける
            await setDoc(lockDocRef, { fired: true, at: Date.now(), executedBy: myMemberName || deviceToken });

            // 未連絡者を抽出
            const reportedNames = new Set((attendances || []).filter(r => r.date === today).map(r => r.memberName));
            const unrecordedMembers = (members || []).filter(m => !reportedNames.has(m.name));

            if (unrecordedMembers.length > 0) {
              const batch = writeBatch(db);
              unrecordedMembers.forEach(m => {
                const newRef = doc(collection(db, 'attendances'));
                batch.set(newRef, {
                  date: today,
                  memberName: m.name,
                  section: m.section || '',
                  part: m.part || '',
                  type: '出席',
                  reason: '自動出席記録（一括）',
                  authorDeviceToken: 'system_auto',
                  createdAt: Date.now(),
                });
              });
              await batch.commit();
              console.log(`[AutoAttendance] 一括記録完了: ${unrecordedMembers.length}名の出席を記録しました。`);
            } else {
              console.log('[AutoAttendance] 全員連絡済み、または部員が登録されていません。');
            }
          } catch (err) {
            console.error('[AutoAttendance] 一括自動出席の処理中にエラーが発生しました:', err);
          }
        }
      }
    };

    // 1分ごとに定期チェック
    const interval = setInterval(checkAutoAttendance, 60000);
    // 初回実行
    checkAutoAttendance();
    
    return () => clearInterval(interval);
  }, [isSettingsLoaded, isAttendancesLoaded, myMemberName, members, attendances, deviceToken]);

  // Action: Save attendance (create or edit)
  const getStampDocId = (name: string): string => {
    return encodeURIComponent(name.trim()).replace(/\./g, '%2E');
  };

  const incrementEmergencyStamp = async (
    memberName: string,
    section?: string,
    part?: string,
    dateStr?: string
  ) => {
    try {
      const now = Date.now();
      const currentMonth = (dateStr || getTodayString()).slice(0, 7); // "YYYY-MM"
      const stampDocId = getStampDocId(memberName);
      const stampDocRef = doc(db, 'emergency_stamps', stampDocId);
      const stampSnap = await getDoc(stampDocRef);

      let prevTotal = 0;
      let prevMonthly: Record<string, number> = {};
      let penaltyGame = '';
      let milestonesNotified: number[] = [];

      if (stampSnap.exists()) {
        const d = stampSnap.data();
        prevTotal = Number(d.totalCount) || 0;
        prevMonthly = d.monthlyCounts || {};
        penaltyGame = d.penaltyGame || '';
        milestonesNotified = Array.isArray(d.milestonesNotified) ? [...d.milestonesNotified] : [];
      }

      const newTotal = prevTotal + 1;
      const newMonthCount = (Number(prevMonthly[currentMonth]) || 0) + 1;
      const updatedMonthly = {
        ...prevMonthly,
        [currentMonth]: newMonthCount,
      };

      const matchedMember = members.find((m) => m.name === memberName);
      const resolvedSection = section || matchedMember?.section || '';
      const resolvedPart = part || matchedMember?.part || '';

      const newlyReachedMilestones: number[] = [];
      const milestoneAlerts: { milestone: number; title: string; message: string }[] = [];

      const displayPart = resolvedPart || resolvedSection;
      const memberLabel = displayPart ? `${memberName}さん（${displayPart}）` : `${memberName}さん`;

      // 4. マイルストーン通知: 管理者設定の penaltyStages に基づいて判定
      const stages = settings.penaltyStages || [];
      for (const stage of stages) {
        if (newTotal >= stage.threshold && !milestonesNotified.includes(stage.threshold)) {
          newlyReachedMilestones.push(stage.threshold);
          milestoneAlerts.push({
            milestone: stage.threshold,
            title: `【緊急遽刻】${stage.label || '罰ゲーム'}到達！`,
            message: `【緊急遽刻】${memberLabel}のスタンプが${stage.threshold}個になりました。${stage.label || '罰ゲーム'}の内容を確認してください！`,
          });

          // もし自分自身のスタンプが段階に達した場合、演出フラグを立てる
          if (memberName === myMemberName) {
            setJustReachedPenaltyStage(stage);
          }
        }
      }

      const updatedMilestones = [...milestonesNotified, ...newlyReachedMilestones];

      await setDoc(
        stampDocRef,
        {
          memberName,
          section: resolvedSection,
          part: resolvedPart,
          totalCount: newTotal,
          monthlyCounts: updatedMonthly,
          penaltyGame,
          milestonesNotified: updatedMilestones,
          updatedAt: now,
        },
        { merge: true }
      );

      // マイルストーン通知の送信（そのマイルストーンに初めて到達したときだけ送信）
      for (const alert of milestoneAlerts) {
        await addDoc(collection(db, 'notifications'), {
          title: alert.title,
          message: alert.message,
          body: alert.message,
          type: 'urgent',
          relatedDate: dateStr || getTodayString(),
          createdAt: Date.now(),
        });
        showNativeNotification(alert.title, alert.message);
      }
    } catch (err) {
      console.error('Failed to increment emergency stamp:', err);
    }
  };

  const resetMemberStamps = async (
    memberName: string,
    resetType: 'total' | 'month',
    monthKey?: string
  ) => {
    const stampDocId = getStampDocId(memberName);
    const stampDocRef = doc(db, 'emergency_stamps', stampDocId);
    const stampSnap = await getDoc(stampDocRef);
    if (!stampSnap.exists()) return;

    const data = stampSnap.data();
    if (resetType === 'total') {
      await updateDoc(stampDocRef, {
        totalCount: 0,
        monthlyCounts: {},
        milestonesNotified: [],
        updatedAt: Date.now(),
      });
    } else if (resetType === 'month') {
      const targetMonth = monthKey || getTodayString().slice(0, 7);
      const monthlyCounts = { ...(data.monthlyCounts || {}) };
      monthlyCounts[targetMonth] = 0;
      await updateDoc(stampDocRef, {
        monthlyCounts,
        updatedAt: Date.now(),
      });
    }
  };

  const resetAllMonthlyStamps = async (monthKey: string) => {
    const targetMonth = monthKey || getTodayString().slice(0, 7);
    const stampsCollRef = collection(db, 'emergency_stamps');
    const snapshot = await getDocs(stampsCollRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      const data = d.data();
      const monthlyCounts = { ...(data.monthlyCounts || {}) };
      monthlyCounts[targetMonth] = 0;
      batch.update(d.ref, {
        monthlyCounts,
        updatedAt: Date.now(),
      });
    });
    await batch.commit();
  };

  const syncStampsFromAttendances = async (): Promise<{ updatedCount: number }> => {
    const emergencyRecords = attendances.filter((a) => a.type === '緊急遽刻');
    const tally: Record<string, { total: number; monthly: Record<string, number>; section?: string; part?: string }> = {};

    emergencyRecords.forEach((rec) => {
      const name = rec.memberName.trim();
      if (!name) return;
      const month = (rec.date || '').slice(0, 7) || getTodayString().slice(0, 7);
      if (!tally[name]) {
        tally[name] = { total: 0, monthly: {}, section: rec.section, part: rec.part };
      }
      tally[name].total += 1;
      tally[name].monthly[month] = (tally[name].monthly[month] || 0) + 1;
      if (!tally[name].section && rec.section) tally[name].section = rec.section;
      if (!tally[name].part && rec.part) tally[name].part = rec.part;
    });

    const batch = writeBatch(db);
    let count = 0;
    for (const [name, info] of Object.entries(tally)) {
      const stampDocId = getStampDocId(name);
      const stampDocRef = doc(db, 'emergency_stamps', stampDocId);
      const matched = members.find((m) => m.name === name);
      batch.set(
        stampDocRef,
        {
          memberName: name,
          section: info.section || matched?.section || '',
          part: info.part || matched?.part || '',
          totalCount: info.total,
          monthlyCounts: info.monthly,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      count++;
    }
    if (count > 0) {
      await batch.commit();
    }
    return { updatedCount: count };
  };

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
    const now = Date.now();
    const isEditing = Boolean(editingId);

    // If section or part is not explicitly passed, try to look it up from registered members or user profile
    const matchedMember = members.find((m) => m.name === data.memberName);
    const resolvedSection = data.section || matchedMember?.section || (data.memberName === myMemberName ? myMemberSection : '') || '';
    const resolvedPart = data.part || matchedMember?.part || (data.memberName === myMemberName ? myMemberPart : '') || '';

    if (isEditing && editingId) {
      const prevRecord = attendances.find((a) => a.id === editingId);
      const willBeEmergency = data.type === '緊急遽刻';
      const wasNotEmergency = prevRecord && prevRecord.type !== '緊急遽刻';

      const recordRef = doc(db, 'attendances', editingId);
      await updateDoc(recordRef, {
        date: data.date,
        memberName: data.memberName,
        section: resolvedSection,
        part: resolvedPart,
        type: data.type,
        reason: data.reason || '',
        time: data.time || '',
        updatedAt: now,
      });

      if (willBeEmergency && wasNotEmergency) {
        await incrementEmergencyStamp(data.memberName, resolvedSection, resolvedPart, data.date);
      }
    } else {
      // Check if there is already a record for this member on this date to prevent duplicates
      const existing = attendances.find(
        (a) => a.date === data.date && a.memberName === data.memberName
      );
      if (existing) {
        // Overwrite/update existing record
        const willBeEmergency = data.type === '緊急遽刻';
        const wasNotEmergency = existing.type !== '緊急遽刻';

        const recordRef = doc(db, 'attendances', existing.id);
        await updateDoc(recordRef, {
          section: resolvedSection,
          part: resolvedPart,
          type: data.type,
          reason: data.reason || '',
          time: data.time || '',
          updatedAt: now,
          authorDeviceToken: deviceToken,
        });

        if (willBeEmergency && wasNotEmergency) {
          await incrementEmergencyStamp(data.memberName, resolvedSection, resolvedPart, data.date);
        }
      } else {
        // Insert new record
        const docRef = await addDoc(collection(db, 'attendances'), {
          date: data.date,
          memberName: data.memberName,
          section: resolvedSection,
          part: resolvedPart,
          type: data.type,
          reason: data.reason || '',
          time: data.time || '',
          authorDeviceToken: deviceToken,
          createdAt: now,
        });

        // 「緊急遽刻」が送信されるたびに、そのユーザーのスタンプを1つ増やす
        if (data.type === '緊急遽刻') {
          await incrementEmergencyStamp(data.memberName, resolvedSection, resolvedPart, data.date);
        }

        // 3. 緊急遽刻の即時通知: 当日の連絡が新規送信された瞬間に即時通知（区分・詳細パートを含める）
        // 【要件3】過去の日付の連絡に対しては通知を生成しない（今日のみ）
        // 【要件4】深夜0時〜5時の間は通知を生成しない
        const isNotMidnight = !isMidnightQuietHours();
        const isTodayDate = data.date === getTodayString();
        
        console.log('[AttendanceNotif] 即時通知条件チェック', {
          type: data.type,
          isEmergency: data.type === '緊急遽刻',
          isToday: isTodayDate,
          isNotMidnight,
          date: data.date
        });

        if (
          data.type === '緊急遽刻' &&
          isTodayDate &&
          isNotMidnight
        ) {
          console.log('[AttendanceNotif] 🔔 緊急遽刻を検知。即時通知を生成します');
          const isEmergency = data.type === '緊急遽刻';
          const newRecordItem: AttendanceRecord = {
            id: docRef.id,
            date: data.date,
            memberName: data.memberName,
            section: resolvedSection,
            part: resolvedPart,
            type: data.type,
            reason: data.reason || '',
            time: data.time || '',
            createdAt: now,
          };
          const formattedAlertMessage = formatAttendanceRecordShareText(newRecordItem, members);
          const notifTitle = '🚨 緊急遽刻連絡';

          await addDoc(collection(db, 'notifications'), {
            title: notifTitle,
            message: formattedAlertMessage,
            body: formattedAlertMessage,
            type: 'urgent',
            relatedDate: data.date,
            attendanceId: docRef.id,
            createdAt: now,
          });
          showNativeNotification(notifTitle, formattedAlertMessage);

            // LINE WORKS への即時遅刻・緊急遽刻通知
          if (
            settings.lineWorks?.enabled &&
            settings.lineWorks.sendTardyAlert &&
            (settings.lineWorks.webhookUrl || (settings.lineWorks.clientId && settings.lineWorks.privateKey))
          ) {
            const lwEmergencyText = formatEmergencyTardyAlertMessage(
              settings.clubName || '部活動',
              data.memberName,
              data.time,
              data.reason,
              resolvedSection,
              resolvedPart,
              true // isEmergency is always true here
            );
            sendLineWorksNotification(settings.lineWorks, lwEmergencyText).then(async (res) => {
              // Update last transmission status
              const settingsDocRef = doc(db, 'config', 'app_settings');
              await updateDoc(settingsDocRef, {
                lastLwStatus: {
                  success: res.success,
                  error: res.error || null,
                  statusCode: res.status || null,
                  timestamp: Date.now(),
                },
                updatedAt: Date.now(),
              }).catch(console.error);

              if (!res.success) {
                console.warn('LINE WORKS emergency alert dispatch warning:', res.error);
              }
            }).catch(console.error);
          }
        }
      }
    }

    // Also remember member profile locally
    if (data.memberName) {
      setMyMemberName(data.memberName);
      if (resolvedSection) setMyMemberSection(resolvedSection);
      if (resolvedPart) setMyMemberPart(resolvedPart);
    }
  };

  // Action: Delete attendance
  const deleteAttendance = async (id: string) => {
    const recordRef = doc(db, 'attendances', id);
    await deleteDoc(recordRef);
  };

  // Action: Login Admin
  const loginAdmin = (passcode: string): boolean => {
    const validPasscode = settings.adminPasscode || 'admin1234';
    if (passcode.trim() === validPasscode.trim()) {
      setIsAdmin(true);
      localStorage.setItem('club_is_admin', 'true');
      return true;
    }
    return false;
  };

  // Action: Logout Admin
  const logoutAdmin = () => {
    setIsAdmin(false);
    localStorage.removeItem('club_is_admin');
  };

  // Action: Update Settings
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const settingsDocRef = doc(db, 'config', 'app_settings');
      const updated = {
        ...settings,
        ...newSettings,
        updatedAt: Date.now(),
      };
      
      // Update ref immediately so subsequent async calls in the same event loop can use the new value
      settingsRef.current = updated;
      
      await setDoc(settingsDocRef, updated, { merge: true });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  };

  // Action: Add Member
  const addMember = async (name: string, grade = '', role = '部員', section = '', part = '') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const maxOrder = members.reduce((max, m) => Math.max(max, m.order ?? 0), 0);
    await addDoc(collection(db, 'members'), {
      name: trimmed,
      grade: grade.trim(),
      role: role.trim(),
      section: section.trim(),
      part: part.trim(),
      order: maxOrder + 1,
    });
  };

  // Action: Delete Member
  const deleteMember = async (id: string) => {
    await deleteDoc(doc(db, 'members', id));
  };

  // Action: Clear all members (removes dummy/registered members)
  const clearAllMembers = async () => {
    const snap = await getDocs(collection(db, 'members'));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  };

  // Action: Mark single notification as read (User-specific)
  const markAsRead = async (id: string) => {
    try {
      const userId = myMemberName || deviceToken;
      if (!userId) return;

      const docId = `${userId}_${id}`.replace(/[\/\s]/g, '_');
      await setDoc(doc(db, 'notification_reads', docId), {
        userId,
        notificationId: id,
        readAt: Date.now()
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Action: Mark ALL notifications as read (User-specific)
  const markAllAsRead = async () => {
    try {
      const userId = myMemberName || deviceToken;
      if (!userId) return;

      const unread = mergedNotifications.filter((n) => !n.isRead);
      if (unread.length === 0) return;

      // Firestore batches have a limit of 500 operations
      for (let i = 0; i < unread.length; i += 450) {
        const chunk = unread.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((n) => {
          const docId = `${userId}_${n.id}`.replace(/[\/\s]/g, '_');
          batch.set(doc(db, 'notification_reads', docId), {
            userId,
            notificationId: n.id,
            readAt: Date.now()
          });
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Action: Dismiss single notification
  const dismissNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  // Action: Clear ALL notifications from Firestore
  const clearAllNotifications = async () => {
    try {
      const collRef = collection(db, 'notifications');
      const snap = await getDocs(collRef);
      if (snap.empty) {
        setNotifications([]);
        return;
      }
      for (let i = 0; i < snap.docs.length; i += 400) {
        const chunk = snap.docs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
      throw err;
    }
  };

  // Action: Clean up duplicate notifications in Firestore (keep latest 1 item per date & content, delete duplicates)
  const cleanupDuplicateNotifications = async (): Promise<{ removedCount: number }> => {
    try {
      const collRef = collection(db, 'notifications');
      const snap = await getDocs(collRef);
      if (snap.empty) return { removedCount: 0 };

      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ref: d.ref,
          title: (data.title || '').trim(),
          message: (data.message || data.body || '').trim(),
          type: data.type || 'info',
          relatedDate: data.relatedDate || '',
          createdAt: Number(data.createdAt) || 0,
        };
      });

      // Group duplicates:
      // - For summary notifications: group by relatedDate (or date from createdAt)
      // - For other notifications: group by date + type + title + message + reminderCount
      const groups = new Map<string, typeof items>();
      items.forEach((item) => {
        const dateKey =
          item.relatedDate ||
          (item.createdAt ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo' }).format(new Date(item.createdAt)).replace(/\//g, '-') : '');
        let groupKey = '';
        if (item.type === 'summary') {
          groupKey = `summary_${dateKey}`;
        } else if (item.type === 'reminder' && (item as any).reminderCount !== undefined) {
          groupKey = `reminder_${dateKey}_${(item as any).reminderCount}`;
        } else {
          groupKey = `${item.type}_${dateKey}_${item.title}_${item.message}`;
        }

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(item);
      });

      const docsToDelete: typeof items = [];
      groups.forEach((groupItems) => {
        if (groupItems.length > 1) {
          // Sort descending by createdAt (newest first)
          groupItems.sort((a, b) => b.createdAt - a.createdAt);
          // Keep index 0, delete all subsequent duplicate documents
          for (let i = 1; i < groupItems.length; i++) {
            docsToDelete.push(groupItems[i]);
          }
        }
      });

      if (docsToDelete.length === 0) {
        return { removedCount: 0 };
      }

      for (let i = 0; i < docsToDelete.length; i += 400) {
        const chunk = docsToDelete.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((docItem) => {
          batch.delete(docItem.ref);
        });
        await batch.commit();
      }

      return { removedCount: docsToDelete.length };
    } catch (err) {
      console.error('Failed to cleanup duplicate notifications:', err);
      throw err;
    }
  };

  // Helper: Fetch summary data directly from Firestore to ensure freshness
  const fetchTodaySummaryData = async (date: string) => {
    try {
      const attQuery = query(collection(db, 'attendances'), where('date', '==', date));
      const attSnap = await getDocs(attQuery);
      const summaryAttendances = attSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      
      const memSnap = await getDocs(collection(db, 'members'));
      const summaryMembers = memSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClubMember));
      
      return { summaryAttendances, summaryMembers };
    } catch (err) {
      console.error('[Summary] Firestore data fetch failed:', err);
      throw err;
    }
  };

  // Action: Trigger summary notification (Strict 1-per-day, safe timing, today-only)
  const triggerManualSummary = async (targetDate = getTodayString(), isForceManual = true) => {
    const today = getTodayString();
    
    // 【要件3】データ取得エラー時・バリデーションの安全策
    if (targetDate !== today) {
      console.warn('[Summary] まとめ通知は今日の日付のみ対象です:', targetDate);
      return;
    }

    const nowDate = new Date();
    const currentHour = nowDate.getHours();
    // 【要件4】深夜・早朝（0:00〜5:59、22:00以降）の抑制
    if (!isForceManual && (currentHour < 6 || currentHour >= 22)) {
      console.warn('[Summary] 深夜・早朝時間帯のため通知生成を抑制しました');
      return;
    }

    // 【要件1】まとめ通知は「1日1回だけ」にする
    // 既存の同日のまとめ通知を検索 (Refを使用して最新状態を確認)
    const existingSummary = (notificationsRef.current || []).find(
      (n) => n.type === 'summary' && n.relatedDate === today
    );

    if (!isForceManual && existingSummary) {
      console.log('[Summary] 本日のまとめ通知は既に生成されているためスキップします');
      return;
    }

    // 【要件1】データ取得の待機（Firestoreから直接取得）
    console.log(`[Summary] まとめ通知用データの取得を開始します... (${targetDate})`);
    
    let summaryAttendances: AttendanceRecord[] = [];
    let summaryMembers: ClubMember[] = [];
    
    try {
      // 1. & 2. Firestoreから最新データを直接取得 (await)
      const data = await fetchTodaySummaryData(targetDate);
      summaryAttendances = data.summaryAttendances;
      summaryMembers = data.summaryMembers;

      // 【要件4】デバッグ用ログ（取得件数と集計結果）
      const counts = {
        absent: summaryAttendances.filter(a => a.type === '欠席').length,
        tardy: summaryAttendances.filter(a => a.type === '遅刻').length,
        early: summaryAttendances.filter(a => a.type === '早退').length,
        emergency: summaryAttendances.filter(a => a.type === '緊急遽刻').length,
        present: summaryAttendances.filter(a => a.type === '出席').length,
      };
      
      console.log(`[Summary] Firestoreデータ取得完了: 合計連絡数=${summaryAttendances.length}件`);
      console.log(`[Summary] 集計詳細: 欠席=${counts.absent}, 遅刻=${counts.tardy}, 早退=${counts.early}, 緊急=${counts.emergency}, 出席=${counts.present}`);

      // 【要件3】データが空だった場合の安全策
      if (summaryAttendances.length === 0 && !isForceManual) {
        console.warn('[Summary] 本日の出欠連絡が0件のため、自動通知をスキップします');
        return;
      }
    } catch (err) {
      console.error('[Summary] Firestoreからのデータ取得に失敗しました:', err);
      if (!isForceManual) return;
      throw new Error('データ取得エラーのため通知を送信できませんでした。通信状況を確認してください。');
    }

    const currentSettings = settingsRef.current;
    
    // 【要件2】ロジックの統一（fetchした最新データを使用）
    const summaryText = formatDailySummaryWithSections(
      currentSettings.clubName || '部活動',
      targetDate,
      summaryAttendances,
      summaryMembers,
      { includeHeader: false, includeDetails: true }
    );

    const now = Date.now();

    // 既に今日同内容のまとめ通知が存在する場合は重複を作らず更新
    if (existingSummary) {
      await updateDoc(doc(db, 'notifications', existingSummary.id), {
        title: '📢 本日の出欠まとめ',
        message: summaryText,
        body: summaryText,
        type: 'summary',
        relatedDate: targetDate,
        updatedAt: now,
      });
    } else {
      await addDoc(collection(db, 'notifications'), {
        title: '📢 本日の出欠まとめ',
        message: summaryText,
        body: summaryText,
        type: 'summary',
        relatedDate: targetDate,
        createdAt: now,
      });
    }

    setSettings((prev) => ({ ...prev, lastSummaryDate: targetDate }));

    // Record in summary_logs collection to lock across all devices
    const summaryLogDoc = doc(db, 'summary_logs', targetDate);
    await setDoc(
      summaryLogDoc,
      {
        targetDate,
        sent: true,
        firedAt: now,
        isForceManual,
      },
      { merge: true }
    ).catch(console.error);

    // Update settings lastSummaryDate in Firestore
    const settingsDocRef = doc(db, 'config', 'app_settings');
    await setDoc(
      settingsDocRef,
      {
        lastSummaryDate: targetDate,
        updatedAt: now,
      },
      { merge: true }
    ).catch(console.error);

    showNativeNotification('📢 本日の出欠まとめ', summaryText);

    // LINE WORKS へのまとめ通知自動送信
    if (
      currentSettings.lineWorks?.enabled &&
      currentSettings.lineWorks.sendDailySummary &&
      (currentSettings.lineWorks.webhookUrl || (currentSettings.lineWorks.clientId && currentSettings.lineWorks.privateKey))
    ) {
      const lwSummaryMsg = formatDailySummaryMessage(
        currentSettings.clubName || '部活動',
        targetDate,
        summaryAttendances,
        summaryMembers
      );
      sendLineWorksNotification(currentSettings.lineWorks, lwSummaryMsg).then(async (res) => {
        // Update last transmission status
        const settingsDocRef = doc(db, 'config', 'app_settings');
        await updateDoc(settingsDocRef, {
          lastLwStatus: {
            success: res.success,
            error: res.error || null,
            statusCode: res.status || null,
            timestamp: Date.now(),
          },
          updatedAt: Date.now(),
        }).catch(console.error);

        if (!res.success) {
          console.warn('LINE WORKS summary dispatch warning:', res.error);
        }
      }).catch((err) => {
        console.error('Failed to send LINE WORKS summary:', err);
      });
    }
  };

  // Action: Test summary notification specifically to LINE WORKS
  const sendLineWorksTestSummary = async (
    targetDate = getTodayString()
  ): Promise<{ success: boolean; error?: string }> => {
    const currentSettings = settingsRef.current;
    const isConfigured = Boolean(
      currentSettings.lineWorks?.webhookUrl ||
      (currentSettings.lineWorks?.clientId && currentSettings.lineWorks?.privateKey && currentSettings.lineWorks?.botId)
    );

    if (!isConfigured || !currentSettings.lineWorks) {
      return {
        success: false,
        error: 'LINE WORKSの接続設定（API 2.0 または Webhook URL）が完了していません。設定画面をご確認ください。',
      };
    }

    // 【要件2】ロジックの統一（テスト送信でも最新データをFirestoreから再取得）
    const { summaryAttendances, summaryMembers } = await fetchTodaySummaryData(targetDate);

    const lwSummaryMsg = formatDailySummaryMessage(
      currentSettings.clubName || '部活動',
      targetDate,
      summaryAttendances,
      summaryMembers
    );

    const result = await sendLineWorksNotification(currentSettings.lineWorks, lwSummaryMsg);
    
    // Update last transmission status
    const settingsDocRef = doc(db, 'config', 'app_settings');
    await updateDoc(settingsDocRef, {
      lastLwStatus: {
        success: result.success,
        error: result.error || null,
        statusCode: result.status || null,
        timestamp: Date.now(),
      },
      updatedAt: Date.now(),
    }).catch(console.error);

    return result;
  };

  const sendLineWorksKeyReminderTest = async (): Promise<{ success: boolean; error?: string }> => {
    const text = '【鍵の催促テスト】これは鍵催促用LINE WORKS連携のテスト送信です。正常に届いています。';
    const currentSettings = settingsRef.current;
    if (!currentSettings.lineWorksKeyReminder) {
      return { success: false, error: '設定がありません' };
    }
    const result = await sendLineWorksNotification(currentSettings.lineWorksKeyReminder, text);

    // Update last transmission status
    const settingsDocRef = doc(db, 'config', 'app_settings');
    await updateDoc(settingsDocRef, {
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

  const sendLineWorksEventReminderTest = async (): Promise<{ success: boolean; error?: string }> => {
    const text = '【イベント通知テスト】これはイベントリマインダー用LINE WORKS連携のテスト送信です。正常に届いています。';
    const currentSettings = settingsRef.current;
    
    let result: { success: boolean; error?: string; status?: number };
    
    // currentSettings.lineWorksEvents を優先使用
    if (currentSettings.lineWorksEvents?.enabled) {
      result = await sendLineWorksNotification(currentSettings.lineWorksEvents, text);
    } else if (currentSettings.lineWorks?.enabled && currentSettings.lineWorks.sendEventReminder !== false) {
      // 設定がない場合は通常の lineWorks 連携を使用
      result = await sendLineWorksNotification(currentSettings.lineWorks, text);
    } else {
      return { success: false, error: 'イベント通知用のLINE WORKS連携設定が有効になっていません。' };
    }

    // Update last transmission status
    const settingsDocRef = doc(db, 'config', 'app_settings');
    await updateDoc(settingsDocRef, {
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

  // Action: 鍵の施錠報告（2鍵対応: key1 または key2）
  const reportKeyClosed = async (
    keyId: KeyId,
    customName?: string,
    customSection?: string,
    customPart?: string
  ): Promise<void> => {
    const now = Date.now();
    const operator = (customName || myMemberName || '').trim() || '部員';
    const section = (customSection || myMemberSection || '').trim();
    const part = (customPart || myMemberPart || '').trim();

    // 鍵の表示名（設定値または初期値「鍵①」「鍵②」）
    const defaultKeyName = keyId === 'key1' ? '鍵①' : '鍵②';
    const keyName = settings.keyNames?.[keyId] || defaultKeyName;

    const data: ClubKeyStatus = {
      keyId,
      status: 'closed',
      updatedAt: now,
      operatorName: operator,
      operatorSection: section,
      operatorPart: part,
      keyName,
    };

    // 1. 最新の鍵状態をFirestoreに保存
    const keyDocRef = doc(db, 'key_status', keyId);
    await setDoc(keyDocRef, data);

    // 2. 履歴ログをFirestoreに保存
    const logsCollRef = collection(db, 'key_logs');
    await addDoc(logsCollRef, data);

    // 3. アプリ内通知に登録（通知文に送信者の「区分」を含める）
    // 例：「【木管】今江司さんが鍵①（正面玄関）を閉めました」
    // 例：「【金管】佐藤花子さんが鍵②（楽器庫）を閉めました」
    const sectionPrefix = section ? `【${section}】` : '';
    const notifTitle = `🔒 ${keyName}の施錠報告`;
    const notifMessage = `${sectionPrefix}${operator}さんが${keyName}を閉めました`;

    const notifCollRef = collection(db, 'notifications');
    await addDoc(notifCollRef, {
      title: notifTitle,
      message: notifMessage,
      type: 'info',
      createdAt: now,
    });

    // 4. ブラウザプッシュ通知も送信
    showNativeNotification(notifTitle, notifMessage);
  };

  const reportKeyStatus = async (
    statusOrKeyId: KeyId | KeyStatusType,
    customName?: string,
    customSection?: string,
    customPart?: string
  ): Promise<void> => {
    const keyId: KeyId = statusOrKeyId === 'key2' ? 'key2' : 'key1';
    return reportKeyClosed(keyId, customName, customSection, customPart);
  };

  const resetKeyStatus = async (keyId: KeyId, operatorName: string): Promise<void> => {
    const now = Date.now();
    const keyDocRef = doc(db, 'key_status', keyId);
    
    // 状態を'open'にする（施錠履歴としてのupdatedAtやoperatorNameはUIの前回履歴として残すため更新しない）
    await updateDoc(keyDocRef, {
      status: 'open'
    });

    const defaultKeyName = keyId === 'key1' ? '鍵①' : '鍵②';
    const keyName = settings.keyNames?.[keyId] || defaultKeyName;
    const notifTitle = `🔓 ${keyName}の報告リセット`;
    const notifMessage = `${operatorName}さんが${keyName}の本日の報告をリセットしました（前回の履歴は保持されます）`;

    await addDoc(collection(db, 'notifications'), {
      title: notifTitle,
      message: notifMessage,
      type: 'info',
      createdAt: now,
    });
    
    showNativeNotification(notifTitle, notifMessage);
  };

  const saveEvent = async (eventData: Omit<ClubEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    const now = Date.now();
    if (id) {
      const eventDocRef = doc(db, 'events', id);
      await updateDoc(eventDocRef, {
        ...eventData,
        updatedAt: now,
      });
    } else {
      await addDoc(collection(db, 'events'), {
        ...eventData,
        createdAt: now,
        updatedAt: now,
      });
    }
  };

  const deleteEvent = async (id: string) => {
    await deleteDoc(doc(db, 'events', id));
  };

  const value = useMemo(
    () => ({
      currentTab,
      setCurrentTab,
      attendances,
      members,
      settings,
      notifications: mergedNotifications,
      isAdmin,
      myMemberName,
      deviceToken,
      isLoading,
      activeEditingRecord,
      setActiveEditingRecord,
      saveAttendance,
      deleteAttendance,
      loginAdmin,
      logoutAdmin,
      updateSettings,
      addMember,
      deleteMember,
      clearAllMembers,
      setMyMemberName,
      setMyMemberSection,
      setMyMemberPart,
      setMyMemberProfile,
      myMemberSection,
      myMemberPart,
      markAsRead,
      markAllAsRead,
      sendLineWorksKeyReminderTest,
      sendLineWorksEventReminderTest,
      dismissNotification,
      clearAllNotifications,
      cleanupDuplicateNotifications,
      triggerManualSummary,
      sendLineWorksTestSummary,
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
    }),
    [
      currentTab,
      attendances,
      members,
      settings,
      mergedNotifications,
      isAdmin,
      myMemberName,
      myMemberSection,
      myMemberPart,
      deviceToken,
      isLoading,
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
      saveAttendance,
      deleteAttendance,
      loginAdmin,
      logoutAdmin,
      updateSettings,
      addMember,
      deleteMember,
      clearAllMembers,
      setMyMemberName,
      setMyMemberSection,
      setMyMemberPart,
      setMyMemberProfile,
      markAsRead,
      markAllAsRead,
      sendLineWorksKeyReminderTest,
      sendLineWorksEventReminderTest,
      dismissNotification,
      clearAllNotifications,
      cleanupDuplicateNotifications,
      triggerManualSummary,
      sendLineWorksTestSummary,
      requestNotificationPermission,
      sendTestNotification,
      reportKeyClosed,
      reportKeyStatus,
      resetKeyStatus,
      resetMemberStamps,
      resetAllMonthlyStamps,
      syncStampsFromAttendances,
      saveEvent,
      deleteEvent,
    ]
  );

  // 10. Auto-cleanup duplicates on load and periodically
  useEffect(() => {
    if (!isLoading) {
      // 起動時と定期的に通知を整理する
      cleanupDuplicateNotifications().catch(console.error);
      const interval = setInterval(() => {
        cleanupDuplicateNotifications().catch(console.error);
      }, 1000 * 60 * 30); // 30分おき
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const useAppContext = useApp;
