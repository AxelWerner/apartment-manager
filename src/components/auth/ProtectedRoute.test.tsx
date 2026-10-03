import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as UseAuthModule from '@/hooks/use-auth';
import * as PropertyContextModule from '@/context/PropertyContext';

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

  it('permite acceso si el usuario es VIEWER global pero OWNER en el PropertyContext', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'regular-user', email: 'user@test.com' } as never,
      session: { user: { id: 'regular-user' } } as never,
      profile: null,
      role: 'VIEWER',
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      isSuperUser: false,
      isAdmin: false,
      isOwner: false,
      isCleaner: false,
      isViewer: true,
      hasRole: (roles) => (Array.isArray(roles) ? roles.includes('VIEWER') : roles === 'VIEWER'),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(PropertyContextModule, 'usePropertyContext').mockReturnValue({
      properties: [],
      activeProperty: { id: 'prop-1', name: 'Mi Apto' } as never,
      activePropertyId: 'prop-1',
      role: 'OWNER',
      isOwner: true,
      isAdmin: true,
      isCleaner: false,
      isViewer: false,
      isLoading: false,
      createProperty: vi.fn(),
      updateProperty: vi.fn(),
      switchProperty: vi.fn(),
      refreshProperties: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/p/prop-1/expenses']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['SUPER_USER', 'ADMINISTRATOR', 'OWNER']} />}>
            <Route path="/p/prop-1/expenses" element={<div>Módulo de Gastos y Servicios</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Módulo de Gastos y Servicios')).toBeInTheDocument();
  });

  it('muestra carga mientras PropertyContext está cargando', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'regular-user', email: 'user@test.com' } as never,
      session: { user: { id: 'regular-user' } } as never,
      profile: null,
      role: 'VIEWER',
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      isSuperUser: false,
      isAdmin: false,
      isOwner: false,
      isCleaner: false,
      isViewer: true,
      hasRole: (roles) => (Array.isArray(roles) ? roles.includes('VIEWER') : roles === 'VIEWER'),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(PropertyContextModule, 'usePropertyContext').mockReturnValue({
      properties: [],
      activeProperty: null,
      activePropertyId: '',
      role: 'VIEWER',
      isOwner: false,
      isAdmin: false,
      isCleaner: false,
      isViewer: true,
      isLoading: true,
      createProperty: vi.fn(),
      updateProperty: vi.fn(),
      switchProperty: vi.fn(),
      refreshProperties: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/p/prop-1/settings']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['SUPER_USER', 'ADMINISTRATOR', 'OWNER']} />}>
            <Route path="/p/prop-1/settings" element={<div>Configuración</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Verificando acceso...')).toBeInTheDocument();
    expect(screen.queryByText('Configuración')).not.toBeInTheDocument();
  });
});

