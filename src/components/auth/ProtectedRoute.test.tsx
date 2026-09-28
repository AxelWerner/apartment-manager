import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as UseAuthModule from '@/hooks/use-auth';

describe('ProtectedRoute', () => {
  it('muestra estado de carga mientras verifica la sesión', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Privado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Verificando acceso...')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Privado')).not.toBeInTheDocument();
  });

  it('redirige a /login cuando no hay usuario autenticado', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Página de Login</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Privado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Página de Login')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Privado')).not.toBeInTheDocument();
  });

  it('renderiza la ruta hija cuando el usuario está autenticado', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'test-user', email: 'admin@test.com' } as never,
      session: { user: { id: 'test-user' } } as never,
      profile: null,
      role: 'ADMINISTRATOR',
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      isSuperUser: false,
      isAdmin: true,
      isOwner: false,
      isCleaner: false,
      isViewer: false,
      hasRole: (roles) => (Array.isArray(roles) ? roles.includes('ADMINISTRATOR') : roles === 'ADMINISTRATOR'),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Privado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Privado')).toBeInTheDocument();
  });

  it('muestra pantalla de no autorizado cuando el rol del usuario no está permitido', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'cleaner-user', email: 'cleaner@test.com' } as never,
      session: { user: { id: 'cleaner-user' } } as never,
      profile: null,
      role: 'CLEANER',
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      isSuperUser: false,
      isAdmin: false,
      isOwner: false,
      isCleaner: true,
      isViewer: false,
      hasRole: (roles) => (Array.isArray(roles) ? roles.includes('CLEANER') : roles === 'CLEANER'),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/expenses']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['SUPER_USER', 'ADMINISTRATOR', 'OWNER']} />}>
            <Route path="/expenses" element={<div>Módulo de Gastos</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Acceso no autorizado')).toBeInTheDocument();
    expect(screen.queryByText('Módulo de Gastos')).not.toBeInTheDocument();
    expect(screen.getByText(/CLEANER/)).toBeInTheDocument();
  });

  it('permite acceso si el usuario es SUPER_USER aunque la ruta liste roles específicos', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'super-user', email: 'super@test.com' } as never,
      session: { user: { id: 'super-user' } } as never,
      profile: null,
      role: 'SUPER_USER',
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      isSuperUser: true,
      isAdmin: true,
      isOwner: false,
      isCleaner: false,
      isViewer: false,
      hasRole: () => true,
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/expenses']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['OWNER']} />}>
            <Route path="/expenses" element={<div>Módulo de Gastos</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Módulo de Gastos')).toBeInTheDocument();
  });
});

