import { useState, useEffect } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { getThemePreference, setThemePreference, THEME_CHANGE_EVENT, type ThemePreference } from '@/lib/theme';

export function ThemeToggle({
  className = '',
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference());

  useEffect(() => {
    const handleUpdate = () => setTheme(getThemePreference());
    window.addEventListener('storage', handleUpdate);
    window.addEventListener(THEME_CHANGE_EVENT, handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener(THEME_CHANGE_EVENT, handleUpdate);
    };
  }, []);

  const cycleTheme = () => {
    let nextTheme: ThemePreference;
    if (theme === 'system') {
      const isSystemDark =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      nextTheme = isSystemDark ? 'light' : 'dark';
    } else if (theme === 'light') {
      nextTheme = 'dark';
    } else {
      nextTheme = 'system';
    }
    setThemePreference(nextTheme);
    setTheme(nextTheme);
  };

  const getLabel = () => {
    switch (theme) {
      case 'dark':
        return 'Oscuro';
      case 'light':
        return 'Claro';
      default:
        return 'Sistema';
    }
  };

  const getIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      case 'light':
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Laptop className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={`flex items-center justify-center gap-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-800 ${
        showLabel ? 'px-2.5 py-1.5' : 'p-2'
      } ${className}`}
      title={`Tema actual: ${getLabel()}. Haz clic para cambiar.`}
      aria-label={`Tema: ${getLabel()}`}
    >
      {getIcon()}
      {showLabel ? (
        <span>Tema: {getLabel()}</span>
      ) : (
        <span className="sr-only">Tema: {getLabel()}</span>
      )}
    </button>
  );
}
