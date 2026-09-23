'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { MoonIcon, SunIcon, SystemIcon } from './icons';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'alma-theme';
const ORDER: ThemePreference[] = ['light', 'dark', 'system'];

const CONFIG: Record<ThemePreference, { label: string; next: string; icon: ComponentType }> = {
  light: { label: 'Tema: claro', next: 'Cambiar a oscuro', icon: SunIcon },
  dark: { label: 'Tema: oscuro', next: 'Cambiar a automático', icon: MoonIcon },
  system: { label: 'Tema: automático', next: 'Cambiar a claro', icon: SystemIcon },
};

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function ThemeToggle() {
  // null = "haven't read localStorage yet" (avoids a hydration mismatch,
  // since the server always renders the 'system' fallback below). Kept
  // distinct from 'system' so the effect below never re-applies/overwrites
  // the stored preference with a stale default before it's actually read.
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    setPreference(readStoredPreference());
  }, []);

  useEffect(() => {
    if (preference === null) {
      return;
    }
    document.documentElement.setAttribute('data-theme', resolveTheme(preference));
    localStorage.setItem(THEME_STORAGE_KEY, preference);

    if (preference !== 'system') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => document.documentElement.setAttribute('data-theme', resolveTheme('system'));
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preference]);

  function handleClick() {
    const currentIndex = ORDER.indexOf(preference ?? 'system');
    setPreference(ORDER[(currentIndex + 1) % ORDER.length]);
  }

  const current = CONFIG[preference ?? 'system'];

  return (
    <button
      type="button"
      className="app-nav__item theme-toggle"
      onClick={handleClick}
      aria-label={`${current.label}. ${current.next}.`}
      title={`${current.label}. ${current.next}.`}
    >
      <current.icon />
      <span>{current.label}</span>
    </button>
  );
}
