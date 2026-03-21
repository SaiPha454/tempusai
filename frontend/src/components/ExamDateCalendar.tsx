import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useMemo, useState } from 'react';

type ExamDateCalendarProps = {
  selectedDates: string[];
  onToggleDate: (isoDate: string) => void;
};

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function ExamDateCalendar({ selectedDates, onToggleDate }: ExamDateCalendarProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const { monthLabel, leadingEmptyDays, daysInMonth } = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return {
      monthLabel: monthCursor.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
      leadingEmptyDays: firstDay.getDay(),
      daysInMonth: lastDay.getDate(),
    };
  }, [monthCursor]);

  const changeMonth = (offset: number) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>

        <p className="text-sm font-semibold text-slate-800">{monthLabel}</p>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdayNames.map((weekday) => (
          <p key={weekday} className="py-1 text-center text-xs font-medium text-slate-500">
            {weekday}
          </p>
        ))}

        {Array.from({ length: leadingEmptyDays }).map((_, index) => (
          <div key={`empty-${index}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
          const day = dayIndex + 1;
          const isoDate = toLocalIsoDate(
            new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day),
          );
          const isSelected = selectedDates.includes(isoDate);

          return (
            <button
              key={isoDate}
              type="button"
              onClick={() => onToggleDate(isoDate)}
              className={clsx(
                'h-9 rounded-md text-xs font-medium transition',
                isSelected
                  ? 'bg-[#0A64BC] text-white'
                  : 'text-slate-700 hover:bg-[#0A64BC]/10 hover:text-[#0A64BC]',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
