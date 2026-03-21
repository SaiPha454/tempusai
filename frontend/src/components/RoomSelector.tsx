import { Search } from 'lucide-react';

type RoomSelectorProps = {
  query: string;
  onQueryChange: (value: string) => void;
  filteredRooms: string[];
  selectedRooms: string[];
  onToggleRoom: (room: string) => void;
  roomCapacityMap?: Record<string, number>;
};

export function RoomSelector({
  query,
  onQueryChange,
  filteredRooms,
  selectedRooms,
  onToggleRoom,
  roomCapacityMap,
}: RoomSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">Rooms</p>
      <div className="relative max-w-lg">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Find rooms (e.g. HM-3, HM-302, ENG-4)"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <p className="mb-2 text-sm font-medium text-slate-700">Matching Rooms</p>
        {filteredRooms.length === 0 ? (
          <p className="text-sm text-slate-500">No similar rooms found.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRooms.map((room) => {
              const isChecked = selectedRooms.includes(room);
              return (
                <label
                  key={room}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 transition hover:border-[#0A64BC]/30"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleRoom(room)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0A64BC] focus:ring-[#0A64BC]/30"
                  />
                  <span>{room}</span>
                  {roomCapacityMap?.[room] ? (
                    <span className="ml-auto rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {roomCapacityMap[room]} seats
                    </span>
                  ) : null}
                </label>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
