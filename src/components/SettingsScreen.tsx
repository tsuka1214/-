import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  User,
  Shield,
  Clock,
  Bell,
  Key,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Lock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  X,
  MessageSquare,
  Bot,
  Send,
  HelpCircle,
  Check,
  KeyRound,
  Share2,
  Copy,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  Download,
  CheckCircle,
  Globe,
  Sparkles,
  BellRing,
  Trophy,
} from 'lucide-react';
import { KeyId, PenaltyStage } from '../types';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { sendLocalNotification } from '../utils/notification';
import { verifyLineWorksApi2Auth, formatDailySummaryMessage } from '../utils/lineworks';
import { getTodayString, formatJapaneseDate } from '../utils/date';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { SECTION_CATEGORIES, SECTION_PARTS_MAP, SectionCategory } from '../constants/parts';
import { NotificationScheduleManager } from './NotificationScheduleManager';
import { PatternManagerModal } from './PatternManagerModal';
import { NotificationGuideModal } from './NotificationGuideModal';
import { useAttendancePatterns } from '../hooks/useAttendancePatterns';
import {
  DAYS_OF_WEEK_META,
  DEFAULT_WEEKLY_SCHEDULE,
  resolveScheduleForDate,
} from '../constants/schedule';

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
        className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium appearance-none disabled:opacity-40"
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
        className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium appearance-none disabled:opacity-40"
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

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateSettings,
    isAdmin,
    loginAdmin,
    logoutAdmin,
    members,
    addMember,
    deleteMember,
    clearAllMembers,
    myMemberName,
    myMemberSection,
    myMemberPart,
    setMyMemberName,
    setMyMemberProfile,
    sendLineWorksTestSummary,
    attendances,
    hasNotificationPermission,
    notificationStatus,
    isInIframe,
    requestNotificationPermission,
    sendTestNotification,
    themeMode,
    setThemeMode,
    isDark,
    triggerSplashScreen,
    triggerTutorial,
    sendLineWorksKeyReminderTest,
    sendLineWorksEventReminderTest,
  } = useApp();

  // User profile state
  const [userNameInput, setUserNameInput] = useState(myMemberName);
  const [userSectionInput, setUserSectionInput] = useState<string>(myMemberSection || '');
  const [userPartInput, setUserPartInput] = useState<string>(myMemberPart || '');
  const [userNameSaved, setUserNameSaved] = useState(false);

  // Sync state if myMemberName/Section/Part changes
  useEffect(() => {
    setUserNameInput(myMemberName);
    setUserSectionInput(myMemberSection || '');
    setUserPartInput(myMemberPart || '');
  }, [myMemberName, myMemberSection, myMemberPart]);

  // Attendance patterns
  const { patterns, savePatterns } = useAttendancePatterns();
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);

  // PWA & Google Play state
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePwaInstall();
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const [showPlayGuide, setShowPlayGuide] = useState(false);
  const [showPwaGuide, setShowPwaGuide] = useState(false);

  // Push notification state for Settings screen
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const [isSendingLocalNotifTest, setIsSendingLocalNotifTest] = useState(false);
  const [notifGuideOpen, setNotifGuideOpen] = useState(false);
  const [notifGuideReason, setNotifGuideReason] = useState<
    'iframe' | 'denied' | 'unsupported' | 'dismissed' | 'error' | null
  >(null);
  const [notifToast, setNotifToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRequestNotifClick = async () => {
    setIsRequestingNotif(true);
    setNotifToast(null);
    try {
      const res = await requestNotificationPermission();
      if (res.success) {
        setNotifToast({
          type: 'success',
          text: 'プッシュ通知が許可されました！確認テスト通知を送信しました。',
        });
        setTimeout(() => setNotifToast(null), 4000);
      } else {
        setNotifGuideReason(res.reason || (res.isInIframe ? 'iframe' : 'error'));
        setNotifGuideOpen(true);
      }
    } catch {
      setNotifGuideReason('error');
      setNotifGuideOpen(true);
    } finally {
      setIsRequestingNotif(false);
    }
  };

  const handleSendTestNotifClick = async () => {
    setIsSendingLocalNotifTest(true);
    try {
      const res = await sendTestNotification();
      if (res.success) {
        setNotifToast({
          type: 'success',
          text: '端末にテスト通知を送信しました！',
        });
      } else {
        setNotifToast({
          type: 'error',
          text: res.error || 'テスト通知の送信に失敗しました',
        });
      }
      setTimeout(() => setNotifToast(null), 3500);
    } finally {
      setIsSendingLocalNotifTest(false);
    }
  };

  // Admin login states
  const [passcodeAttempt, setPasscodeAttempt] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [showAdminSection, setShowAdminSection] = useState(false);

  // Admin settings states
  const [notificationTime, setNotificationTime] = useState(
    settings?.summaryNotificationTime || ''
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    settings?.notificationsEnabled ?? true
  );
  const [clubName, setClubName] = useState(settings?.clubName || '部活動');
  const [penaltyStages, setPenaltyStages] = useState<PenaltyStage[]>(
    settings?.penaltyStages || []
  );
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Passcode change states
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [passcodeSuccess, setPasscodeSuccess] = useState('');
  const [passcodeChangeError, setPasscodeChangeError] = useState('');

  // Key names settings states (2鍵対応)
  const [key1NameInput, setKey1NameInput] = useState(settings.keyNames?.key1 || '鍵①');
  const [key2NameInput, setKey2NameInput] = useState(settings.keyNames?.key2 || '鍵②');
  const [keyNamesSaved, setKeyNamesSaved] = useState(false);

  useEffect(() => {
    setKey1NameInput(settings?.keyNames?.key1 || '鍵①');
    setKey2NameInput(settings?.keyNames?.key2 || '鍵②');
  }, [settings?.keyNames]);

  useEffect(() => {
    setNotificationTime(settings?.summaryNotificationTime || '');
    setNotificationsEnabled(settings?.notificationsEnabled ?? true);
    setClubName(settings?.clubName || '部活動');
    setPenaltyStages(settings?.penaltyStages || []);
  }, [
    settings?.summaryNotificationTime,
    settings?.notificationsEnabled,
    settings?.clubName,
    settings?.penaltyStages,
  ]);

  const handleSaveKeyNames = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setIsSaving(true);
    try {
      await updateSettings({
        keyNames: {
          key1: key1NameInput.trim() || '鍵①',
          key2: key2NameInput.trim() || '鍵②',
        },
      });
      setKeyNamesSaved(true);
      setTimeout(() => setKeyNamesSaved(false), 3000);
    } catch (err) {
      setSettingsError('鍵名の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // Key reminder settings states (鍵の催促通知設定)
  const [keyReminderEnabled, setKeyReminderEnabled] = useState(
    settings?.keyReminders?.enabled ?? false
  );
  const [keyAppEnabled, setKeyAppEnabled] = useState(
    settings?.keyReminders?.appNotificationEnabled ?? true
  );
  const [keyLwEnabled, setKeyLwEnabled] = useState(
    settings?.keyReminders?.lineWorksNotificationEnabled ?? false
  );
  const [keyReminderStartTime, setKeyReminderStartTime] = useState(
    settings?.keyReminders?.startTime || '18:00'
  );
  const [keyReminderInterval, setKeyReminderInterval] = useState(
    settings?.keyReminders?.intervalMinutes || 15
  );
  const [keyReminderMaxCount, setKeyReminderMaxCount] = useState(
    settings?.keyReminders?.maxCount || 3
  );
  const [keyReminderOnlyActiveDays, setKeyReminderOnlyActiveDays] = useState(
    settings?.keyReminders?.onlyOnActiveDays ?? false
  );
  const [keyReminderUseSummaryTime, setKeyReminderUseSummaryTime] = useState(
    settings?.keyReminders?.useSummaryTime ?? false
  );

  const [keyResetAdminOnly, setKeyResetAdminOnly] = useState(
    settings?.keyResetAdminOnly ?? false
  );
  const [autoResetKeysAtMidnight, setAutoResetKeysAtMidnight] = useState(
    settings?.autoResetKeysAtMidnight ?? true
  );

  useEffect(() => {
    setKeyResetAdminOnly(settings?.keyResetAdminOnly ?? false);
    setAutoResetKeysAtMidnight(settings?.autoResetKeysAtMidnight ?? true);
  }, [settings?.keyResetAdminOnly, settings?.autoResetKeysAtMidnight]);

  const [keyRemindersSaved, setKeyRemindersSaved] = useState(false);
  const [testReminderToast, setTestReminderToast] = useState<string | null>(null);

  useEffect(() => {
    if (settings.keyReminders) {
      setKeyReminderEnabled(settings.keyReminders.enabled ?? false);
      setKeyAppEnabled(settings.keyReminders.appNotificationEnabled ?? true);
      setKeyLwEnabled(settings.keyReminders.lineWorksNotificationEnabled ?? false);
      setKeyReminderStartTime(settings.keyReminders.startTime || '18:00');
      setKeyReminderInterval(settings.keyReminders.intervalMinutes || 15);
      setKeyReminderMaxCount(settings.keyReminders.maxCount || 3);
      setKeyReminderOnlyActiveDays(settings.keyReminders.onlyOnActiveDays ?? false);
      setKeyReminderUseSummaryTime(settings.keyReminders.useSummaryTime ?? false);
    }
  }, [settings.keyReminders]);

  const handleSaveKeyReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Settings] 鍵催促設定の保存処理を開始します');
    setSettingsError('');
    setKeyRemindersSaved(false);
    setIsSaving(true);

    try {
      const today = getTodayString();
      const reminderDocRef = doc(db, 'key_reminders', `${today}_unified`);
      
      // 1. 過去の通知抑制のためのリセット（失敗しても設定保存は継続するが、ログは出す）
      try {
        console.log(`[Settings] 過去の通知抑制のため最終送信時刻をリセット中... (日付: ${today})`);
        await setDoc(reminderDocRef, {
          date: today,
          lastSentAt: Date.now(),
          updatedAt: Date.now(),
        }, { merge: true });
        console.log('[Settings] 最終送信時刻のリセットに成功しました');
      } catch (resetErr: any) {
        console.warn('[Settings] 最終送信時刻のリセットに失敗しました（設定保存は続行します）:', resetErr);
      }

      // 2. 設定の保存
      console.log('[Settings] Firestoreに催促設定を書き込み中...');
      await updateSettings({
        keyReminders: {
          enabled: keyReminderEnabled,
          appNotificationEnabled: keyAppEnabled,
          lineWorksNotificationEnabled: keyLwEnabled,
          startTime: keyReminderStartTime || '18:00',
          intervalMinutes: Number(keyReminderInterval) || 15,
          maxCount: Number(keyReminderMaxCount) || 3,
          onlyOnActiveDays: keyReminderOnlyActiveDays,
          useSummaryTime: keyReminderUseSummaryTime,
        },
        keyResetAdminOnly,
        autoResetKeysAtMidnight,
      });
      
      console.log('[Settings] 鍵催促設定の保存が完了しました');
      setKeyRemindersSaved(true);
      setTimeout(() => setKeyRemindersSaved(false), 3000);
    } catch (err: any) {
      console.error('[Settings] 鍵催促設定の保存中に重大なエラーが発生しました:', err);
      setSettingsError(`保存に失敗しました: ${err.message || '不明なエラー'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestKeyReminder = async () => {
    const key1Name = settings.keyNames?.key1 || '鍵①';
    const key2Name = settings.keyNames?.key2 || '鍵②';
    const testTitle = `鍵の催促`;
    const testMessage = `【鍵の催促】${key1Name}と${key2Name}の両方がまだ閉められていません。報告してください。（テスト送信・1回目）`;

    try {
      await addDoc(collection(db, 'notifications'), {
        title: testTitle,
        message: testMessage,
        type: 'reminder',
        reminderCount: 1,
        relatedDate: getTodayString(),
        createdAt: Date.now(),
      });

      const res = await sendLocalNotification(testTitle, { body: testMessage });
      
      if (res.success) {
        setTestReminderToast(`テスト催促通知を送信しました！通知画面や端末で確認できます。`);
      } else {
        setTestReminderToast(`通知の送信に失敗しました: ${res.error || '不明なエラー'}`);
      }
      setTimeout(() => setTestReminderToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to send test key reminder:', err);
      setTestReminderToast(`Firestoreへの登録に失敗しました: ${err.message || '不明なエラー'}`);
      setTimeout(() => setTestReminderToast(null), 4000);
    }
  };

  // Member management states
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberGrade, setNewMemberGrade] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('部員');
  const [newMemberSection, setNewMemberSection] = useState<string>('');
  const [newMemberPart, setNewMemberPart] = useState<string>('');
  const [memberError, setMemberError] = useState('');

  // LINE WORKS states
  const [lwMode, setLwMode] = useState<'api2' | 'webhook'>(settings.lineWorks?.mode || (settings.lineWorks?.webhookUrl ? 'webhook' : 'api2'));
  const [lwEnabled, setLwEnabled] = useState(settings.lineWorks?.enabled ?? false);
  const [lwWebhookUrl, setLwWebhookUrl] = useState(settings.lineWorks?.webhookUrl || '');
  const [lwBotName, setLwBotName] = useState(settings.lineWorks?.botName || '部活出欠bot');
  const [lwSendSummary, setLwSendSummary] = useState(settings.lineWorks?.sendDailySummary ?? true);
  const [lwSendTardy, setLwSendTardy] = useState(settings.lineWorks?.sendTardyAlert ?? true);
  const [lwSendEventReminder, setLwSendEventReminder] = useState(settings.lineWorks?.sendEventReminder ?? true);
  
  // LINE WORKS API 2.0 credentials
  const [lwClientId, setLwClientId] = useState(settings.lineWorks?.clientId || '');
  const [lwClientSecret, setLwClientSecret] = useState(settings.lineWorks?.clientSecret || '');
  const [lwServiceAccount, setLwServiceAccount] = useState(settings.lineWorks?.serviceAccount || '');
  const [lwPrivateKey, setLwPrivateKey] = useState(settings.lineWorks?.privateKey || '');
  const [lwBotId, setLwBotId] = useState(settings.lineWorks?.botId || '');
  const [lwChannelId, setLwChannelId] = useState(settings.lineWorks?.channelId || '');

  // LINE WORKS Key Reminder states
  const [lwKRClientId, setLwKRClientId] = useState(settings.lineWorksKeyReminder?.clientId || '');
  const [lwKRClientSecret, setLwKRClientSecret] = useState(settings.lineWorksKeyReminder?.clientSecret || '');
  const [lwKRServiceAccount, setLwKRServiceAccount] = useState(settings.lineWorksKeyReminder?.serviceAccount || '');
  const [lwKRPrivateKey, setLwKRPrivateKey] = useState(settings.lineWorksKeyReminder?.privateKey || '');
  const [lwKRBotId, setLwKRBotId] = useState(settings.lineWorksKeyReminder?.botId || '');
  const [lwKRChannelId, setLwKRChannelId] = useState(settings.lineWorksKeyReminder?.channelId || '');
  const [lwKRSettingsSaved, setLwKRSettingsSaved] = useState(false);
  const [lwKRTesting, setLwKRTesting] = useState(false);
  const [lwKRVerifyingAuth, setLwKRVerifyingAuth] = useState(false);
  const [lwKRTestResult, setLwKRTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // LINE WORKS Events states
  const [lwEvEnabled, setLwEvEnabled] = useState(settings.lineWorksEvents?.enabled ?? false);
  const [lwEvClientId, setLwEvClientId] = useState(settings.lineWorksEvents?.clientId || '');
  const [lwEvClientSecret, setLwEvClientSecret] = useState(settings.lineWorksEvents?.clientSecret || '');
  const [lwEvServiceAccount, setLwEvServiceAccount] = useState(settings.lineWorksEvents?.serviceAccount || '');
  const [lwEvPrivateKey, setLwEvPrivateKey] = useState(settings.lineWorksEvents?.privateKey || '');
  const [lwEvBotId, setLwEvBotId] = useState(settings.lineWorksEvents?.botId || '');
  const [lwEvChannelId, setLwEvChannelId] = useState(settings.lineWorksEvents?.channelId || '');
  const [lwEvSettingsSaved, setLwEvSettingsSaved] = useState(false);
  const [lwEvTesting, setLwEvTesting] = useState(false);
  const [lwEvVerifyingAuth, setLwEvVerifyingAuth] = useState(false);
  const [lwEvTestResult, setLwEvTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto Attendance states
  const [autoAttEnabled, setAutoAttEnabled] = useState(settings?.autoAttendance?.enabled ?? false);
  const [autoAttMode, setAutoAttMode] = useState<'on_app_open' | 'at_specific_time'>(settings?.autoAttendance?.mode || 'on_app_open');
  const [autoAttTime, setAutoAttTime] = useState(settings?.autoAttendance?.time || '08:30');
  const [autoAttSaved, setAutoAttSaved] = useState(false);

  const [lwSettingsSaved, setLwSettingsSaved] = useState(false);
  const [lwTesting, setLwTesting] = useState(false);
  const [lwVerifyingAuth, setLwVerifyingAuth] = useState(false);
  const [lwTestResult, setLwTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showLwGuide, setShowLwGuide] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Sync state if settings change from Firestore
  useEffect(() => {
    if (settings.lineWorks) {
      setLwMode(settings.lineWorks.mode || (settings.lineWorks.webhookUrl ? 'webhook' : 'api2'));
      setLwEnabled(settings.lineWorks.enabled ?? false);
      setLwWebhookUrl(settings.lineWorks.webhookUrl || '');
      setLwBotName(settings.lineWorks.botName || '部活出欠bot');
      setLwSendSummary(settings.lineWorks.sendDailySummary ?? true);
      setLwSendTardy(settings.lineWorks.sendTardyAlert ?? true);
      setLwSendEventReminder(settings.lineWorks.sendEventReminder ?? true);
      setLwClientId(settings.lineWorks.clientId || '');
      setLwClientSecret(settings.lineWorks.clientSecret || '');
      setLwServiceAccount(settings.lineWorks.serviceAccount || '');
      setLwPrivateKey(settings.lineWorks.privateKey || '');
      setLwBotId(settings.lineWorks.botId || '');
      setLwChannelId(settings.lineWorks.channelId || '');
    }
    if (settings.lineWorksKeyReminder) {
      setLwKRClientId(settings.lineWorksKeyReminder.clientId || '');
      setLwKRClientSecret(settings.lineWorksKeyReminder.clientSecret || '');
      setLwKRServiceAccount(settings.lineWorksKeyReminder.serviceAccount || '');
      setLwKRPrivateKey(settings.lineWorksKeyReminder.privateKey || '');
      setLwKRBotId(settings.lineWorksKeyReminder.botId || '');
      setLwKRChannelId(settings.lineWorksKeyReminder.channelId || '');
    }
    if (settings.lineWorksEvents) {
      setLwEvEnabled(settings.lineWorksEvents.enabled ?? false);
      setLwEvClientId(settings.lineWorksEvents.clientId || '');
      setLwEvClientSecret(settings.lineWorksEvents.clientSecret || '');
      setLwEvServiceAccount(settings.lineWorksEvents.serviceAccount || '');
      setLwEvPrivateKey(settings.lineWorksEvents.privateKey || '');
      setLwEvBotId(settings.lineWorksEvents.botId || '');
      setLwEvChannelId(settings.lineWorksEvents.channelId || '');
    }
    if (settings.autoAttendance) {
      setAutoAttEnabled(settings.autoAttendance.enabled ?? false);
      setAutoAttMode(settings.autoAttendance.mode || 'on_app_open');
      setAutoAttTime(settings.autoAttendance.time || '08:30');
    }
  }, [settings.lineWorks, settings.lineWorksKeyReminder, settings.lineWorksEvents, settings.autoAttendance]);

  const handleSaveUserName = (e: React.FormEvent) => {
    e.preventDefault();
    if (userNameInput.trim()) {
      setMyMemberProfile(userNameInput.trim(), userSectionInput, userPartInput);
      setUserNameSaved(true);
      setTimeout(() => setUserNameSaved(false), 2500);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    const success = loginAdmin(passcodeAttempt);
    if (success) {
      setPasscodeAttempt('');
      setPasscodeError('');
    } else {
      setPasscodeError('合言葉が正しくありません。再度ご確認ください。');
    }
  };

  const handleSaveNotificationSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaved(false);
    setSettingsError('');
    setIsSaving(true);
    
    try {
      // 数値順にソートして保存
      const sortedStages = [...penaltyStages]
        .filter(s => s.threshold > 0)
        .sort((a, b) => a.threshold - b.threshold);

      await updateSettings({
        summaryNotificationTime: notificationTime.trim(),
        notificationsEnabled,
        clubName: clubName.trim() || '部活動',
        penaltyStages: sortedStages,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      setSettingsError('設定の保存に失敗しました。再度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeSuccess('');
    setPasscodeChangeError('');
    setIsSaving(true);

    if (newPasscode.length < 4) {
      setPasscodeChangeError('合言葉は4文字以上で設定してください');
      setIsSaving(false);
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setPasscodeChangeError('確認用の合言葉が一致しません');
      setIsSaving(false);
      return;
    }

    try {
      await updateSettings({
        adminPasscode: newPasscode.trim(),
      });
      setNewPasscode('');
      setConfirmPasscode('');
      setPasscodeSuccess('合言葉を変更しました');
      setTimeout(() => setPasscodeSuccess(''), 3000);
    } catch (err) {
      setPasscodeChangeError('合言葉の変更に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    if (!newMemberName.trim()) {
      setMemberError('部員名を入力してください');
      return;
    }
    await addMember(newMemberName, newMemberGrade, newMemberRole, newMemberSection, newMemberPart);
    setNewMemberName('');
    setNewMemberGrade('');
    setNewMemberRole('部員');
    setNewMemberSection('');
    setNewMemberPart('');
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (window.confirm(`「${name}」さんを部員一覧から削除しますか？`)) {
      await deleteMember(id);
    }
  };

  const handleClearAllMembers = async () => {
    if (
      window.confirm(
        `登録されている部員全員（${members.length}名）を削除しますか？\n※初期サンプル名を含め全て削除され、空になります。`
      )
    ) {
      await clearAllMembers();
    }
  };

  const getLineWorksConfigPayload = () => ({
    enabled: lwEnabled,
    mode: lwMode,
    webhookUrl: lwWebhookUrl.trim(),
    botName: lwBotName.trim() || '部活出欠bot',
    sendDailySummary: lwSendSummary,
    sendTardyAlert: lwSendTardy,
    sendEventReminder: lwSendEventReminder,
    clientId: lwClientId.trim(),
    clientSecret: lwClientSecret.trim(),
    serviceAccount: lwServiceAccount.trim(),
    privateKey: lwPrivateKey.trim(),
    botId: lwBotId.trim(),
    channelId: lwChannelId.trim(),
  });

  const handleSaveLineWorksSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLwTestResult(null);
    setSettingsError('');
    setIsSaving(true);
    try {
      const config = getLineWorksConfigPayload();
      await updateSettings({
        lineWorks: config,
      });
      setLwSettingsSaved(true);
      setTimeout(() => setLwSettingsSaved(false), 2500);
    } catch (err) {
      setSettingsError('LINE WORKS設定の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLineWorksKeyReminderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLwKRTestResult(null);
    setSettingsError('');
    setIsSaving(true);
    try {
      const config = {
        enabled: true,
        mode: 'api2' as const,
        clientId: lwKRClientId.trim(),
        clientSecret: lwKRClientSecret.trim(),
        serviceAccount: lwKRServiceAccount.trim(),
        privateKey: lwKRPrivateKey.trim(),
        botId: lwKRBotId.trim(),
        channelId: lwKRChannelId.trim(),
        sendDailySummary: false,
        sendTardyAlert: false,
      };
      await updateSettings({
        lineWorksKeyReminder: config,
      });
      setLwKRSettingsSaved(true);
      setTimeout(() => setLwKRSettingsSaved(false), 2500);
    } catch (err) {
      setSettingsError('催促用LINE WORKS設定の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyLineWorksKRAuth = async () => {
    if (!lwKRClientId.trim() || !lwKRClientSecret.trim() || !lwKRServiceAccount.trim() || !lwKRPrivateKey.trim()) {
      setLwKRTestResult({
        type: 'error',
        message: 'Client ID、Client Secret、Service Account、Private Key をすべて入力してください。',
      });
      return;
    }

    setLwKRVerifyingAuth(true);
    setLwKRTestResult(null);

    try {
      const res = await verifyLineWorksApi2Auth({
        clientId: lwKRClientId.trim(),
        clientSecret: lwKRClientSecret.trim(),
        serviceAccount: lwKRServiceAccount.trim(),
        privateKey: lwKRPrivateKey.trim(),
      });

      if (res.success) {
        setLwKRTestResult({
          type: 'success',
          message: '鍵催促用 LINE WORKS API 2.0 の認証とトークン発行に成功しました！',
        });
        // Clear stale automation error if manual verification succeeds
        if (settings.lastLwKRStatus && !settings.lastLwKRStatus.success) {
          updateSettings({ lastLwKRStatus: { success: true, timestamp: Date.now() } });
        }
        setTimeout(() => setLwKRTestResult(null), 8000);
      } else {
        setLwKRTestResult({
          type: 'error',
          message: res.error || '認証に失敗しました。認証情報をご確認ください。',
        });
      }
    } catch (err: any) {
      setLwKRTestResult({
        type: 'error',
        message: err?.message || '認証確認中にエラーが発生しました',
      });
    } finally {
      setLwKRVerifyingAuth(false);
    }
  };

  const handleTestLineWorksKR = async () => {
    // Channel ID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isPotentiallyInvalid = lwKRChannelId.trim() && !uuidRegex.test(lwKRChannelId.trim()) && !lwKRChannelId.trim().startsWith('c_');

    if (!lwKRClientId.trim() || !lwKRBotId.trim() || !lwKRChannelId.trim()) {
      setLwKRTestResult({
        type: 'error',
        message: 'Client ID, Bot ID, Channel ID をすべて入力してください',
      });
      return;
    }

    if (isPotentiallyInvalid) {
      if (!window.confirm('入力された Channel ID が標準的な形式（UUID形式など）と異なるようです。このまま送信テストを続行しますか？\n※Channel IDは通常 8-4-4-4-12 形式の文字列です。')) {
        return;
      }
    }

    setLwKRTesting(true);
    setLwKRTestResult(null);

    try {
      // Save configuration first
      const config = {
        enabled: true,
        mode: 'api2' as const,
        clientId: lwKRClientId.trim(),
        clientSecret: lwKRClientSecret.trim(),
        serviceAccount: lwKRServiceAccount.trim(),
        privateKey: lwKRPrivateKey.trim(),
        botId: lwKRBotId.trim(),
        channelId: lwKRChannelId.trim(),
        sendDailySummary: false,
        sendTardyAlert: false,
      };
      await updateSettings({
        lineWorksKeyReminder: config,
      });

      const res = await sendLineWorksKeyReminderTest();
      if (res.success) {
        setLwKRTestResult({
          type: 'success',
          message: 'LINE WORKSへテスト催促メッセージを送信しました！トークルームをご確認ください。',
        });
        // Clear stale automation error if manual test succeeds
        if (settings.lastLwKRStatus && !settings.lastLwKRStatus.success) {
          updateSettings({ lastLwKRStatus: { success: true, timestamp: Date.now() } });
        }
        setTimeout(() => setLwKRTestResult(null), 8000);
      } else {
        let errorMsg = res.error || 'LINE WORKSへの送信に失敗しました。';
        if (errorMsg.includes('404')) {
          errorMsg = '【HTTP 404 エラー】送信先のチャンネルが見つかりません。Channel ID が正しいか、Botがそのトークルームに招待されているかを確認してください。';
        } else if (errorMsg.includes('scope')) {
          errorMsg = '[権限エラー] Request scope is not valid. LINE WORKS Developer Console で「bot」および「bot.message」のスコープが許可されているか確認してください。';
        }
        setLwKRTestResult({
          type: 'error',
          message: errorMsg,
        });
      }
    } catch (err: any) {
      let errorMsg = err?.message || '送信中にエラーが発生しました';
      if (errorMsg.includes('404')) {
        errorMsg = '【HTTP 404 エラー】送信先のチャンネルが見つかりません。Channel ID が正しいか、Botがそのトークルームに招待されているかを確認してください。';
      }
      setLwKRTestResult({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setLwKRTesting(false);
    }
  };

  const handleSaveLineWorksEventsSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLwEvTestResult(null);
    setSettingsError('');
    setIsSaving(true);
    try {
      const config = {
        enabled: lwEvEnabled,
        mode: 'api2' as const,
        clientId: lwEvClientId.trim(),
        clientSecret: lwEvClientSecret.trim(),
        serviceAccount: lwEvServiceAccount.trim(),
        privateKey: lwEvPrivateKey.trim(),
        botId: lwEvBotId.trim(),
        channelId: lwEvChannelId.trim(),
        sendDailySummary: false,
        sendTardyAlert: false,
        sendEventReminder: true,
      };
      await updateSettings({
        lineWorksEvents: config,
      });
      setLwEvSettingsSaved(true);
      setTimeout(() => setLwEvSettingsSaved(false), 2500);
    } catch (err) {
      setSettingsError('イベント用LINE WORKS設定の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyLineWorksEventsAuth = async () => {
    if (!lwEvClientId.trim() || !lwEvClientSecret.trim() || !lwEvServiceAccount.trim() || !lwEvPrivateKey.trim()) {
      setLwEvTestResult({
        type: 'error',
        message: 'Client ID、Client Secret、Service Account、Private Key をすべて入力してください。',
      });
      return;
    }

    setLwEvVerifyingAuth(true);
    setLwEvTestResult(null);

    try {
      const res = await verifyLineWorksApi2Auth({
        clientId: lwEvClientId.trim(),
        clientSecret: lwEvClientSecret.trim(),
        serviceAccount: lwEvServiceAccount.trim(),
        privateKey: lwEvPrivateKey.trim(),
      });

      if (res.success) {
        setLwEvTestResult({
          type: 'success',
          message: 'イベント用 LINE WORKS API 2.0 の認証とトークン発行に成功しました！',
        });
        setTimeout(() => setLwEvTestResult(null), 8000);
      } else {
        setLwEvTestResult({
          type: 'error',
          message: res.error || '認証に失敗しました。認証情報をご確認ください。',
        });
      }
    } catch (err: any) {
      setLwEvTestResult({
        type: 'error',
        message: err?.message || '認証確認中にエラーが発生しました',
      });
    } finally {
      setLwEvVerifyingAuth(false);
    }
  };

  const handleTestLineWorksEvents = async () => {
    // Channel ID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isPotentiallyInvalid = lwEvChannelId.trim() && !uuidRegex.test(lwEvChannelId.trim()) && !lwEvChannelId.trim().startsWith('c_');

    // 必須項目のチェック
    if (!lwEvClientId.trim() || !lwEvClientSecret.trim() || !lwEvServiceAccount.trim() || !lwEvPrivateKey.trim() || !lwEvBotId.trim() || !lwEvChannelId.trim()) {
      setLwEvTestResult({
        type: 'error',
        message: 'テスト通知の送信には Client ID, Secret, Service Account, Private Key, Bot ID, Channel ID のすべての接続情報が必要です。',
      });
      return;
    }

    if (isPotentiallyInvalid) {
      if (!window.confirm('入力されたイベント用 Channel ID が標準的な形式（UUID形式など）と異なるようです。このまま送信テストを続行しますか？')) {
        return;
      }
    }

    setLwEvTesting(true);
    setLwEvTestResult(null);

    try {
      // Save configuration first
      const config = {
        enabled: lwEvEnabled,
        mode: 'api2' as const,
        clientId: lwEvClientId.trim(),
        clientSecret: lwEvClientSecret.trim(),
        serviceAccount: lwEvServiceAccount.trim(),
        privateKey: lwEvPrivateKey.trim(),
        botId: lwEvBotId.trim(),
        channelId: lwEvChannelId.trim(),
        sendDailySummary: false,
        sendTardyAlert: false,
        sendEventReminder: true,
      };
      await updateSettings({
        lineWorksEvents: config,
      });

      const res = await sendLineWorksEventReminderTest();
      if (res.success) {
        setLwEvTestResult({
          type: 'success',
          message: 'LINE WORKSへイベントテストメッセージを送信しました！トークルームをご確認ください。',
        });
        setTimeout(() => setLwEvTestResult(null), 8000);
      } else {
        let errorMsg = res.error || 'LINE WORKSへの送信に失敗しました。';
        if (errorMsg.includes('404')) {
          errorMsg = '【HTTP 404 エラー】送信先のチャンネルが見つかりません。Channel ID が正しいか、Botがそのトークルームに招待されているかを確認してください。';
        } else if (errorMsg.includes('scope')) {
          errorMsg = `[権限エラー] Request scope is not valid. LINE WORKS Developer Console で、このアプリの Service Account に「bot」および「bot.message」のスコープが許可されているか確認してください。`;
        }
        setLwEvTestResult({
          type: 'error',
          message: errorMsg,
        });
      }
    } catch (err: any) {
      let errorMsg = err?.message || '送信中にエラーが発生しました。';
      if (errorMsg.includes('404')) {
        errorMsg = '【HTTP 404 エラー】送信先のチャンネルが見つかりません。Channel ID が正しいか、Botがそのトークルームに招待されているかを確認してください。';
      } else if (errorMsg.includes('scope')) {
        errorMsg = `[権限エラー] Request scope is not valid. LINE WORKS Developer Console で、このアプリの Service Account に「bot」および「bot.message」のスコープが許可されているか確認してください。`;
      }
      setLwEvTestResult({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setLwEvTesting(false);
    }
  };

  const handleSaveAutoAttendanceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setIsSaving(true);
    try {
      await updateSettings({
        autoAttendance: {
          enabled: autoAttEnabled,
          mode: autoAttMode,
          time: autoAttTime,
        },
      });
      setAutoAttSaved(true);
      setTimeout(() => setAutoAttSaved(false), 3000);
    } catch (err) {
      setSettingsError('自動出席設定の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyLineWorksAuth = async () => {
    if (!lwClientId.trim() || !lwClientSecret.trim() || !lwServiceAccount.trim() || !lwPrivateKey.trim() || !lwBotId.trim()) {
      setLwTestResult({
        type: 'error',
        message: 'Client ID、Client Secret、Service Account、Private Key、Bot ID をすべて入力してください。',
      });
      return;
    }

    setLwVerifyingAuth(true);
    setLwTestResult(null);

    // Save configuration first
    const config = getLineWorksConfigPayload();
    await updateSettings({ lineWorks: config });

    try {
      const res = await verifyLineWorksApi2Auth({
        clientId: lwClientId.trim(),
        clientSecret: lwClientSecret.trim(),
        serviceAccount: lwServiceAccount.trim(),
        privateKey: lwPrivateKey.trim(),
      });

      if (res.success) {
        setLwTestResult({
          type: 'success',
          message: 'LINE WORKS API 2.0 の認証とトークン発行に成功しました！連携の準備が整っています。',
        });
        setTimeout(() => setLwTestResult(null), 8000);
      } else {
        setLwTestResult({
          type: 'error',
          message: res.error || '認証に失敗しました。Private Keyの改行やClient Secretをご確認ください。',
        });
      }
    } catch (err: any) {
      setLwTestResult({
        type: 'error',
        message: err?.message || '認証確認中にエラーが発生しました',
      });
    } finally {
      setLwVerifyingAuth(false);
    }
  };

  const handleTestLineWorks = async () => {
    if (lwMode === 'webhook' && !lwWebhookUrl.trim()) {
      setLwTestResult({
        type: 'error',
        message: 'LINE WORKSのWebhook URLを入力してからテストを実行してください',
      });
      return;
    }

    if (lwMode === 'api2') {
      // Channel ID format check
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isPotentiallyInvalid = lwChannelId.trim() && !uuidRegex.test(lwChannelId.trim()) && !lwChannelId.trim().startsWith('c_');

      if (!lwClientId.trim() || !lwClientSecret.trim() || !lwServiceAccount.trim() || !lwPrivateKey.trim() || !lwBotId.trim() || !lwChannelId.trim()) {
        setLwTestResult({
          type: 'error',
          message: 'API 2.0 連携に必要な項目（Client ID, Client Secret, Service Account, Private Key, Bot ID, Channel ID）をすべて入力してください',
        });
        return;
      }

      if (isPotentiallyInvalid) {
        if (!window.confirm('入力された Channel ID が標準的な形式（UUID形式など）と異なるようです。このまま送信テストを続行しますか？')) {
          return;
        }
      }
    }

    setLwTesting(true);
    setLwTestResult(null);

    try {
      // Save configuration first so AppContext uses latest settings
      const config = getLineWorksConfigPayload();
      await updateSettings({
        lineWorks: config,
      });

      const res = await sendLineWorksTestSummary();
      if (res.success) {
        setLwTestResult({
          type: 'success',
          message: 'LINE WORKSへ正常に本日の出欠サマリーを送信できました！トークルームをご確認ください。',
        });
        setTimeout(() => setLwTestResult(null), 8000);
      } else {
        let errorMsg = res.error || 'LINE WORKSへの送信に失敗しました。';
        if (errorMsg.includes('404')) {
          errorMsg = '【HTTP 404 エラー】送信先のチャンネルが見つかりません。Channel ID が正しいか、Botがそのトークルームに招待されているかを確認してください。';
        }
        setLwTestResult({
          type: 'error',
          message: errorMsg,
        });
      }
    } catch (err: any) {
      let errorMsg = err?.message || '送信中にエラーが発生しました';
      if (errorMsg.includes('404')) {
        errorMsg = '【HTTP 404 エラー】送信先のチャンネルが見つかりません。Channel ID が正しいか、Botがそのトークルームに招待されているかを確認してください。';
      }
      setLwTestResult({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setLwTesting(false);
    }
  };

  const handleCopySummaryForLineWorks = () => {
    const today = getTodayString();
    const summaryText = formatDailySummaryMessage(
      settings.clubName || '部活動',
      today,
      attendances,
      members
    );
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="space-y-4 pb-28 pt-2">
      {/* Page Title */}
      <div>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">設定</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          画面表示やあなたのお名前、部活の全体設定を管理します
        </p>
      </div>

      {/* 【追加機能5】ダークモード・外観設定 */}
      <div
        id="theme-settings-card"
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {isDark ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            外観・テーマ設定（ダークモード）
          </h3>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
            現在: {themeMode === 'system' ? `自動 (${isDark ? 'ダーク' : 'ライト'})` : themeMode === 'dark' ? 'ダーク' : 'ライト'}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          お好みの表示モードを選択できます。端末の設定に合わせる「自動」も選べます。設定は次回起動時も維持されます。
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            id="btn-theme-light"
            onClick={() => setThemeMode('light')}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
              themeMode === 'light'
                ? 'border-blue-600 bg-blue-50/80 text-blue-700 ring-2 ring-blue-500/30 font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Sun className={`w-5 h-5 ${themeMode === 'light' ? 'text-amber-500' : 'text-slate-400'}`} />
            <span className="text-xs font-semibold">ライト</span>
          </button>

          <button
            type="button"
            id="btn-theme-dark"
            onClick={() => setThemeMode('dark')}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
              themeMode === 'dark'
                ? 'border-blue-600 bg-blue-50/80 text-blue-700 ring-2 ring-blue-500/30 font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Moon className={`w-5 h-5 ${themeMode === 'dark' ? 'text-indigo-400' : 'text-slate-400'}`} />
            <span className="text-xs font-semibold">ダーク</span>
          </button>

          <button
            type="button"
            id="btn-theme-system"
            onClick={() => setThemeMode('system')}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
              themeMode === 'system'
                ? 'border-blue-600 bg-blue-50/80 text-blue-700 ring-2 ring-blue-500/30 font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Monitor className={`w-5 h-5 ${themeMode === 'system' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
            <span className="text-xs font-semibold">自動 (端末依存)</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">起動画面アニメーション</span>
          <button
            type="button"
            id="btn-preview-splash-screen"
            onClick={triggerSplashScreen}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>起動画面をプレビュー</span>
          </button>
        </div>
      </div>

      {/* Google Play 公開 & スマホアプリ化 (PWA) */}
      <div
        id="pwa-google-play-card"
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5 transition-colors"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Google Play 公開 & スマホアプリ化 (PWA)
          </h3>
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            PWA要件適合済
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          このアプリはGoogle公式推奨のPWA（Trusted Web Activity）に対応しています。
          スマホのホーム画面に即座にインストールできるほか、無料の支援ツール（PWABuilder）を使って数分で
          <strong>Google Play用ファイル（.aab）</strong>を生成してストア申請できます。
        </p>

        {/* 端末への直接インストールセクション */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              端末にアプリとして追加
            </span>
            {isInstalled ? (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                インストール済み
              </span>
            ) : null}
          </div>

          {!isInstalled ? (
            <div className="space-y-2">
              {isInstallable ? (
                <button
                  type="button"
                  id="btn-pwa-install"
                  onClick={async () => {
                    const success = await promptInstall();
                    if (!success) setShowPwaGuide(true);
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-black rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                >
                  <Smartphone className="w-5 h-5" />
                  📲 ホーム画面に追加する
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPwaGuide(true)}
                  className="w-full py-3 px-4 bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-black rounded-2xl flex items-center justify-center gap-2.5 transition-all hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <HelpCircle className="w-5 h-5" />
                  ホーム画面への追加方法を確認
                </button>
              )}
              
              <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 font-bold px-4">
                ブラウザのメニューから直接「インストール」または「ホーム画面に追加」を選ぶこともできます。
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                ✅ ホーム画面に追加済みです
                <br />
                <span className="text-[10px] font-medium opacity-80">全画面アプリとして快適にご利用いただけます。</span>
              </p>
            </div>
          )}
        </div>

        {/* Google Play 公開手順の詳細アコーディオン */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <button
            type="button"
            id="toggle-google-play-guide"
            onClick={() => setShowPlayGuide(!showPlayGuide)}
            className="w-full p-3 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left transition-colors"
          >
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Google Play 公開パッケージ（.aab）の作成手順
            </span>
            {showPlayGuide ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showPlayGuide && (
            <div className="p-3.5 bg-white dark:bg-slate-900 text-xs space-y-3.5 border-t border-slate-200 dark:border-slate-800">
              {/* ステップ1: URLコピー */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                    1
                  </span>
                  このアプリの公開URLを取得する
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Google PlayのアプリはWebのHTTPS URLを読み込みます。下のURLをコピーしてください。
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={window.location.origin}
                    className="flex-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin);
                      setCopiedAppUrl(true);
                      setTimeout(() => setCopiedAppUrl(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 shrink-0"
                  >
                    {copiedAppUrl ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        コピー完了
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        URLコピー
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* ステップ2: PWABuilderで.aabを生成 */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                    2
                  </span>
                  PWABuilder で .aab（Playストア用ファイル）を生成
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Microsoft/Google公式支援ツール<strong>PWABuilder</strong>を開き、コピーしたURLを入力して「Start」を押します。
                </p>
                <a
                  href="https://www.pwabuilder.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-bold text-xs"
                >
                  <Globe className="w-3.5 h-3.5" />
                  PWABuilder を開く（外部サイト）
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* ステップ3: Package for Google Play */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                    3
                  </span>
                  「Package for Store」→「Google Play」を選択
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  マニフェストとService Workerはすでに本アプリ内に完備されているため、すべてグリーン（合格）になります。「Generate Package」をクリックすると、提出用の
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">
                    app-release.aab
                  </code>
                  が含まれるZIPファイルがダウンロードされます。
                </p>
              </div>

              {/* ステップ4: Google Play Consoleで申請 */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                    4
                  </span>
                  Google Play Console に提出して審査へ
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Google Play Console（初回登録料 $25）で「アプリを作成」し、ダウンロードした
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">
                    .aab
                  </code>
                  をアップロード。ストア掲載情報（説明文・スクリーンショット）を入力して公開審査に提出します。
                </p>
              </div>

              {/* PWA対応済みコンポーネント一覧 */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  本アプリの対応済みPWAリソース:
                </p>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span>Web App Manifest</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span>Service Worker (キャッシュ対応)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span>アプリアイコン (192px/512px)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span>マスク可能アイコン (Android適応)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1. General User Settings: Your Name */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          部員設定（お名前・パート）
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          出欠連絡の送信時に自動入力され、パート・区分別集計や絞り込みに反映されます
        </p>

        {userNameSaved && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>プロフィール設定（お名前・パート）を保存しました</span>
          </div>
        )}

        <form onSubmit={handleSaveUserName} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
              部員一覧から選ぶ、または直接入力
            </label>
            {members.length > 0 && (
              <select
                value={members.some((m) => m.name === userNameInput) ? userNameInput : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setUserNameInput(val);
                  const selectedMember = members.find((m) => m.name === val);
                  if (selectedMember) {
                    if (selectedMember.section) setUserSectionInput(selectedMember.section);
                    if (selectedMember.part) setUserPartInput(selectedMember.part);
                  }
                }}
                className="w-full mb-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">部員リストから選択...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} {m.part ? `(${m.part})` : m.section ? `(${m.section})` : m.grade ? `(${m.grade})` : ''}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              id="input-user-myname"
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              placeholder="例: 田中 健太"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Section & Part Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                区分
              </label>
              <select
                id="select-user-section"
                value={userSectionInput}
                onChange={(e) => {
                  const sec = e.target.value;
                  setUserSectionInput(sec);
                  const availableParts = sec ? SECTION_PARTS_MAP[sec as SectionCategory] || [] : [];
                  if (!availableParts.includes(userPartInput)) {
                    setUserPartInput(availableParts[0] || '');
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">区分を選択...</option>
                {SECTION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                詳細パート
              </label>
              <select
                id="select-user-part"
                value={userPartInput}
                onChange={(e) => setUserPartInput(e.target.value)}
                disabled={!userSectionInput}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {userSectionInput ? '詳細パートを選択...' : '先に区分を選択'}
                </option>
                {userSectionInput &&
                  (SECTION_PARTS_MAP[userSectionInput as SectionCategory] || []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            id="btn-save-myname"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
          >
            プロフィール（お名前・パート）を保存する
          </button>
        </form>
      </div>

      {/* 1.5 Frequently Used Patterns Management Card */}
      <div
        id="settings-patterns-section"
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            よく使うパターン（ワンタップ入力）の設定
          </h3>
          <button
            type="button"
            id="btn-settings-open-pattern-modal"
            onClick={() => setIsPatternModalOpen(true)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            パターンを追加・編集
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          「体調不良で欠席」「通院遅刻」「掃除遅刻」など、よく使う出欠パターンを登録・並び替え・削除できます。
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {patterns.map((p) => {
            const badgeColor =
              p.type === '欠席'
                ? 'bg-red-500'
                : p.type === '遅刻'
                ? 'bg-amber-500'
                : p.type === '緊急遽刻'
                ? 'bg-rose-600'
                : 'bg-yellow-500';

            return (
              <div
                key={p.id}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
              >
                <span className={`w-2 h-2 rounded-full ${badgeColor}`} />
                <span>{p.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                  ({p.type}
                  {p.time ? `・${p.time}` : ''}
                  {p.reason ? `・${p.reason}` : ''})
                </span>
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            登録数: {patterns.length} 件
          </span>
          <button
            type="button"
            onClick={() => setIsPatternModalOpen(true)}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            パターン管理画面を開く →
          </button>
        </div>
      </div>

      {/* 1.7 Device Push Notification Card */}
      <div
        id="settings-device-push-notification"
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            この端末のプッシュ通知
          </h3>
          <button
            type="button"
            onClick={() => {
              setNotifGuideReason(null);
              setNotifGuideOpen(true);
            }}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            設定ヘルプ
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          部員の遅刻連絡やまとめ通知を、このスマートフォン・PCのブラウザ通知として直接受信します
        </p>

        {notifToast && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
              notifToast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            {notifToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notifToast.text}</span>
          </div>
        )}

        {hasNotificationPermission ? (
          <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">通知が有効です</span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  部活の連絡がこの端末に即時配信されます
                </p>
              </div>
            </div>
            <button
              type="button"
              id="btn-settings-send-test-notif"
              onClick={handleSendTestNotifClick}
              disabled={isSendingLocalNotifTest}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
            >
              <Bell className="w-3 h-3" />
              {isSendingLocalNotifTest ? '送信中...' : 'テスト通知'}
            </button>
          </div>
        ) : isInIframe ? (
          <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs">
            <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">別タブで開くと通知を許可できます</span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  プレビュー枠内（iframe）ではブラウザの安全制限のため通知許可ポップアップが表示されません。別タブで開くとワンタップで許可できます。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                id="btn-settings-open-new-tab"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open(window.location.href, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                別タブでアプリを開く
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotifGuideReason('iframe');
                  setNotifGuideOpen(true);
                }}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors"
              >
                詳しい解説
              </button>
            </div>
          </div>
        ) : notificationStatus === 'denied' ? (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <span className="font-bold">ブラウザで通知が拒否されています</span>
                <p className="text-[11px] text-rose-800 dark:text-rose-300">
                  アドレスバーの鍵マークから「通知」を許可に切り替えてください
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setNotifGuideReason('denied');
                setNotifGuideOpen(true);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer transition-colors"
            >
              解除手順
            </button>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>通知を許可すると、遅刻連絡やまとめ通知を即座に受信できます</span>
            </div>
            <button
              type="button"
              id="btn-settings-request-notif"
              onClick={handleRequestNotifClick}
              disabled={isRequestingNotif}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer shadow-xs transition-colors flex items-center gap-1"
            >
              {isRequestingNotif ? '確認中...' : '通知を許可する'}
            </button>
          </div>
        )}
      </div>

      {/* Non-Admin view: Notification Schedule Info Card */}
      {!isAdmin && (
        <div
          id="member-notification-schedule-info"
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              部活の出欠まとめ通知予定
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              曜日別・カレンダー連動
            </span>
          </div>

          {/* Today's schedule preview */}
          {(() => {
            const todayStr = getTodayString();
            const todaySched = resolveScheduleForDate(todayStr, settings);
            return (
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/60 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block">
                    本日 ({formatJapaneseDate(todayStr, false)}) の配信予定
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {todaySched.enabled ? (
                      <>
                        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {todaySched.time}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          配信予定
                        </span>
                        {todaySched.label && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ({todaySched.label})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        本日は通知OFF (部活休み / 配信なし)
                      </span>
                    )}
                  </div>
                </div>

                {todaySched.isOverride && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    カレンダー個別設定
                  </span>
                )}
              </div>
            );
          })()}

          {/* 7-day strip preview */}
          <div className="grid grid-cols-7 gap-1 text-center pt-1">
            {DAYS_OF_WEEK_META.map((meta) => {
              const sched = (settings.weeklyNotificationSchedule || DEFAULT_WEEKLY_SCHEDULE)[meta.strKey] || {
                enabled: true,
                time: '16:00',
              };
              return (
                <div
                  key={meta.strKey}
                  className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <span className={`text-[11px] font-bold block ${meta.colorClass}`}>
                    {meta.short}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                    {sched.enabled ? sched.time : 'OFF'}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-1">
            ※通知時刻の変更や祝日・合宿などの特別設定は、下部の「管理者メニュー」から設定できます。
          </p>
        </div>
      )}

      {/* Help & App Info Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ヘルプとアプリ情報
        </h3>
        <div className="space-y-2">
          <button
            type="button"
            id="btn-show-tutorial-again"
            onClick={triggerTutorial}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">操作説明をもう一度見る</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">アプリの使い方ガイドを表示します</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90" />
          </button>

          <button
            type="button"
            onClick={triggerSplashScreen}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">起動アニメーションを再生</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">スプラッシュ画面を再表示します</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90" />
          </button>
        </div>
        <div className="pt-1 text-center border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            吹奏楽部 出欠連絡 v1.5.0
          </p>
        </div>
      </div>

      {/* 2. If already logged in as Admin, show Admin Dashboard */}
      {isAdmin ? (
        <div className="space-y-4">
          {/* Admin Banner & Logout */}
          <div className="bg-blue-900 text-white rounded-2xl p-4 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center text-white">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                  管理者モード有効中
                </h3>
                <p className="text-[11px] text-blue-200">
                  全設定の変更および連絡の削除が可能です
                </p>
              </div>
            </div>
            <button
              id="btn-admin-logout"
              onClick={logoutAdmin}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-white rounded-xl text-xs font-bold border border-blue-600 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              管理者ログアウト
            </button>
          </div>

          {/* Admin Section: Notification Schedule Manager (Per-Day & Calendar) */}
          <NotificationScheduleManager />

          {/* Admin Section: Club Name & Master Notification Switch */}
          <div
            id="admin-notification-settings"
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              部活動の基本設定・全体スイッチ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              部活動名や、通知全体の緊急停止・マスターON/OFFを切り替えます
            </p>

            {settingsSaved && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>基本設定を保存しました</span>
              </div>
            )}

            {settingsError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span>{settingsError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNotificationSettings} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  部活動名
                </label>
                <input
                  type="text"
                  id="input-admin-club-name"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="例: サッカー部、吹奏楽部"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  まとめ通知の基本配信時刻
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <TimePulldown
                    value={notificationTime}
                    onChange={setNotificationTime}
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    ※各曜日の個別設定がない場合、この時刻に配信されます
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  罰ゲームの段階設定（累積スタンプ数）
                </label>
                <div className="space-y-2">
                  {[...penaltyStages]
                    .sort((a, b) => a.threshold - b.threshold)
                    .map((stage, idx) => (
                      <div key={`penalty-stage-${idx}`} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={stage.threshold}
                            onChange={(e) => {
                              let value = e.target.value;
                              // 全角数字を半角に変換
                              value = value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                              // 数字以外を削除
                              value = value.replace(/[^0-9]/g, '');
                              // 先頭の0を削除（ただし空文字や"0"そのものは許容しつつ、変換時に考慮）
                              if (value.length > 1 && value.startsWith('0')) {
                                value = value.replace(/^0+/, '');
                              }
                              
                              const finalValue = value === '' ? 0 : parseInt(value, 10);
                              setPenaltyStages(prev => prev.map(s => s === stage ? { ...s, threshold: finalValue } : s));
                            }}
                            className="w-14 px-1.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-center font-bold bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-[10px] text-slate-500 font-bold">個</span>
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5">
                          <input
                            type="text"
                            value={stage.label || ''}
                            onChange={(e) => {
                              const newLabel = e.target.value;
                              setPenaltyStages(prev => prev.map(s => s === stage ? { ...s, label: newLabel } : s));
                            }}
                            placeholder="罰の名前 (例: 小罰)"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={stage.description || ''}
                            onChange={(e) => {
                              const newDesc = e.target.value;
                              setPenaltyStages(prev => prev.map(s => s === stage ? { ...s, description: newDesc } : s));
                            }}
                            placeholder="内容 (例: 楽器庫の掃除)"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('この段階を削除しますか？')) {
                              setPenaltyStages(prev => prev.filter(s => s !== stage));
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      const maxThreshold = penaltyStages.length > 0 ? Math.max(...penaltyStages.map(s => s.threshold)) : 0;
                      setPenaltyStages(prev => [...prev, { threshold: maxThreshold + 1, label: '', description: '' }]);
                    }}
                    className="w-full py-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 段階を追加する</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                  緊急遽刻の累積スタンプが各個数に達するごとに、その段階の罰ゲームが開放されます。
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      まとめ通知機能の全体有効化
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      OFFにすると、曜日別およびカレンダー設定のすべての配信が一時停止されます
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="checkbox-notifications-enabled"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <button
                type="submit"
                id="btn-save-notification-settings"
                disabled={isSaving}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
              >
                {isSaving ? '保存中...' : '部活動名・全体設定を保存'}
              </button>
            </form>
          </div>

          {/* Admin Section: LINE WORKS Integration */}
          <div
            id="admin-lineworks-settings"
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    LINE WORKS 連携設定（Bot自動通知）
                  </h3>
                  {settings.lineWorks?.enabled && (settings.lineWorks?.webhookUrl || (settings.lineWorks?.clientId && settings.lineWorks?.botId)) ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {settings.lineWorks.mode === 'api2' ? 'API 2.0 連携中' : 'Webhook 連携中'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                      未連携
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  当日の出欠サマリーや遅刻連絡を、LINE WORKSのグループトークへBotが自動投稿します
                </p>
              </div>
            </div>

            {/* Quick action: One-tap copy & share for LINE WORKS */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  本日の出欠サマリーを手動でLINE WORKSに共有
                </span>
                {copiedSummary && (
                  <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    コピー完了！
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Botの登録前や今すぐ手動で共有したい時は、整形済みのテキストをワンタップでコピーしてLINE WORKSに貼り付けできます。
              </p>
              <button
                type="button"
                id="btn-copy-summary-lineworks"
                onClick={handleCopySummaryForLineWorks}
                className="w-full py-2 px-3 bg-white hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-300 shadow-2xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-600" />
                本日の出欠テキストをクリップボードにコピー
              </button>
            </div>

            {/* Save notification */}
            {lwSettingsSaved && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>LINE WORKS設定を保存しました</span>
              </div>
            )}

            {/* Test result feedback */}
            {lwTestResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  lwTestResult.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {lwTestResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <span className="font-bold block">
                    {lwTestResult.type === 'success' ? '完了' : 'エラー'}
                  </span>
                  <p className="text-[11px] leading-relaxed whitespace-pre-line">{lwTestResult.message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveLineWorksSettings} className="space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    LINE WORKS連携（Bot通知）を有効にする
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Bot経由での自動メッセージ送信を許可します
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="checkbox-lineworks-enabled"
                    checked={lwEnabled}
                    onChange={(e) => setLwEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Mode Selector (API 2.0 vs Webhook) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  連携方式を選択
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="btn-mode-api2"
                    onClick={() => setLwMode('api2')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      lwMode === 'api2'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                        API 2.0 (推奨)
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        無料版対応
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      無料プランでも利用可能。LINE WORKS Developer Consoleの認証キーで直接Bot送信します。
                    </p>
                  </button>

                  <button
                    type="button"
                    id="btn-mode-webhook"
                    onClick={() => setLwMode('webhook')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      lwMode === 'webhook'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-blue-600" />
                        Webhook URL
                      </span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        有料版のみ
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Incoming WebhookのURLを指定して送信します（有料プランまたはWebhook対応環境用）。
                    </p>
                  </button>
                </div>
              </div>

              {/* Guide Accordion Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-700">
                  {lwMode === 'api2' ? 'API 2.0 接続設定' : 'Webhook接続設定'}
                </span>
                <button
                  type="button"
                  id="btn-toggle-lw-guide"
                  onClick={() => setShowLwGuide(!showLwGuide)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showLwGuide ? '手順を閉じる' : '設定手順・キー取得方法を確認'}</span>
                </button>
              </div>

              {/* Guide Accordion */}
              {showLwGuide && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-3 text-slate-700">
                  {lwMode === 'api2' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-blue-900 flex items-center gap-1.5 text-xs">
                          <Bot className="w-3.5 h-3.5 text-blue-600" />
                          LINE WORKS API 2.0 の無料プラン設定手順（約3分）
                        </h4>
                        <a
                          href="https://developers.worksmobile.com/jp/console/openapi/v2/app/list/view"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-700 underline flex items-center gap-1 font-medium"
                        >
                          Developer Console <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed text-slate-700">
                        <li>
                          LINE WORKS <strong>Developer Console</strong> に管理者アカウントでログインします。
                        </li>
                        <li>
                          「<strong>API 2.0</strong>」→「<strong>アプリ</strong>」から「<strong>アプリの新規追加</strong>」をクリック。アプリ名（例: 部活出欠アプリ）を入力します。
                        </li>
                        <li>
                          <strong>OAuth Scopes</strong> の「管理」を押し、<code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono text-[10px]">bot</code> または <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono text-[10px]">bot.message</code> にチェックを入れ保存します。
                        </li>
                        <li>
                          <strong>Client ID</strong> と <strong>Client Secret</strong>（発行）をコピーして下記の入力欄に貼り付けます。
                        </li>
                        <li>
                          <strong>Service Account</strong> を「発行」し、表示されたアドレス（例: sa-...@...）を貼り付けます。
                        </li>
                        <li>
                          <strong>Private Key</strong> を「発行/ダウンロード」し、ファイルの中身（<code className="text-[10px] font-mono">-----BEGIN PRIVATE KEY-----...</code>）をすべてコピーして貼り付けます。
                        </li>
                        <li>
                          左メニュー「<strong>Bot</strong>」からBotを作成し（または既存Bot）、トークルーム（グループ）にBotを招待します。そのBotの<strong>Bot ID</strong>とグループトークの<strong>Channel ID</strong>を記入してください。
                        </li>
                      </ol>
                    </>
                  ) : (
                    <>
                      <h4 className="font-bold text-blue-900 flex items-center gap-1.5 text-xs">
                        <Bot className="w-3.5 h-3.5 text-blue-600" />
                        LINE WORKS Webhook URL の設定手順
                      </h4>
                      <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed text-slate-700">
                        <li>LINE WORKSの管理者またはトークルームを開きます。</li>
                        <li>
                          <strong>Developer Console</strong> またはトークルーム設定から「<strong>Bot</strong>」を新規登録し、通知を送りたいグループトークルームに招待します。
                        </li>
                        <li>
                          Botの「<strong>Incoming Webhook</strong>」または「<strong>メッセージ送信URL</strong>」を発行します。
                        </li>
                        <li>
                          発行された <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono text-[10px]">https://...</code> のURLをコピーして下記の入力欄に貼り付けます。
                        </li>
                      </ol>
                    </>
                  )}
                </div>
              )}

              {/* Mode: API 2.0 Form Fields */}
              {lwMode === 'api2' ? (
                <div className="space-y-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Client ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="input-lineworks-clientid"
                        value={lwClientId}
                        onChange={(e) => setLwClientId(e.target.value)}
                        placeholder="例: w1234abcd..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Client Secret <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        id="input-lineworks-clientsecret"
                        value={lwClientSecret}
                        onChange={(e) => setLwClientSecret(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Service Account <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="input-lineworks-serviceaccount"
                      value={lwServiceAccount}
                      onChange={(e) => setLwServiceAccount(e.target.value)}
                      placeholder="例: sa_12345678@example.worksmobile.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Private Key (秘密鍵) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="textarea-lineworks-privatekey"
                      rows={3}
                      value={lwPrivateKey}
                      onChange={(e) => setLwPrivateKey(e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...&#10;-----END PRIVATE KEY-----"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[11px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono leading-tight"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      ダウンロードした秘密鍵ファイルの「-----BEGIN PRIVATE KEY-----」から末尾までを貼り付けます
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Bot ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="input-lineworks-botid"
                        value={lwBotId}
                        onChange={(e) => setLwBotId(e.target.value)}
                        placeholder="例: 1234567"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Channel ID (送信先トークルーム) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="input-lineworks-channelid"
                        value={lwChannelId}
                        onChange={(e) => setLwChannelId(e.target.value)}
                        placeholder="例: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className={`w-full px-3 py-2 rounded-lg border text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono ${
                          lwChannelId.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lwChannelId.trim()) && !lwChannelId.trim().startsWith('c_')
                            ? 'border-amber-400 bg-amber-50/30'
                            : 'border-slate-200'
                        }`}
                      />
                      {lwChannelId.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lwChannelId.trim()) && !lwChannelId.trim().startsWith('c_') && (
                        <p className="text-[9px] text-amber-600 mt-0.5 font-bold flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          形式が UUID ではないようです（通常は 8-4-4-4-12 文字）
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      id="btn-verify-lw-auth"
                      onClick={handleVerifyLineWorksAuth}
                      disabled={lwVerifyingAuth}
                      className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                      {lwVerifyingAuth ? '認証確認中...' : '認証キーのみ接続テスト（トークン発行確認）'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Mode: Webhook Input */
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Bot Webhook URL <span className="text-red-500 font-normal">*</span>
                  </label>
                  <input
                    type="url"
                    id="input-lineworks-webhook"
                    value={lwWebhookUrl}
                    onChange={(e) => setLwWebhookUrl(e.target.value)}
                    placeholder="https://wh.worksmobile.com/... または Botエンドポイント"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    LINE WORKSのトークルームBotまたはIncoming WebhookのURLを入力してください
                  </p>
                </div>
              )}

              {/* Bot Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  通知タイトル内のBot名（任意）
                </label>
                <input
                  type="text"
                  id="input-lineworks-botname"
                  value={lwBotName}
                  onChange={(e) => setLwBotName(e.target.value)}
                  placeholder="例: 部活出欠bot"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Notification Triggers */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-slate-700 block">
                  送信トリガー
                </span>
                
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    id="checkbox-lw-summary"
                    checked={lwSendSummary}
                    onChange={(e) => setLwSendSummary(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">
                      まとめ時刻（{notificationTime}）に当日の出席状況を自動送信
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      欠席者・遅刻者・出席人数・未連絡者一覧をまとめて投稿します
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    id="checkbox-lw-tardy"
                    checked={lwSendTardy}
                    onChange={(e) => setLwSendTardy(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">
                      当日の【緊急遽刻】連絡を受信した時に即時送信
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      「🚨〇〇さんが△時ごろ緊急遽刻します」をリアルタイムに速報投稿します（通常の遅刻はまとめ時刻に集約）
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    id="checkbox-lw-event-reminder"
                    checked={lwSendEventReminder}
                    onChange={(e) => setLwSendEventReminder(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">
                      イベントのリマインダー（3日前・前日・当日）を自動送信
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      イベント（コンクール・本番等）の開催が近づくと、トークルームへリマインドを投稿します。
                      <strong>（※専用のBotを使いたい場合は、下の「イベント専用」設定を使用してください）</strong>
                    </span>
                  </div>
                </label>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button
                  type="submit"
                  id="btn-save-lineworks-settings"
                  disabled={isSaving}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? '保存中...' : 'LINE WORKS設定を保存'}
                </button>

                <button
                  type="button"
                  id="btn-test-lineworks-send"
                  onClick={handleTestLineWorks}
                  disabled={lwTesting}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {lwTesting ? 'LINE WORKSへ送信中...' : '出欠サマリーをテスト送信'}
                </button>
              </div>
            </form>
          </div>

            {/* Admin Section: LINE WORKS Key Reminder Settings (鍵催促専用) */}
            <div
              id="admin-lineworks-kr-settings"
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  【鍵催促専用】LINE WORKS 連携設定
                </h3>
                <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  管理者専用
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                出欠連絡用の連携とは別に、鍵の催促通知だけを別のトークルームやBotに送信したい場合に設定します。
              </p>

              {settings.lastLwKRStatus && !settings.lastLwKRStatus.success && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-xl text-xs flex items-start gap-2 relative group">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="space-y-1 pr-6">
                    <p className="font-bold">自動催促の送信に失敗しました</p>
                    <p className="opacity-90">{settings.lastLwKRStatus.error}</p>
                    {settings.lastLwKRStatus.error?.includes('404') && (
                      <p className="mt-1 font-bold text-amber-900 dark:text-amber-200 bg-amber-100/50 dark:bg-amber-900/30 p-1.5 rounded-lg border border-amber-300/50">
                        【対処法】Channel IDが正しいか、Botがトークルームに招待されているかを確認してください。
                      </p>
                    )}
                    <p className="text-[10px] opacity-70">
                      最終失敗: {new Date(settings.lastLwKRStatus.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ lastLwKRStatus: { ...settings.lastLwKRStatus!, success: true } })}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800 text-red-400 hover:text-red-600 transition-colors"
                    title="このエラーを消す"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {lwKRSettingsSaved && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>鍵催促用のLINE WORKS連携設定を保存しました</span>
                </div>
              )}

              {lwKRTestResult && (
                <div
                  className={`p-2.5 border rounded-xl text-xs flex items-start gap-2 ${
                    lwKRTestResult.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                  }`}
                >
                  {lwKRTestResult.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  )}
                  <span>{lwKRTestResult.message}</span>
                </div>
              )}

              <form onSubmit={handleSaveLineWorksKeyReminderSettings} className="space-y-4">
                <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Client ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lwKRClientId}
                        onChange={(e) => setLwKRClientId(e.target.value)}
                        placeholder="例: u4m12345..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Client Secret <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={lwKRClientSecret}
                        onChange={(e) => setLwKRClientSecret(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Service Account <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lwKRServiceAccount}
                      onChange={(e) => setLwKRServiceAccount(e.target.value)}
                      placeholder="例: sa_12345678@example.worksmobile.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Private Key (秘密鍵) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={lwKRPrivateKey}
                      onChange={(e) => setLwKRPrivateKey(e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono leading-tight"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Bot ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lwKRBotId}
                        onChange={(e) => setLwKRBotId(e.target.value)}
                        placeholder="例: 1234567"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Channel ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lwKRChannelId}
                        onChange={(e) => setLwKRChannelId(e.target.value)}
                        placeholder="例: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className={`w-full px-3 py-2 rounded-lg border text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono ${
                          lwKRChannelId.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lwKRChannelId.trim()) && !lwKRChannelId.trim().startsWith('c_')
                            ? 'border-amber-400 bg-amber-50/30'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      {lwKRChannelId.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lwKRChannelId.trim()) && !lwKRChannelId.trim().startsWith('c_') && (
                        <p className="text-[9px] text-amber-600 mt-0.5 font-bold flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          形式が UUID ではないようです（通常は 8-4-4-4-12 文字）
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleVerifyLineWorksKRAuth}
                      disabled={lwKRVerifyingAuth}
                      className="w-full py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {lwKRVerifyingAuth ? '認証確認中...' : '認証キーのみ接続テスト（トークン発行確認）'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {isSaving ? '保存中...' : '鍵催促用設定を保存'}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestLineWorksKR}
                    disabled={lwKRTesting}
                    className="w-full py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:bg-slate-400 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {lwKRTesting ? '送信中...' : 'テスト催促をLINE WORKSへ送信'}
                  </button>
                </div>
              </form>
            </div>

            {/* Admin Section: LINE WORKS Event Reminder Settings (イベント専用) */}
            <div
              id="admin-lineworks-ev-settings"
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  【イベント専用】LINE WORKS 連携設定
                </h3>
                <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  管理者専用
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                出欠連絡用とは別のBotを使って、コンクールや本番等のイベントリマインドのみを別のトークルームに送信したい場合に設定します。
              </p>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    イベント専用Bot連携を有効にする
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    有効にすると、イベントリマインドはこちらの設定を使用して送信されます
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lwEvEnabled}
                    onChange={(e) => setLwEvEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {lwEvSettingsSaved && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>イベント用のLINE WORKS連携設定を保存しました</span>
                </div>
              )}

              {lwEvTestResult && (
                <div
                  className={`p-2.5 border rounded-xl text-xs flex items-start gap-2 ${
                    lwEvTestResult.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                  }`}
                >
                  {lwEvTestResult.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  )}
                  <span>{lwEvTestResult.message}</span>
                </div>
              )}

              <form onSubmit={handleSaveLineWorksEventsSettings} className="space-y-4">
                <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Client ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lwEvClientId}
                        onChange={(e) => setLwEvClientId(e.target.value)}
                        placeholder="例: w1234abcd..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Client Secret <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={lwEvClientSecret}
                        onChange={(e) => setLwEvClientSecret(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Service Account <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lwEvServiceAccount}
                      onChange={(e) => setLwEvServiceAccount(e.target.value)}
                      placeholder="例: sa_12345678@example.worksmobile.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Private Key (秘密鍵) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={lwEvPrivateKey}
                      onChange={(e) => setLwEvPrivateKey(e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono leading-tight"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Bot ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lwEvBotId}
                        onChange={(e) => setLwEvBotId(e.target.value)}
                        placeholder="例: 1234567"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Channel ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lwEvChannelId}
                        onChange={(e) => setLwEvChannelId(e.target.value)}
                        placeholder="例: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className={`w-full px-3 py-2 rounded-lg border text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono ${
                          lwEvChannelId.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lwEvChannelId.trim()) && !lwEvChannelId.trim().startsWith('c_')
                            ? 'border-amber-400 bg-amber-50/30'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      {lwEvChannelId.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lwEvChannelId.trim()) && !lwEvChannelId.trim().startsWith('c_') && (
                        <p className="text-[9px] text-amber-600 mt-0.5 font-bold flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          形式が UUID ではないようです（通常は 8-4-4-4-12 文字）
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleVerifyLineWorksEventsAuth}
                      disabled={lwEvVerifyingAuth || !lwEvClientId || !lwEvClientSecret || !lwEvServiceAccount || !lwEvPrivateKey}
                      className="w-full py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-indigo-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {lwEvVerifyingAuth ? '認証確認中...' : '認証キーのみ接続テスト（トークン発行確認）'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {isSaving ? '保存中...' : 'イベント用設定を保存'}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestLineWorksEvents}
                    disabled={lwEvTesting}
                    className="w-full py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:bg-slate-400 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {lwEvTesting ? '送信中...' : 'テスト通知をLINE WORKSへ送信'}
                  </button>
                </div>
              </form>
            </div>

            {/* Admin Section: Key Names Settings (2鍵対応) */}
          <div
            id="admin-key-names-settings"
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" />
                部室の鍵の名前設定（2鍵対応）
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                管理者専用
              </span>
            </div>
            <p className="text-xs text-slate-500">
              ホーム画面の「鍵の報告」カードに表示される2つの鍵の名前を変更できます。（初期値: 「鍵①」「鍵②」）
            </p>

            {keyNamesSaved && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>鍵の名前を保存しました。ホーム画面に即時反映されます。</span>
              </div>
            )}

            <form onSubmit={handleSaveKeyNames} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  鍵① の名前
                </label>
                <input
                  type="text"
                  id="input-key1-name"
                  value={key1NameInput}
                  onChange={(e) => setKey1NameInput(e.target.value)}
                  placeholder="例: 鍵①（正面玄関）"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  鍵② の名前
                </label>
                <input
                  type="text"
                  id="input-key2-name"
                  value={key2NameInput}
                  onChange={(e) => setKey2NameInput(e.target.value)}
                  placeholder="例: 鍵②（楽器庫）"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <button
                type="submit"
                id="btn-save-key-names"
                disabled={isSaving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {isSaving ? '保存中...' : '鍵の名前を保存する'}
              </button>
            </form>
          </div>

          {/* Admin Section: Key Reminders Settings (鍵の催促通知設定) */}
          <div
            id="admin-key-reminders-settings"
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-600" />
                鍵の催促通知設定（閉め忘れ防止）
              </h3>
              <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                管理者専用
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              設定した時刻になっても施錠報告がない場合、自動で部員全員へ催促通知を送信します。
              どちらか一方でも未報告であれば通知され、両方報告されると自動で停止します。
            </p>

            {keyRemindersSaved && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>鍵の催促設定を保存しました。設定時刻に合わせて自動監視されます。</span>
              </div>
            )}

            {settingsError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{settingsError}</span>
              </div>
            )}

            {testReminderToast && (
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{testReminderToast}</span>
              </div>
            )}

            <form onSubmit={handleSaveKeyReminders} className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    鍵の催促機能を有効にする
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {keyReminderEnabled ? '有効' : '無効'}
                    </span>
                    <input
                      type="checkbox"
                      id="checkbox-key-reminder-enabled"
                      checked={keyReminderEnabled}
                      onChange={(e) => setKeyReminderEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>

                {keyReminderEnabled && (
                  <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    {/* 通知の切り替え設定 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer text-xs transition-colors">
                        <input
                          type="checkbox"
                          checked={keyAppEnabled}
                          onChange={(e) => setKeyAppEnabled(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">アプリ内プッシュ通知</span>
                      </label>
                      <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer text-xs transition-colors">
                        <input
                          type="checkbox"
                          checked={keyLwEnabled}
                          onChange={(e) => setKeyLwEnabled(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">LINE WORKSへの通知</span>
                      </label>
                    </div>

                    {/* 催促する日の条件設定 */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer text-xs transition-colors">
                        <input
                          type="checkbox"
                          checked={keyReminderOnlyActiveDays}
                          onChange={(e) => setKeyReminderOnlyActiveDays(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200">出欠確認（まとめ通知）がオンの日のみ催促する</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            部活休み（通知OFF）やカレンダーで休みに設定した日は催促を行いません。
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                          催促を開始する時刻
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer mb-2">
                            <input
                              type="checkbox"
                              checked={keyReminderUseSummaryTime}
                              onChange={(e) => setKeyReminderUseSummaryTime(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                              まとめ通知と同じ時刻にする
                            </span>
                          </label>
                          <TimePulldown
                            value={keyReminderStartTime}
                            onChange={setKeyReminderStartTime}
                            disabled={keyReminderUseSummaryTime}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                          催促を送る間隔
                        </label>
                        <select
                          value={keyReminderInterval}
                          onChange={(e) => setKeyReminderInterval(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer appearance-none"
                        >
                          <option value={10}>10分おき</option>
                          <option value={15}>15分おき（推奨）</option>
                          <option value={20}>20分おき</option>
                          <option value={30}>30分おき</option>
                          <option value={45}>45分おき</option>
                          <option value={60}>60分おき（1時間）</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                          最大催促回数
                        </label>
                        <select
                          value={keyReminderMaxCount}
                          onChange={(e) => setKeyReminderMaxCount(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer appearance-none"
                        >
                          <option value={1}>1回のみ</option>
                          <option value={2}>2回まで</option>
                          <option value={3}>3回まで（推奨）</option>
                          <option value={4}>4回まで</option>
                          <option value={5}>5回まで</option>
                          <option value={10}>10回まで</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleSendTestKeyReminder}
                        className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        テスト催促通知を1回送信
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 注意事項 */}
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5 transition-colors">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  催促通知の動作仕様
                </p>
                <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-300 opacity-90">
                  <li>どちらか片方の鍵でも未報告なら催促が送られます。</li>
                  <li>両方の鍵が「閉めました」と報告された時点で、その日の催促は自動停止します。</li>
                  <li>深夜・早朝（0:00〜6:00）は催促通知が自動的に抑制されます。</li>
                  <li>設定した最大催促回数に達すると、以降の再催促は自動停止します。</li>
                </ul>
              </div>

              <button
                type="submit"
                id="btn-save-key-reminders"
                disabled={isSaving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                {isSaving ? '保存中...' : '催促設定を保存する'}
              </button>
            </form>
          </div>

          {/* Admin Section: Key Reset Settings (鍵報告のリセット設定) */}
          <div
            id="admin-key-reset-settings"
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-slate-500" />
                鍵報告のリセット・自動リセット設定
              </h3>
              <span className="text-[10px] font-bold bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                管理者専用
              </span>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  id="checkbox-key-reset-admin-only"
                  checked={keyResetAdminOnly}
                  onChange={(e) => setKeyResetAdminOnly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-xs font-bold text-slate-800 block">
                    鍵のリセット操作を管理者のみに制限する
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    オフの場合、すべての部員がリセットボタンを操作できます（デフォルトは全員可）
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  id="checkbox-auto-reset-midnight"
                  checked={autoResetKeysAtMidnight}
                  onChange={(e) => setAutoResetKeysAtMidnight(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-xs font-bold text-slate-800 block">
                    深夜0時に鍵の状態を自動でリセットする
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    翌日の連絡漏れを防ぐため、毎日00:00に「未報告」状態に戻します
                  </span>
                </div>
              </label>
              
              <p className="text-[10px] text-slate-400 px-1 italic">
                ※ 設定を保存するには、上の「鍵の催促設定を保存する」または下の「設定を保存」ボタンを押してください。
              </p>
            </div>
          </div>

          {/* Admin Section: Auto Attendance Settings (出席の自動記録設定) */}
          <div
            id="admin-auto-attendance-settings"
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                出席の自動記録設定
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                管理者専用
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              ユーザーが明示的に送信しなくても、条件に合わせて自動的に「出席」を記録します。
              すでに欠席や遅刻の連絡がある場合は上書きされません。
            </p>

            {autoAttSaved && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>自動出席設定を保存しました。</span>
              </div>
            )}

            <form onSubmit={handleSaveAutoAttendanceSettings} className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={autoAttEnabled}
                    onChange={(e) => setAutoAttEnabled(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">自動出席記録を有効にする</span>
                  </div>
                </label>

                {autoAttEnabled && (
                  <div className="pl-7 space-y-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">実行タイミング</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAutoAttMode('on_app_open')}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            autoAttMode === 'on_app_open'
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="text-xs font-bold mb-0.5">アプリ起動時</div>
                          <div className="text-[10px] opacity-80">その日初めてアプリを開いた時に記録</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAutoAttMode('at_specific_time')}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            autoAttMode === 'at_specific_time'
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="text-xs font-bold mb-0.5">設定時刻（一括）</div>
                          <div className="text-[10px] opacity-80">指定した時刻に未連絡者を一括記録</div>
                        </button>
                      </div>
                    </div>

                    {autoAttMode === 'at_specific_time' && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">記録を実行する時刻</label>
                        <TimePulldown value={autoAttTime} onChange={setAutoAttTime} />
                        <p className="text-[10px] text-slate-500">
                          ※ この時刻に誰かがアプリを開いているか、その後に初めて誰かが開いたタイミングで実行されます。
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {isSaving ? '保存中...' : '自動出席設定を保存'}
              </button>
            </form>
          </div>

          {/* Admin Section 2: Change Passcode */}
          <div
            id="admin-passcode-settings"
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3"
          >
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              合言葉の変更
            </h3>
            <p className="text-xs text-slate-500">
              現在の合言葉: <span className="font-mono font-bold text-slate-700">{settings.adminPasscode || 'admin1234'}</span>
            </p>

            {passcodeSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{passcodeSuccess}</span>
              </div>
            )}
            {passcodeChangeError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>{passcodeChangeError}</span>
              </div>
            )}

            <form onSubmit={handleChangePasscode} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  新しい合言葉（4文字以上）
                </label>
                <input
                  type="text"
                  id="input-new-passcode"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  placeholder="新しい合言葉を入力"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  新しい合言葉（確認用）
                </label>
                <input
                  type="text"
                  id="input-confirm-passcode"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="もう一度入力"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                id="btn-update-passcode"
                disabled={isSaving}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-600 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
              >
                {isSaving ? '保存中...' : '合言葉を変更する'}
              </button>
            </form>
          </div>

          {/* Admin Section 3: Member Management (Add & Delete) */}
          <div
            id="admin-member-management"
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                部員の管理
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">
                  現在 {members.length}名
                </span>
                {members.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllMembers}
                    className="text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 font-bold transition-colors"
                  >
                    全員一括削除
                  </button>
                )}
              </div>
            </div>

            {memberError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>{memberError}</span>
              </div>
            )}

            {/* Add Member Form */}
            <form onSubmit={handleAddMember} className="space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                新しい部員を追加
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  id="input-add-member-name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="部員名（氏名）"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="text"
                  id="input-add-member-grade"
                  value={newMemberGrade}
                  onChange={(e) => setNewMemberGrade(e.target.value)}
                  placeholder="学年 (例: 1年)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Section & Part Selectors for New Member */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  id="select-add-member-section"
                  value={newMemberSection}
                  onChange={(e) => {
                    const sec = e.target.value;
                    setNewMemberSection(sec);
                    const availableParts = sec ? SECTION_PARTS_MAP[sec as SectionCategory] || [] : [];
                    if (!availableParts.includes(newMemberPart)) {
                      setNewMemberPart(availableParts[0] || '');
                    }
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">区分を選択（任意）...</option>
                  {SECTION_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  id="select-add-member-part"
                  value={newMemberPart}
                  onChange={(e) => setNewMemberPart(e.target.value)}
                  disabled={!newMemberSection}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">
                    {newMemberSection ? '詳細パートを選択...' : '先に区分を選択'}
                  </option>
                  {newMemberSection &&
                    (SECTION_PARTS_MAP[newMemberSection as SectionCategory] || []).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="submit"
                id="btn-add-member"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                部員を追加する
              </button>
            </form>

            {/* Current Members List */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
              {members.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  部員が登録されていません。上のフォームから追加してください。
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="py-2 flex items-center justify-between text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{m.name}</span>
                      {m.part ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold border border-blue-200 dark:border-blue-800">
                          {m.part}
                        </span>
                      ) : m.section ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                          {m.section}
                        </span>
                      ) : null}
                      {m.grade && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium">
                          {m.grade}
                        </span>
                      )}
                      {m.role && m.role !== '部員' && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-semibold border border-amber-200 dark:border-amber-800">
                          {m.role}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteMember(m.id, m.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                      title="削除"
                      aria-label={`${m.name}を削除`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 3. When NOT logged in as Admin: Inconspicuous Admin Login Section at bottom */
        <div className="pt-6">
          <div className="border-t border-slate-200 pt-4 text-center">
            {!showAdminSection ? (
              <button
                id="btn-toggle-admin-login"
                onClick={() => setShowAdminSection(true)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 py-2 px-3 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>管理者メニュー</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div
                id="admin-login-card"
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-3 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    管理者ログイン（合言葉方式）
                  </h4>
                  <button
                    onClick={() => setShowAdminSection(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  管理者の合言葉を入力してください（初期値: admin1234）
                </p>

                {passcodeError && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passcodeError}</span>
                  </div>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-2.5">
                  <input
                    type="password"
                    id="input-admin-passcode"
                    value={passcodeAttempt}
                    onChange={(e) => setPasscodeAttempt(e.target.value)}
                    placeholder="合言葉を入力"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required
                  />

                  <button
                    type="submit"
                    id="btn-submit-admin-login"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
                  >
                    管理者としてログイン
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pattern Manager Modal */}
      <PatternManagerModal
        isOpen={isPatternModalOpen}
        onClose={() => setIsPatternModalOpen(false)}
        patterns={patterns}
        onSavePatterns={savePatterns}
      />

      {/* Notification Guide Modal */}
      <NotificationGuideModal
        isOpen={notifGuideOpen}
        onClose={() => setNotifGuideOpen(false)}
        reason={notifGuideReason}
        onTestNotification={sendTestNotification}
      />

      {/* PWA Install Guide Modal */}
      {showPwaGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                ホーム画面への追加方法
              </h4>
              <button
                onClick={() => setShowPwaGuide(false)}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                  iPhone / Safari の場合
                </p>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pl-7">
                  1. 画面下部の<Share2 className="w-3.5 h-3.5 inline mx-1" /><strong>共有ボタン</strong>をタップ
                  <br />
                  2. メニューを下にスクロール
                  <br />
                  3. <strong>「ホーム画面に追加」</strong>をタップ
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                  Android / Chrome の場合
                </p>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pl-7">
                  1. 右上の<span className="font-bold">「︙」メニュー</span>をタップ
                  <br />
                  2. <strong>「アプリをインストール」</strong>または<br /><strong>「ホーム画面に追加」</strong>をタップ
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPwaGuide(false)}
              className="w-full py-3 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
            >
              わかりました
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
