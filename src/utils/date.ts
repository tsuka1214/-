const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats YYYY-MM-DD into "2026年9月15日(火)" or "9月15日(火)"
 */
export function formatJapaneseDate(dateStr: string, includeYear = true): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = WEEKDAYS[dateObj.getDay()] || '';
  
  if (includeYear) {
    return `${year}年${month}月${day}日(${dayOfWeek})`;
  }
  return `${month}月${day}日(${dayOfWeek})`;
}

/**
 * Calculate offset date string from a given YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  date.setDate(date.getDate() + days);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns number of days between two YYYY-MM-DD strings (date2 - date1)
 */
export function diffDays(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format timestamp into relative or friendly time (e.g. "10:32", "昨日 18:00")
 */
export function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  if (isToday) {
    return `${hours}:${minutes}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}

/**
 * Returns number of days in a given year and month (month: 1-12)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns the day of week index (0=Sun, 1=Mon, ..., 6=Sat) for the 1st day of the given month
 */
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * Format year and month as YYYY-MM
 */
export function toYearMonthString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Format full date string YYYY-MM-DD
 */
export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

