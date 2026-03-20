import clsx from 'clsx';
import type { SelectOption } from '../data/schedulingData';

type TimeSlotSelectorProps = {
  options: SelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
};

export function TimeSlotSelector({ options, selectedValues, onChange }: TimeSlotSelectorProps) {
  const toggleSlot = (value: string) => {
    if (value === 'any-time') {
      onChange(['any-time']);
      return;
    }

    const withoutAny = selectedValues.filter((item) => item !== 'any-time');
    const isSelected = withoutAny.includes(value);

    if (isSelected) {
      const next = withoutAny.filter((item) => item !== value);
      onChange(next.length === 0 ? ['any-time'] : next);
      return;
    }

    onChange([...withoutAny, value]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggleSlot(option.value)}
            className={clsx(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              isSelected
                ? 'border-[#0A64BC] bg-[#0A64BC]/10 text-[#0A64BC]'
                : 'border-slate-300 bg-white text-slate-600 hover:border-[#0A64BC]/40 hover:text-[#0A64BC]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
