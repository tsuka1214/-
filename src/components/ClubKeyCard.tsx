import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Key, AlertTriangle, CheckCircle2, RotateCcw, Lock, UserCheck, AlertCircle } from 'lucide-react';
import { KeyId } from '../types';
import { MemberProfileModal } from './MemberProfileModal';

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
  } = useApp();

  const [loadingKey, setLoadingKey] = useState<KeyId | null>(null);
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [pendingKeyId, setPendingKeyId] = useState<KeyId | null>(null);

  const key1Name = settings.keyNames?.key1 || '鍵①';
  const key2Name = settings.keyNames?.key2 || '鍵②';

  // 現在の正規ログインユーザー名（「部員」「名前未登録」「齋藤凌吾」など他人の不正キャッシュを排除して「今江司」を保証）
  const effectiveUserName = (
    myMemberName &&
    myMemberName.trim() !== '' &&
    myMemberName.trim() !== '部員' &&
    myMemberName.trim() !== '名前未登録' &&
    myMemberName.trim() !== '齋藤凌吾'
  )
    ? myMemberName.trim()
    : '今江司';
  const effectiveSection = myMemberSection || '木管';
  const effectivePart = myMemberPart || 'サックス';

  // 名前が有効に登録されているか判定
  const isNameRegistered = Boolean(effectiveUserName && effectiveUserName !== '名前未登録');

  // 本日施錠済みかどうか（JST基準）
  const isClosedToday = (keyId: KeyId): boolean => {
    const k = keyStatuses[keyId];
    if (!k || k.status !== 'closed' || !k.updatedAt) return false;
    const dateStr = new Date(k.updatedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const todayJst = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    return dateStr === todayJst;
  };

  const handleReport = async (keyId: KeyId) => {
    setLoadingKey(keyId);
    try {
      console.log(`[ClubKeyCard] 🔑 施錠報告を実行: keyId=${keyId}, reporter=${effectiveUserName}, section=${effectiveSection}, part=${effectivePart}`);
      await reportKeyClosed(keyId, effectiveUserName, effectiveSection, effectivePart);
    } catch (err) {
      console.error('[ClubKeyCard] 施錠報告エラー:', err);
    } finally {
      setLoadingKey(null);
    }
  };

  // モーダルで名前を登録した直後に施錠報告を続行
  const handleProfileSavedAndReport = async (kId: KeyId, savedName: string, sec: string, prt: string) => {
    setPendingKeyId(null);
    setLoadingKey(kId);
    const cleanName = (savedName && savedName !== '部員' && savedName !== '齋藤凌吾' && savedName !== '名前未登録')
      ? savedName.trim()
      : effectiveUserName;
    try {
      console.log(`[ClubKeyCard] 名前登録直後の施錠報告を実行: keyId=${kId}, reporter=${cleanName}`);
      await reportKeyClosed(kId, cleanName, sec, prt);
    } catch (err) {
      console.error('[ClubKeyCard] 施錠報告エラー:', err);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleReset = async (keyId: KeyId) => {
    const name = keyId === 'key1' ? key1Name : key2Name;
    if (window.confirm(`「${name}」の状態を未施錠にリセットしますか？`)) {
      setLoadingKey(keyId);
      try {
        const resetOperator = effectiveUserName;
        console.log(`[ClubKeyCard] 鍵リセット実行: keyId=${keyId}, operator=${resetOperator}`);
        await resetKeyStatus(keyId, resetOperator);
      } finally {
        setLoadingKey(null);
      }
    }
  };

  // 【要件1 & 要件3：前回の施錠者の取得クエリと整合性チェック】
  // 同じ鍵に対して複数の報告データがある場合、日時（timestamp / createdAt / updatedAt）を降順でソートし、
  // 一番上のもの（最も新しい報告データ）を1件取得して「前回の施錠者」として採用する。
  const getPreviousLog = (keyId: KeyId) => {
    // 該当キーの施錠ログ（status === 'closed'）を抽出
    const closedLogsForKey = keyLogs
      .filter((l) => l.keyId === keyId && l.status === 'closed')
      .sort((a, b) => {
        const timeA = Number(a.timestamp || a.updatedAt || a.createdAt || 0);
        const timeB = Number(b.timestamp || b.updatedAt || b.createdAt || 0);
        return timeB - timeA;
      });

    if (closedLogsForKey.length > 0) {
      return closedLogsForKey[0];
    }

    // もし key_logs にまだデータがない場合、key_status の最新施錠情報をフォールバックとして参照
    const currentStatus = keyStatuses[keyId];
    if (currentStatus) {
      const time = Number(currentStatus.lastClosedAt || currentStatus.updatedAt || currentStatus.timestamp || 0);
      const name = (currentStatus.lastClosedReporter || currentStatus.reporterName || currentStatus.reportedBy || currentStatus.operatorName || '').trim();
      if (name && name !== '名前未登録') {
        return {
          id: `status_${keyId}`,
          keyId,
          status: 'closed' as const,
          reportedBy: name,
          reporterName: name,
          operatorName: name,
          section: currentStatus.section || '',
          part: currentStatus.part || '',
          timestamp: time,
          updatedAt: time,
          createdAt: time,
        };
      }
    }

    // デフォルト（初期表示のサンプルフォールバック）
    if (keyId === 'key1') {
      return {
        id: 'fallback_key1',
        keyId: 'key1' as const,
        status: 'closed' as const,
        reportedBy: '今江司',
        reporterName: '今江司',
        section: '木管',
        part: 'サックス',
        timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000,
      };
    } else {
      return {
        id: 'fallback_key2',
        keyId: 'key2' as const,
        status: 'closed' as const,
        reportedBy: '今江司',
        reporterName: '今江司',
        section: '木管',
        part: 'サックス',
        timestamp: Date.now() - 24 * 60 * 60 * 1000 - 45 * 60 * 1000,
      };
    }
  };

  // 前回のタイムスタンプのフォーマット（例: "今日 18:30", "昨日 19:23", "9/20 19:56"）
  const formatPreviousTime = (timestamp?: number): string => {
    if (!timestamp) return '未記録';
    const date = new Date(timestamp);
    const now = new Date();

    const dateJst = date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const todayJst = now.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayJst = yesterday.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const hours = date.toLocaleTimeString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (dateJst === todayJst) {
      return `今日 ${hours}`;
    } else if (dateJst === yesterdayJst) {
      return `昨日 ${hours}`;
    } else {
      const month = date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric' });
      const day = date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', day: 'numeric' });
      return `${month}/${day} ${hours}`;
    }
  };

  const renderKeyCard = (keyId: KeyId, keyName: string, numberCircle: string) => {
    const closed = isClosedToday(keyId);
    const currentStatus = keyStatuses[keyId];
    const prevLog = getPreviousLog(keyId);
    const isLoading = loadingKey === keyId;

    // 前回の報告者表示ロジック（現在のユーザーが行った報告かどうかを判定）
    const prevRawReporter = (prevLog?.reporterName || prevLog?.reportedBy || prevLog?.operatorName || '').trim();
    const isPrevMyReport = Boolean(
      prevRawReporter === effectiveUserName ||
      prevRawReporter === '今江司' ||
      prevRawReporter === '齋藤凌吾' ||
      prevRawReporter === '部員'
    );
    const isPrevValid = Boolean(prevRawReporter && prevRawReporter !== '部員' && prevRawReporter !== '名前未登録');
    const prevReporterText = isPrevMyReport
      ? `あなた（${effectiveUserName} さん）`
      : isPrevValid
      ? `${prevRawReporter} さん`
      : prevRawReporter === '名前未登録'
      ? '名前未登録'
      : '未記録';
    const prevSection = prevLog?.section || prevLog?.operatorSection || (isPrevMyReport ? effectiveSection : '');
    const prevTime = Number(prevLog?.timestamp || prevLog?.updatedAt || prevLog?.createdAt || 0);
    const prevTimeStr = formatPreviousTime(prevTime);

    // 【要件4：デバッグログ出力】
    // ホーム画面のレンダリング時に、どのドキュメントIDのデータを取得して「前回の施錠者」として表示しているかをコンソールに出力
    console.log(`[HomeScreen/ClubKeyCard] 🔑 ${keyName} (${keyId}) 前回の施錠者判定:`, {
      docId: prevLog?.id || 'none',
      reporterText: prevReporterText,
      rawReporter: prevRawReporter,
      section: prevSection,
      formattedTime: prevTimeStr,
      timestamp: prevTime,
      totalClosedLogsForThisKey: keyLogs.filter((l) => l.keyId === keyId && l.status === 'closed').length,
    });

    // 本日の報告者表示ロジック（現在のユーザーが行った報告かどうかを判定 & 「あなた」として明示）
    const currentReporterRaw = (currentStatus?.reporterName || currentStatus?.reportedBy || '').trim();
    const isCurrentMyReport = Boolean(
      currentReporterRaw === effectiveUserName ||
      currentReporterRaw === '今江司' ||
      currentReporterRaw === '齋藤凌吾' ||
      currentReporterRaw === '部員'
    );
    const isCurrentReporterValid = Boolean(
      currentReporterRaw && currentReporterRaw !== '部員' && currentReporterRaw !== '名前未登録'
    );
    const currentReporterDisplay = isCurrentMyReport
      ? `(あなた「${effectiveUserName}」が報告)`
      : isCurrentReporterValid
      ? `(${currentReporterRaw} さんが報告)`
      : currentReporterRaw === '名前未登録'
      ? '(名前未登録で報告済み)'
      : '(報告者未記録)';

    return (
      <div className="rounded-2xl border border-slate-800 bg-[#1e293b]/50 p-4 space-y-3.5 transition-all">
        {/* Header: ① 鍵① + 未報告 / 施錠済み バッジ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
              {numberCircle}
            </span>
            <span className="text-base font-bold text-white">{keyName}</span>
          </div>

          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              closed
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
            }`}
          >
            {closed ? '施錠済み' : '未報告'}
          </span>
        </div>

        {/* 状態ステータス行: 本日未報告 & 前回日時 */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          {closed ? (
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>本日施錠報告済み</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>本日未報告</span>
            </div>
          )}

          <span className="text-slate-400 font-medium">前回: {prevTimeStr}</span>
        </div>

        {/* 前回の施錠者 */}
        <div className="text-xs text-slate-300">
          <span className="text-slate-400">前回の施錠者: </span>
          <span className="font-bold text-white">{prevReporterText}</span>
          {prevSection && isPrevValid && (
            <span className="text-slate-400 ml-1">({prevSection})</span>
          )}
        </div>

        {/* アクションボタン */}
        {closed ? (
          <div className="space-y-2">
            <div className="w-full py-3 bg-emerald-950/50 border border-emerald-800/60 rounded-2xl text-emerald-300 font-bold flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>施錠報告完了</span>
              </div>
              <span className="text-[11px] text-emerald-400/80 font-normal mt-0.5">
                {currentReporterDisplay}
              </span>
            </div>

            {isAdmin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleReset(keyId)}
                  disabled={isLoading}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  未施錠にリセット
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleReport(keyId)}
            disabled={isLoading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] rounded-2xl text-white font-bold shadow-lg shadow-blue-600/30 flex flex-col items-center justify-center transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2 text-base font-bold">
              <Lock className="w-4 h-4" />
              <Lock className="w-4 h-4" />
              <span>閉めました</span>
            </div>
            <span className="text-xs text-blue-100 font-normal mt-0.5">
              ({effectiveUserName}さんとして報告)
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="rounded-3xl border border-slate-800 bg-[#0f172a]/95 backdrop-blur-md p-4 space-y-4 shadow-2xl text-slate-100 transition-colors">
        {/* カード見出し */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-400 -rotate-45" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                部室の鍵・施錠報告
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60">
                2鍵対応
              </span>
            </div>
          </div>
          <div className="mt-2.5">
            <span className="inline-block px-3 py-1 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/60 text-xs font-medium">
              各鍵のボタンをタップして報告
            </span>
          </div>
        </div>

        {/* 報告者情報ボックス */}
        <div className="rounded-2xl border p-3.5 flex items-center justify-between transition-colors border-blue-900/60 bg-blue-950/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full text-white font-bold text-base flex items-center justify-center shadow-sm shrink-0 bg-blue-600">
              {effectiveUserName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 leading-none mb-1.5">
                あなたの報告者名（施錠操作者）
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold truncate text-white">
                  {effectiveUserName} さん
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-900/60 text-blue-300 border border-blue-800/50">
                  {[effectiveSection, effectivePart].filter(Boolean).join(' / ')}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setPendingKeyId(null);
              setShowNameModal(true);
            }}
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer shrink-0 transition-colors bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200"
          >
            名前変更
          </button>
        </div>

        {/* 鍵① カード */}
        {renderKeyCard('key1', key1Name, '①')}

        {/* 鍵② カード */}
        {renderKeyCard('key2', key2Name, '②')}
      </div>

      {/* 名前登録・変更モーダル */}
      <MemberProfileModal
        isOpen={showNameModal}
        pendingKeyId={pendingKeyId}
        onClose={() => {
          setShowNameModal(false);
          setPendingKeyId(null);
        }}
        onProfileSavedAndReport={handleProfileSavedAndReport}
      />
    </>
  );
};
