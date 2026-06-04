import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { BookingFormData } from "@/lib/validators";

export interface Booking {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  nightly_rate: number;
  total_payout: number;
  airbnb_fees: number;
  cleaning_fee: number;
  status: "confirmed" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BookingFilters {
  from?: string;
  to?: string;
  status?: string;
}

export function useBookings(filters?: BookingFilters) {
  return useQuery({
    queryKey: ["bookings", filters],
    queryFn: async () => {
      let query = supabase.from("bookings").select("*").order("check_in", { ascending: false });

      if (filters?.from) query = query.gte("check_in", filters.from);
      if (filters?.to) query = query.lte("check_in", filters.to);
      if (filters?.status) query = query.eq("status", filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return data as Booking[];
    },
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: ["bookings", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Booking;
    },
    enabled: Boolean(id),
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BookingFormData) => {
      const { data: booking, error } = await supabase.from("bookings").insert(data).select().single();
      if (error) throw error;
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BookingFormData> }) => {
      const { data: booking, error } = await supabase.from("bookings").update(data).eq("id", id).select().single();
      if (error) throw error;
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

