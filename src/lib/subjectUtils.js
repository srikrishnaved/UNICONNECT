export const CLASS_META = {
  '1BcomIAF':    { programme: 'IAF', semester: '1' },
  '3BcomIAF':    { programme: 'IAF', semester: '3' },
  '5BcomIAF':    { programme: 'IAF', semester: '5' },
  '1BcomIBA':    { programme: 'IBA', semester: '1' },
  '3BcomIBA':    { programme: 'IBA', semester: '3' },
  '1BcomF&A':    { programme: 'F&A', semester: '1' },
  '3BcomF&A(A)': { programme: 'F&A', semester: '3' },
  '3BcomF&A(B)': { programme: 'F&A', semester: '3' },
  '5BcomF&A(A)': { programme: 'F&A', semester: '5' },
  '5BcomF&A(B)': { programme: 'F&A', semester: '5' },
  '7BcomF&A':    { programme: 'F&A', semester: '7' },
};

export const ALL_CLASSES = Object.keys(CLASS_META);

export function metaFromClass(cls) {
  if (!cls) return null;
  if (CLASS_META[cls]) return CLASS_META[cls];
  // Fallback: strip trailing section suffix e.g. (A)/(B) and retry
  const base = cls.replace(/\([^)]*\)$/, '').trim();
  return CLASS_META[base] || null;
}
