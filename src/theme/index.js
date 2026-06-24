// ─── Theme definitions ────────────────────────────────────────────────────────

const novigradTheme = {
  bg: '#0F0F1A',
  card: '#1A1A2E',
  cardElevated: '#252540',
  border: '#2D2D4A',
  borderLight: '#3D3D5A',
  textPrimary: '#F5F5FA',
  textSecondary: '#A8A8C0',
  textTertiary: '#6B6B85',
  primary: '#A855F7',
  primaryDark: '#9333EA',
  pink: '#EC4899',
  primaryLight: 'rgba(168, 85, 247, 0.15)',
  green: '#34D399',
  greenLight: 'rgba(52, 211, 153, 0.15)',
  greenBorder: 'rgba(52, 211, 153, 0.4)',
  red: '#F87171',
  redLight: 'rgba(248, 113, 113, 0.15)',
  amber: '#FBBF24',
  amberLight: 'rgba(251, 191, 36, 0.15)',
  courses: {
    'BCom IAF': { bg: 'rgba(59, 130, 246, 0.2)',  text: '#93C5FD' },
    'BCom IBA': { bg: 'rgba(168, 85, 247, 0.2)',  text: '#C4B5FD' },
    'BCom F&A': { bg: 'rgba(52, 211, 153, 0.2)',  text: '#6EE7B7' },
    'Other':    { bg: 'rgba(107, 114, 128, 0.2)', text: '#9CA3AF' },
  },
  avatars: [
    { bg: '#3B82F6', text: '#FFFFFF' },
    { bg: '#10B981', text: '#FFFFFF' },
    { bg: '#A855F7', text: '#FFFFFF' },
    { bg: '#F59E0B', text: '#FFFFFF' },
    { bg: '#EF4444', text: '#FFFFFF' },
    { bg: '#EC4899', text: '#FFFFFF' },
    { bg: '#14B8A6', text: '#FFFFFF' },
    { bg: '#8B5CF6', text: '#FFFFFF' },
  ],
};

const lightTheme = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  pink: '#EC4899',
  primaryLight: 'rgba(99, 102, 241, 0.1)',
  green: '#059669',
  greenLight: 'rgba(5, 150, 105, 0.1)',
  greenBorder: 'rgba(5, 150, 105, 0.35)',
  red: '#DC2626',
  redLight: 'rgba(220, 38, 38, 0.1)',
  amber: '#D97706',
  amberLight: 'rgba(217, 119, 6, 0.1)',
  courses: {
    'BCom IAF': { bg: 'rgba(99, 102, 241, 0.12)', text: '#4338CA' },
    'BCom IBA': { bg: 'rgba(236, 72, 153, 0.12)', text: '#BE185D' },
    'BCom F&A': { bg: 'rgba(5, 150, 105, 0.12)',  text: '#065F46' },
    'Other':    { bg: 'rgba(107, 114, 128, 0.12)', text: '#374151' },
  },
  avatars: [
    { bg: '#6366F1', text: '#FFFFFF' },
    { bg: '#059669', text: '#FFFFFF' },
    { bg: '#EC4899', text: '#FFFFFF' },
    { bg: '#D97706', text: '#FFFFFF' },
    { bg: '#DC2626', text: '#FFFFFF' },
    { bg: '#0EA5E9', text: '#FFFFFF' },
    { bg: '#7C3AED', text: '#FFFFFF' },
    { bg: '#0D9488', text: '#FFFFFF' },
  ],
};

const darkTheme = {
  bg: '#0A0A0A',
  card: '#141414',
  cardElevated: '#1E1E1E',
  border: '#2A2A2A',
  borderLight: '#363636',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  primary: '#E5E7EB',
  primaryDark: '#D1D5DB',
  pink: '#60A5FA',
  primaryLight: 'rgba(229, 231, 235, 0.1)',
  green: '#34D399',
  greenLight: 'rgba(52, 211, 153, 0.15)',
  greenBorder: 'rgba(52, 211, 153, 0.4)',
  red: '#F87171',
  redLight: 'rgba(248, 113, 113, 0.15)',
  amber: '#FBBF24',
  amberLight: 'rgba(251, 191, 36, 0.15)',
  courses: {
    'BCom IAF': { bg: 'rgba(229, 231, 235, 0.1)',  text: '#E5E7EB' },
    'BCom IBA': { bg: 'rgba(96, 165, 250, 0.12)',  text: '#93C5FD' },
    'BCom F&A': { bg: 'rgba(52, 211, 153, 0.12)',  text: '#6EE7B7' },
    'Other':    { bg: 'rgba(107, 114, 128, 0.15)', text: '#9CA3AF' },
  },
  avatars: [
    { bg: '#374151', text: '#F9FAFB' },
    { bg: '#4B5563', text: '#FFFFFF' },
    { bg: '#6B7280', text: '#FFFFFF' },
    { bg: '#1F2937', text: '#F9FAFB' },
    { bg: '#111827', text: '#E5E7EB' },
    { bg: '#3F3F3F', text: '#FFFFFF' },
    { bg: '#2D2D2D', text: '#E5E7EB' },
    { bg: '#525252', text: '#FFFFFF' },
  ],
};

const modernCampusTheme = {
  bg: '#0F172A',
  card: '#1E293B',
  cardElevated: '#263045',
  border: '#334155',
  borderLight: '#3D4F66',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#4B6080',
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  pink: '#2DD4BF',
  primaryLight: 'rgba(59, 130, 246, 0.15)',
  green: '#2DD4BF',
  greenLight: 'rgba(45, 212, 191, 0.15)',
  greenBorder: 'rgba(45, 212, 191, 0.4)',
  red: '#F87171',
  redLight: 'rgba(248, 113, 113, 0.15)',
  amber: '#FBBF24',
  amberLight: 'rgba(251, 191, 36, 0.15)',
  courses: {
    'BCom IAF': { bg: 'rgba(59, 130, 246, 0.18)',  text: '#93C5FD' },
    'BCom IBA': { bg: 'rgba(45, 212, 191, 0.18)',  text: '#99F6E4' },
    'BCom F&A': { bg: 'rgba(251, 191, 36, 0.18)',  text: '#FDE68A' },
    'Other':    { bg: 'rgba(107, 114, 128, 0.2)',  text: '#9CA3AF' },
  },
  avatars: [
    { bg: '#3B82F6', text: '#FFFFFF' },
    { bg: '#2563EB', text: '#FFFFFF' },
    { bg: '#0D9488', text: '#FFFFFF' },
    { bg: '#2DD4BF', text: '#0F172A' },
    { bg: '#1D4ED8', text: '#FFFFFF' },
    { bg: '#0EA5E9', text: '#FFFFFF' },
    { bg: '#14B8A6', text: '#FFFFFF' },
    { bg: '#1E40AF', text: '#FFFFFF' },
  ],
};

const parchmentTheme = {
  bg: '#F5F0E8',
  card: '#FDFAF5',
  cardElevated: '#FFFFFF',
  border: '#DDD5C5',
  borderLight: '#E8E0D0',
  textPrimary: '#1C1410',
  textSecondary: '#5C4A38',
  textTertiary: '#9C8878',
  primary: '#B45309',
  primaryDark: '#92400E',
  pink: '#D97706',
  primaryLight: 'rgba(180, 83, 9, 0.1)',
  green: '#059669',
  greenLight: 'rgba(5, 150, 105, 0.1)',
  greenBorder: 'rgba(5, 150, 105, 0.35)',
  red: '#DC2626',
  redLight: 'rgba(220, 38, 38, 0.1)',
  amber: '#D97706',
  amberLight: 'rgba(217, 119, 6, 0.1)',
  courses: {
    'BCom IAF': { bg: 'rgba(180, 83, 9, 0.12)',  text: '#92400E' },
    'BCom IBA': { bg: 'rgba(217, 119, 6, 0.12)', text: '#B45309' },
    'BCom F&A': { bg: 'rgba(5, 150, 105, 0.12)', text: '#065F46' },
    'Other':    { bg: 'rgba(107, 114, 128, 0.12)', text: '#374151' },
  },
  avatars: [
    { bg: '#B45309', text: '#FFFFFF' },
    { bg: '#D97706', text: '#FFFFFF' },
    { bg: '#059669', text: '#FFFFFF' },
    { bg: '#DC2626', text: '#FFFFFF' },
    { bg: '#7C3AED', text: '#FFFFFF' },
    { bg: '#DB2777', text: '#FFFFFF' },
    { bg: '#0284C7', text: '#FFFFFF' },
    { bg: '#65A30D', text: '#FFFFFF' },
  ],
};

const institutionalTheme = {
  bg: '#121212',
  card: '#1E1E1E',
  cardElevated: '#252525',
  border: '#2D3748',
  borderLight: '#374151',
  textPrimary: '#E0E0E0',
  textSecondary: '#A0AAB5',
  textTertiary: '#5A6470',
  primary: '#1D88E5',
  primaryDark: '#1565C0',
  pink: '#FFD54F',
  primaryLight: 'rgba(29, 136, 229, 0.15)',
  green: '#34D399',
  greenLight: 'rgba(52, 211, 153, 0.15)',
  greenBorder: 'rgba(52, 211, 153, 0.4)',
  red: '#F87171',
  redLight: 'rgba(248, 113, 113, 0.15)',
  amber: '#FFD54F',
  amberLight: 'rgba(255, 213, 79, 0.15)',
  courses: {
    'BCom IAF': { bg: 'rgba(29, 136, 229, 0.18)',  text: '#90CAF9' },
    'BCom IBA': { bg: 'rgba(255, 213, 79, 0.18)',  text: '#FFE082' },
    'BCom F&A': { bg: 'rgba(52, 211, 153, 0.18)',  text: '#6EE7B7' },
    'Other':    { bg: 'rgba(107, 114, 128, 0.2)',  text: '#9CA3AF' },
  },
  avatars: [
    { bg: '#1D88E5', text: '#FFFFFF' },
    { bg: '#1565C0', text: '#FFFFFF' },
    { bg: '#FFD54F', text: '#121212' },
    { bg: '#F9A825', text: '#121212' },
    { bg: '#42A5F5', text: '#FFFFFF' },
    { bg: '#FFC107', text: '#121212' },
    { bg: '#1976D2', text: '#FFFFFF' },
    { bg: '#0D47A1', text: '#FFFFFF' },
  ],
};

const christTheme = {
  bg: '#020508',
  card: '#050C18',
  cardElevated: '#091220',
  border: '#0F2040',
  borderLight: '#163058',
  textPrimary: '#F8F8FF',
  textSecondary: '#A8BCDA',
  textTertiary: '#4A6480',
  primary: '#003087',
  primaryDark: '#002060',
  pink: '#C9A227',
  primaryLight: 'rgba(0, 48, 135, 0.2)',
  green: '#34D399',
  greenLight: 'rgba(52, 211, 153, 0.15)',
  greenBorder: 'rgba(52, 211, 153, 0.4)',
  red: '#F87171',
  redLight: 'rgba(248, 113, 113, 0.15)',
  amber: '#C9A227',
  amberLight: 'rgba(201, 162, 39, 0.15)',
  courses: {
    'BCom IAF': { bg: 'rgba(0, 48, 135, 0.22)',   text: '#93C5FD' },
    'BCom IBA': { bg: 'rgba(201, 162, 39, 0.2)',  text: '#E8CC6A' },
    'BCom F&A': { bg: 'rgba(52, 211, 153, 0.18)', text: '#6EE7B7' },
    'Other':    { bg: 'rgba(107, 114, 128, 0.2)', text: '#9CA3AF' },
  },
  avatars: [
    { bg: '#003087', text: '#FFFFFF' },
    { bg: '#002060', text: '#FFFFFF' },
    { bg: '#C9A227', text: '#020508' },
    { bg: '#A07C10', text: '#FFFFFF' },
    { bg: '#0042B8', text: '#FFFFFF' },
    { bg: '#E8CC6A', text: '#020508' },
    { bg: '#1A4FA0', text: '#FFFFFF' },
    { bg: '#D4AF37', text: '#020508' },
  ],
};

// ─── Theme registry (order = display order in picker) ─────────────────────────

export const THEMES = [
  {
    key: 'novigrad',
    label: 'Novigrad',
    desc: 'Default dark theme',
    swatch: ['#0F0F1A', '#A855F7', '#EC4899'],
    ready: true,
    colors: novigradTheme,
  },
  {
    key: 'light',
    label: 'Light',
    desc: 'Clean & bright',
    swatch: ['#F9FAFB', '#6366F1', '#EC4899'],
    ready: true,
    colors: lightTheme,
  },
  {
    key: 'dark',
    label: 'Dark',
    desc: 'Pure black',
    swatch: ['#0A0A0A', '#E5E7EB', '#60A5FA'],
    ready: true,
    colors: darkTheme,
  },
  {
    key: 'midnight',
    label: 'Modern Campus',
    desc: 'Slate blue & teal',
    swatch: ['#0F172A', '#3B82F6', '#2DD4BF'],
    ready: true,
    colors: modernCampusTheme,
  },
  {
    key: 'parchment',
    label: 'Parchment',
    desc: 'Warm light theme',
    swatch: ['#F5F0E8', '#B45309', '#D97706'],
    ready: true,
    colors: parchmentTheme,
  },
  {
    key: 'forest',
    label: 'Institutional',
    desc: 'Corporate blue & gold',
    swatch: ['#121212', '#1D88E5', '#FFD54F'],
    ready: true,
    colors: institutionalTheme,
  },
  {
    key: 'christ',
    label: 'My UNI Colours',
    desc: 'Royal blue & gold',
    swatch: ['#020508', '#003087', '#C9A227'],
    ready: true,
    colors: christTheme,
  },
];

// ─── Active theme (read from localStorage synchronously at module load) ───────

function getActiveTheme() {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('cc_theme') : null;
    return THEMES.find(t => t.key === stored && t.ready) || THEMES[0];
  } catch {
    return THEMES[0];
  }
}

const activeTheme = getActiveTheme();
export const colors = activeTheme.colors;
export const activeThemeKey = activeTheme.key;

export function setTheme(key) {
  try {
    localStorage.setItem('cc_theme', key);
    localStorage.setItem('cc_theme_reload', '1');
    window.location.reload();
  } catch {
    // no-op outside web
  }
}

// ─── Shared tokens ────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
};

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 999,
};

export const font = {
  regular:  { fontWeight: '400' },
  medium:   { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold:     { fontWeight: '700' },
};

export function avatarColor(name) {
  const idx = name.charCodeAt(0) % colors.avatars.length;
  return colors.avatars[idx];
}

export function initials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('');
}

export function courseColor(course) {
  return colors.courses[course] || { bg: 'rgba(168, 85, 247, 0.2)', text: '#C4B5FD' };
}
