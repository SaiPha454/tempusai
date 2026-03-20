import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

type SidebarItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
};

type SidebarProps = {
  brand: string;
  items: SidebarItem[];
};

export function Sidebar({ brand, items }: SidebarProps) {
  return (
    <aside className="sticky top-0 h-screen w-64 border-r border-slate-200 bg-white px-5 py-7">
      <p className="text-lg font-semibold text-[#0A64BC]">{brand}</p>

      <nav className="mt-8 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.label}
              onClick={item.onClick}
              className={clsx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                item.active
                  ? 'bg-[#0A64BC]/10 text-[#0A64BC]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
