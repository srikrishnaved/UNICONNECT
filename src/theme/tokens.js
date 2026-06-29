export const colors = {
  // Backgrounds
  bg: '#0D0D0D',
  card: '#1A1A1A',
  cardAlt: '#222222',
  border: '#2A2A2A',

  // Student accent (indigo/purple)
  student: {
    primary: '#7C5CFC',
    primaryLight: '#9D84FD',
    primaryDim: '#7C5CFC22',
    urgency: '#E8702A',
    urgencyDim: '#E8702A22',
  },

  // Faculty accent (teal)
  faculty: {
    primary: '#0D9488',
    primaryLight: '#14B8AA',
    primaryDim: '#0D948822',
    live: '#0D9488',
  },

  // Shared semantic colors
  success: '#22C55E',
  successDim: '#22C55E22',
  warning: '#F59E0B',
  warningDim: '#F59E0B22',
  error: '#EF4444',
  errorDim: '#EF444422',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textTertiary: '#555555',
  textAccentStudent: '#7C5CFC',
  textAccentFaculty: '#0D9488',
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

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const presets = {
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 16,
  },
  screenPadding: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
};
