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
      loading: false,
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

    expect(screen.getByText('Dashboard Privado')).toBeInTheDocument();
  });
});
