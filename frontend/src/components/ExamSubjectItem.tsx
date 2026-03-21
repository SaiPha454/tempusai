import { BookOpen, CalendarDays, Clock3, Trash2 } from 'lucide-react';
import { PillMultiSelector } from './PillMultiSelector';
import type { SelectOption } from '../data/schedulingData';

type ExamSubjectItemProps = {
  subjectCode: string;
  subjectName: string;
  examType: string;
  availableDateOptions: SelectOption[];
  selectedPreferredDates: string[];
  selectedTimeSlots: string[];
  examTimeSlotOptions: SelectOption[];
  onPreferredDateChange: (values: string[]) => void;
  onTimeSlotChange: (values: string[]) => void;
  onRemove: () => void;
};

export function ExamSubjectItem({
  subjectCode,
  subjectName,
  examType,
  availableDateOptions,
  selectedPreferredDates,
  selectedTimeSlots,
  examTimeSlotOptions,
  onPreferredDateChange,
  onTimeSlotChange,
  onRemove,
}: ExamSubjectItemProps) {
  return (
    <article className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {subjectCode} · {subjectName}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
            <BookOpen size={13} className="text-slate-500" />
            {examType}
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
        >
          <Trash2 size={14} />
          Remove
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <CalendarDays size={14} className="text-slate-500" />
            Preferred days
          </p>
          <PillMultiSelector
            options={availableDateOptions}
            selectedValues={selectedPreferredDates}
            onChange={onPreferredDateChange}
            emptyLabel="Select exam timeline dates first."
          />
        </div>

        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <Clock3 size={14} className="text-slate-500" />
            Preferred time slots
          </p>
          <PillMultiSelector
            options={examTimeSlotOptions}
            selectedValues={selectedTimeSlots}
            onChange={onTimeSlotChange}
          />
        </div>
      </div>
    </article>
  );
}
