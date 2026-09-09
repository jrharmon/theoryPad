/** The primary navigation, in header order. Routes are declared from this list. */
export const NAV_ITEMS = [
  { to: '/home', label: 'Home' },
  { to: '/exercises', label: 'Exercises' },
  { to: '/fretboard', label: 'Fretboard' },
  { to: '/report', label: 'Report' },
  { to: '/settings', label: 'Settings' },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
