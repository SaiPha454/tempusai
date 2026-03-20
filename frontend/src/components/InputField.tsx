import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

type InputFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'number';
  icon?: LucideIcon;
  onEnter?: () => void;
};

export function InputField({
  value,
  onChange,
  placeholder,
  type = 'text',
  icon: Icon,
  onEnter,
}: InputFieldProps) {
  return (
    <div className="relative">
      {Icon ? <Icon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /> : null}
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnter) {
            onEnter();
          }
        }}
        placeholder={placeholder}
        className={clsx(
          'h-10 w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-800 outline-none transition',
          'focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20',
          Icon ? 'pl-9 pr-3' : 'px-3',
        )}
      />
    </div>
  );
}
