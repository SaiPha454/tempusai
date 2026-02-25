import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ScheduleManager from './components/ScheduleManager';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('chat');

  return (
    <div className="flex h-screen w-screen bg-bg text-gray-200 font-sans overflow-hidden">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      
      <main className="flex-1 relative flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-bg/90 backdrop-blur-md flex items-center px-6 md:px-8 justify-between z-20 flex-shrink-0">
          <h2 className="font-serif text-lg italic text-gray-300">
            {activePage === 'chat' ? 'AI Scheduling Assistant' : 
             activePage === 'schedule' ? 'Schedule Manager' : 
             'Dashboard'}
          </h2>
          <div className="text-[10px] tracking-widest uppercase px-3 py-1 rounded-full border border-gold/30 bg-gold/5 text-gold font-medium">
            Semester 2 · 2025
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 relative overflow-hidden">
          {activePage === 'chat' && <ChatInterface />}
          {activePage === 'schedule' && <ScheduleManager />}
          {['timetable', 'exams', 'events', 'requests', 'settings'].includes(activePage) && (
            <div className="h-full flex items-center justify-center text-gray-600">
               <div className="text-center">
                 <div className="text-4xl mb-3 opacity-30">🚧</div>
                 <p className="text-sm">This view is under development.</p>
               </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>
    </div>
  );
};

export default App;
