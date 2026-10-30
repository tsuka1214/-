import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  User,
  Shield,
  Key,
  BellRing,
  Bot,
  Send,
  Check,
  CheckCircle2,
  AlertCircle,
  Users,
  Trash2,
  Plus,
  KeyRound,
  Activity,
  Zap,
  Sparkles,
  Sliders,
  RefreshCw,
  Megaphone,
  CalendarCheck,
  CalendarDays,
  Clock,
  Lock,
  RotateCcw,
  Server,
} from 'lucide-react';
import { WeeklyScheduleDay } from '../types';
import {
  DEFAULT_WEEKLY_SCHEDULE,
  DAY_NAMES,
  DAY_FULL_NAMES,
  resolveScheduleForDate,
} from '../constants/schedule';
import { getTodayString, formatJapaneseDate, formatTimestamp } from '../utils/date';
import { SECTIONS_AND_PARTS, getPartsForSection } from '../constants/parts';
import {
  verifyLineWorksApi2Auth,
  sendLineWorksNotification,
  fetchLineWorksConfigFromFirestore,
  saveLineWorksConfigToFirestore,
  resolveEffectiveLineWorksConfig,
  type LineWorksVerifyResult,
} from '../utils/lineworks';
import { LineWorksMultiBotSettings } from './LineWorksMultiBotSettings';
import { AttendancePatternsEditor } from './AttendancePatternsEditor';

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateSettings,
    saveLineWorksSettings,
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
    setMyMemberProfile,
    cleanupKeyReportData,
    keyReminderDebug,
    forceCheckKeyReminders,
    sendLineWorksKeyReminderTest,
    sendLineWorksKeyReportTest,
    sendLineWorksEventReminderTest,
    sendLineWorksTestSummary,
    sendBroadcastNotification,
  } = useApp();

  // User Profile
  const getSafeUserName = (raw?: string) => {
    if (!raw || raw === '部員' || raw === '齋藤凌吾' || raw === '名前未登録' || !raw.trim()) {
      return '今江司';
    }
    return raw.trim();
  };

  const [userNameInput, setUserNameInput] = useState<string>(() => getSafeUserName(myMemberName));
  const [userSectionInput, setUserSectionInput] = useState<string>(myMemberSection || '木管');
  const [userPartInput, setUserPartInput] = useState<string>(myMemberPart || 'サックス');
  const [profileSaved, setProfileSaved] = useState<boolean>(false);

  // 鍵報告クリーンアップ
  const [isCleaningUp, setIsCleaningUp] = useState<boolean>(false);
  const [cleanupResultMsg, setCleanupResultMsg] = useState<string | null>(null);

  // 施錠報告 LINE WORKS テスト送信
  const [keyReportTesting, setKeyReportTesting] = useState<boolean>(false);
  const [keyReportTestMsg, setKeyReportTestMsg] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    setUserNameInput(getSafeUserName(myMemberName));
    setUserSectionInput(myMemberSection || '木管');
    setUserPartInput(myMemberPart || 'サックス');
  }, [myMemberName, myMemberSection, myMemberPart]);

  // Admin Auth
  const [passcodeAttempt, setPasscodeAttempt] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string>('');
  const [newPasscodeInput, setNewPasscodeInput] = useState<string>('');
  const [passcodeChangeMsg, setPasscodeChangeMsg] = useState<string | null>(null);

  // General Settings
  const [clubName, setClubName] = useState<string>(settings.clubName || '吹奏楽部');
  const [autoResetKeys, setAutoResetKeys] = useState<boolean>(settings.autoResetKeysAtMidnight !== false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Attendance Confirmation & Daily Summary Schedule Settings (出欠確認・配信スケジュール時間設定)
  const [summaryNotificationTime, setSummaryNotificationTime] = useState<string>(
    settings.summaryNotificationTime || '13:40'
  );
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, WeeklyScheduleDay>>(
    settings.weeklyNotificationSchedule || DEFAULT_WEEKLY_SCHEDULE
  );
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState<boolean>(false);

  const todayDateStr = getTodayString();
  const todayResolvedSchedule = resolveScheduleForDate(todayDateStr, settings);
  const currentDayOfWeek = new Date().getDay();

  // Broadcast Notification (全体通知・一斉送信)
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastSendToLw, setBroadcastSendToLw] = useState<boolean>(true);
  const [broadcastSending, setBroadcastSending] = useState<boolean>(false);
  const isBroadcastSendingRef = useRef<boolean>(false);
  const [broadcastSuccessMsg, setBroadcastSuccessMsg] = useState<string | null>(null);
  const [broadcastErrorMsg, setBroadcastErrorMsg] = useState<string | null>(null);

  // Manual Daily Summary Send (日報まとめ手動送信)
  const [summarySending, setSummarySending] = useState<boolean>(false);
  const isSummarySendingRef = useRef<boolean>(false);
  const [summarySuccessMsg, setSummarySuccessMsg] = useState<string | null>(null);
  const [summaryErrorMsg, setSummaryErrorMsg] = useState<string | null>(null);

  // Event Notification (イベント通知リマインダー)
  const [evReminderEnabled, setEvReminderEnabled] = useState<boolean>(settings.lineWorksEvents?.enabled ?? true);
  const [evTesting, setEvTesting] = useState<boolean>(false);
  const [evTestSuccessMsg, setEvTestSuccessMsg] = useState<string | null>(null);
  const [evTestErrorMsg, setEvTestErrorMsg] = useState<string | null>(null);

  // Key Names
  const [key1NameInput, setKey1NameInput] = useState<string>(settings.keyNames?.key1 || '鍵①');
  const [key2NameInput, setKey2NameInput] = useState<string>(settings.keyNames?.key2 || '鍵②');
  const [keyNamesSaved, setKeyNamesSaved] = useState<boolean>(false);

  // Key Reminders Settings
  const [keyReminderEnabled, setKeyReminderEnabled] = useState<boolean>(settings.keyReminders?.enabled ?? false);
  const [keyReminderStartTime, setKeyReminderStartTime] = useState<string>(settings.keyReminders?.startTime || '18:00');
  const [keyReminderInterval, setKeyReminderInterval] = useState<number>(settings.keyReminders?.intervalMinutes || 15);
  const [keyReminderMaxCount, setKeyReminderMaxCount] = useState<number>(settings.keyReminders?.maxCount || 3);
  const [keyReminderOnlyActiveDays, setKeyReminderOnlyActiveDays] = useState<boolean>(settings.keyReminders?.onlyOnActiveDays ?? false);
  const [keyReminderUseSummaryTime, setKeyReminderUseSummaryTime] = useState<boolean>(settings.keyReminders?.useSummaryTime ?? false);
  const [keyReminderAppNotif, setKeyReminderAppNotif] = useState<boolean>(settings.keyReminders?.appNotificationEnabled !== false);
  const [keyReminderLwNotif, setKeyReminderLwNotif] = useState<boolean>(settings.keyReminders?.lineWorksNotificationEnabled ?? false);
  const [keyReminderMidnightSuppression, setKeyReminderMidnightSuppression] = useState<boolean>(settings.keyReminders?.midnightSuppressionEnabled !== false);
  const [keyRemindersSaved, setKeyRemindersSaved] = useState<boolean>(false);
  const [testReminderToast, setTestReminderToast] = useState<string | null>(null);

  // LINE WORKS
  const [lwEnabled, setLwEnabled] = useState<boolean>(settings.lineWorks?.enabled ?? false);
  const [lwMode, setLwMode] = useState<'webhook' | 'api2'>(settings.lineWorks?.mode || 'webhook');
  const [lwWebhookUrl, setLwWebhookUrl] = useState<string>(settings.lineWorks?.webhookUrl || '');
  const [lwClientId, setLwClientId] = useState<string>(settings.lineWorks?.clientId || '');
  const [lwClientSecret, setLwClientSecret] = useState<string>(settings.lineWorks?.clientSecret || '');
  const [lwServiceAccount, setLwServiceAccount] = useState<string>(settings.lineWorks?.serviceAccount || '');
  const [lwPrivateKey, setLwPrivateKey] = useState<string>(settings.lineWorks?.privateKey || '');
  const [lwBotId, setLwBotId] = useState<string>(settings.lineWorks?.botId || '');
  const [lwChannelId, setLwChannelId] = useState<string>(settings.lineWorks?.channelId || '');
  const [lwSendSummary, setLwSendSummary] = useState<boolean>(settings.lineWorks?.sendDailySummary !== false);
  const [lwSendTardy, setLwSendTardy] = useState<boolean>(settings.lineWorks?.sendTardyAlert !== false);
  const [lwServerId, setLwServerId] = useState<string>(settings.lineWorks?.serverId || '40170745');

  // LINE WORKS Verification and Test States
  const [lwVerifying, setLwVerifying] = useState<boolean>(false);
  const [lwVerifyResult, setLwVerifyResult] = useState<LineWorksVerifyResult | null>(null);
  const [lwSaved, setLwSaved] = useState<boolean>(false);
  const [lwTestingSend, setLwTestingSend] = useState<boolean>(false);
  const [lwTestSuccessMsg, setLwTestSuccessMsg] = useState<string | null>(null);
  const [lwTestErrorMsg, setLwTestErrorMsg] = useState<string | null>(null);

  // Members Form
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberGrade, setNewMemberGrade] = useState<string>('1年');
  const [newMemberSection, setNewMemberSection] = useState<string>('木管');
  const [newMemberPart, setNewMemberPart] = useState<string>('フルート/ピッコロ');

  // PWA Cache Management
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);

  const handleForceClearCache = async () => {
    setIsClearingCache(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.active) {
            reg.active.postMessage({ type: 'CLEAR_CACHE' });
          }
          await reg.update().catch(() => {});
        }
      }
      try {
        sessionStorage.setItem('sw_just_reloaded', '1');
      } catch {
        // ignore
      }
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  // 【重要: 要件1】アプリ起動時およびFirestore更新時に、保存された設定値を確実に同期・復元
  useEffect(() => {
    if (settings.keyReminders) {
      setKeyReminderEnabled(settings.keyReminders.enabled ?? false);
      if (settings.keyReminders.startTime) setKeyReminderStartTime(settings.keyReminders.startTime);
      if (settings.keyReminders.intervalMinutes) setKeyReminderInterval(settings.keyReminders.intervalMinutes);
      if (settings.keyReminders.maxCount) setKeyReminderMaxCount(settings.keyReminders.maxCount);
      setKeyReminderOnlyActiveDays(settings.keyReminders.onlyOnActiveDays ?? false);
      setKeyReminderUseSummaryTime(settings.keyReminders.useSummaryTime ?? false);
      setKeyReminderAppNotif(settings.keyReminders.appNotificationEnabled !== false);
      setKeyReminderLwNotif(settings.keyReminders.lineWorksNotificationEnabled ?? false);
      setKeyReminderMidnightSuppression(settings.keyReminders.midnightSuppressionEnabled !== false);
    }
    if (settings.keyNames) {
      setKey1NameInput(settings.keyNames.key1 || '鍵①');
      setKey2NameInput(settings.keyNames.key2 || '鍵②');
    }
    if (settings.clubName) setClubName(settings.clubName);
    if (settings.summaryNotificationTime) setSummaryNotificationTime(settings.summaryNotificationTime);
    if (settings.weeklyNotificationSchedule) setWeeklySchedule(settings.weeklyNotificationSchedule);
    if (settings.autoResetKeysAtMidnight !== undefined) setAutoResetKeys(settings.autoResetKeysAtMidnight);
    if (settings.lineWorksEvents?.enabled !== undefined) {
      setEvReminderEnabled(settings.lineWorksEvents.enabled);
    } else if (settings.lineWorks?.sendEventReminder !== undefined) {
      setEvReminderEnabled(settings.lineWorks.sendEventReminder);
    }

    // LINE WORKS設定の同期
    if (settings.lineWorks) {
      setLwEnabled(settings.lineWorks.enabled ?? false);
      setLwMode(settings.lineWorks.mode || 'webhook');
      setLwWebhookUrl(settings.lineWorks.webhookUrl || '');
      setLwClientId(settings.lineWorks.clientId || '');
      setLwClientSecret(settings.lineWorks.clientSecret || '');
      setLwServiceAccount(settings.lineWorks.serviceAccount || '');
      setLwPrivateKey(settings.lineWorks.privateKey || '');
      setLwBotId(settings.lineWorks.botId || '');
      setLwChannelId(settings.lineWorks.channelId || '');
      setLwServerId(settings.lineWorks.serverId || '40170745');
      setLwSendSummary(settings.lineWorks.sendDailySummary !== false);
      setLwSendTardy(settings.lineWorks.sendTardyAlert !== false);
    }
  }, [settings]);

  // 管理者ログイン時にFirestoreの専用ドキュメント settings/lineworks より最新設定を直接取得
  useEffect(() => {
    if (isAdmin) {
      fetchLineWorksConfigFromFirestore().then((firestoreCfg) => {
        if (firestoreCfg) {
          if (firestoreCfg.clientId !== undefined) setLwClientId(firestoreCfg.clientId);
          if (firestoreCfg.clientSecret !== undefined) setLwClientSecret(firestoreCfg.clientSecret);
          if (firestoreCfg.serviceAccount !== undefined) setLwServiceAccount(firestoreCfg.serviceAccount);
          if (firestoreCfg.privateKey !== undefined) setLwPrivateKey(firestoreCfg.privateKey);
          if (firestoreCfg.botId !== undefined) setLwBotId(firestoreCfg.botId);
          if (firestoreCfg.channelId !== undefined) setLwChannelId(firestoreCfg.channelId);
          if (firestoreCfg.serverId !== undefined) setLwServerId(firestoreCfg.serverId || '40170745');
          if (firestoreCfg.enabled !== undefined) setLwEnabled(firestoreCfg.enabled);
          if (firestoreCfg.mode !== undefined) setLwMode(firestoreCfg.mode);
          if (firestoreCfg.webhookUrl !== undefined) setLwWebhookUrl(firestoreCfg.webhookUrl);
          if (firestoreCfg.sendDailySummary !== undefined) setLwSendSummary(firestoreCfg.sendDailySummary);
          if (firestoreCfg.sendTardyAlert !== undefined) setLwSendTardy(firestoreCfg.sendTardyAlert);
        }
      }).catch((err) => {
        console.warn('Firestore settings/lineworks 取得時エラー:', err);
      });
    }
  }, [isAdmin]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (userNameInput.trim()) {
      setMyMemberProfile(userNameInput.trim(), userSectionInput, userPartInput);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    const success = loginAdmin(passcodeAttempt);
    if (success) {
      setPasscodeAttempt('');
    } else {
      setPasscodeError('合言葉が違います');
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings({
        clubName: clubName.trim() || '吹奏楽部',
        summaryNotificationTime,
        autoResetKeysAtMidnight: autoResetKeys,
      });
      setSaveSuccessMsg('全体設定を保存しました');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWeeklyDayChange = (dayIndex: number, field: keyof WeeklyScheduleDay, val: any) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayIndex]: {
        ...(prev[dayIndex] || DEFAULT_WEEKLY_SCHEDULE[dayIndex] || { enabled: true, time: '18:00', label: '放課後練習' }),
        [field]: val,
      },
    }));
  };

  const handleApplyBaseTimeToAllDays = () => {
    setWeeklySchedule((prev) => {
      const next: Record<number, WeeklyScheduleDay> = {};
      for (let i = 0; i <= 6; i++) {
        const cur = prev[i] || DEFAULT_WEEKLY_SCHEDULE[i] || { enabled: i !== 0, time: summaryNotificationTime };
        next[i] = {
          ...cur,
          time: summaryNotificationTime,
        };
      }
      return next;
    });
  };

  const handleResetWeeklyScheduleToDefault = () => {
    setWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE);
  };

  const handleSaveSchedule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setScheduleSaving(true);
    try {
      // 基本時刻が設定された場合、未カスタマイズの曜日にも反映
      const updatedSchedule: Record<number, WeeklyScheduleDay> = {};
      for (let i = 0; i <= 6; i++) {
        const cur = weeklySchedule[i] || DEFAULT_WEEKLY_SCHEDULE[i];
        updatedSchedule[i] = {
          ...cur,
          time: cur.time && cur.time !== '18:00' ? cur.time : summaryNotificationTime,
        };
      }

      await updateSettings({
        summaryNotificationTime,
        weeklyNotificationSchedule: updatedSchedule,
        autoAttendance: {
          enabled: false,
          mode: 'on_app_open',
        },
      });
      setScheduleSavedMsg('出欠確認・配信スケジュール設定（時間設定）を保存しました！');
      setTimeout(() => setScheduleSavedMsg(null), 3500);
    } catch (err: any) {
      alert(`保存に失敗しました: ${err.message}`);
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasscodeInput.trim()) return;
    try {
      await updateSettings({ adminPasscode: newPasscodeInput.trim() });
      setPasscodeChangeMsg('管理者合言葉を変更しました');
      setNewPasscodeInput('');
      setTimeout(() => setPasscodeChangeMsg(null), 3000);
    } catch (err: any) {
      alert(`合言葉の変更に失敗しました: ${err.message}`);
    }
  };

  // 全体通知の一斉送信（連打・多重送信を完全に防止）
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBroadcastSendingRef.current || broadcastSending) {
      console.warn('[Broadcast] 一斉送信が現在進行中のため、多重クリックをブロックしました');
      return;
    }

    const cleanTitle = broadcastTitle.trim();
    const cleanMessage = broadcastMessage.trim();
    if (!cleanTitle || !cleanMessage) return;

    isBroadcastSendingRef.current = true;
    setBroadcastSending(true);
    setBroadcastSuccessMsg(null);
    setBroadcastErrorMsg(null);

    try {
      console.log(`[Broadcast] 🚀 全体通知一斉送信を開始: title="${cleanTitle}", sendToLw=${broadcastSendToLw}`);
      const res = await sendBroadcastNotification(
        cleanTitle,
        cleanMessage,
        broadcastSendToLw
      );
      if (res.success) {
        setBroadcastSuccessMsg(
          res.lwSent
            ? '全体通知を部員全員（アプリ内）およびLINE WORKSへ一斉送信しました！'
            : '全体通知を部員全員へ送信しました（通知一覧に登録完了）。'
        );
        setBroadcastTitle('');
        setBroadcastMessage('');
        setTimeout(() => setBroadcastSuccessMsg(null), 5000);
        console.log('[Broadcast] ✅ 全体通知一斉送信が正常に完了しました');
      } else {
        setBroadcastErrorMsg(res.error || '送信に失敗しました');
        console.error('[Broadcast] ❌ 全体通知一斉送信失敗:', res.error);
      }
    } catch (err: any) {
      console.error('[Broadcast] ❌ 全体通知例外エラー:', err);
      setBroadcastErrorMsg(err.message || '送信エラーが発生しました');
    } finally {
      isBroadcastSendingRef.current = false;
      setBroadcastSending(false);
    }
  };

  // 日報まとめ手動送信（連打防止ガード付き）
  const handleSendManualSummary = async () => {
    if (isSummarySendingRef.current || summarySending) {
      console.warn('[DailySummary] 日報送信が現在進行中のため多重クリックをブロックしました');
      return;
    }

    isSummarySendingRef.current = true;
    setSummarySending(true);
    setSummarySuccessMsg(null);
    setSummaryErrorMsg(null);

    try {
      console.log('[DailySummary] 🚀 日報まとめ（出欠集計）の手動即時配信を開始...');
      const res = await sendLineWorksTestSummary();
      if (res.success) {
        setSummarySuccessMsg('本日の出欠集計（日報）をLINE WORKSへ送信しました！');
        setTimeout(() => setSummarySuccessMsg(null), 5000);
        console.log('[DailySummary] ✅ 日報まとめの手動送信完了');
      } else {
        setSummaryErrorMsg(res.error || '送信に失敗しました。LINE WORKS連携がONか確認してください。');
        console.error('[DailySummary] ❌ 日報まとめ送信失敗:', res.error);
      }
    } catch (err: any) {
      console.error('[DailySummary] ❌ 日報まとめ例外エラー:', err);
      setSummaryErrorMsg(err.message || '送信エラーが発生しました');
    } finally {
      isSummarySendingRef.current = false;
      setSummarySending(false);
    }
  };

  // 鍵の報告履歴クリーンアップ（デバッグ・データ是正用）
  const handleCleanupKeyReports = async () => {
    setIsCleaningUp(true);
    setCleanupResultMsg(null);
    try {
      const res = await cleanupKeyReportData();
      setCleanupResultMsg(res.message);
      setTimeout(() => setCleanupResultMsg(null), 6000);
    } catch (err: any) {
      alert(`クリーンアップに失敗しました: ${err.message}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  // 施錠報告 LINE WORKS テスト送信
  const handleSendKeyReportTest = async () => {
    setKeyReportTesting(true);
    setKeyReportTestMsg(null);
    try {
      const res = await sendLineWorksKeyReportTest();
      if (res.success) {
        setKeyReportTestMsg({
          success: true,
          text: '施錠報告のLINE WORKSテスト送信に成功しました！トークルームをご確認ください。',
        });
      } else {
        setKeyReportTestMsg({
          success: false,
          text: res.error || '施錠報告のLINE WORKS送信に失敗しました',
        });
      }
      setTimeout(() => setKeyReportTestMsg(null), 6000);
    } catch (err: any) {
      setKeyReportTestMsg({ success: false, text: `送信エラー: ${err.message}` });
    } finally {
      setKeyReportTesting(false);
    }
  };

  // イベント通知テスト送信
  const handleSendEventReminderTest = async () => {
    setEvTesting(true);
    setEvTestSuccessMsg(null);
    setEvTestErrorMsg(null);
    try {
      const res = await sendLineWorksEventReminderTest();
      if (res.success) {
        setEvTestSuccessMsg('イベント通知のテスト送信に成功しました！トークルームをご確認ください。');
        setTimeout(() => setEvTestSuccessMsg(null), 5000);
      } else {
        setEvTestErrorMsg(res.error || '送信に失敗しました。LINE WORKS連携をONにしてからお試しください。');
      }
    } catch (err: any) {
      setEvTestErrorMsg(err.message || '送信エラー');
    } finally {
      setEvTesting(false);
    }
  };

  // イベント通知設定の保存
  const handleSaveEventReminder = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        lineWorksEvents: {
          ...(settings.lineWorksEvents || settings.lineWorks || { enabled: true, mode: 'api2' }),
          enabled: evReminderEnabled,
        },
      });
      setEvTestSuccessMsg('イベント通知設定を保存しました');
      setTimeout(() => setEvTestSuccessMsg(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveKeyNames = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } finally {
      setIsSaving(false);
    }
  };

  // 【重要: 要件1 & 2】スイッチ変更時に即座にFirestore/AppContextへ保存・同期するハンドラー
  const handleToggleKeyReminder = async (checked: boolean) => {
    setKeyReminderEnabled(checked);
    try {
      await updateSettings({
        keyReminders: {
          ...(settings.keyReminders || {}),
          enabled: checked,
          startTime: keyReminderStartTime,
          intervalMinutes: Number(keyReminderInterval),
          maxCount: Number(keyReminderMaxCount),
          onlyOnActiveDays: Boolean(keyReminderOnlyActiveDays),
          useSummaryTime: Boolean(keyReminderUseSummaryTime),
          appNotificationEnabled: Boolean(keyReminderAppNotif),
          lineWorksNotificationEnabled: Boolean(keyReminderLwNotif),
          midnightSuppressionEnabled: Boolean(keyReminderMidnightSuppression),
        },
      });
      setKeyRemindersSaved(true);
      setTimeout(() => setKeyRemindersSaved(false), 2500);
    } catch (err) {
      console.error('Failed to auto-sync key reminder switch:', err);
    }
  };

  // 【重要: 要件1】鍵催促設定の保存（スイッチの状態を確実にFirestoreへ保存）
  const handleSaveKeyReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedKeyReminders = {
        enabled: Boolean(keyReminderEnabled), // 確実にbooleanで保存
        startTime: keyReminderStartTime,
        intervalMinutes: Number(keyReminderInterval),
        maxCount: Number(keyReminderMaxCount),
        onlyOnActiveDays: Boolean(keyReminderOnlyActiveDays),
        useSummaryTime: Boolean(keyReminderUseSummaryTime),
        appNotificationEnabled: Boolean(keyReminderAppNotif),
        lineWorksNotificationEnabled: Boolean(keyReminderLwNotif),
        midnightSuppressionEnabled: Boolean(keyReminderMidnightSuppression),
      };

      await updateSettings({
        keyReminders: updatedKeyReminders,
      });

      setKeyRemindersSaved(true);
      setTimeout(() => setKeyRemindersSaved(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestKeyReminder = async () => {
    try {
      await forceCheckKeyReminders({ isTest: true });
      setTestReminderToast('テスト催促通知を送信しました！通知画面や端末で確認できます。');
      setTimeout(() => setTestReminderToast(null), 4000);
    } catch (err: any) {
      setTestReminderToast(`テスト送信エラー: ${err.message}`);
      setTimeout(() => setTestReminderToast(null), 4000);
    }
  };

  // LINE WORKS 設定の保存（Firestoreの専用ドキュメント settings/lineworks に保存）
  const handleSaveLineWorks = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setLwTestErrorMsg(null);
    try {
      const updatedLineWorks = {
        enabled: Boolean(lwEnabled),
        mode: lwMode,
        webhookUrl: lwWebhookUrl.trim(),
        clientId: lwClientId.trim(),
        clientSecret: lwClientSecret.trim(),
        serviceAccount: lwServiceAccount.trim(),
        privateKey: lwPrivateKey.trim(),
        botId: lwBotId.trim(),
        channelId: lwChannelId.trim(),
        serverId: lwServerId.trim() || '40170745',
        sendDailySummary: Boolean(lwSendSummary),
        sendTardyAlert: Boolean(lwSendTardy),
      };

      // 【要件1】Firestoreの専用ドキュメント settings/lineworks に直接保存
      await saveLineWorksConfigToFirestore(updatedLineWorks);

      // AppContext & 全体設定（config/app_settings）にも同期
      await saveLineWorksSettings(updatedLineWorks);

      setLwSaved(true);
      setTimeout(() => setLwSaved(false), 4000);
    } catch (err: any) {
      console.error('[SettingsScreen] LINE WORKS設定保存エラー:', err);
      setLwTestErrorMsg(`設定の保存に失敗しました: ${err.message}`);
      setTimeout(() => setLwTestErrorMsg(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // LINE WORKS API 2.0 認証確認（【要件4】Firestoreの設定を使ってトークン発行テストを実行）
  const handleVerifyLineWorksAuth = async () => {
    setLwVerifying(true);
    setLwVerifyResult(null);
    setLwTestSuccessMsg(null);
    setLwTestErrorMsg(null);

    try {
      // 1. まずFirestoreの専用ドキュメント settings/lineworks から最新設定を読み込み
      const firestoreConfig = await fetchLineWorksConfigFromFirestore();
      // 2. 入力欄の値とFirestore設定をマージ（Firestoreを優先、未保存入力値・環境変数へフォールバック）
      const effectiveConfig = resolveEffectiveLineWorksConfig(firestoreConfig, {
        clientId: lwClientId.trim(),
        clientSecret: lwClientSecret.trim(),
        serviceAccount: lwServiceAccount.trim(),
        privateKey: lwPrivateKey.trim(),
        serverId: lwServerId.trim() || '40170745',
      });

      console.log('[SettingsScreen] Firestore設定による認証テスト開始:', {
        fromFirestore: Boolean(firestoreConfig),
        clientId: effectiveConfig.clientId,
        serviceAccount: effectiveConfig.serviceAccount,
        serverId: effectiveConfig.serverId,
      });

      const result = await verifyLineWorksApi2Auth({
        clientId: effectiveConfig.clientId,
        clientSecret: effectiveConfig.clientSecret,
        serviceAccount: effectiveConfig.serviceAccount,
        privateKey: effectiveConfig.privateKey,
        serverId: effectiveConfig.serverId,
      });

      setLwVerifyResult(result);
      if (result.success) {
        setLwTestSuccessMsg('LINE WORKS API 2.0 認証（アクセストークン発行）に成功しました！Firestoreの設定で正常に動作しています。');
        setTimeout(() => setLwTestSuccessMsg(null), 6000);
      }
    } catch (unexpectedErr: any) {
      console.error('[SettingsScreen] 予期しないエラーを捕捉:', unexpectedErr);
      setLwVerifyResult({
        success: false,
        httpStatus: 0,
        responseBody: unexpectedErr.message || '予期しないエラーが発生しました',
        errorCode: 'UNEXPECTED_CLIENT_EXCEPTION',
        error: unexpectedErr.message || 'クライアント例外',
        origin: 'frontend',
        location: 'フロントエンド（SettingsScreen.tsx handleVerifyLineWorksAuth catch）',
        route: 'フロントエンド（ブラウザ）側でエラー検知',
      });
    } finally {
      setLwVerifying(false);
    }
  };

  // LINE WORKS テストメッセージ送信（Bot または Webhook）
  const handleSendTestMessage = async () => {
    if (!lwEnabled) {
      setLwTestErrorMsg('LINE WORKS連携を有効（ON）にしてください');
      setTimeout(() => setLwTestErrorMsg(null), 4000);
      return;
    }
    setLwTestingSend(true);
    setLwTestSuccessMsg(null);
    setLwTestErrorMsg(null);

    try {
      const testConfig = {
        enabled: true,
        mode: lwMode,
        webhookUrl: lwWebhookUrl.trim(),
        clientId: lwClientId.trim(),
        clientSecret: lwClientSecret.trim(),
        serviceAccount: lwServiceAccount.trim(),
        privateKey: lwPrivateKey.trim(),
        botId: lwBotId.trim(),
        channelId: lwChannelId.trim(),
        serverId: lwServerId.trim() || '40170745',
      };

      const res = await sendLineWorksNotification(
        testConfig,
        `【吹奏楽部 出欠管理アプリ】LINE WORKS 連携テスト送信\n送信時刻: ${new Date().toLocaleTimeString('ja-JP')}\n認証・設定が正常に完了しています。`
      );

      if (res.success) {
        setLwTestSuccessMsg('LINE WORKSへテストメッセージを送信しました！トークルームをご確認ください。');
        setTimeout(() => setLwTestSuccessMsg(null), 5000);
      } else {
        setLwTestErrorMsg(`送信に失敗しました: ${res.error || '不明なエラー'}`);
      }
    } catch (err: any) {
      setLwTestErrorMsg(`送信エラー: ${err.message}`);
    } finally {
      setLwTestingSend(false);
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    await addMember(newMemberName.trim(), newMemberGrade, '部員', newMemberSection, newMemberPart);
    setNewMemberName('');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* User Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          自分のプロフィール設定
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          設定すると出欠連絡フォームで名前とパートが自動入力されます
        </p>

        {profileSaved && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>プロフィールを保存しました</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
              自分の名前
            </label>
            <input
              type="text"
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              placeholder="例: 佐藤 花子"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                セクション
              </label>
              <select
                value={userSectionInput}
                onChange={(e) => {
                  setUserSectionInput(e.target.value);
                  const pList = getPartsForSection(e.target.value);
                  setUserPartInput(pList[0] || '');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
              >
                {SECTIONS_AND_PARTS.map((s) => (
                  <option key={s.section} value={s.section}>
                    {s.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                パート
              </label>
              <select
                value={userPartInput}
                onChange={(e) => setUserPartInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
              >
                {getPartsForSection(userSectionInput).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            プロフィールを保存
          </button>
        </form>
      </div>

      {/* Attendance Schedule Glance (一般部員・管理者共通: 出欠確認スケジュール状況) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              出欠確認・配信スケジュール状況
            </h2>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            todayResolvedSchedule.enabled
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
          }`}>
            {todayResolvedSchedule.enabled ? '本日活動日' : '本日OFF'}
          </span>
        </div>

        {/* Today's Status Banner */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              本日の出欠確認（締切時刻）
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {formatJapaneseDate(todayDateStr, true)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                {todayResolvedSchedule.enabled ? todayResolvedSchedule.time : 'OFF'}
              </span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {todayResolvedSchedule.label || (todayResolvedSchedule.enabled ? '通常練習' : '休み')}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              基本設定: {summaryNotificationTime}
            </span>
          </div>
        </div>

        {/* 7-Day Overview Pills */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            週間スケジュール（月〜日）
          </span>
          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
              const dayCfg = weeklySchedule[dayIdx] || DEFAULT_WEEKLY_SCHEDULE[dayIdx] || { enabled: true, time: '18:00', label: '練習' };
              const isTodayDay = currentDayOfWeek === dayIdx;
              const dayName = DAY_NAMES[dayIdx];
              const isSun = dayIdx === 0;
              const isSat = dayIdx === 6;

              return (
                <div
                  key={dayIdx}
                  className={`p-1.5 rounded-xl border text-center transition-all ${
                    isTodayDay
                      ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 ring-2 ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <span
                    className={`text-[10px] font-black block ${
                      isSun ? 'text-rose-500' : isSat ? 'text-sky-500' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {dayName}
                  </span>
                  <span className="text-[9px] font-bold block mt-0.5 truncate text-slate-800 dark:text-slate-200">
                    {dayCfg.enabled ? dayCfg.time : 'OFF'}
                  </span>
                  <span className="text-[8px] text-slate-400 block truncate">
                    {dayCfg.enabled ? (dayCfg.label ? dayCfg.label.slice(0, 3) : '練習') : '休み'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          ※出欠確認時刻・曜日の変更は、下の管理者ログイン後に行えます。
        </p>
      </div>

      {/* 出欠連絡の定型文（連絡パターン）編集 */}
      <AttendancePatternsEditor />

      {/* Admin Login / Logout */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            管理者権限
          </h2>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isAdmin
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {isAdmin ? '管理者ログイン中' : '一般部員モード'}
          </span>
        </div>

        {isAdmin ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              現在管理者としてログインしています。設定変更や部員管理が行えます。
            </p>
            <button
              type="button"
              onClick={logoutAdmin}
              className="w-full py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              管理者ログアウト
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              合言葉を入力して管理者ログインしてください（初期値: admin1234）
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={passcodeAttempt}
                onChange={(e) => setPasscodeAttempt(e.target.value)}
                placeholder="合言葉"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                ログイン
              </button>
            </div>
            {passcodeError && (
              <p className="text-xs text-red-500 font-bold mt-1">{passcodeError}</p>
            )}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1 mt-2">
              <p className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span>管理者専用メニューの保護</span>
              </p>
              <p>
                LINE WORKS連携設定（Client ID / 秘密鍵 等）や部活全体設定は管理者専用です。合言葉を入力してログインすると設定画面が開きます（一般部員モードでは閲覧・変更できません）。
              </p>
            </div>
          </form>
        )}
      </div>

      {/* ========================================================= */}
      {/* ADMIN SECTIONS (Visible only to Admin) */}
      {/* ========================================================= */}
      {isAdmin && (
        <div className="space-y-4">
          {/* Section: Attendance Confirmation & Delivery Schedule Settings (出欠確認・配信スケジュール設定) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                出欠確認・配信スケジュール設定（時間設定）
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                管理者専用
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              毎日の出欠確認の基準時刻（日報まとめ配信時刻）や、曜日ごとの練習有無（OFF/休み）・個別時刻を詳細に設定できます。変更内容はFirestoreに即時保存され、部員全員の画面に反映されます。
            </p>

            {scheduleSavedMsg && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{scheduleSavedMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              {/* 1. 基本時刻設定 */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    基本の出欠確認・日報送信時刻
                  </label>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">現在値: {summaryNotificationTime}</span>
                </div>
                <input
                  type="time"
                  value={summaryNotificationTime}
                  onChange={(e) => setSummaryNotificationTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  ※出欠確認の基本時刻です。曜日別設定が有効な曜日は、そちらの個別時刻が優先されます。
                </p>
              </div>

              {/* 2. 曜日別スケジュール設定 */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      曜日別の出欠確認・練習スケジュール（月〜日）
                    </label>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      各曜日の活動有無（OFF/休み）や個別の出欠確認時刻を設定します
                    </span>
                  </div>
                  <div className="flex gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleApplyBaseTimeToAllDays}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-900 cursor-pointer"
                      title="基本時刻を全曜日に一括反映"
                    >
                      基本時刻を一括反映
                    </button>
                    <button
                      type="button"
                      onClick={handleResetWeeklyScheduleToDefault}
                      className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                      title="初期設定に戻す"
                    >
                      初期化
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                    const sched = weeklySchedule[dayIdx] || DEFAULT_WEEKLY_SCHEDULE[dayIdx] || { enabled: true, time: '18:00', label: '放課後練習' };
                    const dayName = DAY_NAMES[dayIdx];
                    const dayFullName = DAY_FULL_NAMES[dayIdx];
                    const isSun = dayIdx === 0;
                    const isSat = dayIdx === 6;

                    return (
                      <div
                        key={dayIdx}
                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                          sched.enabled
                            ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80'
                            : 'bg-slate-100/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                              isSun
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                                : isSat
                                ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {dayName}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                              {dayFullName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {sched.enabled ? '活動日（出欠確認あり）' : 'OFF / 休み（出欠なし）'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {/* Activity Label Input */}
                          <input
                            type="text"
                            value={sched.label || ''}
                            onChange={(e) => handleWeeklyDayChange(dayIdx, 'label', e.target.value)}
                            placeholder={sched.enabled ? '区分 (例: 放課後練習)' : 'OFF / 休み'}
                            className="w-28 sm:w-32 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 font-medium"
                          />

                          {/* Time Input (only active if enabled) */}
                          <input
                            type="time"
                            value={sched.time || summaryNotificationTime || '18:00'}
                            disabled={!sched.enabled}
                            onChange={(e) => handleWeeklyDayChange(dayIdx, 'time', e.target.value)}
                            className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          />

                          {/* Enabled / Disabled Toggle */}
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={sched.enabled}
                              onChange={(e) => handleWeeklyDayChange(dayIdx, 'enabled', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>


              {/* Save Button */}
              <button
                type="submit"
                disabled={scheduleSaving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {scheduleSaving ? '設定を保存中...' : '出欠確認・配信スケジュール設定（時間設定）を保存'}
              </button>
            </form>
          </div>

          {/* Section: General Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                部活全体設定
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                管理者専用
              </span>
            </div>

            {saveSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveGeneral} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  部活動名
                </label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="例: 吹奏楽部"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  基本の出欠確認・日報まとめ送信時刻
                </label>
                <input
                  type="time"
                  value={summaryNotificationTime}
                  onChange={(e) => setSummaryNotificationTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 font-medium"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  ※曜日ごとの詳細スケジュール設定は上の「出欠確認・配信スケジュール設定」から設定できます。
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    鍵状態の深夜自動リセット（0:00 JST）
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    日付が変わると鍵の施錠状態を自動で未施錠にリセットします
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoResetKeys}
                    onChange={(e) => setAutoResetKeys(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                全体設定を保存する
              </button>
            </form>

            {/* Admin Passcode Update Form */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                管理者合言葉の変更
              </label>
              {passcodeChangeMsg && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{passcodeChangeMsg}</span>
                </div>
              )}
              <form onSubmit={handleChangePasscode} className="flex gap-2">
                <input
                  type="password"
                  value={newPasscodeInput}
                  onChange={(e) => setNewPasscodeInput(e.target.value)}
                  placeholder="新しい合言葉を入力"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={!newPasscodeInput.trim()}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                >
                  合言葉を変更
                </button>
              </form>
            </div>
          </div>

          {/* Section: Key Names Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                部室の鍵の名前設定（2鍵対応）
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                管理者専用
              </span>
            </div>

            {keyNamesSaved && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>鍵の名前を保存しました。</span>
              </div>
            )}

            <form onSubmit={handleSaveKeyNames} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  鍵① の名前
                </label>
                <input
                  type="text"
                  value={key1NameInput}
                  onChange={(e) => setKey1NameInput(e.target.value)}
                  placeholder="例: 鍵①（正面玄関）"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  鍵② の名前
                </label>
                <input
                  type="text"
                  value={key2NameInput}
                  onChange={(e) => setKey2NameInput(e.target.value)}
                  placeholder="例: 鍵②（楽器庫）"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                鍵の名前を保存する
              </button>
            </form>
          </div>

          {/* Section: Key Reminders Settings (【鍵催促通知設定】) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
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
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>鍵の催促設定を保存しました。Firestoreに即時保存され、次回起動時も維持されます。</span>
              </div>
            )}

            {testReminderToast && (
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 rounded-xl text-xs flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{testReminderToast}</span>
              </div>
            )}

            {/* Main Toggle Switch */}
            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  鍵の催促機能を有効にする
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  ONにすると、指定時刻に未施錠の鍵がある場合に自動催促します
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={keyReminderEnabled}
                  onChange={(e) => handleToggleKeyReminder(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {keyReminderEnabled && (
              <div className="space-y-3 pt-1">
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      催促開始時刻
                    </label>
                    <input
                      type="time"
                      value={keyReminderStartTime}
                      onChange={(e) => setKeyReminderStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      催促を送る間隔
                    </label>
                    <select
                      value={keyReminderInterval}
                      onChange={(e) => setKeyReminderInterval(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 font-medium"
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
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      最大催促回数
                    </label>
                    <select
                      value={keyReminderMaxCount}
                      onChange={(e) => setKeyReminderMaxCount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 font-medium"
                    >
                      <option value={1}>1回のみ</option>
                      <option value={2}>2回まで</option>
                      <option value={3}>3回まで</option>
                      <option value={4}>4回まで</option>
                      <option value={5}>5回まで</option>
                      <option value={10}>10回まで</option>
                    </select>
                  </div>
                </div>

                {/* Sub Options */}
                <div className="space-y-2 pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keyReminderMidnightSuppression}
                      onChange={(e) => setKeyReminderMidnightSuppression(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      深夜・早朝（0:00〜6:00 JST）は通知を自動制限する
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keyReminderAppNotif}
                      onChange={(e) => setKeyReminderAppNotif(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      アプリ内通知（プッシュ・通知タブ）を送信する
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keyReminderLwNotif}
                      onChange={(e) => setKeyReminderLwNotif(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      LINE WORKSへも催促メッセージを投稿する
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleSendTestKeyReminder}
                className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <BellRing className="w-3.5 h-3.5" />
                テスト催促通知を1回送信
              </button>

              <button
                type="button"
                onClick={handleSaveKeyReminders}
                disabled={isSaving}
                className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isSaving ? '保存中...' : '催促設定を保存する'}
              </button>
            </div>

            {/* ========================================================= */}
            {/* REAL-TIME DEBUG PANEL (【デバッグパネル】) */}
            {/* ========================================================= */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3 text-blue-500" />
                  催促デバッグ情報（リアルタイム）
                </span>
                <button
                  type="button"
                  onClick={() => forceCheckKeyReminders({ force: true })}
                  className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <Zap className="w-3 h-3" />
                  強制判定を実行
                </button>
              </div>

              {/* 【要件4】設定された催促開始時刻と現在の判定時刻を並べて表示（時間判定カード） */}
              <div className="p-3 rounded-2xl bg-slate-900 dark:bg-black/40 border border-slate-700/60 text-white space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    時間判定チェック（JST基準）
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      keyReminderDebug?.isBeforeStartTime
                        ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                        : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                    }`}
                  >
                    {keyReminderDebug?.isBeforeStartTime
                      ? `⏳ 開始前（あと${keyReminderDebug?.remainingMinutesUntilStart ?? '--'}分）`
                      : '✓ 催促開始時刻に到達'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
                    <p className="text-[9px] text-slate-400 font-medium">現在の判定時刻 (JST)</p>
                    <p className="text-sm font-mono font-bold text-white mt-0.5">
                      {keyReminderDebug?.currentJstTime || '--:--'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
                    <p className="text-[9px] text-slate-400 font-medium">設定された催促開始時刻</p>
                    <p className="text-sm font-mono font-bold text-amber-400 mt-0.5">
                      {keyReminderDebug?.configStartTime || keyReminderStartTime || '18:00'}
                    </p>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-800/60 text-[10px] border border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">時間判定結果:</span>
                    <span className={`font-bold ${keyReminderDebug?.isBeforeStartTime ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {keyReminderDebug?.isBeforeStartTime
                        ? '開始時刻前のため自動送信を完全にブロック中'
                        : '開始時刻に到達（催促送信チェック可能）'}
                    </span>
                  </div>
                  {keyReminderDebug?.timeComparisonDetail && (
                    <p className="text-[9px] font-mono text-slate-400 truncate">
                      {keyReminderDebug.timeComparisonDetail}
                    </p>
                  )}
                </div>
              </div>

              {/* 詳細ステータスグリッド */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">判定ステップ</p>
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate">
                    {keyReminderDebug?.step || '待機中'}
                  </p>
                </div>

                {/* 送信条件クリア */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">送信条件クリア</p>
                  <p className={`text-xs font-bold ${keyReminderDebug?.isConditionMet ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {keyReminderDebug?.isConditionMet ? 'はい (送信対象)' : 'いいえ (待機中)'}
                  </p>
                </div>

                {/* 催促機能の内部フラグとUIスイッチ状態 */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">催促機能の内部フラグ</p>
                  <p className={`text-xs font-bold ${settings.keyReminders?.enabled ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {settings.keyReminders?.enabled ? 'ON (true)' : 'OFF (false)'}
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">UIスイッチ状態</p>
                  <p className={`text-xs font-bold ${keyReminderEnabled ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {keyReminderEnabled ? 'ON (true)' : 'OFF (false)'}
                  </p>
                </div>

                {/* 本日の自動送信回数 */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">本日の自動送信回数</p>
                  <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    {keyReminderDebug?.todaySendCount ?? 0} / {keyReminderDebug?.maxCount ?? keyReminderMaxCount ?? 10}回
                  </p>
                </div>

                {/* 深夜判定 */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">深夜帯判定 (0:00〜6:00)</p>
                  <p className={`text-xs font-bold ${keyReminderDebug?.isMidnight ? 'text-amber-600' : 'text-slate-400'}`}>
                    {keyReminderDebug?.isMidnight ? '深夜帯 (制限中)' : '通常時間帯'}
                  </p>
                </div>

                {/* 鍵① 本日 */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">鍵① 本日</p>
                  <p className={`text-xs font-bold ${keyReminderDebug?.key1Status === '施錠済み' || keyReminderDebug?.key1Status === '報告済み' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {keyReminderDebug?.key1Status || '未判定'}
                  </p>
                </div>

                {/* 鍵② 本日 */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">鍵② 本日</p>
                  <p className={`text-xs font-bold ${keyReminderDebug?.key2Status === '施錠済み' || keyReminderDebug?.key2Status === '報告済み' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {keyReminderDebug?.key2Status || '未判定'}
                  </p>
                </div>

                {/* 次回送信予定時刻 (横幅いっぱい) */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 col-span-2">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">次回の送信予定時刻</p>
                  <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {keyReminderDebug?.nextScheduledTime || keyReminderStartTime || '--:--'}
                  </p>
                </div>

                {/* 施錠報告ロック & クールダウン情報 */}
                {(keyReminderDebug?.isReminderLocked || keyReminderDebug?.isCooldownActive) && (
                  <div className="col-span-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{keyReminderDebug.isReminderLocked ? '🔒 施錠報告ロック作動中' : '⏳ 連打防止クールダウン中'}</span>
                    </div>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300/90">
                      {keyReminderDebug.isReminderLocked
                        ? (keyReminderDebug.lockDetail || '部員が鍵の施錠操作中のため、誤送信を防ぐため催促通知を一時停止しています。')
                        : '直近1分以内に催促通知が送信されたため、通知の連続送信（連打）を防止しています。'}
                    </p>
                  </div>
                )}
              </div>

              {/* フラグの一致確認インジケーター */}
              <div className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between border ${
                (settings.keyReminders?.enabled ?? false) === keyReminderEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}>
                <span>スイッチと内部フラグの整合性:</span>
                <span>
                  {(settings.keyReminders?.enabled ?? false) === keyReminderEnabled
                    ? '✓ 一致しています'
                    : '⚠ 不一致（保存処理中）'}
                </span>
              </div>

              {/* 停止・待機理由の明瞭表示（正常待機 vs 正常完了 vs 設定OFF を判別） */}
              {keyReminderDebug?.skipReason ? (
                <div
                  className={`p-3 rounded-2xl border space-y-1.5 transition-colors ${
                    keyReminderDebug.reasonType === 'normal_completed'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : keyReminderDebug.reasonType === 'disabled'
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                      : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        keyReminderDebug.reasonType === 'normal_completed'
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                          : keyReminderDebug.reasonType === 'disabled'
                          ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                          : 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                      }`}
                    >
                      {keyReminderDebug.reasonType === 'normal_completed'
                        ? '✓ 正常完了（催促不要）'
                        : keyReminderDebug.reasonType === 'disabled'
                        ? '⚠ 設定OFFによる停止'
                        : 'ℹ️ 正常待機中（時間待ち）'}
                    </span>
                    {keyReminderDebug.reasonCategory && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {keyReminderDebug.reasonCategory}
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-xs font-bold leading-snug ${
                      keyReminderDebug.reasonType === 'normal_completed'
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : keyReminderDebug.reasonType === 'disabled'
                        ? 'text-rose-800 dark:text-rose-200'
                        : 'text-blue-800 dark:text-blue-200'
                    }`}
                  >
                    停止理由: {keyReminderDebug.skipReason}
                  </p>

                  {keyReminderDebug.offReasonDetail && (
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                      詳細情報: {keyReminderDebug.offReasonDetail}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>催促通知の送信条件を満たしています（定期タイマーで送信中）</span>
                </div>
              )}

              <div className="flex flex-col gap-0.5 text-[9px] text-slate-400 px-1 italic">
                <span>最終チェック時刻: {keyReminderDebug?.lastCheckTime || 'なし'}</span>
                <span>最終通知送信時刻: {keyReminderDebug?.lastSentTime || 'なし'}</span>
              </div>

              {/* Vercel Cron Jobs & Google Cloud Scheduler 定時実行連携案内 */}
              <div className="mt-3 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Vercel Cron Jobs / Cloud Scheduler 定時催促連携</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  PWAがバックグラウンド時でも毎日指定時刻（20:00 JST）に催促を確実に届けるため、Vercel Cron Jobs（またはCloud Scheduler）から定期実行されます。
                </p>
                <div className="p-2.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[10px] space-y-1.5 overflow-x-auto">
                  <div className="text-amber-400 font-bold"># Vercel Cron Jobs (vercel.json)</div>
                  <div>Schedule: 0 11 * * * (毎日20:00 JST / 11:00 UTC)</div>
                  <div>Endpoint: /api/cron/key-reminder</div>
                  <div>Auth Header: Authorization: Bearer (CRON_SECRET)</div>
                  <div className="text-slate-400 text-[9px] pt-1 border-t border-slate-800">
                    ※両方の鍵が報告済みなら送信せず終了 (200 OK)。未報告の場合のみLINE WORKS (Server ID: 40170745) へ催促メッセージを自動配信します。
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* Section: Key Report Cleanup (【鍵の報告履歴クリーンアップ】) */}
          {/* ========================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  鍵の報告履歴クリーンアップ（デバッグ用）
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                管理者専用
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Firestoreの鍵状態（key_status）および報告履歴（key_logs）に残っている「部員」「齋藤凌吾」などの不正な報告者名データを、ログインユーザー「{getSafeUserName(myMemberName)}」へ上書き是正します。
            </p>

            {cleanupResultMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{cleanupResultMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCleanupKeyReports}
              disabled={isCleaningUp}
              className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCleaningUp ? 'animate-spin' : ''}`} />
              <span>{isCleaningUp ? 'クリーンアップ処理中...' : '鍵の報告履歴をクリーンアップする（デバッグ用）'}</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* Section: Key Report LINE WORKS Status & Error Log (【施錠報告 LINE WORKS自動送信状況】) */}
          {/* ========================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  施錠報告 LINE WORKS自動通知 状況
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                自動連携
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              部員が「閉めました」を押した際、誰がどの鍵を閉めたかをLINE WORKSへ即時自動投稿します（鍵催促用または出欠連絡用のBotを利用）。
            </p>

            {/* 送信ステータス / エラーログ */}
            {settings.lastLwKeyReportStatus ? (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                  settings.lastLwKeyReportStatus.success
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {settings.lastLwKeyReportStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-bold">
                    {settings.lastLwKeyReportStatus.success
                      ? '✓ 施錠報告のLINE WORKS送信: 正常完了'
                      : '⚠ 施錠報告のLINE WORKS送信に失敗しました'}
                  </p>
                  {settings.lastLwKeyReportStatus.error && !settings.lastLwKeyReportStatus.success && (
                    <p className="text-[11px] font-mono text-rose-700 dark:text-rose-300 bg-rose-100/60 dark:bg-rose-900/40 p-1.5 rounded-lg">
                      エラー詳細: {settings.lastLwKeyReportStatus.error}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    最終送信日時: {formatTimestamp(settings.lastLwKeyReportStatus.timestamp)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-500 text-xs">
                施錠報告のLINE WORKS送信履歴はまだありません（次回「閉めました」報告時に送信されます）
              </div>
            )}

            {keyReportTestMsg && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                  keyReportTestMsg.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-200'
                }`}
              >
                {keyReportTestMsg.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span>{keyReportTestMsg.text}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSendKeyReportTest}
              disabled={keyReportTesting}
              className="w-full py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{keyReportTesting ? 'テスト送信中...' : '施錠報告のLINE WORKS通知をテスト送信'}</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* Section: Broadcast Notification (【全体通知・一斉連絡配信】) */}
          {/* ========================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                全体通知・一斉連絡配信
              </h3>
              <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                管理者専用
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              部員全員のアプリ内通知一覧およびLINE WORKSへ、連絡事項や急なお知らせを一斉送信できます。
            </p>

            {broadcastSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{broadcastSuccessMsg}</span>
              </div>
            )}

            {broadcastErrorMsg && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{broadcastErrorMsg}</span>
              </div>
            )}

            {/* Broadcast Form */}
            <form onSubmit={handleSendBroadcast} className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                部員全員へのお知らせ作成
              </span>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  タイトル
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="例: 【重要】明日の練習時間・持ち物変更について"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  連絡内容
                </label>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="例: 明日は13:00からホール練習です。譜面台と合奏譜を忘れないように持参してください。"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 font-medium leading-relaxed"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs pt-0.5">
                <input
                  type="checkbox"
                  checked={broadcastSendToLw}
                  onChange={(e) => setBroadcastSendToLw(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  LINE WORKSのトークルームへも同時に投稿する
                </span>
              </label>

              <button
                type="submit"
                disabled={broadcastSending || !broadcastTitle.trim() || !broadcastMessage.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                {broadcastSending ? '全体通知を送信中...' : '部員全員へ一斉送信'}
              </button>
            </form>

            {/* Daily Summary Broadcast Action */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  日報まとめ（出欠集計）の手動即時配信
                </span>
                <span className="text-[10px] text-slate-400">
                  自動配信時刻: {summaryNotificationTime}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                本日の出欠集計メッセージを、指定時刻を待たずに今すぐLINE WORKSへ即時配信します。
              </p>

              {summarySuccessMsg && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{summarySuccessMsg}</span>
                </div>
              )}

              {summaryErrorMsg && (
                <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-lg text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{summaryErrorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSendManualSummary}
                disabled={summarySending}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {summarySending ? '日報集計を送信中...' : '本日の日報まとめを今すぐ配信'}
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* Section: Event Notifications (【イベント通知設定】) */}
          {/* ========================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                イベント通知設定（予定リマインダー）
              </h3>
              <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                管理者専用
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              予定表（カレンダー）に登録された合宿・本番・ホール練習などのイベントについて、前日や当日にLINE WORKSへ自動でリマインダー通知を送信します。
            </p>

            {evTestSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{evTestSuccessMsg}</span>
              </div>
            )}

            {evTestErrorMsg && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{evTestErrorMsg}</span>
              </div>
            )}

            {/* Toggle Switch */}
            <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200/80 dark:border-purple-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  イベントリマインダー機能を有効にする
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  ONにすると、登録されたイベントの事前通知を自動で行います
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={evReminderEnabled}
                  onChange={(e) => setEvReminderEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {evReminderEnabled && (
              <div className="space-y-3 pt-1 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                    通知タイミング設定
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      前日（18:00 JST）に翌日の予定・服装・持ち物を通知
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      当日朝（7:00 JST）に本日の予定・集合時間をリマインド
                    </span>
                  </label>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[11px] text-purple-800 dark:text-purple-200 flex items-center justify-between">
                  <span>🤖 イベント通知用Bot: <strong>{settings.lineWorksEvents?.botId ? `専用Bot (ID: ${settings.lineWorksEvents.botId})` : `出欠連絡Botと共通`}</strong></span>
                  <span className="text-[10px] text-purple-600 font-bold">下部のBot総合管理で設定可能</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSendEventReminderTest}
                disabled={evTesting}
                className="w-full py-2 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                {evTesting ? 'テスト送信中...' : 'イベント通知のテスト送信'}
              </button>

              <button
                type="button"
                onClick={handleSaveEventReminder}
                disabled={isSaving}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isSaving ? '保存中...' : 'イベント通知設定を保存'}
              </button>
            </div>
          </div>

          {/* Section: LINE WORKS Multi-Bot Settings (【LINE WORKS 3ボット総合管理: 出欠・鍵催促・イベント】) */}
          <LineWorksMultiBotSettings />

          {/* Section: Member Management */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                部員名簿管理（{members.length}名）
              </h3>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block">部員の新規追加</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="部員氏名"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 font-medium"
                  required
                />
                <select
                  value={newMemberSection}
                  onChange={(e) => {
                    setNewMemberSection(e.target.value);
                    const pList = getPartsForSection(e.target.value);
                    setNewMemberPart(pList[0] || '');
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 font-medium"
                >
                  {SECTIONS_AND_PARTS.map((s) => (
                    <option key={s.section} value={s.section}>
                      {s.section}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newMemberPart}
                  onChange={(e) => setNewMemberPart(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 font-medium"
                >
                  {getPartsForSection(newMemberSection).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  追加
                </button>
              </div>
            </form>

            <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => (
                <div key={m.id} className="pt-1.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{m.name}</span>
                    <span className="text-[10px] text-slate-400 ml-2">
                      ({m.section || '未設定'} / {m.part || '未設定'})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`「${m.name}」さんを名簿から削除しますか？`)) {
                        deleteMember(m.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PWA & キャッシュ更新カード（スマホ表示最適化・全ユーザー利用可） */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              アプリ情報 & PWAキャッシュ更新
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
            v99 (最新版)
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          ホーム画面に追加したPWAアプリで表示が古い場合や更新が反映されない場合は、下のボタンからキャッシュを初期化して最新コードを再読み込みできます。
        </p>
        <button
          type="button"
          onClick={handleForceClearCache}
          disabled={isClearingCache}
          className="w-full py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.99]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isClearingCache ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
          <span>{isClearingCache ? '最新版を取得中...' : 'キャッシュを初期化して最新版に更新'}</span>
        </button>
      </div>
    </div>
  );
};
