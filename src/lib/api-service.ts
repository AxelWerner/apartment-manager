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
      return defaultVal;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return raw as unknown as T;
    }
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
  const targetId =
    propertyId ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('active_property_id') : null) ||
    DEFAULT_PROPERTY_ID;
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
  const targetId =
    updates.id ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('active_property_id') : null) ||
    DEFAULT_PROPERTY_ID;
  const current = getLocal<Property>(STORAGE_KEYS.property, INITIAL_PROPERTY);
  const updated: Property = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setLocal(STORAGE_KEYS.property, updated);

  try {
    await supabase.from('properties').update(updates).eq('id', targetId);
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
    const extraAmount = Number(b.extra_amount) || 0;
    const accommodationBase = Math.max(0, payout - cleaningFee) + extraAmount;

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

    const baseAccommodation = Math.max(0, payout - cleaningFee);
    const ownerAccommodationWithoutExtra = Math.max(0, baseAccommodation - Math.round(baseAccommodation * adminRate));
    const nights = Number(b.number_of_nights) || 0;
    const nightly_rate =
      nights > 0 ? Math.round(ownerAccommodationWithoutExtra / nights) : Number(b.nightly_rate) || 0;

    return {
      ...b,
      cleaning_fee_collected: cleaningFee,
      extra_amount: extraAmount,
      extra_description: b.extra_description || null,
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
      if (propertyId) {
        const allLocal = getLocal<Booking[]>(STORAGE_KEYS.bookings, []);
        const others = allLocal.filter((b) => b.property_id && b.property_id !== propertyId);
        setLocal(STORAGE_KEYS.bookings, [...synced, ...others]);
      } else {
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
    if (error) {
      console.error('Error inserting booking in Supabase:', error);
    } else if (data) {
      newBooking.id = data.id;
    }
  } catch (err) {
    console.error('Network error creating booking:', err);
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
  importMode?: 'completed' | 'pending' | 'legacy';
}

export interface UpsertBatchResult {
  inserted: number;
  updated: number;
  unchanged: number;
  deleted: number;
  total: number;
}

export const IMPORT_TIMESTAMPS_KEYS = {
  completed: 'apt_mgr_last_import_completed',
  pending: 'apt_mgr_last_import_pending',
};

/**
 * Fetch the last Airbnb import timestamps from Supabase for the specified property.
 * If not yet explicitly set in the properties table, inspects existing bookings in Supabase
 * to intelligently deduce the latest imported reservation date.
 */
export async function fetchImportTimestamps(
  propertyId?: string
): Promise<{ completed: string | null; pending: string | null }> {
  const targetId =
    propertyId ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('active_property_id') : null) ||
    DEFAULT_PROPERTY_ID;

  try {
    const { data, error } = await supabase
      .from('properties')
      .select('last_airbnb_import_completed, last_airbnb_import_pending')
      .eq('id', targetId)
      .maybeSingle();

    if (!error && data) {
      let completed = data.last_airbnb_import_completed || null;
      let pending = data.last_airbnb_import_pending || null;

      // Smart fallback: If completed timestamp is not yet set in the property record,
      // inspect existing completed Airbnb bookings in Supabase to find the most recent one
      if (!completed) {
        const { data: latestBooking } = await supabase
          .from('bookings')
          .select('booking_date, check_in, created_at')
          .eq('property_id', targetId)
          .eq('source', 'airbnb')
          .order('booking_date', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (latestBooking) {
          completed = latestBooking.booking_date || latestBooking.created_at || null;
        }
      }

      if (completed) {
        setLocal(IMPORT_TIMESTAMPS_KEYS.completed, completed);
      } else {
        completed = getLocal<string | null>(IMPORT_TIMESTAMPS_KEYS.completed, null);
      }

      if (pending) {
        setLocal(IMPORT_TIMESTAMPS_KEYS.pending, pending);
      } else {
        pending = getLocal<string | null>(IMPORT_TIMESTAMPS_KEYS.pending, null);
      }

      return { completed, pending };
    }
  } catch (err) {
    console.warn('Could not fetch import timestamps from Supabase, using local fallback:', err);
  }

  // Fallback to local storage if offline
  return {
    completed: getLocal<string | null>(IMPORT_TIMESTAMPS_KEYS.completed, null),
    pending: getLocal<string | null>(IMPORT_TIMESTAMPS_KEYS.pending, null),
  };
}

export function getLastImportTimestamps(): { completed: string | null; pending: string | null } {
  try {
    return {
      completed: getLocal<string | null>(IMPORT_TIMESTAMPS_KEYS.completed, null),
      pending: getLocal<string | null>(IMPORT_TIMESTAMPS_KEYS.pending, null),
    };
  } catch {
    return { completed: null, pending: null };
  }
}

export async function setLastImportTimestamp(
  type: 'completed' | 'pending',
  propertyId?: string,
  timestamp?: string
): Promise<void> {
  const targetId =
    propertyId ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('active_property_id') : null) ||
    DEFAULT_PROPERTY_ID;
  const val = timestamp || new Date().toISOString();

  // 1. Update local cache for fast synchronous access
  setLocal(IMPORT_TIMESTAMPS_KEYS[type], val);

  // 2. Persist to Supabase in properties table so all devices/PCs share the exact timestamp
  try {
    const colName =
      type === 'completed' ? 'last_airbnb_import_completed' : 'last_airbnb_import_pending';
    await supabase
      .from('properties')
      .update({
        [colName]: val,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId);
  } catch (err) {
    console.warn('Could not persist import timestamp to Supabase:', err);
  }
}

export async function clearLastImportTimestamp(
  type?: 'completed' | 'pending',
  propertyId?: string
): Promise<void> {
  const targetId =
    propertyId ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('active_property_id') : null) ||
    DEFAULT_PROPERTY_ID;

  if (type) {
    setLocal(IMPORT_TIMESTAMPS_KEYS[type], null);
  } else {
    setLocal(IMPORT_TIMESTAMPS_KEYS.completed, null);
    setLocal(IMPORT_TIMESTAMPS_KEYS.pending, null);
  }

  try {
    const updates: Record<string, null> = {};
    if (!type || type === 'completed') updates.last_airbnb_import_completed = null;
    if (!type || type === 'pending') updates.last_airbnb_import_pending = null;
    await supabase.from('properties').update(updates).eq('id', targetId);
  } catch (err) {
    console.warn('Could not clear import timestamp in Supabase:', err);
  }
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

  const targetPropId = bookings[0]?.property_id;

  // Determine if deletion of existing Airbnb bookings should execute:
  // 1. Explicitly requested via deleteAllAirbnb
  // 2. Completed reservations mode (options?.importMode === 'completed')
  // 3. Yearly sync requested via syncYear
  // 4. Legacy mode (!options?.importMode) where batch replaces existing records
  const shouldDeleteAirbnb = Boolean(
    options?.deleteAllAirbnb ||
    options?.importMode === 'completed' ||
    options?.syncYear ||
    !options?.importMode
  );

  let idsToDelete: string[] = [];
  let remaining = current;

  if (shouldDeleteAirbnb) {
    const toDelete = current.filter((b) => {
      if (!isAirbnbBooking(b)) return false;
      if (targetPropId && b.property_id && b.property_id !== targetPropId) return false;
      if (options?.syncYear && !options?.deleteAllAirbnb) {
        return getBookingYear(b.check_in) === options.syncYear;
      }
      return true;
    });

    idsToDelete = toDelete.map((b) => b.id);

    // Execute deletion in Supabase if any
    try {
      const fromQuery = supabase.from('bookings');
      if (fromQuery && typeof fromQuery.delete === 'function') {
        const deleteQuery = fromQuery.delete();
        if (typeof deleteQuery.eq === 'function') {
          let q = deleteQuery.eq('source', 'airbnb');
          if (targetPropId && typeof q.eq === 'function') {
            q = q.eq('property_id', targetPropId);
          }
          await q;
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
    remaining = current.filter((b) => {
      if (!isAirbnbBooking(b)) return true;
      if (targetPropId && b.property_id && b.property_id !== targetPropId) return true;
      if (options?.syncYear && !options?.deleteAllAirbnb) {
        return getBookingYear(b.check_in) !== options.syncYear;
      }
      return false;
    });
  }

  // 1. SMART IMPORT MODE: 'completed' (Reservas ya hechas / pagos completados)
  if (options?.importMode === 'completed') {
    let inserted = 0;
    let updated = 0;
    const nowIso = new Date().toISOString();

    const updatedList = [...remaining];

    for (const incoming of bookings) {
      const existingIdx = incoming.airbnb_confirmation_code
        ? updatedList.findIndex((b) => b.airbnb_confirmation_code === incoming.airbnb_confirmation_code)
        : -1;

      if (existingIdx >= 0) {
        const existing = updatedList[existingIdx];
        updatedList[existingIdx] = {
          ...existing,
          ...incoming,
          id: existing.id,
          status: 'completed',
          payout_status: 'paid',
          payout_date: incoming.payout_date || existing.payout_date || incoming.check_in,
          updated_at: nowIso,
        };
        updated++;
      } else {
        const newBooking: Booking = {
          ...incoming,
          id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          status: 'completed',
          payout_status: 'paid',
          payout_date: incoming.payout_date || incoming.check_in,
          created_at: nowIso,
          updated_at: nowIso,
        };
        updatedList.unshift(newBooking);
        inserted++;
      }
    }

    try {
      if (shouldDeleteAirbnb) {
        if (typeof supabase.from === 'function') {
          const insertQuery = supabase.from('bookings');
          if (insertQuery && typeof insertQuery.insert === 'function') {
            const { error: insErr } = await insertQuery.insert(bookings);
            if (insErr) {
              console.error('Error inserting completed bookings into Supabase:', insErr);
            }
          }
        }
      } else {
        const codes = bookings
          .map((b) => b.airbnb_confirmation_code)
          .filter((c): c is string => Boolean(c));

        let existingCodes = new Set<string>();
        if (codes.length > 0 && targetPropId && typeof supabase.from === 'function') {
          const selectQuery = supabase.from('bookings').select('airbnb_confirmation_code');
          if (selectQuery && typeof selectQuery.eq === 'function') {
            const { data: existingRows } = await selectQuery
              .eq('property_id', targetPropId)
              .in('airbnb_confirmation_code', codes);
            if (existingRows) {
              existingCodes = new Set(existingRows.map((r) => r.airbnb_confirmation_code));
            }
          }
        }

        const toInsert = bookings.filter(
          (b) => !b.airbnb_confirmation_code || !existingCodes.has(b.airbnb_confirmation_code)
        );
        const toUpdate = bookings.filter(
          (b) => b.airbnb_confirmation_code && existingCodes.has(b.airbnb_confirmation_code)
        );

        if (toInsert.length > 0 && typeof supabase.from === 'function') {
          const insertQuery = supabase.from('bookings');
          if (insertQuery && typeof insertQuery.insert === 'function') {
            const { error: insErr } = await insertQuery.insert(toInsert);
            if (insErr) {
              console.error('Error inserting new bookings into Supabase:', insErr);
            }
          }
        }

        if (typeof supabase.from === 'function') {
          for (const b of toUpdate) {
            if (b.airbnb_confirmation_code && targetPropId) {
              await supabase
                .from('bookings')
                .update(b)
                .eq('property_id', targetPropId)
                .eq('airbnb_confirmation_code', b.airbnb_confirmation_code);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Completed import Supabase sync warning:', err);
    }

    const synced = syncBookingStatuses(updatedList);
    setLocal(STORAGE_KEYS.bookings, synced);

    await setLastImportTimestamp('completed', targetPropId);

    return {
      inserted,
      updated,
      unchanged: 0,
      deleted: idsToDelete.length,
      total: bookings.length,
    };
  }

  // 2. SMART IMPORT MODE: 'pending' (Reservas futuras / cobros pendientes)
  if (options?.importMode === 'pending') {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    const nowIso = new Date().toISOString();

    const updatedList = [...remaining];

    for (const incoming of bookings) {
      const existingIdx = incoming.airbnb_confirmation_code
        ? updatedList.findIndex((b) => b.airbnb_confirmation_code === incoming.airbnb_confirmation_code)
        : -1;

      if (existingIdx >= 0) {
        const existing = updatedList[existingIdx];
        // If booking is already recorded as 'paid', preserve paid status
        if (existing.payout_status === 'paid') {
          unchanged++;
          continue;
        }

        updatedList[existingIdx] = {
          ...existing,
          ...incoming,
          id: existing.id,
          payout_status: 'pending',
          updated_at: nowIso,
        };
        updated++;
      } else {
        const newBooking: Booking = {
          ...incoming,
          id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          payout_status: 'pending',
          created_at: nowIso,
          updated_at: nowIso,
        };
        updatedList.unshift(newBooking);
        inserted++;
      }
    }

    try {
      if (shouldDeleteAirbnb) {
        if (typeof supabase.from === 'function') {
          const insertQuery = supabase.from('bookings');
          if (insertQuery && typeof insertQuery.insert === 'function') {
            await insertQuery.insert(bookings);
          }
        }
      } else {
        const codes = bookings
          .map((b) => b.airbnb_confirmation_code)
          .filter((c): c is string => Boolean(c));

        let existingCodes = new Set<string>();
        if (codes.length > 0 && targetPropId && typeof supabase.from === 'function') {
          const selectQuery = supabase.from('bookings').select('airbnb_confirmation_code');
          if (selectQuery && typeof selectQuery.eq === 'function') {
            const { data: existingRows } = await selectQuery
              .eq('property_id', targetPropId)
              .in('airbnb_confirmation_code', codes);
            if (existingRows) {
              existingCodes = new Set(existingRows.map((r) => r.airbnb_confirmation_code));
            }
          }
        }

        const toInsert = bookings.filter(
          (b) => !b.airbnb_confirmation_code || !existingCodes.has(b.airbnb_confirmation_code)
        );
        const toUpdate = bookings.filter(
          (b) => b.airbnb_confirmation_code && existingCodes.has(b.airbnb_confirmation_code)
        );

        if (toInsert.length > 0 && typeof supabase.from === 'function') {
          const insertQuery = supabase.from('bookings');
          if (insertQuery && typeof insertQuery.insert === 'function') {
            await insertQuery.insert(toInsert);
          }
        }

        if (typeof supabase.from === 'function') {
          for (const b of toUpdate) {
            if (b.airbnb_confirmation_code && targetPropId) {
              await supabase
                .from('bookings')
                .update(b)
                .eq('property_id', targetPropId)
                .eq('airbnb_confirmation_code', b.airbnb_confirmation_code);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Pending import Supabase sync warning:', err);
    }

    const synced = syncBookingStatuses(updatedList);
    setLocal(STORAGE_KEYS.bookings, synced);

    await setLastImportTimestamp('pending', targetPropId);

    return {
      inserted,
      updated,
      unchanged,
      deleted: idsToDelete.length,
      total: bookings.length,
    };
  }

  // 3. LEGACY MODE (used when !options?.importMode)
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
    const { error } = await supabase.from('bookings').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating booking in Supabase:', error);
    }
  } catch (err) {
    console.error('Network error updating booking:', err);
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
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

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
    if (error) {
      console.error('Error fetching expenses from Supabase:', error);
    }
  } catch (err) {
    console.error('fetchExpenses error:', err);
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
      Object.assign(newExpense, data);
    } else if (error) {
      console.error('Error inserting expense into Supabase:', error);
      throw error;
    }
  } catch (err) {
    console.error('createExpense error:', err);
    throw err;
  }

  const current = getLocal<Expense[]>(STORAGE_KEYS.expenses, INITIAL_EXPENSES);
  const updated = [newExpense, ...current];
  setLocal(STORAGE_KEYS.expenses, updated);
  return newExpense;
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating expense in Supabase:', error);
      throw error;
    }

    const current = getLocal<Expense[]>(STORAGE_KEYS.expenses, INITIAL_EXPENSES);
    const updated = current.map((e) => (e.id === id ? { ...e, ...(data || updates), updated_at: new Date().toISOString() } : e));
    setLocal(STORAGE_KEYS.expenses, updated);
    return (data as Expense) || updated.find((e) => e.id === id)!;
  } catch (err) {
    console.error('updateExpense error:', err);
    throw err;
  }
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
