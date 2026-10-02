import { AttendanceRecord, ClubMember } from '../types';
import { SECTION_CATEGORIES, SectionCategory } from '../constants/parts';
import { getTodayString } from './date';

/**
 * Format date string (YYYY-MM-DD) into Japanese notation (e.g. 9月18日)
 */
export function formatShortJapaneseDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${month}月${day}日`;
}

/**
 * Resolve section and part for a record (falling back to member list if record was missing them)
 */
export function resolveRecordSectionAndPart(
  record: { memberName: string; section?: string; part?: string },
  members?: ClubMember[]
): { section: string; part: string } {
  let section = record.section || '';
  let part = record.part || '';

  if ((!section || !part) && members && members.length > 0) {
    const matched = members.find((m) => m.name === record.memberName);
    if (matched) {
      if (!section && matched.section) section = matched.section;
      if (!part && matched.part) part = matched.part;
    }
  }

  // Remove any legacy "その他"
  if (section === 'その他') section = '';
  if (part === 'その他') part = '';

  return { section, part };
}

/**
 * Format single attendance notification / share message with section and part.
 * Examples:
 * - 【木管】山田太郎（クラリネット）が9月18日の部活を欠席します。理由：体調不良
 * - 【金管】佐藤花子（トランペット）が本日10時ごろ遅刻します
 */
export function formatAttendanceRecordShareText(
  record: AttendanceRecord,
  members?: ClubMember[]
): string {
  const { section, part } = resolveRecordSectionAndPart(record, members);
  const sectionTag = section ? `【${section}】` : '';
  const nameWithPart = part ? `${record.memberName}（${part}）` : record.memberName;

  const isToday = record.date === getTodayString();
  const dateLabel = isToday ? '本日' : formatShortJapaneseDate(record.date);

  // Normalize time string: if "10:00" -> "10:00ごろ" (if not already ending in ごろ)
  let timeStr = record.time ? record.time.trim() : '';
  if (timeStr && !timeStr.endsWith('ごろ') && !timeStr.endsWith('頃')) {
    timeStr = `${timeStr}ごろ`;
  }

  const reasonPart = record.reason?.trim() ? `。理由：${record.reason.trim()}` : '';

  switch (record.type) {
    case '欠席': {
      const targetLabel = isToday ? '本日' : `${dateLabel}の部活`;
      return `${sectionTag}${nameWithPart}が${targetLabel}を欠席します${reasonPart}`;
    }
    case '遅刻':
    case '緊急遽刻': {
      const timePrefix = timeStr ? `${timeStr}` : '';
      const atTime = isToday
        ? timePrefix
          ? `本日${timePrefix}`
          : '本日'
        : `${dateLabel} ${timePrefix}`.trim();
      return `${sectionTag}${nameWithPart}が${atTime}遅刻します${reasonPart}`;
    }
    case '早退': {
      const timePrefix = timeStr ? `${timeStr}` : '';
      const atTime = isToday
        ? timePrefix
          ? `本日${timePrefix}`
          : '本日'
        : `${dateLabel} ${timePrefix}`.trim();
      return `${sectionTag}${nameWithPart}が${atTime}早退します${reasonPart}`;
    }
    default:
      return `${sectionTag}${nameWithPart}の出欠連絡: ${record.type}`;
  }
}

/**
 * Breakdown of records grouped by section category (木管, 金管, 打楽器)
 */
export interface SectionAttendanceBreakdown {
  section: SectionCategory;
  absentCount: number;
  tardyCount: number;
  earlyCount: number;
  records: AttendanceRecord[];
}

export function computeSectionBreakdown(
  records: AttendanceRecord[],
  members?: ClubMember[]
): {
  sections: SectionAttendanceBreakdown[];
  totalAbsent: number;
  totalTardy: number;
  totalEarly: number;
} {
  const sectionsMap = new Map<SectionCategory, SectionAttendanceBreakdown>();

  SECTION_CATEGORIES.forEach((sec) => {
    sectionsMap.set(sec, {
      section: sec,
      absentCount: 0,
      tardyCount: 0,
      earlyCount: 0,
      records: [],
    });
  });

  let totalAbsent = 0;
  let totalTardy = 0;
  let totalEarly = 0;

  records.forEach((rec) => {
    const { section } = resolveRecordSectionAndPart(rec, members);
    const validSec = SECTION_CATEGORIES.find((s) => s === section);

    if (validSec) {
      const item = sectionsMap.get(validSec)!;
      item.records.push(rec);

      if (rec.type === '欠席') {
        item.absentCount += 1;
      } else if (rec.type === '遅刻' || rec.type === '緊急遽刻') {
        item.tardyCount += 1;
      } else if (rec.type === '早退') {
        item.earlyCount += 1;
      }
    }

    if (rec.type === '欠席') {
      totalAbsent += 1;
    } else if (rec.type === '遅刻' || rec.type === '緊急遽刻') {
      totalTardy += 1;
    } else if (rec.type === '早退') {
      totalEarly += 1;
    }
  });

  return {
    sections: SECTION_CATEGORIES.map((sec) => sectionsMap.get(sec)!),
    totalAbsent,
    totalTardy,
    totalEarly,
  };
}

/**
 * Format daily summary message with section-by-section breakdown:
 *
 * 例:
 * 本日の連絡状況
 * 【木管】欠席1名、遅刻0名
 * 【金管】欠席0名、遅刻1名
 * 【打楽器】欠席0名、遅刻0名
 * 合計：欠席1名、遅刻1名
 */
export function formatDailySummaryWithSections(
  clubName: string,
  dateStr: string,
  records: AttendanceRecord[],
  members: ClubMember[],
  options: { includeHeader?: boolean; includeDetails?: boolean } = {
    includeHeader: true,
    includeDetails: true,
  }
): string {
  const targetRecords = records.filter((r) => r.date === dateStr);
  const isToday = dateStr === getTodayString();
  const dateLabel = isToday ? '本日' : formatShortJapaneseDate(dateStr);

  const { sections, totalAbsent, totalTardy, totalEarly } = computeSectionBreakdown(
    targetRecords,
    members
  );

  const lines: string[] = [];

  if (options.includeHeader) {
    lines.push(`【${clubName} 出欠連絡まとめ】`);
    lines.push(`📅 ${formatShortJapaneseDate(dateStr)} (${dateLabel})`);
    lines.push('');
  }

  lines.push('本日の連絡状況');
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

  // Optional: Detailed member listing with section & part
  if (options.includeDetails && targetRecords.length > 0) {
    lines.push('');
    lines.push('【詳細】');

    // Emergency tardies first
    const emergencyTardies = targetRecords.filter((r) => r.type === '緊急遽刻');
    emergencyTardies.forEach((r) => {
      const { section, part } = resolveRecordSectionAndPart(r, members);
      const secTag = section ? `【${section}】` : '';
      const partStr = part ? `（${part}）` : '';
      const timePart = r.time ? ` ${r.time}` : '';
      const reasonPart = r.reason ? ` (理由: ${r.reason})` : '';
      lines.push(`・🚨[緊急遽刻] ${secTag}${r.memberName}${partStr}${timePart}${reasonPart}`);
    });

    // Absents
    const absents = targetRecords.filter((r) => r.type === '欠席');
    absents.forEach((r) => {
      const { section, part } = resolveRecordSectionAndPart(r, members);
      const secTag = section ? `【${section}】` : '';
      const partStr = part ? `（${part}）` : '';
      const reasonPart = r.reason ? ` (理由: ${r.reason})` : '';
      lines.push(`・🔴[欠席] ${secTag}${r.memberName}${partStr}${reasonPart}`);
    });

    // Tardies
    const tardies = targetRecords.filter((r) => r.type === '遅刻');
    tardies.forEach((r) => {
      const { section, part } = resolveRecordSectionAndPart(r, members);
      const secTag = section ? `【${section}】` : '';
      const partStr = part ? `（${part}）` : '';
      const timePart = r.time ? ` ${r.time}` : '';
      const reasonPart = r.reason ? ` (理由: ${r.reason})` : '';
      lines.push(`・🟠[遅刻] ${secTag}${r.memberName}${partStr}${timePart}${reasonPart}`);
    });

    // Earlies
    const earlies = targetRecords.filter((r) => r.type === '早退');
    earlies.forEach((r) => {
      const { section, part } = resolveRecordSectionAndPart(r, members);
      const secTag = section ? `【${section}】` : '';
      const partStr = part ? `（${part}）` : '';
      const timePart = r.time ? ` ${r.time}` : '';
      const reasonPart = r.reason ? ` (理由: ${r.reason})` : '';
      lines.push(`・🟡[早退] ${secTag}${r.memberName}${partStr}${timePart}${reasonPart}`);
    });
  } else if (targetRecords.length === 0) {
    lines.push('');
    lines.push('✨ 本日は全員出席予定です');
  }

  // NOTE: Absolutely NO footnote / asterisk line (※部活動出欠連絡...) per user requirement
  return lines.join('\n');
}
