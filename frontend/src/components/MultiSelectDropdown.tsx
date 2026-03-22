import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectDropdownProps = {
  value: string[];
  onChange: (next: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  emptyMessage?: string;
  exclusiveOptionValue?: string;
};

export function MultiSelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select options',
  emptyMessage = 'No available options',
  exclusiveOptionValue,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label)
    .join(', ');

  const toggleValue = (optionValue: string) => {
    const isSelected = value.includes(optionValue);

    if (exclusiveOptionValue && optionValue === exclusiveOptionValue) {
      onChange(isSelected ? [] : [exclusiveOptionValue]);
      return;
    }

    const nextValue = exclusiveOptionValue
      ? value.filter((entry) => entry !== exclusiveOptionValue)
      : value;

    if (isSelected) {
      onChange(nextValue.filter((entry) => entry !== optionValue));
      return;
    }

    onChange([...nextValue, optionValue]);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex min-h-[38px] w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-400"
      >
        <span className={selectedLabels ? 'text-slate-700' : 'text-slate-400'}>
          {selectedLabels || placeholder}
        </span>
        <span className="ml-2 inline-flex items-center gap-2">
          <span className="text-xs text-slate-500">{value.length}</span>
          <ChevronDown
            size={16}
            className={clsx('text-slate-400 transition-transform', isOpen && 'rotate-180')}
          />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {options.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-500">{emptyMessage}</p>
          ) : (
            options.map((option) => {
              const checked = value.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(option.value)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0A64BC] focus:ring-[#0A64BC]/30"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
