import clsx from 'clsx';

type ToggleSwitchProps = {
  label: string;
  checked: boolean;
  onChange: () => void;
  variant?: 'default' | 'hard' | 'soft';
};

export function ToggleSwitch({ label, checked, onChange, variant = 'default' }: ToggleSwitchProps) {
  const trackOnClass =
    variant === 'hard'
      ? 'bg-rose-600'
      : variant === 'soft'
        ? 'bg-amber-500'
        : 'bg-[#0A64BC]';

  const containerClass =
    variant === 'hard'
      ? 'border-rose-200 bg-rose-50/60'
      : variant === 'soft'
        ? 'border-amber-200 bg-amber-50/60'
        : 'border-slate-200 bg-slate-50/70';

  return (
    <label className={clsx('flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5', containerClass)}>
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={clsx(
          'relative inline-flex h-6 w-11 items-center rounded-full transition',
          checked ? trackOnClass : 'bg-slate-300',
        )}
      >
        <span
          className={clsx(
            'inline-block h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </button>
    </label>
  );
}
