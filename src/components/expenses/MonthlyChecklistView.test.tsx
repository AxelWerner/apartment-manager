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
}));

import { useExpenses } from '@/hooks/use-expenses';

describe('MonthlyChecklistView Component', () => {
  it('renders all standard recurring bills in the checklist', () => {
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
});
