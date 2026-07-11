import { APP_CONFIG } from '../config/appConfig';

export const CLASS_META = APP_CONFIG.classMeta;

export const ALL_CLASSES = Object.keys(CLASS_META);

export function metaFromClass(cls) {
  if (!cls) return null;
  if (CLASS_META[cls]) return CLASS_META[cls];
  // Fallback: strip trailing section suffix e.g. (A)/(B) and retry
  const base = cls.replace(/\([^)]*\)$/, '').trim();
  return CLASS_META[base] || null;
}
