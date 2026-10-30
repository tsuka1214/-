const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Returns today's date formatted as YYYY-MM-DD in Japan Standard Time (JST)
 */
export function getTodayString(targetDate?: Date): string {
  const d = targetDate || new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

/**
 * Returns current hours and minutes in Japan Standard Time (JST)
 * hours: 0-23, minutes: 0-59, timeStr: "HH:mm" (2-digit zero-padded)
 */
export function getCurrentTimeJST(targetDate?: Date): { hours: number; minutes: number; timeStr: string } {
  const d = targetDate || new Date();
  const timeStr = d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  const normalizedTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { hours, minutes, timeStr: normalizedTimeStr };
}

/**
 * Normalizes any time value into a strict HH:mm string (00:00 - 23:59) in JST.
 * Supports strings ("20:00", "20:00:00", "20", ISO strings), numbers (hours, 2000, epoch timestamps),
 * Firestore Timestamps ({ toDate() } or { seconds }), and Date objects.
 */
export function normalizeTimeStr(val: any, defaultVal = '18:00'): string {
  if (val === null || val === undefined || val === '') return defaultVal;

  // 1. If it's a Firestore Timestamp or object with toDate()
  if (val && typeof val.toDate === 'function') {
    try {
      return formatToJST(val.toDate(), 'HH:mm');
    } catch {}
  }

  // 2. If it's a serialized Firestore Timestamp { seconds, nanoseconds }
  if (val && typeof val.seconds === 'number') {
    try {
      return formatToJST(new Date(val.seconds * 1000), 'HH:mm');
    } catch {}
  }

  // 3. If it's a JavaScript Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    return formatToJST(val, 'HH:mm');
  }

  // 4. If it's a number
  if (typeof val === 'number' && !isNaN(val)) {
    // Epoch timestamp in ms
    if (val > 100000000000) {
      return formatToJST(new Date(val), 'HH:mm');
    }
    // Epoch timestamp in sec
    if (val > 1000000000) {
      return formatToJST(new Date(val * 1000), 'HH:mm');
    }
    // Military time number like 2000 (20:00) or 830 (08:30)
    if (val >= 100 && val <= 2359) {
      const h = Math.floor(val / 100);
      const m = val % 100;
      if (h <= 23 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    // Hour number (0 - 23)
    if (val >= 0 && val <= 23) {
      return `${String(val).padStart(2, '0')}:00`;
    }
  }

  // 5. If it's a string
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // "HH:mm" or "H:m"
    if (/^\d{1,2}:\d{1,2}$/.test(trimmed)) {
      const [hStr, mStr] = trimmed.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    // "HH:mm:ss"
    if (/^\d{1,2}:\d{1,2}:\d{1,2}$/.test(trimmed)) {
      const [hStr, mStr] = trimmed.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    // Numeric string e.g. "20" or "8"
    if (/^\d{1,2}$/.test(trimmed)) {
      const h = parseInt(trimmed, 10);
      if (h >= 0 && h <= 23) {
        return `${String(h).padStart(2, '0')}:00`;
      }
    }
    // ISO string or date string
    if (trimmed.includes('T') || trimmed.includes('-') || trimmed.includes('/')) {
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        return formatToJST(new Date(parsed), 'HH:mm');
      }
    }
  }

  return defaultVal;
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
  
  const dateObj = new Date(`${dateStr}T12:00:00+09:00`);
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
  const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const dateObj = new Date(`${dateStr}T12:00:00+09:00`);
  return dateObj.getDay();
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
export function formatToJST(dateOrTimestamp: Date | number | undefined, format: 'full' | 'time' | 'date' | 'HH:mm:ss' | 'HH:mm' = 'full'): string {
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
  } else if (format === 'time' || format === 'HH:mm') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  } else if (format === 'HH:mm:ss') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
    options.hour12 = false;
  } else if (format === 'date') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
  }

  return new Intl.DateTimeFormat('ja-JP', options).format(date);
}
