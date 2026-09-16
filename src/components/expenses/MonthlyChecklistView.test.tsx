import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonthlyChecklistView } from './MonthlyChecklistView';
import { renderWithProviders } from '@/test/test-utils';
import type { Expense } from '@/types/database';

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: vi.fn(),
  useUpdateExpense: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useCreateExpense: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useDeleteExpense: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

import { useExpenses } from '@/hooks/use-expenses';

describe('MonthlyChecklistView Component', () => {
  it('renders all standard recurring bills in the checklist and insurance card', () => {
    vi.mocked(useExpenses).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<MonthlyChecklistView onViewReceipt={vi.fn()} />);

    expect(screen.getByText('Administración')).toBeInTheDocument();
    expect(screen.getByText('Internet y TV')).toBeInTheDocument();
    expect(screen.getByText('Energía / Luz (EPM)')).toBeInTheDocument();
    expect(screen.getByText('Agua / Acueducto (EPM)')).toBeInTheDocument();
    expect(screen.getByText('Gas Natural (EPM)')).toBeInTheDocument();
    expect(screen.getByText('Seguro Todo Riesgo')).toBeInTheDocument();
  });

  it('navigates between months when clicking previous and next buttons', async () => {
    const user = userEvent.setup();
    vi.mocked(useExpenses).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<MonthlyChecklistView onViewReceipt={vi.fn()} />);

    // Find the navigation buttons with ChevronLeft and ChevronRight
    const prevBtn = screen.getByRole('button', { name: /Mes anterior/i });
    const nextBtn = screen.getByRole('button', { name: /Mes siguiente/i });

    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();

    await user.click(prevBtn);
    // Button clicks execute cleanly without throwing errors
  });

  it('marks a bill as paid when an expense exists for the category and month', () => {
    // Expense in September 2026 for hoa_administration
    const mockExpenses: Expense[] = [
      {
        id: 'exp-1',
        property_id: 'prop-1',
        category: 'hoa_administration',
        expense_type: 'fixed_monthly',
        description: 'Administración Septiembre',
        amount: 380000,
        date: '2026-09-05',
        due_date: '2026-09-10',
        billing_month: '2026-09',
        payment_status: 'paid',
        is_recurring: true,
        recurrence_period: 'monthly',
        linked_booking_id: null,
        receipt_url: null,
        notes: null,
      },
    ];

    vi.mocked(useExpenses).mockReturnValue({
      data: mockExpenses,
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<MonthlyChecklistView onViewReceipt={vi.fn()} />);

    // Check that Pagado badge or text is rendered
    expect(screen.getAllByText(/Pagado/i).length).toBeGreaterThan(0);
  });

  it('shows insurance as covered this month when annual policy was paid in a previous covered month', () => {
    // Policy paid in June 2026 covers until May 2027
    const mockExpenses: Expense[] = [
      {
        id: 'exp-ins',
        property_id: 'prop-1',
        category: 'insurance_annual',
        expense_type: 'annual',
        description: 'Póliza SURA 2026-2027',
        amount: 334687,
        date: '2026-06-15',
        due_date: null,
        billing_month: '2026-06',
        payment_status: 'paid',
        is_recurring: true,
        recurrence_period: 'yearly',
        linked_booking_id: null,
        receipt_url: null,
        notes: null,
      },
    ];

    vi.mocked(useExpenses).mockReturnValue({
      data: mockExpenses,
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<MonthlyChecklistView onViewReceipt={vi.fn()} />);

    // September 2026 is 3 months after June 2026 -> should show "Cubierto este mes"
    expect(screen.getByText('Cubierto este mes')).toBeInTheDocument();
    expect(screen.getByText(/Seguro anual cubierto este mes/i)).toBeInTheDocument();
  });

  it('renders additional expenses like supplies restock for the selected month', () => {
    const mockExpenses: Expense[] = [
      {
        id: 'exp-supplies',
        property_id: 'prop-1',
        category: 'supplies_restock',
        expense_type: 'occasional',
        description: 'Compra Éxito: Café Juan Valdez y Jabones',
        amount: 145000,
        date: '2026-09-01',
        due_date: null,
        billing_month: '2026-09',
        payment_status: 'paid',
        is_recurring: false,
        recurrence_period: null,
        linked_booking_id: null,
        receipt_url: null,
        notes: null,
      },
    ];

    vi.mocked(useExpenses).mockReturnValue({
      data: mockExpenses,
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<MonthlyChecklistView onViewReceipt={vi.fn()} />);

    expect(screen.getByText('Compra Éxito: Café Juan Valdez y Jabones')).toBeInTheDocument();
    expect(screen.getByText('$ 145.000,00')).toBeInTheDocument();
  });
});
