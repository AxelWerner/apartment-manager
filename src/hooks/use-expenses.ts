import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchTemplates,
} from '@/lib/api-service';
import type { Expense, RecurringBillTemplate } from '@/types/database';

export function useExpenses(propId?: string) {
  return useQuery<Expense[]>({
    queryKey: ['expenses', propId],
    queryFn: () => fetchExpenses(propId),
  });
}

export function useRecurringTemplates(propId?: string) {
  return useQuery<RecurringBillTemplate[]>({
    queryKey: ['recurring-templates', propId],
    queryFn: () => fetchTemplates(propId),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newExpense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) =>
      createExpense(newExpense),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Expense> }) =>
      updateExpense(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
