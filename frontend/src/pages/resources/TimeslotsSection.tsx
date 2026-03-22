import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../components/Card';

type TimeslotResource = {
  id: string;
  day: string;
  label: string;
};

type TimeslotsSectionProps = {
  orderedTimeslotLabels: string[];
  weekdays: string[];
  timeslotMap: Map<string, TimeslotResource>;
  setTimeslots: React.Dispatch<React.SetStateAction<TimeslotResource[]>>;
  generateId: () => string;
};

export function TimeslotsSection({
  orderedTimeslotLabels,
  weekdays,
  timeslotMap,
  setTimeslots,
  generateId,
}: TimeslotsSectionProps) {
  return (
    <Card title="Timeslots" icon={CalendarClock}>
      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Day</th>
              {orderedTimeslotLabels.map((label) => (
                <th key={label} className="px-3 py-2 text-center">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {weekdays.map((day) => (
              <tr key={day}>
                <td className="px-3 py-2 font-medium text-slate-800">{day}</td>
                {orderedTimeslotLabels.map((label) => {
                  const key = `${day}__${label}`;
                  const slot = timeslotMap.get(key);

                  if (!slot) {
                    return (
                      <td key={label} className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            setTimeslots((prev) => [...prev, { id: generateId(), day, label }])
                          }
                          className="inline-flex items-center justify-center rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                          aria-label={`Add timeslot ${day} ${label}`}
                        >
                          <Plus size={14} />
                        </button>
                      </td>
                    );
                  }

                  return (
                    <td key={label} className="px-2 py-2 align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs text-slate-600">Set</span>
                        <button
                          type="button"
                          onClick={() =>
                            setTimeslots((prev) => prev.filter((item) => item.id !== slot.id))
                          }
                          className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
