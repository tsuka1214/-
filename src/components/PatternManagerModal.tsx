import React, { useState } from 'react';
import { AttendancePattern, AttendanceType } from '../types';
import { X, Plus, Trash2, Edit3, Check, Sparkles, RotateCcw, Clock, FileText, BookmarkCheck } from 'lucide-react';
import { DEFAULT_ATTENDANCE_PATTERNS } from '../constants/patterns';

interface PatternManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patterns: AttendancePattern[];
  onSavePatterns: (patterns: AttendancePattern[]) => void;
  initialNewPattern?: {
    type: AttendanceType;
    time?: string;
    reason?: string;
  } | null;
}

export const PatternManagerModal: React.FC<PatternManagerModalProps> = ({
  isOpen,
  onClose,
  patterns,
  onSavePatterns,
  initialNewPattern,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(Boolean(initialNewPattern));

  // Form states for add / edit
  const [formName, setFormName] = useState<string>(
    initialNewPattern
      ? `${initialNewPattern.reason || initialNewPattern.type}${initialNewPattern.time ? ` (${initialNewPattern.time})` : ''}`
      : ''
  );
  const [formType, setFormType] = useState<AttendanceType>(initialNewPattern?.type || '欠席');
  const [formTime, setFormTime] = useState<string>(initialNewPattern?.time || '');
  const [formReason, setFormReason] = useState<string>(initialNewPattern?.reason || '');

  if (!isOpen) return null;

  const startEdit = (p: AttendancePattern) => {
    setEditingId(p.id);
    setIsAddingNew(false);
    setFormName(p.name);
    setFormType(p.type);
    setFormTime(p.time || '');
    setFormReason(p.reason || '');
  };

  const startAdd = () => {
    setEditingId(null);
    setIsAddingNew(true);
    setFormName('');
    setFormType('欠席');
    setFormTime('');
    setFormReason('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setFormName('');
    setFormTime('');
    setFormReason('');
  };

  const saveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (isAddingNew) {
      const newPattern: AttendancePattern = {
        id: `pat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: formName.trim(),
        type: formType,
        time: (formType === '遅刻' || formType === '緊急遽刻' || formType === '早退') ? formTime.trim() : '',
        reason: formReason.trim(),
        isCustom: true,
      };
      onSavePatterns([newPattern, ...patterns]);
    } else if (editingId) {
      const updated = patterns.map((p) => {
        if (p.id === editingId) {
          return {
            ...p,
            name: formName.trim(),
            type: formType,
            time: (formType === '遅刻' || formType === '緊急遽刻' || formType === '早退') ? formTime.trim() : '',
            reason: formReason.trim(),
          };
        }
        return p;
      });
      onSavePatterns(updated);
    }

    cancelEdit();
  };

  const deletePattern = (id: string) => {
    if (patterns.length <= 1) {
      alert('少なくとも1つのパターンを残してください。');
      return;
    }
    const updated = patterns.filter((p) => p.id !== id);
    onSavePatterns(updated);
    if (editingId === id) {
      cancelEdit();
    }
  };

  const resetToDefault = () => {
    if (window.confirm('プリセットを初期状態（デフォルト）に戻しますか？')) {
      onSavePatterns(DEFAULT_ATTENDANCE_PATTERNS);
      cancelEdit();
    }
  };

  const getTypeBadgeClass = (t: AttendanceType) => {
    switch (t) {
      case '欠席':
        return 'bg-red-500 text-white';
      case '遅刻':
        return 'bg-amber-500 text-white';
      case '緊急遽刻':
        return 'bg-rose-600 text-white font-bold';
      case '早退':
        return 'bg-yellow-500 text-slate-950 font-bold';
    }
  };

  return (
    <div
      id="pattern-manager-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div
        id="pattern-manager-modal-content"
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                よく使う連絡パターンの設定
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ワンタップで区分・時間・理由を一括入力できるプリセット
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Form for Adding / Editing */}
          {(isAddingNew || editingId) ? (
            <form onSubmit={saveForm} className="bg-slate-50 dark:bg-slate-800/80 border-2 border-blue-500/50 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4" />
                  {isAddingNew ? '新しいパターンを作成' : 'パターンを編集'}
                </span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  キャンセル
                </button>
              </div>

              {/* Pattern Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  パターン名（ボタンに表示される名称） <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: 通院遅刻 (16:30)、ピアノで早退 など"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Type Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  出欠区分 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['欠席', '遅刻', '緊急遽刻', '早退'] as AttendanceType[]).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setFormType(t)}
                      className={`h-9 rounded-xl text-xs font-bold border-2 transition-all ${
                        formType === t
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time (for late/early) */}
              {(formType === '遅刻' || formType === '緊急遽刻' || formType === '早退') && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    時間目安
                  </label>
                  <input
                    type="text"
                    placeholder="例: 16:30ごろ、1時間程度、2限後"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  理由（任意）
                </label>
                <input
                  type="text"
                  placeholder="例: 通院、塾、体調不良、掃除 など"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  保存する
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  キャンセル
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              id="btn-add-new-pattern"
              onClick={startAdd}
              className="w-full h-11 border-2 border-dashed border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              新しいパターンを登録する
            </button>
          )}

          {/* Pattern List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
              <span>登録済みパターン ({patterns.length}件)</span>
              <button
                type="button"
                onClick={resetToDefault}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                初期状態に戻す
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-2 border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              {patterns.map((p) => (
                <div
                  key={p.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${getTypeBadgeClass(p.type)}`}>
                        {p.type}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {p.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          {p.time}
                        </span>
                      )}
                      {p.reason && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-blue-500" />
                          {p.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
                      title="編集"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePattern(p.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors cursor-pointer"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
