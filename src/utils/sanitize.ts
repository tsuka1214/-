/**
 * Recursively eliminates undefined values from an object before saving to Firestore.
 * Firestore does NOT accept undefined as field values in addDoc, setDoc, or updateDoc.
 * Optional convertToEmptyString option converts undefined/null values of string type to "".
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const result: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = removeUndefined(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Sanitizes an attendance record payload to ensure all fields are safe for Firestore.
 * Concretely sets time to "" if omitted or not applicable (e.g. for '欠席').
 */
export function sanitizeAttendancePayload(data: Record<string, any>): Record<string, any> {
  const isTimeRequiredType = data.type === '遅刻' || data.type === '早退' || data.type === '緊急遽刻';
  const cleanTime = isTimeRequiredType && data.time ? String(data.time).trim() : '';

  const payload: Record<string, any> = {
    date: data.date ? String(data.date).trim() : '',
    memberName: data.memberName ? String(data.memberName).trim() : '',
    section: data.section ? String(data.section).trim() : '',
    part: data.part ? String(data.part).trim() : '',
    type: data.type,
    reason: data.reason ? String(data.reason).trim() : '',
    time: cleanTime, // Guaranteed string, never undefined
    updatedAt: data.updatedAt || Date.now(),
  };

  if (data.createdAt) {
    payload.createdAt = data.createdAt;
  }

  return removeUndefined(payload);
}
