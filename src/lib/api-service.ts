import { supabase, DEFAULT_PROPERTY_ID } from './supabase';
import type { Booking, Expense, Damage, RecurringBillTemplate, Property } from '@/types/database';
import {
  INITIAL_PROPERTY,
  INITIAL_BOOKINGS,
  INITIAL_EXPENSES,
  INITIAL_DAMAGES,
  INITIAL_TEMPLATES,
} from './mock-data';
import { resolveBookingStatus, getBookingSourceInfo, getBookingYear, isAirbnbBooking } from './formatters';

const STORAGE_KEYS = {
  property: 'apt_mgr_property',
  bookings: 'apt_mgr_bookings_v2',
  expenses: 'apt_mgr_expenses',
  damages: 'apt_mgr_damages',
  templates: 'apt_mgr_templates',
};

// Migrate / clear old prototype dummy data if present
try {
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('apt_mgr_bookings')) {
      localStorage.removeItem('apt_mgr_bookings');
    }
    const cachedBookings = localStorage.getItem(STORAGE_KEYS.bookings);
    if (cachedBookings && (cachedBookings.includes('b-001') || cachedBookings.includes('HMTW8FZT3Y'))) {
      localStorage.setItem(STORAGE_KEYS.bookings, '[]');
    }
    const cachedExp = localStorage.getItem(STORAGE_KEYS.expenses);
    if (cachedExp && (cachedExp.includes('exp-01') || cachedExp.includes('exp-08'))) {
      localStorage.setItem(STORAGE_KEYS.expenses, '[]');
    }
    const cachedDamages = localStorage.getItem(STORAGE_KEYS.damages);
    if (cachedDamages && (cachedDamages.includes('dmg-01') || cachedDamages.includes('dmg-02'))) {
      localStorage.setItem(STORAGE_KEYS.damages, '[]');
    }
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
export async function fetchProperty(propertyId?: string): Promise<Property> {
  const targetId = propertyId || DEFAULT_PROPERTY_ID;
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', targetId)
      .single();

    if (!error && data) {
      if (targetId === DEFAULT_PROPERTY_ID) {
        setLocal(STORAGE_KEYS.property, data);
      }
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
    const rawCleaningFee = Number(b.cleaning_fee_collected);
    const cleaningFee =
      b.cleaning_fee_collected !== undefined && b.cleaning_fee_collected !== null && !isNaN(rawCleaningFee)
        ? rawCleaningFee
        : 60000;
    const accommodationBase = Math.max(0, payout - cleaningFee);

    const sourceInfo = getBookingSourceInfo(b.source);
    const adminRate = sourceInfo.commissionRate;
    const ownerRate = sourceInfo.ownerRate;

    const management_fee =
      b.management_fee !== undefined && b.management_fee !== null
        ? Number(b.management_fee)
        : Math.round(accommodationBase * adminRate);

    const owner_payout =
      b.owner_payout !== undefined && b.owner_payout !== null
        ? Number(b.owner_payout)
        : Math.round(accommodationBase * ownerRate);

    const ownerAccommodation = Math.max(0, accommodationBase - management_fee);
    const nights = Number(b.number_of_nights) || 0;
    const nightly_rate =
      nights > 0 ? Math.round(ownerAccommodation / nights) : Number(b.nightly_rate) || 0;

    return {
      ...b,
      cleaning_fee_collected: cleaningFee,
      status: resolved !== b.status ? resolved : b.status,
      management_fee,
      owner_payout,
      nightly_rate,
    };
  });
}

// Synchronize statuses dynamically based on dates without dropping duplicate codes or names
function syncBookingsList(bookings: Booking[]): Booking[] {
  // Filter out any legacy prototype dummy records
  const validBookings = bookings.filter((b) => !b.airbnb_confirmation_code?.startsWith('HM9ABC'));
  return syncBookingStatuses(validBookings);
}

// -------------------------------------------------------------
// BOOKINGS API
// -------------------------------------------------------------
export async function fetchBookings(propertyId?: string): Promise<Booking[]> {
  try {
    let query = supabase
      .from('bookings')
      .select('*')
      .order('check_in', { ascending: false });

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data, error } = await query;

    if (!error && data) {
      const synced = syncBookingsList(data as Booking[]);
      if (!propertyId || propertyId === DEFAULT_PROPERTY_ID) {
        setLocal(STORAGE_KEYS.bookings, synced);
      }
      return synced;
    }
  } catch {
    // Fallback
  }
  const rawList = getLocal<Booking[]>(STORAGE_KEYS.bookings, INITIAL_BOOKINGS);
  const synced = syncBookingsList(
    propertyId ? rawList.filter((b) => b.property_id === propertyId) : rawList
  );
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

export interface UpsertBatchOptions {
  syncYear?: string;
  deleteMissing?: boolean;
  deleteAllAirbnb?: boolean;
}

export interface UpsertBatchResult {
  inserted: number;
  updated: number;
  unchanged: number;
  deleted: number;
  total: number;
}

export async function upsertBookingsBatch(
  bookings: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[],
  options?: UpsertBatchOptions
): Promise<UpsertBatchResult> {
  if (!bookings || bookings.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      unchanged: 0,
      deleted: 0,
      total: 0,
    };
  }

  const current = getLocal<Booking[]>(STORAGE_KEYS.bookings, INITIAL_BOOKINGS);

  // Identify and delete existing Airbnb bookings (Direct bookings are NEVER deleted)
  // If options?.syncYear is specified and not deleteAllAirbnb, only delete Airbnb bookings of that year.
  // Otherwise (by default for imports), delete ALL existing Airbnb bookings in the database.
  const toDelete = current.filter((b) => {
    if (!isAirbnbBooking(b)) return false;
    if (options?.syncYear && !options?.deleteAllAirbnb) {
      return getBookingYear(b.check_in) === options.syncYear;
    }
    return true;
  });

  const idsToDelete = toDelete.map((b) => b.id);

  // Execute deletion in Supabase if any
  try {
    const fromQuery = supabase.from('bookings');
    if (fromQuery && typeof fromQuery.delete === 'function') {
      const deleteQuery = fromQuery.delete();
      if (!options?.syncYear || options?.deleteAllAirbnb) {
        if (typeof deleteQuery.eq === 'function') {
          await deleteQuery.eq('source', 'airbnb');
        } else if (typeof deleteQuery.in === 'function' && idsToDelete.length > 0) {
          await deleteQuery.in('id', idsToDelete);
        }
      } else if (typeof deleteQuery.in === 'function' && idsToDelete.length > 0) {
        await deleteQuery.in('id', idsToDelete);
      }
    }
  } catch (err) {
    console.warn('Failed to delete existing Airbnb bookings from Supabase:', err);
  }

  // Clean up any linked expenses in localStorage
  if (idsToDelete.length > 0) {
    try {
      const rawExp = localStorage.getItem(STORAGE_KEYS.expenses);
      if (rawExp) {
        const expenses = JSON.parse(rawExp) as Expense[];
        const cleanedExp = expenses.map((e) =>
          e.linked_booking_id && idsToDelete.includes(e.linked_booking_id)
            ? { ...e, linked_booking_id: null }
            : e
        );
        localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(cleanedExp));
      }
    } catch {
      // Ignore
    }
  }

  // Remove deleted items from current before inserting incoming bookings
  const remaining = current.filter((b) => !idsToDelete.includes(b.id));

  // 3. Insert all incoming bookings fresh
  const newBookings: Booking[] = bookings.map((incoming, idx) => ({
    ...incoming,
    id: `b-${Date.now()}-${idx}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  try {
    const { error } = await supabase.from('bookings').insert(bookings);
    if (error) {
      await supabase.from('bookings').upsert(bookings, { onConflict: 'airbnb_confirmation_code' });
    }
  } catch {
    // Supabase unreachable
  }

  const updatedList: Booking[] = [...newBookings, ...remaining];
  const synced = syncBookingStatuses(updatedList);
  setLocal(STORAGE_KEYS.bookings, synced);

  return {
    inserted: bookings.length,
    updated: 0,
    unchanged: 0,
    deleted: idsToDelete.length,
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
export async function fetchExpenses(propertyId?: string): Promise<Expense[]> {
  try {
    let query = supabase
      .from('expenses')
      .select('*, booking:bookings(guest_name)')
      .order('date', { ascending: false });

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data, error } = await query;

    if (!error && data) {
      if (!propertyId || propertyId === DEFAULT_PROPERTY_ID) {
        setLocal(STORAGE_KEYS.expenses, data);
      }
      return data as Expense[];
    }
  } catch {
    // Fallback
  }
  const raw = getLocal<Expense[]>(STORAGE_KEYS.expenses, INITIAL_EXPENSES);
  return propertyId ? raw.filter((e) => e.property_id === propertyId) : raw;
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
export async function fetchTemplates(propertyId?: string): Promise<RecurringBillTemplate[]> {
  try {
    let query = supabase
      .from('recurring_bill_templates')
      .select('*')
      .order('typical_due_day', { ascending: true });

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      if (!propertyId || propertyId === DEFAULT_PROPERTY_ID) {
        setLocal(STORAGE_KEYS.templates, data);
      }
      return data as RecurringBillTemplate[];
    }
  } catch {
    // Fallback
  }
  const raw = getLocal<RecurringBillTemplate[]>(STORAGE_KEYS.templates, INITIAL_TEMPLATES);
  return propertyId ? raw.filter((t) => t.property_id === propertyId) : raw;
}

// -------------------------------------------------------------
// DAMAGES API
// -------------------------------------------------------------
export async function fetchDamages(propertyId?: string): Promise<Damage[]> {
  try {
    let query = supabase
      .from('damages')
      .select('*, booking:bookings(guest_name, check_in, check_out)')
      .order('date_discovered', { ascending: false });

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data, error } = await query;

    if (!error && data) {
      if (!propertyId || propertyId === DEFAULT_PROPERTY_ID) {
        setLocal(STORAGE_KEYS.damages, data);
      }
      return data as Damage[];
    }
  } catch {
    // Fallback
  }
  const raw = getLocal<Damage[]>(STORAGE_KEYS.damages, INITIAL_DAMAGES);
  return propertyId ? raw.filter((d) => d.property_id === propertyId) : raw;
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
