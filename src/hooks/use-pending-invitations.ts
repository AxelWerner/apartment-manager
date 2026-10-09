import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  fetchUserPendingInvitations,
  acceptPropertyInvitation,
  declinePropertyInvitation,
} from '@/lib/invitations-service';
import { useAuth } from '@/hooks/use-auth';
import { useActiveProperty } from '@/context/PropertyContext';
import type { UserPendingInvitation } from '@/types/database';

export function useUserPendingInvitations() {
  const { user } = useAuth();

  const query = useQuery<UserPendingInvitation[]>({
    queryKey: ['my_pending_invitations', user?.id],
    queryFn: () => (user ? fetchUserPendingInvitations() : Promise.resolve([])),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    invitations: query.data ?? [],
    count: query.data?.length ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useAcceptPendingInvitation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { refreshProperties } = useActiveProperty();

  return useMutation({
    mutationFn: async ({
      token,
      propertyName,
      propertyId,
    }: {
      token: string;
      propertyName?: string;
      propertyId?: string;
    }) => {
      const res = await acceptPropertyInvitation(token);
      if (!res.success) {
        throw new Error(res.error || 'No se pudo aceptar la invitación');
      }
      return { ...res, property_id: res.property_id || propertyId, propertyName };
    },
    onSuccess: async (data) => {
      toast.success(
        data.propertyName
          ? `¡Te has unido exitosamente a "${data.propertyName}"!`
          : '¡Te has unido exitosamente al apartamento!'
      );

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['my_pending_invitations'] });
      queryClient.invalidateQueries({ queryKey: ['user_properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });

      // Refresh property list in context
      try {
        await refreshProperties();
      } catch (err) {
        console.warn('Failed to refresh properties in context:', err);
      }

      // Navigate to the accepted property's dashboard
      if (data.property_id) {
        localStorage.setItem('active_property_id', data.property_id);
        navigate(`/p/${data.property_id}/dashboard`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error al aceptar la invitación');
    },
  });
}

export function useDeclinePendingInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      token,
      propertyName,
    }: {
      token: string;
      propertyName?: string;
    }) => {
      const res = await declinePropertyInvitation(token);
      if (!res.success) {
        throw new Error(res.error || 'No se pudo rechazar la invitación');
      }
      return { propertyName };
    },
    onSuccess: (data) => {
      toast.info(
        data.propertyName
          ? `Invitación a "${data.propertyName}" rechazada`
          : 'Invitación rechazada'
      );
      queryClient.invalidateQueries({ queryKey: ['my_pending_invitations'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error al rechazar la invitación');
    },
  });
}
