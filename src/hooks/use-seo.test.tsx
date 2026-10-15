import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSEO } from './use-seo';

describe('useSEO hook', () => {
  const initialTitle = 'Original Title';

  beforeEach(() => {
    document.title = initialTitle;
    // Clean up existing meta tags
    document.head.querySelectorAll('meta[name="description"], meta[property="og:description"]').forEach((el) => el.remove());
  });

  afterEach(() => {
    document.title = initialTitle;
  });

  it('updates document title with AptOS suffix when not present', () => {
    const { unmount } = renderHook(() =>
      useSEO({ title: 'Dashboard' })
    );

    expect(document.title).toBe('Dashboard — AptOS');

    unmount();
    expect(document.title).toBe(initialTitle);
  });

  it('preserves title as-is if it already contains AptOS', () => {
    renderHook(() =>
      useSEO({ title: 'AptOS — Configuración' })
    );

    expect(document.title).toBe('AptOS — Configuración');
  });

  it('updates meta description and og:description if present in document', () => {
    const metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    metaDesc.setAttribute('content', 'Old description');
    document.head.appendChild(metaDesc);

    const ogDesc = document.createElement('meta');
    ogDesc.setAttribute('property', 'og:description');
    ogDesc.setAttribute('content', 'Old OG description');
    document.head.appendChild(ogDesc);

    renderHook(() =>
      useSEO({
        title: 'Gastos',
        description: 'Gestión de gastos e ingresos',
      })
    );

    expect(metaDesc.getAttribute('content')).toBe('Gestión de gastos e ingresos');
    expect(ogDesc.getAttribute('content')).toBe('Gestión de gastos e ingresos');
  });

  it('safely handles missing meta tags and missing parameters', () => {
    // Should not throw even if no meta tags exist
    expect(() => {
      renderHook(() => useSEO({}));
    }).not.toThrow();

    expect(document.title).toBe(initialTitle);
  });
});
