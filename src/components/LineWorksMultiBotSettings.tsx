import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LineWorksConfig } from '../types';
import {
  Bot,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Shield,
  Send,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import {
  fetchLineWorksConfigFromFirestore,
  saveLineWorksConfigToFirestore,
  resolveEffectiveLineWorksConfig,
  verifyLineWorksApi2Auth,
  sendLineWorksNotification,
  type LineWorksVerifyResult,
} from '../utils/lineworks';

interface LineWorksMultiBotSettingsProps {
  initialTab?: 'attendance' | 'keyReminder' | 'events';
}

export const LineWorksMultiBotSettings: React.FC<LineWorksMultiBotSettingsProps> = ({
  initialTab = 'attendance',
}) => {
  const {
    settings,
    saveLineWorksSettings,
    saveLineWorksKeyReminderSettings,
    saveLineWorksEventsSettings,
    isAdmin,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'attendance' | 'keyReminder' | 'events'>(initialTab);

  // ===========================================================================
  // 1. 出欠連絡・日報Bot State
  // ===========================================================================
  const [attEnabled, setAttEnabled] = useState<boolean>(settings.lineWorks?.enabled ?? false);
  const [attMode, setAttMode] = useState<'webhook' | 'api2'>(settings.lineWorks?.mode || 'api2');
  const [attWebhookUrl, setAttWebhookUrl] = useState<string>(settings.lineWorks?.webhookUrl || '');
  const [attClientId, setAttClientId] = useState<string>(settings.lineWorks?.clientId || '');
  const [attClientSecret, setAttClientSecret] = useState<string>(settings.lineWorks?.clientSecret || '');
  const [attServiceAccount, setAttServiceAccount] = useState<string>(settings.lineWorks?.serviceAccount || '');
  const [attPrivateKey, setAttPrivateKey] = useState<string>(settings.lineWorks?.privateKey || '');
  const [attBotId, setAttBotId] = useState<string>(settings.lineWorks?.botId || '');
  const [attChannelId, setAttChannelId] = useState<string>(settings.lineWorks?.channelId || '');
  const [attServerId, setAttServerId] = useState<string>(settings.lineWorks?.serverId || '40170745');
  const [attSendSummary, setAttSendSummary] = useState<boolean>(settings.lineWorks?.sendDailySummary !== false);
  const [attSendTardy, setAttSendTardy] = useState<boolean>(settings.lineWorks?.sendTardyAlert !== false);

  const [attSaved, setAttSaved] = useState<boolean>(false);
  const [attVerifying, setAttVerifying] = useState<boolean>(false);
  const [attVerifyResult, setAttVerifyResult] = useState<LineWorksVerifyResult | null>(null);
  const [attTestingSend, setAttTestingSend] = useState<boolean>(false);
  const [attTestMsg, setAttTestMsg] = useState<{ success: boolean; text: string } | null>(null);

  // ===========================================================================
  // 2. 鍵施錠催促Bot State
  // ===========================================================================
  const [krEnabled, setKrEnabled] = useState<boolean>(settings.lineWorksKeyReminder?.enabled ?? false);
  const [krUseCustomBot, setKrUseCustomBot] = useState<boolean>(
    Boolean(settings.lineWorksKeyReminder?.botId && settings.lineWorksKeyReminder?.botId !== settings.lineWorks?.botId)
  );
  const [krBotId, setKrBotId] = useState<string>(settings.lineWorksKeyReminder?.botId || '');
  const [krChannelId, setKrChannelId] = useState<string>(settings.lineWorksKeyReminder?.channelId || '');
  const [krClientId, setKrClientId] = useState<string>(settings.lineWorksKeyReminder?.clientId || '');
  const [krClientSecret, setKrClientSecret] = useState<string>(settings.lineWorksKeyReminder?.clientSecret || '');
  const [krServiceAccount, setKrServiceAccount] = useState<string>(settings.lineWorksKeyReminder?.serviceAccount || '');
  const [krPrivateKey, setKrPrivateKey] = useState<string>(settings.lineWorksKeyReminder?.privateKey || '');
  const [krServerId, setKrServerId] = useState<string>(settings.lineWorksKeyReminder?.serverId || '40170745');

  const [krSaved, setKrSaved] = useState<boolean>(false);
  const [krVerifying, setKrVerifying] = useState<boolean>(false);
  const [krVerifyResult, setKrVerifyResult] = useState<LineWorksVerifyResult | null>(null);
  const [krTestingSend, setKrTestingSend] = useState<boolean>(false);
  const [krTestMsg, setKrTestMsg] = useState<{ success: boolean; text: string } | null>(null);

  // ===========================================================================
  // 3. イベント通知リマインダーBot State
  // ===========================================================================
  const [evEnabled, setEvEnabled] = useState<boolean>(settings.lineWorksEvents?.enabled ?? true);
  const [evUseCustomBot, setEvUseCustomBot] = useState<boolean>(
    Boolean(settings.lineWorksEvents?.botId && settings.lineWorksEvents?.botId !== settings.lineWorks?.botId) ||
    Boolean(settings.lineWorksEvents?.botId === '13233088')
  );
  const [evBotId, setEvBotId] = useState<string>(settings.lineWorksEvents?.botId || '13233088');
  const [evChannelId, setEvChannelId] = useState<string>(settings.lineWorksEvents?.channelId || '');
  const [evClientId, setEvClientId] = useState<string>(settings.lineWorksEvents?.clientId || '3Hmj_02_Yxg_nBmFX3ar');
  const [evClientSecret, setEvClientSecret] = useState<string>(settings.lineWorksEvents?.clientSecret || '');
  const [evServiceAccount, setEvServiceAccount] = useState<string>(settings.lineWorksEvents?.serviceAccount || '');
  const [evPrivateKey, setEvPrivateKey] = useState<string>(settings.lineWorksEvents?.privateKey || '');
  const [evServerId, setEvServerId] = useState<string>(settings.lineWorksEvents?.serverId || '40170745');

  const [evSaved, setEvSaved] = useState<boolean>(false);
  const [evVerifying, setEvVerifying] = useState<boolean>(false);
  const [evVerifyResult, setEvVerifyResult] = useState<LineWorksVerifyResult | null>(null);
  const [evTestingSend, setEvTestingSend] = useState<boolean>(false);
  const [evTestMsg, setEvTestMsg] = useState<{ success: boolean; text: string } | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 同期処理
  useEffect(() => {
    if (settings.lineWorks) {
      setAttEnabled(settings.lineWorks.enabled ?? false);
      setAttMode(settings.lineWorks.mode || 'api2');
      if (settings.lineWorks.webhookUrl) setAttWebhookUrl(settings.lineWorks.webhookUrl);
      if (settings.lineWorks.clientId) setAttClientId(settings.lineWorks.clientId);
      if (settings.lineWorks.clientSecret) setAttClientSecret(settings.lineWorks.clientSecret);
      if (settings.lineWorks.serviceAccount) setAttServiceAccount(settings.lineWorks.serviceAccount);
      if (settings.lineWorks.privateKey) setAttPrivateKey(settings.lineWorks.privateKey);
      if (settings.lineWorks.botId) setAttBotId(settings.lineWorks.botId);
      if (settings.lineWorks.channelId) setAttChannelId(settings.lineWorks.channelId);
      if (settings.lineWorks.serverId) setAttServerId(settings.lineWorks.serverId);
      setAttSendSummary(settings.lineWorks.sendDailySummary !== false);
      setAttSendTardy(settings.lineWorks.sendTardyAlert !== false);
    }

    if (settings.lineWorksKeyReminder) {
      setKrEnabled(settings.lineWorksKeyReminder.enabled ?? false);
      if (settings.lineWorksKeyReminder.botId) {
        setKrBotId(settings.lineWorksKeyReminder.botId);
        setKrUseCustomBot(settings.lineWorksKeyReminder.botId !== settings.lineWorks?.botId);
      }
      if (settings.lineWorksKeyReminder.channelId) setKrChannelId(settings.lineWorksKeyReminder.channelId);
      if (settings.lineWorksKeyReminder.clientId) setKrClientId(settings.lineWorksKeyReminder.clientId);
      if (settings.lineWorksKeyReminder.clientSecret) setKrClientSecret(settings.lineWorksKeyReminder.clientSecret);
      if (settings.lineWorksKeyReminder.serviceAccount) setKrServiceAccount(settings.lineWorksKeyReminder.serviceAccount);
      if (settings.lineWorksKeyReminder.privateKey) setKrPrivateKey(settings.lineWorksKeyReminder.privateKey);
      if (settings.lineWorksKeyReminder.serverId) setKrServerId(settings.lineWorksKeyReminder.serverId);
    }

    if (settings.lineWorksEvents) {
      setEvEnabled(settings.lineWorksEvents.enabled ?? true);
      if (settings.lineWorksEvents.botId) {
        setEvBotId(settings.lineWorksEvents.botId);
        setEvUseCustomBot(true);
      }
      if (settings.lineWorksEvents.channelId) setEvChannelId(settings.lineWorksEvents.channelId);
      if (settings.lineWorksEvents.clientId) setEvClientId(settings.lineWorksEvents.clientId);
      if (settings.lineWorksEvents.clientSecret) setEvClientSecret(settings.lineWorksEvents.clientSecret);
      if (settings.lineWorksEvents.serviceAccount) setEvServiceAccount(settings.lineWorksEvents.serviceAccount);
      if (settings.lineWorksEvents.privateKey) setEvPrivateKey(settings.lineWorksEvents.privateKey);
      if (settings.lineWorksEvents.serverId) setEvServerId(settings.lineWorksEvents.serverId);
    }
  }, [settings]);

  // 管理者モード時にFirestore settings/lineworks から最新設定を直接確認
  useEffect(() => {
    if (isAdmin) {
      fetchLineWorksConfigFromFirestore().then((cfg) => {
        if (cfg) {
          if (cfg.clientId) setAttClientId(cfg.clientId);
          if (cfg.clientSecret) setAttClientSecret(cfg.clientSecret);
          if (cfg.serviceAccount) setAttServiceAccount(cfg.serviceAccount);
          if (cfg.privateKey) setAttPrivateKey(cfg.privateKey);
          if (cfg.botId) setAttBotId(cfg.botId);
          if (cfg.channelId) setAttChannelId(cfg.channelId);
          if (cfg.serverId) setAttServerId(cfg.serverId);
          if (cfg.enabled !== undefined) setAttEnabled(cfg.enabled);
        }
      }).catch(console.warn);
    }
  }, [isAdmin]);

  // ===========================================================================
  // ハンドラー: 1. 出欠連絡・日報Bot
  // ===========================================================================
  const handleSaveAttendanceBot = async () => {
    setIsSaving(true);
    setAttTestMsg(null);
    try {
      const config: LineWorksConfig = {
        enabled: Boolean(attEnabled),
        mode: attMode,
        webhookUrl: attWebhookUrl.trim(),
        clientId: attClientId.trim(),
        clientSecret: attClientSecret.trim(),
        serviceAccount: attServiceAccount.trim(),
        privateKey: attPrivateKey.trim(),
        botId: attBotId.trim(),
        channelId: attChannelId.trim(),
        serverId: attServerId.trim() || '40170745',
        sendDailySummary: Boolean(attSendSummary),
        sendTardyAlert: Boolean(attSendTardy),
      };
      await saveLineWorksSettings(config);
      setAttSaved(true);
      setTimeout(() => setAttSaved(false), 3000);
    } catch (err: any) {
      setAttTestMsg({ success: false, text: `保存エラー: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyAttendanceAuth = async () => {
    setAttVerifying(true);
    setAttVerifyResult(null);
    setAttTestMsg(null);
    try {
      const result = await verifyLineWorksApi2Auth({
        clientId: attClientId.trim(),
        clientSecret: attClientSecret.trim(),
        serviceAccount: attServiceAccount.trim(),
        privateKey: attPrivateKey.trim(),
        serverId: attServerId.trim() || '40170745',
      });
      setAttVerifyResult(result);
      if (result.success) {
        setAttTestMsg({ success: true, text: '認証成功！アクセストークンの発行を確認しました。' });
      }
    } catch (e: any) {
      setAttTestMsg({ success: false, text: `認証例外: ${e.message}` });
    } finally {
      setAttVerifying(false);
    }
  };

  const handleTestAttendanceSend = async () => {
    setAttTestingSend(true);
    setAttTestMsg(null);
    try {
      const config: LineWorksConfig = {
        enabled: true,
        mode: attMode,
        webhookUrl: attWebhookUrl.trim(),
        clientId: attClientId.trim(),
        clientSecret: attClientSecret.trim(),
        serviceAccount: attServiceAccount.trim(),
        privateKey: attPrivateKey.trim(),
        botId: attBotId.trim(),
        channelId: attChannelId.trim(),
        serverId: attServerId.trim() || '40170745',
      };
      const res = await sendLineWorksNotification(
        config,
        `【テスト送信: 出欠連絡Bot】\nLINE WORKS連携のテスト通知です。\n正常に受信できています。（送信時刻: ${new Date().toLocaleTimeString('ja-JP')}）`
      );
      if (res.success) {
        setAttTestMsg({ success: true, text: 'テストメッセージを送信しました！トークルームをご確認ください。' });
      } else {
        setAttTestMsg({ success: false, text: `送信失敗: ${res.error || '不明なエラー'}` });
      }
    } catch (e: any) {
      setAttTestMsg({ success: false, text: `送信例外: ${e.message}` });
    } finally {
      setAttTestingSend(false);
    }
  };

  // ===========================================================================
  // ハンドラー: 2. 鍵施錠催促Bot
  // ===========================================================================
  const handleSaveKeyReminderBot = async () => {
    setIsSaving(true);
    setKrTestMsg(null);
    try {
      const base = krUseCustomBot
        ? {
            clientId: krClientId.trim(),
            clientSecret: krClientSecret.trim(),
            serviceAccount: krServiceAccount.trim(),
            privateKey: krPrivateKey.trim(),
            botId: krBotId.trim(),
            channelId: krChannelId.trim(),
            serverId: krServerId.trim() || '40170745',
            mode: 'api2' as const,
          }
        : {
            clientId: attClientId.trim(),
            clientSecret: attClientSecret.trim(),
            serviceAccount: attServiceAccount.trim(),
            privateKey: attPrivateKey.trim(),
            botId: attBotId.trim(),
            channelId: attChannelId.trim(),
            serverId: attServerId.trim() || '40170745',
            mode: attMode,
          };

      const config: LineWorksConfig = {
        ...base,
        enabled: Boolean(krEnabled),
        sendDailySummary: false,
        sendTardyAlert: false,
        sendEventReminder: false,
      };

      await saveLineWorksKeyReminderSettings(config);
      setKrSaved(true);
      setTimeout(() => setKrSaved(false), 3000);
    } catch (err: any) {
      setKrTestMsg({ success: false, text: `保存エラー: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestKeyReminderSend = async () => {
    setKrTestingSend(true);
    setKrTestMsg(null);
    try {
      const base = krUseCustomBot
        ? {
            clientId: krClientId.trim(),
            clientSecret: krClientSecret.trim(),
            serviceAccount: krServiceAccount.trim(),
            privateKey: krPrivateKey.trim(),
            botId: krBotId.trim(),
            channelId: krChannelId.trim(),
            serverId: krServerId.trim() || '40170745',
            mode: 'api2' as const,
          }
        : {
            clientId: attClientId.trim(),
            clientSecret: attClientSecret.trim(),
            serviceAccount: attServiceAccount.trim(),
            privateKey: attPrivateKey.trim(),
            botId: attBotId.trim(),
            channelId: attChannelId.trim(),
            serverId: attServerId.trim() || '40170745',
            mode: attMode,
          };

      const config: LineWorksConfig = {
        ...base,
        enabled: true,
      };

      const res = await sendLineWorksNotification(
        config,
        `【テスト送信: 鍵催促Bot】\n🔐 これは部室の鍵閉め忘れ催促用Botのテストメッセージです。\n指定時刻に未施錠の鍵がある場合、この形式で催促されます。（送信時刻: ${new Date().toLocaleTimeString('ja-JP')}）`
      );
      if (res.success) {
        setKrTestMsg({ success: true, text: '鍵催促テストを送信しました！トークルームをご確認ください。' });
      } else {
        setKrTestMsg({ success: false, text: `送信失敗: ${res.error || '不明なエラー'}` });
      }
    } catch (e: any) {
      setKrTestMsg({ success: false, text: `送信例外: ${e.message}` });
    } finally {
      setKrTestingSend(false);
    }
  };

  // ===========================================================================
  // ハンドラー: 3. イベント通知リマインダーBot
  // ===========================================================================
  const handleSaveEventsBot = async () => {
    setIsSaving(true);
    setEvTestMsg(null);
    try {
      const base = evUseCustomBot
        ? {
            clientId: evClientId.trim(),
            clientSecret: evClientSecret.trim(),
            serviceAccount: evServiceAccount.trim(),
            privateKey: evPrivateKey.trim(),
            botId: evBotId.trim(),
            channelId: evChannelId.trim(),
            serverId: evServerId.trim() || '40170745',
            mode: 'api2' as const,
          }
        : {
            clientId: attClientId.trim(),
            clientSecret: attClientSecret.trim(),
            serviceAccount: attServiceAccount.trim(),
            privateKey: attPrivateKey.trim(),
            botId: attBotId.trim(),
            channelId: attChannelId.trim(),
            serverId: attServerId.trim() || '40170745',
            mode: attMode,
          };

      const config: LineWorksConfig = {
        ...base,
        enabled: Boolean(evEnabled),
        sendDailySummary: false,
        sendTardyAlert: false,
        sendEventReminder: true,
      };

      await saveLineWorksEventsSettings(config);
      setEvSaved(true);
      setTimeout(() => setEvSaved(false), 3000);
    } catch (err: any) {
      setEvTestMsg({ success: false, text: `保存エラー: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEventsSend = async () => {
    setEvTestingSend(true);
    setEvTestMsg(null);
    try {
      const base = evUseCustomBot
        ? {
            clientId: evClientId.trim(),
            clientSecret: evClientSecret.trim(),
            serviceAccount: evServiceAccount.trim(),
            privateKey: evPrivateKey.trim(),
            botId: evBotId.trim(),
            channelId: evChannelId.trim(),
            serverId: evServerId.trim() || '40170745',
            mode: 'api2' as const,
          }
        : {
            clientId: attClientId.trim(),
            clientSecret: attClientSecret.trim(),
            serviceAccount: attServiceAccount.trim(),
            privateKey: attPrivateKey.trim(),
            botId: attBotId.trim(),
            channelId: attChannelId.trim(),
            serverId: attServerId.trim() || '40170745',
            mode: attMode,
          };

      const config: LineWorksConfig = {
        ...base,
        enabled: true,
      };

      const res = await sendLineWorksNotification(
        config,
        `【テスト送信: イベント通知Bot】\n📅 これはカレンダー予定（合宿・本番・ホール練習など）のリマインダー用Botのテストメッセージです。\n前日や当日朝にこのBotから予定が配信されます。（送信時刻: ${new Date().toLocaleTimeString('ja-JP')}）`
      );
      if (res.success) {
        setEvTestMsg({ success: true, text: 'イベント通知テストを送信しました！トークルームをご確認ください。' });
      } else {
        setEvTestMsg({ success: false, text: `送信失敗: ${res.error || '不明なエラー'}` });
      }
    } catch (e: any) {
      setEvTestMsg({ success: false, text: `送信例外: ${e.message}` });
    } finally {
      setEvTestingSend(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
              LINE WORKS Bot 総合管理（3ボット設定）
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              用途ごとに個別のBot IDやトークルーム（Channel）を割り当てて運用できます
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          管理者専用
        </span>
      </div>

      {/* 3ボット切り替えタブ */}
      <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/20 text-xs">
        {/* 1. 出欠Bot */}
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`py-3 px-2 font-bold text-center border-b-2 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'attendance'
              ? 'border-emerald-500 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center gap-1">
            <Bot className="w-4 h-4" />
            <span>① 出欠連絡Bot</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
            {attBotId ? `Bot: ${attBotId}` : '日報・速報'}
          </span>
        </button>

        {/* 2. 鍵催促Bot */}
        <button
          type="button"
          onClick={() => setActiveTab('keyReminder')}
          className={`py-3 px-2 font-bold text-center border-b-2 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'keyReminder'
              ? 'border-amber-500 bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center gap-1">
            <BellRing className="w-4 h-4" />
            <span>② 鍵施錠催促Bot</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
            {krUseCustomBot ? (krBotId ? `Bot: ${krBotId}` : '専用Bot') : '出欠Botと共通'}
          </span>
        </button>

        {/* 3. イベントBot */}
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`py-3 px-2 font-bold text-center border-b-2 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'events'
              ? 'border-purple-500 bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center gap-1">
            <CalendarCheck className="w-4 h-4" />
            <span>③ イベント通知Bot</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
            {evUseCustomBot ? (evBotId ? `Bot: ${evBotId}` : '専用Bot') : '出欠Botと共通'}
          </span>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* ================================================================= */}
        {/* TAB 1: ① 出欠連絡・日報Bot */}
        {/* ================================================================= */}
        {activeTab === 'attendance' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100 block">
                  出欠連絡・日報Bot 連携
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mt-0.5">
                  部員の遅刻・欠席連絡の即時速報や、毎日の出欠集計（18:00等）をトークルームへ通知します
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={attEnabled}
                  onChange={(e) => setAttEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {attSaved && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>出欠連絡Botの設定を保存しました（Firestore: settings/lineworks）</span>
              </div>
            )}

            {attTestMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  attTestMsg.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-200'
                }`}
              >
                {attTestMsg.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{attTestMsg.text}</span>
              </div>
            )}

            {/* 入力フォーム */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Bot ID
                  </label>
                  <input
                    type="text"
                    value={attBotId}
                    onChange={(e) => setAttBotId(e.target.value)}
                    placeholder="例: 13183868"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Channel ID（トークルームID）
                  </label>
                  <input
                    type="text"
                    value={attChannelId}
                    onChange={(e) => setAttChannelId(e.target.value)}
                    placeholder="例: efb72ade-b098-c0f4-3f54-09967fcc1018"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={attClientId}
                  onChange={(e) => setAttClientId(e.target.value)}
                  placeholder="例: V5cuZxKv5jxaREnXzqRk"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={attClientSecret}
                    onChange={(e) => setAttClientSecret(e.target.value)}
                    placeholder="Client Secret"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Server ID
                  </label>
                  <input
                    type="text"
                    value={attServerId}
                    onChange={(e) => setAttServerId(e.target.value)}
                    placeholder="40170745"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Service Account
                </label>
                <input
                  type="text"
                  value={attServiceAccount}
                  onChange={(e) => setAttServiceAccount(e.target.value)}
                  placeholder="例: c468x.serviceaccount@works-330883"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Private Key (RSA秘密鍵)
                </label>
                <textarea
                  value={attPrivateKey}
                  onChange={(e) => setAttPrivateKey(e.target.value)}
                  rows={3}
                  placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* 送信オプション */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attSendSummary}
                    onChange={(e) => setAttSendSummary(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    毎日決まった時刻（18:00等）に当日の出欠日報を自動配信する
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attSendTardy}
                    onChange={(e) => setAttSendTardy(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    部員の「緊急遅刻・欠席」受信時にLINE WORKSへ即時速報する
                  </span>
                </label>
              </div>

              {/* 操作ボタン */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyAttendanceAuth}
                    disabled={attVerifying}
                    className="py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {attVerifying ? '認証確認中...' : '認証テスト実行'}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestAttendanceSend}
                    disabled={attTestingSend}
                    className="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {attTestingSend ? '送信中...' : 'テスト送信'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveAttendanceBot}
                  disabled={isSaving}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? '保存中...' : '出欠連絡Bot設定を保存する'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ② 鍵施錠催促Bot */}
        {/* ================================================================= */}
        {activeTab === 'keyReminder' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-100 block">
                  鍵施錠催促Bot 連携
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300 block mt-0.5">
                  部室の鍵が未施錠の際の定期催促通知、および鍵を閉めたときの「施錠報告」メッセージをLINE WORKSへ自動投稿します
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={krEnabled}
                  onChange={(e) => setKrEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {krSaved && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>鍵催促Botの設定を保存しました</span>
              </div>
            )}

            {krTestMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  krTestMsg.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-200'
                }`}
              >
                {krTestMsg.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{krTestMsg.text}</span>
              </div>
            )}

            {/* ボット割り当て選択 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <label className="font-bold text-slate-800 dark:text-slate-200 block">
                使用するBot
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKrUseCustomBot(false)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                    !krUseCustomBot
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <p className="font-bold">① 出欠連絡Botと共通</p>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">同じBot・トークルームへ投稿</p>
                </button>

                <button
                  type="button"
                  onClick={() => setKrUseCustomBot(true)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                    krUseCustomBot
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <p className="font-bold">② 鍵催促専用Bot</p>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">別のBot ID・トークルームを指定</p>
                </button>
              </div>
            </div>

            {/* 個別Bot設定フォーム */}
            {krUseCustomBot ? (
              <div className="space-y-3 text-xs pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      鍵催促 Bot ID
                    </label>
                    <input
                      type="text"
                      value={krBotId}
                      onChange={(e) => setKrBotId(e.target.value)}
                      placeholder="例: 13183868"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Channel ID（トークルーム）
                    </label>
                    <input
                      type="text"
                      value={krChannelId}
                      onChange={(e) => setKrChannelId(e.target.value)}
                      placeholder="例: efb72ade-..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={krClientId}
                    onChange={(e) => setKrClientId(e.target.value)}
                    placeholder="鍵催促用 Client ID"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={krClientSecret}
                      onChange={(e) => setKrClientSecret(e.target.value)}
                      placeholder="Client Secret"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Server ID
                    </label>
                    <input
                      type="text"
                      value={krServerId}
                      onChange={(e) => setKrServerId(e.target.value)}
                      placeholder="40170745"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Service Account
                  </label>
                  <input
                    type="text"
                    value={krServiceAccount}
                    onChange={(e) => setKrServiceAccount(e.target.value)}
                    placeholder="例: c468x.serviceaccount@works-330883"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Private Key (RSA秘密鍵)
                  </label>
                  <textarea
                    value={krPrivateKey}
                    onChange={(e) => setKrPrivateKey(e.target.value)}
                    rows={3}
                    placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                出欠連絡Bot（Bot ID: {attBotId || '未設定'} / Channel: {attChannelId ? `${attChannelId.slice(0, 12)}...` : '未設定'}）の認証情報をそのまま使用して鍵の催促を送信します。
              </div>
            )}

            {/* 操作ボタン */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleTestKeyReminderSend}
                disabled={krTestingSend}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <BellRing className="w-3.5 h-3.5" />
                {krTestingSend ? '送信中...' : '鍵催促テストメッセージを送信'}
              </button>

              <button
                type="button"
                onClick={handleSaveKeyReminderBot}
                disabled={isSaving}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {isSaving ? '保存中...' : '鍵催促Bot設定を保存する'}
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: ③ イベント通知リマインダーBot */}
        {/* ================================================================= */}
        {activeTab === 'events' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-purple-900 dark:text-purple-100 block">
                  イベント通知リマインダーBot 連携
                </span>
                <span className="text-[11px] text-purple-700 dark:text-purple-300 block mt-0.5">
                  合宿・コンクール・本番などの予定日前日や当日に、持ち物や集合時間のリマインドを自動投稿します
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={evEnabled}
                  onChange={(e) => setEvEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {evSaved && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>イベント通知Botの設定を保存しました</span>
              </div>
            )}

            {evTestMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  evTestMsg.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-200'
                }`}
              >
                {evTestMsg.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{evTestMsg.text}</span>
              </div>
            )}

            {/* ボット割り当て選択 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <label className="font-bold text-slate-800 dark:text-slate-200 block">
                使用するBot
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEvUseCustomBot(false)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                    !evUseCustomBot
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <p className="font-bold">① 出欠連絡Botと共通</p>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">出欠と同じBot・トークルームへ投稿</p>
                </button>

                <button
                  type="button"
                  onClick={() => setEvUseCustomBot(true)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                    evUseCustomBot
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <p className="font-bold">③ イベント専用Bot</p>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5">
                    Bot ID: {evBotId || '13233088'}
                  </p>
                </button>
              </div>
            </div>

            {/* 個別Bot設定フォーム */}
            {evUseCustomBot ? (
              <div className="space-y-3 text-xs pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      イベント Bot ID
                    </label>
                    <input
                      type="text"
                      value={evBotId}
                      onChange={(e) => setEvBotId(e.target.value)}
                      placeholder="例: 13233088"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Channel ID（トークルーム）
                    </label>
                    <input
                      type="text"
                      value={evChannelId}
                      onChange={(e) => setEvChannelId(e.target.value)}
                      placeholder="例: efb72ade-..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={evClientId}
                    onChange={(e) => setEvClientId(e.target.value)}
                    placeholder="例: 3Hmj_02_Yxg_nBmFX3ar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={evClientSecret}
                      onChange={(e) => setEvClientSecret(e.target.value)}
                      placeholder="Client Secret"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Server ID
                    </label>
                    <input
                      type="text"
                      value={evServerId}
                      onChange={(e) => setEvServerId(e.target.value)}
                      placeholder="40170745"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Service Account
                  </label>
                  <input
                    type="text"
                    value={evServiceAccount}
                    onChange={(e) => setEvServiceAccount(e.target.value)}
                    placeholder="例: 4dv34.serviceaccount@works-330883"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Private Key (RSA秘密鍵)
                  </label>
                  <textarea
                    value={evPrivateKey}
                    onChange={(e) => setEvPrivateKey(e.target.value)}
                    rows={3}
                    placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                出欠連絡Bot（Bot ID: {attBotId || '未設定'} / Channel: {attChannelId ? `${attChannelId.slice(0, 12)}...` : '未設定'}）の認証情報をそのまま使用してイベント通知を送信します。
              </div>
            )}

            {/* 操作ボタン */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleTestEventsSend}
                disabled={evTestingSend}
                className="w-full py-2.5 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-purple-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                {evTestingSend ? '送信中...' : 'イベント通知テストメッセージを送信'}
              </button>

              <button
                type="button"
                onClick={handleSaveEventsBot}
                disabled={isSaving}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {isSaving ? '保存中...' : 'イベント通知Bot設定を保存する'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
