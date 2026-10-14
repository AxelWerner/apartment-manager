import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PropertyProvider, useActiveProperty, usePropertyContext } from './PropertyContext';
import * as propertyService from '@/lib/property-service';
import * as authHook from '@/hooks/use-auth';
import type { Property } from '@/types/database';
import type { User } from '@supabase/supabase-js';

vi.mock('@/lib/property-service', () => ({
  fetchUserProperties: vi.fn(),
  fetchPropertyById: vi.fn(),
  createNewProperty: vi.fn(),
  updatePropertyById: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('PropertyContext hooks', () => {
  const mockProperty: Property = {
    id: 'prop-1',
    name: 'Palermo Loft',
    address: 'Calle Falsa 123',
    city: 'Buenos Aires',
    currency: 'USD',
    default_nightly_rate: 100,
    default_cleaning_fee: 30,
    check_in_time: '15:00',
    check_out_time: '11:00',
    created_by: 'user-1',
    primary_owner_id: 'user-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(propertyService.fetchPropertyById).mockResolvedValue(mockProperty);
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'owner@example.com' } as unknown as User,
    } as unknown as ReturnType<typeof authHook.useAuth>);
  });

  it('usePropertyContext returns undefined outside PropertyProvider', () => {
    const { result } = renderHook(() => usePropertyContext());
    expect(result.current).toBeUndefined();
  });

  it('useActiveProperty throws outside PropertyProvider', () => {
    expect(() => renderHook(() => useActiveProperty())).toThrow(
      'useActiveProperty must be used within a PropertyProvider'
    );
  });

  it('provides active property and role flags inside PropertyProvider', async () => {
    vi.mocked(propertyService.fetchUserProperties).mockResolvedValue([
      {
        property: mockProperty,
        role: 'PRIMARY_OWNER',
        isOwner: true,
      },
    ]);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/p/prop-1/dashboard']}>
        <PropertyProvider>{children}</PropertyProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useActiveProperty(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeProperty).toEqual(mockProperty);
    expect(result.current.activePropertyId).toBe('prop-1');
    expect(result.current.role).toBe('PRIMARY_OWNER');
    expect(result.current.isPrimaryOwner).toBe(true);
    expect(result.current.isOwner).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isOperator).toBe(true);
  });

  it('allows switching property via switchProperty', async () => {
    vi.mocked(propertyService.fetchUserProperties).mockResolvedValue([
      {
        property: mockProperty,
        role: 'PRIMARY_OWNER',
        isOwner: true,
      },
    ]);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/p/prop-1/dashboard']}>
        <PropertyProvider>{children}</PropertyProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useActiveProperty(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.switchProperty('prop-2');
    });

    expect(localStorage.getItem('active_property_id')).toBe('prop-2');
    expect(mockNavigate).toHaveBeenCalledWith('/p/prop-2/dashboard');
  });

  it('creates property and updates active property', async () => {
    const newProp: Property = {
      ...mockProperty,
      id: 'prop-new',
      name: 'New Apartment',
    };

    vi.mocked(propertyService.fetchUserProperties).mockResolvedValue([]);
    vi.mocked(propertyService.createNewProperty).mockResolvedValue(newProp);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/']}>
        <PropertyProvider>{children}</PropertyProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useActiveProperty(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdResult: Property | null = null;
    await act(async () => {
      createdResult = await result.current.createProperty({
        name: 'New Apartment',
        address: 'Calle Falsa 123',
        city: 'Buenos Aires',
      });
    });

    expect(createdResult).toEqual(newProp);
    expect(localStorage.getItem('active_property_id')).toBe('prop-new');
    expect(mockNavigate).toHaveBeenCalledWith('/p/prop-new/dashboard');
  });

  it('updates property via updateProperty', async () => {
    vi.mocked(propertyService.fetchUserProperties).mockResolvedValue([
      {
        property: mockProperty,
        role: 'PRIMARY_OWNER',
        isOwner: true,
      },
    ]);

    const updatedProp: Property = {
      ...mockProperty,
      name: 'Renamed Loft',
    };

    vi.mocked(propertyService.updatePropertyById).mockResolvedValue(updatedProp);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/p/prop-1/dashboard']}>
        <PropertyProvider>{children}</PropertyProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useActiveProperty(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let updatedResult: Property | null = null;
    await act(async () => {
      updatedResult = await result.current.updateProperty({ name: 'Renamed Loft' });
    });

    expect(propertyService.updatePropertyById).toHaveBeenCalledWith('prop-1', {
      name: 'Renamed Loft',
    });
    expect(updatedResult).toEqual(updatedProp);
  });
});
