export type ThemeId = 'classic' | 'blood' | 'frost' | 'nephalem' | 'ember';

export const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'classic', label: 'Classic Gold', hint: 'Default Diablo gold' },
  { id: 'blood', label: 'Blood', hint: 'Red / crimson accents' },
  { id: 'frost', label: 'Frost', hint: 'Cool blue' },
  { id: 'nephalem', label: 'Nephalem', hint: 'Purple arcane' },
  { id: 'ember', label: 'Ember', hint: 'Orange fire' },
];

const KEY = 'd3_theme';

export function getStoredTheme(): ThemeId {
  try {
    const t = localStorage.getItem(KEY) as ThemeId | null;
    if (t && THEMES.some(x => x.id === t)) return t;
  } catch { /* ignore */ }
  return 'classic';
}

export function applyTheme(id: ThemeId): void {
  try {
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem(KEY, id);
  } catch { /* ignore */ }
}

export function initTheme(): ThemeId {
  const id = getStoredTheme();
  applyTheme(id);
  return id;
}
