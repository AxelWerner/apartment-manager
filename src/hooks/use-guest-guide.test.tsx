import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useGuestGuide, useUpdateGuestGuide } from './use-guest-guide';
import * as guideService from '@/lib/guide-service';
import type { GuestGuideData } from '@/types/database';

vi.mock('@/lib/guide-service', () => ({
  fetchGuestGuide: vi.fn(),
  updateGuestGuide: vi.fn(),
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

describe('use-guest-guide hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGuide: GuestGuideData = {
    id: 'prop-1',
    property_id: 'prop-1',
    welcome_title: 'Sunny Loft',
    welcome_message: 'Welcome to your stay',
    apartment_number: '4B',
    address: '123 Main St, Apt 4B',
    maps_url: 'https://maps.google.com',
    wifi_ssid: 'GuestWifi',
    wifi_password: 'SecretPassword123',
    show_access_code: true,
    access_code: '1234',
    access_instructions: 'Code on keypad',
    check_in_time: '15:00',
    check_out_time: '11:00',
    check_out_instructions: 'Leave keys on counter',
    host_name: 'John Host',
    host_phone: '+1 555-0199',
    host_email: 'host@example.com',
    building_amenities: [],
    house_rules: [],
    appliances: [],
    key_distances: [],
    recommendations: [],
    emergency_contacts: [],
  };

  it('fetches guest guide via useGuestGuide', async () => {
    vi.mocked(guideService.fetchGuestGuide).mockResolvedValue(mockGuide);

    const { result } = renderHook(() => useGuestGuide('prop-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockGuide);
    expect(guideService.fetchGuestGuide).toHaveBeenCalledWith('prop-1');
  });

  it('updates guest guide and invalidates queries via useUpdateGuestGuide', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const updates: Partial<GuestGuideData> = {
      wifi_password: 'NewPassword2026',
    };

    vi.mocked(guideService.updateGuestGuide).mockResolvedValue({
      ...mockGuide,
      ...updates,
    });

    const { result } = renderHook(() => useUpdateGuestGuide(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync(updates);

    expect(guideService.updateGuestGuide).toHaveBeenCalledWith(updates);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['guest_guide'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['property'] });
  });
});
