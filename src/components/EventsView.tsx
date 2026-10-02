import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  List,
  Shirt,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  X,
  Check,
  CheckCircle2,
  Circle,
  AlertCircle,
  Info,
  LayoutList,
  CalendarDays,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ClubEvent, PackingListCategory } from '../types';
import { getTodayString, getDaysInMonth, getFirstDayOfWeek, toDateString } from '../utils/date';

type ViewMode = 'list' | 'calendar';

const ViewModeContext = React.createContext<{ viewMode: ViewMode; setViewMode: (v: ViewMode) => void } | null>(null);

const TimePulldown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [hour, minute] = (value || '08:00').split(':');

  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minute}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hour}:${newMinute}`);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={hour}
        onChange={(e) => handleHourChange(e.target.value)}
        disabled={disabled}
        className="flex-1 p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold appearance-none text-center disabled:opacity-40"
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <option key={i} value={String(i).padStart(2, '0')}>
            {String(i).padStart(2, '0')}時
          </option>
        ))}
      </select>
      <span className="font-bold text-slate-400">:</span>
      <select
        value={minute}
        onChange={(e) => handleMinuteChange(e.target.value)}
        disabled={disabled}
        className="flex-1 p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold appearance-none text-center disabled:opacity-40"
      >
        {Array.from({ length: 60 }).map((_, i) => (
          <option key={i} value={String(i).padStart(2, '0')}>
            {String(i).padStart(2, '0')}分
          </option>
        ))}
      </select>
    </div>
  );
};

const EventsView: React.FC = () => {
  const { events, isAdmin, saveEvent, deleteEvent } = useApp();
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  const today = getTodayString();

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: ClubEvent[] = [];
    const past: ClubEvent[] = [];

    events.forEach((event) => {
      if (event.endDate >= today) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
    past.sort((a, b) => b.startDate.localeCompare(a.startDate));

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events, today]);

  const handleOpenEditor = (event?: ClubEvent) => {
    setEditingEvent(event || null);
    setIsEditorOpen(true);
  };

  return (
    <div className="pb-24 animate-fadeIn">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              イベント・持ち物
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="カレンダー表示"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="リスト表示"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenEditor()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">作成</span>
              </button>
            )}
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <EventCalendarView
            events={events}
            onSelectEvent={setSelectedEvent}
          />
        ) : (
          <>
            {/* Upcoming Events Section */}
            <section className="space-y-3">
              <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 px-1">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                今後の予定
              </h3>
              {upcomingEvents.length > 0 ? (
                <div className="grid gap-4">
                  {upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => setSelectedEvent(event)}
                      isAdmin={isAdmin}
                      onEdit={() => handleOpenEditor(event)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                    <CalendarIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                    予定されているイベントはありません
                  </p>
                </div>
              )}
            </section>

            {/* Past Events Section */}
            {pastEvents.length > 0 && (
              <section className="space-y-3 pt-4">
                <button
                  onClick={() => setShowPastEvents(!showPastEvents)}
                  className="w-full flex items-center justify-between text-sm font-black text-slate-500 dark:text-slate-400 px-1 hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                    過去のイベント ({pastEvents.length})
                  </div>
                  {showPastEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showPastEvents && (
                  <div className="grid gap-3 opacity-80">
                    {pastEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => setSelectedEvent(event)}
                        isAdmin={isAdmin}
                        onEdit={() => handleOpenEditor(event)}
                        isPast
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Admin Editor Modal */}
      {isEditorOpen && (
        <AdminEventEditor
          event={editingEvent}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingEvent(null);
          }}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}
    </div>
  );
};

// --- Calendar View Component ---

interface EventCalendarViewProps {
  events: ClubEvent[];
  onSelectEvent: (event: ClubEvent) => void;
}

const EventCalendarView: React.FC<EventCalendarViewProps> = ({ events, onSelectEvent }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [year, month, daysInMonth, firstDayOfWeek]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(year, month - 1 + offset, 1));
  };

  const getEventsForDay = (day: number) => {
    const dateStr = toDateString(year, month, day);
    return events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
  };

  const todayStr = getTodayString();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
        <h3 className="text-base font-black text-slate-900 dark:text-white">
          {year}年 {month}月
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs font-black text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            今日
          </button>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-50 dark:border-slate-800">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
          <div
            key={day}
            className={`py-3 text-center text-[10px] font-black ${
              idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-20 sm:h-24 border-b border-r border-slate-50/50 dark:border-slate-800/30 bg-slate-50/30 dark:bg-slate-900/10" />;
          }

          const dayEvents = getEventsForDay(day);
          const isToday = toDateString(year, month, day) === todayStr;
          const isSunday = idx % 7 === 0;
          const isSaturday = idx % 7 === 6;

          return (
            <div
              key={day}
              className={`h-20 sm:h-24 border-b border-r border-slate-50 dark:border-slate-800 p-1 flex flex-col gap-1 overflow-hidden group ${
                isToday ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''
              }`}
            >
              <div className="flex justify-between items-center px-1">
                <span
                  className={`text-[10px] font-black ${
                    isToday
                      ? 'w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center'
                      : isSunday
                      ? 'text-red-500'
                      : isSaturday
                      ? 'text-blue-500'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {day}
                </span>
              </div>
              <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
                {dayEvents.map((event) => {
                  const isStart = event.startDate === toDateString(year, month, day);
                  return (
                    <button
                      key={event.id}
                      onClick={() => onSelectEvent(event)}
                      className={`w-full text-left px-1 py-0.5 rounded text-[8px] font-bold truncate leading-tight transition-all active:scale-95 ${
                        isStart
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                      }`}
                    >
                      {event.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-blue-600 rounded-full" />
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">開始日</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-blue-100 dark:bg-blue-900/40 rounded-full" />
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">期間中</span>
        </div>
      </div>
    </div>
  );
};

interface EventCardProps {
  event: ClubEvent;
  onClick: () => void;
  isAdmin: boolean;
  onEdit: () => void;
  isPast?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ event, onClick, isAdmin, onEdit, isPast }) => {
  const dateStr =
    event.startDate === event.endDate
      ? event.startDate.replace(/-/g, '/')
      : `${event.startDate.replace(/-/g, '/')} ~ ${event.endDate.replace(/-/g, '/')}`;

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white dark:bg-slate-850 rounded-3xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer ${
        isPast ? 'grayscale opacity-80' : ''
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1.5 flex-1 pr-8">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {event.name}
            </h4>
            {isPast && (
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black rounded-lg">
                終了
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
              <CalendarIcon className="w-3.5 h-3.5 text-blue-500/70" />
              <span>{dateStr}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-red-500/70" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700" />
        </div>
      </div>
    </div>
  );
};

interface EventDetailModalProps {
  event: ClubEvent;
  onClose: () => void;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose }) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem(`packing_list_${event.id}`);
    if (saved) {
      try {
        setCheckedItems(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved packing list checks');
      }
    }
  }, [event.id]);

  const toggleItem = (category: string, item: string) => {
    const key = `${category}:${item}`;
    const newChecked = { ...checkedItems, [key]: !checkedItems[key] };
    setCheckedItems(newChecked);
    localStorage.setItem(`packing_list_${event.id}`, JSON.stringify(newChecked));
  };

  const clearAllChecks = () => {
    if (window.confirm('すべてのチェックを外しますか？')) {
      setCheckedItems({});
      localStorage.removeItem(`packing_list_${event.id}`);
    }
  };

  const dateStr =
    event.startDate === event.endDate
      ? event.startDate.replace(/-/g, '/')
      : `${event.startDate.replace(/-/g, '/')} ~ ${event.endDate.replace(/-/g, '/')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden border-x border-t border-slate-100 dark:border-slate-800">
        <div className="p-6 pb-4 flex items-start justify-between bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {event.name}
            </h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                <CalendarIcon className="w-3 h-3" />
                <span>{dateStr}</span>
              </div>
              {event.gatheringTime && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Clock className="w-3 h-3" />
                  <span>集合: {event.gatheringTime}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-2xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-8 pb-32">
          {event.memo && (
            <div className="bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-3xl border border-blue-100/50 dark:border-blue-800/30">
              <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4" />
                <span className="text-xs font-black">管理者からのメモ</span>
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {event.memo}
              </p>
            </div>
          )}

          {event.clothing && (
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Shirt className="w-4 h-4 text-emerald-500" />
                服装の指定
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '上衣 (トップス)', value: event.clothing.top, icon: '👕' },
                  { label: '下衣 (ボトムス)', value: event.clothing.bottom, icon: '👖' },
                  { label: '靴', value: event.clothing.shoes, icon: '👟' },
                  { label: 'その他', value: event.clothing.other, icon: '🧣' },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {item.value || '指定なし'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.packingList && event.packingList.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <List className="w-4 h-4 text-blue-500" />
                  持ち物リスト
                </h4>
                <button
                  onClick={clearAllChecks}
                  className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-wider"
                >
                  チェックを全解除
                </button>
              </div>

              <div className="space-y-6">
                {event.packingList.map((cat, idx) => (
                  <div key={idx} className="space-y-2.5">
                    <h5 className="text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full w-fit">
                      {cat.category}
                    </h5>
                    <div className="grid gap-2">
                      {cat.items.map((item, itemIdx) => {
                        const key = `${cat.category}:${item}`;
                        const isChecked = !!checkedItems[key];
                        return (
                          <div
                            key={itemIdx}
                            onClick={() => toggleItem(cat.category, item)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                                : 'bg-white dark:bg-slate-850 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-200 dark:hover:border-blue-800'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {isChecked ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-in zoom-in duration-200" />
                              ) : (
                                <Circle className="w-5 h-5 text-slate-300 dark:text-slate-700" />
                              )}
                            </div>
                            <span className="text-sm font-bold flex-1">{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-linear-to-t from-white dark:from-slate-900 via-white dark:via-slate-900 to-transparent pt-12 sm:rounded-b-[2.5rem] pointer-events-none">
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-3xl flex items-center justify-between shadow-xl pointer-events-auto">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-white/10 dark:bg-slate-900/10 rounded-2xl flex items-center justify-center font-black text-lg">
                 {Object.values(checkedItems).filter(Boolean).length}
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-widest opacity-60">チェック済み</span>
                 <span className="text-sm font-black leading-none">準備完了を確認！</span>
               </div>
             </div>
             <button
               onClick={onClose}
               className="px-6 py-2.5 bg-blue-600 dark:bg-blue-500 text-white font-black rounded-2xl text-xs hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
             >
               閉じる
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdminEventEditorProps {
  event: ClubEvent | null;
  onClose: () => void;
  onSave: (data: Omit<ClubEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const AdminEventEditor: React.FC<AdminEventEditorProps> = ({ event, onClose, onSave, onDelete }) => {
  const [name, setName] = useState(event?.name || '');
  const [startDate, setStartDate] = useState(event?.startDate || getTodayString());
  const [endDate, setEndDate] = useState(event?.endDate || getTodayString());
  const [location, setLocation] = useState(event?.location || '');
  const [gatheringTime, setGatheringTime] = useState(event?.gatheringTime || '08:00');
  const [memo, setMemo] = useState(event?.memo || '');
  const [hasGatheringTime, setHasGatheringTime] = useState(!!event?.gatheringTime);
  const [reminderDays, setReminderDays] = useState<number[]>(event?.reminderDays || [3, 1, 0]);

  const [topClothing, setTopClothing] = useState(event?.clothing?.top || '');
  const [bottomClothing, setBottomClothing] = useState(event?.clothing?.bottom || '');
  const [shoesClothing, setShoesClothing] = useState(event?.clothing?.shoes || '');
  const [otherClothing, setOtherClothing] = useState(event?.clothing?.other || '');

  const [packingList, setPackingList] = useState<PackingListCategory[]>(
    event?.packingList || [
      { category: '楽器・楽譜', items: [] },
      { category: '衣類', items: [] },
      { category: '日用品', items: [] },
      { category: 'その他', items: [] },
    ]
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleAddItem = (catIdx: number) => {
    const item = window.prompt('持ち物を追加:');
    if (item && item.trim()) {
      const newList = [...packingList];
      newList[catIdx].items.push(item.trim());
      setPackingList(newList);
    }
  };

  const handleDeleteItem = (catIdx: number, itemIdx: number) => {
    const newList = [...packingList];
    newList[catIdx].items.splice(itemIdx, 1);
    setPackingList(newList);
  };

  const handleAddCategory = () => {
    const cat = window.prompt('新しいカテゴリ名:');
    if (cat && cat.trim()) {
      setPackingList([...packingList, { category: cat.trim(), items: [] }]);
    }
  };

  const handleSubmit = async () => {
    if (!name || !startDate || !endDate) {
      alert('イベント名と日付は必須です');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(
        {
          name,
          startDate,
          endDate,
          location,
          gatheringTime: hasGatheringTime ? gatheringTime : '',
          memo,
          clothing: {
            top: topClothing,
            bottom: bottomClothing,
            shoes: shoesClothing,
            other: otherClothing,
          },
          packingList,
          reminderEnabled: true,
          reminderDays,
        },
        event?.id
      );
      onClose();
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (window.confirm('このイベントを削除してもよろしいですか？')) {
      await onDelete(event.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-blue-600" />
            イベントの編集・作成
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
          <section className="space-y-4">
            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">基本情報</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">イベント名 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 第32回 定期演奏会"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">開始日 *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">終了日 *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">場所</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold"
                  placeholder="例: 文化会館 大ホール"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-500">集合時間</label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasGatheringTime}
                      onChange={(e) => setHasGatheringTime(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[10px] font-black text-slate-400">指定する</span>
                  </label>
                </div>
                {hasGatheringTime ? (
                  <TimePulldown value={gatheringTime} onChange={setGatheringTime} />
                ) : (
                  <div className="w-full p-3.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold text-slate-400 text-center">
                    指定なし
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">メモ</label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={2}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold"
                  placeholder="持ち物の注意点など"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest">通知設定</h4>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400">本番の何日前に通知するか選択</span>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Check className="w-2.5 h-2.5" />
                  LINE WORKS連携が有効な場合に自動送信されます
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 5, 3, 2, 1, 0].map((day) => {
                const isActive = reminderDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        setReminderDays(reminderDays.filter((d) => d !== day));
                      } else {
                        setReminderDays([...reminderDays, day].sort((a, b) => b - a));
                      }
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border-2 ${
                      isActive
                        ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-100'
                        : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    {day === 0 ? '当日' : `${day}日前`}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest">服装指定</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">上衣 (トップス)</label>
                <input
                  type="text"
                  value={topClothing}
                  onChange={(e) => setTopClothing(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold"
                  placeholder="例: 白ポロシャツ、部活Tシャツ"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">下衣 (ボトムス)</label>
                <input
                  type="text"
                  value={bottomClothing}
                  onChange={(e) => setBottomClothing(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold"
                  placeholder="例: 黒チノパン、指定ジャージ"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">靴</label>
                <input
                  type="text"
                  value={shoesClothing}
                  onChange={(e) => setShoesClothing(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold"
                  placeholder="例: 黒スニーカー、ローファー"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">その他</label>
                <input
                  type="text"
                  value={otherClothing}
                  onChange={(e) => setOtherClothing(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold"
                  placeholder="例: ネクタイ、リボン、帽子"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest">持ち物リスト</h4>
              <button
                onClick={handleAddCategory}
                className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/40 px-3 py-1 rounded-full"
              >
                + カテゴリ追加
              </button>
            </div>
            <div className="space-y-6">
              {packingList.map((cat, catIdx) => (
                <div key={catIdx} className="bg-slate-50 dark:bg-slate-850 p-5 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{cat.category}</span>
                    <button
                      onClick={() => handleAddItem(catIdx)}
                      className="text-[10px] font-black text-white bg-blue-600 px-3 py-1 rounded-full"
                    >
                      + 追加
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        <span>{item}</span>
                        <button
                          onClick={() => handleDeleteItem(catIdx, itemIdx)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {cat.items.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic">アイテムなし</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            {event && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl text-xs font-black transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>削除</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-black text-xs"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventsView;
