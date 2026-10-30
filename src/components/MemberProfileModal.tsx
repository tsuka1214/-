import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SECTIONS_AND_PARTS } from '../constants/parts';
import { X, User, Check, AlertCircle } from 'lucide-react';
import { KeyId } from '../types';

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingKeyId?: KeyId | null;
  onProfileSavedAndReport?: (keyId: KeyId, name: string, section: string, part: string) => void;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  isOpen,
  onClose,
  pendingKeyId,
  onProfileSavedAndReport,
}) => {
  const { myMemberName, myMemberSection, myMemberPart, setMyMemberProfile, members } = useApp();

  const getSafeInitialName = (n?: string) => {
    if (!n || n === '部員' || n === '名前未登録' || n === '齋藤凌吾' || !n.trim()) {
      return '今江司';
    }
    return n.trim();
  };

  const [name, setName] = useState<string>(() => getSafeInitialName(myMemberName));
  const [section, setSection] = useState<string>(myMemberSection || '木管');
  const [part, setPart] = useState<string>(myMemberPart || 'サックス');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(getSafeInitialName(myMemberName));
      setSection(myMemberSection || '木管');
      setPart(myMemberPart || 'サックス');
      setErrorMsg(null);
    }
  }, [isOpen, myMemberName, myMemberSection, myMemberPart]);

  if (!isOpen) return null;

  const currentParts = SECTIONS_AND_PARTS[section] || [];

  const handleSelectMember = (mem: { name: string; section?: string; part?: string }) => {
    setName(mem.name);
    if (mem.section) setSection(mem.section);
    if (mem.part) setPart(mem.part);
    setErrorMsg(null);
  };

  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName || cleanName === '部員') {
      setErrorMsg('正しいお名前を入力してください（「部員」は使用できません）');
      return;
    }
    setErrorMsg(null);
    setMyMemberProfile(cleanName, section, part);

    if (pendingKeyId && onProfileSavedAndReport) {
      onProfileSavedAndReport(pendingKeyId, cleanName, section, part);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {pendingKeyId ? '施錠報告のお名前登録' : 'あなたの報告者名設定'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 施錠前の名前登録ガイダンス */}
        {pendingKeyId && (
          <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">施錠報告前に名前を登録してください</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5 leading-snug">
                登録したお名前が鍵の報告者（reporterName）として記録・表示されます。
              </p>
            </div>
          </div>
        )}

        {/* 部員リストからワンタップ選択 */}
        {members.length > 0 && (
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
              登録部員から選択
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMember(m)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                    name === m.name
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* お名前入力 */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1">
            お名前 <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="例: 今江司"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {errorMsg && (
            <p className="text-[11px] text-rose-400 mt-1 font-medium">{errorMsg}</p>
          )}
        </div>

        {/* セクション選択 */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1">
            セクション
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {Object.keys(SECTIONS_AND_PARTS).map((secKey) => (
              <button
                key={secKey}
                type="button"
                onClick={() => {
                  setSection(secKey);
                  const firstPart = SECTIONS_AND_PARTS[secKey]?.[0] || '';
                  setPart(firstPart);
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center ${
                  section === secKey
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {secKey}
              </button>
            ))}
          </div>
        </div>

        {/* パート選択 */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1">
            パート
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {currentParts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPart(p)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  part === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 保存ボタン */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          <Check className="w-4 h-4" />
          <span>{pendingKeyId ? '名前を登録して施錠報告する' : 'この名前で設定する'}</span>
        </button>
      </div>
    </div>
  );
};
