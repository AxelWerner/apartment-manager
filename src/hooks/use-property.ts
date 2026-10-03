import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProperty, updateProperty } from '@/lib/api-service';
import type { Property } from '@/types/database';

export function useProperty(propId?: string) {
  return useQuery<Property>({
    queryKey: ['property', propId],
    queryFn: () => fetchProperty(propId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<Property>) => updateProperty(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property'] });
    },
  });
}

