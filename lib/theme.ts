// Shared design tokens for the "Nike Golf x Private Members Club" rebrand.
// Every screen should pull colors/fonts/spacing from here instead of
// redefining its own hex constants.

export const colors = {
  bg: '#090909',
  bgSecondary: '#151515',
  emerald: '#12352C',
  emeraldLight: '#1d5345',
  gold: '#C6A267',
  offWhite: '#F5F4F0',
  gray: '#8B8B8B',
  danger: '#c62828',
  epicPurple: '#8B6FD6',

  // Derived low-opacity tokens for glass cards, borders, dividers.
  glassBg: 'rgba(245, 244, 240, 0.04)',
  glassBorder: 'rgba(245, 244, 240, 0.08)',
  hairline: 'rgba(245, 244, 240, 0.08)',
  inputBg: 'rgba(245, 244, 240, 0.05)',
  inputBorder: 'rgba(245, 244, 240, 0.15)',
};

export const fonts = {
  heading: 'CormorantGaramond_600SemiBold',
  headingMedium: 'CormorantGaramond_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const shadow = {
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  goldGlow: {
    shadowColor: colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
};

export const rarityColors = {
  common: colors.gray,
  rare: colors.emeraldLight,
  epic: colors.epicPurple,
  legendary: colors.gold,
  mythic: colors.gold,
};

export const rarityGlow = {
  common: undefined,
  rare: undefined,
  epic: {
    shadowColor: colors.epicPurple,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  legendary: shadow.goldGlow,
  mythic: {
    shadowColor: colors.gold,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
};

export const glassCard = {
  backgroundColor: colors.glassBg,
  borderWidth: 1,
  borderColor: colors.glassBorder,
  borderRadius: radius.lg,
  ...shadow.soft,
};

export const typography = {
  h1: { fontFamily: fonts.heading, fontSize: 28, color: colors.offWhite },
  h2: { fontFamily: fonts.heading, fontSize: 22, color: colors.offWhite },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.offWhite },
  bodyMuted: { fontFamily: fonts.body, fontSize: 14, color: colors.gray },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.gray,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  statNumber: { fontFamily: fonts.bodySemiBold, fontSize: 24, color: colors.gold },
};
