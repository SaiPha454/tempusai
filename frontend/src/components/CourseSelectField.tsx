import { Search, X } from 'lucide-react';

type CourseOption = {
  code: string;
  name: string;
};

type CourseSelectFieldProps = {
  selectedCourse: CourseOption | null;
  query: string;
  onQueryChange: (value: string) => void;
  suggestions: CourseOption[];
  onSelect: (course: CourseOption) => void;
  onRemove: () => void;
  placeholder?: string;
};

export function CourseSelectField({
  selectedCourse,
  query,
  onQueryChange,
  suggestions,
  onSelect,
  onRemove,
  placeholder = 'Search by course name or course code',
}: CourseSelectFieldProps) {
  const showSuggestions = !selectedCourse && query.trim().length > 0;

  return (
    <div className="relative space-y-2">
      <div className="flex min-h-10 w-full items-center rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus-within:border-[#0A64BC] focus-within:ring-2 focus-within:ring-[#0A64BC]/20">
        {selectedCourse ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#0A64BC]/25 bg-[#0A64BC]/10 px-3 py-1 text-sm text-[#0A64BC]">
            {selectedCourse.code} · {selectedCourse.name}
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full p-0.5 text-[#0A64BC]/80 transition hover:bg-[#0A64BC]/15 hover:text-[#0A64BC]"
              aria-label={`Remove ${selectedCourse.code}`}
            >
              <X size={14} />
            </button>
          </span>
        ) : (
          <>
            <Search size={14} className="mr-2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={placeholder}
              className="w-full border-none bg-transparent p-0 outline-none"
            />
          </>
        )}
      </div>

      {showSuggestions && (
        <div className="absolute z-20 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {suggestions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No matching courses found.</p>
          ) : (
            suggestions.map((course) => (
              <button
                key={course.code}
                type="button"
                onClick={() => onSelect(course)}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition last:border-b-0 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-800">{course.code}</p>
                <p className="text-xs text-slate-500">{course.name}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}