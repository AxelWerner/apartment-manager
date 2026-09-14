import { describe, it, expect } from 'vitest';
import { cn, formatCurrency } from './utils';

describe('utils', () => {
  describe('cn (className merge)', () => {
    it('merges class names correctly', () => {
      expect(cn('px-2 py-1', 'bg-red-500')).toBe('px-2 py-1 bg-red-500');
    });

    it('handles conditional class names properly', () => {
      const isHidden = false;
      const isActive = true;
      expect(cn('base-class', isHidden && 'hidden', isActive && 'active')).toBe('base-class active');
    });

    it('resolves conflicting Tailwind classes via tailwind-merge', () => {
      // p-4 should overwrite p-2
      expect(cn('p-2', 'p-4')).toBe('p-4');
      // bg-blue-500 should overwrite bg-red-500
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('handles falsy, null, and undefined values cleanly', () => {
      expect(cn('base', null, undefined, false, '', 0 && 'truthy')).toBe('base');
    });
  });

  describe('formatCurrency', () => {
    it('formats amount in Colombian Pesos without decimals by default', () => {
      const result = formatCurrency(500000);
      expect(result).toMatch(/\$?\s?500\.000/);
    });

    it('supports custom currency codes', () => {
      const result = formatCurrency(100, 'USD');
      expect(result).toMatch(/US\$|USD/);
      expect(result).toContain('100');
    });
  });
});
