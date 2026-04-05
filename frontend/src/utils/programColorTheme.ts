export type ProgramColorTheme = {
  cardBackground: string;
  tagBackground: string;
  tagText: string;
};

const FALLBACK_THEME: ProgramColorTheme = {
  cardBackground: 'hsl(210 20% 96%)',
  tagBackground: 'hsl(210 20% 88%)',
  tagText: 'hsl(210 22% 24%)',
};

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function normalizeProgramKey(rawKey: string | null | undefined): string {
  const cleaned = (rawKey ?? '').trim();
  return cleaned || 'program';
}

export function getProgramColorKey(entry: {
  program_id?: string | null;
  program_value?: string | null;
  program_label?: string | null;
}): string {
  return normalizeProgramKey(entry.program_id ?? entry.program_value ?? entry.program_label);
}

export function buildProgramColorThemeMap(programKeys: string[]): Map<string, ProgramColorTheme> {
  const uniqueKeys = Array.from(new Set(programKeys.map((key) => normalizeProgramKey(key))));
  if (uniqueKeys.length === 0) {
    return new Map();
  }

  // Stable ordering by hash keeps themes predictable while spacing hues evenly.
  const orderedKeys = [...uniqueKeys].sort((left, right) => {
    const leftHash = hashString(left);
    const rightHash = hashString(right);
    if (leftHash === rightHash) {
      return left.localeCompare(right);
    }
    return leftHash - rightHash;
  });

  const map = new Map<string, ProgramColorTheme>();
  const total = orderedKeys.length;

  orderedKeys.forEach((programKey, index) => {
    const hue = Math.round((24 + (index * 360) / total) % 360);
    const saturation = 66 - (index % 3) * 6;

    map.set(programKey, {
      cardBackground: `hsl(${hue} ${saturation}% 95%)`,
      tagBackground: `hsl(${hue} ${saturation}% 86%)`,
      tagText: `hsl(${hue} 44% 24%)`,
    });
  });

  return map;
}

export function resolveProgramColorTheme(
  themeMap: Map<string, ProgramColorTheme>,
  programKey: string,
): ProgramColorTheme {
  return themeMap.get(normalizeProgramKey(programKey)) ?? FALLBACK_THEME;
}
