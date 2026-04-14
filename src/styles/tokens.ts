export const tokens = {
  // Shared spacing scale
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
  },
  // Shared typography
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    md: '15px',
    lg: '17px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  // Shared border radius
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  // Shared shadows
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 2px 8px rgba(0,0,0,0.1)',
    lg: '0 4px 16px rgba(0,0,0,0.12)',
  },
  // Role accent palettes
  accents: {
    member: {
      primary: '#F97316',
      primaryLight: '#FFF7ED',
      primaryDark: '#C2410C',
      secondary: '#FB923C',
      gradient: 'linear-gradient(135deg, #F97316, #FB923C)',
    },
    admin: {
      primary: '#185FA5',
      primaryLight: '#EFF6FF',
      primaryDark: '#0C3D6E',
      secondary: '#3B82F6',
      gradient: 'linear-gradient(135deg, #185FA5, #3B82F6)',
    },
    superAdmin: {
      primary: '#1a2744',
      primaryLight: '#F0F2F8',
      primaryDark: '#0D1529',
      secondary: '#3B4A6B',
      gradient: 'linear-gradient(135deg, #1a2744, #3B4A6B)',
    },
  },
} as const;

export type Accent = typeof tokens.accents.member;
export type RoleKey = keyof typeof tokens.accents;
