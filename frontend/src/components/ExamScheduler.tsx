
import React, { useState, useMemo } from 'react';
import { Plus, X, Search, Check, Filter, Settings, ShieldCheck, ShieldAlert, BookOpen, Trash2, Building2 } from 'lucide-react';
import { KNOWN_COURSES, ALL_ROOMS } from '../constants';
import { QueuedExamBatch, Constraint, ExamSubjectConfig } from '../types';

interface ExamSchedulerProps {
  queue: QueuedExamBatch[];
  addToQueue: (batch: QueuedExamBatch) => void;
  removeFromQueue: (id: string) => void;
  updateBatch: (batch: QueuedExamBatch) => void;
  constraints: Constraint[];
  onToggleConstraint: (id: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const ExamScheduler: React.FC<ExamSchedulerProps> = ({ 
  queue, 
  addToQueue, 
  removeFromQueue, 
  updateBatch,
  constraints, 
  onToggleConstraint, 
  onGenerate, 
  isGenerating 
}) => {
  // --- Selection State ---
  const [faculty, setFaculty] = useState('Software Engineering');
  const [year, setYear] = useState('Year 1');
  const [semester, setSemester] = useState('1');
  const [term, setTerm] = useState<'Final' | 'Midterm'>('Final');
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());

  // --- Constants ---
  const FACULTIES = ['Software Engineering', 'Electrical Engineering', 'Computer Science'];
  const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4'];
  const SEMESTERS = ['1', '2'];
  const TERMS = ['Final', 'Midterm'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SLOTS = ['9:30 AM - 12:30 PM', '1:30 PM - 4:30 PM'];

  // --- Helpers ---
  const filteredRooms = useMemo(() => {
    return ALL_ROOMS.filter(r => 
      r.name.toLowerCase().includes(roomSearch.toLowerCase()) || 
      r.id.toLowerCase().includes(roomSearch.toLowerCase())
    );
  }, [roomSearch]);

  const toggleRoom = (roomId: string) => {
    const next = new Set(selectedRooms);
    if (next.has(roomId)) next.delete(roomId);
    else next.add(roomId);
    setSelectedRooms(next);
  };

  const handleAddBatch = () => {
    if (selectedRooms.size === 0) {
      alert("Please select at least one room for the pool.");
      return;
    }

    // Find subjects for this batch
    const subjects = KNOWN_COURSES.filter(c => 
      c.faculty === faculty && 
      c.year === year && 
      c.semester === semester
    );

    if (subjects.length === 0) {
      alert("No courses found for this Faculty, Year and Semester combination.");
      return;
    }

    // Create default configs for each subject
    const subjectConfigs: ExamSubjectConfig[] = subjects.map(s => ({
      code: s.code,
      name: s.name,
      duration: term === 'Final' ? 180 : 90, // Default duration based on term
      selectedDays: s.defaultDay ? [s.defaultDay] : [], // Default to class day
      selectedSlots: [...SLOTS] // Default to both slots
    }));

    const newBatch: QueuedExamBatch = {
      id: Date.now().toString(),
      faculty,
      year,
      semester,
      term,
      selectedRooms: Array.from(selectedRooms),
      subjects: subjectConfigs
    };

    addToQueue(newBatch);
    
    // Reset room selection (Keep Faculty/Year selections for convenience)
    setSelectedRooms(new Set());
  };

  const updateSubjectInBatch = (batchId: string, courseCode: string, field: keyof ExamSubjectConfig, value: ExamSubjectConfig[keyof ExamSubjectConfig]) => {
    const batch = queue.find(b => b.id === batchId);
    if (!batch) return;

    const updatedSubjects = batch.subjects.map(sub => {
      if (sub.code === courseCode) {
        return { ...sub, [field]: value };
      }
      return sub;
    });

    updateBatch({ ...batch, subjects: updatedSubjects });
  };

  const toggleSubjectDay = (batchId: string, courseCode: string, day: string) => {
    const batch = queue.find(b => b.id === batchId);
    const subject = batch?.subjects.find(s => s.code === courseCode);
    if (!subject) return;

    const currentDays = subject.selectedDays;
    const newDays = currentDays.includes(day) 
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    updateSubjectInBatch(batchId, courseCode, 'selectedDays', newDays);
  };

  const toggleSubjectSlot = (batchId: string, courseCode: string, slot: string) => {
    const batch = queue.find(b => b.id === batchId);
    const subject = batch?.subjects.find(s => s.code === courseCode);
    if (!subject) return;

    const currentSlots = subject.selectedSlots;
    const newSlots = currentSlots.includes(slot)
      ? currentSlots.filter(s => s !== slot)
      : [...currentSlots, slot];
    
    updateSubjectInBatch(batchId, courseCode, 'selectedSlots', newSlots);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* --- TOP: SELECTION PANEL --- */}
      <div className="bg-surface2 border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
             <div className="p-2 bg-gold/10 rounded-lg text-gold"><Plus size={18} /></div>
             <div>
               <h3 className="font-serif text-xl text-gray-100">Add Exam Batch</h3>
               <p className="text-xs text-gray-500">Select faculty group, term, and allocate room pool</p>
             </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Criteria */}
            <div className="space-y-5">
                <div className="space-y-1.5">
                   <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Faculty</label>
                   <select 
                     value={faculty} 
                     onChange={e => setFaculty(e.target.value)}
                     className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold/50"
                   >
                     {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                   </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Year</label>
                     <select 
                       value={year} 
                       onChange={e => setYear(e.target.value)}
                       className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold/50"
                     >
                       {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Semester</label>
                     <select 
                       value={semester} 
                       onChange={e => setSemester(e.target.value)}
                       className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold/50"
                     >
                       {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Term</label>
                     <select 
                       value={term} 
                       onChange={e => setTerm(e.target.value as 'Final' | 'Midterm')}
                       className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold/50"
                     >
                       {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                     </select>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleAddBatch} 
                    className="w-full bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-6 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-[0_0_10px_rgba(201,168,76,0.1)] hover:shadow-[0_0_15px_rgba(201,168,76,0.2)]"
                  >
                    <Plus size={16} /> Add Batch to Queue
                  </button>
                  <p className="text-[10px] text-gray-500 mt-2 text-center">
                    Adds all subjects for {faculty} - {year} (Sem {semester})
                  </p>
                </div>
            </div>

            {/* Right: Room Pool */}
            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col h-[280px]">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-2">
                    <Building2 size={12} /> Room Pool
                  </label>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400">{selectedRooms.size} Selected</span>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                     value={roomSearch}
                     onChange={e => setRoomSearch(e.target.value)}
                     placeholder="Search available rooms..." 
                     className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 outline-none focus:border-gold/30"
                  />
                </div>
                
                {/* Selected Chips */}
                <div className={`transition-all duration-300 ease-in-out ${selectedRooms.size > 0 ? 'mb-3 opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>
                  <div className="flex flex-wrap gap-2 p-2 bg-surface/30 rounded border border-border/50 max-h-[60px] overflow-y-auto custom-scrollbar">
                     {Array.from(selectedRooms).map((roomId: string) => (
                        <div key={roomId} className="flex items-center gap-1.5 bg-gold/10 text-gold border border-gold/20 px-2 py-1 rounded text-[11px] font-mono animate-fade-in">
                          <span>{roomId}</span>
                          <button onClick={() => toggleRoom(roomId)} className="hover:text-white transition-colors p-0.5"><X size={10} /></button>
                        </div>
                     ))}
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar border border-border/50 rounded-lg bg-bg">
                   {filteredRooms.map(room => {
                     const isSelected = selectedRooms.has(room.id);
                     return (
                       <div 
                         key={room.id} 
                         onClick={() => toggleRoom(room.id)}
                         className={`flex items-center justify-between px-3 py-2.5 cursor-pointer border-b border-border/30 last:border-0 hover:bg-white/5 transition-colors ${isSelected ? 'bg-gold/5' : ''}`}
                       >
                          <div className="flex items-center gap-3">
                             <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${isSelected ? 'bg-gold border-gold text-bg' : 'border-gray-600'}`}>
                               {isSelected && <Check size={10} />}
                             </div>
                             <div>
                               <div className={`text-xs font-mono font-medium ${isSelected ? 'text-gold' : 'text-gray-300'}`}>{room.id}</div>
                               <div className="text-[10px] text-gray-500 truncate w-32">{room.name}</div>
                             </div>
                          </div>
                          <span className="text-[10px] text-gray-500 bg-black/30 px-1.5 py-0.5 rounded border border-white/5">Cap: {room.cap}</span>
                       </div>
                     )
                   })}
                </div>
            </div>
        </div>
      </div>

      {/* --- BOTTOM: BATCH QUEUE --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Queue List */}
        <div className="lg:col-span-2 bg-surface2 border border-border rounded-xl p-5 shadow-sm min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
             <div className="flex items-center gap-2">
               <div className="p-1.5 bg-accent/10 rounded text-accent"><Filter size={16} /></div>
               <h3 className="font-serif text-lg text-gray-200">Scheduled Batches</h3>
             </div>
             <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">{queue.length} Batches</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 max-h-[600px] custom-scrollbar pr-1">
            {queue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                <BookOpen size={32} className="opacity-20" />
                <p className="text-sm">No exam batches added yet.</p>
              </div>
            ) : (
              queue.map((batch, i) => (
                <div key={batch.id} className="bg-surface border border-border rounded-lg overflow-hidden animate-fade-in-up">
                   
                   {/* Batch Header */}
                   <div className="bg-white/5 p-4 flex items-center justify-between border-b border-border">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-gold/10 text-gold font-serif font-bold text-sm flex items-center justify-center border border-gold/20">
                          {i + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-200">{batch.faculty}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                             <span className="bg-surface border border-border px-1.5 rounded">{batch.year}</span>
                             <span>Semester {batch.semester}</span>
                             <span className={`px-1.5 rounded border ${batch.term === 'Final' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-accent/10 text-accent border-accent/20'}`}>{batch.term}</span>
                             <span>•</span>
                             <span>{batch.subjects.length} Subjects</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="text-right hidden md:block">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Allocated Rooms</div>
                            <div className="text-xs text-gold font-mono max-w-[150px] truncate">
                               {batch.selectedRooms.join(', ')}
                            </div>
                         </div>
                         <button onClick={() => removeFromQueue(batch.id)} className="p-2 hover:bg-danger/20 hover:text-danger text-gray-500 rounded transition-colors">
                           <Trash2 size={16} />
                         </button>
                      </div>
                   </div>

                   {/* Subjects Table */}
                   <div className="p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                           <thead>
                             <tr className="text-[10px] uppercase text-gray-500 border-b border-border/50">
                               <th className="pb-2 pl-2 font-semibold">Subject</th>
                               <th className="pb-2 font-semibold w-24">Duration</th>
                               <th className="pb-2 font-semibold">Allowed Days</th>
                               <th className="pb-2 font-semibold">Allowed Slots</th>
                             </tr>
                           </thead>
                           <tbody className="text-xs text-gray-300">
                              {batch.subjects.map((sub, idx) => (
                                <tr key={idx} className="border-b border-border/30 last:border-0 hover:bg-white/5 transition-colors">
                                   <td className="py-3 pl-2">
                                      <div className="font-mono text-gold mb-0.5">{sub.code}</div>
                                      <div className="text-[11px] text-gray-400 truncate max-w-[140px]">{sub.name}</div>
                                   </td>
                                   <td className="py-3 pr-2">
                                      <div className="relative">
                                        <input 
                                          type="number" 
                                          value={sub.duration}
                                          onChange={(e) => updateSubjectInBatch(batch.id, sub.code, 'duration', parseInt(e.target.value))}
                                          className="w-16 bg-bg border border-border rounded px-2 py-1 text-right focus:border-gold/50 outline-none"
                                        />
                                        <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">min</span>
                                      </div>
                                   </td>
                                   <td className="py-3">
                                      <div className="flex flex-wrap gap-1">
                                        {DAYS.map(day => (
                                          <button 
                                            key={day}
                                            onClick={() => toggleSubjectDay(batch.id, sub.code, day)}
                                            className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                                              sub.selectedDays.includes(day)
                                                ? 'bg-gold/20 border-gold/40 text-gold'
                                                : 'bg-transparent border-border text-gray-600 hover:border-gray-500'
                                            }`}
                                          >
                                            {day}
                                          </button>
                                        ))}
                                      </div>
                                   </td>
                                   <td className="py-3">
                                      <div className="flex flex-col gap-1.5">
                                        {SLOTS.map((slot, sIdx) => (
                                          <button 
                                            key={sIdx}
                                            onClick={() => toggleSubjectSlot(batch.id, sub.code, slot)}
                                            className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border transition-all w-fit ${
                                              sub.selectedSlots.includes(slot)
                                                ? 'bg-accent/10 border-accent/40 text-blue-200'
                                                : 'bg-transparent border-transparent text-gray-600 hover:bg-white/5'
                                            }`}
                                          >
                                            <div className={`w-1.5 h-1.5 rounded-full ${sub.selectedSlots.includes(slot) ? 'bg-blue-400' : 'bg-gray-700'}`} />
                                            {slot.split('-')[0].trim()}
                                          </button>
                                        ))}
                                      </div>
                                   </td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                      </div>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Constraints Panel */}
        <div className="bg-surface2 border border-border rounded-xl p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <div className="p-1.5 bg-success/10 rounded text-success"><Settings size={16} /></div>
            <h3 className="font-serif text-lg text-gray-200">Rules & Logic</h3>
          </div>

          <div className="space-y-4 mb-6">
            {constraints.map((constraint) => (
              <div key={constraint.id} className="flex items-start justify-between group">
                <div className="flex gap-3">
                   <div className={`mt-0.5 flex-shrink-0 ${constraint.enabled ? (constraint.type === 'hard' ? 'text-danger' : 'text-success') : 'text-gray-600'}`}>
                      {constraint.type === 'hard' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                   </div>
                   <div>
                     <h4 className={`text-sm font-medium transition-colors leading-tight ${constraint.enabled ? 'text-gray-200' : 'text-gray-500'}`}>{constraint.label}</h4>
                     <p className="text-[11px] text-gray-500 leading-tight mt-1">{constraint.description}</p>
                   </div>
                </div>
                
                <button 
                  onClick={() => onToggleConstraint(constraint.id)}
                  className={`relative w-8 h-4 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none mt-1 ${
                    constraint.enabled ? 'bg-gold' : 'bg-surface border border-gray-600'
                  }`}
                >
                  <div 
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      constraint.enabled ? 'translate-x-4' : 'translate-x-0 bg-gray-400'
                    }`} 
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border">
            <button 
              onClick={onGenerate}
              disabled={isGenerating || queue.length === 0}
              className="w-full py-3 rounded-lg bg-gradient-to-br from-gold to-gold-dim text-bg font-semibold text-sm hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin"/> : '✦'}
              Generate Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamScheduler;
