import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type CardProps = {
  title: string;
  icon?: LucideIcon;
  headerRight?: ReactNode;
  children: ReactNode;
};

export function Card({ title, icon: Icon, headerRight, children }: CardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon ? <Icon size={16} className="text-[#0A64BC]" /> : null}
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        </div>
        {headerRight ? <div className="flex items-center gap-2">{headerRight}</div> : null}
      </div>
      {children}
    </section>
  );
}
