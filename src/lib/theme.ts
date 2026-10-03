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

export function applyTheme(preference: ThemePreference = getThemePreference()) {
  if (typeof window === 'undefined') return;

  const isDark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const root = document.documentElement;

  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
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
    }
  };

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}
