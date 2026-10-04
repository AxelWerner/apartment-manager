import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPropertyMembers,
  updatePropertyMemberRole,
  removePropertyMember,
  fetchPropertyInvitations,
  createPropertyInvitation,
  cancelPropertyInvitation,
  fetchInvitationByToken,
  acceptPropertyInvitation,
} from './invitations-service';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-current' } } }),
    },
  },
}));

describe('Invitations & Members Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPropertyMembers', () => {
    it('fetches members and combines with their profiles', async () => {
      const mockMembers = [
        {
          id: 'mem-1',
          property_id: 'prop-1',
          user_id: 'u-1',
          role: 'OWNER',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ];
      const mockProfiles = [
        {
          id: 'u-1',
          full_name: 'Ana López',
          phone: '+57 300 123 4567',
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'property_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMembers, error: null }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const members = await fetchPropertyMembers('prop-1');
      expect(members).toHaveLength(1);
      expect(members[0].role).toBe('OWNER');
      expect(members[0].profile?.full_name).toBe('Ana López');
    });

    it('returns empty array if error occurs', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const members = await fetchPropertyMembers('prop-1');
      expect(members).toEqual([]);
    });
  });

  describe('updatePropertyMemberRole', () => {
    it('updates member role successfully', async () => {
      const eqMock2 = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock1 });

      vi.mocked(supabase.from).mockReturnValue({
        update: updateMock,
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(
        updatePropertyMemberRole('prop-1', 'mem-1', 'ADMINISTRATOR')
      ).resolves.not.toThrow();

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'ADMINISTRATOR' })
      );
    });
  });

  describe('removePropertyMember', () => {
    it('deletes member row from property_members', async () => {
      const eqMock2 = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock1 });

      vi.mocked(supabase.from).mockReturnValue({
        delete: deleteMock,
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(removePropertyMember('prop-1', 'mem-1')).resolves.not.toThrow();
      expect(deleteMock).toHaveBeenCalled();
    });
  });

  describe('fetchPropertyInvitations', () => {
    it('fetches pending invitations for a property', async () => {
      const mockInvs = [
        {
          id: 'inv-1',
          property_id: 'prop-1',
          email: 'colaborador@test.com',
          role: 'ADMINISTRATOR',
          token: 'token123',
          status: 'pending',
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: mockInvs, error: null });
      const eqStatusMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqPropMock = vi.fn().mockReturnValue({ eq: eqStatusMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqPropMock });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as unknown as ReturnType<typeof supabase.from>);

      const res = await fetchPropertyInvitations('prop-1');
      expect(res).toHaveLength(1);
      expect(res[0].email).toBe('colaborador@test.com');
    });
  });

  describe('createPropertyInvitation', () => {
    it('creates an invitation with token and 48-hour expiration', async () => {
      const mockInv = {
        id: 'inv-1',
        property_id: 'prop-1',
        email: 'colaborador@test.com',
        role: 'ADMINISTRATOR',
        token: 'token123',
        status: 'pending',
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockInv, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });

      vi.mocked(supabase.from).mockReturnValue({
        insert: insertMock,
      } as unknown as ReturnType<typeof supabase.from>);

      const res = await createPropertyInvitation('prop-1', 'colaborador@test.com', 'ADMINISTRATOR');
      expect(res.email).toBe('colaborador@test.com');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 'prop-1',
          email: 'colaborador@test.com',
          role: 'ADMINISTRATOR',
          status: 'pending',
        })
      );
    });
  });

  describe('cancelPropertyInvitation', () => {
    it('cancels/deletes an invitation by id', async () => {
      const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });

      vi.mocked(supabase.from).mockReturnValue({
        delete: deleteMock,
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(cancelPropertyInvitation('inv-1')).resolves.not.toThrow();
      expect(deleteMock).toHaveBeenCalled();
    });
  });

  describe('fetchInvitationByToken', () => {
    it('returns invitation and property details if token is valid', async () => {
      const futureDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const mockInv = {
        id: 'inv-1',
        property_id: 'prop-1',
        email: 'test@example.com',
        role: 'ADMINISTRATOR',
        token: 'tok-abc',
        status: 'pending',
        expires_at: futureDate,
      };

      const mockProp = {
        id: 'prop-1',
        name: 'Penthouse Poblado',
        city: 'Medellín',
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'property_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockInv, error: null }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockProp, error: null }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const res = await fetchInvitationByToken('tok-abc');
      expect(res).not.toBeNull();
      expect(res?.invitation.email).toBe('test@example.com');
      expect(res?.property?.name).toBe('Penthouse Poblado');
      expect(res?.isExpired).toBe(false);
    });
  });

  describe('acceptPropertyInvitation', () => {
    it('invokes accept_property_invitation RPC', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, property_id: 'prop-1' },
        error: null,
      });

      const res = await acceptPropertyInvitation('tok-abc');
      expect(res.success).toBe(true);
      expect(res.property_id).toBe('prop-1');
      expect(supabase.rpc).toHaveBeenCalledWith('accept_property_invitation', {
        invitation_token: 'tok-abc',
      });
    });
  });
});
