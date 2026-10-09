import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';
import { setThemePreference } from '@/lib/theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    vi.restoreAllMocks();
  });

  it('renders with initial system preference', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Tema: Sistema')).toBeInTheDocument();
  });

  it('cycles through themes on click', () => {
    // Mock system preference as dark
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

    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    // Initial state is system (which is dark)
    expect(screen.getByText('Tema: Sistema')).toBeInTheDocument();

    // First click switches to light (since system is dark)
    fireEvent.click(button);
    expect(screen.getByText('Tema: Claro')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('light')).toBe(true);

    // Second click switches to dark
    fireEvent.click(button);
    expect(screen.getByText('Tema: Oscuro')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Third click returns to system
    fireEvent.click(button);
    expect(screen.getByText('Tema: Sistema')).toBeInTheDocument();
  });

  it('syncs across multiple instances via THEME_CHANGE_EVENT', () => {
    render(
      <div>
        <div data-testid="container-1">
          <ThemeToggle />
        </div>
        <div data-testid="container-2">
          <ThemeToggle />
        </div>
      </div>
    );

    expect(screen.getAllByText('Tema: Sistema')).toHaveLength(2);

    // Trigger theme preference change programmatically
    act(() => {
      setThemePreference('dark');
    });

    expect(screen.getAllByText('Tema: Oscuro')).toHaveLength(2);
  });
});
