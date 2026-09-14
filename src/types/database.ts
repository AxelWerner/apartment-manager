export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BookingStatus = 'confirmed' | 'checked_in' | 'completed' | 'cancelled';
export type PayoutStatus = 'pending' | 'paid';

export type ExpenseCategory =
  | 'hoa_administration'
  | 'electricity'
  | 'water'
  | 'gas'
  | 'internet_cable'
  | 'insurance_annual'
  | 'cleaning_laundry'
  | 'supplies_restock'
  | 'maintenance_repairs'
  | 'platform_fees'
  | 'other';

export type ExpenseType =
  | 'fixed_monthly'
  | 'utility_monthly'
  | 'annual'
  | 'per_stay'
  | 'occasional';

export type RecurrencePeriod = 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';
export type PaymentStatus = 'paid' | 'pending' | 'scheduled';

export type DamageSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ClaimStatus =
  | 'discovered'
  | 'guest_contacted'
  | 'aircover_claim_submitted'
  | 'approved'
  | 'reimbursed'
  | 'written_off';

export interface Property {
  id: string;
  name: string;
  address: string | null;
  city: string;
  currency: string;
  default_nightly_rate: number;
  default_cleaning_fee: number;
  monthly_revenue_target?: number;
  check_in_time: string;
  check_out_time: string;
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id: string;
  property_id: string;
  airbnb_confirmation_code: string | null;
  guest_name: string;
  guest_phone: string | null;
  number_of_guests: number;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  number_of_nights: number;
  nightly_rate: number;
  gross_amount: number;
  cleaning_fee_collected: number;
  airbnb_service_fee: number;
  taxes_withheld: number;
  net_payout: number;
  status: BookingStatus;
  payout_status: PayoutStatus;
  payout_date: string | null;
  source: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  property_id: string;
  category: ExpenseCategory;
  expense_type: ExpenseType;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  billing_month: string | null; // YYYY-MM
  payment_status: PaymentStatus;
  is_recurring: boolean;
  recurrence_period: RecurrencePeriod | null;
  linked_booking_id: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  // Optional join
  booking?: {
    guest_name: string;
  } | null;
}

export interface RecurringBillTemplate {
  id: string;
  property_id: string;
  category: ExpenseCategory;
  expense_type: ExpenseType;
  name: string;
  default_amount: number;
  typical_due_day: number | null;
  annual_due_month: number | null;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Damage {
  id: string;
  property_id: string;
  linked_booking_id: string | null;
  title: string;
  description: string;
  date_discovered: string;
  severity: DamageSeverity;
  estimated_repair_cost: number;
  actual_repair_cost: number;
  reimbursement_amount: number;
  claim_status: ClaimStatus;
  aircover_case_number: string | null;
  resolution_notes: string | null;
  photo_urls: string[];
  linked_expense_id: string | null;
  created_at?: string;
  updated_at?: string;
  // Optional join
  booking?: {
    guest_name: string;
    check_in: string;
    check_out: string;
  } | null;
}
