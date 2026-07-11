// ─── Theme definitions ────────────────────────────────────────────────────────

const novigradTheme = {
  bg: '#FFFFFF', // Pure white background
  card: '#F5F5F7', // Apple light gray cards
  cardElevated: '#EFEFEF',
  border: 'rgba(0, 0, 0, 0.06)',
  borderLight: 'rgba(0, 0, 0, 0.03)',
  textPrimary: '#1D1D1F', // Apple charcoal/black text
  textSecondary: '#6E6E73', // Apple grey text
  textTertiary: '#86868B',
  primary: '#0071E3', // Apple Blue accent
  primaryDark: '#0055B3',
  pink: '#0D9488', // Teal accent
  primaryLight: 'rgba(0, 113, 227, 0.08)',
  green: '#10B981',
  greenLight: 'rgba(16, 185, 129, 0.1)',
  greenBorder: 'rgba(16, 185, 129, 0.25)',
  red: '#EF4444',
  redLight: 'rgba(239, 68, 68, 0.1)',
  amber: '#F59E0B',
  amberLight: 'rgba(245, 158, 11, 0.1)',
  courses: {
    'BCom IAF': { bg: 'rgba(0, 113, 227, 0.08)',  text: '#0071E3' },
    'BCom IBA': { bg: 'rgba(13, 148, 136, 0.08)',  text: '#0D9488' },
    'BCom F&A': { bg: 'rgba(16, 185, 129, 0.08)',  text: '#10B981' },
    'Other':    { bg: 'rgba(107, 114, 128, 0.08)', text: '#6B7280' },
  },
  avatars: [
    { bg: '#E3F2FD', text: '#0D47A1' },
    { bg: '#E8F5E9', text: '#1B5E20' },
    { bg: '#EDE7F6', text: '#4A148C' },
    { bg: '#FFF3E0', text: '#E65100' },
    { bg: '#FFEBEE', text: '#B71C1C' },
    { bg: '#F3E5F5', text: '#4A148C' },
    { bg: '#E0F2F1', text: '#004D40' },
    { bg: '#E8EAF6', text: '#1A237E' },
  ],
};

// ─── Theme registry ────────────────────────────────────────────────────────────

export const THEMES = [
  {
    key: 'novigrad',
    label: 'UniConnect Light',
    desc: 'Premium white theme',
    swatch: ['#FFFFFF', '#0071E3', '#0D9488'],
    ready: true,
    colors: novigradTheme,
  }
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
  return colors.courses[course] || { bg: 'rgba(0, 113, 227, 0.08)', text: '#0071E3' };
}
