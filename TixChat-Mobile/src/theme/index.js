export const palette = {
  light: {
    primary: '#2563EB',
    primarySoft: '#EEF2FF',
    secondary: '#F4F4F5',
    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#DC2626',
    info: '#0EA5E9',
    neutral900: '#18181B',
    neutral700: '#3F3F46',
    neutral500: '#71717A',
    neutral300: '#D4D4D8',
    neutral100: '#F4F4F5',
    background: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E4E4E7',
  },
  dark: {
    primary: '#60A5FA',
    primarySoft: '#1E293B',
    secondary: '#27272A',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#38BDF8',
    neutral900: '#FAFAFA',
    neutral700: '#E4E4E7',
    neutral500: '#A1A1AA',
    neutral300: '#3F3F46',
    neutral100: '#27272A',
    background: '#09090B',
    surface: '#18181B',
    surfaceElevated: '#18181B',
    border: '#27272A',
  },
}

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
}

export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
}

export const type = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
}

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
}

export const theme = {
  colors: palette.light,
  darkColors: palette.dark,
  spacing,
  radius,
  type,
  shadows,
}

export default theme
