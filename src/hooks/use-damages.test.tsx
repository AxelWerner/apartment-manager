import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useDamages,
  useCreateDamage,
  useUpdateDamage,
  useDeleteDamage,
} from './use-damages';
import * as apiService from '@/lib/api-service';
import type { Damage } from '@/types/database';

vi.mock('@/lib/api-service', () => ({
  fetchDamages: vi.fn(),
  createDamage: vi.fn(),
  updateDamage: vi.fn(),
  deleteDamage: vi.fn(),
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

describe('use-damages hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDamage: Damage = {
    id: 'dmg-1',
    property_id: 'prop-1',
    linked_booking_id: null,
    title: 'Broken lamp',
    description: 'Living room floor lamp was broken',
    date_discovered: '2026-10-10',
    severity: 'low',
    estimated_repair_cost: 50000,
    actual_repair_cost: 45000,
    reimbursement_amount: 45000,
    claim_status: 'reimbursed',
    aircover_case_number: 'AC-12345',
    resolution_notes: 'Paid by guest',
    photo_urls: ['https://example.com/photo.jpg'],
    linked_expense_id: null,
  };

  it('fetches damages via useDamages with optional propId', async () => {
    vi.mocked(apiService.fetchDamages).mockResolvedValue([mockDamage]);

    const { result } = renderHook(() => useDamages('prop-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([mockDamage]);
    expect(apiService.fetchDamages).toHaveBeenCalledWith('prop-1');
  });

  it('creates damage and invalidates damages query via useCreateDamage', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const newDamageData = {
      property_id: 'prop-1',
      linked_booking_id: null,
      title: 'Scratched table',
      description: 'Scratches on wooden table',
      date_discovered: '2026-10-12',
      severity: 'medium' as const,
      estimated_repair_cost: 30000,
      actual_repair_cost: 0,
      reimbursement_amount: 0,
      claim_status: 'discovered' as const,
      aircover_case_number: null,
      resolution_notes: null,
      photo_urls: [],
      linked_expense_id: null,
    };

    vi.mocked(apiService.createDamage).mockResolvedValue({
      ...newDamageData,
      id: 'dmg-2',
    });

    const { result } = renderHook(() => useCreateDamage(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync(newDamageData);

    expect(apiService.createDamage).toHaveBeenCalledWith(newDamageData);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['damages'] });
  });

  it('updates damage and invalidates damages query via useUpdateDamage', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(apiService.updateDamage).mockResolvedValue({
      ...mockDamage,
      actual_repair_cost: 48000,
    });

    const { result } = renderHook(() => useUpdateDamage(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      id: 'dmg-1',
      updates: { actual_repair_cost: 48000 },
    });

    expect(apiService.updateDamage).toHaveBeenCalledWith('dmg-1', {
      actual_repair_cost: 48000,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['damages'] });
  });

  it('deletes damage and invalidates damages query via useDeleteDamage', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(apiService.deleteDamage).mockResolvedValue(undefined as unknown as void);

    const { result } = renderHook(() => useDeleteDamage(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync('dmg-1');

    expect(apiService.deleteDamage).toHaveBeenCalledWith('dmg-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['damages'] });
  });
});
