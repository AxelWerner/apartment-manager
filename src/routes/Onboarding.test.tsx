import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Onboarding from './Onboarding';
import { renderWithProviders } from '@/test/test-utils';
import * as authHook from '@/hooks/use-auth';
import * as propertyContext from '@/context/PropertyContext';
import type { User } from '@supabase/supabase-js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/context/PropertyContext', () => ({
  useActiveProperty: vi.fn(),
}));

describe('Onboarding route', () => {
  const mockSignOut = vi.fn();
  const mockCreateProperty = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authHook.useAuth).mockReturnValue({
      user: {
        id: 'u-123',
        email: 'host@example.com',
        user_metadata: { full_name: 'Santiago Pérez' },
      } as unknown as User,
      signOut: mockSignOut,
    } as unknown as ReturnType<typeof authHook.useAuth>);

    vi.mocked(propertyContext.useActiveProperty).mockReturnValue({
      createProperty: mockCreateProperty,
    } as unknown as ReturnType<typeof propertyContext.useActiveProperty>);
  });

  it('renders onboarding welcome header and user greeting', () => {
    renderWithProviders(<Onboarding />);

    expect(screen.getByText('¡Bienvenido a AptOS!')).toBeInTheDocument();
    expect(screen.getByText('Santiago Pérez')).toBeInTheDocument();
  });

  it('handles sign out button click', () => {
    renderWithProviders(<Onboarding />);

    const signOutBtn = screen.getByRole('button', { name: /Cerrar sesión/i });
    fireEvent.click(signOutBtn);

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('validates property name before submitting', async () => {
    renderWithProviders(<Onboarding />);

    const nameInput = screen.getByPlaceholderText('Ej. Apto 502 - Edificio Manila');
    const submitBtn = screen.getByRole('button', { name: /Empezar con este Apartamento/i });

    // Try submitting with empty name
    fireEvent.change(nameInput, { target: { value: '   ' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Por favor escribe el nombre de tu apartamento.')
      ).toBeInTheDocument();
    });
    expect(mockCreateProperty).not.toHaveBeenCalled();
  });

  it('submits form successfully and navigates to the new dashboard', async () => {
    mockCreateProperty.mockResolvedValue({ id: 'prop-new-123' });

    renderWithProviders(<Onboarding />);

    const nameInput = screen.getByPlaceholderText('Ej. Apto 502 - Edificio Manila');
    const cityInput = screen.getByPlaceholderText('Medellín');
    const addressInput = screen.getByPlaceholderText('Ej. Calle 10 # 43D - 25, El Poblado');
    const submitBtn = screen.getByRole('button', { name: /Empezar con este Apartamento/i });

    fireEvent.change(nameInput, { target: { value: 'Apto Manila 502' } });
    fireEvent.change(cityInput, { target: { value: 'Medellín' } });
    fireEvent.change(addressInput, { target: { value: 'Cra 43 # 12' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Apto Manila 502',
          city: 'Medellín',
          address: 'Cra 43 # 12',
          currency: 'COP',
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/p/prop-new-123/dashboard', {
        replace: true,
      });
    });
  });

  it('displays error message when property creation fails', async () => {
    mockCreateProperty.mockRejectedValue(new Error('Network connection timeout'));

    renderWithProviders(<Onboarding />);

    const nameInput = screen.getByPlaceholderText('Ej. Apto 502 - Edificio Manila');
    const submitBtn = screen.getByRole('button', { name: /Empezar con este Apartamento/i });

    fireEvent.change(nameInput, { target: { value: 'Apto Manila 502' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Network connection timeout')).toBeInTheDocument();
    });
  });
});
