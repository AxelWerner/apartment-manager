import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useAuth } from './use-auth';
import { AuthContext, type AuthContextType } from '@/context/auth-context-def';
import type { User } from '@supabase/supabase-js';

describe('useAuth hook', () => {
  it('throws an error when used outside of an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
  });

  it('returns auth context value when used within AuthContext.Provider', () => {
    const mockContextValue: AuthContextType = {
      user: { id: 'u-123', email: 'user@example.com' } as unknown as User,
      session: null,
      profile: null,
      role: 'OWNER',
      loading: false,
      signIn: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
      isOwner: true,
      isAdmin: true,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={mockContextValue}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toEqual(mockContextValue);
    expect(result.current.user?.id).toBe('u-123');
    expect(result.current.role).toBe('OWNER');
  });
});
