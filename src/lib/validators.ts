import { z } from "zod/v4";

// --- Booking Schemas ---

export const bookingSchema = z.object({
  guest_name: z.string().min(1, "Guest name is required"),
  check_in: z.string().min(1, "Check-in date is required"),
  check_out: z.string().min(1, "Check-out date is required"),
  nightly_rate: z.number().positive("Nightly rate must be positive"),
  total_payout: z.number().positive("Total payout must be positive"),
  airbnb_fees: z.number().min(0).optional(),
  cleaning_fee: z.number().min(0).optional(),
  status: z.enum(["confirmed", "completed", "cancelled"]).optional(),
  notes: z.string().optional(),
});

export type BookingFormData = z.infer<typeof bookingSchema>;

// --- Expense Schemas ---

export const expenseSchema = z.object({
  category: z.enum([
    "fixed_cost",
    "cleaning",
    "supervisor",
    "maintenance",
    "supplies",
    "other",
  ]),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  recurring: z.boolean().optional(),
  recurrence_rule: z.enum(["monthly", "quarterly", "annual"]).optional(),
  paid: z.boolean().optional(),
  linked_booking_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

