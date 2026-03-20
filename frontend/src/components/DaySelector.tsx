import clsx from 'clsx';

type DaySelectorProps = {
  days: string[];
  selectedDays: string[];
  onChange: (days: string[]) => void;
};

export function DaySelector({ days, selectedDays, onChange }: DaySelectorProps) {
  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter((item) => item !== day));
      return;
    }
    onChange([...selectedDays, day]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {days.map((day) => {
        const isSelected = selectedDays.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(day)}
            className={clsx(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              isSelected
                ? 'border-[#0A64BC] bg-[#0A64BC]/10 text-[#0A64BC]'
                : 'border-slate-300 bg-white text-slate-600 hover:border-[#0A64BC]/40 hover:text-[#0A64BC]',
            )}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}
