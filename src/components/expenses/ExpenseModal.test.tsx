import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseModal } from './ExpenseModal';
import { getDefaultExpenseDescription } from '@/lib/formatters';
import { renderWithProviders } from '@/test/test-utils';
import * as receiptScanner from '@/lib/ai/receipt-scanner';
import * as storage from '@/lib/storage';

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: vi.fn(() => ({ data: [] })),
  useCreateExpense: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateExpense: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteExpense: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/lib/storage', () => ({
  uploadMedia: vi.fn().mockResolvedValue('https://storage.supabase.com/receipts/factura-epm.jpg'),
}));

vi.mock('@/lib/ai/receipt-scanner', () => ({
  scanReceipt: vi.fn(),
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

describe('ExpenseModal AI Receipt Scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the AI scanner banner when creating a new expense', () => {
    renderWithProviders(
      <ExpenseModal
        isOpen={true}
        onClose={vi.fn()}
        defaultCategory="other"
      />
    );

    expect(screen.getByText(/Escanear factura/i)).toBeInTheDocument();
  });

  it('does not render the AI scanner banner when editing an existing expense', () => {
    renderWithProviders(
      <ExpenseModal
        isOpen={true}
        onClose={vi.fn()}
        expenseToEdit={{
          id: 'exp-1',
          property_id: 'prop-1',
          category: 'other',
          expense_type: 'occasional',
          description: 'Gasto existente',
          amount: 50000,
          date: '2026-05-01',
          due_date: null,
          billing_month: '2026-05',
          payment_status: 'paid',
          is_recurring: false,
          recurrence_period: null,
          linked_booking_id: null,
          receipt_url: null,
          notes: null,
        }}
      />
    );

    expect(screen.queryByText(/Escanear factura/i)).not.toBeInTheDocument();
  });

  it('scans uploaded receipt and automatically populates form fields with AI extracted data', async () => {
    const mockExtraction = {
      amount: 185000,
      date: '2026-05-12',
      dueDate: '2026-05-25',
      billingMonth: '2026-05',
      category: 'electricity' as const,
      expenseType: 'utility_monthly' as const,
      merchant: 'EPM Medellín',
      description: 'Servicios Públicos EPM - Mayo 2026',
      notes: 'Factura #987654321',
      confidence: 'high' as const,
    };

    vi.mocked(receiptScanner.scanReceipt).mockResolvedValueOnce(mockExtraction);

    renderWithProviders(
      <ExpenseModal
        isOpen={true}
        onClose={vi.fn()}
        defaultCategory="other"
      />
    );

    const file = new File(['fake receipt bytes'], 'factura-epm.jpg', { type: 'image/jpeg' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const scannerInput = fileInputs[0] as HTMLInputElement;

    await userEvent.upload(scannerInput, file);

    await waitFor(() => {
      expect(storage.uploadMedia).toHaveBeenCalledWith(file, 'receipts');
      expect(receiptScanner.scanReceipt).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Servicios Públicos EPM - Mayo 2026')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2026-05-12')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2026-05-25')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2026-05')).toBeInTheDocument();
      expect(screen.getByText(/EPM Medellín/i)).toBeInTheDocument();
      expect(screen.getByText(/Factura adjunta/i)).toBeInTheDocument();
    });
  });

  describe('Dual Document Support (Factura y Comprobante)', () => {
    it('renders both Factura and Comprobante uploaders in the form', () => {
      renderWithProviders(
        <ExpenseModal
          isOpen={true}
          onClose={vi.fn()}
          defaultCategory="other"
        />
      );

      expect(screen.getByText('Factura o Cuenta')).toBeInTheDocument();
      expect(screen.getByText('Subir Factura')).toBeInTheDocument();
      expect(screen.getByText('Comprobante de Pago')).toBeInTheDocument();
      expect(screen.getByText('Subir Comprobante')).toBeInTheDocument();
    });

    it('displays attached indicators when existing expense has both documents', () => {
      renderWithProviders(
        <ExpenseModal
          isOpen={true}
          onClose={vi.fn()}
          expenseToEdit={{
            id: 'exp-both',
            property_id: 'prop-1',
            category: 'electricity',
            expense_type: 'utility_monthly',
            description: 'EPM Medellín',
            amount: 250000,
            date: '2026-06-10',
            due_date: '2026-06-20',
            billing_month: '2026-06',
            payment_status: 'paid',
            is_recurring: false,
            recurrence_period: null,
            linked_booking_id: null,
            invoice_url: 'https://storage.supabase.com/receipts/factura-epm.pdf',
            receipt_url: 'https://storage.supabase.com/receipts/comprobante-bancolombia.jpg',
            notes: null,
          }}
        />
      );

      expect(screen.getByText('Factura adjunta')).toBeInTheDocument();
      expect(screen.getByText('Comprobante adjunto')).toBeInTheDocument();
    });

    it('allows removing an attached document before saving', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseModal
          isOpen={true}
          onClose={vi.fn()}
          expenseToEdit={{
            id: 'exp-both',
            property_id: 'prop-1',
            category: 'electricity',
            expense_type: 'utility_monthly',
            description: 'EPM Medellín',
            amount: 250000,
            date: '2026-06-10',
            due_date: null,
            billing_month: '2026-06',
            payment_status: 'paid',
            is_recurring: false,
            recurrence_period: null,
            linked_booking_id: null,
            invoice_url: 'https://storage.supabase.com/receipts/factura-epm.pdf',
            receipt_url: null,
            notes: null,
          }}
        />
      );

      expect(screen.getByText('Factura adjunta')).toBeInTheDocument();

      const removeBtn = screen.getByRole('button', { name: /Quitar/i });
      await user.click(removeBtn);

      expect(screen.queryByText('Factura adjunta')).not.toBeInTheDocument();
      expect(screen.getByText('Subir Factura')).toBeInTheDocument();
    });
  });
});
