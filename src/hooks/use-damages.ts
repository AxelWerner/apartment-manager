import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDamages,
  createDamage,
  updateDamage,
  deleteDamage,
} from '@/lib/api-service';
import type { Damage } from '@/types/database';

export function useDamages() {
  return useQuery({
    queryKey: ['damages'],
    queryFn: fetchDamages,
  });
}

export function useCreateDamage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newDamage: Omit<Damage, 'id' | 'created_at' | 'updated_at'>) =>
      createDamage(newDamage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damages'] });
    },
  });
}

export function useUpdateDamage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Damage> }) =>
      updateDamage(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damages'] });
    },
  });
}

export function useDeleteDamage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDamage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damages'] });
    },
  });
}
