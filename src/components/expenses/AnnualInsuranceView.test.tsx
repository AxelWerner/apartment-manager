import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { AnnualInsuranceView } from './AnnualInsuranceView';
import { renderWithProviders } from '@/test/test-utils';
import * as expensesHook from '@/hooks/use-expenses';
import type { Expense } from '@/types/database';

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: vi.fn(),
  useCreateExpense: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn().mockReturnValue({ data: [] }),
}));

describe('AnnualInsuranceView Component', () => {
  const mockViewReceipt = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockInsuranceExpense: Expense = {
    id: 'exp-ins-1',
    property_id: 'prop-1',
    category: 'insurance_annual',
    expense_type: 'annual',
    description: 'Póliza Hogar Seguros Sura',
    amount: 1440000,
    date: '2026-06-01',
    due_date: null,
    billing_month: '2026-06',
    payment_status: 'paid',
    is_recurring: true,
    recurrence_period: 'yearly',
    linked_booking_id: null,
    receipt_url: 'https://example.com/receipt.pdf',
    notes: 'Póliza #998877',
  };

  it('renders default view when no insurance policy exists', () => {
    vi.mocked(expensesHook.useExpenses).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof expensesHook.useExpenses>);

    renderWithProviders(<AnnualInsuranceView onViewReceipt={mockViewReceipt} />);

    expect(screen.getByText('Seguro Todo Riesgo del Apartamento')).toBeInTheDocument();
    expect(screen.getByText('Registrar Seguro')).toBeInTheDocument();
  });

  it('renders active insurance policy details and calculates monthly amortization', () => {
    vi.mocked(expensesHook.useExpenses).mockReturnValue({
      data: [mockInsuranceExpense],
    } as unknown as ReturnType<typeof expensesHook.useExpenses>);

    renderWithProviders(<AnnualInsuranceView onViewReceipt={mockViewReceipt} />);

    expect(screen.getByText('Actualizar / Renovar Póliza')).toBeInTheDocument();
    expect(screen.getByText('Prima Anual Pagada')).toBeInTheDocument();
    expect(screen.getByText('Impacto Mensual (Prorrateado)')).toBeInTheDocument();
    expect(screen.getByText('Próxima Renovación')).toBeInTheDocument();
    
    // Receipt button should be present and clickable
    const receiptButton = screen.getByRole('button', { name: /Ver carátula de póliza adjunta/i });
    expect(receiptButton).toBeInTheDocument();

    fireEvent.click(receiptButton);
    expect(mockViewReceipt).toHaveBeenCalledWith('https://example.com/receipt.pdf');
  });

  it('opens expense modal when clicking update policy button', () => {
    vi.mocked(expensesHook.useExpenses).mockReturnValue({
      data: [mockInsuranceExpense],
    } as unknown as ReturnType<typeof expensesHook.useExpenses>);

    renderWithProviders(<AnnualInsuranceView onViewReceipt={mockViewReceipt} />);

    const updateButton = screen.getByRole('button', { name: /Actualizar \/ Renovar Póliza/i });
    fireEvent.click(updateButton);

    expect(screen.getByText('Editar Gasto')).toBeInTheDocument();
  });
});
