import { AttendancePattern } from '../types';

export const DEFAULT_ATTENDANCE_PATTERNS: AttendancePattern[] = [
  { id: 'pat_1', name: '体調不良 (欠席)', type: '欠席', reason: '発熱・体調不良のため' },
  { id: 'pat_2', name: '通院 (遅刻)', type: '遅刻', reason: '通院のため', time: '17:00' },
  { id: 'pat_3', name: '学校・補習 (遅刻)', type: '遅刻', reason: '放課後補習のため', time: '16:30' },
  { id: 'pat_4', name: '習い事 (早退)', type: '早退', reason: '習い事・塾のため', time: '17:30' },
  { id: 'pat_5', name: '電車遅延 (緊急遽刻)', type: '緊急遽刻', reason: '交通機関の乱れ・電車遅延のため', time: '16:45' },
];
