import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGuestGuide, updateGuestGuide } from '@/lib/guide-service';
import type { GuestGuideData } from '@/types/database';

export function useGuestGuide(propertyId?: string) {
  return useQuery({
    queryKey: ['guest_guide', propertyId],
    queryFn: () => fetchGuestGuide(propertyId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateGuestGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<GuestGuideData>) => updateGuestGuide(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest_guide'] });
      queryClient.invalidateQueries({ queryKey: ['property'] });
    },
  });
}
