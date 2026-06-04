import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ExpenseFormData } from "@/lib/validators";

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  recurring: boolean;
  recurrence_rule: "monthly" | "quarterly" | "annual" | null;
  paid: boolean;
  linked_booking_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ExpenseFilters {
  from?: string;
  to?: string;
  category?: string;
  paid?: boolean;
}

export function useExpenses(filters?: ExpenseFilters) {
  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: async () => {
      let query = supabase.from("expenses").select("*").order("date", { ascending: false });

      if (filters?.from) query = query.gte("date", filters.from);
      if (filters?.to) query = query.lte("date", filters.to);
      if (filters?.category) query = query.eq("category", filters.category);
      if (filters?.paid !== undefined) query = query.eq("paid", filters.paid);

      const { data, error } = await query;
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: ["expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Expense;
    },
    enabled: Boolean(id),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const { data: expense, error } = await supabase.from("expenses").insert(data).select().single();
      if (error) throw error;
      return expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ExpenseFormData> }) => {
      const { data: expense, error } = await supabase.from("expenses").update(data).eq("id", id).select().single();
      if (error) throw error;
      return expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

