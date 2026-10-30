import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ClubEvent, PackingListCategory, EventClothing } from '../types';
import { formatJapaneseDate, getTodayString } from '../utils/date';
import { Calendar, Plus, Trash2, MapPin, Clock, Shirt, Tag } from 'lucide-react';

export const EventsView: React.FC = () => {
  const { events, saveEvent, deleteEvent, isAdmin } = useApp();

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayString());
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [location, setLocation] = useState<string>('');
  const [category, setCategory] = useState<PackingListCategory>('通常練習');
  const [clothing, setClothing] = useState<EventClothing>('部Tシャツ');
  const [notes, setNotes] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await saveEvent({
      title: title.trim(),
      date,
      startTime: startTime.trim() || undefined,
      endTime: endTime.trim() || undefined,
      location: location.trim() || undefined,
      category,
      clothing,
      notes: notes.trim() || undefined,
    });

    setTitle('');
    setLocation('');
    setNotes('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            部活動予定・イベント
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            本番・コンクール・合宿等の予定
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddForm ? '閉じる' : '予定を追加'}
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">新規予定の登録</h3>

          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">イベント名</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 定期演奏会、ホール練習"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">日程</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">場所</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 市民会館"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">開始〜終了</label>
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
                />
                <span className="text-xs text-slate-400">〜</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">服装</label>
              <select
                value={clothing}
                onChange={(e) => setClothing(e.target.value as EventClothing)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
              >
                <option value="部Tシャツ">部Tシャツ</option>
                <option value="制服">制服</option>
                <option value="ステージ衣装">ステージ衣装</option>
                <option value="私服">私服</option>
                <option value="その他">その他</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">備考</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="持ち物や集合時間等のメモ"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            予定を保存
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
          登録された予定はありません
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{ev.title}</h3>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                    {formatJapaneseDate(ev.date, true)}
                  </p>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`「${ev.title}」を削除しますか？`)) {
                        deleteEvent(ev.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                {ev.startTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {ev.startTime}{ev.endTime ? `〜${ev.endTime}` : ''}
                  </span>
                )}
                {ev.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {ev.location}
                  </span>
                )}
                {ev.clothing && (
                  <span className="flex items-center gap-1">
                    <Shirt className="w-3 h-3 text-slate-400" />
                    {ev.clothing}
                  </span>
                )}
              </div>

              {ev.notes && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                  {ev.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
