const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Returns today's date formatted as YYYY-MM-DD in Japan Standard Time (JST)
 */
export function getTodayString(): string {
  const now = new Date();
  const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = jstFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

/**
 * Returns current hours and minutes in Japan Standard Time (JST)
 */
export function getCurrentTimeJST(): { hours: number; minutes: number; timeStr: string } {
  const now = new Date();
  const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = jstFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  const hours = parseInt(getPart('hour'), 10);
  const minutes = parseInt(getPart('minute'), 10);
  const timeStr = `${getPart('hour')}:${getPart('minute')}`;
  return { hours, minutes, timeStr };
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
 * Format timestamp into relative or friendly time in JST (e.g. "10:32", "昨日 18:00")
 */
export function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  
  // Use Intl to get parts in JST
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
  
  const now = new Date();
  const nowJstParts = jstFormatter.formatToParts(now);
  const getNowPart = (type: string) => nowJstParts.find(p => p.type === type)?.value || '';
  
  const isToday = jstYear === getNowPart('year') && jstMonth === getNowPart('month') && jstDay === getNowPart('day');
  
  if (isToday) {
    return `${jstHours}:${jstMinutes}`;
  }
  return `${parseInt(jstMonth, 10)}/${parseInt(jstDay, 10)} ${jstHours}:${jstMinutes}`;
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
 * Formats year, month, day into YYYY-MM-DD
 */
export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Formats a Date or timestamp into JST string
 */
export function formatToJST(dateOrTimestamp: Date | number | undefined, format: 'full' | 'time' | 'date' = 'full'): string {
  if (!dateOrTimestamp) return '';
  const date = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp) : dateOrTimestamp;
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Tokyo',
  };

  if (format === 'full') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
    options.hour12 = false;
  } else if (format === 'time') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  } else if (format === 'date') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
  }

  return new Intl.DateTimeFormat('ja-JP', options).format(date);
}

