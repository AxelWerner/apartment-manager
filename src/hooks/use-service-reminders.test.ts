import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useServiceReminders } from './use-service-reminders';
import * as PropertyContext from '@/context/PropertyContext';
import * as useExpensesModule from '@/hooks/use-expenses';
import type { Property, UserRole, Expense } from '@/types/database';

vi.mock('@/context/PropertyContext', () => ({
  useActiveProperty: vi.fn(),
  usePropertyContext: vi.fn(),
}));
vi.mock('@/hooks/use-expenses');

const mockProperty: Property = {
  id: 'prop-123',
  name: 'Apartamento Poblado 402',
  address: 'Calle 10 # 40-20',
  city: 'Medellín',
  country: 'Colombia',
  currency: 'COP',
  is_active: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

describe('useServiceReminders Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty reminders if user is NOT an owner (e.g. CLEANER, OPERATOR, VIEWER)', () => {
    vi.mocked(PropertyContext.usePropertyContext).mockReturnValue({
      activePropertyId: 'prop-123',
      activeProperty: mockProperty,
      role: 'CLEANER' as UserRole,
      isOwner: false,
      isPrimaryOwner: false,
      isAdmin: false,
      isOperator: false,
      isCleaner: true,
      isViewer: false,
      properties: [],
      isLoading: false,
      switchProperty: vi.fn(),
      refreshProperties: vi.fn(),
      currentProperty: null,
      activeMembership: null,
    });

    vi.spyOn(useExpensesModule, 'useExpenses').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpensesModule.useExpenses>);
    vi.spyOn(useExpensesModule, 'useRecurringTemplates').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpensesModule.useRecurringTemplates>);

    const { result } = renderHook(() => useServiceReminders());
    expect(result.current.canReceiveServiceAlerts).toBe(false);
    expect(result.current.count).toBe(0);
    expect(result.current.reminders).toEqual([]);
  });

  it('generates reminders for PRIMARY_OWNER or OWNER when bills are within window or overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));

    vi.mocked(PropertyContext.usePropertyContext).mockReturnValue({
      activePropertyId: 'prop-123',
      activeProperty: mockProperty,
      role: 'PRIMARY_OWNER' as UserRole,
      isOwner: true,
      isPrimaryOwner: true,
      isAdmin: true,
      isOperator: true,
      isCleaner: false,
      isViewer: false,
      properties: [],
      isLoading: false,
      switchProperty: vi.fn(),
      refreshProperties: vi.fn(),
      currentProperty: null,
      activeMembership: null,
    });

    // Administración (due 5): overdue by 5 days
    // Agua (due 10): due today
    // Internet (due 15): not within window (10 < 15 - 2 = 13)
    // Gas (due 24): not within window
    // Luz (due 25): not within window
    vi.spyOn(useExpensesModule, 'useExpenses').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpensesModule.useExpenses>);
    vi.spyOn(useExpensesModule, 'useRecurringTemplates').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpensesModule.useRecurringTemplates>);

    const { result } = renderHook(() => useServiceReminders());
    expect(result.current.canReceiveServiceAlerts).toBe(true);
    expect(result.current.count).toBe(2);

    const overdueAdmin = result.current.reminders.find((r) => r.category === 'hoa_administration');
    expect(overdueAdmin).toBeDefined();
    expect(overdueAdmin?.urgency).toBe('overdue');
    expect(overdueAdmin?.status).toBe('awaiting_invoice');

    const waterToday = result.current.reminders.find((r) => r.category === 'water');
    expect(waterToday).toBeDefined();
    expect(waterToday?.urgency).toBe('due_today');

    vi.useRealTimers();
  });

  it('excludes services that have already been marked as PAID', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));

    vi.mocked(PropertyContext.usePropertyContext).mockReturnValue({
      activePropertyId: 'prop-123',
      activeProperty: mockProperty,
      role: 'OWNER' as UserRole,
      isOwner: true,
      isPrimaryOwner: false,
      isAdmin: true,
      isOperator: true,
      isCleaner: false,
      isViewer: false,
      properties: [],
      isLoading: false,
      switchProperty: vi.fn(),
      refreshProperties: vi.fn(),
      currentProperty: null,
      activeMembership: null,
    });

    const paidAdminExpense: Expense = {
      id: 'exp-admin-1',
      property_id: 'prop-123',
      category: 'hoa_administration',
      expense_type: 'fixed_monthly',
      description: 'Administración Noviembre',
      amount: 380000,
      date: '2026-11-04',
      billing_month: '2026-11',
      payment_status: 'paid',
      created_at: '2026-11-04',
      updated_at: '2026-11-04',
    };

    vi.spyOn(useExpensesModule, 'useExpenses').mockReturnValue({
      data: [paidAdminExpense],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpensesModule.useExpenses>);
    vi.spyOn(useExpensesModule, 'useRecurringTemplates').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpensesModule.useRecurringTemplates>);

    const { result } = renderHook(() => useServiceReminders());

    // Administración is paid, so only Agua should produce a reminder
    expect(result.current.reminders.some((r) => r.category === 'hoa_administration')).toBe(false);
    expect(result.current.reminders.some((r) => r.category === 'water')).toBe(true);

    vi.useRealTimers();
  });
});
