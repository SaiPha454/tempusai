
import React, { useState } from 'react';
import ClassScheduler from './ClassScheduler';
import ExamScheduler from './ExamScheduler';
import { QueuedCourse, QueuedExamBatch, Constraint } from '../types';
import { DEFAULT_CONSTRAINTS } from '../constants';

const ScheduleManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'classes' | 'exams' | 'events'>('classes');
  
  // State for Classes
  const [classQueue, setClassQueue] = useState<QueuedCourse[]>([]);
  // State for Exams (Now Batches)
  const [examQueue, setExamQueue] = useState<QueuedExamBatch[]>([]);
  
  const [constraints, setConstraints] = useState<Constraint[]>(DEFAULT_CONSTRAINTS);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Class Handlers
  const addToQueue = (course: QueuedCourse) => {
    setClassQueue([...classQueue, course]);
    setGenerationStatus('idle');
  };

  const removeFromQueue = (id: string) => {
    setClassQueue(classQueue.filter(c => c.id !== id));
  };

  // Exam Handlers
  const addExamBatchToQueue = (batch: QueuedExamBatch) => {
    setExamQueue([...examQueue, batch]);
    setGenerationStatus('idle');
  };

  const removeExamBatchFromQueue = (id: string) => {
    setExamQueue(examQueue.filter(e => e.id !== id));
  };

  const updateExamBatch = (updatedBatch: QueuedExamBatch) => {
    setExamQueue(prev => prev.map(b => b.id === updatedBatch.id ? updatedBatch : b));
  };

  const toggleConstraint = (id: string) => {
    setConstraints(prev => prev.map(c => 
      c.id === id ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate API/Engine delay
    setTimeout(() => {
      setIsGenerating(false);
      setGenerationStatus('success');
      setTimeout(() => setGenerationStatus('idle'), 4000);
    }, 2500);
  };

  const TabButton = ({ id, label, icon }: { id: typeof activeTab, label: string, icon: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
        activeTab === id 
          ? 'border-gold text-gold bg-gold/5' 
          : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-surface'
      }`}
    >
      <span>{icon}</span> {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden relative">
      {/* Header */}
      <div className="p-6 md:pb-0 border-b border-border bg-bg/95 backdrop-blur z-20">
        <div className="mb-6 animate-fade-in-up">
          <h2 className="font-serif text-3xl text-gray-100 mb-2">Schedule Manager</h2>
          <p className="text-gray-500 text-sm max-w-2xl">
            Generate conflict-free timetables for courses, examinations, and campus events using our constraint-based reasoning engine.
          </p>
        </div>

        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          <TabButton id="classes" label="Class Scheduler" icon="🏫" />
          <TabButton id="exams" label="Exam Scheduler" icon="📝" />
          <TabButton id="events" label="Custom Event" icon="🎪" />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
        {activeTab === 'classes' && (
          <ClassScheduler 
            queue={classQueue} 
            addToQueue={addToQueue} 
            removeFromQueue={removeFromQueue}
            constraints={constraints}
            onToggleConstraint={toggleConstraint}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        )}
        
        {activeTab === 'exams' && (
           <ExamScheduler 
             queue={examQueue}
             addToQueue={addExamBatchToQueue}
             removeFromQueue={removeExamBatchFromQueue}
             updateBatch={updateExamBatch}
             constraints={constraints}
             onToggleConstraint={toggleConstraint}
             onGenerate={handleGenerate}
             isGenerating={isGenerating}
           />
        )}

        {activeTab === 'events' && (
           <div className="h-full flex flex-col items-center justify-center text-gray-600 animate-fade-in">
             <div className="text-5xl mb-4 opacity-20">🎪</div>
             <p>Event Scheduler module is currently initialized in read-only mode.</p>
           </div>
        )}
      </div>

      {/* Success Notification */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface2 border border-success/30 text-success px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 transition-all duration-500 transform z-50 ${
        generationStatus === 'success' ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'
      }`}>
        <div className="w-5 h-5 bg-success rounded-full flex items-center justify-center text-bg text-xs font-bold">✓</div>
        <span className="text-sm font-medium">Schedule generated successfully with 0 conflicts.</span>
      </div>
    </div>
  );
};

export default ScheduleManager;
