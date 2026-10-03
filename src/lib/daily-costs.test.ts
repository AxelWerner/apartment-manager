import { describe, it, expect } from 'vitest';
import {
  calculateApartmentDailyCosts,
  EMPTY_APT_FIXED_ELECTRICITY,
} from './daily-costs';
import type { Expense } from '@/types/database';

describe('calculateApartmentDailyCosts', () => {
  it('calculates daily costs correctly with default amounts for a 31-day month (e.g. October)', () => {
    const result = calculateApartmentDailyCosts('2026-10', [], []);

    expect(result.daysInMonth).toBe(31);

    // Empty apt:
    // hoa (303887) + wifi (104900) + insurance (112500) + electricity fixed (70000) = 591287
    const expectedEmptyMonthly = 303887 + 104900 + 112500 + 70000;
    expect(result.emptyTotalMonthly).toBe(expectedEmptyMonthly);
    expect(result.emptyDailyCost).toBe(Math.round(expectedEmptyMonthly / 31));

    // Occupied apt:
    // hoa (303887) + wifi (104900) + insurance (112500) + electricity (290000) + water (110000) + gas (35000) = 956287
    const expectedOccupiedMonthly = 303887 + 104900 + 112500 + 290000 + 110000 + 35000;
    expect(result.occupiedTotalMonthly).toBe(expectedOccupiedMonthly);
    expect(result.occupiedDailyCost).toBe(Math.round(expectedOccupiedMonthly / 31));

    expect(result.dailySavings).toBe(result.occupiedDailyCost - result.emptyDailyCost);
    expect(result.monthlySavings).toBe(result.occupiedTotalMonthly - result.emptyTotalMonthly);
  });

  it('calculates daily costs correctly for a 30-day month (e.g. September)', () => {
    const result = calculateApartmentDailyCosts('2026-09', [], []);

    expect(result.daysInMonth).toBe(30);
    const expectedEmptyMonthly = 303887 + 104900 + 112500 + 70000;
    expect(result.emptyDailyCost).toBe(Math.round(expectedEmptyMonthly / 30));
  });

  it('uses actual registered expenses when present', () => {
    const mockMonthExpenses: Expense[] = [
      {
        id: '1',
        property_id: 'prop-1',
        category: 'hoa_administration',
        expense_type: 'fixed_monthly',
        description: 'Admin Oct',
        amount: 320000, // custom admin
        date: '2026-10-01',
        due_date: null,
        billing_month: '2026-10',
        payment_status: 'paid',
        is_recurring: true,
        recurrence_period: 'monthly',
        linked_booking_id: null,
        receipt_url: null,
        notes: null,
      },
      {
        id: '2',
        property_id: 'prop-1',
        category: 'electricity',
        expense_type: 'utility_monthly',
        description: 'Luz Oct',
        amount: 350000, // custom luz
        date: '2026-10-01',
        due_date: null,
        billing_month: '2026-10',
        payment_status: 'paid',
        is_recurring: true,
        recurrence_period: 'monthly',
        linked_booking_id: null,
        receipt_url: null,
        notes: null,
      },
    ];

    const result = calculateApartmentDailyCosts('2026-10', mockMonthExpenses, []);

    // Empty apt should use registered admin (320000), but KEEP fixed electricity at 70000
    const emptyElecItem = result.items.find((it) => it.key === 'electricity');
    expect(emptyElecItem?.emptyAmount).toBe(EMPTY_APT_FIXED_ELECTRICITY);

    const emptyHoaItem = result.items.find((it) => it.key === 'hoa_administration');
    expect(emptyHoaItem?.emptyAmount).toBe(320000);

    // Occupied apt should use 350000 for electricity
    const occupiedElecItem = result.items.find((it) => it.key === 'electricity');
    expect(occupiedElecItem?.occupiedAmount).toBe(350000);
  });

  it('prorates active annual insurance policy when available in allExpenses', () => {
    const mockAllExpenses: Expense[] = [
      {
        id: 'ins-1',
        property_id: 'prop-1',
        category: 'insurance_annual',
        expense_type: 'annual',
        description: 'Seguro Sura',
        amount: 1200000, // 1.200.000 / 12 = 100.000 / mes
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

    const result = calculateApartmentDailyCosts('2026-10', [], mockAllExpenses);

    expect(result.monthlyAmortizedInsurance).toBe(100000);
    const insuranceItem = result.items.find((it) => it.key === 'insurance_annual');
    expect(insuranceItem?.emptyAmount).toBe(100000);
    expect(insuranceItem?.occupiedAmount).toBe(100000);
  });
});
