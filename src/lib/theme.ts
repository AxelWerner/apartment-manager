/**
 * System Theme Manager
 * Automatically tracks and applies the operating system's color scheme (light/dark).
 */

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'app_theme_preference';

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export const THEME_CHANGE_EVENT = 'app_theme_preference_changed';

export function applyTheme(preference: ThemePreference = getThemePreference()) {
  if (typeof window === 'undefined') return;

  const isDark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const root = document.documentElement;

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }
}

export function setThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') return;
  if (preference === 'system') {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
  applyTheme(preference);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: preference }));
}

/**
 * Initializes listeners for system theme changes.
 */
export function initThemeListener() {
  if (typeof window === 'undefined') return () => {};

  applyTheme();

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    if (getThemePreference() === 'system') {
      applyTheme('system');
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: 'system' }));
    }
  };

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}
