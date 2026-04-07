import { PenSquare, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

type SidebarLinkItem = {
  type?: 'link';
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
};

type SidebarDividerItem = {
  type: 'divider';
  label?: string;
};

type SidebarItem = SidebarLinkItem | SidebarDividerItem;

type SidebarProps = {
  brand: string;
  items: SidebarItem[];
  onNewConversation: () => void;
  footer?: ReactNode;
};

export function Sidebar({ brand, items, onNewConversation, footer }: SidebarProps) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white px-5 py-7">
      <p className="text-lg font-semibold text-[#0A64BC]">{brand}</p>

      <button
        type="button"
        onClick={onNewConversation}
        className="mt-4 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        <PenSquare size={13} />
        New conversation
      </button>

      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
        {items.map((item) => {
          if (item.type === 'divider') {
            return (
              <div key={item.label ?? 'divider'} className="my-3 border-t border-slate-200 pt-2">
                {item.label ? (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                ) : null}
              </div>
            );
          }

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

      {footer ? <div className="mt-4 border-t border-slate-200 pt-4">{footer}</div> : null}
    </aside>
  );
}
