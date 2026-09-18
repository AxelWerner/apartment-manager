import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseModal } from './ExpenseModal';
import { getDefaultExpenseDescription } from '@/lib/formatters';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: vi.fn(() => ({ data: [] })),
  useCreateExpense: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateExpense: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteExpense: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn(() => ({ data: [] })),
}));

describe('getDefaultExpenseDescription helper', () => {
  it('generates expected default text for utilities and fixed expenses with month', () => {
    expect(getDefaultExpenseDescription('electricity', '2026-09')).toBe('Factura Energía / Luz (EPM) - Septiembre 2026');
    expect(getDefaultExpenseDescription('water', '2026-09')).toBe('Factura Agua y Alcantarillado (EPM) - Septiembre 2026');
    expect(getDefaultExpenseDescription('gas', '2026-09')).toBe('Factura Gas Natural (EPM) - Septiembre 2026');
    expect(getDefaultExpenseDescription('hoa_administration', '2026-09')).toBe('Administración Edificio - Septiembre 2026');
    expect(getDefaultExpenseDescription('internet_cable', '2026-09')).toBe('Internet Fibra Óptica - Septiembre 2026');
  });

  it('handles other categories with month', () => {
    expect(getDefaultExpenseDescription('cleaning_laundry', '2026-08')).toBe('Limpieza y Lavandería - Agosto 2026');
    expect(getDefaultExpenseDescription('supplies_restock', '2026-10')).toBe('Insumos y Reposición - Octubre 2026');
  });
});

describe('ExpenseModal Component Description Behavior', () => {
  it('pre-populates description with what it is and what month it is', () => {
    renderWithProviders(
      <ExpenseModal
        isOpen={true}
        onClose={vi.fn()}
        defaultCategory="electricity"
        defaultBillingMonth="2026-09"
      />
    );

    const descInput = screen.getByDisplayValue('Factura Energía / Luz (EPM) - Septiembre 2026');
    expect(descInput).toBeInTheDocument();
  });

  it('updates description dynamically when changing category if not manually edited', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ExpenseModal
        isOpen={true}
        onClose={vi.fn()}
        defaultCategory="electricity"
        defaultBillingMonth="2026-09"
      />
    );

    const categorySelect = screen.getByRole('combobox', { name: /Categoría \*/i });
    await user.selectOptions(categorySelect, 'hoa_administration');

    expect(screen.getByDisplayValue('Administración Edificio - Septiembre 2026')).toBeInTheDocument();
  });
});
