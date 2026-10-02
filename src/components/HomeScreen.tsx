import React from 'react';
import { useApp } from '../context/AppContext';
import { getTodayString, formatJapaneseDate, diffDays } from '../utils/date';
import { resolveScheduleForDate } from '../constants/schedule';
import { AttendanceType } from '../types';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Send,
  Users,
  ChevronRight,
  Edit2,
  Trash2,
  Sparkles,
  ArrowRight,
  Download,
  Smartphone,
  Music,
  Copy,
  Check,
} from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { SECTION_CATEGORIES } from '../constants/parts';
import { copyToClipboard } from '../utils/clipboard';
import { formatAttendanceRecordShareText } from '../utils/formatShareText';
import { ClubKeyCard } from './ClubKeyCard';

const typeColorStyles: Record<
  AttendanceType,
  {
    bg: string;
    text: string;
    badge: string;
    border: string;
  }
> = {
  出席: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-600 text-white',
    border: 'border-blue-200 dark:border-blue-900/60',
  },
  欠席: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-600 text-white',
    border: 'border-red-200 dark:border-red-900/60',
  },
  遅刻: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-400',
    badge: 'bg-amber-500 text-white',
    border: 'border-amber-200 dark:border-amber-900/60',
  },
  緊急遽刻: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-800 dark:text-rose-400',
    badge: 'bg-rose-600 text-white',
    border: 'border-rose-200 dark:border-rose-900/60',
  },
  早退: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    text: 'text-yellow-800 dark:text-yellow-400',
    badge: 'bg-yellow-500 text-slate-900 font-bold',
    border: 'border-yellow-200 dark:border-yellow-900/60',
  },
};

export const HomeScreen: React.FC = () => {
  const {
    attendances,
    members,
    myMemberName,
    myMemberSection,
    myMemberPart,
    notifications,
    setCurrentTab,
    setActiveEditingRecord,
    deleteAttendance,
    settings,
    events,
  } = useApp();

  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();

  const [copiedMyRecord, setCopiedMyRecord] = React.useState(false);

  const todayStr = getTodayString();
  const todaySchedule = resolveScheduleForDate(todayStr, settings);

  // Helper to get section for an attendance record or member
  const getRecordSection = (record: { section?: string; memberName: string }): string => {
    if (record.section && record.section !== 'その他') return record.section;
    const m = members.find((mem) => mem.name === record.memberName);
    return m?.section && m.section !== 'その他' ? m.section : '';
  };

  // Today's records
  const todayRecords = attendances.filter((a) => a.date === todayStr);

  // Upcoming events (within next 7 days)
  const upcomingEvents = (settings?.notificationsEnabled ? (events || []) : [])
    .filter((e) => {
      const daysUntil = diffDays(todayStr, e.startDate);
      return daysUntil >= 0 && daysUntil <= 7;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // My record for today
  const myRecordToday = todayRecords.find(
    (a) => a.memberName && a.memberName === myMemberName
  );

  // Counts
  const absentCount = todayRecords.filter((a) => a.type === '欠席').length;
  const tardyCount = todayRecords.filter((a) => a.type === '遅刻').length;
  const emergencyTardyCount = todayRecords.filter((a) => a.type === '緊急遽刻').length;
  const totalTardyCount = tardyCount + emergencyTardyCount;
  const earlyCount = todayRecords.filter((a) => a.type === '早退').length;
  const reportedNames = new Set(todayRecords.map((a) => a.memberName));
  const unreportedMembers = members.filter((m) => !reportedNames.has(m.name));
  const unreportedCount = unreportedMembers.length;

  // Section breakdown stats
  const sectionStats = SECTION_CATEGORIES.map((sec) => {
    const secMembers = members.filter((m) => m.section === sec);
    const secRecords = todayRecords.filter((rec) => getRecordSection(rec) === sec);
    const absent = secRecords.filter((r) => r.type === '欠席').length;
    const tardy = secRecords.filter((r) => r.type === '遅刻' || r.type === '緊急遽刻').length;
    const early = secRecords.filter((r) => r.type === '早退').length;
    const totalChanges = absent + tardy + early;
    return {
      section: sec,
      memberCount: secMembers.length,
      absent,
      tardy,
      early,
      totalChanges,
    };
  });

  // 出席人数 (全登録部員 - 欠席者)
  const presentCount = Math.max(0, members.length - absentCount);

  // Recent urgent/summary notifications
  const recentNotifications = notifications.slice(0, 3);

  const handleEditMyRecord = () => {
    if (myRecordToday) {
      setActiveEditingRecord(myRecordToday);
      setCurrentTab('form');
    }
  };

  const handleDeleteMyRecord = async () => {
    if (myRecordToday) {
      const ok = window.confirm('本日の連絡を取り消しますか？');
      if (ok) {
        await deleteAttendance(myRecordToday.id);
      }
    }
  };

  return (
    <div className="space-y-4 pb-20 pt-2">
      {/* 【追加機能：鍵の報告】部室の鍵の開け閉めをワンタップで報告 */}
      <ClubKeyCard />

      {/* Upcoming Event Alerts */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-2">
          {upcomingEvents.map((event) => {
            const daysUntil = diffDays(todayStr, event.startDate);
            const isToday = daysUntil === 0;
            const isSoon = daysUntil <= 3;

            return (
              <div
                key={event.id}
                onClick={() => setCurrentTab('events')}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] ${
                  isToday
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                    : isSoon
                    ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-100 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                      isToday
                        ? 'bg-white/20'
                        : isSoon
                        ? 'bg-amber-100 dark:bg-amber-800'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    📅
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black opacity-70 uppercase tracking-widest">
                        {isToday ? '本日開催' : `${daysUntil}日後`}
                      </span>
                      {isSoon && !isToday && (
                        <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold truncate max-w-[180px]">
                      {event.name}
                    </h3>
                    <p className={`text-[10px] font-medium opacity-70`}>
                      {formatJapaneseDate(event.startDate, false)}
                      {event.location && ` @ ${event.location}`}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 opacity-40`} />
              </div>
            );
          })}
        </div>
      )}

      {/* 【追加機能3】本日の連絡状況をホーム最上部に大きく表示 */}
      <div
        id="home-today-status-card"
        onClick={() => setCurrentTab('status')}
        className="cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border-2 border-blue-500/30 dark:border-blue-500/40 shadow-sm hover:shadow-md hover:border-blue-600 dark:hover:border-blue-400 transition-all group relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                本日の連絡状況
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {formatJapaneseDate(todayStr, false)}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                タップすると「みんなの状況」画面に移動します
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0">
            <span>詳細</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* 欠席・遅刻・早退・出席それぞれの人数を色分けして大きく表示 */}
        <div className="grid grid-cols-4 gap-2 text-center my-3">
          {/* 欠席 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
            <span className="text-[11px] sm:text-xs font-extrabold text-red-700 dark:text-red-400 block">欠席</span>
            <span className="text-2xl sm:text-3xl font-black text-red-700 dark:text-red-400 leading-tight block mt-0.5">
              {absentCount}
            </span>
            <span className="text-[10px] text-red-600 dark:text-red-400/80 font-medium">名</span>
          </div>

          {/* 遅刻 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
            <span className="text-[11px] sm:text-xs font-extrabold text-amber-700 dark:text-amber-400 block">遅刻</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 leading-tight block mt-0.5">
              {totalTardyCount}
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400/80 font-medium">
              {emergencyTardyCount > 0 ? `(緊急${emergencyTardyCount})` : '名'}
            </span>
          </div>

          {/* 早退 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-900/60">
            <span className="text-[11px] sm:text-xs font-extrabold text-yellow-800 dark:text-yellow-400 block">早退</span>
            <span className="text-2xl sm:text-3xl font-black text-yellow-800 dark:text-yellow-400 leading-tight block mt-0.5">
              {earlyCount}
            </span>
            <span className="text-[10px] text-yellow-700 dark:text-yellow-400/80 font-medium">名</span>
          </div>

          {/* 出席 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
            <span className="text-[11px] sm:text-xs font-extrabold text-emerald-700 dark:text-emerald-400 block">出席</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 leading-tight block mt-0.5">
              {presentCount}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80 font-medium">名</span>
          </div>
        </div>

        {/* サマリー文字列 */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="font-bold tracking-tight text-slate-700 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
            <span className="text-red-600 dark:text-red-400">欠席 {absentCount}名</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-amber-600 dark:text-amber-400">遅刻 {totalTardyCount}名</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-yellow-700 dark:text-yellow-400">早退 {earlyCount}名</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">出席 {presentCount}名</span>
          </div>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium shrink-0 ml-2">
            みんなの状況へ →
          </span>
        </div>

        {/* 区分（パート）別サマリー表示 */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Music className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>パート区分別の連絡状況</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sectionStats.map((stat) => (
              <div
                key={stat.section}
                className={`p-2 rounded-xl text-xs border ${
                  stat.totalChanges > 0
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50'
                    : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span>{stat.section}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {stat.memberCount > 0 ? `${stat.memberCount}名` : ''}
                  </span>
                </div>
                <div className="mt-1 text-[11px] flex items-center gap-1.5 flex-wrap">
                  {stat.totalChanges === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                      欠席等なし
                    </span>
                  ) : (
                    <>
                      {stat.absent > 0 && (
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          欠{stat.absent}
                        </span>
                      )}
                      {stat.tardy > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          遅{stat.tardy}
                        </span>
                      )}
                      {stat.early > 0 && (
                        <span className="text-yellow-700 dark:text-yellow-400 font-semibold">
                          早{stat.early}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Date Banner Card */}
      <div
        id="home-today-card"
        className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between relative z-10 mb-1">
          <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> 本日の予定日
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/40 text-blue-100 font-medium border border-blue-400/30">
            登録部員 {members.length}名
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight relative z-10">
          {formatJapaneseDate(todayStr, true)}
        </h2>
        <div className="text-xs text-blue-100 mt-1 relative z-10 flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-200" />
            {settings.notificationsEnabled && todaySchedule.enabled
              ? `まとめ通知: ${todaySchedule.time}${todaySchedule.label ? ` (${todaySchedule.label})` : ''}`
              : 'まとめ通知: OFF (通知なし)'}
          </span>
          {todaySchedule.isOverride && (
            <span className="text-[10px] bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.2 rounded shadow-2xs">
              ★特別予定
            </span>
          )}
          {settings.lineWorks?.enabled && settings.lineWorks?.webhookUrl && (
            <span className="inline-flex items-center gap-1 bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              LINE WORKS連携中
            </span>
          )}
        </div>
      </div>

      {/* Your Attendance Status Today */}
      <div
        id="home-my-status-section"
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            あなたの本日の出欠状況
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              名前: {myMemberName || '未登録'}
            </span>
            {(myMemberPart || myMemberSection) && (
              <span className="text-[10px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                {myMemberSection}{myMemberPart ? `・${myMemberPart}` : ''}
              </span>
            )}
          </div>
        </div>

        {myRecordToday ? (
          <div
            className={`p-3.5 rounded-xl border ${
              typeColorStyles[myRecordToday.type].bg
            } ${typeColorStyles[myRecordToday.type].border}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    id="my-status-badge"
                    className={`px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
                      typeColorStyles[myRecordToday.type].badge
                    }`}
                  >
                    {myRecordToday.type}
                  </span>
                  {myRecordToday.time && (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 bg-white/70 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      {myRecordToday.time}
                    </span>
                  )}
                </div>
                {myRecordToday.reason ? (
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 font-medium">
                    理由: {myRecordToday.reason}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">理由: なし</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-copy-my-record"
                  onClick={async () => {
                    const text = formatAttendanceRecordShareText(myRecordToday, members);
                    const ok = await copyToClipboard(text);
                    if (ok) {
                      setCopiedMyRecord(true);
                      setTimeout(() => setCopiedMyRecord(false), 2000);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  title="文章をコピー（LINE WORKS・LINE共有用）"
                  aria-label="文章をコピー"
                >
                  {copiedMyRecord ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">済</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      <span>コピー</span>
                    </>
                  )}
                </button>
                <button
                  id="btn-edit-my-record"
                  onClick={handleEditMyRecord}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  修正
                </button>
                <button
                  id="btn-delete-my-record"
                  onClick={handleDeleteMyRecord}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 text-xs shadow-xs transition-colors"
                  title="連絡を取り消す"
                  aria-label="連絡を取り消す"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-medium">
              本日の出欠連絡はまだ送信されていません
            </p>
            <button
              id="btn-home-send-attendance"
              onClick={() => {
                setActiveEditingRecord(null);
                setCurrentTab('form');
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors w-full sm:w-auto"
            >
              <Send className="w-3.5 h-3.5" />
              今すぐ本日の出欠を連絡する
            </button>
          </div>
        )}
      </div>

      {/* Today's Summary Overview (Cards with required colors) */}
      <div id="home-summary-section" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            連絡内訳サマリー
          </h3>
          <button
            id="link-view-all-status"
            onClick={() => setCurrentTab('status')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5"
          >
            詳細を見る
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5 Status Badges/Grid */}
        <div className="grid grid-cols-5 gap-2">
          {/* 欠席 - Red */}
          <div
            id="summary-card-absent"
            onClick={() => setCurrentTab('status')}
            className="cursor-pointer bg-red-50 dark:bg-red-950/40 hover:bg-red-100/80 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900/60 rounded-xl p-2.5 text-center transition-colors"
          >
            <span className="block text-[11px] font-bold text-red-700 dark:text-red-400">欠席</span>
            <span className="block text-xl font-extrabold text-red-700 dark:text-red-400 mt-0.5">
              {absentCount}
            </span>
            <span className="block text-[10px] text-red-600 dark:text-red-400/80 font-medium">名</span>
          </div>

          {/* 遅刻 - Orange */}
          <div
            id="summary-card-tardy"
            onClick={() => setCurrentTab('status')}
            className="cursor-pointer bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 rounded-xl p-2.5 text-center transition-colors"
          >
            <span className="block text-[11px] font-bold text-amber-800 dark:text-amber-400">遅刻</span>
            <span className="block text-xl font-extrabold text-amber-800 dark:text-amber-400 mt-0.5">
              {tardyCount}
            </span>
            <span className="block text-[10px] text-amber-700 dark:text-amber-400/80 font-medium">名</span>
          </div>

          {/* 緊急遽刻 - Rose */}
          <div
            id="summary-card-emergency-tardy"
            onClick={() => setCurrentTab('status')}
            className="cursor-pointer bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl p-2.5 text-center transition-colors"
          >
            <span className="block text-[10px] font-bold text-rose-800 dark:text-rose-400">🚨緊急遽刻</span>
            <span className="block text-xl font-extrabold text-rose-800 dark:text-rose-400 mt-0.5">
              {emergencyTardyCount}
            </span>
            <span className="block text-[10px] text-rose-700 dark:text-rose-400/80 font-medium">名</span>
          </div>

          {/* 早退 - Yellow */}
          <div
            id="summary-card-early"
            onClick={() => setCurrentTab('status')}
            className="cursor-pointer bg-yellow-50 dark:bg-yellow-950/40 hover:bg-yellow-100/80 dark:hover:bg-yellow-950/60 border border-yellow-200 dark:border-yellow-900/60 rounded-xl p-2.5 text-center transition-colors"
          >
            <span className="block text-[11px] font-bold text-yellow-800 dark:text-yellow-400">早退</span>
            <span className="block text-xl font-extrabold text-yellow-800 dark:text-yellow-400 mt-0.5">
              {earlyCount}
            </span>
            <span className="block text-[10px] text-yellow-700 dark:text-yellow-400/80 font-medium">名</span>
          </div>

          {/* 未連絡 - Gray */}
          <div
            id="summary-card-unreported"
            onClick={() => setCurrentTab('status')}
            className="cursor-pointer bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center transition-colors"
          >
            <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">未連絡</span>
            <span className="block text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">
              {unreportedCount}
            </span>
            <span className="block text-[10px] text-slate-600 dark:text-slate-400 font-medium">名</span>
          </div>
        </div>
      </div>

      {/* Immediate tardiness alerts or recent notifications banner */}
      {recentNotifications.length > 0 && (
        <div id="home-notifications-preview" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              直近の連絡・通知
            </h3>
            <button
              id="link-view-all-notifications"
              onClick={() => setCurrentTab('notifications')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5"
            >
              すべて表示
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {recentNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 shadow-xs ${
                  notif.type === 'urgent'
                    ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300'
                    : notif.type === 'summary'
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {notif.type === 'urgent' ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-xs">{notif.title}</p>
                  <p className="mt-0.5 font-medium leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's quick list of absent/tardy/early members */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            本日の欠席・遅刻・早退一覧
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            計 {absentCount + tardyCount + emergencyTardyCount + earlyCount} 名
          </span>
        </div>

        {todayRecords.length === 0 ? (
          <div className="text-center py-5 text-slate-400 dark:text-slate-500">
            <p className="text-xs">本日、欠席・遅刻・早退の連絡はありません</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              全員出席予定です
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {todayRecords.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        typeColorStyles[item.type].badge
                      }`}
                    >
                      {item.type}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.memberName}
                      </p>
                      {item.reason && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                          {item.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  {item.time && (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                      {item.time}
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

