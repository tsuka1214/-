import { AttendancePattern } from '../types';

export const DEFAULT_ATTENDANCE_PATTERNS: AttendancePattern[] = [
  {
    id: 'default-1',
    name: '体調不良で欠席',
    type: '欠席',
    reason: '体調不良',
  },
  {
    id: 'default-2',
    name: '通院で遅刻 (16:30)',
    type: '遅刻',
    time: '16:30ごろ',
    reason: '通院',
  },
  {
    id: 'default-3',
    name: '掃除で遅刻 (16:15)',
    type: '遅刻',
    time: '16:15ごろ',
    reason: '掃除',
  },
  {
    id: 'default-4',
    name: '塾のため早退 (17:00)',
    type: '早退',
    time: '17:00ごろ',
    reason: '塾',
  },
  {
    id: 'default-5',
    name: '補修で遅刻 (16:45)',
    type: '遅刻',
    time: '16:45ごろ',
    reason: '補修',
  },
  {
    id: 'default-6',
    name: '電車遅延 (緊急)',
    type: '緊急遽刻',
    time: '30分程度',
    reason: '遅延',
  },
  {
    id: 'default-7',
    name: '私用のため欠席',
    type: '欠席',
    reason: '私用',
  },
];

export const DEFAULT_REASONS: string[] = [
  '体調不良',
  '私用',
  '通院',
  '塾',
  '掃除',
  '遅延',
  '補修',
];

export const DEFAULT_TIMES: string[] = [
  '16:00ごろ',
  '16:15ごろ',
  '16:30ごろ',
  '16:45ごろ',
  '17:00ごろ',
  '17:30ごろ',
  '18:00ごろ',
  '1時間程度',
];
