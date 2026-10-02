import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lock,
  Key,
  CheckCircle2,
  Clock,
  User,
  History,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  Bell,
  RotateCcw,
} from 'lucide-react';
import { getTodayString } from '../utils/date';
import { KeyId, ClubKeyStatus } from '../types';

export const ClubKeyCard: React.FC = () => {
  const {
    keyStatuses,
    keyLogs,
    reportKeyClosed,
    resetKeyStatus,
    settings,
    isAdmin,
    myMemberName,
    myMemberSection,
    myMemberPart,
    setMyMemberProfile,
    members,
  } = useApp();

  const [submittingKey, setSubmittingKey] = useState<KeyId | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [resetConfirm, setResetConfirm] = useState<KeyId | null>(null);
  const [tempName, setTempName] = useState(myMemberName);
  const [tempSection, setTempSection] = useState(myMemberSection || '');
  const [tempPart, setTempPart] = useState(myMemberPart || '');

  // ログイン情報や出欠入力等で名前が設定・変更された場合、ローカルの入力用Stateも同期する
  useEffect(() => {
    // 編集モード中でない場合のみ自動同期（入力中の内容を上書きしないため）
    if (!showNameEdit) {
      setTempName(myMemberName);
      setTempSection(myMemberSection || '');
      setTempPart(myMemberPart || '');
    }
  }, [myMemberName, myMemberSection, myMemberPart, showNameEdit]);

  // 鍵の名前（管理者が設定した名称、初期値は「鍵①」「鍵②」）
  const key1Name = settings.keyNames?.key1 || '鍵①';
  const key2Name = settings.keyNames?.key2 || '鍵②';

  // 今日の施錠報告かどうか判定するヘルパー
  const checkIsReportedToday = (status: ClubKeyStatus | null | undefined): boolean => {
    if (!status || !status.updatedAt) return false;
    const today = getTodayString(); // YYYY-MM-DD
    
    // Get YYYY-MM-DD from status.updatedAt in JST
    const jstDateStr = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(status.updatedAt)).replace(/\//g, '-');
    
    return jstDateStr === today && status.status === 'closed';
  };

  const isKey1ReportedToday = useMemo(() => checkIsReportedToday(keyStatuses?.key1), [keyStatuses?.key1]);
  const isKey2ReportedToday = useMemo(() => checkIsReportedToday(keyStatuses?.key2), [keyStatuses?.key2]);

  // 時刻フォーマット（例: "18:30" または "昨日 18:30"）
  const formatTimeDisplay = (timestamp: number): string => {
    if (!timestamp) return '記録なし';
    
    const todayStr = getTodayString();
    const date = new Date(timestamp);
    const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = jstFormatter.formatToParts(date);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    
    const jstYear = getPart('year');
    const jstMonth = getPart('month');
    const jstDay = getPart('day');
    const jstHours = getPart('hour');
    const jstMinutes = getPart('minute');
    const jstDateStr = `${jstYear}-${jstMonth}-${jstDay}`;
    const timeStr = `${jstHours}:${jstMinutes}`;

    if (jstDateStr === todayStr) {
      return timeStr;
    } else {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yParts = jstFormatter.formatToParts(yesterday);
      const getYPart = (type: string) => yParts.find(p => p.type === type)?.value || '';
      const yesterdayStr = `${getYPart('year')}-${getYPart('month')}-${getYPart('day')}`;
      
      if (jstDateStr === yesterdayStr) {
        return `昨日 ${timeStr}`;
      }
      return `${parseInt(jstMonth, 10)}/${parseInt(jstDay, 10)} ${timeStr}`;
    }
  };

  // ワンタップで「鍵を閉めました」を報告
  const handleReportKey = async (keyId: KeyId) => {
    if (submittingKey) return;

    // 名前未設定の場合は設定フォームを開く
    const currentName = myMemberName.trim();
    if (!currentName) {
      setShowNameEdit(true);
      return;
    }

    const currentKeyName = keyId === 'key1' ? key1Name : key2Name;

    try {
      setSubmittingKey(keyId);
      await reportKeyClosed(keyId, currentName, myMemberSection, myMemberPart);
      setSuccessToast(`${currentKeyName}「閉めました」を報告しました（${currentName}さん）`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
    } catch (err) {
      console.error(`Failed to report key closed status for ${keyId}:`, err);
    } finally {
      setSubmittingKey(null);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      setMyMemberProfile(tempName.trim(), tempSection, tempPart);
      setShowNameEdit(false);
    }
  };

  const handleResetKey = async (keyId: KeyId) => {
    if (!resetConfirm) return;
    
    try {
      await resetKeyStatus(keyId, myMemberName || '部員');
      setResetConfirm(null);
      setSuccessToast(`${keyId === 'key1' ? key1Name : key2Name}の報告をリセットしました`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      console.error('Failed to reset key status:', err);
    }
  };

  // 鍵セクションのレンダリング
  const renderKeySection = (
    keyId: KeyId,
    keyName: string,
    status: ClubKeyStatus | null | undefined,
    isReportedToday: boolean
  ) => {
    const isSubmittingThisKey = submittingKey === keyId;
    const operator = status?.operatorName || '';
    const section = status?.operatorSection;
    const updatedAt = status?.updatedAt || 0;
    
    const canReset = !settings.keyResetAdminOnly || isAdmin;

    return (
      <div
        id={`key-section-${keyId}`}
        className={`p-4 rounded-xl border-2 transition-all duration-300 flex flex-col justify-between relative ${
          isReportedToday
            ? 'bg-gradient-to-b from-emerald-50/70 to-emerald-50/30 dark:from-emerald-950/40 dark:to-emerald-950/20 border-emerald-400 dark:border-emerald-600 shadow-sm'
            : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80'
        }`}
      >
        {/* リセットボタン（報告済みの場合のみ表示、または権限がある場合） */}
        {isReportedToday && canReset && (
          <button
            type="button"
            title="報告をリセット"
            onClick={() => setResetConfirm(keyId)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/50 dark:bg-slate-900/40 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors z-10"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* セクション上部: 鍵の名前 & 状態表示 */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  isReportedToday
                    ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                    : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                }`}
              >
                {keyId === 'key1' ? '①' : '②'}
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {keyName}
              </h4>
            </div>

            {/* 状態バッジ */}
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 transition-colors ${
                isReportedToday
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 flex items-center gap-1'
                  : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300'
              }`}
            >
              {isReportedToday ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>施錠済み</span>
                </>
              ) : (
                <span>未報告</span>
              )}
            </span>
          </div>

          {/* 各鍵のセクション上部に、最後に閉めた人の名前と時刻を大きく分かりやすく表示 */}
          <div className="text-xs">
            {isReportedToday ? (
              <div className="p-3 rounded-xl bg-emerald-100/90 dark:bg-emerald-950/70 border-2 border-emerald-400 dark:border-emerald-600/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    施錠報告者
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 bg-white/70 dark:bg-slate-900/60 px-2 py-0.5 rounded-md">
                    <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    {formatTimeDisplay(updatedAt)}
                  </span>
                </div>
                {/* 報告者名を特大・極太字で一目瞭然に！ */}
                <div className="flex items-center gap-2.5 pt-0.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs ring-2 ring-white dark:ring-slate-900">
                    {operator ? operator.trim().charAt(0) : '鍵'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">
                        {operator || '部員'}
                      </span>
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        さん
                      </span>
                      {section && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/90 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700">
                          {section}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : updatedAt > 0 ? (
              <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    本日未報告
                  </span>
                  <span className="text-[10px] text-slate-400">前回: {formatTimeDisplay(updatedAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0">前回の施錠者:</span>
                  <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 truncate">
                    {operator} さん
                  </span>
                  {section && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      ({section})
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60">
                <span className="font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                  本日はまだ施錠報告がありません
                </span>
                <span className="text-[11px] block text-slate-500 dark:text-slate-400 mt-0.5">
                  施錠した部員は下のボタンを押してください
                </span>
              </div>
            )}

            {/* 催促通知の設定状況表示（未報告時） */}
            {!isReportedToday && settings.keyReminders?.enabled && (
              <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                <span className="leading-tight">
                  {settings.keyReminders.startTime}に未施錠の場合、自動催促（{settings.keyReminders.intervalMinutes}分間隔 / 最大{settings.keyReminders.maxCount}回）
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ワンタップ施錠ボタン
            - 未報告時: 青色ボタン「🔒 閉めました（〇〇さんとして報告）」
            - 押した後（報告済み）: はっきり緑色に変わり「✓ 閉めました（報告者: 〇〇さん）」
        */}
        <button
          type="button"
          id={`btn-report-key-${keyId}`}
          disabled={isSubmittingThisKey}
          onClick={() => handleReportKey(keyId)}
          className={`w-full py-3 px-3 rounded-xl font-extrabold text-sm sm:text-base flex flex-col items-center justify-center gap-0.5 transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-md ${
            isReportedToday
              ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white ring-4 ring-emerald-400/40 shadow-emerald-600/25'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white ring-2 ring-blue-400/30 shadow-blue-600/20'
          }`}
        >
          {isSubmittingThisKey ? (
            <div className="flex items-center gap-1.5 py-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>送信中...</span>
            </div>
          ) : isReportedToday ? (
            <>
              <div className="flex items-center gap-1.5">
                <Check className="w-5 h-5 text-white stroke-[3] shrink-0" />
                <span>✓ 閉めました（報告済）</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-100">
                報告者: {operator || myMemberName} さん
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-white shrink-0" />
                <span>🔒 閉めました</span>
              </div>
              <span className="text-[11px] font-medium text-blue-100">
                （{myMemberName ? `${myMemberName}さんとして報告` : 'タップして名前を設定'}）
              </span>
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div
      id="club-key-report-card"
      className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border-2 border-slate-300 dark:border-slate-700 shadow-sm space-y-3.5 transition-all duration-300"
    >
      {/* カードヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              部室の鍵・施錠報告
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                2鍵対応
              </span>
            </h3>
          </div>
        </div>

        {/* 全体の施錠完了インジケーター */}
        <div className="flex items-center gap-1 text-xs self-start sm:self-auto">
          {isKey1ReportedToday && isKey2ReportedToday ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              両方の鍵が施錠済み
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-200 dark:border-slate-700">
              各鍵のボタンをタップして報告
            </span>
          )}
        </div>
      </div>

      {/* 完了トーストフィードバック */}
      {successToast && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 text-xs font-bold animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 【報告者名の明示バッジ】鍵を報告する人が誰なのかを一目でわかるように表示 */}
      <div
        id="current-reporter-info-banner"
        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
          myMemberName
            ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
            : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
              myMemberName
                ? 'bg-blue-600 text-white'
                : 'bg-amber-500 text-white animate-pulse'
            }`}
          >
            {myMemberName ? myMemberName.trim().charAt(0) : <User className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block leading-tight">
              あなたの報告者名（施錠操作者）
            </span>
            {myMemberName ? (
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate">
                  {myMemberName}
                </span>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">さん</span>
                {(myMemberSection || myMemberPart) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                    {myMemberSection}{myMemberPart ? ` / ${myMemberPart}` : ''}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
                名前が未設定です（タップして設定）
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            id="btn-edit-reporter-name-top"
            onClick={() => setShowNameEdit(!showNameEdit)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              myMemberName
                ? 'bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs animate-bounce'
            }`}
          >
            {showNameEdit ? '閉じる' : myMemberName ? '名前変更' : '名前を設定する'}
          </button>
        </div>
      </div>

      {/* 報告者名前のインライン設定フォーム */}
      {showNameEdit && (
        <form
          onSubmit={handleSaveProfile}
          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-2 border-blue-300 dark:border-blue-700 space-y-3 animate-in fade-in"
        >
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>鍵の施錠時に記録されるお名前を設定してください</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                お名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="例: 今江司"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                区分（木管・金管・打楽器等）
              </label>
              <input
                type="text"
                value={tempSection}
                onChange={(e) => setTempSection(e.target.value)}
                placeholder="例: 木管"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 部員一覧クイック選択 */}
          {members.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                登録済み部員から選択:
              </span>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setTempName(m.name);
                      setTempSection(m.section || '');
                      setTempPart(m.part || '');
                    }}
                    className={`px-2 py-0.5 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      tempName === m.name
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowNameEdit(false)}
              className="px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer shadow-xs"
            >
              保存する
            </button>
          </div>
        </form>
      )}

      {/* 2つの鍵それぞれのセクション（スマホは縦並び、タブレット以上は2列） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {renderKeySection('key1', key1Name, keyStatuses?.key1, isKey1ReportedToday)}
        {renderKeySection('key2', key2Name, keyStatuses?.key2, isKey2ReportedToday)}
      </div>

      {/* リセット確認ダイアログ */}
      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border-2 border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-6 h-6" />
              <h4 className="text-lg font-black">報告のリセット</h4>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {resetConfirm === 'key1' ? key1Name : key2Name}の「施錠済み」報告をリセットしますか？
              <br />
              <span className="text-[11px] font-bold text-slate-400 mt-1 block">※ 前回の報告履歴は保持されます。</span>
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirm(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleResetKey(resetConfirm)}
                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-colors"
              >
                リセットする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カード下部: 履歴開閉ボタン */}
      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="text-[11px] text-slate-400">
            施錠ボタンを押すとリアルタイムで反映されます
          </span>
          <button
            type="button"
            id="btn-toggle-key-history"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer transition-colors"
          >
            <History className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>施錠履歴を見る</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 施錠履歴リスト */}
        {showHistory && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5 animate-in fade-in">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
              最近の施錠履歴（直近5件）
            </span>
            {keyLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">施錠履歴はありません</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                {keyLogs.slice(0, 5).map((log) => {
                  const logKeyName = log.keyName || (log.keyId === 'key2' ? key2Name : key1Name);
                  return (
                    <div key={log.id} className="py-2 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                          {log.operatorName ? log.operatorName.trim().charAt(0) : '鍵'}
                        </div>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 shrink-0">
                          {logKeyName}
                        </span>
                        <div className="min-w-0 truncate">
                          <span className="font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                            {log.operatorName}
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-0.5">さん</span>
                          {log.operatorSection && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5 font-medium">
                              [{log.operatorSection}]
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold shrink-0 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {formatTimeDisplay(log.updatedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
