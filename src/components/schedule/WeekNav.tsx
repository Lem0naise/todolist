export function WeekNav({
  weekDays,
  selectedDate,
  todayStr,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
}: {
  weekDays: {
    date: string;
    dayOfWeek: number;
    label: string;
    dateNum: number;
  }[];
  selectedDate: string;
  todayStr: string;
  onSelectDay: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4 bg-white p-1.5 rounded-xl border border-cream-200 shadow-sm">
      <button
        onClick={onPrevWeek}
        className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-cream-100 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
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
                isSelected
                  ? "bg-rose-400 shadow-sm text-white"
                  : isToday
                    ? "bg-rose-50 text-rose-500 hover:bg-rose-100"
                    : "text-stone-400 hover:bg-cream-100"
              }`}
            >
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">
                {day.label}
              </span>
              <span className="text-sm sm:text-base font-black">
                {day.dateNum}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onNextWeek}
        className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-cream-100 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
