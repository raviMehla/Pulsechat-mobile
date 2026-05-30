// Typography Design Tokens
export const Typography = {
  // Font Families
  fonts: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
    mono: 'Courier',
  },

  // Font Sizes
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
  },

  // Font Weights
  weight: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
    extraBold: '800',
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },

  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
  },

  // Predefined Text Styles
  styles: {
    // Headers
    h1: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
    h2: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
    h3: { fontSize: 24, fontWeight: '600', letterSpacing: -0.2 },
    h4: { fontSize: 20, fontWeight: '600' },
    h5: { fontSize: 18, fontWeight: '600' },
    h6: { fontSize: 16, fontWeight: '600' },

    // Body
    bodyLg: { fontSize: 17, fontWeight: '400', lineHeight: 26 },
    body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
    bodySm: { fontSize: 13, fontWeight: '400', lineHeight: 20 },

    // Labels
    labelLg: { fontSize: 15, fontWeight: '600' },
    label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
    labelSm: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },

    // Caption
    caption: { fontSize: 12, fontWeight: '400' },
    captionMd: { fontSize: 11, fontWeight: '500' },
  },
};

export default Typography;
