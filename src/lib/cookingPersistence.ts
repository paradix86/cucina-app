export const COOKING_PERSIST_TTL_MS = 48 * 60 * 60 * 1000;

export interface CookingProgressData {
  stepIndex?: number;
  checklist?: Record<string, unknown>;
}

/**
 * Parses a raw localStorage value for cooking progress.
 * Returns null if the entry is missing, malformed, or older than TTL.
 * `now` is injectable for testing.
 */
export function parseCookingProgress(
  raw: string | null,
  stepCount: number,
  now: number = Date.now(),
): CookingProgressData | null {
  if (!raw) return null;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof saved !== 'object' || saved === null) return null;
  const entry = saved as Record<string, unknown>;

  if (typeof entry.updatedAt === 'number' && now - entry.updatedAt > COOKING_PERSIST_TTL_MS) {
    return null;
  }

  const result: CookingProgressData = {};
  if (
    typeof entry.stepIndex === 'number' &&
    entry.stepIndex >= 0 &&
    entry.stepIndex < stepCount
  ) {
    result.stepIndex = entry.stepIndex;
  }
  if (entry.checklist && typeof entry.checklist === 'object' && !Array.isArray(entry.checklist)) {
    result.checklist = entry.checklist as Record<string, unknown>;
  }
  return result;
}
