/**
 * Patanos brand system — "Electric Mango" dark theme
 * Design tokens from SKILLS/patanos-brand-system/references/design-tokens.md
 */

export const Colors = {
  // Keep light for compatibility, but app defaults to dark
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#F5C518',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#F5C518',
  },
  dark: {
    // Backgrounds (darkest → lightest)
    bgPrimary: '#0A0A0A',
    bgSecondary: '#141414',
    bgSurface: '#1E1E1E',
    bgElevated: '#252525',

    // Gold accents
    accentGold: '#F5C518',
    accentGoldDark: '#D4A812',
    accentGoldSoft: 'rgba(245, 197, 24, 0.15)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textMuted: '#666666',
    textOnGold: '#0A0A0A',

    // Borders
    borderSubtle: '#2A2A2A',
    borderGold: 'rgba(245, 197, 24, 0.3)',

    // Semantic
    success: '#4CAF50',
    warning: '#F5C518',
    error: '#E53935',
    info: '#42A5F5',

    // Navigation compat (used by existing components)
    text: '#FFFFFF',
    background: '#0A0A0A',
    tint: '#F5C518',
    icon: '#A0A0A0',
    tabIconDefault: '#666666',
    tabIconSelected: '#F5C518',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
