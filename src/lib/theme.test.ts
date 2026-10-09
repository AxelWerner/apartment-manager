import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getThemePreference, applyTheme, initThemeListener, setThemePreference, THEME_CHANGE_EVENT } from './theme';

describe('theme system synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    vi.restoreAllMocks();
  });

  it('defaults to system preference when nothing stored', () => {
    expect(getThemePreference()).toBe('system');
  });

  it('applies dark theme when media query matches dark', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    applyTheme('system');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('applies light theme when media query matches light', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    applyTheme('system');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('listens for system theme change events', () => {
    let changeHandler: ((e: { matches: boolean }) => void) | null = null;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, handler: unknown) => {
        if (event === 'change') changeHandler = handler as (e: { matches: boolean }) => void;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    initThemeListener();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Simulate system changing to dark mode
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    if (changeHandler) {
      (changeHandler as (e: { matches: boolean }) => void)({ matches: true });
    }

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('explicitly applies dark theme and removes light class', () => {
    document.documentElement.classList.add('light');
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('explicitly applies light theme and removes dark class', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('dispatches THEME_CHANGE_EVENT when setThemePreference is called', () => {
    const listener = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, listener);

    setThemePreference('dark');
    expect(listener).toHaveBeenCalled();
    expect(localStorage.getItem('app_theme_preference')).toBe('dark');

    setThemePreference('system');
    expect(localStorage.getItem('app_theme_preference')).toBeNull();
  });
});
