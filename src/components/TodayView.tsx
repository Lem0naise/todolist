import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalCache } from "../hooks/useLocalCache";
import { TodoModal } from "./TodoModal";
import type { Id } from "../../convex/_generated/dataModel";

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateInfo(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return {
    dateStr,
    dayOfWeek: d.getDay(),
    display: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`,
  };
}

function getWeekDays(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysFromMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const ds = day.toISOString().split("T")[0];
    return { date: ds, dayOfWeek: day.getDay(), label: SHORT_DAYS[day.getDay()], dateNum: day.getDate() };
  });
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getTimeOffset(timeStr: string) {
   const [h, m] = timeStr.split(":").map(Number);
   const pxPerHour = 60;
   const offsetHours = (h - 8) + (m / 60);
   return offsetHours * pxPerHour;
}

type LinkedTodo = {
  _id: Id<"todos">;
  title: string;
  description?: string;
  dueDate?: string;
  highPriority: boolean;
  completed: boolean;
};

type TodayEvent = {
  _id: Id<"timetableEvents">;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime?: string;
  occurrence: {
    _id: Id<"occurrences">;
    status: "pending" | "done" | "todo";
    todoId?: Id<"todos">;
    linkedTodo?: LinkedTodo;
  } | null;
};

export function TodayView({
  initialDate,
}: {
  onGoToTodos: () => void;
  initialDate?: string;
}) {
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? todayStr);
  const [editingTodo, setEditingTodo] = useState<LinkedTodo | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [selectedWeekEvent, setSelectedWeekEvent] = useState<{ event: TodayEvent; date: string } | null>(null);

  const [prevInitialDate, setPrevInitialDate] = useState(initialDate);
  if (initialDate !== prevInitialDate) {
    setPrevInitialDate(initialDate);
    if (initialDate) setSelectedDate(initialDate);
  }

  const [prevToday, setPrevToday] = useState(todayStr);
  if (todayStr !== prevToday) {
    setPrevToday(todayStr);
    setSelectedDate(todayStr);
  }

  const dateInfo = getDateInfo(selectedDate);
  const weekDays = getWeekDays(selectedDate);
  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;

  const aliasesQuery = useQuery(api.aliases.list);
  const aliases = useLocalCache("aliases", aliasesQuery) || [];
  
  const aliasesMap = new Map<string, string>();
  for (const a of aliases) {
    aliasesMap.set(a.originalTitle.toLowerCase(), a.alias);
  }

  function applyAlias(title: string): string {
    const cleanTitle = title.replace(/^Missed:\s*/i, "");
    return aliasesMap.get(cleanTitle.toLowerCase()) ?? cleanTitle;
  }

  const liveEvents = useQuery(api.timetable.getForDate, {
    date: selectedDate,
    dayOfWeek: dateInfo.dayOfWeek,
  });
  const events = useLocalCache<TodayEvent[]>(`today:${selectedDate}`, liveEvents) as TodayEvent[] | null | undefined;

  const setStatus = useMutation(api.occurrences.setStatus);
  const convertToTodo = useMutation(api.occurrences.convertToTodo);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const handleToggleDone = async (event: TodayEvent, dateOverride?: string) => {
    const currentStatus = event.occurrence?.status ?? "pending";
    const newStatus = currentStatus === "done" ? "pending" : "done";
    await setStatus({ eventId: event._id, date: dateOverride ?? selectedDate, status: newStatus });
    if (selectedWeekEvent && selectedWeekEvent.event._id === event._id) {
      setSelectedWeekEvent(null); // auto-close popover
    }
  };

  const handleMarkTodo = async (event: TodayEvent, dateOverride?: string) => {
    const currentStatus = event.occurrence?.status ?? "pending";
    const targetDate = dateOverride ?? selectedDate;
    if (currentStatus === "todo") {
      if (event.occurrence?.linkedTodo) {
        setEditingTodo(event.occurrence.linkedTodo);
      } else {
        await setStatus({ eventId: event._id, date: targetDate, status: "pending" });
      }
    } else {
      await convertToTodo({ eventId: event._id, date: targetDate, dueDate: targetDate });
    }
    if (selectedWeekEvent && selectedWeekEvent.event._id === event._id) {
      setSelectedWeekEvent(null);
    }
  };

  const goToPrevWeek = () => setSelectedDate(offsetDate(selectedDate, -7));
  const goToNextWeek = () => setSelectedDate(offsetDate(selectedDate, 7));

  if (events === undefined && viewMode === "day") {
    return (
      <div className="p-4 max-w-4xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <WeekNav weekDays={weekDays} selectedDate={selectedDate} todayStr={todayStr} onSelectDay={setSelectedDate} onPrevWeek={goToPrevWeek} onNextWeek={goToNextWeek} />
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const noEvents = !events || events.length === 0;

  return (
    <div className="p-4 max-w-4xl mx-auto min-h-screen transition-colors">
      <WeekNav weekDays={weekDays} selectedDate={selectedDate} todayStr={todayStr} onSelectDay={setSelectedDate} onPrevWeek={goToPrevWeek} onNextWeek={goToNextWeek} />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{dateInfo.display}</h2>
            {isToday && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded font-medium">Today</span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isToday ? "Today's schedule" : isFuture ? "Upcoming schedule" : "Past schedule"}
          </p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
          <button onClick={() => setViewMode("day")} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === "day" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>List</button>
          <button onClick={() => setViewMode("week")} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === "week" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>Week grid</button>
        </div>
      </div>

      {viewMode === "week" ? (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[700px] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex relative">
            <div className="w-12 border-r border-slate-100 dark:border-slate-800 flex-shrink-0">
              {Array.from({length: 15}, (_, i) => i + 8).map(h => (
                <div key={h} className="h-[60px] relative border-b border-slate-50 dark:border-slate-800/50">
                  <span className="absolute -top-2 left-0 right-0 text-center text-[9px] text-slate-400 dark:text-slate-500 font-bold bg-white dark:bg-slate-900 mx-1">
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>
            {weekDays.map(day => (
               <DayColumn 
                 key={day.date} day={day} todayStr={todayStr} currentTime={currentTime} 
                 onSelectEvent={(e: TodayEvent) => setSelectedWeekEvent({ event: e, date: day.date })}
                 aliasesMap={aliasesMap}
               />
            ))}
          </div>
        </div>
      ) : (
        <>
          {noEvents ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3 opacity-50 grayscale pt-8">📅</div>
              <p className="text-sm font-medium">No classes {isToday ? "today" : "on this day"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const status = event.occurrence?.status ?? "pending";
                const isDone = status === "done";
                const isTodo = status === "todo";
                const isPast = selectedDate < todayStr || (isToday && event.startTime < currentTime);
                const isUnresolvedPast = isPast && !isDone && !isTodo;

                return (
                  <EventCard 
                    key={event._id}
                    event={event}
                    isDone={isDone}
                    isTodo={isTodo}
                    isUnresolvedPast={isUnresolvedPast}
                    onToggleDone={() => handleToggleDone(event)}
                    onMarkTodo={() => handleMarkTodo(event)}
                    aliasedTitle={applyAlias(event.title)}
                  />
                );
              })}
            </div>
          )}

          {events && events.length > 0 && (
            <div className="mt-6 flex gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500" />
                {events.filter((e) => e.occurrence?.status === "done").length} done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                {events.filter((e) => !e.occurrence || e.occurrence.status === "pending").length} remaining
              </span>
              {events.some((e) => e.occurrence?.status === "todo") && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500" />
                  {events.filter((e) => e.occurrence?.status === "todo").length} in todos
                </span>
              )}
            </div>
          )}
        </>
      )}

      {selectedWeekEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedWeekEvent(null)}>
          <div className="w-full max-w-lg bg-transparent" onClick={e => e.stopPropagation()}>
            {(() => {
                const event = selectedWeekEvent.event;
                const status = event.occurrence?.status ?? "pending";
                const isDone = status === "done";
                const isTodo = status === "todo";
                const isPast = selectedWeekEvent.date < todayStr || (selectedWeekEvent.date === todayStr && event.startTime < currentTime);
                const isUnresolvedPast = isPast && !isDone && !isTodo;
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {new Date(selectedWeekEvent.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <button onClick={() => setSelectedWeekEvent(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="p-4">
                      <EventCard 
                        event={event}
                        isDone={isDone}
                        isTodo={isTodo}
                        isUnresolvedPast={isUnresolvedPast}
                        onToggleDone={() => handleToggleDone(event, selectedWeekEvent.date)}
                        onMarkTodo={() => handleMarkTodo(event, selectedWeekEvent.date)}
                        aliasedTitle={applyAlias(event.title)}
                      />
                    </div>
                  </div>
                );
            })()}
          </div>
        </div>
      )}

      {editingTodo && (
        <TodoModal
          onClose={() => setEditingTodo(null)}
          editTodo={editingTodo}
        />
      )}
    </div>
  );
}

function EventCard({
  event,
  isDone,
  isTodo,
  isUnresolvedPast,
  onToggleDone,
  onMarkTodo,
  aliasedTitle,
}: {
  event: TodayEvent;
  isDone: boolean;
  isTodo: boolean;
  isUnresolvedPast: boolean;
  onToggleDone: () => void;
  onMarkTodo: () => void;
  aliasedTitle: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isDone
          ? "bg-slate-50 border-slate-100 opacity-60 dark:bg-slate-900/50 dark:border-slate-800"
          : isTodo
          ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40"
          : isUnresolvedPast
          ? "bg-orange-50 border-orange-300 ring-1 ring-orange-200 dark:bg-orange-900/20 dark:border-orange-600/50 dark:ring-orange-500/30 shadow-md"
          : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3 w-full">
        <button
          onClick={onToggleDone}
          className={`mt-0.5 w-5 h-5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            isDone
              ? "bg-green-500 border-green-500 dark:bg-green-600"
              : "border-slate-300 dark:border-slate-500 hover:border-green-400 dark:hover:border-green-500 bg-white/50 dark:bg-slate-900/50"
          }`}
        >
          {isDone && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className={`font-bold text-[15px] ${isDone ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}>
              {aliasedTitle ?? event.title}
            </span>
            {isUnresolvedPast && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800 ml-1">
                Catch up?
              </span>
            )}
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              {event.startTime}{event.endTime ? `–${event.endTime}` : ""}
            </span>
          </div>
          {event.location && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{event.location}</p>
          )}
          {event.description && !isDone && (
            <p className="text-[13px] text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 leading-snug">{event.description}</p>
          )}
        </div>

        {!isDone && (
          <div className="flex flex-col gap-2">
            <button
              onClick={onMarkTodo}
              title={isTodo ? (event.occurrence?.linkedTodo ? "Edit linked todo" : "Remove from todos") : "Add to todos"}
              className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isTodo
                  ? "text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800"
                  : isUnresolvedPast 
                  ? "text-white bg-orange-500 hover:bg-orange-600 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              }`}
            >
              {isTodo && event.occurrence?.linkedTodo ? (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Edit</>
              ) : isTodo ? (
                <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>Added</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>Add to Todos</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  todayStr,
  currentTime,
  onSelectEvent,
  aliasesMap,
}: {
  day: { date: string; dayOfWeek: number; label: string; dateNum: number };
  todayStr: string;
  currentTime: string;
  onSelectEvent: (event: TodayEvent) => void;
  aliasesMap: Map<string, string>;
}) {
  const liveEvents = useQuery(api.timetable.getForDate, { date: day.date, dayOfWeek: day.dayOfWeek });
  const events = useLocalCache(`week:${day.date}`, liveEvents) as TodayEvent[] | null | undefined;
  const isToday = day.date === todayStr;

  function applyAlias(title: string): string {
    const cleanTitle = title.replace(/^Missed:\s*/i, "");
    return aliasesMap?.get(cleanTitle.toLowerCase()) ?? cleanTitle;
  }

  return (
    <div className={`flex-1 border-r border-slate-100 dark:border-slate-800 relative min-w-[100px] ${isToday ? "bg-blue-50/20 dark:bg-blue-900/10" : ""}`}>
      {Array.from({length: 15}, (_, i) => i + 8).map(h => (
         <div key={h} className="h-[60px] border-b border-slate-50 dark:border-slate-800/50" />
      ))}
      
      {isToday && (
         <div 
           className="absolute left-0 right-0 border-t-2 border-red-500 z-20 flex items-center shadow-[0_0_8px_rgba(239,68,68,0.3)]" 
           style={{ top: getTimeOffset(currentTime) }}
         >
           <div className="w-2 h-2 rounded-full bg-red-500 absolute -left-1 -translate-y-1/2" />
         </div>
      )}

      {events?.map(event => {
         const top = getTimeOffset(event.startTime);
         const height = event.endTime ? getTimeOffset(event.endTime) - top : 60;
         const status = event.occurrence?.status ?? "pending";
         const isDone = status === "done";
         const isTodo = status === "todo";
         const isPast = day.date < todayStr || (isToday && event.startTime < currentTime);
         const isUnresolvedPast = isPast && !isDone && !isTodo;
         
         return (
             <button 
               key={event._id}
               onClick={() => onSelectEvent(event)}
               className={`absolute left-1 right-1 rounded-md p-1.5 overflow-hidden border shadow-sm text-left transition-all hover:ring-1 hover:z-30 block ${
                 isDone ? "bg-slate-100 border-slate-200/80 opacity-60 dark:bg-slate-800 dark:border-slate-700 text-slate-500" :
                 isTodo ? "bg-amber-100/80 border-amber-200 dark:bg-amber-900/40 dark:border-amber-800/60 text-amber-900 dark:text-amber-100" :
                 isUnresolvedPast ? "bg-orange-100 border-orange-300 dark:bg-orange-900/40 dark:border-orange-600/60 text-orange-900 dark:text-orange-100" :
                 "bg-blue-50/90 border-blue-200 dark:bg-blue-900/40 dark:border-blue-800/60 text-blue-900 dark:text-blue-100"
               } ${isUnresolvedPast ? "animate-pulse shadow-md" : ""}`}
               style={{ top, height: Math.max(height, 24) }}
             >
               <div className="text-[10px] font-bold truncate leading-tight mb-0.5">{applyAlias(event.title)}</div>
               {height >= 40 && event.location && <div className="text-[9px] truncate opacity-80 font-medium leading-none">{event.location}</div>}
             </button>
         );
      })}
    </div>
  )
}

function WeekNav({
  weekDays,
  selectedDate,
  todayStr,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
}: {
  weekDays: { date: string; dayOfWeek: number; label: string; dateNum: number }[];
  selectedDate: string;
  todayStr: string;
  onSelectDay: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-5 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <button onClick={onPrevWeek} className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>

      <div className="flex gap-1 sm:gap-2 flex-1 mx-2">
        {weekDays.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === todayStr;
          return (
            <button
              key={day.date}
              onClick={() => onSelectDay(day.date)}
              className={`flex-1 flex flex-col items-center py-1 sm:py-2 rounded-lg transition-all ${
                isSelected ? "bg-blue-600 shadow-md text-white ring-1 ring-blue-700" : 
                isToday ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50" : 
                "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5 ${isSelected ? "text-blue-100" : ""}`}>{day.label}</span>
              <span className={`text-sm sm:text-base font-black ${isSelected ? "" : "opacity-90"}`}>{day.dateNum}</span>
            </button>
          );
        })}
      </div>

      <button onClick={onNextWeek} className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}
