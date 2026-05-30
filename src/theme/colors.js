// Noir Glass Design System - Color Palette
export const Colors = {
  // Primary Backgrounds
  bg: {
    primary: '#0B0B0F',      // Deepest black
    secondary: '#131318',    // Card backgrounds
    tertiary: '#1C1C24',     // Elevated surfaces
    elevated: '#22222E',     // Modals, sheets
  },

  // Brand Colors
  brand: {
    indigo: '#7C6EF7',       // Electric Indigo - primary CTA
    indigoLight: '#9B8FF9',  // Lighter indigo
    indigoDark: '#5C4FD6',   // Pressed state
    teal: '#00D2B4',         // Mint Teal - accents
    tealLight: '#33DBC3',    
    tealDark: '#00A896',
  },

  // Semantic Colors
  semantic: {
    success: '#32D74B',      // Delivered/online
    error: '#FF453A',        // Errors/delete
    warning: '#FFD60A',      // Caution
    info: '#0A84FF',         // Info
  },

  // Text Colors
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0B0',
    tertiary: '#666680',
    placeholder: '#4A4A60',
    inverse: '#0B0B0F',
  },

  // Glass & Border
  glass: {
    surface: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Message Bubbles
  bubble: {
    sent: '#7C6EF7',          // Sender bubble
    sentDark: '#5C4FD6',      // Gradient end
    received: '#1C1C24',      // Receiver bubble
    receivedBorder: 'rgba(255,255,255,0.06)',
  },

  // Status Indicators
  status: {
    online: '#32D74B',
    offline: '#666680',
    typing: '#7C6EF7',
    away: '#FFD60A',
  },

  // Tab Bar
  tab: {
    active: '#7C6EF7',
    inactive: '#4A4A60',
    background: '#0F0F15',
    border: 'rgba(255,255,255,0.06)',
  },

  // Misc
  divider: 'rgba(255, 255, 255, 0.06)',
  shadow: '#000000',
  transparent: 'transparent',
};

export default Colors;
