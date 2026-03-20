import { useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Plus, X } from 'lucide-react';
import { Tabs } from '../components/Tabs';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { SelectField } from '../components/SelectField';
import { DaySelector } from '../components/DaySelector';
import { TimeSlotSelector } from '../components/TimeSlotSelector';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { CourseItem } from '../components/CourseItem';
import { ProfessorSelectField } from '../components/ProfessorSelectField';
import { RoomSelector } from '../components/RoomSelector';
import { CourseSelectField } from '../components/CourseSelectField';
import {
  courseDirectory,
  preferredTimeOptions,
  professorDirectory,
  roomDirectory,
  semesterOptions,
  weekdays,
  yearOptions,
  type CourseOption,
} from '../data/schedulingData';
import { schedulingTabs } from '../data/navigation';

type CourseForm = {
  year: string;
  semester: string;
  studentCapacity: string;
};

type AddedCourse = {
  id: string;
  courseCode: string;
  courseName: string;
  year: string;
  semester: string;
  professorNames: string[];
  studentCapacity: string;
  preferredDays: string[];
  preferredTimes: string[];
};

type ConstraintKey =
  | 'prioritizeProfessorPreferences'
  | 'professorNoOverlap'
  | 'roomCapacityCheck'
  | 'flexibleSlotFallback'
  | 'studentGroupsNoOverlap';

const initialForm: CourseForm = {
  year: '',
  semester: '',
  studentCapacity: '',
};

export function SchedulingManagerPage() {
  const [activeTab, setActiveTab] = useState<(typeof schedulingTabs)[number]>('Schedule Class');
  const [courseQuery, setCourseQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(initialForm);
  const [professorQuery, setProfessorQuery] = useState('');
  const [selectedProfessors, setSelectedProfessors] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>(['any-time']);
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [addedCourses, setAddedCourses] = useState<AddedCourse[]>([]);
  const [constraints, setConstraints] = useState<Record<ConstraintKey, boolean>>({
    prioritizeProfessorPreferences: true,
    professorNoOverlap: true,
    roomCapacityCheck: true,
    flexibleSlotFallback: true,
    studentGroupsNoOverlap: true,
  });

  const filteredCourses = useMemo(() => {
    const normalized = courseQuery.trim().toLowerCase();
    if (!normalized) {
      return courseDirectory.slice(0, 8);
    }

    return courseDirectory.filter(
      (course) =>
        course.code.toLowerCase().includes(normalized) ||
        course.name.toLowerCase().includes(normalized),
    );
  }, [courseQuery]);

  const filteredProfessors = useMemo(() => {
    const normalized = professorQuery.trim().toLowerCase();
    if (!normalized) {
      return professorDirectory.filter((professor) => !selectedProfessors.includes(professor)).slice(0, 6);
    }

    return professorDirectory.filter(
      (professor) =>
        professor.toLowerCase().includes(normalized) && !selectedProfessors.includes(professor),
    );
  }, [professorQuery, selectedProfessors]);

  const filteredRooms = useMemo(() => {
    const normalized = roomSearch.trim().toLowerCase();
    return normalized ? roomDirectory.filter((room) => room.toLowerCase().includes(normalized)) : roomDirectory;
  }, [roomSearch]);

  const handleFormChange = (field: keyof CourseForm, value: string) => {
    setCourseForm((prev) => ({ ...prev, [field]: value }));
  };

  const getTimeLabel = (timeValue: string) =>
    preferredTimeOptions.find((option) => option.value === timeValue)?.label ?? 'Any time';

  const getTimeLabels = (timeValues: string[]) =>
    timeValues.map((timeValue) => getTimeLabel(timeValue)).join(', ');

  const addCourse = () => {
    if (!canAddCourse || !selectedCourse) {
      return;
    }

    const course: AddedCourse = {
      id: crypto.randomUUID(),
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,
      year: courseForm.year,
      semester: courseForm.semester,
      professorNames: selectedProfessors,
      studentCapacity: courseForm.studentCapacity,
      preferredDays: selectedDays,
      preferredTimes: selectedTimeSlots,
    };

    setAddedCourses((prev) => [...prev, course]);
    setSelectedCourse(null);
    setCourseQuery('');
    setProfessorQuery('');
    setSelectedProfessors([]);
  };

  const removeCourse = (courseId: string) => {
    setAddedCourses((prev) => prev.filter((course) => course.id !== courseId));
  };

  const toggleRoom = (room: string) => {
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((item) => item !== room) : [...prev, room],
    );
  };

  const removeRoom = (room: string) => {
    setSelectedRooms((prev) => prev.filter((item) => item !== room));
  };

  const toggleConstraint = (key: ConstraintKey) => {
    setConstraints((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasValidCapacity = Number(courseForm.studentCapacity) > 0;
  const canAddCourse =
    Boolean(selectedCourse) &&
    Boolean(courseForm.year) &&
    Boolean(courseForm.semester) &&
    hasValidCapacity &&
    selectedProfessors.length > 0;

  const renderTabPlaceholder = (title: string, description: string) => (
    <div className="mt-6">
      <Card title={title} icon={ClipboardList}>
        <p className="text-sm text-slate-600">{description}</p>
      </Card>
    </div>
  );

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Scheduling Manager</h1>

      <div className="mt-6">
        <Tabs tabs={[...schedulingTabs]} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as (typeof schedulingTabs)[number])} />
      </div>

      {activeTab === 'Schedule Class' && (
        <div className="mt-6 space-y-6 pb-8">
          <Card title="Course Information" icon={CalendarDays}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CourseSelectField
                selectedCourse={selectedCourse}
                query={courseQuery}
                onQueryChange={setCourseQuery}
                suggestions={filteredCourses}
                onSelect={(course) => {
                  setSelectedCourse(course);
                  setCourseQuery('');
                }}
                onRemove={() => setSelectedCourse(null)}
              />
              <SelectField
                value={courseForm.year}
                onChange={(value) => handleFormChange('year', value)}
                options={yearOptions}
              />
              <SelectField
                value={courseForm.semester}
                onChange={(value) => handleFormChange('semester', value)}
                options={semesterOptions}
              />
              <InputField
                value={courseForm.studentCapacity}
                onChange={(value) => handleFormChange('studentCapacity', value)}
                placeholder="Student capacity"
                type="number"
              />

              <div className="md:col-span-2">
                <ProfessorSelectField
                  selectedProfessors={selectedProfessors}
                  query={professorQuery}
                  onQueryChange={setProfessorQuery}
                  suggestions={filteredProfessors}
                  onSelect={(professor) => {
                    setSelectedProfessors((prev) =>
                      prev.includes(professor) ? prev : [...prev, professor],
                    );
                    setProfessorQuery('');
                  }}
                  onRemove={(professor) =>
                    setSelectedProfessors((prev) => prev.filter((item) => item !== professor))
                  }
                />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <p className="text-sm font-medium text-slate-700">Preferred schedule options</p>
              <DaySelector days={weekdays} selectedDays={selectedDays} onChange={setSelectedDays} />

              <TimeSlotSelector
                options={preferredTimeOptions}
                selectedValues={selectedTimeSlots}
                onChange={setSelectedTimeSlots}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={addCourse}
                disabled={!canAddCourse}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
              >
                <Plus size={16} />
                Add Course
              </button>
            </div>
          </Card>

          <Card title="Rooms to be included">
            <RoomSelector
              query={roomSearch}
              onQueryChange={setRoomSearch}
              filteredRooms={filteredRooms}
              selectedRooms={selectedRooms}
              onToggleRoom={toggleRoom}
            />

            <div className="mt-4 min-h-11 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              {selectedRooms.length === 0 ? (
                <p className="text-sm text-rose-600">Please select at least one room. Rooms are required.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedRooms.map((room) => (
                    <span
                      key={room}
                      className="inline-flex items-center gap-1 rounded-full border border-[#0A64BC]/25 bg-[#0A64BC]/10 px-3 py-1 text-sm text-[#0A64BC]"
                    >
                      {room}
                      <button
                        type="button"
                        onClick={() => removeRoom(room)}
                        className="rounded-full p-0.5 text-[#0A64BC]/80 transition hover:bg-[#0A64BC]/15 hover:text-[#0A64BC]"
                        aria-label={`Remove ${room}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Courses to be scheduled">
            <div
              className={
                addedCourses.length > 3 ? 'max-h-[540px] space-y-3 overflow-y-auto pr-1' : 'space-y-3'
              }
            >
              {addedCourses.length === 0 ? (
                <p className="text-sm text-slate-500">No courses added yet.</p>
              ) : (
                addedCourses.map((course, index) => (
                  <CourseItem
                    key={course.id}
                    order={index + 1}
                    courseCode={course.courseCode}
                    courseName={course.courseName}
                    year={course.year}
                    semester={course.semester}
                    studentCapacity={course.studentCapacity}
                    professorNames={course.professorNames}
                    preferredDays={course.preferredDays}
                    preferredTime={getTimeLabels(course.preferredTimes)}
                    onRemove={() => removeCourse(course.id)}
                  />
                ))
              )}
            </div>
          </Card>

          <Card title="Constraints rules">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              <ToggleSwitch
                label="Prioritize professor preferences"
                checked={constraints.prioritizeProfessorPreferences}
                onChange={() => toggleConstraint('prioritizeProfessorPreferences')}
              />
              <ToggleSwitch
                label="Flexible slot fallback"
                checked={constraints.flexibleSlotFallback}
                onChange={() => toggleConstraint('flexibleSlotFallback')}
              />
              <ToggleSwitch
                label="Professor cannot have overlapping classes"
                checked={constraints.professorNoOverlap}
                onChange={() => toggleConstraint('professorNoOverlap')}
              />
              <ToggleSwitch
                label="Student groups cannot overlap"
                checked={constraints.studentGroupsNoOverlap}
                onChange={() => toggleConstraint('studentGroupsNoOverlap')}
              />
              <ToggleSwitch
                label="Room capacity check"
                checked={constraints.roomCapacityCheck}
                onChange={() => toggleConstraint('roomCapacityCheck')}
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={selectedRooms.length === 0 || addedCourses.length === 0}
              className="rounded-xl bg-[#0A64BC] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
            >
              Generate Schedule
            </button>
          </div>
        </div>
      )}

      {activeTab === 'Schedule Exam' &&
        renderTabPlaceholder(
          'Schedule Exam Page',
          'This page is a placeholder for future Schedule Exam design and implementation.',
        )}

      {activeTab === 'Custom Events' &&
        renderTabPlaceholder(
          'Custom Events Page',
          'This page is a placeholder for future Custom Events design and implementation.',
        )}
    </>
  );
}
