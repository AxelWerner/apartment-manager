import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useProperty, useUpdateProperty } from './use-property';
import * as apiService from '@/lib/api-service';
import type { Property } from '@/types/database';

vi.mock('@/lib/api-service', () => ({
  fetchProperty: vi.fn(),
  updateProperty: vi.fn(),
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

describe('use-property hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProperty: Property = {
    id: 'prop-1',
    name: 'Palermo Hollywood Studio',
    address: 'Humboldt 1900',
    city: 'Buenos Aires',
    currency: 'USD',
    default_nightly_rate: 100,
    default_cleaning_fee: 30,
    check_in_time: '15:00',
    check_out_time: '11:00',
    created_by: 'user-1',
    primary_owner_id: 'user-1',
  };

  it('fetches property via useProperty', async () => {
    vi.mocked(apiService.fetchProperty).mockResolvedValue(mockProperty);

    const { result } = renderHook(() => useProperty('prop-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockProperty);
    expect(apiService.fetchProperty).toHaveBeenCalledWith('prop-1');
  });

  it('updates property and invalidates query via useUpdateProperty', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(apiService.updateProperty).mockResolvedValue({
      ...mockProperty,
      name: 'Palermo Soho Loft',
    });

    const { result } = renderHook(() => useUpdateProperty(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: 'Palermo Soho Loft' });

    expect(apiService.updateProperty).toHaveBeenCalledWith({
      name: 'Palermo Soho Loft',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['property'] });
  });
});
