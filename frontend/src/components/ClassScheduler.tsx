import React, { useState, useMemo } from 'react';
import { Plus, X, Search, Check, ChevronDown, ChevronRight, Filter, Settings, ShieldCheck, ShieldAlert, Users } from 'lucide-react';
import { KNOWN_COURSES, ALL_ROOMS } from '../constants';
import { QueuedCourse, Constraint } from '../types';

interface ClassSchedulerProps {
  queue: QueuedCourse[];
  addToQueue: (course: QueuedCourse) => void;
  removeFromQueue: (id: string) => void;
  constraints: Constraint[];
  onToggleConstraint: (id: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const ClassScheduler: React.FC<ClassSchedulerProps> = ({ 
  queue, 
  addToQueue, 
  removeFromQueue, 
  constraints, 
  onToggleConstraint, 
  onGenerate, 
  isGenerating 
}) => {
  // Form State
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [profInput, setProfInput] = useState('');
  const [professors, setProfessors] = useState<string[]>([]);
  const [studentCode, setStudentCode] = useState('');
  const [studentCount, setStudentCount] = useState('');
  
  // Optional State
  const [showOptional, setShowOptional] = useState(false);
  const [prefDays, setPrefDays] = useState<string[]>([]);
  const [prefSlot, setPrefSlot] = useState('');
  const [prefRoom, setPrefRoom] = useState('');

  // Room State
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());

  // Logic
  const filteredCourses = useMemo(() => {
    if (!courseCode) return [];
    return KNOWN_COURSES.filter(c => c.code.toLowerCase().startsWith(courseCode.toLowerCase()) || c.name.toLowerCase().includes(courseCode.toLowerCase()));
  }, [courseCode]);

  const selectCourse = (c: typeof KNOWN_COURSES[0]) => {
    setCourseCode(c.code);
    setCourseName(c.name);
    // Auto-fill professors if available and list is empty
    if (professors.length === 0 && c.professors) {
      setProfessors(c.professors);
    }
  };

  const addProf = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && profInput.trim()) {
      setProfessors([...professors, profInput.trim()]);
      setProfInput('');
    }
  };

  const removeProf = (idx: number) => {
    setProfessors(professors.filter((_, i) => i !== idx));
  };

  const toggleDay = (day: string) => {
    setPrefDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleAddCourse = () => {
    if (!courseCode || !courseName || !year || !semester || !studentCode) {
      alert("Please fill in all required fields (marked with *).");
      return;
    }
    
    if (professors.length === 0) {
      alert("Please assign at least one professor.");
      return;
    }

    const newCourse: QueuedCourse = {
      id: Date.now().toString(),
      code: courseCode,
      name: courseName,
      professors,
      year,
      semester,
      studentGroup: studentCode,
      studentCount: studentCount ? parseInt(studentCount) : undefined,
      preferredRoom: prefRoom || undefined,
      preferredTime: prefSlot || undefined
    };

    addToQueue(newCourse);
    
    // Reset basic fields for next entry
    setCourseCode('');
    setCourseName('');
    setProfessors([]);
    setStudentCode('');
    setStudentCount('');
    setProfInput('');
    // Keep year/semester as they are likely the same for a batch
    // Optional: Reset preference details
    setShowOptional(false);
    setPrefDays([]);
    setPrefSlot('');
    setPrefRoom('');
  };

  const toggleRoomSelect = (id: string) => {
    const next = new Set(selectedRooms);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRooms(next);
  };

  const filteredRooms = ALL_ROOMS.filter(r => 
    r.name.toLowerCase().includes(roomSearch.toLowerCase()) || 
    r.id.toLowerCase().includes(roomSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* SECTION 1: ADD COURSE */}
      <div className="bg-surface2 border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          <div className="p-1.5 bg-gold/10 rounded text-gold"><Plus size={16} /></div>
          <h3 className="font-serif text-lg text-gray-200">Course Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5 relative group">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Course Code <span className="text-gold">*</span></label>
            <div className="relative">
              <input 
                value={courseCode}
                onChange={e => setCourseCode(e.target.value)}
                type="text" 
                placeholder="Search or enter code" 
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-gold/50 focus:ring-1 focus:ring-gold/20 outline-none transition-all" 
              />
              {filteredCourses.length > 0 && courseCode && courseName !== filteredCourses[0].name && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface2 border border-border rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                  {filteredCourses.map(c => (
                    <div key={c.code} onClick={() => selectCourse(c)} className="px-3 py-2 hover:bg-white/5 cursor-pointer text-sm flex gap-2">
                      <span className="font-mono text-gold bg-gold/10 px-1 rounded text-xs">{c.code}</span>
                      <span className="text-gray-300 truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Course Name <span className="text-gold">*</span></label>
            <input 
              value={courseName}
              onChange={e => setCourseName(e.target.value)}
              type="text" 
              placeholder="Course name" 
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gold/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
           <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Academic Year <span className="text-gold">*</span></label>
            <select value={year} onChange={e => setYear(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gold/50 appearance-none">
              <option value="">Select Year</option>
              <option value="Year 1">Year 1</option>
              <option value="Year 2">Year 2</option>
              <option value="Year 3">Year 3</option>
              <option value="Year 4">Year 4</option>
            </select>
           </div>
           <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Semester <span className="text-gold">*</span></label>
            <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gold/50 appearance-none">
              <option value="">Select Semester</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
           <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Professors <span className="text-gold">*</span></label>
            <div className="bg-surface border border-border rounded-lg px-2 py-1.5 flex flex-wrap gap-1 min-h-[40px] focus-within:border-gold/50 transition-colors">
              {professors.map((p, i) => (
                <span key={i} className="bg-accent/20 border border-accent/30 text-blue-200 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                  {p} <button onClick={() => removeProf(i)} className="hover:text-white">×</button>
                </span>
              ))}
              <input 
                value={profInput} 
                onChange={e => setProfInput(e.target.value)}
                onKeyDown={addProf}
                placeholder={professors.length ? "" : "Type name & Enter"} 
                className="bg-transparent outline-none text-sm text-gray-200 flex-1 min-w-[80px]" 
              />
            </div>
           </div>
           <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Student Group <span className="text-gold">*</span></label>
            <div className="grid grid-cols-3 gap-2">
                <input 
                  value={studentCode}
                  onChange={e => setStudentCode(e.target.value)}
                  type="text" 
                  placeholder="e.g. CS-Y3-2025" 
                  className="col-span-2 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gold/50"
                />
                <div className="relative">
                   <Users size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                   <input 
                    value={studentCount}
                    onChange={e => setStudentCount(e.target.value)}
                    type="number" 
                    placeholder="Size" 
                    className="w-full bg-surface border border-border rounded-lg pl-8 pr-2 py-2 text-sm text-gray-200 outline-none focus:border-gold/50"
                  />
                </div>
            </div>
           </div>
        </div>

        {/* Optional Toggle */}
        <div className="mt-4 border border-dashed border-border rounded-lg overflow-hidden">
          <button onClick={() => setShowOptional(!showOptional)} className="w-full flex items-center justify-between p-3 bg-surface hover:bg-white/5 transition-colors text-xs text-gray-400">
             <div className="flex items-center gap-2">
               {showOptional ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
               <span>Preferred Schedule Options</span>
             </div>
             <span className="text-[10px] uppercase border border-border px-1.5 rounded">Optional</span>
          </button>
          
          {showOptional && (
            <div className="p-4 bg-bg border-t border-border space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block mb-2">Preferred Days</label>
                <div className="flex gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                    <button 
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`w-9 h-9 rounded-full text-xs font-medium border transition-all ${
                        prefDays.includes(day) 
                          ? 'bg-gold/20 border-gold/50 text-gold' 
                          : 'bg-surface border-border text-gray-500 hover:border-gold/30 hover:text-gray-300'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block mb-2">Preferred Slot</label>
                    <select value={prefSlot} onChange={e => setPrefSlot(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gold/50">
                      <option value="">Any Time</option>
                      <option value="morning">Morning (9-12)</option>
                      <option value="afternoon">Afternoon (1-4)</option>
                      <option value="evening">Evening (4:30-7:30)</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block mb-2">Preferred Room</label>
                    <select value={prefRoom} onChange={e => setPrefRoom(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gold/50">
                      <option value="">Any Room</option>
                      {ALL_ROOMS.map(r => <option key={r.id} value={r.id}>{r.id} - {r.name}</option>)}
                    </select>
                 </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button 
            onClick={handleAddCourse} 
            className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(201,168,76,0.1)] hover:shadow-[0_0_15px_rgba(201,168,76,0.2)]"
          >
            <Plus size={16} /> Add Course to Batch
          </button>
        </div>
      </div>

      {/* SECTION 2: QUEUE & ROOMS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Queue List */}
        <div className="lg:col-span-2 bg-surface2 border border-border rounded-xl p-5 shadow-sm min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
             <div className="flex items-center gap-2">
               <div className="p-1.5 bg-accent/10 rounded text-accent"><Filter size={16} /></div>
               <h3 className="font-serif text-lg text-gray-200">Processing Batch</h3>
             </div>
             <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">{queue.length} Courses</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] custom-scrollbar pr-1">
            {queue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                <Filter size={32} className="opacity-20" />
                <p className="text-sm">No courses added yet.</p>
              </div>
            ) : (
              queue.map((c, i) => (
                <div key={c.id} className="bg-surface border border-border rounded-lg p-3 flex items-start gap-3 group hover:border-border/60 transition-colors animate-fade-in-up">
                   <div className="w-6 h-6 rounded-full bg-gold/10 text-gold text-xs flex items-center justify-center font-medium mt-0.5">{i+1}</div>
                   <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gold bg-gold/5 px-1.5 rounded text-xs">{c.code}</span>
                            <span className="text-sm font-medium text-gray-200">{c.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                             <span className="flex items-center gap-1">👥 {c.studentGroup} {c.studentCount ? `(${c.studentCount})` : ''}</span>
                             <span className="flex items-center gap-1">👤 {c.professors.join(', ')}</span>
                             {(c.preferredRoom || c.preferredTime) && <span className="text-accent flex items-center gap-1">✨ Has Prefs</span>}
                          </div>
                        </div>
                        <button onClick={() => removeFromQueue(c.id)} className="text-gray-600 hover:text-danger p-1 rounded transition-colors"><X size={16} /></button>
                      </div>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Room Pool Selection */}
        <div className="bg-surface2 border border-border rounded-xl p-5 shadow-sm flex flex-col">
           <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
             <h3 className="font-serif text-lg text-gray-200">Room Pool</h3>
             <span className="text-xs text-gray-500">{selectedRooms.size} Selected</span>
           </div>
           
           <div className="relative mb-3">
             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
             <input 
               value={roomSearch}
               onChange={e => setRoomSearch(e.target.value)}
               placeholder="Filter rooms..." 
               className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 outline-none focus:border-gold/30"
             />
           </div>

           <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar pr-1 space-y-2">
             {filteredRooms.map(room => {
               const isSelected = selectedRooms.has(room.id);
               return (
                 <div 
                   key={room.id}
                   onClick={() => toggleRoomSelect(room.id)}
                   className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                     isSelected 
                      ? 'bg-gold/5 border-gold/30' 
                      : 'bg-surface border-border hover:bg-white/5'
                   }`}
                 >
                   <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                     isSelected ? 'bg-gold border-gold text-bg' : 'border-gray-600 bg-transparent'
                   }`}>
                     {isSelected && <Check size={10} />}
                   </div>
                   <div className="flex-1">
                     <div className="flex justify-between items-center">
                       <span className={`text-xs font-mono font-medium ${isSelected ? 'text-gold' : 'text-gray-300'}`}>{room.id}</span>
                       <span className="text-[10px] uppercase bg-white/5 text-gray-500 px-1.5 rounded">{room.type}</span>
                     </div>
                     <div className="text-[11px] text-gray-500 flex justify-between mt-0.5">
                       <span className="truncate max-w-[100px]">{room.name}</span>
                       <span>Cap: {room.cap}</span>
                     </div>
                   </div>
                 </div>
               )
             })}
           </div>

           <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs">
              <button onClick={() => { 
                const newSet = new Set(selectedRooms); 
                filteredRooms.forEach(r => newSet.add(r.id)); 
                setSelectedRooms(newSet);
              }} className="text-accent hover:text-white">Select Visible</button>
              <button onClick={() => setSelectedRooms(new Set())} className="text-gray-500 hover:text-white">Clear All</button>
           </div>
        </div>
      </div>

      {/* Constraints & Generate */}
      <div className="bg-surface2 border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          <div className="p-1.5 bg-success/10 rounded text-success"><Settings size={16} /></div>
          <h3 className="font-serif text-lg text-gray-200">Constraint Rules</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6">
          {constraints.map((constraint) => (
            <div key={constraint.id} className="flex items-start justify-between group">
              <div className="flex gap-3">
                 <div className={`mt-0.5 ${constraint.enabled ? (constraint.type === 'hard' ? 'text-danger' : 'text-success') : 'text-gray-600'}`}>
                    {constraint.type === 'hard' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                 </div>
                 <div>
                   <h4 className={`text-sm font-medium transition-colors ${constraint.enabled ? 'text-gray-200' : 'text-gray-500'}`}>{constraint.label}</h4>
                   <p className="text-xs text-gray-500 leading-tight mt-0.5">{constraint.description}</p>
                 </div>
              </div>
              
              <button 
                onClick={() => onToggleConstraint(constraint.id)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                  constraint.enabled ? 'bg-gold' : 'bg-surface border border-gray-600'
                }`}
              >
                <div 
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    constraint.enabled ? 'translate-x-5' : 'translate-x-0 bg-gray-400'
                  }`} 
                />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <button 
            onClick={onGenerate}
            disabled={isGenerating || queue.length === 0}
            className="px-8 py-3 rounded-lg bg-gradient-to-br from-gold to-gold-dim text-bg font-semibold text-sm hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
          >
            {isGenerating ? <div className="w-5 h-5 border-2 border-bg border-t-transparent rounded-full animate-spin"/> : '✦'}
            Generate Optimal Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassScheduler;
