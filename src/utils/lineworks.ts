import { AttendanceRecord, ClubMember, LineWorksConfig } from '../types';
import { formatJapaneseDate } from './date';
import { computeSectionBreakdown, resolveRecordSectionAndPart } from './formatShareText';

/**
 * Format attendance records into a structured LINE WORKS message text with section breakdown
 */
export function formatDailySummaryMessage(
  clubName: string,
  dateStr: string,
  records: AttendanceRecord[],
  members: ClubMember[]
): string {
  const targetRecords = records.filter((r) => r.date === dateStr);
  const formattedDate = formatJapaneseDate(dateStr);

  const { sections, totalAbsent, totalTardy, totalEarly } = computeSectionBreakdown(
    targetRecords,
    members
  );

  const emergencyTardies = targetRecords.filter((r) => r.type === '緊急遽刻');
  const regularTardies = targetRecords.filter((r) => r.type === '遅刻');
  const absents = targetRecords.filter((r) => r.type === '欠席');
  const earlies = targetRecords.filter((r) => r.type === '早退');

  const lines: string[] = [];
  lines.push(`【${clubName} 出欠連絡まとめ】`);
  lines.push(`📅 ${formattedDate}`);
  lines.push('');
  lines.push('本日の連絡状況');

  // Section-by-section breakdown (木管・金管・打楽器)
  sections.forEach((s) => {
    let line = `【${s.section}】欠席${s.absentCount}名、遅刻${s.tardyCount}名`;
    if (s.earlyCount > 0 || totalEarly > 0) {
      line += `、早退${s.earlyCount}名`;
    }
    lines.push(line);
  });

  let totalLine = `合計：欠席${totalAbsent}名、遅刻${totalTardy}名`;
  if (totalEarly > 0) {
    totalLine += `、早退${totalEarly}名`;
  }
  lines.push(totalLine);
  lines.push('');

  // Details by type
  if (emergencyTardies.length > 0) {
    lines.push('【🚨 緊急遽刻】');
    emergencyTardies.forEach((et) => {
      const { section, part } = resolveRecordSectionAndPart(et, members);
      const secTag = section ? `【${section}】` : '';
      const partStr = part ? `（${part}）` : '';
      const timePart = et.time ? ` ${et.time}` : '';
      const reasonPart = et.reason ? ` (理由: ${et.reason})` : '';
      lines.push(`・${secTag}${et.memberName}${partStr}${timePart}${reasonPart}`);
    });
    lines.push('');
  }

  if (absents.length > 0) {
    lines.push('【🔴 欠席】');
    absents.forEach((a) => {
      const { section, part } = resolveRecordSectionAndPart(a, members);
      const secTag = section ? `【${section}】` : '';
      const partStr = part ? `（${part}）` : '';
      const reasonPart = a.reason ? ` (理由: ${a.reason})` : '';
      lines.push(`・${secTag}${a.memberName}${partStr}${reasonPart}`);
    });
    lines.push('');
  }

  if (regularTardies.length > 0) {
    lines.push('【🟠 遅刻】');
    regularTardies.forEach((a) => {
      const { section, part } = resolveRecordSectionAndPart(a, members);
      const secTag = section ? `【${section}】` : '';
      const partStr = part ? `（${part}）` : '';
      const timePart = a.time ? ` ${a.time}` : '';
      const reasonPart = a.reason ? ` (理由: ${a.reason})` : '';
      lines.push(`・${secTag}${a.memberName}${partStr}${timePart}${reasonPart}`);
    });
    lines.push('');
  }

  if (earlies.length > 0) {
    lines.push('【🟡 早退】');
    earlies.forEach((a) => {
      const { section, part } = resolveRecordSectionAndPart(a, members);
      const secTag = section ? `【${section}】` : '';
      const partStr = part ? `（${part}）` : '';
      const timePart = a.time ? ` ${a.time}` : '';
      const reasonPart = a.reason ? ` (理由: ${a.reason})` : '';
      lines.push(`・${secTag}${a.memberName}${partStr}${timePart}${reasonPart}`);
    });
    lines.push('');
  }

  if (totalAbsent === 0 && totalTardy === 0 && totalEarly === 0) {
    lines.push('✨ 本日は欠席・遅刻・早退の連絡はありません。全員出席予定です！');
  }

  // NOTE: Deleted footnote (※部活動出欠連絡アプリより自動配信) per user request
  return lines.join('\n').trim();
}

/**
 * Format urgent tardy notification message (即時配信) with section and part.
 * Example:
 * 🚨【吹奏楽部 緊急遽刻連絡】
 * 【木管】山田太郎（クラリネット）が本日10時ごろ遅刻します。理由：電車遅延
 */
export function formatEmergencyTardyAlertMessage(
  clubName: string,
  memberName: string,
  time?: string,
  reason?: string,
  section?: string,
  part?: string,
  isEmergency = true
): string {
  const secTag = section ? `【${section}】` : '';
  const nameWithPart = part ? `${memberName}（${part}）` : memberName;

  let timeStr = time ? time.trim() : '';
  if (timeStr && !timeStr.endsWith('ごろ') && !timeStr.endsWith('頃')) {
    timeStr = `${timeStr}ごろ`;
  }
  const timePart = timeStr ? `${timeStr}` : '';
  const reasonPart = reason?.trim() ? `。理由：${reason.trim()}` : '';

  const lines: string[] = [];
  lines.push(`🚨【${clubName} ${isEmergency ? '緊急遽刻連絡' : '遅刻連絡'}】`);
  lines.push(`${secTag}${nameWithPart}が本日${timePart}遅刻します${reasonPart}`);

  // NOTE: Deleted footnote (※部活動出欠連絡アプリより即時配信) per user request
  return lines.join('\n');
}

/**
 * Format event reminder message.
 */
export function formatEventReminderMessage(
  clubName: string,
  event: { name: string; startDate: string; gatheringTime?: string; location?: string },
  daysUntil: number
): string {
  const formattedDate = formatJapaneseDate(event.startDate);
  const lines: string[] = [];

  const prefix = daysUntil === 0 ? '【本日】' : daysUntil === 1 ? '【明日】' : `【あと${daysUntil}日】`;
  lines.push(`${prefix}${event.name}のリマインド`);
  lines.push(`📅 日程: ${formattedDate}`);

  if (event.gatheringTime) {
    lines.push(`⏰ 集合: ${event.gatheringTime}`);
  }
  if (event.location) {
    lines.push(`📍 場所: ${event.location}`);
  }

  lines.push('');
  if (daysUntil === 0) {
    lines.push('本日は本番です！忘れ物はありませんか？');
  } else if (daysUntil === 1) {
    lines.push('明日は本番です。持ち物を最終チェックしましょう！');
  } else {
    lines.push(`${daysUntil}日後が本番です。準備は進んでいますか？`);
  }

  return lines.join('\n').trim();
}

/**
 * Format urgent tardy notification message (互換用)
 */
export function formatTardyAlertMessage(
  clubName: string,
  memberName: string,
  time?: string,
  reason?: string,
  section?: string,
  part?: string
): string {
  return formatEmergencyTardyAlertMessage(clubName, memberName, time, reason, section, part, false);
}

/**
 * Send notification to LINE WORKS using either API 2.0 (Service Account) or Webhook
 */
export async function sendLineWorksNotification(
  config: LineWorksConfig,
  text: string
): Promise<{ success: boolean; error?: string; status?: number }> {
  if (!config || !config.enabled) {
    return { success: false, error: 'LINE WORKS連携が無効になっています' };
  }

  const mode = config.mode || (config.clientId && config.privateKey ? 'api2' : 'webhook');

  try {
    const payload = {
      mode,
      text,
      api2: {
        clientId: config.clientId?.trim(),
        clientSecret: config.clientSecret?.trim(),
        serviceAccount: config.serviceAccount?.trim(),
        privateKey: config.privateKey?.trim(),
        botId: config.botId?.trim(),
        channelId: config.channelId?.trim(),
      },
      webhookUrl: config.webhookUrl?.trim(),
    };

    const res = await fetch('/api/lineworks/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      return {
        success: false,
        status: res.status,
        error: data?.error || `LINE WORKSへの送信に失敗しました (ステータス: ${res.status})`,
      };
    }

    return {
      success: true,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || '通信エラーが発生しました',
    };
  }
}

/**
 * Verify LINE WORKS API 2.0 credentials specifically
 */
export async function verifyLineWorksApi2Auth(config: {
  clientId: string;
  clientSecret: string;
  serviceAccount: string;
  privateKey: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/lineworks/verify-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return { success: false, error: data?.error || '認証確認に失敗しました' };
    }

    return { success: true, message: data?.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'ネットワークエラーが発生しました' };
  }
}
