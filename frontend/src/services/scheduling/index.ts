export {
  getClassConflictDetail,
  getRoomAvailabilityStatus,
  recomputeClassDraftConflicts,
  type RecomputeClassDraftConflictsInput,
} from './classDraftConflictService';
export {
  canPlaceEntryInRoomCell,
  canPlaceEntryInTimeCell,
  getRoomCellConflictCodes,
  getRoomCellUnavailableMessages,
  getTimeCellUnavailableMessages,
  getPlacementHintMessage,
  type PlacementHintCode,
  type PlacementSettings,
} from './classPlacementHintService';
export {
  canPlaceExamEntryInRoomCell,
  getExamRoomAvailabilityStatus,
  recomputeExamDraftConflicts,
  type RecomputeExamDraftConflictsInput,
} from './examDraftConflictService';
export {
  buildAllTimeslotsSorted,
  buildBucketRows,
  buildTimeslotsByDay,
  resolveEntryBucket,
  resolveEntryDay,
  resolveTimeslotIdByDayBucket,
} from './classMatrixService';
export { buildPreferredWeekdayStatusByEntryId, type PreferredWeekdayStatus } from './examPreferenceService';
