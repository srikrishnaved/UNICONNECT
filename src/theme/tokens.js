import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const colors = {
  // Backgrounds — light theme
  bg: '#FFFFFF',
  background: '#FFFFFF',
  card: '#F5F5F7',
  cardAlt: '#EFEFEF',
  surface: '#F5F5F7',
  surfaceRaised: '#EFEFEF',

  // Borders
  borderSubtle: 'rgba(0,0,0,0.03)',
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.15)',

  // Single accent (terracotta)
  accent: isWeb ? 'var(--color-accent, #c9622e)' : '#c9622e',
  accentHover: isWeb ? 'var(--color-accent-hover, #d97840)' : '#d97840',
  accentActive: isWeb ? 'var(--color-accent-active, #b0551f)' : '#b0551f',
  accentDim: isWeb ? 'var(--color-accent-dim, rgba(201,98,46,0.1))' : 'rgba(201,98,46,0.1)',

  // Kept for backward-compat: student and faculty both point to terracotta
  primary: isWeb ? 'var(--color-accent, #c9622e)' : '#c9622e',
  student: {
    primary: isWeb ? 'var(--color-accent, #c9622e)' : '#c9622e',
    primaryLight: isWeb ? 'var(--color-accent-hover, #d97840)' : '#d97840',
    primaryDim: isWeb ? 'var(--color-accent-dim, rgba(201,98,46,0.1))' : 'rgba(201,98,46,0.1)',
    urgency: isWeb ? 'var(--color-accent, #c9622e)' : '#c9622e',
    urgencyDim: isWeb ? 'var(--color-accent-dim, rgba(201,98,46,0.1))' : 'rgba(201,98,46,0.1)',
  },
  faculty: {
    primary: isWeb ? 'var(--color-accent, #c9622e)' : '#c9622e',
    primaryLight: isWeb ? 'var(--color-accent-hover, #d97840)' : '#d97840',
    primaryDim: isWeb ? 'var(--color-accent-dim, rgba(201,98,46,0.1))' : 'rgba(201,98,46,0.1)',
    live: isWeb ? 'var(--color-accent, #c9622e)' : '#c9622e',
  },

  // Status
  success: '#10B981',
  successDim: 'rgba(16,185,129,0.1)',
  warning: '#D97706',
  warningDim: 'rgba(217,119,6,0.1)',
  error: '#EF4444',
  errorDim: 'rgba(239,68,68,0.1)',
  info: '#3B82F6',
  infoDim: 'rgba(59,130,246,0.1)',

  // Typography
  textPrimary: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#86868B',
  textAccentStudent: isWeb ? 'var(--color-accent, #c9622e)' : '#c9622e',
  textAccentFaculty: isWeb ? 'var(--color-accent, #c9622e)' : '#c9622e',
};

export const typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 34,

  // Font weights (as strings for RN)
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',

  // Font families
  // Body: system default (Inter/SF Pro/Roboto)
  // Headings/display: Fraunces (serif) — load via expo-font
  // Numeric/code data: IBM Plex Mono — load via expo-font
  fontBody: undefined,            // system default
  fontHeading: 'Fraunces',
  fontMono: 'IBMPlexMono',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Sharp radius system — 2-4px for UI chrome, full only for pills/chips
export const radius = {
  xs: 2,
  sm: 3,
  md: 4,
  lg: 4,
  xl: 4,
  full: 999,    // pills, tags, badges only
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
};

export const presets = {
  card: {
    backgroundColor: '#F5F5F7',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 16,
  },
  screenPadding: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Pill/chip shape kept fully rounded
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
};
