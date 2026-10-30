import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AttendancePattern, ActiveAttendanceType } from '../types';
import { DEFAULT_ATTENDANCE_PATTERNS } from '../constants/patterns';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
  X,
  Save,
  Check,
  HelpCircle,
  Eye,
} from 'lucide-react';

const ATTENDANCE_TYPES: ActiveAttendanceType[] = ['欠席', '遅刻', '早退', '緊急遽刻'];

interface AttendancePatternsEditorProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const AttendancePatternsEditor: React.FC<AttendancePatternsEditorProps> = ({
  onClose,
  isModal = false,
}) => {
  const { settings, updateAttendancePatterns, resetAttendancePatternsToDefault } = useApp();

  // 現在の定型文リスト
  const currentPatterns: AttendancePattern[] =
    settings.attendancePatterns && settings.attendancePatterns.length > 0
      ? settings.attendancePatterns
      : DEFAULT_ATTENDANCE_PATTERNS;

  const [patterns, setPatterns] = useState<AttendancePattern[]>(currentPatterns);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // 編集フォームの入力ステート
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<ActiveAttendanceType>('欠席');
  const [formReason, setFormReason] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('');

  // 保存・フィードバックステート
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // プレビュー選択ステート（動作確認用）
  const [previewSelected, setPreviewSelected] = useState<AttendancePattern | null>(null);

  // settings.attendancePatterns が更新されたらローカルも同期（編集中でない場合）
  React.useEffect(() => {
    if (!editingId && !isAddingNew) {
      setPatterns(
        settings.attendancePatterns && settings.attendancePatterns.length > 0
          ? settings.attendancePatterns
          : DEFAULT_ATTENDANCE_PATTERNS
      );
    }
  }, [settings.attendancePatterns, editingId, isAddingNew]);

  // 新規追加モード開始
  const handleStartAdd = () => {
    setEditingId(null);
    setFormName('');
    setFormType('欠席');
    setFormReason('');
    setFormTime('');
    setIsAddingNew(true);
    setErrorMsg(null);
  };

  // 既存アイテム編集モード開始
  const handleStartEdit = (pat: AttendancePattern) => {
    setIsAddingNew(false);
    setEditingId(pat.id);
    setFormName(pat.name);
    setFormType(pat.type);
    setFormReason(pat.reason);
    setFormTime(pat.time || '');
    setErrorMsg(null);
  };

  // 編集/新規追加のキャンセル
  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormName('');
    setFormReason('');
    setFormTime('');
    setErrorMsg(null);
  };

  // フォーム保存（新規または更新）
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg('ボタン表示名を入力してください');
      return;
    }
    if (!formReason.trim()) {
      setErrorMsg('理由を入力してください');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      let updatedList: AttendancePattern[];

      if (isAddingNew) {
        const newItem: AttendancePattern = {
          id: `pat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: formName.trim(),
          type: formType,
          reason: formReason.trim(),
          time: formTime.trim() || undefined,
        };
        updatedList = [...patterns, newItem];
      } else if (editingId) {
        updatedList = patterns.map((p) =>
          p.id === editingId
            ? {
                ...p,
                name: formName.trim(),
                type: formType,
                reason: formReason.trim(),
                time: formTime.trim() || undefined,
              }
            : p
        );
      } else {
        return;
      }

      await updateAttendancePatterns(updatedList);
      setPatterns(updatedList);
      setIsAddingNew(false);
      setEditingId(null);
      setSuccessMsg(isAddingNew ? '定型文を追加しました！' : '定型文を更新しました！');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (patterns.length <= 1) {
      alert('定型文は最低1件必要です');
      return;
    }
    const target = patterns.find((p) => p.id === id);
    if (!window.confirm(`「${target?.name || 'この定型文'}」を削除しますか？`)) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedList = patterns.filter((p) => p.id !== id);
      await updateAttendancePatterns(updatedList);
      setPatterns(updatedList);
      if (editingId === id) {
        handleCancelForm();
      }
      setSuccessMsg('定型文を削除しました');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || '削除に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 並べ替え（上へ移動）
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newItems = [...patterns];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;

    setPatterns(newItems);
    try {
      await updateAttendancePatterns(newItems);
    } catch (err: any) {
      setErrorMsg('並べ替えの保存に失敗しました');
    }
  };

  // 並べ替え（下へ移動）
  const handleMoveDown = async (index: number) => {
    if (index === patterns.length - 1) return;
    const newItems = [...patterns];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;

    setPatterns(newItems);
    try {
      await updateAttendancePatterns(newItems);
    } catch (err: any) {
      setErrorMsg('並べ替えの保存に失敗しました');
    }
  };

  // 初期設定に戻す
  const handleResetToDefault = async () => {
    setIsSaving(true);
    setShowResetConfirm(false);
    try {
      await resetAttendancePatternsToDefault();
      setPatterns(DEFAULT_ATTENDANCE_PATTERNS);
      handleCancelForm();
      setSuccessMsg('定型文を初期設定に戻しました！');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg('初期化に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 区分ごとのバッジスタイル
  const getTypeBadgeStyle = (type: ActiveAttendanceType) => {
    switch (type) {
      case '欠席':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      case '遅刻':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case '早退':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case '緊急遽刻':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className={`space-y-4 ${isModal ? 'p-1' : ''}`}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                出欠連絡の定型文（連絡パターン）編集
              </h2>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                連絡フォームに表示されるワンタップ定型文を追加・編集・並べ替えできます
              </span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartAdd}
              disabled={isAddingNew || isSaving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新しい定型文を追加</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                disabled={isSaving}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>初期設定に戻す</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 p-1.5 rounded-xl border border-amber-200 dark:border-amber-900">
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">初期化しますか？</span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  disabled={isSaving}
                  className="text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded cursor-pointer"
                >
                  はい
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Add / Edit Form Card */}
        {(isAddingNew || editingId) && (
          <form
            onSubmit={handleSaveItem}
            className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-3 mt-2"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                {isAddingNew ? (
                  <>
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>定型文の新規作成</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>定型文の編集</span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                閉じる
              </button>
            </div>

            {/* Button Label / Name */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                ボタン表示名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例: 体調不良 (欠席)、部活補習 (遅刻)、通院 (早退)"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                フォームに並ぶボタンのラベルです
              </span>
            </div>

            {/* Attendance Type Selection */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                出欠区分 <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {ATTENDANCE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormType(t)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all text-center cursor-pointer ${
                      formType === t
                        ? t === '欠席'
                          ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-600'
                          : t === '遅刻'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : t === '早退'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                自動入力される理由 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="例: 発熱・体調不良のため、放課後補習のため、交通機関遅延のため"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Time (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  自動入力される時刻（任意）
                </label>
                <span className="text-[10px] text-slate-400">遅刻・早退・緊急遽刻向け</span>
              </div>
              <input
                type="text"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                placeholder="例: 17:00、5限終了後、未定"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ボタンを押した際に「到着予定時刻」または「早退予定時刻」に自動反映されます
              </span>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleCancelForm}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? '保存中...' : '定型文を保存する'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Pattern List */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
            <span>登録済みの定型文（全 {patterns.length} 件）</span>
            <span className="text-[10px] text-slate-400">上下の矢印で並び順を変更できます</span>
          </div>

          <div className="space-y-1.5">
            {patterns.map((pat, idx) => (
              <div
                key={pat.id}
                className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  editingId === pat.id
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Left: Info */}
                <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                  {/* Order Buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0 pt-0.5 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0 || isSaving}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                      title="上へ"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === patterns.length - 1 || isSaving}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                      title="下へ"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Type Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getTypeBadgeStyle(
                      pat.type
                    )}`}
                  >
                    {pat.type}
                  </span>

                  {/* Content details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {pat.name}
                      </span>
                      {pat.time && (
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-900 shrink-0">
                          時刻: {pat.time}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                      理由: {pat.reason}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-1 sm:pt-0 border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(pat)}
                    disabled={isSaving}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>編集</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pat.id)}
                    disabled={isSaving || patterns.length <= 1}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    title={patterns.length <= 1 ? '定型文は最低1件必要です' : '削除'}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>削除</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview of Form Buttons */}
        <div className="p-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              <span>出欠連絡フォームでのプレビュー（タップして動作確認できます）</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {patterns.map((pat) => (
              <button
                key={pat.id}
                type="button"
                onClick={() => setPreviewSelected(pat)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                  previewSelected?.id === pat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {pat.name}
              </button>
            ))}
          </div>

          {previewSelected && (
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  プレビュー反映結果
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTypeBadgeStyle(previewSelected.type)}`}>
                  {previewSelected.type}
                </span>
              </div>
              <div className="text-[11px] text-slate-700 dark:text-slate-300">
                <span className="font-semibold">理由: </span>
                {previewSelected.reason}
              </div>
              {previewSelected.time && (
                <div className="text-[11px] text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">時刻: </span>
                  {previewSelected.time}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal footer (if inside modal) */}
        {isModal && onClose && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl text-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              完了
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
