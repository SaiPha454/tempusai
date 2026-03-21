import clsx from 'clsx';

type Option = {
  value: string;
  label: string;
};

type PillMultiSelectorProps = {
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  emptyLabel?: string;
};

export function PillMultiSelector({
  options,
  selectedValues,
  onChange,
  emptyLabel,
}: PillMultiSelectorProps) {
  const toggleValue = (value: string) => {
    const isSelected = selectedValues.includes(value);
    if (isSelected) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }
    onChange([...selectedValues, value]);
  };

  if (options.length === 0) {
    return <p className="text-xs text-slate-500">{emptyLabel ?? 'No options available.'}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggleValue(option.value)}
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
