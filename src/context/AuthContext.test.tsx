import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Helper component to consume auth
function TestConsumer() {
  const { user, role, isSuperUser, isCleaner, hasRole, loading, signIn, signOut } = useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'idle'}</div>
      <div data-testid="user">{user ? user.email : 'anonymous'}</div>
      <div data-testid="role">{role ?? 'none'}</div>
      <div data-testid="is-super">{isSuperUser ? 'yes' : 'no'}</div>
      <div data-testid="is-cleaner">{isCleaner ? 'yes' : 'no'}</div>
      <div data-testid="has-owner">{hasRole?.('OWNER') ? 'yes' : 'no'}</div>
      <button
        onClick={() => signIn('test@user.com', 'password123')}
        data-testid="signin-btn"
      >
        Sign In
      </button>
      <button onClick={() => signOut()} data-testid="signout-btn">
        Sign Out
      </button>
    </div>
  );
}

describe('AuthContext and Provider', () => {
  let authStateCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
  const unsubscribeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never);

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation((callback) => {
      authStateCallback = callback;
      return {
        data: {
          subscription: {
            id: 'sub-1',
            callback,
            unsubscribe: unsubscribeMock,
          },
        },
      };
    });
  });

  it('inicia cargando y luego se vuelve inactivo tras obtener la sesión', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
      expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
    });
  });

  it('establece el usuario si getSession devuelve una sesión activa existente', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'existing@admin.com' },
        } as never,
      },
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
      expect(screen.getByTestId('user')).toHaveTextContent('existing@admin.com');
    });
  });

  it('actualiza el usuario ante eventos emitidos por onAuthStateChange', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });

    // Simular evento de login recibido de Supabase
    act(() => {
      authStateCallback?.('SIGNED_IN', {
        user: { id: 'u2', email: 'logged@admin.com' },
      } as never);
    });

    expect(screen.getByTestId('user')).toHaveTextContent('logged@admin.com');

    // Simular evento de logout
    act(() => {
      authStateCallback?.('SIGNED_OUT', null);
    });

    expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
  });

  it('llama a supabase.auth.signInWithPassword con las credenciales correctas', async () => {
    const signInSpy = vi
      .spyOn(supabase.auth, 'signInWithPassword')
      .mockResolvedValue({
        data: { user: { id: 'u1' }, session: { user: { id: 'u1' } } } as never,
        error: null,
      });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });

    screen.getByTestId('signin-btn').click();

    expect(signInSpy).toHaveBeenCalledWith({
      email: 'test@user.com',
      password: 'password123',
    });
  });

  it('llama a supabase.auth.signOut al cerrar sesión', async () => {
    const signOutSpy = vi
      .spyOn(supabase.auth, 'signOut')
      .mockResolvedValue({ error: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });

    screen.getByTestId('signout-btn').click();

    expect(signOutSpy).toHaveBeenCalled();
  });

  it('desuscribe el listener de onAuthStateChange al desmontar', () => {
    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('resuelve correctamente roles específicos y helpers cuando se suministra en metadata', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'u-super',
            email: 'super@admin.com',
            user_metadata: { role: 'SUPER_USER' },
          },
        } as never,
      },
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
      expect(screen.getByTestId('role')).toHaveTextContent('SUPER_USER');
      expect(screen.getByTestId('is-super')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-owner')).toHaveTextContent('yes'); // SUPER_USER tiene acceso a todo
    });
  });

  it('resuelve rol CLEANER y sus helpers adecuadamente', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'u-cleaner',
            email: 'cleaner@staff.com',
            user_metadata: { role: 'CLEANER' },
          },
        } as never,
      },
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
      expect(screen.getByTestId('role')).toHaveTextContent('CLEANER');
      expect(screen.getByTestId('is-cleaner')).toHaveTextContent('yes');
      expect(screen.getByTestId('is-super')).toHaveTextContent('no');
      expect(screen.getByTestId('has-owner')).toHaveTextContent('no');
    });
  });
});

