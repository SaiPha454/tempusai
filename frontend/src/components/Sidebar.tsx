import { PenSquare, type LucideIcon } from 'lucide-react';
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
  onNewConversation: () => void;
};

export function Sidebar({ brand, items, onNewConversation }: SidebarProps) {
  return (
    <aside className="h-screen w-64 shrink-0 overflow-hidden border-r border-slate-200 bg-white px-5 py-7">
      <p className="text-lg font-semibold text-[#0A64BC]">{brand}</p>

      <button
        type="button"
        onClick={onNewConversation}
        className="mt-4 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        <PenSquare size={13} />
        New conversation
      </button>

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
