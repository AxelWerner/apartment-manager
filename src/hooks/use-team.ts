import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPropertyMembers,
  updatePropertyMemberRole,
  updatePropertyMemberOwnership,
  transferPrimaryOwnership,
  removePropertyMember,
  fetchPropertyInvitations,
  createPropertyInvitation,
  cancelPropertyInvitation,
} from '@/lib/invitations-service';
import type { PropertyMember, PropertyInvitation, UserRole } from '@/types/database';

export function usePropertyMembers(propertyId?: string) {
  return useQuery<PropertyMember[]>({
    queryKey: ['property_members', propertyId],
    queryFn: () => (propertyId ? fetchPropertyMembers(propertyId) : Promise.resolve([])),
    enabled: Boolean(propertyId),
  });
}

export function usePropertyInvitations(propertyId?: string) {
  return useQuery<PropertyInvitation[]>({
    queryKey: ['property_invitations', propertyId],
    queryFn: () => (propertyId ? fetchPropertyInvitations(propertyId) : Promise.resolve([])),
    enabled: Boolean(propertyId),
  });
}

export function useCreateInvitation(propertyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
      role,
    }: {
      email: string;
      role: UserRole;
    }) => {
      if (!propertyId) throw new Error('No active property selected');
      return createPropertyInvitation(propertyId, email, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_invitations', propertyId] });
    },
  });
}

export function useCancelInvitation(propertyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => cancelPropertyInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_invitations', propertyId] });
    },
  });
}

export function useUpdateMemberRole(propertyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, newRole }: { memberId: string; newRole: UserRole }) => {
      if (!propertyId) throw new Error('No active property selected');
      return updatePropertyMemberRole(propertyId, memberId, newRole);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_members', propertyId] });
    },
  });
}

export function useUpdateMemberOwnership(propertyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, isOwner }: { memberId: string; isOwner: boolean }) => {
      if (!propertyId) throw new Error('No active property selected');
      return updatePropertyMemberOwnership(propertyId, memberId, isOwner);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_members', propertyId] });
    },
  });
}

export function useTransferPrimaryOwnership(propertyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ newOwnerUserId }: { newOwnerUserId: string }) => {
      if (!propertyId) throw new Error('No active property selected');
      return transferPrimaryOwnership(propertyId, newOwnerUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_members', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
    },
  });
}

export function useRemoveMember(propertyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => {
      if (!propertyId) throw new Error('No active property selected');
      return removePropertyMember(propertyId, memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_members', propertyId] });
    },
  });
}
