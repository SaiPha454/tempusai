import { ChevronDown } from 'lucide-react';

type Option = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  optionColorByValue?: Record<string, string>;
};

export function SelectField({ value, onChange, options, optionColorByValue }: SelectFieldProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            style={optionColorByValue?.[option.value] ? { color: optionColorByValue[option.value] } : undefined}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}
