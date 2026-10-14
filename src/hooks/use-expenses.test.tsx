import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useExpenses,
  useRecurringTemplates,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from './use-expenses';
import * as apiService from '@/lib/api-service';
import type { Expense, RecurringBillTemplate } from '@/types/database';

vi.mock('@/lib/api-service', () => ({
  fetchExpenses: vi.fn(),
  fetchTemplates: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}));

function createWrapper(queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('use-expenses hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockExpense: Expense = {
    id: 'exp-1',
    property_id: 'prop-1',
    category: 'electricity',
    expense_type: 'utility_monthly',
    description: 'Electric bill October',
    amount: 150000,
    date: '2026-10-05',
    due_date: '2026-10-20',
    billing_month: '2026-10',
    payment_status: 'paid',
    is_recurring: true,
    recurrence_period: 'monthly',
    linked_booking_id: null,
    receipt_url: null,
    notes: 'Paid online',
  };

  const mockTemplate: RecurringBillTemplate = {
    id: 'tmpl-1',
    property_id: 'prop-1',
    category: 'electricity',
    expense_type: 'utility_monthly',
    name: 'Electricity Template',
    default_amount: 150000,
    typical_due_day: 15,
    annual_due_month: null,
    is_active: true,
    notes: null,
  };

  it('fetches expenses via useExpenses', async () => {
    vi.mocked(apiService.fetchExpenses).mockResolvedValue([mockExpense]);

    const { result } = renderHook(() => useExpenses('prop-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([mockExpense]);
    expect(apiService.fetchExpenses).toHaveBeenCalledWith('prop-1');
  });

  it('fetches templates via useRecurringTemplates', async () => {
    vi.mocked(apiService.fetchTemplates).mockResolvedValue([mockTemplate]);

    const { result } = renderHook(() => useRecurringTemplates('prop-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([mockTemplate]);
    expect(apiService.fetchTemplates).toHaveBeenCalledWith('prop-1');
  });

  it('creates expense and invalidates expenses query via useCreateExpense', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const newExpenseData = {
      property_id: 'prop-1',
      category: 'cleaning_laundry' as const,
      expense_type: 'per_stay' as const,
      description: 'Cleaning fee',
      amount: 60000,
      date: '2026-10-08',
      due_date: null,
      billing_month: '2026-10',
      payment_status: 'paid' as const,
      is_recurring: false,
      recurrence_period: null,
      linked_booking_id: null,
      receipt_url: null,
      notes: null,
    };

    vi.mocked(apiService.createExpense).mockResolvedValue({
      ...newExpenseData,
      id: 'exp-2',
    });

    const { result } = renderHook(() => useCreateExpense(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync(newExpenseData);

    expect(apiService.createExpense).toHaveBeenCalledWith(newExpenseData);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
  });

  it('updates expense and invalidates expenses query via useUpdateExpense', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(apiService.updateExpense).mockResolvedValue({
      ...mockExpense,
      amount: 175000,
    });

    const { result } = renderHook(() => useUpdateExpense(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      id: 'exp-1',
      updates: { amount: 175000 },
    });

    expect(apiService.updateExpense).toHaveBeenCalledWith('exp-1', {
      amount: 175000,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
  });

  it('deletes expense and invalidates expenses query via useDeleteExpense', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(apiService.deleteExpense).mockResolvedValue(undefined as unknown as void);

    const { result } = renderHook(() => useDeleteExpense(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync('exp-1');

    expect(apiService.deleteExpense).toHaveBeenCalledWith('exp-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
  });
});
