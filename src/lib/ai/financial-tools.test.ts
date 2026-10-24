import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchMonthlyFinancialData,
  fetchAnnualFinancialData,
  createFinancialTools,
} from './financial-tools';
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
    expect(result.expenses.categoryPercentages['hoa_administration']).toBe('80.0%');
    expect(result.expenses.categoryPercentages['internet_cable']).toBe('20.0%');
    expect(result.revenue.grossTotal).toBe(2500000);
    expect(result.profitability.netProfit).toBe(result.revenue.ownerPayout - 500000);
    expect(result.profitability.operationalProfit).toBe(result.revenue.accommodationRevenue - 500000);
    expect(result.profitability.profitMarginPercent).toBe(
      `${((result.profitability.netProfit / result.revenue.ownerPayout) * 100).toFixed(1)}%`
    );
  });

  it('correctly filters out bookings and expenses from other months and avoids annual leakage', async () => {
    const mockProperty = { id: 'prop-test-01', name: 'Apartamento Poblado', currency: 'COP' };
    const multiMonthBookings = [
      // August booking (should NOT be in September grossTotal)
      {
        id: 'b-aug',
        property_id: 'prop-test-01',
        check_in: '2026-08-10',
        check_out: '2026-08-15',
        number_of_nights: 5,
        gross_amount: 3000000,
        net_payout: 2500000,
        status: 'completed',
        source: 'airbnb',
      },
      // September booking 1
      {
        id: 'b-sep-1',
        property_id: 'prop-test-01',
        check_in: '2026-09-02',
        check_out: '2026-09-06',
        number_of_nights: 4,
        gross_amount: 1200000,
        net_payout: 1000000,
        cleaning_fee_collected: 80000,
        owner_payout: 736000,
        management_fee: 184000,
        status: 'completed',
        source: 'airbnb',
      },
      // September booking 2
      {
        id: 'b-sep-2',
        property_id: 'prop-test-01',
        check_in: '2026-09-12',
        check_out: '2026-09-18',
        number_of_nights: 6,
        gross_amount: 1800000,
        net_payout: 1600000,
        cleaning_fee_collected: 80000,
        owner_payout: 1216000,
        management_fee: 304000,
        status: 'completed',
        source: 'airbnb',
      },
      // October booking (should NOT be in September grossTotal)
      {
        id: 'b-oct',
        property_id: 'prop-test-01',
        check_in: '2026-10-05',
        check_out: '2026-10-10',
        number_of_nights: 5,
        gross_amount: 4000000,
        net_payout: 3500000,
        status: 'confirmed',
        source: 'airbnb',
      },
    ];

    const multiMonthExpenses = [
      // July bill paid in September (billing_month 2026-07) -> should NOT be included in September
      {
        id: 'e-jul',
        property_id: 'prop-test-01',
        description: 'Luz Julio',
        amount: 250000,
        category: 'electricity',
        billing_month: '2026-07',
        date: '2026-09-17',
      },
      // August bill paid in September (billing_month 2026-08) -> should NOT be included in September
      {
        id: 'e-aug',
        property_id: 'prop-test-01',
        description: 'Luz Agosto',
        amount: 280000,
        category: 'electricity',
        billing_month: '2026-08',
        date: '2026-09-17',
      },
      // September bill (billing_month 2026-09) -> SHOULD be included
      {
        id: 'e-sep-1',
        property_id: 'prop-test-01',
        description: 'Luz Septiembre',
        amount: 320000,
        category: 'electricity',
        billing_month: '2026-09',
        date: '2026-09-24',
      },
      // September expense without billing_month but date in September -> SHOULD be included
      {
        id: 'e-sep-2',
        property_id: 'prop-test-01',
        description: 'Insumos Aseo',
        amount: 80000,
        category: 'supplies_restock',
        billing_month: null,
        date: '2026-09-15',
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
          eq: vi.fn().mockResolvedValue({ data: multiMonthBookings, error: null }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'expenses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: multiMonthExpenses, error: null }),
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

    // 1. Gross total MUST be ONLY September bookings (1200000 + 1800000 = 3000000)
    // NOT all bookings (which would be 10000000)
    expect(result.revenue.grossTotal).toBe(3000000);
    expect(result.revenue.totalBookings).toBe(2);

    // 2. Expenses MUST only include September items (320000 + 80000 = 400000)
    // NOT past months July/August invoices paid in September (which would be 930000)
    expect(result.expenses.total).toBe(400000);
    expect(result.expenses.count).toBe(2);

    // 3. Category percentages
    expect(result.expenses.categoryPercentages['electricity']).toBe('80.0%');
    expect(result.expenses.categoryPercentages['supplies_restock']).toBe('20.0%');

    // 4. Occupancy Rate: 10 occupied nights out of 30 days in September = 33.3%
    expect(result.revenue.daysInMonth).toBe(30);
    expect(result.revenue.occupiedNights).toBe(10);
    expect(result.revenue.occupancyRate).toBe('33.3%');

    // 5. Owner payout & net profit
    expect(result.revenue.ownerPayout).toBe(736000 + 1216000); // 1952000
    expect(result.profitability.ownerNetProfit).toBe(1952000 - 400000); // 1552000
    expect(result.profitability.ownerProfitMarginPercent).toBe(
      `${(((1952000 - 400000) / 1952000) * 100).toFixed(1)}%`
    );
  });

  it('calculates annual financials accurately with monthly breakdown', async () => {
    const mockProperty = { id: 'prop-test-01', name: 'Apartamento Poblado', currency: 'COP' };
    const mockBookings = [
      {
        id: 'b-1',
        property_id: 'prop-test-01',
        check_in: '2026-03-01',
        check_out: '2026-03-05',
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
        description: 'Internet Marzo',
        amount: 100000,
        category: 'internet_cable',
        billing_month: '2026-03',
        date: '2026-03-10',
      },
      {
        id: 'e-2',
        property_id: 'prop-test-01',
        description: 'Internet Septiembre',
        amount: 120000,
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

    const annual = await fetchAnnualFinancialData({ year: 2026, propertyId: 'prop-test-01' });

    expect(annual.year).toBe(2026);
    expect(annual.totals.grossTotal).toBe(2500000);
    expect(annual.totals.totalExpenses).toBe(220000);
    expect(annual.monthlyBreakdown).toHaveLength(12);
    expect(annual.monthlyBreakdown[2].grossTotal).toBe(1000000); // March
    expect(annual.monthlyBreakdown[8].grossTotal).toBe(1500000); // September
  });

  it('creates tools with valid input schema and definitions', () => {
    const tools = createFinancialTools('prop-test-01');
    expect(tools.getMonthlyFinancials).toBeDefined();
    expect(tools.getAnnualFinancials).toBeDefined();
    expect(tools.getUserProperties).toBeDefined();
    expect(tools.getMonthlyFinancials.description).toContain('resumen financiero');
    expect(tools.getAnnualFinancials.description).toContain('consolidado');
  });
});
