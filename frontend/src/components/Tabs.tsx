import clsx from 'clsx';

type TabsProps = {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
};

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={clsx(
              'rounded-md px-4 py-2 text-sm font-medium transition',
              isActive
                ? 'bg-[#0A64BC]/10 text-[#0A64BC]'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
            )}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
