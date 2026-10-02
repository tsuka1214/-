import { useState, useEffect, useCallback } from 'react';
import { AttendancePattern } from '../types';
import { DEFAULT_ATTENDANCE_PATTERNS, DEFAULT_REASONS, DEFAULT_TIMES } from '../constants/patterns';
import { useApp } from '../context/AppContext';

const STORAGE_KEY_PATTERNS = 'club_custom_patterns_v1';
const STORAGE_KEY_REASONS = 'club_custom_reasons_v1';
const STORAGE_KEY_TIMES = 'club_custom_times_v1';

export function useAttendancePatterns() {
  const { settings, updateSettings, isAdmin } = useApp();

  // 1. Patterns
  const [patterns, setPatterns] = useState<AttendancePattern[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PATTERNS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Failed to parse saved patterns from localStorage:', err);
      }
    }
    if (settings.customPatterns && settings.customPatterns.length > 0) {
      return settings.customPatterns;
    }
    return DEFAULT_ATTENDANCE_PATTERNS;
  });

  // 2. Reasons
  const [reasons, setReasons] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_REASONS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Failed to parse saved reasons from localStorage:', err);
      }
    }
    return DEFAULT_REASONS;
  });

  // 3. Times
  const [times, setTimes] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_TIMES);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Failed to parse saved times from localStorage:', err);
      }
    }
    return DEFAULT_TIMES;
  });

  // Save patterns
  const savePatterns = useCallback((newPatterns: AttendancePattern[], syncToClub = false) => {
    setPatterns(newPatterns);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PATTERNS, JSON.stringify(newPatterns));
      } catch (err) {
        console.warn('Failed to save patterns to localStorage:', err);
      }
    }
    // If admin wants to sync as club-wide defaults
    if (syncToClub && isAdmin) {
      updateSettings({ customPatterns: newPatterns });
    }
  }, [isAdmin, updateSettings]);

  // Save reasons
  const addReason = useCallback((newReason: string) => {
    const trimmed = newReason.trim();
    if (!trimmed || reasons.includes(trimmed)) return;
    const updated = [...reasons, trimmed];
    setReasons(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_REASONS, JSON.stringify(updated));
      } catch {}
    }
  }, [reasons]);

  const removeReason = useCallback((targetReason: string) => {
    const updated = reasons.filter((r) => r !== targetReason);
    setReasons(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_REASONS, JSON.stringify(updated));
      } catch {}
    }
  }, [reasons]);

  // Save times
  const addTime = useCallback((newTime: string) => {
    const trimmed = newTime.trim();
    if (!trimmed || times.includes(trimmed)) return;
    const updated = [...times, trimmed];
    setTimes(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_TIMES, JSON.stringify(updated));
      } catch {}
    }
  }, [times]);

  const removeTime = useCallback((targetTime: string) => {
    const updated = times.filter((t) => t !== targetTime);
    setTimes(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_TIMES, JSON.stringify(updated));
      } catch {}
    }
  }, [times]);

  return {
    patterns,
    savePatterns,
    reasons,
    addReason,
    removeReason,
    times,
    addTime,
    removeTime,
  };
}
