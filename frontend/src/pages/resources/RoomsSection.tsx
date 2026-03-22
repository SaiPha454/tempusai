import { type Dispatch, type SetStateAction } from 'react';
import { Building2, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../components/Card';
import { InputField } from '../../components/InputField';
import { UploadPanel } from '../../components/UploadPanel';

type RoomResource = { id: string; name: string; capacity: string };

type RoomsSectionProps = {
  roomUploadName: string;
  onRoomUploadNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  roomNameInput: string;
  setRoomNameInput: React.Dispatch<React.SetStateAction<string>>;
  roomCapacityInput: string;
  setRoomCapacityInput: React.Dispatch<React.SetStateAction<string>>;
  canAddRoom: boolean;
  setRooms: Dispatch<SetStateAction<RoomResource[]>>;
  generateId: () => string;
  toRoomName: (value: string) => string;
  sortedRooms: RoomResource[];
  roomSuggestions: string[];
  showRoomSuggestions: boolean;
  isRoomNameAlreadyExists: boolean;
  setIsRoomNameFocused: React.Dispatch<React.SetStateAction<boolean>>;
  editingRoomIds: Record<string, boolean>;
  toggleRoomEditing: (id: string) => void;
};

export function RoomsSection({
  roomUploadName,
  onRoomUploadNameChange,
  roomNameInput,
  setRoomNameInput,
  roomCapacityInput,
  setRoomCapacityInput,
  canAddRoom,
  setRooms,
  generateId,
  toRoomName,
  sortedRooms,
  roomSuggestions,
  showRoomSuggestions,
  isRoomNameAlreadyExists,
  setIsRoomNameFocused,
  editingRoomIds,
  toggleRoomEditing,
}: RoomsSectionProps) {
  return (
    <div className="space-y-6">
      <UploadPanel
        title="Room bulk import"
        description="Upload an Excel file to import room names and capacities."
        fileName={roomUploadName}
        onFileChange={onRoomUploadNameChange}
      />

      <Card title="Rooms" icon={Building2}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <input
              value={roomNameInput}
              onChange={(event) => setRoomNameInput(toRoomName(event.target.value))}
              onFocus={() => setIsRoomNameFocused(true)}
              onBlur={() => {
                setTimeout(() => setIsRoomNameFocused(false), 120);
              }}
              placeholder="Room name"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
            />

            {showRoomSuggestions && (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {roomSuggestions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">No matching room names found.</p>
                ) : (
                  roomSuggestions.map((roomName) => (
                    <button
                      key={roomName}
                      type="button"
                      onMouseDown={() => {
                        setRoomNameInput(roomName);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[#0A64BC]/10 hover:text-[#0A64BC]"
                    >
                      {roomName}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <InputField
            value={roomCapacityInput}
            onChange={setRoomCapacityInput}
            placeholder="Capacity"
            type="number"
          />
          <button
            type="button"
            onClick={() => {
              if (!canAddRoom) return;
              setRooms((prev) => [
                ...prev,
                {
                  id: generateId(),
                  name: toRoomName(roomNameInput.trim()),
                  capacity: roomCapacityInput.trim(),
                },
              ]);
              setRoomNameInput('');
              setRoomCapacityInput('');
            }}
            disabled={!canAddRoom}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus size={16} /> Add Room
          </button>
        </div>

        {isRoomNameAlreadyExists && (
          <p className="mt-2 text-xs text-amber-700">This room already exists in your current list.</p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedRooms.map((room) => (
            <div
              key={room.id}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-2">
                {editingRoomIds[room.id] ? (
                  <input
                    value={room.name}
                    onChange={(event) =>
                      setRooms((prev) =>
                        prev.map((item) =>
                          item.id === room.id ? { ...item, name: toRoomName(event.target.value) } : item,
                        ),
                      )
                    }
                    className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0A64BC]"
                  />
                ) : (
                  <p className="text-base font-semibold text-slate-900">{room.name || '—'}</p>
                )}

                <div className="ml-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleRoomEditing(room.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                    aria-label={editingRoomIds[room.id] ? 'Done editing room' : 'Edit room'}
                  >
                    {editingRoomIds[room.id] ? <Check size={14} /> : <Pencil size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRooms((prev) => prev.filter((item) => item.id !== room.id))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-rose-700 transition hover:bg-rose-50"
                    aria-label="Remove room"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                {editingRoomIds[room.id] ? (
                  <input
                    value={room.capacity}
                    type="number"
                    onChange={(event) =>
                      setRooms((prev) =>
                        prev.map((item) =>
                          item.id === room.id ? { ...item, capacity: event.target.value } : item,
                        ),
                      )
                    }
                    className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
                    placeholder="Capacity"
                  />
                ) : (
                  <p className="text-sm text-slate-600">
                    Capacity: <span className="font-medium text-slate-800">{room.capacity || '—'}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
