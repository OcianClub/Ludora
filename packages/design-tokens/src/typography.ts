export const typography = {
  fontFamily: {
    // Oswald: Pesos 500, 600, 700
    titulo: {
      medium: 'Oswald_500Medium',
      semiBold: 'Oswald_600SemiBold',
      bold: 'Oswald_700Bold',
    },
    // Inter: Pesos 400, 500, 600
    corpo: {
      regular: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semiBold: 'Inter_600SemiBold',
    }
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lmd: 18,
    lg: 20,
    llg: 22,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  }
} as const;