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

    expect(screen.getByText('AptOS')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /ingresando/i })).toBeDisabled();

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

  describe('Sign Up Process', () => {
    const mockSignUp = vi.fn();

    beforeEach(() => {
      mockSignUp.mockReset();
    });

    it('permite cambiar a la pestaña de crear cuenta y muestra los campos correspondientes', () => {
      vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: mockSignIn,
        signUp: mockSignUp,
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('tab', { name: /crear cuenta/i }));

      expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^contraseña/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /crear mi cuenta/i })).toBeInTheDocument();
    });

    it('valida que las contraseñas coincidan y tengan al menos 6 caracteres', async () => {
      vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: mockSignIn,
        signUp: mockSignUp,
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('tab', { name: /crear cuenta/i }));

      fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Carlos Ruiz' } });
      fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'carlos@test.com' } });
      fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: '123' } });
      fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: '123' } });

      fireEvent.click(screen.getByRole('button', { name: /crear mi cuenta/i }));

      expect(await screen.findByText('La contraseña debe tener al menos 6 caracteres.')).toBeInTheDocument();

      // Probar contraseñas diferentes
      fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'different123' } });
      fireEvent.click(screen.getByRole('button', { name: /crear mi cuenta/i }));

      expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('registra exitosamente al usuario e inicia sesión si devuelve session activa', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
        error: null,
      });

      vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: mockSignIn,
        signUp: mockSignUp,
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

      fireEvent.click(screen.getByRole('tab', { name: /crear cuenta/i }));

      fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Laura Gómez' } });
      fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'laura@test.com' } });
      fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: 'securepass123' } });
      fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'securepass123' } });

      fireEvent.click(screen.getByRole('button', { name: /crear mi cuenta/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith('laura@test.com', 'securepass123', 'Laura Gómez');
        expect(screen.getByText('Dashboard Principal')).toBeInTheDocument();
      });
    });

    it('muestra pantalla de verificación de correo cuando el registro requiere confirmación y permite reenviarlo', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'u2', email: 'carlos@test.com' }, session: null },
        error: null,
      });
      const mockResend = vi.fn().mockResolvedValue({ error: null });

      vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: mockSignIn,
        signUp: mockSignUp,
        resendConfirmationEmail: mockResend,
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('tab', { name: /crear cuenta/i }));

      fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Carlos Ruiz' } });
      fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'carlos@test.com' } });
      fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: 'securepass123' } });
      fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'securepass123' } });

      fireEvent.click(screen.getByRole('button', { name: /crear mi cuenta/i }));

      await waitFor(() => {
        expect(screen.getByText(/verifica tu correo electrónico/i)).toBeInTheDocument();
        expect(screen.getByText('carlos@test.com')).toBeInTheDocument();
      });

      // Probar reenvío
      fireEvent.click(screen.getByRole('button', { name: /reenviar confirmación/i }));
      await waitFor(() => {
        expect(mockResend).toHaveBeenCalledWith('carlos@test.com');
        expect(screen.getByText(/correo de verificación reenviado/i)).toBeInTheDocument();
      });
    });

    it('permite reenviar el correo de confirmación si el login falla con Email not confirmed', async () => {
      mockSignIn.mockResolvedValue({
        error: { message: 'Email not confirmed' },
      });
      const mockResend = vi.fn().mockResolvedValue({ error: null });

      vi.spyOn(UseAuthModule, 'useAuth').mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: mockSignIn,
        signUp: mockSignUp,
        resendConfirmationEmail: mockResend,
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
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
        expect(screen.getByRole('button', { name: /reenviar verificación/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /reenviar verificación/i }));

      await waitFor(() => {
        expect(mockResend).toHaveBeenCalledWith('unconfirmed@example.com');
        expect(screen.getByText(/correo de verificación reenviado/i)).toBeInTheDocument();
      });
    });
  });
});
