import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import * as UseAuthModule from '@/hooks/use-auth';

describe('Login Process', () => {
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza correctamente el formulario y sus elementos iniciales', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('Apto Manager')).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar al panel/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('admin@ejemplo.com')).toBeInTheDocument();
  });

  it('muestra mensaje de error si se intenta enviar el formulario con campos vacíos', async () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.submit(screen.getByRole('button', { name: /ingresar al panel/i }));

    expect(
      await screen.findByText('Por favor ingresa tu correo y contraseña.')
    ).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('muestra mensaje de error cuando las credenciales son inválidas', async () => {
    mockSignIn.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: '  wrong@example.com  ' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'badpassword' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ingresar al panel/i }));

    await waitFor(() => {
      // Verifica que haya hecho trim en el email
      expect(mockSignIn).toHaveBeenCalledWith('wrong@example.com', 'badpassword');
      expect(
        screen.getByText('Credenciales inválidas. Verifica tu correo y contraseña.')
      ).toBeInTheDocument();
    });
  });

  it('muestra otros errores de Supabase tal como los reporta el servicio', async () => {
    mockSignIn.mockResolvedValue({
      error: { message: 'Email not confirmed' },
    });

    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'unconfirmed@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ingresar al panel/i }));

    await waitFor(() => {
      expect(screen.getByText('Email not confirmed')).toBeInTheDocument();
    });
  });

  it('muestra error genérico si ocurre una excepción inesperada en el signIn', async () => {
    mockSignIn.mockRejectedValue(new Error('Network crash'));

    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'crash@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ingresar al panel/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Ocurrió un error inesperado al iniciar sesión.')
      ).toBeInTheDocument();
    });
  });

  it('muestra estado de carga y deshabilita el botón durante el envío', async () => {
    let resolveLogin: (value: { error: null }) => void;
    const loginPromise = new Promise<{ error: null }>((resolve) => {
      resolveLogin = resolve;
    });

    mockSignIn.mockReturnValue(loginPromise);

    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ingresar al panel/i }));

    // El botón debe mostrar "Ingresando..." y estar deshabilitado
    expect(screen.getByText('Ingresando...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();

    // Finalizamos la llamada
    resolveLogin!({ error: null });

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('user@example.com', 'password123');
    });
  });

  it('navega a la ruta de origen previa al iniciar sesión correctamente', async () => {
    mockSignIn.mockResolvedValue({ error: null });

    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { from: { pathname: '/bookings' } } },
        ]}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/bookings" element={<div>Página de Reservas</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'admin@host.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'secretpass' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ingresar al panel/i }));

    await waitFor(() => {
      expect(screen.getByText('Página de Reservas')).toBeInTheDocument();
    });
  });

  it('redirige automáticamente al usuario si ya tiene una sesión activa', () => {
    vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@host.com' } as never,
      session: { user: { id: 'admin-1' } } as never,
      loading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard Principal</div>} />
        </Routes>
      </MemoryRouter>
    );

    // No debe renderizar el formulario, sino redirigir a "/"
    expect(screen.queryByText(/ingresar al panel/i)).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Principal')).toBeInTheDocument();
  });
});
