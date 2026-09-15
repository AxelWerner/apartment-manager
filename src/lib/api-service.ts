import { supabase, DEFAULT_PROPERTY_ID } from './supabase';
import type { Booking, Expense, Damage, RecurringBillTemplate, Property } from '@/types/database';
import {
  INITIAL_PROPERTY,
  INITIAL_BOOKINGS,
  INITIAL_EXPENSES,
  INITIAL_DAMAGES,
  INITIAL_TEMPLATES,
} from './mock-data';
import { resolveBookingStatus } from './formatters';

const STORAGE_KEYS = {
  property: 'apt_mgr_property',
  bookings: 'apt_mgr_bookings_v2',
  expenses: 'apt_mgr_expenses',
  damages: 'apt_mgr_damages',
  templates: 'apt_mgr_templates',
};

// Migrate / clear old prototype dummy data if present
try {
  if (typeof window !== 'undefined' && localStorage.getItem('apt_mgr_bookings')) {
    localStorage.removeItem('apt_mgr_bookings');
  }
} catch {
  // Ignore
}

function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultVal));
      return defaultVal;
    }
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
}

// -------------------------------------------------------------
// PROPERTY API
// -------------------------------------------------------------
export async function fetchProperty(): Promise<Property> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', DEFAULT_PROPERTY_ID)
      .single();

    if (!error && data) {
      setLocal(STORAGE_KEYS.property, data);
      return data as Property;
    }
  } catch {
    // Supabase unreachable, use local
  }
  return getLocal<Property>(STORAGE_KEYS.property, INITIAL_PROPERTY);
}

export async function updateProperty(updates: Partial<Property>): Promise<Property> {
  const current = getLocal<Property>(STORAGE_KEYS.property, INITIAL_PROPERTY);
  const updated: Property = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setLocal(STORAGE_KEYS.property, updated);

  try {
    await supabase.from('properties').update(updates).eq('id', DEFAULT_PROPERTY_ID);
  } catch {
    // local fallback
  }

  return updated;
}

// Synchronize booking statuses dynamically based on dates and ensure management fee calculations
function syncBookingStatuses(bookings: Booking[]): Booking[] {
  return bookings.map((b) => {
    const resolved = resolveBookingStatus(b);
    const payout = Number(b.net_payout) || 0;
    const cleaningFee = Number(b.cleaning_fee_collected) || 0;
    const accommodationBase = Math.max(0, payout - cleaningFee);

    const management_fee =
      b.management_fee !== undefined && b.management_fee !== null
        ? Number(b.management_fee)
        : Math.round(accommodationBase * 0.20);

    const owner_payout =
      b.owner_payout !== undefined && b.owner_payout !== null
        ? Number(b.owner_payout)
        : Math.round(accommodationBase * 0.80);

    const ownerAccommodation = Math.max(0, accommodationBase - management_fee);
    const nights = Number(b.number_of_nights) || 0;
    const nightly_rate =
      nights > 0 ? Math.round(ownerAccommodation / nights) : Number(b.nightly_rate) || 0;

    return {
      ...b,
      status: resolved !== b.status ? resolved : b.status,
      management_fee,
      owner_payout,
      nightly_rate,
    };
  });
}

// Deduplicate bookings by confirmation code and synchronize statuses dynamically based on dates
function deduplicateAndSyncBookings(bookings: Booking[]): Booking[] {
  const seenCodes = new Set<string>();
  const uniqueBookings: Booking[] = [];

  for (const b of bookings) {
    // Filter out any legacy prototype dummy records
    if (b.airbnb_confirmation_code?.startsWith('HM9ABC')) {
      continue;
    }
    if (b.airbnb_confirmation_code) {
      const code = b.airbnb_confirmation_code.trim().toUpperCase();
      if (seenCodes.has(code)) {
        continue; // Skip duplicate confirmation code
      }
      seenCodes.add(code);
    }
    uniqueBookings.push(b);
  }

  return syncBookingStatuses(uniqueBookings);
}

// -------------------------------------------------------------
// BOOKINGS API
// -------------------------------------------------------------
export async function fetchBookings(): Promise<Booking[]> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('check_in', { ascending: false });

    if (!error && data && data.length > 0) {
      const synced = deduplicateAndSyncBookings(data as Booking[]);
      setLocal(STORAGE_KEYS.bookings, synced);
      return synced;
    }
  } catch {
    // Fallback
  }
  const rawList = getLocal<Booking[]>(STORAGE_KEYS.bookings, INITIAL_BOOKINGS);
  const synced = deduplicateAndSyncBookings(rawList);
  setLocal(STORAGE_KEYS.bookings, synced);
  return synced;
}

export async function createBooking(booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>): Promise<Booking> {
  const newBooking: Booking = {
    ...booking,
    id: `b-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('bookings')
      .insert(booking)
      .select()
      .single();
    if (!error && data) {
      newBooking.id = data.id;
    }
  } catch {
    // Ignore remote failure
  }

  const current = getLocal<Booking[]>(STORAGE_KEYS.bookings, INITIAL_BOOKINGS);
  const updated = [newBooking, ...current];
  setLocal(STORAGE_KEYS.bookings, updated);
  return newBooking;
}

export interface UpsertBatchResult {
  inserted: number;
  updated: number;
  unchanged: number;
  total: number;
}

export async function upsertBookingsBatch(
  bookings: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[]
): Promise<UpsertBatchResult> {
  const current = getLocal<Booking[]>(STORAGE_KEYS.bookings, INITIAL_BOOKINGS);
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  // Build map of existing bookings by confirmation code
  const existingMap = new Map<string, { booking: Booking; index: number }>();
  current.forEach((b, index) => {
    if (b.airbnb_confirmation_code) {
      existingMap.set(b.airbnb_confirmation_code.trim().toUpperCase(), { booking: b, index });
    }
  });

  const updatedList: Booking[] = [...current];

  for (let idx = 0; idx < bookings.length; idx++) {
    const incoming = bookings[idx];
    const code = incoming.airbnb_confirmation_code?.trim().toUpperCase();
    const match = code ? existingMap.get(code) : undefined;

    if (match) {
      const existing = match.booking;
      // Check if any fields changed
      const hasChanges =
        existing.net_payout !== incoming.net_payout ||
        existing.management_fee !== incoming.management_fee ||
        existing.owner_payout !== incoming.owner_payout ||
        existing.nightly_rate !== incoming.nightly_rate ||
        existing.gross_amount !== incoming.gross_amount ||
        existing.cleaning_fee_collected !== incoming.cleaning_fee_collected ||
        existing.airbnb_service_fee !== incoming.airbnb_service_fee ||
        existing.check_in !== incoming.check_in ||
        existing.check_out !== incoming.check_out ||
        existing.number_of_nights !== incoming.number_of_nights ||
        existing.guest_name !== incoming.guest_name ||
        existing.status !== incoming.status;

      if (hasChanges) {
        updatedList[match.index] = {
          ...existing,
          ...incoming,
          updated_at: new Date().toISOString(),
        };
        // Update local map reference
        match.booking = updatedList[match.index];
        updated++;
      } else {
        unchanged++;
      }
    } else {
      // New booking to insert
      const newBooking: Booking = {
        ...incoming,
        id: `b-${Date.now()}-${idx}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updatedList.unshift(newBooking);
      if (code) {
        existingMap.set(code, { booking: newBooking, index: 0 });
      }
      inserted++;
    }
  }

  try {
    await supabase.from('bookings').upsert(bookings, { onConflict: 'airbnb_confirmation_code' });
  } catch {
    // Supabase unreachable
  }

  const synced = syncBookingStatuses(updatedList);
  setLocal(STORAGE_KEYS.bookings, synced);

  return {
    inserted,
    updated,
    unchanged,
    total: bookings.length,
  };
}

export const createBookingsBatch = upsertBookingsBatch;

export async function updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
  try {
    await supabase.from('bookings').update(updates).eq('id', id);
  } catch {
    // Fallback
  }

  const current = getLocal<Booking[]>(STORAGE_KEYS.bookings, INITIAL_BOOKINGS);
  const updated = current.map((b) => (b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b));
  setLocal(STORAGE_KEYS.bookings, updated);
  return updated.find((b) => b.id === id)!;
}

export async function deleteBooking(id: string): Promise<void> {
  try {
    await supabase.from('bookings').delete().eq('id', id);
  } catch {
    // Fallback
  }

  const current = getLocal<Booking[]>(STORAGE_KEYS.bookings, INITIAL_BOOKINGS);
  setLocal(STORAGE_KEYS.bookings, current.filter((b) => b.id !== id));
}

export async function clearAllBookings(): Promise<void> {
  try {
    await supabase.from('bookings').delete().neq('id', '0');
  } catch {
    // Fallback
  }
  setLocal(STORAGE_KEYS.bookings, []);
}

// -------------------------------------------------------------
// EXPENSES API
// -------------------------------------------------------------
export async function fetchExpenses(): Promise<Expense[]> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, booking:bookings(guest_name)')
      .order('date', { ascending: false });

    if (!error && data && data.length > 0) {
      setLocal(STORAGE_KEYS.expenses, data);
      return data as Expense[];
    }
  } catch {
    // Fallback
  }
  return getLocal<Expense[]>(STORAGE_KEYS.expenses, INITIAL_EXPENSES);
}

export async function createExpense(expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>): Promise<Expense> {
  const newExpense: Expense = {
    ...expense,
    id: `exp-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select()
      .single();
    if (!error && data) {
      newExpense.id = data.id;
    }
  } catch {
    // Remote ignore
  }

  const current = getLocal<Expense[]>(STORAGE_KEYS.expenses, INITIAL_EXPENSES);
  const updated = [newExpense, ...current];
  setLocal(STORAGE_KEYS.expenses, updated);
  return newExpense;
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
  try {
    await supabase.from('expenses').update(updates).eq('id', id);
  } catch {
    // Fallback
  }

  const current = getLocal<Expense[]>(STORAGE_KEYS.expenses, INITIAL_EXPENSES);
  const updated = current.map((e) => (e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e));
  setLocal(STORAGE_KEYS.expenses, updated);
  return updated.find((e) => e.id === id)!;
}

export async function deleteExpense(id: string): Promise<void> {
  try {
    await supabase.from('expenses').delete().eq('id', id);
  } catch {
    // Fallback
  }

  const current = getLocal<Expense[]>(STORAGE_KEYS.expenses, INITIAL_EXPENSES);
  setLocal(STORAGE_KEYS.expenses, current.filter((e) => e.id !== id));
}

// -------------------------------------------------------------
// RECURRING BILL TEMPLATES API
// -------------------------------------------------------------
export async function fetchTemplates(): Promise<RecurringBillTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('recurring_bill_templates')
      .select('*')
      .order('typical_due_day', { ascending: true });

    if (!error && data && data.length > 0) {
      setLocal(STORAGE_KEYS.templates, data);
      return data as RecurringBillTemplate[];
    }
  } catch {
    // Fallback
  }
  return getLocal<RecurringBillTemplate[]>(STORAGE_KEYS.templates, INITIAL_TEMPLATES);
}

// -------------------------------------------------------------
// DAMAGES API
// -------------------------------------------------------------
export async function fetchDamages(): Promise<Damage[]> {
  try {
    const { data, error } = await supabase
      .from('damages')
      .select('*, booking:bookings(guest_name, check_in, check_out)')
      .order('date_discovered', { ascending: false });

    if (!error && data && data.length > 0) {
      setLocal(STORAGE_KEYS.damages, data);
      return data as Damage[];
    }
  } catch {
    // Fallback
  }
  return getLocal<Damage[]>(STORAGE_KEYS.damages, INITIAL_DAMAGES);
}

export async function createDamage(damage: Omit<Damage, 'id' | 'created_at' | 'updated_at'>): Promise<Damage> {
  const newDamage: Damage = {
    ...damage,
    id: `dmg-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('damages')
      .insert(damage)
      .select()
      .single();
    if (!error && data) {
      newDamage.id = data.id;
    }
  } catch {
    // Remote ignore
  }

  const current = getLocal<Damage[]>(STORAGE_KEYS.damages, INITIAL_DAMAGES);
  const updated = [newDamage, ...current];
  setLocal(STORAGE_KEYS.damages, updated);
  return newDamage;
}

export async function updateDamage(id: string, updates: Partial<Damage>): Promise<Damage> {
  try {
    await supabase.from('damages').update(updates).eq('id', id);
  } catch {
    // Fallback
  }

  const current = getLocal<Damage[]>(STORAGE_KEYS.damages, INITIAL_DAMAGES);
  const updated = current.map((d) => (d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d));
  setLocal(STORAGE_KEYS.damages, updated);
  return updated.find((d) => d.id === id)!;
}

export async function deleteDamage(id: string): Promise<void> {
  try {
    await supabase.from('damages').delete().eq('id', id);
  } catch {
    // Fallback
  }

  const current = getLocal<Damage[]>(STORAGE_KEYS.damages, INITIAL_DAMAGES);
  setLocal(STORAGE_KEYS.damages, current.filter((d) => d.id !== id));
}
