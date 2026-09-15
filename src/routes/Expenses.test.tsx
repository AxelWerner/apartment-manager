import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Expenses from './Expenses';
import { renderWithProviders } from '@/test/test-utils';
import type { Expense } from '@/types/database';

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: vi.fn(),
  useDeleteExpense: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useUpdateExpense: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useCreateExpense: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

import { useExpenses } from '@/hooks/use-expenses';

const mockExpenses: Expense[] = [
  {
    id: 'exp-1',
    property_id: 'prop-1',
    category: 'hoa_administration',
    description: 'Administración Edificio',
    amount: 380000,
    date: '2026-03-01',
    due_date: null,
    billing_month: '2026-03',
    expense_type: 'fixed_monthly',
    payment_status: 'paid',
    is_recurring: true,
    recurrence_period: 'monthly',
    linked_booking_id: null,
    receipt_url: null,
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'exp-2',
    property_id: 'prop-1',
    category: 'internet_cable',
    description: 'WiFi Fibra Óptica',
    amount: 125000,
    date: '2026-03-10',
    due_date: null,
    billing_month: '2026-03',
    expense_type: 'fixed_monthly',
    payment_status: 'paid',
    is_recurring: true,
    recurrence_period: 'monthly',
    linked_booking_id: null,
    receipt_url: null,
    notes: null,
    created_at: '2026-03-10T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },
  {
    id: 'exp-3',
    property_id: 'prop-1',
    category: 'supplies_restock',
    description: 'Café y Jabones',
    amount: 45000,
    date: '2026-03-05',
    due_date: null,
    billing_month: '2026-03',
    expense_type: 'occasional',
    payment_status: 'pending',
    is_recurring: false,
    recurrence_period: null,
    linked_booking_id: null,
    receipt_url: null,
    notes: null,
    created_at: '2026-03-05T00:00:00Z',
    updated_at: '2026-03-05T00:00:00Z',
  },
];

describe('Expenses Route Sorting', () => {
  it('renders sortable headers for date, category, description, type, and amount, but not for status and actions', async () => {
    const user = userEvent.setup();
    vi.mocked(useExpenses).mockReturnValue({
      data: mockExpenses,
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<Expenses />);

    // Switch to Libro Completo de Gastos tab
    await user.click(screen.getByRole('button', { name: /Libro Completo de Gastos/i }));

    // Verify sortable columns
    const dateHeader = screen.getByRole('columnheader', { name: /Fecha/i });
    const catHeader = screen.getByRole('columnheader', { name: /Categoría/i });
    const descHeader = screen.getByRole('columnheader', { name: /Descripción/i });
    const typeHeader = screen.getByRole('columnheader', { name: /Tipo/i });
    const amountHeader = screen.getByRole('columnheader', { name: /Monto COP/i });

    expect(dateHeader).toBeInTheDocument();
    expect(catHeader).toBeInTheDocument();
    expect(descHeader).toBeInTheDocument();
    expect(typeHeader).toBeInTheDocument();
    expect(amountHeader).toBeInTheDocument();

    // Verify Estado and Acciones exist as columnheaders but without sort indicators/handlers
    const statusHeader = screen.getByRole('columnheader', { name: /^Estado$/i });
    const actionsHeader = screen.getByRole('columnheader', { name: /^Acciones$/i });

    expect(statusHeader).toBeInTheDocument();
    expect(actionsHeader).toBeInTheDocument();
    expect(within(statusHeader).queryByRole('img', { hidden: true })).toBeNull();
    expect(within(actionsHeader).queryByRole('img', { hidden: true })).toBeNull();
  });

  it('sorts by date desc by default and toggles asc on click', async () => {
    const user = userEvent.setup();
    vi.mocked(useExpenses).mockReturnValue({
      data: mockExpenses,
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<Expenses />);
    await user.click(screen.getByRole('button', { name: /Libro Completo de Gastos/i }));

    const rows = screen.getAllByRole('row').slice(1); // exclude header row
    expect(within(rows[0]).getByText('WiFi Fibra Óptica')).toBeInTheDocument(); // 2026-03-10
    expect(within(rows[1]).getByText('Café y Jabones')).toBeInTheDocument(); // 2026-03-05
    expect(within(rows[2]).getByText('Administración Edificio')).toBeInTheDocument(); // 2026-03-01

    // Click on Fecha header to sort ascending
    const dateHeader = screen.getByRole('columnheader', { name: /Fecha/i });
    await user.click(dateHeader);

    const ascRows = screen.getAllByRole('row').slice(1);
    expect(within(ascRows[0]).getByText('Administración Edificio')).toBeInTheDocument(); // 2026-03-01
    expect(within(ascRows[1]).getByText('Café y Jabones')).toBeInTheDocument(); // 2026-03-05
    expect(within(ascRows[2]).getByText('WiFi Fibra Óptica')).toBeInTheDocument(); // 2026-03-10
  });

  it('sorts by amount when clicking Monto COP header', async () => {
    const user = userEvent.setup();
    vi.mocked(useExpenses).mockReturnValue({
      data: mockExpenses,
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<Expenses />);
    await user.click(screen.getByRole('button', { name: /Libro Completo de Gastos/i }));

    // Click Monto COP -> defaults to desc
    const amountHeader = screen.getByRole('columnheader', { name: /Monto COP/i });
    await user.click(amountHeader);

    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Administración Edificio')).toBeInTheDocument(); // 380,000
    expect(within(rows[1]).getByText('WiFi Fibra Óptica')).toBeInTheDocument(); // 125,000
    expect(within(rows[2]).getByText('Café y Jabones')).toBeInTheDocument(); // 45,000

    // Click Monto COP again -> toggles to asc
    await user.click(amountHeader);
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Café y Jabones')).toBeInTheDocument(); // 45,000
    expect(within(rows[1]).getByText('WiFi Fibra Óptica')).toBeInTheDocument(); // 125,000
    expect(within(rows[2]).getByText('Administración Edificio')).toBeInTheDocument(); // 380,000
  });

  it('sorts by description alphabetically', async () => {
    const user = userEvent.setup();
    vi.mocked(useExpenses).mockReturnValue({
      data: mockExpenses,
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    renderWithProviders(<Expenses />);
    await user.click(screen.getByRole('button', { name: /Libro Completo de Gastos/i }));

    const descHeader = screen.getByRole('columnheader', { name: /Descripción/i });
    await user.click(descHeader);

    // Initial click on text column sorts asc: Administración Edificio, Café y Jabones, WiFi Fibra Óptica
    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Administración Edificio')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Café y Jabones')).toBeInTheDocument();
    expect(within(rows[2]).getByText('WiFi Fibra Óptica')).toBeInTheDocument();

    // Toggle desc
    await user.click(descHeader);
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('WiFi Fibra Óptica')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Café y Jabones')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Administración Edificio')).toBeInTheDocument();
  });
});
