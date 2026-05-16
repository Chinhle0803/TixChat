import { useColorScheme } from 'react-native'
import { useMemo } from 'react'
import { useUiStore } from '../stores/uiStore'

export const palette = {
  light: {
    background: '#F4F8FB',
    foreground: '#18181B',
    card: '#FFFFFE',
    popover: '#FFFFFF',
    surfaceTint: '#FBFDFF',
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',
    secondary: '#E7F7F2',
    secondaryForeground: '#0F5F55',
    accent: '#EAF2FF',
    accentForeground: '#1D4ED8',
    muted: '#EEF4F8',
    mutedForeground: '#71717A',
    success: '#16A34A',
    successSoft: '#E8F8EE',
    warning: '#F59E0B',
    warningSoft: '#FFF7DF',
    danger: '#DC2626',
    dangerSoft: '#FFF1F2',
    info: '#0EA5E9',
    infoSoft: '#E8F6FF',
    border: '#E4E4E7',
    input: '#E4E4E7',
    ring: '#93C5FD',
    sidebar: '#FBFDFF',
    sidebarForeground: '#27272A',
    sidebarAccent: '#EAF2FF',
    neutral900: '#18181B',
    neutral700: '#3F3F46',
    neutral500: '#71717A',
    neutral300: '#D4D4D8',
    neutral100: '#EEF4F8',
  },
  dark: {
    background: '#0B1020',
    foreground: '#FAFAFA',
    card: '#151A2A',
    popover: '#18181B',
    surfaceTint: '#111827',
    primary: '#60A5FA',
    primaryForeground: '#0F172A',
    secondary: '#12332F',
    secondaryForeground: '#CCFBF1',
    accent: '#172554',
    accentForeground: '#DBEAFE',
    muted: '#20283A',
    mutedForeground: '#A1A1AA',
    success: '#4ADE80',
    successSoft: '#052E16',
    warning: '#FBBF24',
    warningSoft: '#451A03',
    danger: '#F87171',
    dangerSoft: '#450A0A',
    info: '#38BDF8',
    infoSoft: '#0C4A6E',
    border: '#27272A',
    input: '#27272A',
    ring: '#60A5FA',
    sidebar: '#111827',
    sidebarForeground: '#FAFAFA',
    sidebarAccent: '#172554',
    neutral900: '#FAFAFA',
    neutral700: '#E4E4E7',
    neutral500: '#A1A1AA',
    neutral300: '#3F3F46',
    neutral100: '#20283A',
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
  '3xl': 30,
}

const shadowPresets = {
  light: {
    sm: {
      shadowColor: '#000000',
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
  },
  dark: {
    sm: {
      shadowColor: '#000000',
      shadowOpacity: 0.28,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    md: {
      shadowColor: '#000000',
      shadowOpacity: 0.32,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOpacity: 0.38,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 14 },
      elevation: 8,
    },
  },
}

export const resolveThemePreference = (preference, systemScheme) => {
  const normalizedPreference = String(preference || 'system').toLowerCase()
  if (normalizedPreference === 'light' || normalizedPreference === 'dark') {
    return normalizedPreference
  }
  return systemScheme === 'dark' ? 'dark' : 'light'
}

export const buildTheme = (mode = 'light') => {
  const colors = mode === 'dark' ? palette.dark : palette.light
  return {
    mode,
    isDark: mode === 'dark',
    colors: {
      ...colors,
      surface: colors.card,
      surfaceElevated: colors.popover,
      primarySoft: colors.accent,
    },
    spacing,
    radius,
    type,
    shadows: shadowPresets[mode === 'dark' ? 'dark' : 'light'],
  }
}

export const useAppTheme = () => {
  const themePreference = useUiStore((state) => state.themePreference)
  const systemScheme = useColorScheme()

  return useMemo(() => {
    const mode = resolveThemePreference(themePreference, systemScheme)
    return buildTheme(mode)
  }, [systemScheme, themePreference])
}

export const theme = buildTheme('light')

export default theme
