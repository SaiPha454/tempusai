import React from 'react';
import { MessageSquare, Calendar, CalendarDays, ClipboardList, MapPin, RefreshCw, Settings, Timer } from 'lucide-react';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  
  const NavItem = ({ id, icon: Icon, label, badge }: { id: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string, badge?: string }) => (
    <button
      onClick={() => setActivePage(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg text-sm transition-all duration-200 group ${
        activePage === id 
          ? 'bg-gold/10 text-gold border border-gold/20' 
          : 'text-gray-400 hover:bg-surface hover:text-gray-200 border border-transparent'
      }`}
    >
      <div className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
        activePage === id ? 'bg-gold/20' : 'bg-white/5 group-hover:bg-white/10'
      }`}>
        <Icon size={14} />
      </div>
      <span className="font-medium hidden md:block">{label}</span>
      {badge && <span className="ml-auto text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full hidden md:block">{badge}</span>}
    </button>
  );

  return (
    <aside className="w-16 md:w-60 flex-shrink-0 bg-surface border-r border-border flex flex-col h-full z-10 transition-all duration-300">
      <div className="p-4 md:p-6 border-b border-border mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-gold to-gold-dim rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(201,168,76,0.15)]">
            <Timer className="text-bg" size={20} />
          </div>
          <div className="hidden md:block">
            <h1 className="font-serif text-xl font-semibold text-gray-100 leading-none">
              Tempus<span className="text-gold">AI</span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Academic Scheduling</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 md:px-3 py-4 scrollbar-hide">
        <div className="mb-6">
          <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-gray-600 font-semibold hidden md:block">Navigation</div>
          <NavItem id="chat" icon={MessageSquare} label="AI Assistant" />
          <NavItem id="schedule" icon={Calendar} label="Schedule Manager" />
        </div>

        <div className="mb-6">
          <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-gray-600 font-semibold hidden md:block">Views</div>
          <NavItem id="timetable" icon={CalendarDays} label="My Timetable" />
          <NavItem id="exams" icon={ClipboardList} label="Exam Schedule" />
          <NavItem id="events" icon={MapPin} label="Campus Events" />
        </div>

        <div>
           <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-gray-600 font-semibold hidden md:block">Requests</div>
           <NavItem id="requests" icon={RefreshCw} label="Change Requests" badge="3" />
           <NavItem id="settings" icon={Settings} label="Settings" />
        </div>
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-bg border border-border">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center text-xs text-white font-medium flex-shrink-0">
            AC
          </div>
          <div className="hidden md:block overflow-hidden">
            <div className="text-xs font-medium text-gray-200 truncate">Dr. Aris Chandra</div>
            <div className="text-[10px] text-gray-500 truncate">Coordinator</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
