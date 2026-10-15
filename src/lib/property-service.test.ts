import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchUserProperties,
  fetchPropertyById,
  createNewProperty,
  updatePropertyById,
} from './property-service';
import { supabase } from './supabase';
import type { Property } from '@/types/database';
import type { User, UserResponse } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('property-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProperty: Property = {
    id: 'prop-1',
    name: 'El Poblado Loft',
    address: 'Calle 10 # 40-20',
    city: 'Medellín',
    currency: 'COP',
    default_nightly_rate: 250000,
    default_cleaning_fee: 80000,
    check_in_time: '15:00',
    check_out_time: '11:00',
  };

  describe('fetchUserProperties', () => {
    it('returns properties for explicit user ID', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        data: [
          {
            role: 'PRIMARY_OWNER',
            properties: mockProperty,
          },
          {
            role: 'VIEWER',
            properties: { ...mockProperty, id: 'prop-2', name: 'Laureles Apt' },
          },
        ],
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

      const result = await fetchUserProperties('user-123');

      expect(supabase.from).toHaveBeenCalledWith('property_members');
      expect(mockSelect).toHaveBeenCalledWith('role, properties (*)');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(result).toHaveLength(2);
      expect(result[0].isOwner).toBe(true);
      expect(result[0].role).toBe('PRIMARY_OWNER');
      expect(result[1].isOwner).toBe(false);
      expect(result[1].role).toBe('VIEWER');
    });

    it('retrieves user from session when no explicit user ID is provided', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'auth-user-99' } as unknown as User },
        error: null,
      });

      const mockEq = vi.fn().mockResolvedValue({
        data: [
          {
            role: 'OWNER',
            properties: mockProperty,
          },
        ],
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

      const result = await fetchUserProperties();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('user_id', 'auth-user-99');
      expect(result).toHaveLength(1);
      expect(result[0].isOwner).toBe(true);
    });

    it('falls back to first property when no authenticated user exists', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as unknown as UserResponse);

      const mockLimit = vi.fn().mockResolvedValue({
        data: [mockProperty],
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

      const result = await fetchUserProperties();

      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual([
        {
          property: mockProperty,
          role: 'ADMINISTRATOR',
          isOwner: true,
        },
      ]);
    });

    it('returns empty array when no user and no fallback property exists', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as unknown as UserResponse);

      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

      const result = await fetchUserProperties();
      expect(result).toEqual([]);
    });

    it('returns empty array if database returns an error', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('DB connection failed'),
      });

      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

      const result = await fetchUserProperties('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('fetchPropertyById', () => {
    it('returns property by ID', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockProperty,
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

      const result = await fetchPropertyById('prop-1');

      expect(supabase.from).toHaveBeenCalledWith('properties');
      expect(mockEq).toHaveBeenCalledWith('id', 'prop-1');
      expect(result).toEqual(mockProperty);
    });

    it('returns null when property is not found or error occurs', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

      const result = await fetchPropertyById('missing');
      expect(result).toBeNull();
    });
  });

  describe('createNewProperty', () => {
    it('creates property with default values and returns it', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'owner-uuid' } as unknown as User },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockProperty,
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as unknown as ReturnType<typeof supabase.from>);

      const result = await createNewProperty({
        name: 'El Poblado Loft',
        address: 'Calle 10 # 40-20',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'El Poblado Loft',
          address: 'Calle 10 # 40-20',
          city: 'Medellín',
          currency: 'COP',
          default_nightly_rate: 250000,
          created_by: 'owner-uuid',
        })
      );
      expect(result).toEqual(mockProperty);
    });

    it('updates creator role in property_members if creatorRole is not PRIMARY_OWNER', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'owner-uuid' } as unknown as User },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockProperty,
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      const mockUpdateEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq1 });

      vi.mocked(supabase.from).mockImplementation(((table: string) => {
        if (table === 'properties') {
          return { insert: mockInsert };
        }
        if (table === 'property_members') {
          return { update: mockUpdate };
        }
        return {};
      }) as unknown as typeof supabase.from);

      await createNewProperty({
        name: 'El Poblado Loft',
        creatorRole: 'ADMINISTRATOR',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ADMINISTRATOR',
        })
      );
      expect(mockUpdateEq1).toHaveBeenCalledWith('property_id', mockProperty.id);
      expect(mockUpdateEq2).toHaveBeenCalledWith('user_id', 'owner-uuid');
    });

    it('throws error when property insertion fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'owner-uuid' } as unknown as User },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Insert failed'),
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as unknown as ReturnType<typeof supabase.from>);

      await expect(
        createNewProperty({ name: 'Failing Property' })
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('updatePropertyById', () => {
    it('updates property and returns updated data', async () => {
      const updatedProp = { ...mockProperty, name: 'Renamed Loft' };
      const mockSingle = vi.fn().mockResolvedValue({
        data: updatedProp,
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<typeof supabase.from>);

      const result = await updatePropertyById('prop-1', { name: 'Renamed Loft' });

      expect(supabase.from).toHaveBeenCalledWith('properties');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Renamed Loft',
          updated_at: expect.any(String),
        })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'prop-1');
      expect(result).toEqual(updatedProp);
    });

    it('throws error when update fails', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Update failed'),
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<typeof supabase.from>);

      await expect(
        updatePropertyById('prop-1', { name: 'Failing' })
      ).rejects.toThrow('Update failed');
    });
  });
});
