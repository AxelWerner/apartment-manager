import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMonthlyFinancialData, createFinancialTools } from './financial-tools';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  DEFAULT_PROPERTY_ID: 'prop-test-01',
}));

describe('financial-tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates monthly financial data accurately from bookings and expenses', async () => {
    const mockProperty = { id: 'prop-test-01', name: 'Apartamento Poblado', currency: 'COP' };
    const mockBookings = [
      {
        id: 'b-1',
        property_id: 'prop-test-01',
        check_in: '2026-09-01',
        check_out: '2026-09-05',
        number_of_nights: 4,
        gross_amount: 1000000,
        net_payout: 900000,
        status: 'completed',
        source: 'airbnb',
      },
      {
        id: 'b-2',
        property_id: 'prop-test-01',
        check_in: '2026-09-10',
        check_out: '2026-09-15',
        number_of_nights: 5,
        gross_amount: 1500000,
        net_payout: 1400000,
        status: 'completed',
        source: 'direct',
      },
    ];

    const mockExpenses = [
      {
        id: 'e-1',
        property_id: 'prop-test-01',
        description: 'Administración Edificio',
        amount: 400000,
        category: 'hoa_administration',
        billing_month: '2026-09',
        date: '2026-09-05',
      },
      {
        id: 'e-2',
        property_id: 'prop-test-01',
        description: 'Servicio de Internet',
        amount: 100000,
        category: 'internet_cable',
        billing_month: '2026-09',
        date: '2026-09-12',
      },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: mockProperty, error: null }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'bookings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mockBookings, error: null }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'expenses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mockExpenses, error: null }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await fetchMonthlyFinancialData({
      year: 2026,
      month: 9,
      propertyId: 'prop-test-01',
    });

    expect(result.monthKey).toBe('2026-09');
    expect(result.propertyName).toBe('Apartamento Poblado');
    expect(result.currency).toBe('COP');
    expect(result.expenses.total).toBe(500000);
    expect(result.expenses.byCategory['hoa_administration']).toBe(400000);
    expect(result.expenses.byCategory['internet_cable']).toBe(100000);
    expect(result.revenue.grossTotal).toBe(2500000);
    expect(result.profitability.netProfit).toBe(result.revenue.accommodationRevenue - 500000);
  });

  it('creates tools with valid input schema and definitions', () => {
    const tools = createFinancialTools('prop-test-01');
    expect(tools.getMonthlyFinancials).toBeDefined();
    expect(tools.getUserProperties).toBeDefined();
    expect(tools.getMonthlyFinancials.description).toContain('resumen financiero');
  });
});
