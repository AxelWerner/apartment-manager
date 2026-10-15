import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Damages from './Damages';
import { renderWithProviders } from '@/test/test-utils';
import * as damagesHook from '@/hooks/use-damages';
import type { Damage } from '@/types/database';
import { toast } from 'sonner';

vi.mock('@/hooks/use-damages', () => ({
  useDamages: vi.fn(),
  useCreateDamage: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useUpdateDamage: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useDeleteDamage: vi.fn(),
}));

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: vi.fn().mockReturnValue({ data: [] }),
  useCreateExpense: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useUpdateExpense: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Damages route', () => {
  const mockDeleteMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(damagesHook.useDeleteDamage).mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
    } as unknown as ReturnType<typeof damagesHook.useDeleteDamage>);
  });

  const mockDamages: Damage[] = [
    {
      id: 'dmg-1',
      property_id: 'prop-1',
      linked_booking_id: null,
      title: 'Ventana rota',
      description: 'Vidrio roto en el balcón',
      date_discovered: '2026-10-01',
      severity: 'high',
      estimated_repair_cost: 300000,
      actual_repair_cost: 280000,
      reimbursement_amount: 200000,
      claim_status: 'reimbursed',
      aircover_case_number: 'AC-999',
      resolution_notes: 'Reembolsado parcialmente',
      photo_urls: ['https://example.com/window.jpg'],
      linked_expense_id: null,
    },
    {
      id: 'dmg-2',
      property_id: 'prop-1',
      linked_booking_id: null,
      title: 'Mesa rayada',
      description: 'Rayones en la mesa del comedor',
      date_discovered: '2026-10-05',
      severity: 'low',
      estimated_repair_cost: 50000,
      actual_repair_cost: 50000,
      reimbursement_amount: 0,
      claim_status: 'discovered',
      aircover_case_number: null,
      resolution_notes: null,
      photo_urls: [],
      linked_expense_id: null,
    },
  ];

  it('renders loading state when query is loading', () => {
    vi.mocked(damagesHook.useDamages).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof damagesHook.useDamages>);

    renderWithProviders(<Damages />);

    expect(screen.getByText('Cargando incidentes...')).toBeInTheDocument();
  });

  it('renders empty state when there are no damages', () => {
    vi.mocked(damagesHook.useDamages).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof damagesHook.useDamages>);

    renderWithProviders(<Damages />);

    expect(screen.getByText('No se encontraron reportes de daños.')).toBeInTheDocument();
    expect(
      screen.getByText('¡Excelente! Tu apartamento se encuentra en perfectas condiciones.')
    ).toBeInTheDocument();
  });

  it('renders damages list and calculates KPI metrics', () => {
    vi.mocked(damagesHook.useDamages).mockReturnValue({
      data: mockDamages,
      isLoading: false,
    } as unknown as ReturnType<typeof damagesHook.useDamages>);

    renderWithProviders(<Damages />);

    // Total incidents: 2
    expect(screen.getByText('Incidentes Totales')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Damage items displayed
    expect(screen.getByText('Ventana rota')).toBeInTheDocument();
    expect(screen.getByText('Mesa rayada')).toBeInTheDocument();
    expect(screen.getByText('Vidrio roto en el balcón')).toBeInTheDocument();
  });

  it('filters damages by search query and claim status', () => {
    vi.mocked(damagesHook.useDamages).mockReturnValue({
      data: mockDamages,
      isLoading: false,
    } as unknown as ReturnType<typeof damagesHook.useDamages>);

    renderWithProviders(<Damages />);

    const searchInput = screen.getByPlaceholderText('Buscar por título o caso AirCover...');
    fireEvent.change(searchInput, { target: { value: 'Ventana' } });

    expect(screen.getByText('Ventana rota')).toBeInTheDocument();
    expect(screen.queryByText('Mesa rayada')).not.toBeInTheDocument();

    // Clear search and filter by status
    fireEvent.change(searchInput, { target: { value: '' } });
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'discovered' } });

    expect(screen.queryByText('Ventana rota')).not.toBeInTheDocument();
    expect(screen.getByText('Mesa rayada')).toBeInTheDocument();
  });

  it('opens report damage modal when clicking button', () => {
    vi.mocked(damagesHook.useDamages).mockReturnValue({
      data: mockDamages,
      isLoading: false,
    } as unknown as ReturnType<typeof damagesHook.useDamages>);

    renderWithProviders(<Damages />);

    const createButton = screen.getByRole('button', { name: /Reportar Daño Encontrado/i });
    fireEvent.click(createButton);

    expect(
      screen.getByText(/Registra la inspección de salida/i)
    ).toBeInTheDocument();
  });

  it('handles damage deletion when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeleteMutateAsync.mockResolvedValue(undefined);

    vi.mocked(damagesHook.useDamages).mockReturnValue({
      data: mockDamages,
      isLoading: false,
    } as unknown as ReturnType<typeof damagesHook.useDamages>);

    renderWithProviders(<Damages />);

    const deleteButtons = screen.getAllByTitle('Eliminar');
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith('¿Estás seguro de eliminar el reporte de "Ventana rota"?');
    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('dmg-1');
      expect(toast.success).toHaveBeenCalledWith('Reporte de daño eliminado');
    });
  });
});
