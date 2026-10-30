import { AttendanceRecord, ClubMember } from '../types';
import { formatJapaneseDate } from './date';
import { SECTIONS_AND_PARTS } from '../constants/parts';

export function formatAttendanceRecordShareText(record: AttendanceRecord): string {
  const dateFormatted = formatJapaneseDate(record.date, false);
  let detail = `${record.memberName} (${record.section || '未設定'} / ${record.part || '未設定'})`;
  let timeStr = record.time ? ` [時間: ${record.time}]` : '';
  let reasonStr = record.reason ? ` - ${record.reason}` : '';
  return `【出欠連絡】${dateFormatted}\n${detail}\n区分: ${record.type}${timeStr}${reasonStr}`;
}

export function formatDailySummaryWithSections(
  dateStr: string,
  attendances: AttendanceRecord[],
  members: ClubMember[]
): string {
  const dateFormatted = formatJapaneseDate(dateStr, false);

  const dayRecords = attendances.filter((a) => a.date === dateStr);
  const absentRecords = dayRecords.filter((a) => a.type === '欠席');
  const tardyRecords = dayRecords.filter((a) => a.type === '遅刻');
  const earlyRecords = dayRecords.filter((a) => a.type === '早退');
  const emergencyRecords = dayRecords.filter((a) => a.type === '緊急遽刻');

  const absentCount = absentRecords.length;
  const tardyCount = tardyRecords.length;
  const earlyCount = earlyRecords.length;
  const emergencyCount = emergencyRecords.length;

  let header = `▼ 本日の出欠連絡（${dateFormatted}）\n`;
  header += `全体：欠席${absentCount}名 / 遅刻${tardyCount}名 / 早退${earlyCount}名 / 緊急遽刻${emergencyCount}名\n`;

  if (absentCount === 0 && tardyCount === 0 && earlyCount === 0 && emergencyCount === 0) {
    header += `\n本日の連絡：全員なし（連絡なし）`;
    return header;
  }

  const sections = SECTIONS_AND_PARTS.map((s) => s.section);

  const getMemberSection = (rec: AttendanceRecord) => {
    if (rec.section) return rec.section;
    const mem = members.find((m) => m.name === rec.memberName);
    return mem?.section || 'その他';
  };

  const lines: string[] = [header];

  for (const sec of sections) {
    const secRecords = dayRecords.filter((r) => getMemberSection(r) === sec);
    const secAbsent = secRecords.filter((r) => r.type === '欠席').map((r) => r.memberName);
    const secTardy = secRecords.filter((r) => r.type === '遅刻').map((r) => r.memberName + (r.time ? `(${r.time})` : ''));
    const secEarly = secRecords.filter((r) => r.type === '早退').map((r) => r.memberName + (r.time ? `(${r.time})` : ''));
    const secEmergency = secRecords.filter((r) => r.type === '緊急遽刻').map((r) => r.memberName + (r.time ? `(${r.time})` : ''));

    lines.push(`\n【${sec}】`);
    lines.push(`・欠席：${secAbsent.length > 0 ? secAbsent.join('、') : 'なし'}`);
    lines.push(`・遅刻：${secTardy.length > 0 ? secTardy.join('、') : 'なし'}`);
    lines.push(`・早退：${secEarly.length > 0 ? secEarly.join('、') : 'なし'}`);
    lines.push(`・緊急遽刻：${secEmergency.length > 0 ? secEmergency.join('、') : 'なし'}`);
  }

  return lines.join('\n');
}
