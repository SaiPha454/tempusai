const CLASS_PREFS_STORAGE_PREFIX = 'classPreferredSlotsBySnapshot:';

export function readPreferredTimeslotsBySnapshot(snapshotId: string | null): Record<string, string[]> {
  if (!snapshotId) {
    return {};
  }

  try {
    const raw = sessionStorage.getItem(`${CLASS_PREFS_STORAGE_PREFIX}${snapshotId}`);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) {
        continue;
      }
      const slotIds = value.filter((item): item is string => typeof item === 'string');
      if (slotIds.length > 0) {
        normalized[key] = slotIds;
      }
    }
    return normalized;
  } catch {
    return {};
  }
}
